"""Prepare doorbell replies with HA TTS and keep a private, per-entry cache."""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import wave
from typing import Any
from uuid import uuid4

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv

from .camera_streams import readable_camera
from .const import ATTR_RUNTIME_ENTRIES, DOMAIN

TTS_ENTITY = "doorbell_tts_entity"
REPLY_FIELDS = tuple(f"doorbell_reply_{n}" for n in range(1, 4))
MAX_TEXT_LENGTH = 120
_RATE = 16000
_CHANNELS = 1
_SAMPLE_BYTES = 2
_FRAME_BYTES = _CHANNELS * _SAMPLE_BYTES
_MAX_SOURCE_FRAMES = 20 * _RATE
_TAIL_FRAMES = _RATE // 4  # 250 ms of silence to drain RTP
# HA's source WAV may contain extra chunks (e.g. FFmpeg's LIST metadata).
# Keep the existing fixed allowance for its header and metadata.
_MAX_SOURCE_WAV_BYTES = _MAX_SOURCE_FRAMES * _FRAME_BYTES + 4096
# wave.writeframes emits a 44-byte PCM WAV header. PCM16 mono data is always
# even-sized, so there is no extra RIFF padding byte. Match the Card's limit.
_MAX_WAV_BYTES = 44 + (_MAX_SOURCE_FRAMES + _TAIL_FRAMES) * _FRAME_BYTES
_MAX_ENCODED_LENGTH = 4 * ((_MAX_WAV_BYTES + 2) // 3)
_CACHE = f"{DOMAIN}_doorbell_reply_caches"
_LOGGER = logging.getLogger(__name__)


class ReplyError(Exception):
    """A translated options-flow error, without provider details or user text."""

    def __init__(self, field: str, code: str) -> None:
        super().__init__(code)
        self.field = field
        self.code = code


def _normalize_audio(extension: str, data: bytes) -> str:
    """Bound the clip and validate its PCM before replacing a working reply."""
    if extension != "wav" or not 0 < len(data) <= _MAX_SOURCE_WAV_BYTES:
        raise ValueError("Invalid TTS audio")
    with wave.open(io.BytesIO(data)) as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (
            _CHANNELS,
            _SAMPLE_BYTES,
            _RATE,
        ):
            raise ValueError("Unexpected TTS PCM format")
        frames = wav.readframes(_MAX_SOURCE_FRAMES + 1)
        if (
            not frames
            or len(frames) % _FRAME_BYTES
            or len(frames) > _MAX_SOURCE_FRAMES * _FRAME_BYTES
        ):
            raise ValueError("Invalid TTS PCM length")
        # Streaming encoders can leave an open-ended RIFF/data size. Rebuild a
        # seekable WAV with the actual size and a short tail for RTP to drain.
        if wav.getnframes() < 0x7FFF0000 and wav.getnframes() * _FRAME_BYTES != len(
            frames
        ):
            raise ValueError("Truncated TTS audio")
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setparams((_CHANNELS, _SAMPLE_BYTES, _RATE, 0, "NONE", "not compressed"))
        wav.writeframes(frames + bytes(_TAIL_FRAMES * _FRAME_BYTES))
    return base64.b64encode(out.getvalue()).decode("ascii")


def _valid_audio_size(audio: Any) -> bool:
    if (
        not isinstance(audio, str)
        or not 0 < len(audio) <= _MAX_ENCODED_LENGTH
        or len(audio) % 4
    ):
        return False
    # The last base64 quartet can represent 1, 2 or 3 bytes. Check the actual
    # byte limit without allocating a decoded copy of each cached clip.
    padding = 2 if audio.endswith("==") else int(audio.endswith("="))
    return len(audio) // 4 * 3 - padding <= _MAX_WAV_BYTES


def _valid_cache(data: Any) -> bool:
    if not isinstance(data, dict) or not isinstance(data.get("replies"), list):
        return False
    clips = data["replies"]
    engine = data.get("engine")
    if not clips:
        return engine is None
    return (
        isinstance(engine, str)
        and engine.startswith("tts.")
        and len(clips) <= len(REPLY_FIELDS)
        and all(
            isinstance(clip, dict)
            and clip.get("field") in REPLY_FIELDS
            and isinstance(clip.get("id"), str)
            and len(clip["id"]) == 32
            and isinstance(clip.get("text"), str)
            and 0 < len(clip["text"]) <= MAX_TEXT_LENGTH
            and _valid_audio_size(clip.get("audio"))
            for clip in clips
        )
    )


class ReplyCache:
    """Persist settings and audio together, publishing only a complete generation."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        from homeassistant.helpers.storage import Store

        self.hass = hass
        self._entry_id = entry_id
        self._store = Store[dict[str, Any]](
            hass,
            1,
            f"{DOMAIN}.doorbell_replies.{entry_id}",
            private=True,
            atomic_writes=True,
        )
        self._lock = asyncio.Lock()
        self._loaded = False
        self._removed = False
        self._data: dict[str, Any] = {"engine": None, "replies": []}

    @property
    def clips(self) -> list[dict[str, str]]:
        return self._data["replies"]

    def form_values(self) -> dict[str, str]:
        if not self.clips:
            return {}
        return {
            TTS_ENTITY: self._data["engine"],
            **{clip["field"]: clip["text"] for clip in self.clips},
        }

    async def _load(self) -> None:
        if self._loaded:
            return
        try:
            stored = await self._store.async_load()
            if stored is not None:
                if not _valid_cache(stored):
                    raise ValueError("Invalid reply cache")
                self._data = stored
        except Exception:  # noqa: BLE001 - malformed or unreadable storage must not block setup
            _LOGGER.warning(
                "Could not read stored doorbell replies; using bundled replies"
            )
        self._loaded = True

    async def async_load(self) -> None:
        if not self._loaded:
            async with self._lock:
                await self._load()

    async def async_save(self, values: dict[str, Any]) -> None:
        """Validate, synthesize uncached replies, then commit in one private write."""
        from homeassistant.components import tts

        texts = {key: values.get(key, "").strip() for key in REPLY_FIELDS}
        for key, text in texts.items():
            if len(text) > MAX_TEXT_LENGTH:
                raise ReplyError(key, "reply_too_long")
        texts = {key: text for key, text in texts.items() if text}
        engine = values.get(TTS_ENTITY) if texts else None
        async with self._lock:
            if (
                self._removed
                or self.hass.is_stopping
                or not self.hass.config_entries.async_get_entry(self._entry_id)
            ):
                raise ReplyError("base", "reply_storage_failed")
            await self._load()
            if engine == self._data["engine"] and texts == {
                clip["field"]: clip["text"] for clip in self.clips
            }:
                return
            reusable = (
                {clip["text"]: clip["audio"] for clip in self.clips}
                if engine == self._data["engine"]
                else {}
            )
            clips = []
            for key, text in texts.items():
                if text not in reusable:
                    state = (
                        self.hass.states.get(engine)
                        if isinstance(engine, str)
                        else None
                    )
                    if (
                        state is None
                        or not engine.startswith("tts.")
                        or state.state == "unavailable"
                        or not tts.async_resolve_engine(self.hass, engine)
                    ):
                        raise ReplyError(TTS_ENTITY, "reply_tts_required")
                    try:
                        media_id = tts.generate_media_source_id(
                            self.hass,
                            text,
                            engine=engine,
                            cache=False,
                            options={
                                "preferred_format": "wav",
                                "preferred_sample_rate": _RATE,
                                "preferred_sample_channels": _CHANNELS,
                                "preferred_sample_bytes": _SAMPLE_BYTES,
                            },
                        )
                        async with asyncio.timeout(25):
                            extension, audio = await tts.async_get_media_source_audio(
                                self.hass, media_id
                            )
                        reusable[text] = _normalize_audio(extension, audio)
                    except Exception as err:
                        # Provider errors may contain the message or credentials.
                        raise ReplyError(key, "reply_synthesis_failed") from err
                clips.append(
                    {
                        "field": key,
                        "id": uuid4().hex,
                        "text": text,
                        "audio": reusable[text],
                    }
                )
            data = {"engine": engine, "replies": clips}
            try:
                if self.hass.is_stopping:
                    raise RuntimeError("Home Assistant is stopping")
                await self._store.async_save(data)
                # HA Store can log/suppress filesystem write errors. Don't report
                # success or replace working in-memory clips unless persisted.
                if await self._store.async_load() != data:
                    raise RuntimeError("Reply cache write did not persist")
            except Exception as err:
                raise ReplyError("base", "reply_storage_failed") from err
            self._data = data

    async def async_remove(self) -> None:
        async with self._lock:
            self._removed = True
            self._data = {"engine": None, "replies": []}
            await self._store.async_remove()


def reply_cache(hass: HomeAssistant, entry_id: str) -> ReplyCache:
    caches = hass.data.setdefault(_CACHE, {})
    if entry_id not in caches:
        caches[entry_id] = ReplyCache(hass, entry_id)
    return caches[entry_id]


async def async_remove_reply_cache(hass: HomeAssistant, entry_id: str) -> None:
    cache = reply_cache(hass, entry_id)
    await cache.async_remove()
    hass.data[_CACHE].pop(entry_id, None)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/doorbell_replies",
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("instance_id"): str,
        vol.Optional("reply_id"): vol.Match(r"^[0-9a-f]{32}$"),
    }
)
@callback
def ws_doorbell_replies(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Serve labels or one clip over authenticated WS to a readable camera's user."""
    camera = readable_camera(hass, connection, msg["entity_id"], msg["instance_id"])
    if camera is not None:
        frigate_id, _, _ = camera
        domain_data = hass.data.get(DOMAIN, {})
        entry_id = next(
            (
                entry_id
                for entry_id, runtime in domain_data.get(
                    ATTR_RUNTIME_ENTRIES, {}
                ).items()
                if runtime.frigate_entry.entry_id == frigate_id
            ),
            None,
        )
        cache = hass.data.get(_CACHE, {}).get(entry_id)
        clips = cache.clips if cache is not None else []
        if "reply_id" not in msg:
            connection.send_result(
                msg["id"],
                {
                    "replies": [
                        {"id": clip["id"], "text": clip["text"]} for clip in clips
                    ]
                    or None
                },
            )
            return
        for clip in clips:
            if clip["id"] == msg["reply_id"]:
                connection.send_result(msg["id"], {"audio": clip["audio"]})
                return
    connection.send_error(
        msg["id"], "not_found", "No doorbell reply available for this camera."
    )
