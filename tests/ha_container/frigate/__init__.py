"""Synthetic cached Frigate config and client for the isolated HA smoke test."""


async def async_setup_entry(hass, entry):
    hass.data.setdefault("frigate", {})[entry.entry_id] = {
        "client": object(),  # This fixture serves an unauthenticated local endpoint.
        "config": {
            "mqtt": {"client_id": "smoke"},
            "cameras": {
                "synthetic_camera": {
                    "live": {"streams": {"HD": "fixture_a", "SD": "fixture_b"}}
                }
            },
            "go2rtc": {
                "streams": {
                    alias: ["rtsp://unused.invalid/example"]
                    for alias in ("fixture_a", "fixture_b", "unrelated")
                }
            },
        },
    }
    return True
