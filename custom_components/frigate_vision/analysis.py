"""Image acquisition and OpenAI-compatible analysis."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import math
import mimetypes
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from time import monotonic
from typing import Any, TypeVar

from aiohttp import ClientError, ClientResponse, ClientResponseError, ClientTimeout
from homeassistant.components import media_source
from homeassistant.components.camera import async_get_image as async_get_camera_image
from homeassistant.components.image import async_get_image as async_get_entity_image
from homeassistant.components.media_player.browse_media import (
    async_process_play_media_url,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_URL
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from PIL import Image, UnidentifiedImageError
from yarl import URL

from .const import (
    ATTR_FRIGATE_CLIENT,
    ATTR_FRIGATE_CONFIG,
    CONF_API_KEY,
    CONF_ENDPOINT,
    CONF_EVENT_IMAGE_SOURCE,
    CONF_FRIGATE_ENTRY_ID,
    CONF_MAX_TOKENS,
    CONF_MODEL,
    CONF_RECORDING_WAIT_TIMEOUT,
    CONF_TARGET_WIDTH,
    CONF_TIMEOUT,
    CONF_VIDEO_TIMEOUT,
    DEFAULT_EVENT_IMAGE_SOURCE,
    DEFAULT_MAX_TOKENS,
    DEFAULT_RECORDING_WAIT_TIMEOUT,
    DEFAULT_TARGET_WIDTH,
    DEFAULT_TIMEOUT,
    DEFAULT_VIDEO_TARGET_HEIGHT,
    DEFAULT_VIDEO_TIMEOUT,
    EVENT_IMAGE_SOURCE_SNAPSHOT,
    FRIGATE_DOMAIN,
    IMAGE_SOURCE_EVENT_SNAPSHOT,
    IMAGE_SOURCE_RECORDING,
    MAX_IMAGE_BYTES,
    MAX_IMAGE_PIXELS,
    MAX_PROVIDER_RESPONSE_BYTES,
    MAX_VIDEO_DURATION,
    MAX_VIDEO_PAYLOAD_BYTES,
    MIN_VIDEO_DURATION,
)
from .utils import (
    event_description,
    extract_response_text,
    normalize_chat_completions_url,
    validate_event_id,
)

_LOGGER = logging.getLogger(__name__)

EVENT_READINESS_TIMEOUT = 20.0
DETECT_FALLBACK_TIMEOUT = 5.0
EVENT_RETRY_DELAYS = (0.5, 1.0, 2.0, 4.0)
MAX_EVENT_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_SOURCE_ATTEMPT_TIMEOUT = 10.0
IMMEDIATE_SOURCE_ATTEMPT_TIMEOUT = 1.0
EVENT_METADATA_REFRESH_TIMEOUT = 5.0
TRANSIENT_SOURCE_STATUSES = frozenset({404, 408, 425, 429, *range(500, 600)})
_FlightKey = TypeVar("_FlightKey")


class FrigateVisionError(Exception):
    """Base error raised by Frigate Vision."""


class SourceError(FrigateVisionError):
    """An image source could not be read."""


class ProviderError(FrigateVisionError):
    """The configured model provider failed."""


class FrigateEventError(FrigateVisionError):
    """The selected Frigate event could not be processed."""

    def __init__(
        self,
        message: str,
        *,
        transient: bool = False,
        status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.transient = transient
        self.status = status


class FrigateAuthenticationError(FrigateEventError):
    """Frigate authentication failed permanently."""


class VideoFramesUnavailable(FrigateEventError):
    """The complete recording window could not be assembled."""


async def _read_limited_response(
    response: ClientResponse,
    error_type: type[FrigateVisionError],
    source_name: str,
    *,
    max_bytes: int = MAX_IMAGE_BYTES,
    size_label: str = "25 MB",
) -> bytes:
    """Read an HTTP response without allowing an unbounded body."""
    if response.content_length is not None and response.content_length > max_bytes:
        raise error_type(
            f"{source_name} überschreitet die erlaubte Größe von {size_label}."
        )

    data = bytearray()
    async for chunk in response.content.iter_chunked(64 * 1024):
        if len(data) + len(chunk) > max_bytes:
            raise error_type(
                f"{source_name} überschreitet die erlaubte Größe von {size_label}."
            )
        data.extend(chunk)
    return bytes(data)


def _read_local_file_limited(path: Path) -> bytes:
    """Read at most the configured image limit plus one sentinel byte."""
    with path.open("rb") as file:
        data = file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise SourceError(
            "Die lokale Bilddatei überschreitet die erlaubte Größe von 25 MB."
        )
    return data


@dataclass(slots=True)
class RuntimeData:
    """Runtime state for one Frigate Vision config entry."""

    hass: HomeAssistant
    entry: ConfigEntry
    frigate_entry: ConfigEntry
    provider: OpenAICompatibleProvider
    frigate: FrigateAdapter
    event_flights: dict[str, asyncio.Task[dict[str, Any]]] = field(
        default_factory=dict,
        repr=False,
    )
    event_video_flights: dict[
        tuple[str, str | None, str, int, int], asyncio.Task[dict[str, Any]]
    ] = field(default_factory=dict, repr=False)
    event_write_flights: dict[tuple[str, str], asyncio.Task[None]] = field(
        default_factory=dict,
        repr=False,
    )


def merged_config(entry: ConfigEntry) -> dict[str, Any]:
    """Merge immutable setup data with mutable options."""
    return {**entry.data, **entry.options}


def _prepare_jpeg(
    image_bytes: bytes,
    target_width: int = 0,
    target_height: int = 0,
) -> bytes:
    """Validate, proportionally downsize and normalize an image to JPEG."""
    if not image_bytes:
        raise SourceError("Die Bildquelle ist leer.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise SourceError("Das Bild überschreitet die erlaubte Größe von 25 MB.")
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise SourceError(
                    "Das Bild hat zu viele Pixel für eine sichere Verarbeitung."
                )
            image.load()
            image = image.convert("RGB")
            scale = 1.0
            if target_width > 0:
                scale = min(scale, target_width / image.width)
            if target_height > 0:
                scale = min(scale, target_height / image.height)
            if scale < 1.0:
                width = max(1, round(image.width * scale))
                height = max(1, round(image.height * scale))
                image = image.resize((width, height), Image.Resampling.LANCZOS)
            output = BytesIO()
            image.save(output, format="JPEG", quality=88, optimize=True)
            return output.getvalue()
    except (
        Image.DecompressionBombError,
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as err:
        raise SourceError("Die Quelle enthält kein unterstütztes Bild.") from err


def _base64_size(byte_count: int) -> int:
    """Return the exact encoded length without allocating the Base64 string."""
    return 4 * ((byte_count + 2) // 3)


def _bounded_video_frames(
    frames: list[tuple[float, bytes]],
) -> list[tuple[float, bytes]]:
    """Validate already-normalized frames before building the provider request."""
    encoded_total = 0
    for relative_time, image_bytes in frames:
        if not image_bytes:
            raise SourceError("Die Videosequenz enthält einen leeren Frame.")
        encoded_total += _base64_size(len(image_bytes))
        if encoded_total > MAX_VIDEO_PAYLOAD_BYTES:
            raise SourceError(
                "Der Base64-Payload der Videosequenz überschreitet die "
                "erlaubte Gesamtgröße von 25 MB."
            )
    return frames


class OpenAICompatibleProvider:
    """Small multimodal Chat Completions client."""

    def __init__(self, hass: HomeAssistant, config: dict[str, Any]) -> None:
        self._hass = hass
        self._session = async_get_clientsession(hass)
        self._endpoint = normalize_chat_completions_url(config[CONF_ENDPOINT])
        self._api_key = str(config.get(CONF_API_KEY, "")).strip()
        self._model = str(config[CONF_MODEL]).strip()
        self._timeout = int(config.get(CONF_TIMEOUT, DEFAULT_TIMEOUT))
        self._video_timeout = int(config.get(CONF_VIDEO_TIMEOUT, DEFAULT_VIDEO_TIMEOUT))
        self.target_width = int(config.get(CONF_TARGET_WIDTH, DEFAULT_TARGET_WIDTH))
        self.video_target_height = DEFAULT_VIDEO_TARGET_HEIGHT
        self._max_tokens = int(config.get(CONF_MAX_TOKENS, DEFAULT_MAX_TOKENS))

    async def analyze(self, image_bytes: bytes, prompt: str) -> str:
        """Analyze one image and return non-empty response text."""
        jpeg = await self._hass.async_add_executor_job(
            _prepare_jpeg, image_bytes, self.target_width
        )
        content = [
            {"type": "text", "text": prompt},
            self._image_content(jpeg),
        ]
        return await self._analyze_content(content)

    async def analyze_video_frames(
        self,
        frames: list[tuple[float, bytes]],
        prompt: str,
    ) -> str:
        """Analyze chronologically ordered one-frame-per-second images."""
        if not frames:
            raise SourceError("Die Videosequenz enthält keine Frames.")
        prepared = _bounded_video_frames(frames)
        content: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    "Zeitlich geordnete Videoframes mit einem Frame pro Sekunde. "
                    "Die Zeitangaben beziehen sich auf das beste Ereignisbild."
                ),
            }
        ]
        for relative_time, jpeg in prepared:
            content.append({"type": "text", "text": f"Frame {relative_time:+g} s:"})
            content.append(self._image_content(jpeg))
        content.append({"type": "text", "text": prompt})
        return await self._analyze_content(
            content,
            max_request_bytes=MAX_VIDEO_PAYLOAD_BYTES,
            timeout_seconds=self._video_timeout,
        )

    @staticmethod
    def _image_content(jpeg: bytes) -> dict[str, Any]:
        encoded = base64.b64encode(jpeg).decode("ascii")
        return {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
        }

    async def _analyze_content(
        self,
        content: list[dict[str, Any]],
        *,
        max_request_bytes: int | None = None,
        timeout_seconds: int | None = None,
    ) -> str:
        """Send one bounded multimodal Chat Completions request."""
        request_timeout = self._timeout if timeout_seconds is None else timeout_seconds
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        request = {
            "model": self._model,
            "messages": [
                {
                    "role": "user",
                    "content": content,
                }
            ],
            "max_tokens": self._max_tokens,
        }
        request_body = json.dumps(
            request,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        if max_request_bytes is not None and len(request_body) > max_request_bytes:
            raise SourceError(
                "Der serialisierte Provider-Payload der Videosequenz "
                "überschreitet die erlaubte Gesamtgröße von 25 MB."
            )
        try:
            async with self._session.post(
                self._endpoint,
                headers=headers,
                data=request_body,
                timeout=ClientTimeout(total=request_timeout),
            ) as response:
                body = await _read_limited_response(
                    response,
                    ProviderError,
                    "Die Antwort des Modell-Endpunkts",
                    max_bytes=MAX_PROVIDER_RESPONSE_BYTES,
                    size_label="1 MB",
                )
                if response.status >= 400:
                    detail = body.decode("utf-8", errors="replace")[:300].strip()
                    if response.status in {401, 403}:
                        raise ProviderError(
                            "Der Modell-Endpunkt hat die Zugangsdaten abgelehnt."
                        )
                    raise ProviderError(
                        f"Der Modell-Endpunkt antwortete mit HTTP "
                        f"{response.status}: {detail or 'ohne Fehlertext'}"
                    )
                try:
                    payload = json.loads(body)
                except (ValueError, UnicodeDecodeError) as err:
                    raise ProviderError(
                        "Der Modell-Endpunkt lieferte kein gültiges JSON."
                    ) from err
        except ProviderError:
            raise
        except (asyncio.TimeoutError, TimeoutError) as err:
            raise ProviderError(
                f"Die Analyse hat das Zeitlimit von {request_timeout} Sekunden "
                "überschritten."
            ) from err
        except (ClientResponseError, ClientError) as err:
            raise ProviderError(
                f"Der Modell-Endpunkt ist nicht erreichbar: {err}"
            ) from err

        text = extract_response_text(payload)
        if not text:
            raise ProviderError("Der Modell-Endpunkt lieferte eine leere Antwort.")
        return text


class FrigateAdapter:
    """Adapter around the selected Frigate integration runtime."""

    def __init__(
        self, hass: HomeAssistant, frigate_entry: ConfigEntry, client: Any
    ) -> None:
        self._hass = hass
        self.entry = frigate_entry
        self._client = client
        self._session = async_get_clientsession(hass)

    @property
    def instance_id(self) -> str | None:
        """Return Frigate's MQTT client ID used by its proxy routes."""
        runtime = self._hass.data.get(FRIGATE_DOMAIN, {}).get(self.entry.entry_id, {})
        config = runtime.get(ATTR_FRIGATE_CONFIG, {})
        mqtt = config.get("mqtt", {}) if isinstance(config, dict) else {}
        value = mqtt.get("client_id") if isinstance(mqtt, dict) else None
        return str(value) if value else None

    def key_frame_url(self, event_id: str, camera_entity: str | None = None) -> str:
        """Build a relative, authenticated Frigate proxy reference."""
        instance_id = None
        if camera_entity:
            state = self._hass.states.get(camera_entity)
            if state:
                instance_id = state.attributes.get("client_id")
        instance_id = instance_id or self.instance_id
        if instance_id:
            return f"/api/frigate/{instance_id}/notifications/{event_id}/snapshot.jpg"
        return f"/api/frigate/notifications/{event_id}/snapshot.jpg"

    def _url(self, path: str) -> str:
        return str(URL(str(self.entry.data[CONF_URL]).rstrip("/")) / path)

    @staticmethod
    def _nested_status(err: BaseException) -> int | None:
        """Find an HTTP status preserved by a wrapping client exception."""
        current: BaseException | None = err
        visited: set[int] = set()
        while current is not None and id(current) not in visited:
            visited.add(id(current))
            status = getattr(current, "status", None)
            if isinstance(status, int):
                return status
            current = current.__cause__ or current.__context__
        return None

    @staticmethod
    def _is_nested_network_error(err: BaseException) -> bool:
        """Return whether an exception chain contains a retryable network error."""
        current: BaseException | None = err
        visited: set[int] = set()
        while current is not None and id(current) not in visited:
            visited.add(id(current))
            if isinstance(
                current,
                (asyncio.TimeoutError, TimeoutError, ClientError),
            ):
                return True
            current = current.__cause__ or current.__context__
        return False

    @staticmethod
    def _http_error(
        source: str,
        event_id: str,
        status: int,
    ) -> FrigateEventError:
        """Classify a Frigate source HTTP error without logging expected 404s."""
        if status in {401, 403}:
            message = (
                f"Frigate hat den Zugriff auf {source} für Ereignis "
                f"{event_id} abgelehnt (HTTP {status})."
            )
        elif status == 404:
            message = (
                f"{source} für Frigate-Ereignis {event_id} ist noch nicht verfügbar."
            )
        else:
            message = (
                f"{source} für Frigate-Ereignis {event_id} antwortete "
                f"mit HTTP {status}."
            )
        return FrigateEventError(
            message,
            transient=status in TRANSIENT_SOURCE_STATUSES,
            status=status,
        )

    async def _auth_headers(
        self,
        source: str,
        event_id: str,
        timeout: float,
    ) -> dict[str, str]:
        """Reuse Frigate authentication while preserving retry classification."""
        get_headers = getattr(self._client, "get_auth_headers", None)
        if not callable(get_headers):
            return {}
        try:
            async with asyncio.timeout(max(0.001, timeout)):
                headers = await get_headers()
        except Exception as err:
            status = self._nested_status(err)
            if status is not None:
                http_error = self._http_error(source, event_id, status)
                if http_error.transient:
                    raise http_error from err
                raise FrigateAuthenticationError(
                    str(http_error),
                    status=status,
                ) from err
            if self._is_nested_network_error(err):
                raise FrigateEventError(
                    f"Frigate-Authentifizierung für {source} ist "
                    "vorübergehend nicht erreichbar.",
                    transient=True,
                ) from err
            raise FrigateAuthenticationError(
                f"Frigate-Authentifizierung für {source} ist fehlgeschlagen."
            ) from err
        return dict(headers) if isinstance(headers, dict) else {}

    async def get_event(
        self,
        event_id: str,
        *,
        timeout: float = MAX_SOURCE_ATTEMPT_TIMEOUT,
    ) -> dict[str, Any]:
        """Fetch one exact event through a quiet authenticated request."""
        source = "Ereignisdaten"
        started = monotonic()
        headers = await self._auth_headers(source, event_id, timeout)
        request_timeout = max(0.001, timeout - (monotonic() - started))
        validate_ssl = getattr(self._client, "validate_ssl", True)
        url = self._url(f"api/events/{event_id}")
        try:
            async with self._session.get(
                url,
                headers=headers,
                ssl=validate_ssl,
                timeout=ClientTimeout(total=request_timeout),
            ) as response:
                if response.status >= 400:
                    raise self._http_error(source, event_id, response.status)
                body = await _read_limited_response(
                    response,
                    FrigateEventError,
                    f"Ereignisdaten für Frigate-Ereignis {event_id}",
                    max_bytes=MAX_EVENT_RESPONSE_BYTES,
                    size_label="2 MB",
                )
        except FrigateEventError:
            raise
        except ClientResponseError as err:
            raise self._http_error(source, event_id, err.status) from err
        except (asyncio.TimeoutError, TimeoutError, ClientError) as err:
            raise FrigateEventError(
                f"Ereignisdaten für Frigate-Ereignis {event_id} sind "
                "vorübergehend nicht erreichbar.",
                transient=True,
            ) from err

        try:
            event = json.loads(body)
        except (ValueError, UnicodeDecodeError) as err:
            raise FrigateEventError(
                f"Frigate lieferte für Ereignis {event_id} keine gültigen "
                "Ereignisdaten."
            ) from err
        if not isinstance(event, dict) or str(event.get("id", "")) != event_id:
            raise FrigateEventError(
                f"Frigate lieferte nicht die angeforderten Ereignisdaten "
                f"für {event_id}."
            )
        return event

    async def get_snapshot(
        self,
        event_id: str,
        *,
        timeout: float = MAX_SOURCE_ATTEMPT_TIMEOUT,
    ) -> bytes:
        """Read binary snapshot data using Frigate's existing authentication."""
        return await self._get_binary(
            path=f"api/events/{event_id}/snapshot.jpg",
            source="Snapshot",
            event_id=event_id,
            timeout=timeout,
            max_bytes=MAX_IMAGE_BYTES,
            size_label="25 MB",
        )

    async def get_clean_snapshot(
        self,
        event_id: str,
        *,
        timeout: float = MAX_SOURCE_ATTEMPT_TIMEOUT,
    ) -> bytes:
        """Read Frigate's clean event snapshot without annotations."""
        return await self._get_binary(
            path=f"api/events/{event_id}/snapshot-clean.webp",
            source="Clean-Snapshot",
            event_id=event_id,
            timeout=timeout,
            max_bytes=MAX_IMAGE_BYTES,
            size_label="25 MB",
        )

    async def get_recording_snapshot(
        self,
        event_id: str,
        camera: str,
        frame_time: float,
        *,
        timeout: float = MAX_SOURCE_ATTEMPT_TIMEOUT,
    ) -> bytes:
        """Read a JPEG generated from the recording role at an exact timestamp."""
        timestamp = f"{frame_time:.6f}"
        return await self._get_binary(
            path=f"api/{camera}/recordings/{timestamp}/snapshot.jpg",
            source="Recording-Snapshot",
            event_id=event_id,
            timeout=timeout,
            max_bytes=MAX_IMAGE_BYTES,
            size_label="25 MB",
        )

    async def _get_binary(
        self,
        *,
        path: str,
        source: str,
        event_id: str,
        timeout: float,
        max_bytes: int,
        size_label: str,
    ) -> bytes:
        """Fetch one authenticated bounded Frigate image."""
        started = monotonic()
        headers = await self._auth_headers(source, event_id, timeout)
        request_timeout = max(0.001, timeout - (monotonic() - started))
        validate_ssl = getattr(self._client, "validate_ssl", True)
        url = self._url(path)
        try:
            async with self._session.get(
                url,
                headers=headers,
                ssl=validate_ssl,
                timeout=ClientTimeout(total=request_timeout),
            ) as response:
                if response.status >= 400:
                    raise self._http_error(source, event_id, response.status)
                data = await _read_limited_response(
                    response,
                    FrigateEventError,
                    f"{source} für Frigate-Ereignis {event_id}",
                    max_bytes=max_bytes,
                    size_label=size_label,
                )
        except FrigateEventError:
            raise
        except ClientResponseError as err:
            raise self._http_error(source, event_id, err.status) from err
        except (asyncio.TimeoutError, TimeoutError, ClientError) as err:
            raise FrigateEventError(
                f"{source} für Frigate-Ereignis {event_id} ist "
                "vorübergehend nicht erreichbar.",
                transient=True,
            ) from err
        if not data:
            raise FrigateEventError(
                f"{source} für Frigate-Ereignis {event_id} ist noch leer.",
                transient=True,
            )
        return data

    async def set_description(self, event_id: str, description: str) -> None:
        """Persist a completed analysis atomically to the exact event."""
        try:
            await self._client.api_wrapper(
                "post",
                self._url(f"api/events/{event_id}/description"),
                data={"description": description},
                decode_json=False,
            )
        except Exception as err:
            raise FrigateEventError(
                f"Die Beschreibung für Frigate-Ereignis {event_id} konnte "
                "nicht gespeichert werden."
            ) from err


async def build_runtime(hass: HomeAssistant, entry: ConfigEntry) -> RuntimeData:
    """Construct one runtime and bind it to its Frigate entry."""
    config = merged_config(entry)
    frigate_entry_id = str(config[CONF_FRIGATE_ENTRY_ID])
    frigate_entry = hass.config_entries.async_get_entry(frigate_entry_id)
    if frigate_entry is None or frigate_entry.domain != FRIGATE_DOMAIN:
        raise FrigateVisionError(
            "Die ausgewählte Frigate-Config-Entry existiert nicht mehr."
        )
    runtime = hass.data.get(FRIGATE_DOMAIN, {}).get(frigate_entry_id, {})
    client = runtime.get(ATTR_FRIGATE_CLIENT)
    if client is None:
        raise FrigateVisionError(
            "Die ausgewählte Frigate-Integration ist noch nicht geladen."
        )
    return RuntimeData(
        hass=hass,
        entry=entry,
        frigate_entry=frigate_entry,
        provider=OpenAICompatibleProvider(hass, config),
        frigate=FrigateAdapter(hass, frigate_entry, client),
    )


async def load_entity_image(hass: HomeAssistant, entity_id: str) -> tuple[bytes, str]:
    """Read a camera or image entity."""
    if entity_id.startswith("camera."):
        try:
            image = await async_get_camera_image(hass, entity_id)
        except Exception as err:
            raise SourceError(f"Kamera {entity_id} lieferte kein Bild.") from err
        return image.content, entity_id

    if entity_id.startswith("image."):
        try:
            image = await async_get_entity_image(hass, entity_id)
        except Exception as err:
            raise SourceError(f"Bild-Entität {entity_id} lieferte kein Bild.") from err
        return image.content, entity_id

    raise SourceError("Nur camera.*- und image.*-Entitäten sind erlaubt.")


async def load_media_source(hass: HomeAssistant, source_id: str) -> tuple[bytes, str]:
    """Resolve and fetch one Home Assistant media-source image."""
    if not media_source.is_media_source_id(source_id):
        raise SourceError("Die Quelle ist keine gültige media-source-ID.")
    try:
        resolved = await media_source.async_resolve_media(hass, source_id, None)
        url = async_process_play_media_url(hass, resolved.url)
        async with async_get_clientsession(hass).get(
            url, timeout=ClientTimeout(total=30)
        ) as response:
            if response.status >= 400:
                raise SourceError(
                    f"Media Source antwortete mit HTTP {response.status}."
                )
            data = await _read_limited_response(
                response,
                SourceError,
                "Die Media Source",
            )
    except SourceError:
        raise
    except Exception as err:
        raise SourceError("Die Media Source konnte nicht gelesen werden.") from err
    return data, source_id


async def load_local_file(hass: HomeAssistant, file_path: str) -> tuple[bytes, str]:
    """Read an allowlisted local image file."""
    path = Path(file_path).expanduser().resolve()
    if not hass.config.is_allowed_path(str(path)):
        raise SourceError(
            "Der lokale Pfad ist nicht in allowlist_external_dirs erlaubt."
        )
    if not path.is_file():
        raise SourceError("Die lokale Bilddatei wurde nicht gefunden.")
    mime, _ = mimetypes.guess_type(path.name)
    if not mime or not mime.startswith("image/"):
        raise SourceError("Die lokale Datei ist kein unterstütztes Bild.")
    try:
        data = await hass.async_add_executor_job(_read_local_file_limited, path)
    except SourceError:
        raise
    except OSError as err:
        raise SourceError("Die lokale Bilddatei konnte nicht gelesen werden.") from err
    return data, str(path)


def _source_attempt_timeout(
    deadline: float,
    *,
    allow_expired_attempt: bool = False,
) -> float:
    """Clamp a source request to the remaining shared readiness window."""
    remaining = deadline - monotonic()
    if allow_expired_attempt and remaining <= 0:
        return IMMEDIATE_SOURCE_ATTEMPT_TIMEOUT
    return min(MAX_SOURCE_ATTEMPT_TIMEOUT, max(0.001, remaining))


def event_frame_time(event: dict[str, Any]) -> float | None:
    """Return Frigate's preferred event frame time using documented precedence."""
    data = event.get("data")
    values: list[Any] = []
    if isinstance(data, dict):
        values.extend((data.get("snapshot_frame_time"), data.get("frame_time")))
    values.append(event.get("start_time"))
    for value in values:
        if isinstance(value, bool):
            continue
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(parsed) and parsed > 0:
            return parsed
    return None


def event_camera(event: dict[str, Any]) -> str | None:
    """Return a non-empty Frigate camera key from event metadata."""
    value = str(event.get("camera", "")).strip()
    return value or None


def event_sub_label(event: dict[str, Any]) -> tuple[str | None, float | None]:
    """Return one normalized Frigate sub-label and its optional score."""
    raw_sub_label = event.get("sub_label")
    raw_score: Any = None
    if isinstance(raw_sub_label, str):
        sub_label = raw_sub_label.strip()
    elif (
        isinstance(raw_sub_label, (list, tuple))
        and raw_sub_label
        and isinstance(raw_sub_label[0], str)
    ):
        sub_label = raw_sub_label[0].strip()
        if len(raw_sub_label) > 1:
            raw_score = raw_sub_label[1]
    else:
        sub_label = ""

    if not sub_label:
        return None, None

    data = event.get("data")
    if raw_score is None:
        raw_score = event.get("sub_label_score")
    if raw_score is None and isinstance(data, dict):
        raw_score = data.get("sub_label_score")
    if isinstance(raw_score, bool):
        return sub_label, None
    try:
        score = float(raw_score)
    except (TypeError, ValueError):
        return sub_label, None
    if not math.isfinite(score) or not 0 <= score <= 1:
        return sub_label, None
    return sub_label, score


def _event_sub_label_result(event: dict[str, Any]) -> dict[str, Any]:
    """Build the public sub-label response fields for one event."""
    sub_label, sub_label_score = event_sub_label(event)
    return {
        "sub_label": sub_label,
        "sub_label_score": sub_label_score,
    }


async def _refresh_event_sub_label(
    runtime: RuntimeData,
    *,
    event_id: str,
    fallback_event: dict[str, Any],
) -> dict[str, Any]:
    """Best-effort refresh metadata after analysis without invalidating success."""
    try:
        event = await runtime.frigate.get_event(
            event_id,
            timeout=EVENT_METADATA_REFRESH_TIMEOUT,
        )
    except FrigateEventError as err:
        _LOGGER.debug(
            "Frigate sub-label refresh for event %s failed: %s",
            event_id,
            err,
        )
        event = fallback_event
    return _event_sub_label_result(event)


async def _sleep_for_retry(attempt: int, deadline: float) -> None:
    remaining = deadline - monotonic()
    if remaining <= 0:
        return
    delay = EVENT_RETRY_DELAYS[min(attempt, len(EVENT_RETRY_DELAYS) - 1)]
    await asyncio.sleep(min(delay, remaining))


async def _wait_for_detect_snapshot(
    runtime: RuntimeData,
    *,
    event_id: str,
    force: bool,
    deadline: float,
    timeout_seconds: float,
) -> tuple[
    dict[str, Any],
    bytes | None,
    str,
    str | None,
    float | None,
    bool | None,
]:
    """Prefer a clean event snapshot, then use the annotated snapshot."""
    attempt = 0
    last_error: FrigateEventError | None = None

    while monotonic() < deadline:
        try:
            event = await runtime.frigate.get_event(
                event_id,
                timeout=_source_attempt_timeout(deadline),
            )
            cached_description = event_description(event)
            if cached_description and not force:
                return (
                    event,
                    None,
                    cached_description,
                    None,
                    event_frame_time(event),
                    None,
                )

            if monotonic() >= deadline:
                break
            try:
                snapshot = await runtime.frigate.get_clean_snapshot(
                    event_id,
                    timeout=_source_attempt_timeout(deadline),
                )
                image_has_overlay = False
            except FrigateAuthenticationError:
                raise
            except FrigateEventError as clean_error:
                if clean_error.status in {401, 403}:
                    raise
                snapshot = await runtime.frigate.get_snapshot(
                    event_id,
                    timeout=_source_attempt_timeout(deadline),
                )
                image_has_overlay = True
            return (
                event,
                snapshot,
                "",
                IMAGE_SOURCE_EVENT_SNAPSHOT,
                event_frame_time(event),
                image_has_overlay,
            )
        except FrigateEventError as err:
            if not err.transient:
                raise
            last_error = err

        if deadline - monotonic() <= 0:
            break
        await _sleep_for_retry(attempt, deadline)
        attempt += 1

    detail = str(last_error) if last_error else "Quelle nicht rechtzeitig bereit"
    raise FrigateEventError(
        f"Frigate-Ereignis {event_id} war innerhalb von "
        f"{timeout_seconds:g} Sekunden nicht vollständig verfügbar: "
        f"{detail}"
    )


async def _wait_for_recording_snapshot(
    runtime: RuntimeData,
    *,
    event_id: str,
    force: bool,
    wait_timeout: float,
) -> tuple[
    dict[str, Any],
    bytes | None,
    str,
    str | None,
    float | None,
    bool | None,
]:
    """Prefer a recording-role frame, then use event-snapshot fallbacks."""
    deadline = monotonic() + max(0.0, wait_timeout)
    attempt = 0
    first_attempt = True
    allow_immediate_attempt = wait_timeout <= 0

    while first_attempt or monotonic() < deadline:
        first_attempt = False
        try:
            event = await runtime.frigate.get_event(
                event_id,
                timeout=_source_attempt_timeout(
                    deadline,
                    allow_expired_attempt=allow_immediate_attempt,
                ),
            )
            cached_description = event_description(event)
            if cached_description and not force:
                return (
                    event,
                    None,
                    cached_description,
                    None,
                    event_frame_time(event),
                    None,
                )

            camera = event_camera(event)
            frame_time = event_frame_time(event)
            if camera is None or frame_time is None:
                break
            snapshot = await runtime.frigate.get_recording_snapshot(
                event_id,
                camera,
                frame_time,
                timeout=_source_attempt_timeout(
                    deadline,
                    allow_expired_attempt=allow_immediate_attempt,
                ),
            )
            return (
                event,
                snapshot,
                "",
                IMAGE_SOURCE_RECORDING,
                frame_time,
                False,
            )
        except FrigateAuthenticationError:
            raise
        except FrigateEventError as err:
            if err.status in {401, 403}:
                raise
            if not err.transient:
                break

        if deadline - monotonic() <= 0:
            break
        await _sleep_for_retry(attempt, deadline)
        attempt += 1

    return await _wait_for_detect_snapshot(
        runtime,
        event_id=event_id,
        force=force,
        deadline=monotonic() + DETECT_FALLBACK_TIMEOUT,
        timeout_seconds=DETECT_FALLBACK_TIMEOUT,
    )


async def _acquire_event_snapshot(
    runtime: RuntimeData,
    *,
    event_id: str,
    force: bool,
) -> tuple[
    dict[str, Any],
    bytes | None,
    str,
    str | None,
    float | None,
    bool | None,
]:
    """Acquire an event image according to the config-entry source policy."""
    config = merged_config(runtime.entry)
    source = str(config.get(CONF_EVENT_IMAGE_SOURCE, DEFAULT_EVENT_IMAGE_SOURCE))
    if source == EVENT_IMAGE_SOURCE_SNAPSHOT:
        return await _wait_for_detect_snapshot(
            runtime,
            event_id=event_id,
            force=force,
            deadline=monotonic() + EVENT_READINESS_TIMEOUT,
            timeout_seconds=EVENT_READINESS_TIMEOUT,
        )

    return await _wait_for_recording_snapshot(
        runtime,
        event_id=event_id,
        force=force,
        wait_timeout=_recording_wait_timeout(runtime),
    )


async def _analyze_event_once(
    runtime: RuntimeData,
    *,
    event_id: str,
    camera_entity: str | None,
    prompt: str,
    force: bool,
) -> dict[str, Any]:
    """Run one cache/readiness/provider pipeline for an exact event."""
    key_frame = runtime.frigate.key_frame_url(event_id, camera_entity)
    (
        event,
        snapshot,
        cached_description,
        image_source,
        source_frame_time,
        image_has_overlay,
    ) = await _acquire_event_snapshot(
        runtime,
        event_id=event_id,
        force=force,
    )
    if cached_description:
        return {
            "response_text": cached_description,
            "event_id": event_id,
            "key_frame": key_frame,
            "stored": False,
            "cached": True,
            "image_source": None,
            "source_frame_time": source_frame_time,
            "image_has_overlay": None,
            **_event_sub_label_result(event),
        }

    if snapshot is None:
        raise FrigateEventError(
            f"Snapshot für Frigate-Ereignis {event_id} ist nicht verfügbar."
        )
    response_text = await runtime.provider.analyze(snapshot, prompt)
    sub_label_result = await _refresh_event_sub_label(
        runtime,
        event_id=event_id,
        fallback_event=event,
    )
    return {
        "response_text": response_text,
        "event_id": event_id,
        "key_frame": key_frame,
        "stored": False,
        "cached": False,
        "image_source": image_source,
        "source_frame_time": source_frame_time,
        "image_has_overlay": image_has_overlay,
        **sub_label_result,
    }


def _recording_wait_timeout(runtime: RuntimeData) -> float:
    """Return the bounded recording readiness timeout for one entry."""
    config = merged_config(runtime.entry)
    return min(
        30.0,
        max(
            0.0,
            float(
                config.get(
                    CONF_RECORDING_WAIT_TIMEOUT,
                    DEFAULT_RECORDING_WAIT_TIMEOUT,
                )
            ),
        ),
    )


async def _wait_for_video_event(
    runtime: RuntimeData,
    *,
    event_id: str,
    deadline: float,
    allow_immediate_attempt: bool,
) -> tuple[dict[str, Any], str, float]:
    """Capture one stable camera and best-frame timestamp for video sampling."""
    attempt = 0
    first_attempt = True
    last_error: FrigateEventError | None = None
    while first_attempt or monotonic() < deadline:
        first_attempt = False
        try:
            event = await runtime.frigate.get_event(
                event_id,
                timeout=_source_attempt_timeout(
                    deadline,
                    allow_expired_attempt=allow_immediate_attempt,
                ),
            )
            camera = event_camera(event)
            frame_time = event_frame_time(event)
            if camera is not None and frame_time is not None:
                return event, camera, frame_time
            raise VideoFramesUnavailable(
                f"Frigate-Ereignis {event_id} enthält keine vollständigen "
                "Kamera- und Zeitangaben."
            )
        except FrigateAuthenticationError:
            raise
        except FrigateEventError as err:
            if err.status in {401, 403}:
                raise
            last_error = err
            if not err.transient:
                break

        if deadline - monotonic() <= 0:
            break
        await _sleep_for_retry(attempt, deadline)
        attempt += 1

    detail = str(last_error) if last_error else "Ereignisdaten nicht verfügbar"
    raise VideoFramesUnavailable(
        f"Das Videozeitfenster für Frigate-Ereignis {event_id} konnte nicht "
        f"bestimmt werden: {detail}"
    )


async def _wait_for_video_frames(
    runtime: RuntimeData,
    *,
    event_id: str,
    camera: str,
    center_time: float,
    duration_seconds: int,
    pre_seconds: int,
    deadline: float,
    allow_immediate_attempt: bool,
) -> list[tuple[float, bytes]]:
    """Fetch exact 1-fps recording frames with bounded Frigate concurrency."""
    samples = [
        (float(index - pre_seconds), center_time + index - pre_seconds)
        for index in range(duration_seconds)
    ]
    frames: dict[float, bytes] = {}
    attempt = 0
    first_attempt = True
    last_error: FrigateEventError | None = None
    target_height = min(
        DEFAULT_VIDEO_TARGET_HEIGHT,
        max(
            1,
            int(
                getattr(
                    runtime.provider,
                    "video_target_height",
                    DEFAULT_VIDEO_TARGET_HEIGHT,
                )
            ),
        ),
    )

    async def fetch_frame(
        relative_time: float, timestamp: float
    ) -> tuple[float, bytes]:
        source = await runtime.frigate.get_recording_snapshot(
            event_id,
            camera,
            timestamp,
            timeout=_source_attempt_timeout(
                deadline,
                allow_expired_attempt=allow_immediate_attempt,
            ),
        )
        prepared = await runtime.hass.async_add_executor_job(
            _prepare_jpeg,
            source,
            0,
            target_height,
        )
        return relative_time, prepared

    async def fetch_missing(
        missing: list[tuple[float, float]],
    ) -> list[tuple[float, bytes] | FrigateEventError]:
        """Use three workers and stop queued requests on a fatal auth error."""
        queue: asyncio.Queue[tuple[float, float]] = asyncio.Queue()
        for sample in missing:
            queue.put_nowait(sample)
        results: list[tuple[float, bytes] | FrigateEventError] = []

        async def worker() -> None:
            while True:
                try:
                    relative_time, timestamp = queue.get_nowait()
                except asyncio.QueueEmpty:
                    return
                try:
                    results.append(await fetch_frame(relative_time, timestamp))
                except FrigateAuthenticationError:
                    raise
                except FrigateEventError as err:
                    if err.status in {401, 403}:
                        raise
                    results.append(err)

        tasks = [
            asyncio.create_task(worker()) for _index in range(min(3, len(missing)))
        ]
        try:
            await asyncio.gather(*tasks)
        except BaseException:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            raise
        return results

    while first_attempt or monotonic() < deadline:
        first_attempt = False
        missing = [sample for sample in samples if sample[0] not in frames]
        results = await fetch_missing(missing)
        permanent_error = False
        for result in results:
            if isinstance(result, FrigateEventError):
                last_error = result
                permanent_error = permanent_error or not result.transient
                continue
            relative_time, jpeg = result
            frames[relative_time] = jpeg

        if sum(_base64_size(len(frame)) for frame in frames.values()) > (
            MAX_VIDEO_PAYLOAD_BYTES
        ):
            raise SourceError(
                "Der Base64-Payload der Videosequenz überschreitet die "
                "erlaubte Gesamtgröße von 25 MB."
            )
        if len(frames) == len(samples):
            return [(relative, frames[relative]) for relative, _timestamp in samples]
        if permanent_error or deadline - monotonic() <= 0:
            break
        await _sleep_for_retry(attempt, deadline)
        attempt += 1

    detail = str(last_error) if last_error else "Recording-Frames fehlen"
    raise VideoFramesUnavailable(
        f"Nur {len(frames)} von {len(samples)} Recording-Frames für Ereignis "
        f"{event_id} waren rechtzeitig verfügbar: {detail}"
    )


async def _analyze_event_video_once(
    runtime: RuntimeData,
    *,
    event_id: str,
    camera_entity: str | None,
    prompt: str,
    duration_seconds: int,
    pre_seconds: int,
) -> dict[str, Any]:
    """Analyze a fixed recording window or transparently use one still image."""
    key_frame = runtime.frigate.key_frame_url(event_id, camera_entity)
    wait_timeout = _recording_wait_timeout(runtime)
    deadline = monotonic() + wait_timeout
    allow_immediate_attempt = wait_timeout <= 0
    center_time: float | None = None
    try:
        event, camera, center_time = await _wait_for_video_event(
            runtime,
            event_id=event_id,
            deadline=deadline,
            allow_immediate_attempt=allow_immediate_attempt,
        )
        frames = await _wait_for_video_frames(
            runtime,
            event_id=event_id,
            camera=camera,
            center_time=center_time,
            duration_seconds=duration_seconds,
            pre_seconds=pre_seconds,
            deadline=deadline,
            allow_immediate_attempt=allow_immediate_attempt,
        )
    except VideoFramesUnavailable:
        fallback = await _analyze_event_once(
            runtime,
            event_id=event_id,
            camera_entity=camera_entity,
            prompt=prompt,
            force=True,
        )
        fallback_time = fallback.get("source_frame_time")
        window_center = center_time if center_time is not None else fallback_time
        return {
            **fallback,
            "media_type": "image_fallback",
            "frame_count": 1,
            "window_start": (
                window_center - pre_seconds if window_center is not None else None
            ),
            "window_end": (
                window_center + duration_seconds - pre_seconds
                if window_center is not None
                else None
            ),
        }

    response_text = await runtime.provider.analyze_video_frames(frames, prompt)
    sub_label_result = await _refresh_event_sub_label(
        runtime,
        event_id=event_id,
        fallback_event=event,
    )
    return {
        "response_text": response_text,
        "event_id": event_id,
        "key_frame": key_frame,
        "stored": False,
        "cached": False,
        "media_type": "video_frames",
        "image_source": IMAGE_SOURCE_RECORDING,
        "source_frame_time": center_time,
        "image_has_overlay": False,
        "frame_count": len(frames),
        "window_start": center_time - pre_seconds,
        "window_end": center_time + duration_seconds - pre_seconds,
        **sub_label_result,
    }


def _create_entry_task(
    runtime: RuntimeData,
    coroutine: Any,
    name: str,
) -> asyncio.Task[Any]:
    """Create a task bound to the Frigate Vision config-entry lifecycle."""
    create_task = getattr(runtime.entry, "async_create_background_task", None)
    if callable(create_task):
        try:
            return create_task(runtime.hass, coroutine, name)
        except TypeError:
            pass

    # This fallback keeps dependency-light tests usable and supports older
    # custom ConfigEntry doubles. Supported HA releases use the entry API.
    create_task = getattr(runtime.hass, "async_create_task", None)
    if callable(create_task):
        try:
            return create_task(coroutine, name)
        except TypeError:
            return create_task(coroutine)
    return asyncio.create_task(
        coroutine,
        name=name,
    )


def _finish_flight(
    flights: dict[_FlightKey, asyncio.Task[Any]],
    key: _FlightKey,
    task: asyncio.Task[Any],
) -> None:
    """Remove one completed task and consume an otherwise orphaned error."""
    if flights.get(key) is task:
        flights.pop(key, None)
    try:
        task.exception()
    except asyncio.CancelledError:
        pass


async def _store_description_once(
    runtime: RuntimeData,
    event_id: str,
    description: str,
) -> None:
    """Join an identical write without conflating forced analysis results."""
    write_key = (event_id, description)
    task = runtime.event_write_flights.get(write_key)
    if task is None:
        task = _create_entry_task(
            runtime,
            runtime.frigate.set_description(event_id, description),
            f"Frigate Vision store event {event_id}",
        )
        runtime.event_write_flights[write_key] = task
        task.add_done_callback(
            lambda completed: _finish_flight(
                runtime.event_write_flights,
                write_key,
                completed,
            )
        )
    await asyncio.shield(task)


async def analyze_event(
    runtime: RuntimeData,
    *,
    event_id: str,
    camera_entity: str | None,
    prompt: str,
    store: bool,
    force: bool,
) -> dict[str, Any]:
    """Analyze one exact Frigate event with event-scoped single-flight."""
    started = monotonic()
    try:
        event_id = validate_event_id(event_id)
    except ValueError as err:
        raise FrigateEventError(
            "Die Frigate-Event-ID enthält ungültige Zeichen."
        ) from err

    if force:
        result = await _analyze_event_once(
            runtime,
            event_id=event_id,
            camera_entity=camera_entity,
            prompt=prompt,
            force=True,
        )
    else:
        task = runtime.event_flights.get(event_id)
        if task is None:
            task = _create_entry_task(
                runtime,
                _analyze_event_once(
                    runtime,
                    event_id=event_id,
                    camera_entity=camera_entity,
                    prompt=prompt,
                    force=False,
                ),
                f"Frigate Vision analyze event {event_id}",
            )
            runtime.event_flights[event_id] = task
            task.add_done_callback(
                lambda completed: _finish_flight(
                    runtime.event_flights,
                    event_id,
                    completed,
                )
            )
        result = await asyncio.shield(task)

    stored = False
    if store and not result["cached"]:
        await _store_description_once(
            runtime,
            event_id,
            result["response_text"],
        )
        stored = True

    return {
        **result,
        "stored": stored,
        "duration_ms": round((monotonic() - started) * 1000),
    }


async def analyze_event_video(
    runtime: RuntimeData,
    *,
    event_id: str,
    camera_entity: str | None,
    prompt: str,
    store: bool,
    duration_seconds: int,
    pre_seconds: int,
) -> dict[str, Any]:
    """Analyze one fixed Frigate recording window with single-flight sharing."""
    started = monotonic()
    try:
        event_id = validate_event_id(event_id)
    except ValueError as err:
        raise FrigateEventError(
            "Die Frigate-Event-ID enthält ungültige Zeichen."
        ) from err
    if not MIN_VIDEO_DURATION <= duration_seconds <= MAX_VIDEO_DURATION:
        raise FrigateEventError(
            "Die Videolänge muss zwischen 5 und 15 Sekunden liegen."
        )
    if not 0 <= pre_seconds <= duration_seconds:
        raise FrigateEventError(
            "Der Vorlauf muss zwischen 0 und der Videolänge liegen."
        )

    flight_key = (
        event_id,
        camera_entity,
        prompt,
        duration_seconds,
        pre_seconds,
    )
    task = runtime.event_video_flights.get(flight_key)
    if task is None:
        task = _create_entry_task(
            runtime,
            _analyze_event_video_once(
                runtime,
                event_id=event_id,
                camera_entity=camera_entity,
                prompt=prompt,
                duration_seconds=duration_seconds,
                pre_seconds=pre_seconds,
            ),
            f"Frigate Vision analyze event video {event_id}",
        )
        runtime.event_video_flights[flight_key] = task
        task.add_done_callback(
            lambda completed: _finish_flight(
                runtime.event_video_flights,
                flight_key,
                completed,
            )
        )
    result = await asyncio.shield(task)

    stored = False
    if store:
        await _store_description_once(runtime, event_id, result["response_text"])
        stored = True

    return {
        **result,
        "stored": stored,
        "duration_ms": round((monotonic() - started) * 1000),
    }


async def analyze_image(
    runtime: RuntimeData,
    *,
    image_entity: str | None,
    media_source_id: str | None,
    file_path: str | None,
    prompt: str,
) -> dict[str, Any]:
    """Analyze one explicitly allowed image source."""
    started = monotonic()
    if image_entity:
        image_bytes, key_frame = await load_entity_image(runtime.hass, image_entity)
    elif media_source_id:
        image_bytes, key_frame = await load_media_source(runtime.hass, media_source_id)
    elif file_path:
        image_bytes, key_frame = await load_local_file(runtime.hass, file_path)
    else:
        raise SourceError("Es wurde keine Bildquelle angegeben.")

    response_text = await runtime.provider.analyze(image_bytes, prompt)
    return {
        "response_text": response_text,
        "event_id": None,
        "key_frame": key_frame,
        "stored": False,
        "cached": False,
        "sub_label": None,
        "sub_label_score": None,
        "duration_ms": round((monotonic() - started) * 1000),
    }
