"""Contract tests for the bundled frontend module."""

from __future__ import annotations

import asyncio
import contextlib
import importlib.util
import json
import sys
import types
import unittest
from collections.abc import Iterator
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "frigate_vision"
FRONTEND = COMPONENT / "frontend"
TEST_PACKAGE = "frigate_vision_frontend_contract_test"


class StaticPathConfig:
    """Mirror the homeassistant.components.http.StaticPathConfig fields used here."""

    def __init__(
        self, url_path: str, local_path: str, cache_headers: bool = False
    ) -> None:
        self.url_path = url_path
        self.local_path = local_path
        self.cache_headers = cache_headers


class FakeHTTP:
    """Record the static paths the integration asks Home Assistant to serve."""

    def __init__(self) -> None:
        self.static_paths: list[StaticPathConfig] = []

    async def async_register_static_paths(self, configs: list[Any]) -> None:
        self.static_paths.extend(configs)


class FakeHass:
    """Minimal Home Assistant double for frontend registration."""

    def __init__(self, domain: str) -> None:
        self.data: dict[str, Any] = {domain: {}}
        self.http = FakeHTTP()


@contextlib.contextmanager
def isolated_frontend() -> Iterator[tuple[types.ModuleType, list[str]]]:
    """Yield the frontend module and the URLs add_extra_js_url was called with.

    Home Assistant is not installed for these tests, so its modules are stubbed
    for the load and removed again on exit. The add_extra_js_url double records
    every call instead of deduplicating like the real helper, so a missing
    registration guard stays visible.
    """
    extra_js_urls: list[str] = []
    saved: dict[str, types.ModuleType | None] = {}

    def record_extra_js_url(_hass: Any, module_url: str) -> None:
        extra_js_urls.append(module_url)

    def stub(name: str, **attributes: Any) -> types.ModuleType:
        module = types.ModuleType(name)
        module.__dict__.update(attributes)
        saved.setdefault(name, sys.modules.get(name))
        sys.modules[name] = module
        return module

    try:
        package = stub(TEST_PACKAGE)
        package.__path__ = [str(COMPONENT)]

        homeassistant = stub("homeassistant")
        homeassistant.__path__ = []
        components = stub("homeassistant.components")
        components.__path__ = []
        components.frontend = stub(
            "homeassistant.components.frontend",
            add_extra_js_url=record_extra_js_url,
        )
        components.http = stub(
            "homeassistant.components.http", StaticPathConfig=StaticPathConfig
        )
        stub("homeassistant.core", HomeAssistant=object)

        spec = importlib.util.spec_from_file_location(
            f"{TEST_PACKAGE}.frontend",
            FRONTEND / "__init__.py",
            submodule_search_locations=[str(FRONTEND)],
        )
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        yield module, extra_js_urls
    finally:
        for name in [key for key in sys.modules if key.startswith(TEST_PACKAGE)]:
            del sys.modules[name]
        for name, original in saved.items():
            if original is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original


class FrontendContractTests(unittest.TestCase):
    def test_card_is_bundled_with_the_integration(self) -> None:
        card = FRONTEND / "frigate-vision-card.js"
        self.assertTrue(card.is_file())
        source = card.read_text(encoding="utf-8")
        self.assertIn('customElements.get("frigate-vision-card")', source)
        self.assertNotIn("/api/llmvision", source.lower())

    def test_async_register_frontend_registers_the_card_once(self) -> None:
        modules_before = set(sys.modules)
        with isolated_frontend() as (frontend, extra_js_urls):
            hass = FakeHass(frontend.DOMAIN)
            asyncio.run(frontend.async_register_frontend(hass))
            asyncio.run(frontend.async_register_frontend(hass))
        self.assertEqual(set(sys.modules) - modules_before, set())

        manifest = json.loads((COMPONENT / "manifest.json").read_text(encoding="utf-8"))
        self.assertTrue(hass.data[frontend.DOMAIN][frontend.ATTR_FRONTEND_REGISTERED])
        self.assertEqual(len(hass.http.static_paths), 1)
        static_path = hass.http.static_paths[0]
        self.assertEqual(static_path.url_path, frontend.FRONTEND_URL_BASE)
        self.assertEqual(Path(static_path.local_path), FRONTEND)
        self.assertTrue(static_path.cache_headers)
        expected_url = (
            f"{frontend.FRONTEND_URL_BASE}/{frontend.FRONTEND_MODULE}"
            f"?v={manifest['version']}"
        )
        self.assertEqual(extra_js_urls, [expected_url])

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
