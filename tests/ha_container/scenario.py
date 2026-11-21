"""Exercise the real HA loader, HTTP frontend and service registry inside Docker."""

import asyncio
import base64
import json
import sys
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from aiohttp import ClientSession, web
from aiohttp.test_utils import TestServer
from homeassistant.auth.const import GROUP_ID_READ_ONLY
from homeassistant.bootstrap import async_setup_hass
from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EVENT_SERVICE_REGISTERED
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store
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


async def configure(hass, base_url, *, go2rtc_url=None):
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
            **({"go2rtc_url": go2rtc_url} if go2rtc_url else {}),
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


def register_fixture_camera(hass):
    [frigate] = hass.config_entries.async_entries("frigate")
    return er.async_get(hass).async_get_or_create(
        "camera",
        "frigate",
        f"{frigate.entry_id}:camera:synthetic_camera",
        config_entry=frigate,
        suggested_object_id="different_ha_name",
    )


async def check_camera_streams(hass, session):
    """Exercise the registered WS command and real HA read permissions over loopback."""
    camera = register_fixture_camera(hass)
    for groups in ([GROUP_ID_READ_ONLY], []):
        user = await hass.auth.async_create_system_user(
            "Synthetic viewer", group_ids=groups
        )
        refresh = await hass.auth.async_create_refresh_token(user)
        async with session.ws_connect("http://127.0.0.1:8123/api/websocket") as ws:
            assert (await ws.receive_json())["type"] == "auth_required"
            await ws.send_json(
                {
                    "type": "auth",
                    "access_token": hass.auth.async_create_access_token(refresh),
                }
            )
            assert (await ws.receive_json())["type"] == "auth_ok"
            await ws.send_json(
                {
                    "id": 1,
                    "type": "frigate_vision/camera_streams",
                    "entity_id": camera.entity_id,
                    "instance_id": "smoke",
                }
            )
            reply = await ws.receive_json()
            if groups:
                assert reply.get("success") and reply["result"] == {
                    "streams": ["fixture_a", "fixture_b"],
                    "main": "fixture_a",
                    "sub": "fixture_b",
                }, reply
            else:
                assert (
                    reply.get("success") is False
                    and reply["error"]["code"] == "not_found"
                ), reply
    print(
        "OK: camera alias suggestions via authenticated HA WebSocket; user without read permission receives none"
    )


async def setup_tts(hass):
    result = await hass.config_entries.flow.async_init(
        "synthetic_tts", context={"source": "user"}
    )
    assert result["result"].state is ConfigEntryState.LOADED
    assert hass.states.get("tts.synthetic_660") is not None


async def check_replies(hass, entry, session):
    """Verify the actual OptionsFlow, provider API, cache lifecycle and access."""
    from custom_components.frigate_vision.doorbell_replies import ReplyCache

    camera = register_fixture_camera(hass)
    fields = {
        "doorbell_reply_1": " Private reply ",
        "doorbell_reply_2": "  ",
        "doorbell_reply_3": "Other reply",
    }
    engine = {"doorbell_tts_entity": "tts.synthetic_660"}
    flows = hass.config_entries.options
    calls = hass.data["synthetic_tts_calls"]
    user = await hass.auth.async_create_system_user(
        "Reply viewer", group_ids=[GROUP_ID_READ_ONLY]
    )
    refresh = await hass.auth.async_create_refresh_token(user)

    async def submit(values):
        form = await flows.async_init(entry.entry_id)
        assert form["type"] == "form", form
        selector = next(
            v
            for k, v in form["data_schema"].schema.items()
            if k.schema == "doorbell_tts_entity"
        )
        assert selector.serialize()["selector"]["entity"]["domain"] in ("tts", ["tts"])
        result = await flows.async_configure(form["flow_id"], values)
        await hass.async_block_till_done()
        return result

    async with session.ws_connect("http://127.0.0.1:8123/api/websocket") as ws:
        assert (await ws.receive_json())["type"] == "auth_required"
        await ws.send_json(
            {
                "type": "auth",
                "access_token": hass.auth.async_create_access_token(refresh),
            }
        )
        assert (await ws.receive_json())["type"] == "auth_ok"
        counter = 0

        async def request(**overrides):
            nonlocal counter
            counter += 1
            await ws.send_json(
                {
                    "id": counter,
                    "type": f"{DOMAIN}/doorbell_replies",
                    "entity_id": camera.entity_id,
                    "instance_id": "smoke",
                    **overrides,
                }
            )
            return await ws.receive_json()

        assert (await request())["result"] == {"replies": None}
        assert (await submit(fields))["errors"] == {
            "doorbell_tts_entity": "reply_tts_required"
        }
        assert (await submit({**engine, "doorbell_reply_1": "x" * 121}))["errors"] == {
            "doorbell_reply_1": "reply_too_long"
        }
        assert (await submit({**engine, **fields}))["type"] == "create_entry"
        assert calls == [
            ("tts.synthetic_660", "Private reply"),
            ("tts.synthetic_660", "Other reply"),
        ]
        choices = (await request())["result"]["replies"]
        assert [clip["text"] for clip in choices] == ["Private reply", "Other reply"]
        old_id = choices[0]["id"]
        assert (await request(instance_id="wrong"))["error"]["code"] == "not_found"
        audio = (await request(reply_id=old_id))["result"]["audio"]
        assert base64.b64decode(audio).startswith(b"RIFF")
        assert (await request(reply_id=old_id))["result"] == {"audio": audio}
        assert (await submit({**engine, **fields}))["type"] == "create_entry"
        assert (await request())["result"]["replies"] == choices
        assert len(calls) == 2, calls
        fresh = ReplyCache(hass, entry.entry_id)
        await fresh.async_load()
        assert (
            fresh.clips[0]["audio"] == audio
        )  # Reload from persisted cache, no TTS call.
        assert len(calls) == 2
        saved_options = dict(entry.options)
        fail = await submit(
            {
                **engine,
                **fields,
                "doorbell_reply_2": "fixture failure",
                "model": "unsaved model",
            }
        )
        assert fail["errors"] == {"doorbell_reply_2": "reply_synthesis_failed"}, fail[
            "errors"
        ]
        assert (
            entry.options == saved_options
            and (await request())["result"]["replies"] == choices
        )
        # Some HA versions log and swallow a storage write failure. Simulate a
        # dropped write just for the reply Store; the old generation must stay.
        original_save = Store.async_save

        async def dropped_write(store, data):
            if not store.key.startswith(f"{DOMAIN}.doorbell_replies."):
                await original_save(store, data)

        with patch.object(Store, "async_save", dropped_write):
            failed = await submit({**engine, "model": "not saved to options"})
        assert failed["errors"] == {"base": "reply_storage_failed"}
        assert entry.options == saved_options
        assert (await request())["result"]["replies"] == choices
        assert (await submit({**fields, "doorbell_tts_entity": "tts.synthetic_720"}))[
            "type"
        ] == "create_entry"
        assert calls[-2:] == [
            ("tts.synthetic_720", "Private reply"),
            ("tts.synthetic_720", "Other reply"),
        ]
        assert (await request(reply_id=old_id))["error"]["code"] == "not_found"
        assert (await submit({"doorbell_reply_1": "   "}))["type"] == "create_entry"
        assert (await request())["result"] == {"replies": None}
        assert (await submit({**engine, **fields}))["type"] == "create_entry"
        active_id = (await request())["result"]["replies"][0]["id"]
        assert (await request(reply_id=active_id))["success"]

    denied = await hass.auth.async_create_system_user(
        "No camera permission", group_ids=[]
    )
    denied_refresh = await hass.auth.async_create_refresh_token(denied)
    async with session.ws_connect("http://127.0.0.1:8123/api/websocket") as ws:
        await ws.receive_json()
        await ws.send_json(
            {
                "type": "auth",
                "access_token": hass.auth.async_create_access_token(denied_refresh),
            }
        )
        assert (await ws.receive_json())["type"] == "auth_ok"
        for id_, extra in [(1, {}), (2, {"reply_id": active_id})]:
            await ws.send_json(
                {
                    "id": id_,
                    "type": f"{DOMAIN}/doorbell_replies",
                    "entity_id": camera.entity_id,
                    "instance_id": "smoke",
                    **extra,
                }
            )
            assert (await ws.receive_json())["error"]["code"] == "not_found"
    cache_file = CONFIG / ".storage" / f"{DOMAIN}.doorbell_replies.{entry.entry_id}"
    assert cache_file.stat().st_mode & 0o077 == 0
    async with session.get(
        f"http://127.0.0.1:8123/frigate_vision/frontend/{cache_file.name}"
    ) as response:
        assert response.status == 404
    assert await hass.config_entries.async_remove(entry.entry_id)
    assert not cache_file.exists()
    print(
        "OK: native TTS selector, save synthesis, no resynthesis on reads/reload, rollback, provider swap, clear, private persistence and camera authorization"
    )


async def scenario(module_url, card_bytes, audio=False):
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
            entry = await configure(
                hass,
                str(server.make_url("/")).rstrip("/"),
                go2rtc_url="http://127.0.0.1:1984" if audio else None,
            )
            assert hass.config_entries.async_entries(DOMAIN) == [entry]
            await setup_tts(hass)
            if audio:
                # -I excludes the script directory; import only the read-only fixture.
                sys.path.insert(0, str(FIXTURES / "audio"))
                from fixture import serve

                camera = register_fixture_camera(hass)
                hass.states.async_set(
                    camera.entity_id,
                    "idle",
                    {"camera_name": "synthetic_camera", "client_id": "smoke"},
                )
                await serve(hass, session, module_url, entry.entry_id)
                return
            await check_camera_streams(hass, session)
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
            await check_replies(hass, entry, session)
    finally:
        await hass.async_stop()


if __name__ == "__main__":
    # Never initialize a developer's local configuration when run by mistake.
    if Path(__file__).resolve().parent != FIXTURES:
        raise SystemExit("Run python scripts/test_ha_container.py instead.")
    # /config is a new tmpfs and both mounts are read-only. No host config or tokens.
    (CONFIG / "configuration.yaml").symlink_to(FIXTURES / "configuration.yaml")
    for fixture_domain in ("frigate", "synthetic_tts"):
        (CONFIG / "custom_components" / fixture_domain).symlink_to(
            FIXTURES / fixture_domain
        )
    audio = sys.argv[1:] == ["--audio"]
    if audio:
        (CONFIG / "www").mkdir(exist_ok=True)
        (CONFIG / "www/audio-check.html").write_text(
            "<!doctype html><title>Synthetic audio test</title>"
        )
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
                f"/frigate_vision/frontend/{module}?v={version}-doorbell-tts.1",
                (COMPONENT / "frontend" / module).read_bytes(),
                audio=audio,
            ),
            loop_factory=create_event_loop,
        )
