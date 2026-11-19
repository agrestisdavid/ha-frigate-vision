"""Contract and registration tests for the bundled frontend module."""

from __future__ import annotations

import json
import sys
import unittest
from importlib import import_module
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import NamedTuple
from unittest.mock import AsyncMock, Mock, patch

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "frigate_vision"
FRONTEND = COMPONENT / "frontend"


class StaticPath(NamedTuple):
    url_path: str
    path: str
    cache_headers: bool = False


class FrontendRegistrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_versioned_module_is_registered_once(self) -> None:
        package = ModuleType("_fv_frontend_test")
        package.__path__ = [str(COMPONENT)]
        add_url = Mock()  # Record every call, unlike HA's deduplicating URL set.
        stubs = {
            package.__name__: package,
            "homeassistant.components.frontend": SimpleNamespace(
                add_extra_js_url=add_url
            ),
            "homeassistant.components.http": SimpleNamespace(
                StaticPathConfig=StaticPath
            ),
            "homeassistant.core": SimpleNamespace(HomeAssistant=object),
        }
        # Include transitive imports under the temporary name in the rollback.
        with patch.dict(sys.modules, stubs):
            frontend = import_module(f"{package.__name__}.frontend")

        register_paths = AsyncMock()
        hass = SimpleNamespace(
            data={"frigate_vision": {}},
            http=SimpleNamespace(async_register_static_paths=register_paths),
        )
        await frontend.async_register_frontend(hass)
        await frontend.async_register_frontend(hass)

        base = "/frigate_vision/frontend"
        version = json.loads((COMPONENT / "manifest.json").read_bytes())["version"]
        register_paths.assert_awaited_once_with([StaticPath(base, str(FRONTEND), True)])
        add_url.assert_called_once_with(
            hass, f"{base}/frigate-vision-card.js?v={version}"
        )


class FrontendContractTests(unittest.TestCase):
    def test_card_is_bundled_with_the_integration(self) -> None:
        card = FRONTEND / "frigate-vision-card.js"
        self.assertTrue(card.is_file())
        source = card.read_text(encoding="utf-8")
        self.assertIn('customElements.get("frigate-vision-card")', source)
        self.assertNotIn("/api/llmvision", source.lower())

    def test_manifest_declares_frontend_dependency_and_shared_version(self) -> None:
        manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
        version = manifest["version"]
        source = (FRONTEND / "frigate-vision-card.js").read_text(encoding="utf-8")
        self.assertIn(f'const CARD_VERSION = "{version}";', source)
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
        self.assertEqual(package["version"], version)
        self.assertEqual(lock["version"], version)
        self.assertEqual(lock["packages"][""]["version"], version)
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
