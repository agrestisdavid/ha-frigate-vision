"""Constants for Frigate Vision."""

from __future__ import annotations

DOMAIN = "frigate_vision"
VERSION = "0.3.5"

FRONTEND_URL_BASE = "/frigate_vision/frontend"
FRONTEND_MODULE = "frigate-vision-card.js"

CONF_FRIGATE_ENTRY_ID = "frigate_entry_id"
CONF_ENDPOINT = "endpoint"
CONF_API_KEY = "api_key"
CONF_MODEL = "model"
CONF_TIMEOUT = "timeout"
CONF_VIDEO_TIMEOUT = "video_timeout"
CONF_TARGET_WIDTH = "target_width"
CONF_MAX_TOKENS = "max_tokens"
CONF_EVENT_IMAGE_SOURCE = "event_image_source"
CONF_RECORDING_WAIT_TIMEOUT = "recording_wait_timeout"
CONF_GO2RTC_URL = "go2rtc_url"
CONF_GO2RTC_URL_EXTERNAL = "go2rtc_url_external"
CONF_GO2RTC_MODES = "go2rtc_modes"

DEFAULT_TIMEOUT = 60
DEFAULT_VIDEO_TIMEOUT = 180
DEFAULT_TARGET_WIDTH = 1280
DEFAULT_VIDEO_TARGET_HEIGHT = 1080
DEFAULT_MAX_TOKENS = 500
DEFAULT_EVENT_IMAGE_SOURCE = "recording_preferred"
DEFAULT_RECORDING_WAIT_TIMEOUT = 20
DEFAULT_GO2RTC_MODES = "webrtc,mse,mp4,hls,mjpeg"
DEFAULT_PROMPT = (
    "Beschreibe knapp und sachlich, was im Bild geschieht. "
    "Nenne relevante Personen, Fahrzeuge, Tiere und Handlungen. "
    "Spekuliere nicht über nicht sichtbare Details."
)
DEFAULT_VIDEO_PROMPT = (
    "Beschreibe knapp und sachlich, was in dieser zeitlich geordneten "
    "Bildsequenz geschieht. Nenne relevante Personen, Fahrzeuge, Tiere, "
    "Handlungen und Bewegungsabläufe. Spekuliere nicht über nicht sichtbare "
    "Details."
)

EVENT_IMAGE_SOURCE_RECORDING = "recording_preferred"
EVENT_IMAGE_SOURCE_SNAPSHOT = "event_snapshot"
IMAGE_SOURCE_RECORDING = "recording"
IMAGE_SOURCE_EVENT_SNAPSHOT = "event_snapshot"
VALID_EVENT_IMAGE_SOURCES = frozenset(
    {EVENT_IMAGE_SOURCE_RECORDING, EVENT_IMAGE_SOURCE_SNAPSHOT}
)

DEFAULT_VIDEO_DURATION = 15
DEFAULT_VIDEO_PRE_SECONDS = 5
MIN_VIDEO_DURATION = 5
MAX_VIDEO_DURATION = 15

SERVICE_ANALYZE_EVENT = "analyze_event"
SERVICE_ANALYZE_EVENT_VIDEO = "analyze_event_video"
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
MAX_VIDEO_PAYLOAD_BYTES = 25 * 1024 * 1024
MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024
