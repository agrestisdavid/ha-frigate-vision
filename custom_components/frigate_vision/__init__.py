"""Frigate Vision integration."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.exceptions import ConfigEntryNotReady, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er

from .analysis import (
    FrigateVisionError,
    RuntimeData,
    analyze_event,
    analyze_image,
    build_runtime,
    merged_config,
)
from .const import (
    ATTR_FRONTEND_REGISTERED,
    ATTR_RUNTIME_ENTRIES,
    ATTR_SERVICES_REGISTERED,
    ATTR_WS_REGISTERED,
    CONF_GO2RTC_MODES,
    CONF_GO2RTC_URL,
    CONF_GO2RTC_URL_EXTERNAL,
    DEFAULT_PROMPT,
    DOMAIN,
    SERVICE_ANALYZE_EVENT,
    SERVICE_ANALYZE_IMAGE,
)
from .frontend import async_register_frontend
from .utils import sanitize_go2rtc_modes, validate_go2rtc_url

_LOGGER = logging.getLogger(__name__)

EVENT_SCHEMA = vol.Schema(
    {
        vol.Required("event_id"): cv.string,
        vol.Optional("camera_entity"): cv.entity_id,
        vol.Optional("entry_id"): cv.string,
        vol.Optional("prompt", default=DEFAULT_PROMPT): cv.string,
        vol.Optional("store", default=False): cv.boolean,
        vol.Optional("force", default=False): cv.boolean,
    }
)


def _exactly_one_source(data: dict[str, Any]) -> dict[str, Any]:
    sources = ("image_entity", "media_source", "file_path")
    if sum(bool(data.get(key)) for key in sources) != 1:
        raise vol.Invalid(
            "Exactly one of image_entity, media_source or file_path is required"
        )
    return data


IMAGE_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Optional("image_entity"): cv.entity_id,
            vol.Optional("media_source"): vol.Any(
                cv.string,
                vol.Schema(
                    {
                        vol.Required("media_content_id"): cv.string,
                        vol.Optional("media_content_type"): cv.string,
                        vol.Optional("metadata"): object,
                    },
                    extra=vol.ALLOW_EXTRA,
                ),
            ),
            vol.Optional("file_path"): cv.string,
            vol.Optional("entry_id"): cv.string,
            vol.Optional("prompt", default=DEFAULT_PROMPT): cv.string,
        }
    ),
    _exactly_one_source,
)


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Initialize domain-level storage."""
    hass.data.setdefault(
        DOMAIN,
        {
            ATTR_RUNTIME_ENTRIES: {},
            ATTR_SERVICES_REGISTERED: False,
            ATTR_WS_REGISTERED: False,
            ATTR_FRONTEND_REGISTERED: False,
        },
    )
    await async_register_frontend(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up one Frigate Vision config entry."""
    domain_data = hass.data.setdefault(
        DOMAIN,
        {
            ATTR_RUNTIME_ENTRIES: {},
            ATTR_SERVICES_REGISTERED: False,
            ATTR_WS_REGISTERED: False,
            ATTR_FRONTEND_REGISTERED: False,
        },
    )
    try:
        runtime = await build_runtime(hass, entry)
    except FrigateVisionError as err:
        raise ConfigEntryNotReady(str(err)) from err

    domain_data[ATTR_RUNTIME_ENTRIES][entry.entry_id] = runtime
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    if not domain_data[ATTR_SERVICES_REGISTERED]:
        _register_services(hass)
        domain_data[ATTR_SERVICES_REGISTERED] = True
    if not domain_data[ATTR_WS_REGISTERED]:
        websocket_api.async_register_command(hass, ws_profile)
        domain_data[ATTR_WS_REGISTERED] = True
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload one config entry without affecting Frigate or LLM Vision."""
    domain_data = hass.data.get(DOMAIN, {})
    entries: dict[str, RuntimeData] = domain_data.get(ATTR_RUNTIME_ENTRIES, {})
    entries.pop(entry.entry_id, None)
    if not entries and domain_data.get(ATTR_SERVICES_REGISTERED):
        hass.services.async_remove(DOMAIN, SERVICE_ANALYZE_EVENT)
        hass.services.async_remove(DOMAIN, SERVICE_ANALYZE_IMAGE)
        domain_data[ATTR_SERVICES_REGISTERED] = False
    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


def _runtime_entries(hass: HomeAssistant) -> dict[str, RuntimeData]:
    return hass.data.get(DOMAIN, {}).get(ATTR_RUNTIME_ENTRIES, {})


def _entry_id_for_entity(hass: HomeAssistant, entity_id: str | None) -> str | None:
    if not entity_id:
        return None
    entity = er.async_get(hass).async_get(entity_id)
    return entity.config_entry_id if entity else None


def _resolve_runtime(
    hass: HomeAssistant,
    *,
    entry_id: str | None,
    entity_id: str | None,
) -> RuntimeData:
    entries = _runtime_entries(hass)
    if entry_id:
        runtime = entries.get(entry_id)
        if runtime:
            return runtime
        raise ServiceValidationError(
            "Die angegebene Frigate-Vision-Config-Entry wurde nicht gefunden."
        )

    source_entry_id = _entry_id_for_entity(hass, entity_id)
    if source_entry_id:
        for runtime in entries.values():
            if runtime.frigate_entry.entry_id == source_entry_id:
                return runtime

    if len(entries) == 1:
        return next(iter(entries.values()))
    if not entries:
        raise ServiceValidationError("Frigate Vision ist noch nicht konfiguriert.")
    raise ServiceValidationError(
        "Mehrere Frigate-Vision-Instanzen sind vorhanden. "
        "Bitte entry_id oder eine zuordenbare Kamera angeben."
    )


def _register_services(hass: HomeAssistant) -> None:
    def media_source_id(value: Any) -> str | None:
        if isinstance(value, str):
            return value
        if isinstance(value, Mapping):
            media_id = value.get("media_content_id")
            return str(media_id) if media_id else None
        return None

    async def handle_analyze_event(call: ServiceCall) -> dict[str, Any]:
        runtime = _resolve_runtime(
            hass,
            entry_id=call.data.get("entry_id"),
            entity_id=call.data.get("camera_entity"),
        )
        try:
            return await analyze_event(
                runtime,
                event_id=call.data["event_id"].strip(),
                camera_entity=call.data.get("camera_entity"),
                prompt=call.data["prompt"].strip() or DEFAULT_PROMPT,
                store=call.data["store"],
                force=call.data["force"],
            )
        except FrigateVisionError as err:
            raise ServiceValidationError(str(err)) from err

    async def handle_analyze_image(call: ServiceCall) -> dict[str, Any]:
        runtime = _resolve_runtime(
            hass,
            entry_id=call.data.get("entry_id"),
            entity_id=call.data.get("image_entity"),
        )
        try:
            return await analyze_image(
                runtime,
                image_entity=call.data.get("image_entity"),
                media_source_id=media_source_id(call.data.get("media_source")),
                file_path=call.data.get("file_path"),
                prompt=call.data["prompt"].strip() or DEFAULT_PROMPT,
            )
        except FrigateVisionError as err:
            raise ServiceValidationError(str(err)) from err

    hass.services.async_register(
        DOMAIN,
        SERVICE_ANALYZE_EVENT,
        handle_analyze_event,
        schema=EVENT_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_ANALYZE_IMAGE,
        handle_analyze_image,
        schema=IMAGE_SCHEMA,
        supports_response=SupportsResponse.ONLY,
    )


def _profile_for_runtime(runtime: RuntimeData) -> dict[str, Any]:
    config = merged_config(runtime.entry)
    internal = str(config.get(CONF_GO2RTC_URL, "")).strip()
    if not internal:
        frigate_url = str(runtime.frigate_entry.data.get("url", "")).rstrip("/")
        internal = f"{frigate_url}/api/go2rtc" if frigate_url else ""
    external = str(config.get(CONF_GO2RTC_URL_EXTERNAL, "")).strip()
    try:
        internal = validate_go2rtc_url(internal) if internal else ""
    except ValueError:
        internal = ""
    try:
        external = validate_go2rtc_url(external) if external else ""
    except ValueError:
        external = ""
    return {
        "go2rtc_url": internal or None,
        "go2rtc_url_external": external or None,
        "go2rtc_modes": sanitize_go2rtc_modes(str(config.get(CONF_GO2RTC_MODES, ""))),
    }


@websocket_api.websocket_command(
    {
        vol.Required("type"): "frigate_vision/profile",
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.async_response
async def ws_profile(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return only non-secret central Card profile values."""
    try:
        runtime = _resolve_runtime(hass, entry_id=msg.get("entry_id"), entity_id=None)
    except ServiceValidationError as err:
        connection.send_error(msg["id"], "not_found", str(err))
        return
    connection.send_result(msg["id"], {"profile": _profile_for_runtime(runtime)})
