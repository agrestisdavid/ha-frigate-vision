# Card, events, and clips

The bundled Card type is:

```yaml
type: custom:frigate-vision-card
```

Its custom elements are unique:

- `frigate-vision-card`
- `frigate-vision-card-editor`
- `frigate-vision-live-tile`

They can coexist with a different Frigate timeline Card on the same dashboard.
The Card responds only to its own deep link:

```text
#frigate_vision_clip=example-event-id
```

## Event metadata

The Card uses exact Frigate event IDs. It directly consumes embedded Media
Source metadata when available:

- event ID;
- `data.description`;
- `has_clip`;
- camera and label;
- start and end timestamps.

There is no fuzzy time matcher and no local event database.

Description priority is:

1. review scene metadata;
2. review summary metadata;
3. `event.data.description`.

Historical events analyzed only by another integration may therefore have no
description in this Card. Version 0.2.0 intentionally performs no backfill.

## Titles

Titles are derived locally and are not sent to or stored in Frigate:

```text
<Detection> in <Camera> wurde erkannt
```

Known labels are translated, for example `person` to `Person` and `dog` to
`Hund`. Unknown labels are converted to readable title case. AI descriptions,
review titles, and sub-labels do not change the title.

## Clip playback order

The Card attempts:

1. direct event MP4 through the authenticated Home Assistant Frigate proxy;
2. resolved HLS from Home Assistant Media Source;
3. a bounded event recording as MP4.

MP4 metadata may take up to 40 seconds to become ready. HLS receives up to 60
seconds when used as a fallback. A race token prevents an older load from
overwriting a newly selected event.

Unsigned Home Assistant media paths are signed with `auth/sign_path`. Raw Home
Assistant access tokens are not appended to media URLs or written to console
logs.

“No clip” is shown only for confirmed `has_clip: false` or HTTP 404/410.
Network, timeout, and decoder failures have separate messages.

## Live view

The live tile retains WebRTC, MSE, MP4, HLS, and MJPEG transports, HD/SD
switching, multiview, clips, and the VoD timeline. Stream names must match the
actual go2rtc stream keys configured in Frigate.
