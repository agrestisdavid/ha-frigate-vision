"""Contract tests for the privacy-preserving documentation site."""

from __future__ import annotations

import re
import unittest
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
BLUEPRINT_SOURCE = (
    "https://github.com/agrestisdavid/ha-frigate-vision/blob/main/"
    "blueprints/automation/frigate_vision/event_notification.yaml"
)
BLUEPRINT_BADGE = "https://my.home-assistant.io/badges/blueprint_import.svg"
BLUEPRINT_REDIRECT_PREFIX = "https://my.home-assistant.io/redirect/blueprint_import/"
HACS_BADGE = "https://my.home-assistant.io/badges/hacs_repository.svg"
HACS_REDIRECT_PREFIX = "https://my.home-assistant.io/redirect/hacs_repository/"


class DocumentationContractTests(unittest.TestCase):
    def test_material_and_all_documentation_dependencies_are_pinned(self) -> None:
        direct = (ROOT / "requirements-docs.in").read_text(encoding="utf-8")
        locked = (ROOT / "requirements-docs.txt").read_text(encoding="utf-8")
        self.assertEqual(direct.strip(), "mkdocs-material==9.7.7")
        for line in locked.splitlines():
            if line and not line.startswith("#"):
                self.assertRegex(line, r"^[A-Za-z0-9_.-]+==[^=\s]+$")
        self.assertIn("mkdocs-material==9.7.7", locked)

    def test_site_uses_system_fonts_search_and_privacy_only(self) -> None:
        config = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
        self.assertIn("font: false", config)
        self.assertIn("  - search", config)
        self.assertIn("  - privacy", config)
        self.assertNotIn("analytics:", config)
        self.assertNotIn("extra_javascript:", config)

    def test_docs_only_reference_reviewed_my_home_assistant_badges(self) -> None:
        sources = [ROOT / "README.md"] + [
            path
            for path in DOCS.rglob("*")
            if path.is_file() and path.suffix in {".md", ".html", ".css", ".js"}
        ]
        combined = "\n".join(path.read_text(encoding="utf-8") for path in sources)
        remote_images = re.findall(
            r"!\[[^\]]*\]\(\s*(https?://[^)\s]+)",
            combined,
            re.IGNORECASE,
        )
        self.assertEqual(
            Counter(remote_images),
            Counter({BLUEPRINT_BADGE: 3, HACS_BADGE: 2}),
        )
        self.assertIsNone(
            re.search(
                r"<(?:script|img)\b[^>]+\bsrc=[\"']https?://",
                combined,
                re.IGNORECASE,
            )
        )

    def test_blueprint_import_buttons_match_the_canonical_source(self) -> None:
        documents = (
            ROOT / "README.md",
            DOCS / "getting-started.md",
            DOCS / "blueprint.md",
        )
        link_pattern = re.compile(
            r"\]\((https://my\.home-assistant\.io/redirect/"
            r"blueprint_import/\?blueprint_url=[^)]+)\)"
        )

        for document in documents:
            with self.subTest(document=document.name):
                source = document.read_text(encoding="utf-8")
                self.assertIn(BLUEPRINT_BADGE, source)
                self.assertIn(BLUEPRINT_SOURCE, source)
                match = link_pattern.search(source)
                self.assertIsNotNone(match)
                redirect = urlsplit(match.group(1))
                self.assertEqual(
                    f"{redirect.scheme}://{redirect.netloc}{redirect.path}",
                    BLUEPRINT_REDIRECT_PREFIX,
                )
                self.assertEqual(
                    parse_qs(redirect.query).get("blueprint_url"),
                    [BLUEPRINT_SOURCE],
                )

        blueprint = (
            ROOT
            / "blueprints"
            / "automation"
            / "frigate_vision"
            / "event_notification.yaml"
        ).read_text(encoding="utf-8")
        self.assertIn(f"source_url: {BLUEPRINT_SOURCE}", blueprint)

    def test_hacs_buttons_target_the_custom_integration_repository(self) -> None:
        documents = (
            ROOT / "README.md",
            DOCS / "getting-started.md",
        )
        link_pattern = re.compile(
            r"\]\((https://my\.home-assistant\.io/redirect/"
            r"hacs_repository/\?[^)]+)\)"
        )

        for document in documents:
            with self.subTest(document=document.name):
                source = document.read_text(encoding="utf-8")
                self.assertIn(HACS_BADGE, source)
                match = link_pattern.search(source)
                self.assertIsNotNone(match)
                redirect = urlsplit(match.group(1))
                self.assertEqual(
                    f"{redirect.scheme}://{redirect.netloc}{redirect.path}",
                    HACS_REDIRECT_PREFIX,
                )
                self.assertEqual(
                    parse_qs(redirect.query),
                    {
                        "owner": ["agrestisdavid"],
                        "repository": ["ha-frigate-vision"],
                        "category": ["integration"],
                    },
                )

    def test_workflow_actions_are_immutable(self) -> None:
        for workflow in (ROOT / ".github" / "workflows").glob("*.yml"):
            source = workflow.read_text(encoding="utf-8")
            for ref in re.findall(
                r"^\s*uses:\s*[^@\s]+@([^\s#]+)",
                source,
                re.MULTILINE,
            ):
                with self.subTest(workflow=workflow.name, ref=ref):
                    self.assertRegex(ref, r"^[0-9a-f]{40}$")


if __name__ == "__main__":
    unittest.main()
