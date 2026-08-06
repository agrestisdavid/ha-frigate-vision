"""Dependency-light source and helper tests."""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "frigate_vision"


def load_utils():
    """Load utils without importing Home Assistant component __init__."""
    package_name = "frigate_vision_test"
    package = type(sys)(package_name)
    package.__path__ = [str(COMPONENT)]
    sys.modules[package_name] = package

    const_spec = importlib.util.spec_from_file_location(
        f"{package_name}.const", COMPONENT / "const.py"
    )
    const_module = importlib.util.module_from_spec(const_spec)
    sys.modules[const_spec.name] = const_module
    const_spec.loader.exec_module(const_module)

    spec = importlib.util.spec_from_file_location(
        f"{package_name}.utils", COMPONENT / "utils.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class HelperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.utils = load_utils()

    def test_normalizes_base_and_full_endpoint(self):
        self.assertEqual(
            self.utils.normalize_chat_completions_url("https://example.test/v1"),
            "https://example.test/v1/chat/completions",
        )
        self.assertEqual(
            self.utils.normalize_chat_completions_url(
                "https://example.test/custom/chat/completions"
            ),
            "https://example.test/custom/chat/completions",
        )
        self.assertEqual(
            self.utils.normalize_chat_completions_url(
                "https://example.test/v1?api-version=2026-01-01"
            ),
            "https://example.test/v1/chat/completions?api-version=2026-01-01",
        )

    def test_rejects_non_http_endpoint(self):
        with self.assertRaises(ValueError):
            self.utils.normalize_chat_completions_url("file:///tmp/provider")
        with self.assertRaises(ValueError):
            self.utils.normalize_chat_completions_url("https://secret@example.test/v1")

    def test_validates_opaque_event_ids(self):
        self.assertEqual(
            self.utils.validate_event_id("1720000000.123456-abcdef"),
            "1720000000.123456-abcdef",
        )
        for invalid in ("", "../config", "event/other", "event?x=1"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                self.utils.validate_event_id(invalid)

    def test_validates_non_secret_go2rtc_urls(self):
        self.assertEqual(
            self.utils.validate_go2rtc_url("https://frigate.example.test/api/go2rtc/"),
            "https://frigate.example.test/api/go2rtc",
        )
        for invalid in (
            "https://user:secret@frigate.example.test",
            "https://frigate.example.test/api/go2rtc?token=secret",
            "/api/go2rtc",
        ):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                self.utils.validate_go2rtc_url(invalid)

    def test_extracts_string_and_segmented_content(self):
        self.assertEqual(
            self.utils.extract_response_text(
                {"choices": [{"message": {"content": "  hello  "}}]}
            ),
            "hello",
        )
        self.assertEqual(
            self.utils.extract_response_text(
                {
                    "choices": [
                        {
                            "message": {
                                "content": [
                                    {"type": "text", "text": "one"},
                                    {"type": "text", "text": "two"},
                                ]
                            }
                        }
                    ]
                }
            ),
            "one\ntwo",
        )

    def test_reads_only_canonical_event_description(self):
        self.assertEqual(
            self.utils.event_description(
                {"data": {"description": " exact description "}}
            ),
            "exact description",
        )
        self.assertEqual(self.utils.event_description({"description": "legacy"}), "")

    def test_sanitizes_go2rtc_modes(self):
        self.assertEqual(
            self.utils.sanitize_go2rtc_modes("webrtc,invalid,hls,webrtc"),
            "webrtc,hls",
        )


class PackageContractTests(unittest.TestCase):
    def test_json_files_are_valid(self):
        for path in [
            COMPONENT / "manifest.json",
            COMPONENT / "strings.json",
            COMPONENT / "translations" / "en.json",
            COMPONENT / "translations" / "de.json",
            ROOT / "hacs.json",
        ]:
            json.loads(path.read_text(encoding="utf-8"))

    def test_runtime_has_response_services_and_no_timeline(self):
        source = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        analysis = (COMPONENT / "analysis.py").read_text(encoding="utf-8")
        self.assertIn("cv.config_entry_only_config_schema(DOMAIN)", source)
        self.assertGreaterEqual(source.count("SupportsResponse.ONLY"), 2)
        self.assertIn('f"api/events/{event_id}/description"', analysis)
        combined = "\n".join(
            path.read_text(encoding="utf-8") for path in COMPONENT.rglob("*.py")
        ).lower()
        self.assertNotIn("llmvision", combined)
        self.assertNotIn("timeline.db", combined)
        self.assertNotIn("sqlite", combined)

    def test_image_schema_rejects_arbitrary_url_field(self):
        services = (COMPONENT / "services.yaml").read_text(encoding="utf-8")
        self.assertIn("media_source:", services)
        self.assertIn("file_path:", services)
        self.assertNotIn("image_url:", services)

    def test_config_flow_uses_portable_two_step_form(self):
        config_flow = (COMPONENT / "config_flow.py").read_text(encoding="utf-8")
        self.assertIn("async_step_provider", config_flow)
        self.assertIn("SelectSelector", config_flow)
        self.assertIn('step_id="provider"', config_flow)
        self.assertNotIn("ConfigEntrySelector", config_flow)

        for path in (
            COMPONENT / "strings.json",
            COMPONENT / "translations" / "en.json",
            COMPONENT / "translations" / "de.json",
        ):
            translation = json.loads(path.read_text(encoding="utf-8"))
            steps = translation["config"]["step"]
            self.assertEqual(
                set(steps["user"]["data"]),
                {"frigate_entry_id"},
            )
            self.assertIn("endpoint", steps["provider"]["data"])
            self.assertIn("model", steps["provider"]["data"])

    def test_manifest_and_runtime_versions_match(self):
        manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
        const = (COMPONENT / "const.py").read_text(encoding="utf-8")
        self.assertIn(f'VERSION = "{manifest["version"]}"', const)

    def test_hacs_manifest_uses_only_supported_project_fields(self):
        manifest = json.loads((ROOT / "hacs.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], "Frigate Vision")
        self.assertNotIn("domains", manifest)

    def test_image_sources_use_bounded_reads(self):
        analysis = (COMPONENT / "analysis.py").read_text(encoding="utf-8")
        self.assertNotIn("response.read()", analysis)
        self.assertNotIn("response.text()", analysis)
        self.assertNotIn("response.json()", analysis)
        self.assertNotIn("path.read_bytes", analysis)
        self.assertIn("iter_chunked", analysis)
        self.assertIn("MAX_IMAGE_BYTES + 1", analysis)
        self.assertIn("MAX_PROVIDER_RESPONSE_BYTES", analysis)
        self.assertIn("MAX_IMAGE_PIXELS", analysis)

    def test_diagnostics_redact_provider_endpoint(self):
        diagnostics = (COMPONENT / "diagnostics.py").read_text(encoding="utf-8")
        for field in (
            "CONF_API_KEY",
            "CONF_ENDPOINT",
            "CONF_GO2RTC_URL",
            "CONF_GO2RTC_URL_EXTERNAL",
        ):
            self.assertIn(field, diagnostics)
        self.assertIn("async_redact_data", diagnostics)


if __name__ == "__main__":
    unittest.main()
