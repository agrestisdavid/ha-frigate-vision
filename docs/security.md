# Privacy and security

## Data flow

For event analysis, Home Assistant reads the exact Frigate event and snapshot,
converts the image to JPEG, and sends the image plus prompt to the configured
provider. If requested, the returned text is written to that exact Frigate
event.

Choose a provider and retention policy appropriate for the sensitivity of
camera images. Frigate Vision does not make a provider private merely because
it exposes an OpenAI-compatible API.

## Secrets

- Provider credentials stay in the Home Assistant config entry.
- The API key and endpoint are redacted from diagnostics.
- The Card profile exposes no provider fields.
- Raw Home Assistant access tokens are not placed in media URLs or logs.
- go2rtc profile URLs must not contain embedded credentials or query tokens.

Never post config-entry storage, diagnostics from unrelated integrations, or
browser network exports without checking them for secrets.

## Local files

`analyze_image` accepts a local file only when its resolved path is permitted
by `allowlist_external_dirs`. Symbolic and relative path components are
resolved before the allowlist check.

## Browser assets

The documentation site uses system fonts, built-in search, and Material's
privacy plugin. It includes no analytics, comments, remote scripts, or
unreviewed remote images.

The Card bundles the pinned LitElement, lit-html, and hls.js runtimes inside
the integration. It makes no CDN request and configures no public STUN server.
The build manifest, checksums, versions, and complete license texts ship next
to those files.

Browser media requests still go to Home Assistant and to the go2rtc endpoints
that the administrator configured. WebRTC uses candidates supplied by the
browser and go2rtc; if that path is unavailable, the configured MSE, MP4, HLS,
and MJPEG fallbacks remain available.

## Network exposure

Use HTTPS and authenticated reverse proxies for remote Frigate or go2rtc
access. Do not expose Frigate, go2rtc, or a model endpoint directly to the
internet solely for Card convenience.
