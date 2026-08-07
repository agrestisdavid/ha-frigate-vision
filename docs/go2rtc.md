# Live streaming, go2rtc, and remote access

go2rtc remains the stream engine, but a normal Frigate Vision installation
does not require the browser to connect to go2rtc directly. The bundled Card
uses the authenticated, official Home Assistant Frigate proxy by default.

This default is the same when Home Assistant is opened on the local network or
through its normal remote URL. Do not configure a separate external go2rtc URL
just because a client is remote.

## Profile selection

The Card requests its non-secret central settings with the authenticated
`frigate_vision/profile` command.

- With exactly one loaded Frigate Vision config entry, Home Assistant resolves
  that entry automatically.
- With multiple entries, set `frigate_vision_entry_id` on each Card to the
  exact Frigate Vision config-entry ID.

```yaml
type: custom:frigate-vision-card
frigate_vision_entry_id: example-frigate-vision-entry
```

This value selects the Frigate Vision profile. It is not a Frigate event ID,
camera entity ID, or `frigate_client_id`.

## Default path

With both direct URL fields empty, the Card resolves the selected Frigate
instance through Home Assistant and uses its authenticated proxy. Provider
credentials are never part of this profile or any browser media URL.

Live playback starts in this order:

```text
webrtc,mse,mp4,hls,mjpeg
```

WebRTC is attempted first for both internal and external clients. During the
initial negotiation, receiving a signaling answer is not sufficient: the Card
reports success only after it receives a media track and ICE reaches
`connected` or `completed`. An initial failure or readiness timeout closes that
attempt and advances to MSE. This criterion applies to proxy WebSocket
signaling and to the advanced direct HTTP/WHIP path. The MSE signaling and
media path run completely through Home Assistant, so the browser does not need
direct network access to go2rtc for that initial fallback.

This is an initial connection guarantee. It does not promise that a WebRTC
stream which disconnects later will automatically switch to MSE.

In normal proxy mode, WebRTC and MSE are the available proxy transports. MP4,
HLS, and MJPEG stay in the ordered transport list for compatibility and are
attempted only when a direct advanced/standalone URL override is configured.

## WebRTC media connectivity

The Home Assistant proxy handles the request path, but it cannot relay the
peer-to-peer WebRTC media plane. WebRTC still requires:

- correct ICE candidates advertised by Frigate/go2rtc;
- a candidate address that the browser can reach;
- go2rtc's WebRTC media port `8555` to be reachable as required by the chosen
  network design.

For remote access, solve that reachability with an appropriate candidate, NAT,
VPN, or trusted reverse-proxy design. Frigate Vision does not configure a
public STUN service or bypass browser network policy. If these requirements are
not met, MSE remains available through Home Assistant.

## Advanced and standalone overrides

Direct URL fields are retained for compatibility and specialized deployments.
They are not required for the integrated HACS installation.

Resolution is intentionally separate for each network context:

- **Local/internal client:** explicit Card `go2rtc_url`, then the selected
  profile's `go2rtc_url`, then the authenticated Home Assistant Frigate proxy.
- **External client:** explicit Card `go2rtc_url_external`, then the selected
  profile's `go2rtc_url_external`, then the authenticated Home Assistant
  Frigate proxy.

An external client never falls back to `go2rtc_url` or a local `frigate_url`.
Leaving `go2rtc_url_external` empty therefore selects the Home Assistant proxy,
even when a local direct URL is configured.

An advanced standalone configuration can use reserved example hostnames:

```yaml
type: custom:frigate-vision-card
go2rtc_url: https://go2rtc.example.invalid
go2rtc_url_external: https://media.example.invalid
go2rtc_modes: webrtc,mse,mp4,hls,mjpeg
cameras:
  driveway:
    name: Driveway
    main: driveway_main
    sub: driveway_sub
```

Remove these direct URL options to return to proxy mode. Never embed
credentials, access tokens, query tokens, or private deployment addresses in a
dashboard configuration. Direct external access should be limited to a
deliberately secured deployment.

Changing the transport order does not invent or rename streams. Camera `main`
and `sub` values must match the actual go2rtc stream keys configured in
Frigate.
