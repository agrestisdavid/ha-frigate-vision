"""Reject executable or image assets loaded from remote origins."""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


class RemoteAssetParser(HTMLParser):
    """Collect remote script and image-like asset URLs."""

    def __init__(self, source: Path) -> None:
        super().__init__()
        self.source = source
        self.findings: list[str] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        checked_attributes: tuple[str, ...]
        if tag == "script":
            checked_attributes = ("src",)
        elif tag in {"img", "source"}:
            checked_attributes = ("src", "srcset")
        else:
            return

        for name, value in attrs:
            if name not in checked_attributes or not value:
                continue
            for candidate in value.split(","):
                url = candidate.strip().split(maxsplit=1)[0]
                if urlsplit(url).scheme.lower() in {"http", "https"}:
                    self.findings.append(f"{self.source}: {tag} {name}={url}")


def main() -> int:
    site = Path(sys.argv[1] if len(sys.argv) > 1 else "site")
    findings: list[str] = []
    for html_file in site.rglob("*.html"):
        parser = RemoteAssetParser(html_file)
        parser.feed(html_file.read_text(encoding="utf-8"))
        findings.extend(parser.findings)

    if findings:
        print("Remote executable or image assets found:", file=sys.stderr)
        print("\n".join(findings), file=sys.stderr)
        return 1
    print("Built documentation contains no remote script or image assets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
