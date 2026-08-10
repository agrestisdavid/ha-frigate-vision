# Architecture

## Package layout

The public repository is one HACS integration:

```text
custom_components/frigate_vision/   Integration and bundled Card
blueprints/automation/              Notification Blueprint
docs/                               Material for MkDocs source
tests/                              Python and Card tests
.github/workflows/                  Validation and Pages deployment
```

The Card runtime is served from
`custom_components/frigate_vision/frontend/frigate-vision-card.js`. The
integration registers a versioned Home Assistant module URL once per process.

## Event analysis pipeline

1. Validate the opaque event ID.
2. Join or create the event-scoped analysis task.
3. Read event metadata directly with Frigate authentication.
4. Return a newly visible cached description when `force` is false.
5. Read the recording frame at the preferred event timestamp, or use the
   detect snapshot after the recording deadline.
6. Call the provider once.
7. Join or create one event-scoped description write when requested.
8. Return the shared result with caller-specific duration and storage status.

Temporary source errors remain inside steps 3–5. Provider and write failures
are outside the retry loop.

Analysis and write tasks are attached to the Frigate Vision config entry so a
reload or unload cancels work that still references its runtime.

Video analysis has a separate single-flight key containing event ID, camera,
prompt, duration, and pre-roll. It captures one fixed event timestamp, samples
the recording at 1 fps with at most three Frigate extraction requests in
parallel, immediately limits each frame to 1080 pixels high, and keeps
successful frames while retrying only missing ones. The provider receives all
ordered frames in one request. No video or image is written to a temporary
file.

## Storage model

Frigate owns:

- event metadata;
- snapshots and clips;
- reviews and recordings;
- successful AI descriptions.

Home Assistant owns:

- integration configuration and provider credentials;
- Card and Blueprint configuration;
- optional timer and mute helpers.

Frigate Vision owns no timeline database. Generic titles are calculated at
display or notification time and are never stored.

## Live media paths

The bundled Card selects the authenticated Home Assistant Frigate proxy when
no direct override is configured. This is the standard path for local and
remote Home Assistant clients.

WebRTC signaling starts through the configured Home Assistant path, while the
WebRTC media plane connects using ICE candidates advertised by Frigate/go2rtc.
The selected candidate and media port `8555` must therefore remain reachable.
During initial negotiation, the Card accepts the attempt only after a media
track is present and ICE is connected/completed. An initial failure or
readiness timeout advances to MSE, which carries signaling and media completely
through Home Assistant. The same initial readiness gate applies to direct
HTTP/WHIP. A later disconnect of an already accepted WebRTC stream does not
carry an automatic MSE-fallback guarantee. Later direct MP4, HLS, and MJPEG
fallbacks are available only when an advanced direct override is configured.

Direct Frigate or go2rtc URLs remain compatibility options for advanced and
standalone deployments. They are not required by the integrated HACS package.
Local and external direct URLs are resolved independently; an external client
never inherits the local direct URL.

The authenticated profile command resolves a sole Frigate Vision config entry
automatically. A Card in a multi-entry installation supplies
`frigate_vision_entry_id`, which is forwarded as the profile command's
`entry_id`.

## Mixed operation

The `frigate_vision` domain, Card elements, frontend route, deep-link key, and
notification tags are independent. An existing LLM Vision integration and
legacy Card can remain installed indefinitely.
