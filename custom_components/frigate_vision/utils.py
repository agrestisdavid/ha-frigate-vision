"""Dependency-light helpers for Frigate Vision."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit, urlunsplit

_EVENT_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\Z")


def normalize_chat_completions_url(endpoint: str) -> str:
    """Return a full OpenAI-compatible chat-completions URL."""
    value = endpoint.strip().rstrip("/")
    parts = urlsplit(value)
    if (
        parts.scheme not in {"http", "https"}
        or not parts.netloc
        or parts.username is not None
        or parts.password is not None
    ):
        raise ValueError("Endpoint must be an absolute HTTP(S) URL")

    path = parts.path.rstrip("/")
    if path.endswith("/chat/completions"):
        final_path = path
    elif path.endswith("/v1"):
        final_path = f"{path}/chat/completions"
    else:
        final_path = f"{path}/v1/chat/completions"

    return urlunsplit((parts.scheme, parts.netloc, final_path, parts.query, ""))


def validate_event_id(event_id: str) -> str:
    """Validate one opaque Frigate event ID before URL construction."""
    value = event_id.strip()
    if not _EVENT_ID_PATTERN.fullmatch(value):
        raise ValueError("Invalid Frigate event ID")
    return value


def validate_go2rtc_url(url: str) -> str:
    """Validate a non-secret HTTP(S) URL that is safe to expose to the Card."""
    value = url.strip().rstrip("/")
    parts = urlsplit(value)
    if (
        parts.scheme not in {"http", "https"}
        or not parts.netloc
        or parts.username is not None
        or parts.password is not None
        or parts.query
        or parts.fragment
    ):
        raise ValueError("Invalid non-secret go2rtc URL")
    return value


def extract_response_text(payload: Any) -> str:
    """Extract text from an OpenAI-compatible response."""
    if not isinstance(payload, Mapping):
        return ""
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    choice = choices[0]
    if not isinstance(choice, Mapping):
        return ""
    message = choice.get("message")
    if not isinstance(message, Mapping):
        return ""
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, Mapping) and isinstance(item.get("text"), str):
                parts.append(item["text"].strip())
        return "\n".join(part for part in parts if part).strip()
    return ""


def event_description(event: Mapping[str, Any]) -> str:
    """Return Frigate's canonical event description."""
    data = event.get("data")
    if isinstance(data, Mapping) and isinstance(data.get("description"), str):
        return data["description"].strip()
    return ""


def sanitize_go2rtc_modes(value: str | None) -> str:
    """Normalize a go2rtc fallback list without inventing modes."""
    from .const import DEFAULT_GO2RTC_MODES, VALID_GO2RTC_MODES

    if not value:
        return DEFAULT_GO2RTC_MODES
    modes = [
        token.strip().lower()
        for token in value.split(",")
        if token.strip().lower() in VALID_GO2RTC_MODES
    ]
    return ",".join(dict.fromkeys(modes)) or DEFAULT_GO2RTC_MODES
