"""Exercise the real HA loader, HTTP frontend and service registry inside Docker."""

import asyncio
import base64
import json
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from aiohttp import ClientSession, web
from aiohttp.test_utils import TestServer
from homeassistant.bootstrap import async_setup_hass
from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EVENT_SERVICE_REGISTERED
from homeassistant.core import callback
from homeassistant.runner import RuntimeConfig, create_event_loop
from PIL import Image
from zeroconf import IPVersion

CONFIG = Path("/config")
FIXTURES = Path("/smoke")
COMPONENT = CONFIG / "custom_components" / "frigate_vision"
DOMAIN = "frigate_vision"
SERVICES = {"analyze_event", "analyze_event_video", "analyze_image"}
EVENT = "synthetic-event"
PROMPT = "Describe the synthetic frame."
ANSWER = "A synthetic blue frame."
MODEL = "synthetic-vision"
SIZE = (24, 12)


def fixture_server() -> TestServer:
    """Serve only this event, its clean snapshot and one Chat Completions route."""
    image = BytesIO()
    Image.new("RGB", SIZE, "blue").save(image, format="WEBP", lossless=True)

    async def event(_request):
        return web.json_response(
            {"id": EVENT, "camera": "synthetic_camera", "label": "test"}
        )

    async def snapshot(_request):
        return web.Response(body=image.getvalue(), content_type="image/webp")

    async def provider(request):
        body = await request.json()
        assert body["model"] == MODEL, body["model"]
        content = body["messages"][0]["content"]
        assert {"type": "text", "text": PROMPT} in content, "Missing service prompt"
        [url] = [
            part["image_url"]["url"] for part in content if part["type"] == "image_url"
        ]
        header, data = url.split(",", 1)
        assert header == "data:image/jpeg;base64", header
        with Image.open(BytesIO(base64.b64decode(data, validate=True))) as jpeg:
            assert (jpeg.format, jpeg.size) == ("JPEG", SIZE)
            red, green, blue = jpeg.getpixel((0, 0))
            assert blue > 240 and max(red, green) < 15, (
                "Not the synthetic blue snapshot"
            )
        return web.json_response({"choices": [{"message": {"content": ANSWER}}]})

    app = web.Application()
    app.router.add_get(f"/api/events/{EVENT}", event)
    app.router.add_get(f"/api/events/{EVENT}/snapshot-clean.webp", snapshot)
    app.router.add_post("/v1/chat/completions", provider)
    return TestServer(app, host="127.0.0.1")


async def configure(hass, base_url):
    """Go through HA's config-entry manager and the integration's actual user flow."""
    flows = hass.config_entries.flow
    source = {"source": "user"}
    frigate = await flows.async_init(
        "frigate", context=source.copy(), data={"url": base_url}
    )
    assert frigate["type"] == "create_entry", frigate
    assert frigate["result"].state is ConfigEntryState.LOADED, frigate["result"].state
    user = await flows.async_init(DOMAIN, context=source.copy())
    assert user.get("step_id") == "user", user
    provider = await flows.async_configure(
        user["flow_id"], {"frigate_entry_id": frigate["result"].entry_id}
    )
    assert provider.get("step_id") == "provider", provider
    result = await flows.async_configure(
        provider["flow_id"],
        {
            "endpoint": f"{base_url}/v1",
            "model": MODEL,
            "event_image_source": "event_snapshot",
        },
    )
    assert result["type"] == "create_entry", result
    return result["result"]


async def check_loaded(hass, entry, session, module_url, card_bytes):
    assert entry.state is ConfigEntryState.LOADED, entry.state
    assert set(hass.services.async_services().get(DOMAIN, {})) == SERVICES
    modules = [
        url
        for url in hass.data[DATA_EXTRA_MODULE_URL].urls
        if url.startswith("/frigate_vision/")
    ]
    assert modules == [module_url], modules
    async with session.get(
        f"http://127.0.0.1:8123{module_url}", allow_redirects=False
    ) as response:
        assert response.status == 200, response.status
        assert await response.read() == card_bytes, "HA did not serve the bundled Card"
    result = await hass.services.async_call(
        DOMAIN,
        "analyze_event",
        {"event_id": EVENT, "prompt": PROMPT},
        blocking=True,
        return_response=True,
    )
    expected = {
        "event_id": EVENT,
        "response_text": ANSWER,
        "cached": False,
        "stored": False,
        "image_source": "event_snapshot",
        "image_has_overlay": False,
        "key_frame": f"/api/frigate/smoke/notifications/{EVENT}/snapshot.jpg",
    }
    assert {key: result[key] for key in expected} == expected, result
    print(
        "OK: three services, one registered Card URL with matching HTTP bytes, synthetic analyze_event response"
    )


async def scenario(module_url, card_bytes):
    hass = await async_setup_hass(
        RuntimeConfig(str(CONFIG), skip_pip=True, log_no_color=True)
    )
    assert hass is not None, "HA bootstrap failed"
    try:
        assert not hass.config.recovery_mode, "HA booted in recovery mode"
        await hass.async_start()
        # HA's registry is keyed by name: inspecting it alone cannot detect a
        # second registration that silently replaced the first handler.
        registrations = []

        @callback
        def track_registration(event):
            if event.data["domain"] == DOMAIN:
                registrations.append(event.data["service"])

        hass.bus.async_listen(EVENT_SERVICE_REGISTERED, track_registration)
        async with fixture_server() as server, ClientSession() as session:
            entry = await configure(hass, str(server.make_url("/")).rstrip("/"))
            assert hass.config_entries.async_entries(DOMAIN) == [entry]
            await check_loaded(hass, entry, session, module_url, card_bytes)
            unloaded = await hass.config_entries.async_unload(entry.entry_id)
            assert unloaded, "HA refused to unload the entry"
            assert entry.state is ConfigEntryState.NOT_LOADED, entry.state
            assert not hass.services.async_services().get(DOMAIN), (
                "Services survived last-entry unload"
            )
            print("OK: last config entry unloaded, no Frigate Vision services remain")
            loaded = await hass.config_entries.async_setup(entry.entry_id)
            assert loaded, "HA refused to set up the entry again"
            await check_loaded(hass, entry, session, module_url, card_bytes)
            await hass.async_block_till_done()
            assert sorted(registrations) == sorted([*SERVICES, *SERVICES]), (
                registrations
            )
            print("OK: each service registered exactly once per load")
    finally:
        await hass.async_stop()


if __name__ == "__main__":
    # Never initialize a developer's local configuration when run by mistake.
    if Path(__file__).resolve().parent != FIXTURES:
        raise SystemExit("Run python scripts/test_ha_container.py instead.")
    # /config is a new tmpfs and both mounts are read-only. No host config or tokens.
    (CONFIG / "configuration.yaml").symlink_to(FIXTURES / "configuration.yaml")
    (CONFIG / "custom_components" / "frigate").symlink_to(FIXTURES / "frigate")
    version = json.loads((COMPONENT / "manifest.json").read_bytes())["version"]
    module = "frigate-vision-card.js"
    # --network=none has no default multicast route. Select loopback for HA's
    # real mDNS resolver; keep its HTTP sessions, config flows and services real.
    with patch(
        "homeassistant.components.zeroconf._async_get_zc_args",
        return_value={"interfaces": ["127.0.0.1"], "ip_version": IPVersion.V4Only},
    ):
        asyncio.run(
            scenario(
                f"/frigate_vision/frontend/{module}?v={version}",
                (COMPONENT / "frontend" / module).read_bytes(),
            ),
            loop_factory=create_event_loop,
        )
