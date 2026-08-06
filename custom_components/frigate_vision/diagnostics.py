"""Diagnostics support for Frigate Vision."""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CONF_API_KEY,
    CONF_ENDPOINT,
    CONF_FRIGATE_ENTRY_ID,
    CONF_GO2RTC_URL,
    CONF_GO2RTC_URL_EXTERNAL,
    DOMAIN,
)

TO_REDACT = {
    CONF_API_KEY,
    CONF_ENDPOINT,
    CONF_GO2RTC_URL,
    CONF_GO2RTC_URL_EXTERNAL,
}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return useful settings without credentials."""
    return {
        "domain": DOMAIN,
        "entry_id": entry.entry_id,
        "frigate_entry_id": entry.data.get(CONF_FRIGATE_ENTRY_ID),
        "data": async_redact_data(dict(entry.data), TO_REDACT),
        "options": async_redact_data(dict(entry.options), TO_REDACT),
        "runtime_loaded": entry.entry_id
        in hass.data.get(DOMAIN, {}).get("entries", {}),
    }
