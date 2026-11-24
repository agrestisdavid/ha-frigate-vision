"""Behavior tests for the Card's read-only WebSocket commands."""

from __future__ import annotations

import asyncio
import base64
import importlib.util
import io
import json
import sys
import types
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from unittest.mock import call as ws_call

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "frigate_vision"


def _module(name: str, **attributes):
    module = types.ModuleType(name)
    module.__dict__.update(attributes)
    sys.modules[name] = module
    return module


def load_integration():
    """Load __init__.py with small dependency stubs instead of Home Assistant."""
    package_name = "frigate_vision_profile_test"
    package = _module(package_name)
    package.__path__ = [str(COMPONENT)]

    const_spec = importlib.util.spec_from_file_location(
        f"{package_name}.const",
        COMPONENT / "const.py",
    )
    const_module = importlib.util.module_from_spec(const_spec)
    sys.modules[const_spec.name] = const_module
    const_spec.loader.exec_module(const_module)

    utils_spec = importlib.util.spec_from_file_location(
        f"{package_name}.utils",
        COMPONENT / "utils.py",
    )
    utils_module = importlib.util.module_from_spec(utils_spec)
    sys.modules[utils_spec.name] = utils_module
    utils_spec.loader.exec_module(utils_module)

    class Invalid(Exception):
        pass

    _module(
        "voluptuous",
        ALLOW_EXTRA=object(),
        All=lambda *values: values,
        Any=lambda *values: values,
        Coerce=lambda value: value,
        Invalid=Invalid,
        Match=lambda _pattern: str,
        Optional=lambda key, **_kwargs: key,
        Required=lambda key, **_kwargs: key,
        Range=lambda **_kwargs: object(),
        Schema=lambda value, **_kwargs: value,
    )

    homeassistant = _module("homeassistant")
    homeassistant.__path__ = []
    components = _module("homeassistant.components")
    components.__path__ = []
    websocket_api = _module(
        "homeassistant.components.websocket_api",
        ActiveConnection=object,
        async_register_command=lambda *_args: None,
        async_response=lambda func: func,
        websocket_command=lambda _schema: lambda func: func,
    )
    components.websocket_api = websocket_api
    _module("homeassistant.auth.permissions.const", POLICY_READ="read")
    _module("homeassistant.config_entries", ConfigEntry=object)

    class SupportsResponse:
        ONLY = "only"

    _module(
        "homeassistant.core",
        HomeAssistant=object,
        ServiceCall=object,
        SupportsResponse=SupportsResponse,
        callback=lambda f: f,
    )

    class ConfigEntryNotReady(Exception):
        pass

    class ServiceValidationError(Exception):
        pass

    _module(
        "homeassistant.exceptions",
        ConfigEntryNotReady=ConfigEntryNotReady,
        ServiceValidationError=ServiceValidationError,
    )
    helpers = _module("homeassistant.helpers")
    helpers.__path__ = []
    config_validation = _module(
        "homeassistant.helpers.config_validation",
        boolean=bool,
        config_entry_only_config_schema=lambda _domain: {},
        entity_id=str,
        string=str,
    )
    entity_registry = _module(
        "homeassistant.helpers.entity_registry",
        async_get=lambda _hass: None,
    )
    helpers.config_validation = config_validation
    helpers.entity_registry = entity_registry

    analysis = _module(
        f"{package_name}.analysis",
        FrigateVisionError=Exception,
        RuntimeData=object,
        analyze_event=None,
        analyze_event_video=None,
        analyze_image=None,
        build_runtime=None,
        merged_config=lambda entry: {**entry.data, **entry.options},
    )
    sys.modules[f"{package_name}.frontend"] = _module(
        f"{package_name}.frontend",
        async_register_frontend=None,
    )

    spec = importlib.util.spec_from_file_location(
        package_name,
        COMPONENT / "__init__.py",
        submodule_search_locations=[str(COMPONENT)],
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module._analysis_stub = analysis
    return module


class ProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.integration = load_integration()

    @staticmethod
    def runtime(
        *,
        data: dict,
        options: dict | None = None,
        client_id: str | None = "frigate-main",
        frigate_data: dict | None = None,
        entry_id: str = "frigate-vision-entry",
    ):
        return SimpleNamespace(
            entry=SimpleNamespace(
                data=data,
                options=options or {},
                entry_id=entry_id,
            ),
            frigate=SimpleNamespace(instance_id=client_id),
            frigate_entry=SimpleNamespace(data=frigate_data or {}),
        )

    @staticmethod
    def connection():
        class Connection:
            result = None
            error = None

            def send_result(self, msg_id, result):
                self.result = (msg_id, result)

            def send_error(self, msg_id, code, message):
                self.error = (msg_id, code, message)

        return Connection()

    def hass_with_runtimes(self, **runtimes):
        return SimpleNamespace(
            data={
                self.integration.DOMAIN: {
                    self.integration.ATTR_RUNTIME_ENTRIES: runtimes,
                }
            }
        )

    def test_services_survive_partial_unload_and_register_again_after_reload(self):
        async def exercise():
            integration = self.integration
            handlers = {}

            def register(domain, name, handler, **kwargs):
                self.assertEqual(domain, integration.DOMAIN)
                self.assertNotIn(name, handlers)
                handlers[name] = handler

            hass = SimpleNamespace(
                data={},
                services=SimpleNamespace(
                    async_register=register,
                    async_remove=lambda domain, name: handlers.pop(name),
                ),
            )
            first, second = Mock(entry_id="first"), Mock(entry_id="second")
            runtimes = [object(), object(), object()]
            analyze = AsyncMock(return_value={"response_text": "ok"})
            with (
                patch.object(integration, "async_register_frontend", AsyncMock()),
                patch.object(
                    integration, "build_runtime", AsyncMock(side_effect=runtimes)
                ),
                patch.object(integration, "analyze_event", analyze),
                patch.object(
                    integration,
                    "reply_cache",
                    return_value=SimpleNamespace(async_load=AsyncMock()),
                ),
                patch.object(integration.websocket_api, "async_register_command") as ws,
            ):
                await integration.async_setup(hass, {})
                await integration.async_setup_entry(hass, first)
                await integration.async_setup_entry(hass, second)
                self.assertEqual(len(handlers), 3)
                await integration.async_unload_entry(hass, first)
                call = SimpleNamespace(
                    data={
                        "event_id": "test",
                        "prompt": "describe",
                        "store": False,
                        "force": False,
                    }
                )
                self.assertEqual(
                    await handlers[integration.SERVICE_ANALYZE_EVENT](call),
                    {"response_text": "ok"},
                )
                self.assertIs(analyze.await_args.args[0], runtimes[1])
                await integration.async_unload_entry(hass, second)
                self.assertEqual(handlers, {})
                await integration.async_setup_entry(hass, first)
                self.assertEqual(len(handlers), 3)
                await handlers[integration.SERVICE_ANALYZE_EVENT](call)
                self.assertIs(analyze.await_args.args[0], runtimes[2])
                await integration.async_setup(hass, {})
                self.assertEqual(
                    ws.call_args_list,
                    [
                        ws_call(hass, integration.ws_profile),
                        ws_call(hass, integration.ws_camera_streams),
                        ws_call(hass, integration.ws_doorbell_replies),
                    ],
                )

        asyncio.run(exercise())

    def test_returns_exact_client_id_without_implicit_direct_url(self):
        runtime = self.runtime(
            data={
                "endpoint": "https://provider.example.test/v1",
                "api_key": "provider-secret",
                "model": "vision-model",
            },
            frigate_data={
                "url": "http://frigate.internal.test:5000",
                "password": "frigate-secret",
            },
            client_id="frigate_primary-01",
        )

        profile = self.integration._profile_for_runtime(runtime)

        self.assertEqual(
            profile,
            {
                "frigate_client_id": "frigate_primary-01",
                "go2rtc_url": None,
                "go2rtc_url_external": None,
                "go2rtc_modes": "webrtc,mse,mp4,hls,mjpeg",
            },
        )
        serialized = json.dumps(profile)
        for secret in (
            "provider-secret",
            "frigate-secret",
            "provider.example.test",
            "frigate.internal.test",
        ):
            self.assertNotIn(secret, serialized)

    def test_returns_only_explicit_validated_overrides(self):
        runtime = self.runtime(
            data={
                "go2rtc_url": " https://go2rtc.internal.test/api/go2rtc/ ",
                "go2rtc_modes": "webrtc,mse",
            },
            options={
                "go2rtc_url_external": "https://go2rtc.example.test/live/",
            },
        )

        profile = self.integration._profile_for_runtime(runtime)

        self.assertEqual(
            profile["go2rtc_url"],
            "https://go2rtc.internal.test/api/go2rtc",
        )
        self.assertEqual(
            profile["go2rtc_url_external"],
            "https://go2rtc.example.test/live",
        )
        self.assertEqual(profile["go2rtc_modes"], "webrtc,mse")

    def test_invalid_stored_overrides_are_dropped_independently(self):
        for internal, external, expected in (
            (
                "https://user:card-secret@go2rtc.internal.test",
                "https://go2rtc.example.test/live/",
                (None, "https://go2rtc.example.test/live"),
            ),
            (
                "https://go2rtc.internal.test/",
                "https://go2rtc.example.test/?token=card-secret",
                ("https://go2rtc.internal.test", None),
            ),
            ("ftp://go2rtc.internal.test", "go2rtc.example.test", (None, None)),
            ("   ", "", (None, None)),
            (None, "https://go2rtc.example.test/#card-secret", (None, None)),
        ):
            with self.subTest(internal=internal, external=external):
                runtime = self.runtime(
                    data={"go2rtc_url": internal},
                    options={"go2rtc_url_external": external},
                )

                profile = self.integration._profile_for_runtime(runtime)

                self.assertEqual(
                    (profile["go2rtc_url"], profile["go2rtc_url_external"]),
                    expected,
                )
                self.assertNotIn("card-secret", json.dumps(profile))

    def test_old_entry_without_override_fields_remains_valid(self):
        runtime = self.runtime(
            data={"endpoint": "https://provider.example.test", "model": "vision"},
            client_id=None,
        )

        profile = self.integration._profile_for_runtime(runtime)

        self.assertIsNone(profile["frigate_client_id"])
        self.assertIsNone(profile["go2rtc_url"])
        self.assertIsNone(profile["go2rtc_url_external"])

    def test_websocket_selects_exact_runtime_from_two_entries(self):
        runtime_a = self.runtime(
            data={
                "endpoint": "https://provider-a.example.test",
                "api_key": "secret-a",
                "model": "vision-a",
            },
            client_id="frigate-a",
            entry_id="entry-a",
        )
        runtime_b = self.runtime(
            data={
                "endpoint": "https://provider-b.example.test",
                "api_key": "secret-b",
                "model": "vision-b",
                "go2rtc_modes": "webrtc,mse",
            },
            client_id="frigate-b",
            frigate_data={
                "url": "https://frigate-b.internal.test",
                "password": "frigate-secret-b",
            },
            entry_id="entry-b",
        )
        hass = self.hass_with_runtimes(**{"entry-a": runtime_a, "entry-b": runtime_b})
        connection = self.connection()

        asyncio.run(
            self.integration.ws_profile(
                hass,
                connection,
                {
                    "id": 7,
                    "type": "frigate_vision/profile",
                    "entry_id": "entry-b",
                },
            )
        )

        self.assertIsNone(connection.error)
        self.assertEqual(
            connection.result,
            (
                7,
                {
                    "profile": {
                        "frigate_client_id": "frigate-b",
                        "go2rtc_url": None,
                        "go2rtc_url_external": None,
                        "go2rtc_modes": "webrtc,mse",
                    }
                },
            ),
        )
        serialized = json.dumps(connection.result)
        for secret in (
            "secret-a",
            "secret-b",
            "provider-a.example.test",
            "provider-b.example.test",
            "frigate-secret-b",
            "frigate-b.internal.test",
        ):
            self.assertNotIn(secret, serialized)

    def test_websocket_rejects_unknown_entry_without_fallback(self):
        runtime = self.runtime(
            data={"endpoint": "https://provider.example.test", "model": "vision"},
            client_id="frigate-a",
            entry_id="entry-a",
        )
        hass = self.hass_with_runtimes(**{"entry-a": runtime})
        connection = self.connection()

        asyncio.run(
            self.integration.ws_profile(
                hass,
                connection,
                {
                    "id": 8,
                    "type": "frigate_vision/profile",
                    "entry_id": "missing-entry",
                },
            )
        )

        self.assertIsNone(connection.result)
        self.assertEqual(connection.error[0:2], (8, "not_found"))
        self.assertIn("nicht gefunden", connection.error[2])

    def test_websocket_uses_only_runtime_when_entry_id_is_omitted(self):
        runtime = self.runtime(
            data={"endpoint": "https://provider.example.test", "model": "vision"},
            client_id="single-frigate",
            entry_id="only-entry",
        )
        hass = self.hass_with_runtimes(**{"only-entry": runtime})
        connection = self.connection()

        asyncio.run(
            self.integration.ws_profile(
                hass,
                connection,
                {"id": 9, "type": "frigate_vision/profile"},
            )
        )

        self.assertIsNone(connection.error)
        self.assertEqual(
            connection.result[1]["profile"]["frigate_client_id"],
            "single-frigate",
        )

    def test_websocket_rejects_ambiguous_request_without_entry_id(self):
        hass = self.hass_with_runtimes(
            **{
                "entry-a": self.runtime(
                    data={"endpoint": "https://a.example.test", "model": "a"},
                    entry_id="entry-a",
                ),
                "entry-b": self.runtime(
                    data={"endpoint": "https://b.example.test", "model": "b"},
                    entry_id="entry-b",
                ),
            }
        )
        connection = self.connection()

        asyncio.run(
            self.integration.ws_profile(
                hass,
                connection,
                {"id": 10, "type": "frigate_vision/profile"},
            )
        )

        self.assertIsNone(connection.result)
        self.assertEqual(connection.error[0:2], (10, "not_found"))
        self.assertIn("Mehrere", connection.error[2])


class CameraStreamTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.dict(sys.modules):
            cls.module = load_integration().camera_streams

    @staticmethod
    def config(streams, *aliases):
        return {
            "mqtt": {"client_id": "demo"},
            "cameras": {"front": {"live": {"streams": streams}}, "other": {}},
            "go2rtc": {
                "streams": {k: ["rtsp://redacted-source.invalid/path"] for k in aliases}
            },
        }

    def test_returns_only_linked_aliases_and_unique_role_hints(self):
        source = "rtsp://secret.invalid/raw"
        config = self.config(
            {
                "HD": "first",
                "SD": "front_sub",
                source: "extra",
                "invalid": source,
                "gone": "missing",
            },
            "first",
            "front_sub",
            "extra",
            "other_private",
            source,
        )
        self.assertEqual(
            self.module.camera_stream_options(config, "front"),
            {
                "streams": ["first", "front_sub", "extra"],
                "main": "first",
                "sub": "front_sub",
            },
        )

    def test_ambiguity_duplicate_aliases_and_contradictions_are_not_guessed(self):
        for mapping, main, sub in [
            ({"One": "stream1", "Two": "stream2"}, None, None),
            ({"HD": "a", "Main": "b", "Small": "front_sub"}, None, "front_sub"),
            ({"Main": "front_sub"}, None, None),
            ({"Main": "a", "HD": "a"}, "a", None),
            ({"HD": "a", "SD": "a"}, None, None),
            ({"Aliased": "front_main"}, "front_main", None),
        ]:
            with self.subTest(mapping=mapping):
                result = self.module.camera_stream_options(
                    self.config(mapping, *mapping.values()), "front"
                )
                self.assertEqual(
                    result,
                    {
                        "streams": list(dict.fromkeys(mapping.values())),
                        "main": main,
                        "sub": sub,
                    },
                )

    def test_exact_camera_alias_fallback_only_and_malformed_data(self):
        config = self.config({}, "front", "front_sub", "elsewhere")
        self.assertEqual(
            self.module.camera_stream_options(config, "front"),
            {"streams": ["front"], "main": None, "sub": None},
        )
        for broken in [
            {},
            {"cameras": [], "go2rtc": True},
            self.config({"Main": []}, "front"),
            self.config({"Main": "no-such-key"}, "front"),
        ]:
            self.assertEqual(
                self.module.camera_stream_options(broken, "front"),
                {"streams": [], "main": None, "sub": None},
            )

    def test_ws_uses_registry_owner_and_read_permission_not_entity_slug(self):
        config = self.config({"Main": "chosen"}, "chosen")
        hass = SimpleNamespace(
            data={
                "frigate": {
                    "A": {"config": config},
                    "B": {
                        "config": self.config({"HD": "other_private"}, "other_private")
                    },
                }
            }
        )
        entity = SimpleNamespace(
            platform="frigate",
            config_entry_id="A",
            unique_id="A:camera:front",
            disabled_by=None,
        )
        msg = {"id": 9, "entity_id": "camera.renamed_front", "instance_id": "demo"}
        with patch.object(self.module.er, "async_get") as registry:
            registry.return_value.async_get.return_value = entity
            connection = Mock()
            connection.user.permissions.check_entity.return_value = False
            self.module.ws_camera_streams(hass, connection, msg)
            registry.assert_not_called()
            connection.user.permissions.check_entity.assert_called_once_with(
                msg["entity_id"], "read"
            )
            not_found = connection.send_error.call_args
            self.assertEqual(not_found.args[1], "not_found")
            connection.send_result.assert_not_called()
            connection.user.permissions.check_entity.return_value = True
            self.module.ws_camera_streams(hass, connection, msg)
            connection.send_result.assert_called_once_with(
                9, {"streams": ["chosen"], "main": "chosen", "sub": None}
            )
            for entity_patch, msg_patch in [
                ({"platform": "other"}, {}),
                ({"disabled_by": "user"}, {}),
                ({"unique_id": "B:camera:front"}, {}),
                ({"unique_id": "A:camera:missing"}, {}),
                ({}, {"instance_id": "wrong"}),
                ({}, {"entity_id": "sensor.other"}),
            ]:
                with self.subTest(entity_patch=entity_patch, msg_patch=msg_patch):
                    registry.return_value.async_get.return_value = SimpleNamespace(
                        **(vars(entity) | entity_patch)
                    )
                    connection.reset_mock()
                    self.module.ws_camera_streams(hass, connection, msg | msg_patch)
                    self.assertEqual(connection.send_error.call_args, not_found)
                    connection.send_result.assert_not_called()


class DoorbellReplyAudioTests(unittest.IsolatedAsyncioTestCase):
    async def test_boundary_clips_save_reload_and_serve_without_losing_prior_replies(
        self,
    ):
        cases = json.loads((ROOT / "tests/card/reply-audio-cases.json").read_bytes())
        over = "One frame too long"
        lengths = {case["text"]: case["sourceFrames"] for case in cases}
        lengths[over] = 320001
        saved = {}

        class Store:
            def __class_getitem__(cls, _item):
                return cls

            def __init__(self, _hass, _version, key, *, private, atomic_writes):
                assert private and atomic_writes
                self.key = key

            async def async_load(self):
                return json.loads(saved[self.key]) if self.key in saved else None

            async def async_save(self, data):
                saved[self.key] = json.dumps(data)

        async def synthetic_audio(_hass, text):
            out = io.BytesIO()
            with wave.open(out, "wb") as wav:
                wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
                wav.writeframes(b"\x01\x00" * lengths[text])
            return "wav", out.getvalue()

        with patch.dict(sys.modules):
            module = load_integration().doorbell_replies
            _module("homeassistant.helpers.storage", Store=Store)
            tts = _module(
                "homeassistant.components.tts",
                async_resolve_engine=lambda *_args: True,
                generate_media_source_id=Mock(
                    side_effect=lambda _hass, text, **_: text
                ),
                async_get_media_source_audio=AsyncMock(side_effect=synthetic_audio),
            )
            entry_id = "test-entry"
            hass = SimpleNamespace(
                data={
                    module.DOMAIN: {
                        module.ATTR_RUNTIME_ENTRIES: {
                            entry_id: SimpleNamespace(
                                frigate_entry=SimpleNamespace(entry_id="frigate-entry")
                            )
                        }
                    }
                },
                config_entries=SimpleNamespace(async_get_entry=lambda _id: object()),
                is_stopping=False,
                states={"tts.fixture": SimpleNamespace(state="ready")},
            )
            values = {module.TTS_ENTITY: "tts.fixture"} | {
                field: case["text"]
                for field, case in zip(module.REPLY_FIELDS, cases, strict=True)
            }

            def served(cache):
                hass.data[module._CACHE][entry_id] = cache
                connection = ProfileTests.connection()
                msg = {"id": 1, "entity_id": "camera.door", "instance_id": "fixture"}
                with patch.object(
                    module,
                    "readable_camera",
                    return_value=("frigate-entry", None, None),
                ):
                    module.ws_doorbell_replies(hass, connection, msg)
                    replies = connection.result[1]["replies"]
                    audio = {}
                    for reply in replies or []:
                        module.ws_doorbell_replies(
                            hass, connection, msg | {"reply_id": reply["id"]}
                        )
                        audio[reply["id"]] = connection.result[1]["audio"]
                    return replies, audio

            cache = module.reply_cache(hass, entry_id)
            await cache.async_save(values)
            replies, audio = served(cache)
            self.assertEqual([reply["text"] for reply in replies], list(lengths)[:3])
            for case, reply in zip(cases, replies, strict=True):
                with self.subTest(clip=reply["text"]):
                    encoded = audio[reply["id"]]
                    self.assertEqual(len(encoded), case["base64Chars"])
                    raw = base64.b64decode(encoded, validate=True)
                    self.assertEqual(len(raw), case["wavBytes"])
                    self.assertEqual(int.from_bytes(raw[4:8], "little"), len(raw) - 8)
                    self.assertEqual(raw[36:40], b"data")
                    with wave.open(io.BytesIO(raw), "rb") as wav:
                        self.assertEqual(
                            wav.getparams()[:4], (1, 2, 16000, case["outputFrames"])
                        )
                        self.assertEqual(
                            wav.readframes(wav.getnframes()),
                            b"\x01\x00" * case["sourceFrames"] + bytes(8000),
                        )

            fresh = module.ReplyCache(hass, entry_id)
            await fresh.async_load()
            self.assertEqual(fresh.form_values(), values)
            self.assertEqual(served(fresh), (replies, audio))
            self.assertEqual(tts.async_get_media_source_audio.await_count, 3)
            prior = saved.copy()
            key = module.REPLY_FIELDS[-1]
            with self.assertRaises(module.ReplyError) as error:
                await fresh.async_save(values | {key: over})
            self.assertEqual(
                (error.exception.field, error.exception.code),
                (key, "reply_synthesis_failed"),
            )
            self.assertIsInstance(error.exception.__cause__, ValueError)
            self.assertEqual(str(error.exception.__cause__), "Invalid TTS PCM length")
            self.assertEqual(tts.async_get_media_source_audio.await_args.args[1], over)
            self.assertEqual(saved, prior)
            self.assertEqual(fresh.form_values(), values)
            self.assertEqual(served(fresh), (replies, audio))
            reloaded = module.ReplyCache(hass, entry_id)
            await reloaded.async_load()
            self.assertEqual(reloaded.form_values(), values)
            self.assertEqual(served(reloaded), (replies, audio))

            # One extra byte fits in the same number of base64 characters.
            data = json.loads(next(iter(prior.values())))
            for extra in (1, 2):
                with self.subTest(extra_bytes=extra):
                    data["replies"][1]["audio"] = base64.b64encode(
                        bytes(cases[1]["wavBytes"] + extra)
                    ).decode("ascii")
                    saved[reloaded._store.key] = json.dumps(data)
                    invalid = module.ReplyCache(hass, entry_id)
                    with self.assertLogs(module._LOGGER, "WARNING"):
                        await invalid.async_load()
                    self.assertEqual(invalid.clips, [])


if __name__ == "__main__":
    unittest.main()
