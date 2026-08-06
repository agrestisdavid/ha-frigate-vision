"""Contract tests for the privacy-preserving documentation site."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


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

    def test_docs_have_no_remote_scripts_or_images(self) -> None:
        combined = "\n".join(
            path.read_text(encoding="utf-8")
            for path in DOCS.rglob("*")
            if path.is_file()
        )
        self.assertIsNone(
            re.search(r"!\[[^\]]*\]\(\s*https?://", combined, re.IGNORECASE)
        )
        self.assertIsNone(
            re.search(
                r"<(?:script|img)\b[^>]+\bsrc=[\"']https?://",
                combined,
                re.IGNORECASE,
            )
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
