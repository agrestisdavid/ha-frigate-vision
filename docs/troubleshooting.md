# Troubleshooting

## Event is not available yet

Symptom: an automation fires immediately, while the Frigate REST event or
snapshot temporarily returns 404.

Frigate can publish `new`, `update`, and `end` MQTT messages for the same event,
and REST availability may trail the first message. Frigate Vision 0.2.0 retries
temporary event and snapshot failures for up to 20 seconds. If the deadline is
still exceeded, the provider is not called and Frigate is not changed.

## The model claims it cannot see the image

Check:

- the configured model is vision-capable;
- the endpoint implements OpenAI-compatible multimodal Chat Completions;
- the provider accepts `image_url` data URLs;
- the model identifier is exact.

Frigate Vision sends a JPEG in a multimodal content array. A text-only reply in
this situation usually indicates provider or model routing, not a missing
camera field.

## The Card says no clip exists

The message should appear only when Frigate reports `has_clip: false` or the
clip endpoint confirms HTTP 404/410. Historical or in-progress events may not
have a clip.

A timeout, network failure, or decoder failure has a different message. Do not
add a second event database to work around clip availability; verify the exact
Frigate event and retention policy.

## MP4 or HLS times out

A cold MP4 can remain in the loading state for up to 40 seconds. The HLS
fallback can take up to 60 seconds. Check Home Assistant's Frigate proxy,
Frigate Media Source, retention, reverse-proxy timeouts, and browser codec
support.

## The live tile is blank

Verify that `main` and `sub` match actual go2rtc stream names. A camera display
name and a stream key are not necessarily identical. Also verify the selected
transport order and remote WebRTC candidate setup.

## The Card is registered twice

Remove any old manual or HACS Lovelace resource that points to a separate
`frigate-vision-card.js`. Version 0.2.0 loads the Card from the integration.
After removal, restart Home Assistant and hard-refresh the browser.

Do not remove a resource belonging to a different legacy Card.

## Descriptions are missing on old events

Frigate Vision reads `event.data.description`. Historical descriptions stored
only in another integration's private timeline are not migrated. New active
analyses with `store: true` appear on the exact Frigate event after success.

## The config flow is empty

Version 0.2.0 uses a two-step flow with a normal dropdown instead of a
config-entry selector. Confirm the installed integration version, restart Home
Assistant, and reload the frontend. The first step aborts clearly when no
Frigate integration exists.
