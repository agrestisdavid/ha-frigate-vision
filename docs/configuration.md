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
| Timeout | Maximum provider request duration |
| Target width | Maximum image width sent to the provider |
| Token limit | Maximum response token count |
| Internal go2rtc URL | Optional central URL for local clients |
| External go2rtc URL | Optional central URL for remote clients |
| go2rtc modes | Ordered transport fallback list |

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

The provider receives a Chat Completions request with:

- one text prompt;
- one JPEG image as an `image_url` data URL;
- the configured model and token limit.

Frigate Vision converts the source to RGB JPEG and downsizes it only when it
exceeds the target width. Empty, oversized, decompression-bomb, and unsupported
image inputs are rejected before an HTTP request is made to the provider.

## Options

Open the integration's options to change provider and go2rtc settings. The API
key is stored in the Home Assistant config entry and is redacted from
diagnostics. The provider endpoint is also redacted because it may contain
private routing information.

Changing options reloads the Frigate Vision entry. In-flight event tasks are
bound to that entry and are cancelled during unload.
