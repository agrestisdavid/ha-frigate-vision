"""Source-contract tests for the bundled frontend module."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "frigate_vision"
FRONTEND = COMPONENT / "frontend"


class FrontendContractTests(unittest.TestCase):
    def test_card_is_bundled_with_the_integration(self) -> None:
        card = FRONTEND / "frigate-vision-card.js"
        self.assertTrue(card.is_file())
        source = card.read_text(encoding="utf-8")
        self.assertIn('const CARD_VERSION = "0.3.5-beta.1";', source)
        self.assertIn('customElements.get("frigate-vision-card")', source)
        self.assertNotIn("/api/llmvision", source.lower())

    def test_versioned_module_is_registered_once(self) -> None:
        init_source = (COMPONENT / "__init__.py").read_text(encoding="utf-8")
        frontend_source = (FRONTEND / "__init__.py").read_text(encoding="utf-8")
        self.assertIn("await async_register_frontend(hass)", init_source)
        self.assertIn("ATTR_FRONTEND_REGISTERED", frontend_source)
        self.assertIn("async_register_static_paths", frontend_source)
        self.assertIn("add_extra_js_url", frontend_source)
        self.assertIn("?v={VERSION}", frontend_source)
        self.assertNotIn("except RuntimeError", frontend_source)

    def test_manifest_declares_frontend_dependency_and_shared_version(self) -> None:
        manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], "0.3.5-beta.1")
        self.assertIn("frontend", manifest["dependencies"])
        self.assertEqual(
            manifest["documentation"],
            "https://agrestisdavid.github.io/ha-frigate-vision/",
        )

    def test_local_brand_icons_are_valid_png_files(self) -> None:
        for name, size in (("icon.png", 256), ("icon@2x.png", 512)):
            data = (COMPONENT / "brand" / name).read_bytes()
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(int.from_bytes(data[16:20], "big"), size)
            self.assertEqual(int.from_bytes(data[20:24], "big"), size)


if __name__ == "__main__":
    unittest.main()
