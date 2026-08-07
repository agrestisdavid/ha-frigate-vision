"""Behavior tests for the non-secret Card runtime profile."""

from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace

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
        Invalid=Invalid,
        Optional=lambda key, **_kwargs: key,
        Required=lambda key, **_kwargs: key,
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
    _module("homeassistant.config_entries", ConfigEntry=object)

    class SupportsResponse:
        ONLY = "only"

    _module(
        "homeassistant.core",
        HomeAssistant=object,
        ServiceCall=object,
        SupportsResponse=SupportsResponse,
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


if __name__ == "__main__":
    unittest.main()
