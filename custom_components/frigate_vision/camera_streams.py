"""Read-only, per-camera stream suggestions for the Card editor."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er

from .const import ATTR_FRIGATE_CONFIG, DOMAIN, FRIGATE_DOMAIN

# Return aliases only. Never return source URLs, credentials, arbitrary display
# labels, or the values of the global go2rtc.streams dictionary to the frontend.
_ALIAS = re.compile(r"[\w-][\w. -]{0,127}")
_ROLE = {
    "main": "main",
    "mainstream": "main",
    "hd": "main",
    "hauptstream": "main",
    "sub": "sub",
    "substream": "sub",
    "sd": "sub",
    "nebenstream": "sub",
}


def _mapping(value: Any) -> Mapping:
    return value if isinstance(value, Mapping) else {}


def camera_stream_options(config: Mapping, camera: str) -> dict[str, Any]:
    """Keep only stream keys explicitly associated with this exact camera."""
    camera_config = _mapping(config.get("cameras")).get(camera)
    declared = _mapping(_mapping(_mapping(camera_config).get("live")).get("streams"))
    aliases = _mapping(_mapping(config.get("go2rtc")).get("streams"))
    # Frigate also supports the exact camera ID as its default live stream.
    candidates = declared or (
        {"": camera} if isinstance(camera_config, Mapping) else {}
    )
    hints: dict[str, set[str]] = {}
    for label, alias in candidates.items():
        if (
            not isinstance(alias, str)
            or not _ALIAS.fullmatch(alias)
            or alias not in aliases
        ):
            continue
        roles = hints.setdefault(alias, set())
        if isinstance(label, str):
            label_role = _ROLE.get(re.sub(r"[ _-]+", "", label.strip().casefold()))
            if label_role:
                roles.add(label_role)
        # Do not infer quality from camera names, list order, resolutions or
        # numbered aliases. A clearly named suffix on a distinct alias is useful.
        if alias != camera:
            alias_role = _ROLE.get(re.split(r"[._ -]+", alias.casefold())[-1])
            if alias_role:
                roles.add(alias_role)

    result: dict[str, Any] = {"streams": list(hints), "main": None, "sub": None}
    for role in ("main", "sub"):
        matching = [name for name, roles in hints.items() if role in roles]
        if len(matching) == 1 and hints[matching[0]] == {role}:
            result[role] = matching[0]
    return result


def _options_for_entity(
    hass: HomeAssistant, entity_id: str, instance_id: str
) -> dict[str, Any] | None:
    entity = er.async_get(hass).async_get(entity_id)
    if (
        not entity
        or entity.platform != FRIGATE_DOMAIN
        or not entity.config_entry_id
        or entity.disabled_by
    ):
        return None
    entry_id = entity.config_entry_id
    prefix = f"{entry_id}:camera:"
    # The Frigate-owned registry ID survives an HA rename. Do not accept a
    # caller-supplied camera name, consult a different entry, or trust state overrides.
    if not entity.unique_id.startswith(prefix):
        return None
    camera = entity.unique_id[len(prefix) :]
    runtime = _mapping(hass.data.get(FRIGATE_DOMAIN)).get(entry_id)
    config = _mapping(_mapping(runtime).get(ATTR_FRIGATE_CONFIG))
    if _mapping(config.get("mqtt")).get(
        "client_id"
    ) != instance_id or camera not in _mapping(config.get("cameras")):
        return None
    return camera_stream_options(config, camera)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/camera_streams",
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("instance_id"): str,
    }
)
@callback
def ws_camera_streams(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Resolve one readable Frigate entity, including when HA has renamed it."""
    entity_id = msg["entity_id"]
    if entity_id.startswith("camera.") and connection.user.permissions.check_entity(
        entity_id, POLICY_READ
    ):
        options = _options_for_entity(hass, entity_id, msg["instance_id"])
        if options is not None:
            connection.send_result(msg["id"], options)
            return
    # Identical response for absent, unreadable and foreign entities.
    connection.send_error(
        msg["id"], "not_found", "Keine Streamnamen für diese Kamera verfügbar."
    )
