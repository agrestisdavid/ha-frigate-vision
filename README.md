# Frigate Vision

Frigate Vision is a Home Assistant custom integration for analyzing exact
Frigate event recording frames with an OpenAI-compatible multimodal endpoint.
The single HACS package also ships the `custom:frigate-vision-card` frontend
module and a reusable notification Blueprint.

Version `0.2.2` is deliberately independent of LLM Vision:

- Frigate remains the canonical source for events, clips, and descriptions.
- Recording/main-stream frames are preferred and the detect event snapshot is
  used as a fallback after the configurable readiness window.
- Concurrent requests for the same event share one model analysis.
- Descriptions are written only after a successful, non-empty model response.
- The bundled Card has its own custom elements and deep-link key.
- No provider credentials, fixed hosts, or private addresses are embedded in
  the Card or Blueprint.

## Installation with HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=agrestisdavid&repository=ha-frigate-vision&category=integration)

1. Use the button above, or add `agrestisdavid/ha-frigate-vision` to HACS
   manually as a custom repository with category **Integration**.
2. Download Frigate Vision and restart Home Assistant.
3. Open **Settings → Devices & services → Add integration**, search for
   **Frigate Vision**, and complete the two-step config flow.
4. Add a Manual card with `type: custom:frigate-vision-card`. No separate
   Lovelace resource is required.

If a split Frigate Vision 0.1.x test Card was installed previously, remove only
that separate Lovelace resource before loading 0.2.x. Do not remove an LLM
Vision or legacy timeline Card resource.

The config flow first selects an existing Frigate config entry, then asks for
the OpenAI-compatible endpoint, API key, model, analysis limits, and optional
advanced go2rtc overrides. Leave both direct go2rtc URL fields empty to use the
authenticated Home Assistant Frigate proxy, which is the default for local and
remote Home Assistant access.

## Live streaming

The bundled Card tries WebRTC first and falls back to MSE before continuing
through the remaining configured transports. A separate external go2rtc URL is
not required when the Card is opened through Home Assistant.

WebRTC signaling uses the Home Assistant path, but its media connection still
depends on reachable ICE candidates and go2rtc's WebRTC port `8555`. During
initial negotiation, a signaling answer alone is not considered success: the
Card waits for a media track and a connected/completed ICE state. An initial
failure or readiness timeout cleans up that attempt and falls back to MSE,
whose complete media path runs through Home Assistant.

Direct internal or external go2rtc URLs remain available only as advanced
overrides for trusted reverse-proxy or standalone deployments. The direct MP4,
HLS, and MJPEG transports are used only with such an override; proxy mode uses
WebRTC followed by MSE. `go2rtc_url` applies only to local clients. An external
client uses `go2rtc_url_external` when explicitly configured and otherwise
uses the Home Assistant proxy; it never falls back to the local direct URL.

With one Frigate Vision config entry, the Card selects its central profile
automatically. With multiple entries, set `frigate_vision_entry_id` on each
Card to the exact Frigate Vision config-entry ID. Existing LLM Vision
integrations, Cards, and automations remain independent and can continue
running in parallel.

## Services

`frigate_vision.analyze_event` analyzes the recording/main-stream frame at the
best timestamp of an exact Frigate event ID and falls back to its detect
snapshot. With `store: true`, a successful description is stored on that
event. Existing descriptions are returned as cache hits unless `force: true`
is requested.

`frigate_vision.analyze_image` analyzes exactly one camera/image entity, Home
Assistant Media Source, or allowlisted local image file. Arbitrary remote image
URLs are intentionally rejected.

Both services return response data:

```yaml
response_text: "A person walks toward the entrance."
event_id: "example-event-id"
key_frame: "/api/frigate/example/notifications/example-event-id/snapshot.jpg"
stored: true
cached: false
image_source: recording
source_frame_time: 1720000000.125
duration_ms: 1842
```

## Notification Blueprint

[![Open your Home Assistant instance and show the Blueprint import dialog with the Frigate Vision Blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fagrestisdavid%2Fha-frigate-vision%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Ffrigate_vision%2Fevent_notification.yaml)

The Blueprint is located at
[`blueprints/automation/frigate_vision/event_notification.yaml`](https://github.com/agrestisdavid/ha-frigate-vision/blob/main/blueprints/automation/frigate_vision/event_notification.yaml).
Importing it does not create an automation. Its default `shadow` mode analyzes
without notifications or Frigate writes.

In `active` mode, allowed events are analyzed sequentially. Mute and cooldown
settings suppress only notifications; analysis continues. A dedicated
restoring timer helper is required when the notification cooldown is greater
than zero.

## Documentation

The complete installation, configuration, Card, Blueprint, service reference,
troubleshooting, security, architecture, and development documentation is
published at:

<https://agrestisdavid.github.io/ha-frigate-vision/>

## Development

```powershell
python -m compileall custom_components
python -m ruff check custom_components tests
python -m ruff format --check custom_components tests
python -m unittest discover -s tests -p "test_*.py" -v
npm run verify
python -m mkdocs build --strict
```

## License

Frigate Vision is licensed under the [MIT License](LICENSE). Third-party
runtime notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
