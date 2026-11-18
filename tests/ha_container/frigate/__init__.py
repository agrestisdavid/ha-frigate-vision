"""Only the Frigate entry/client surface needed for a read-only event analysis."""


async def async_setup_entry(hass, entry):
    hass.data.setdefault("frigate", {})[entry.entry_id] = {
        "client": object(),  # This fixture serves an unauthenticated local endpoint.
        "config": {"mqtt": {"client_id": "smoke"}},
    }
    return True
