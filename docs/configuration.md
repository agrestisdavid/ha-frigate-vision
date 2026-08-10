# Configuration and providers

The config flow has two steps so it also renders reliably in older browser and
Companion App frontend paths.

## Step 1: Frigate instance

Choose one existing Frigate config entry from the dropdown. Frigate Vision
validates that the entry still exists and belongs to the `frigate` domain.
Only one Frigate Vision entry can be created for a given Frigate entry.

## Step 2: provider and analysis

| Setting | Purpose |
| --- | --- |
| Endpoint | OpenAI-compatible base URL or full Chat Completions URL |
| API key | Optional bearer credential sent only to the provider |
| Model | Provider-specific vision-capable model identifier |
| Still-image timeout | Maximum provider request duration for image analysis |
| Video-analysis timeout | Maximum provider request duration for video-frame analysis; default 180 seconds |
| Target width | Maximum image width sent to the provider |
| Event image source | Prefer recording/main stream or always use the detect snapshot |
| Recording readiness timeout | Wait before falling back to the detect snapshot |
| Token limit | Maximum response token count |
| Home Assistant Frigate proxy | Default authenticated live path; no URL required |
| Direct local go2rtc URL | Optional advanced/standalone override |
| Direct remote go2rtc URL | Optional advanced/standalone override; not required for normal remote HA access |
| Live transport modes | Ordered fallback list, starting with WebRTC and MSE |

An endpoint can be entered as either:

```text
https://vision.example.net/v1
```

or:

```text
https://vision.example.net/v1/chat/completions
```

The integration normalizes the first form to the second. URLs containing
embedded usernames or passwords are rejected.

## Multimodal request format

For still images, the provider receives a Chat Completions request with:

- one text prompt;
- one JPEG image as an `image_url` data URL;
- the configured model and token limit.

Frigate Vision converts the source to RGB JPEG and downsizes it only when it
exceeds the target width. Empty, oversized, decompression-bomb, and unsupported
image inputs are rejected before an HTTP request is made to the provider.
Smaller images are never enlarged. Aspect ratio is preserved, including for a
dual-lens camera that already provides one stitched ultra-wide panorama.

Video analysis sends chronologically ordered JPEG frames in the same
multimodal content array. Between 5 and 15 frames are sampled from Frigate
recordings at exactly 1 fps, reduced to at most 1080 pixels high, and labelled
relative to the best event frame. Width follows the source aspect ratio, so a
3840×2160 frame becomes 1920×1080 and a 5120×1552 panorama becomes
3563×1080. Frames at or below 1080 pixels high are never enlarged. The
complete serialized provider request is limited to 25 MB.

Still-image and video-frame requests have independent provider timeouts. The
defaults are 60 and 180 seconds respectively. Recording readiness waiting is
separate and occurs before the provider request.

## Options

Open the integration's options to change provider settings and optional direct
go2rtc overrides. Leave both go2rtc URL fields empty to use the authenticated
Home Assistant Frigate proxy. The same proxy is the default for local and
remote Home Assistant clients, so an external URL is normally unnecessary.

The local direct URL applies only to an internal client. An external client
uses the external direct URL when configured and otherwise uses the Home
Assistant proxy. It never falls back to the local URL.

The API key is stored in the Home Assistant config entry and is redacted from
diagnostics. The provider endpoint is also redacted because it may contain
private routing information.

Changing options reloads the Frigate Vision entry. In-flight event tasks are
bound to that entry and are cancelled during unload.

Existing entries created before 0.2.2 use compatibility defaults without a
migration: recording is preferred, recording readiness is 20 seconds, and the
still-image target width remains 1280 pixels. Existing entries also receive
the 180-second video timeout without a migration. Version 0.3.1 uses a fixed
maximum video-frame height of 1080 pixels.
