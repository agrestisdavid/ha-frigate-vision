"""Constants for Frigate Vision."""

from __future__ import annotations

DOMAIN = "frigate_vision"
VERSION = "0.2.0"

FRONTEND_URL_BASE = "/frigate_vision/frontend"
FRONTEND_MODULE = "frigate-vision-card.js"

CONF_FRIGATE_ENTRY_ID = "frigate_entry_id"
CONF_ENDPOINT = "endpoint"
CONF_API_KEY = "api_key"
CONF_MODEL = "model"
CONF_TIMEOUT = "timeout"
CONF_TARGET_WIDTH = "target_width"
CONF_MAX_TOKENS = "max_tokens"
CONF_GO2RTC_URL = "go2rtc_url"
CONF_GO2RTC_URL_EXTERNAL = "go2rtc_url_external"
CONF_GO2RTC_MODES = "go2rtc_modes"

DEFAULT_TIMEOUT = 60
DEFAULT_TARGET_WIDTH = 1280
DEFAULT_MAX_TOKENS = 500
DEFAULT_GO2RTC_MODES = "webrtc,mse,mp4,hls,mjpeg"
DEFAULT_PROMPT = (
    "Beschreibe knapp und sachlich, was im Bild geschieht. "
    "Nenne relevante Personen, Fahrzeuge, Tiere und Handlungen. "
    "Spekuliere nicht über nicht sichtbare Details."
)

SERVICE_ANALYZE_EVENT = "analyze_event"
SERVICE_ANALYZE_IMAGE = "analyze_image"

ATTR_RUNTIME_ENTRIES = "entries"
ATTR_SERVICES_REGISTERED = "services_registered"
ATTR_WS_REGISTERED = "ws_registered"
ATTR_FRONTEND_REGISTERED = "frontend_registered"

ATTR_FRIGATE_CLIENT = "client"
ATTR_FRIGATE_CONFIG = "config"
FRIGATE_DOMAIN = "frigate"

VALID_GO2RTC_MODES = frozenset({"webrtc", "mse", "mp4", "hls", "mjpeg"})
MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024
