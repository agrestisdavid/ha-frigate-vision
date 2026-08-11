# Frigate Vision

Frigate Vision combines three components in one Home Assistant HACS package:

- a custom integration that analyzes exact Frigate recording frames or
  1-fps event sequences with an
  OpenAI-compatible multimodal endpoint;
- the automatically loaded `custom:frigate-vision-card` for events, clips,
  recordings, reviews, and go2rtc live streams;
- a reusable notification Blueprint with shadow and active modes.

Frigate is the canonical store. Frigate Vision does not maintain a second
timeline database. A successful event analysis can be written to the exact
Frigate event as `data.description`, while clips and event metadata continue
to come from Frigate.

## What version 0.3.x provides

Event creation and REST availability are not always simultaneous. The
integration therefore waits for a recording/main-stream frame, then tries a
clean event snapshot before the normal annotated snapshot. The video service
samples a fixed recording window at 1 fps and falls back to one fresh image if
that complete window is unavailable. Provider calls and Frigate writes are
never retried automatically.

The Card is bundled with the integration and registered as a versioned
frontend module. A separate HACS dashboard package or manual Lovelace resource
is not required.

Live streams use the authenticated Home Assistant Frigate proxy by default for
both local and remote clients. WebRTC is tried first and MSE is the first
fallback. Direct go2rtc URLs are optional advanced/standalone overrides, not a
normal installation requirement.

The notification Blueprint processes allowed events sequentially. Notification
mute and cooldown settings do not suppress analysis.

## Design boundaries

- No hard-coded hosts, IP addresses, provider IDs, or credentials.
- No `/api/llmvision` requests.
- No migration or backfill of historical descriptions.
- No AI-generated title storage. Titles are derived locally from the Frigate
  label and camera name.
- No change to an existing LLM Vision installation, Card, or automation.

Continue with [Getting started](getting-started.md).
