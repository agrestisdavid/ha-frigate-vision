"""Serve and register the bundled Frigate Vision Card."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from ..const import (
    ATTR_FRONTEND_REGISTERED,
    DOMAIN,
    FRONTEND_MODULE,
    FRONTEND_URL_BASE,
    VERSION,
)


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Register the versioned card module exactly once per HA process."""
    domain_data = hass.data[DOMAIN]
    if domain_data.get(ATTR_FRONTEND_REGISTERED):
        return

    frontend_dir = Path(__file__).parent
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                FRONTEND_URL_BASE,
                str(frontend_dir),
                cache_headers=True,
            )
        ]
    )

    module_url = f"{FRONTEND_URL_BASE}/{FRONTEND_MODULE}?v={VERSION}"
    add_extra_js_url(hass, module_url)
    domain_data[ATTR_FRONTEND_REGISTERED] = True
