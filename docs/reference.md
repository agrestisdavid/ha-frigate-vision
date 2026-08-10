# Reference

## Service response fields

| Field | Type | Description |
| --- | --- | --- |
| `response_text` | string | Cached or newly generated description |
| `event_id` | string or null | Exact Frigate ID for event analysis |
| `key_frame` | string | Relative snapshot path or input source |
| `stored` | boolean | This caller completed a Frigate description write |
| `cached` | boolean | Existing Frigate description was used |
| `image_source` | string or null | Actual source: `recording`, `event_snapshot`, or null for a cache hit |
| `source_frame_time` | number or null | Frigate timestamp selected for analysis |
| `media_type` | string | Video service only: `video_frames` or `image_fallback` |
| `frame_count` | integer | Video service only: analyzed frame count |
| `window_start` | number or null | Video service recording-window start |
| `window_end` | number or null | Video service recording-window end (exclusive) |
| `duration_ms` | integer | Total service duration |

## Card top-level options

| Option | Purpose |
| --- | --- |
| `title` | Card heading |
| `frigate_vision_entry_id` | Optional Frigate Vision config-entry ID; required for deterministic profile selection with multiple entries |
| `frigate_client_id` | Frigate proxy client ID |
| `frigate_url` | Optional advanced standalone Frigate base URL |
| `go2rtc_url` | Optional direct local go2rtc override |
| `go2rtc_url_external` | Optional direct remote go2rtc override; not required with the HA proxy |
| `go2rtc_modes` | Ordered transport list |
| `cameras` | Camera display names and stream keys |
| `initial_events` | Initial event count |
| `events_per_load` | Pagination size |
| `auto_refresh_seconds` | Event refresh interval; zero disables it |

Each camera supports a display `name`, `main` stream, and optional `sub`
stream. Stream values are go2rtc keys, not Home Assistant entity IDs.

## Frontend profile

The authenticated WebSocket command is:

```text
frigate_vision/profile
```

The Card sends `frigate_vision_entry_id` as the command's optional `entry_id`.
One loaded entry is resolved automatically. With multiple loaded entries,
configure the Card field explicitly so Home Assistant can select the intended
profile. The result contains:

```yaml
profile:
  frigate_client_id: frigate
  go2rtc_url: null
  go2rtc_url_external: null
  go2rtc_modes: webrtc,mse,mp4,hls,mjpeg
```

Null direct URLs select the authenticated Home Assistant Frigate proxy. This
is the recommended default for internal and external Home Assistant clients.
Non-null URLs are optional advanced/standalone overrides and never contain
provider credentials.

WebRTC is attempted first. Its media plane still relies on reachable ICE
candidates and go2rtc port `8555`. During initial negotiation, WebRTC succeeds
only after both a media track and a connected/completed ICE state. An initial
failure or readiness timeout advances to MSE, which runs entirely through Home
Assistant. This gate also applies to direct HTTP/WHIP; it does not promise an
automatic MSE switch after a later disconnect. MP4, HLS, and MJPEG live
transports require an explicit direct URL override.

`go2rtc_url` is used only for a local/internal client. An external client uses
`go2rtc_url_external` when present and otherwise uses the Home Assistant proxy.
There is no external fallback to the local direct URL.

## Limits

- input image body: 25 MB;
- serialized video provider request, including Base64 and JSON: 25 MB total;
- decoded image: 40 million pixels;
- provider response body: 1 MB;
- Frigate event metadata body: 2 MB;
- recording readiness: configurable 0–30 seconds, default 20;
- detect snapshot fallback: 5 seconds;
- still-image provider timeout: configurable, default 60 seconds;
- video-frame provider timeout: configurable, default 180 seconds;
- event video: 5–15 one-frame-per-second frames, at most 1080 pixels high;
- MP4 metadata wait: 40 seconds;
- HLS fallback wait: 60 seconds.
