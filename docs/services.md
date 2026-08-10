# Services

Both services return response data and can be used with
`response_variable` in Home Assistant actions.

## `frigate_vision.analyze_event`

Analyze one exact Frigate event. The configured default prefers a
recording/main-stream frame and falls back to the detect event snapshot.

```yaml
action: frigate_vision.analyze_event
data:
  event_id: example-event-id
  camera_entity: camera.driveway
  prompt: >-
    Describe only what is visibly happening in one short sentence.
  store: true
  force: false
response_variable: analysis
```

Inputs:

| Field | Required | Meaning |
| --- | --- | --- |
| `event_id` | yes | Exact Frigate event ID |
| `camera_entity` | no | Frigate camera used for routing and key-frame URL |
| `entry_id` | no | Frigate Vision config entry when more than one exists |
| `prompt` | no | Analysis instruction |
| `store` | no | Store a successful new description in Frigate |
| `force` | no | Ignore an existing description and analyze again |

When `force` is false, the event is re-read on every readiness attempt. If a
description appears, it is returned as a cache hit without a model call.

The frame time is selected from `data.snapshot_frame_time`, then
`data.frame_time`, then `start_time`. Recording readiness uses the configured
timeout, 20 seconds by default. HTTP 404, 408, 425, 429, 5xx, connection
errors, timeouts, and empty images are retried. After that deadline, the detect
snapshot gets a separate five-second fallback window. Authentication failures
never fall back silently.

Provider errors are not retried, including 401, 500, timeout, invalid JSON, and
empty model output. This prevents duplicate model cost. Frigate is written
once only after a non-empty response.

Concurrent non-forced calls for the same event share one analysis. Concurrent
callers requesting storage also share one description write.

## `frigate_vision.analyze_image`

Analyze one explicitly allowed still-image source:

```yaml
action: frigate_vision.analyze_image
data:
  image_entity: camera.driveway
  prompt: Describe the visible scene.
response_variable: analysis
```

Provide exactly one of:

- `image_entity`: a `camera.*` or `image.*` entity;
- `media_source`: a Home Assistant `media-source://` item;
- `file_path`: a local image below `allowlist_external_dirs`.

Arbitrary remote image URLs are intentionally unsupported.

## Response

```yaml
response_text: "A person walks toward the entrance."
event_id: example-event-id
key_frame: /api/frigate/frigate/notifications/example-event-id/snapshot.jpg
stored: true
cached: false
image_source: recording
source_frame_time: 1720000000.125
duration_ms: 1842
```

For `analyze_image`, `event_id` is `null` and `stored` is always false.
`duration_ms` includes source-readiness waiting for event analysis.
A cached event result has `image_source: null`, because no image was read.
`key_frame` remains the authenticated notification snapshot URL and is not a
claim about the bytes that were analyzed.
