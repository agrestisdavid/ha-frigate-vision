# Reference

## Service response fields

| Field | Type | Description |
| --- | --- | --- |
| `response_text` | string | Cached or newly generated description |
| `event_id` | string or null | Exact Frigate ID for event analysis |
| `key_frame` | string | Relative snapshot path or input source |
| `stored` | boolean | This caller completed a Frigate description write |
| `cached` | boolean | Existing Frigate description was used |
| `duration_ms` | integer | Total service duration |

## Card top-level options

| Option | Purpose |
| --- | --- |
| `title` | Card heading |
| `frigate_client_id` | Frigate proxy client ID |
| `frigate_url` | Optional standalone Frigate base URL |
| `go2rtc_url` | Optional internal override |
| `go2rtc_url_external` | Optional external override |
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

An optional `entry_id` selects a Frigate Vision entry when more than one is
loaded. The result contains:

```yaml
profile:
  go2rtc_url: https://go2rtc.internal.example
  go2rtc_url_external: https://go2rtc.example.net
  go2rtc_modes: webrtc,mse,mp4,hls,mjpeg
```

## Limits

- input image body: 25 MB;
- decoded image: 40 million pixels;
- provider response body: 1 MB;
- Frigate event metadata body: 2 MB;
- event readiness: 20 seconds;
- MP4 metadata wait: 40 seconds;
- HLS fallback wait: 60 seconds.
