"""Behavior tests for config-entry diagnostics."""

from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "frigate_vision"
REDACTED = "**REDACTED**"


def _module(name: str, **attributes) -> types.ModuleType:
    module = types.ModuleType(name)
    module.__dict__.update(attributes)
    return module


def _redact(data, to_redact):
    """Mirror Home Assistant's async_redact_data for flat mappings."""
    return {key: REDACTED if key in to_redact else value for key, value in data.items()}


def load_diagnostics():
    """Load diagnostics.py with stubs that are removed again after import."""
    package_name = "frigate_vision_diagnostics_test"
    package = _module(package_name)
    package.__path__ = [str(COMPONENT)]
    stubs = {
        package_name: package,
        "homeassistant": _module("homeassistant", __path__=[]),
        "homeassistant.components": _module("homeassistant.components", __path__=[]),
        "homeassistant.components.diagnostics": _module(
            "homeassistant.components.diagnostics", async_redact_data=_redact
        ),
        "homeassistant.config_entries": _module(
            "homeassistant.config_entries", ConfigEntry=object
        ),
        "homeassistant.core": _module("homeassistant.core", HomeAssistant=object),
    }
    with patch.dict(sys.modules, stubs):
        for name in ("const", "diagnostics"):
            spec = importlib.util.spec_from_file_location(
                f"{package_name}.{name}", COMPONENT / f"{name}.py"
            )
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
    return module


class DiagnosticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.diagnostics = load_diagnostics()

    @staticmethod
    def entry():
        return SimpleNamespace(
            entry_id="vision-entry",
            data={
                "frigate_entry_id": "frigate-entry",
                "endpoint": "https://provider.example.test/v1",
                "api_key": "provider-secret",
                "model": "vision-model",
                "go2rtc_url": "https://go2rtc.internal.test",
                "go2rtc_url_external": "https://go2rtc.example.test",
                "go2rtc_modes": "webrtc,mse",
            },
            options={"api_key": "rotated-secret", "timeout": 90},
        )

    def diagnostics_for(self, domain_data):
        hass = SimpleNamespace(data=domain_data)
        return asyncio.run(
            self.diagnostics.async_get_config_entry_diagnostics(hass, self.entry())
        )

    def test_redacts_credentials_and_endpoints_from_data_and_options(self):
        result = self.diagnostics_for(
            {"frigate_vision": {"entries": {"vision-entry": object()}}}
        )

        self.assertEqual(
            result,
            {
                "domain": "frigate_vision",
                "entry_id": "vision-entry",
                "frigate_entry_id": "frigate-entry",
                "data": {
                    "frigate_entry_id": "frigate-entry",
                    "endpoint": REDACTED,
                    "api_key": REDACTED,
                    "model": "vision-model",
                    "go2rtc_url": REDACTED,
                    "go2rtc_url_external": REDACTED,
                    "go2rtc_modes": "webrtc,mse",
                },
                "options": {"api_key": REDACTED, "timeout": 90},
                "runtime_loaded": True,
            },
        )

    def test_reports_whether_this_entry_has_a_loaded_runtime(self):
        for domain_data in (
            {},
            {"frigate_vision": {}},
            {"frigate_vision": {"entries": {}}},
            {"frigate_vision": {"entries": {"other-entry": object()}}},
        ):
            with self.subTest(domain_data=domain_data):
                result = self.diagnostics_for(domain_data)
                self.assertIs(result["runtime_loaded"], False)


if __name__ == "__main__":
    unittest.main()
