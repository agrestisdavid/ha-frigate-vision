# go2rtc and remote access

go2rtc remains part of the Card. Frigate Vision centralizes its URLs only as an
optional convenience.

## Resolution order

The Card selects values in this order:

1. explicit Card override;
2. the authenticated `frigate_vision/profile` WebSocket response;
3. `frigate_url/api/go2rtc` compatibility fallback.

The profile exposes only non-secret go2rtc settings. It never exposes the
provider endpoint, API key, or model.

## Central configuration

Leave the internal URL empty to derive it from the selected Frigate config
entry. Configure an external URL only when remote clients cannot reach the
internal route.

Example standalone overrides:

```yaml
type: custom:frigate-vision-card
frigate_url: https://frigate.example.net
go2rtc_url: https://go2rtc.internal.example
go2rtc_url_external: https://go2rtc.example.net
go2rtc_modes: webrtc,mse,mp4,hls,mjpeg
cameras:
  driveway:
    name: Driveway
    main: driveway_main
    sub: driveway_sub
```

URLs with embedded credentials, query strings, or fragments are rejected by
the integration profile. Prefer an authenticated reverse proxy and HTTPS for
external access.

## Transport fallbacks

The default order is:

```text
webrtc,mse,mp4,hls,mjpeg
```

Changing the order does not invent or rename streams. A common cause of a
blank live tile is using the camera name where Frigate actually defines
separate stream keys such as `driveway_main` and `driveway_sub`.

Remote WebRTC may also require correct ICE and candidate configuration in
go2rtc or the surrounding proxy. Frigate Vision does not bypass those network
requirements. The Card does not contact a public STUN service; it uses browser
and go2rtc candidates, then continues through MSE, MP4, HLS, and MJPEG when
WebRTC cannot connect.
