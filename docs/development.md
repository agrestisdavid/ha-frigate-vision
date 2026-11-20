# Development and releases

## Local checks

Use Python 3.12 and Node.js 24 to match CI. Create a local environment and
install the development and documentation lock files. On Windows, use the
Python launcher below, or the explicit path to a Python 3.12 executable if it
is not registered with the launcher:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pip install -r requirements-docs.txt
```

Run:

```powershell
.\.venv\Scripts\python.exe -m compileall custom_components
.\.venv\Scripts\python.exe -m ruff check custom_components scripts tests
.\.venv\Scripts\python.exe -m ruff format --check custom_components scripts tests
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
npm ci
npx playwright install chromium
npm run verify
.\.venv\Scripts\python.exe -m mkdocs build --strict
.\.venv\Scripts\python.exe tests\check_built_docs.py site
```

`npm ci` installs Playwright but does not install its browser executable.
The Chromium installation is required before `npm run verify`; do not skip the
browser test when the executable is missing. On Linux, use
`npx playwright install --with-deps chromium` when browser system libraries
also need installing. Run `npm run test:browser` for the browser test alone.
For an isolated fresh-browser check, set `PLAYWRIGHT_BROWSERS_PATH` to a new
empty directory for both the install and verification commands.

The Python suite includes `tests/test_blueprint_runtime.py`, which parses the
actual Blueprint YAML, substitutes its inputs, and executes its Jinja and action
branches with deterministic, simulated state/services. It covers all alarm
states, interval changes, restored timestamp state, queue timing, failed helpers,
and legacy notification behavior. These are local simulations, not production
Home Assistant or mobile-push tests. Jinja2 and PyYAML are explicit development
dependencies so this coverage also runs in the isolated Python CI job.

Pull requests run Python, JavaScript, HACS, hassfest, and strict documentation
validation. Actions are referenced by immutable commit SHA. Dependabot watches
GitHub Actions, Python dependencies and npm build dependencies.

### Optional: test against real Home Assistant Core

After changing setup, services or Card registration, and before a release, start
a **local Linux Docker engine** (Docker Desktop on Windows) and run from the checkout:

```sh
python scripts/test_ha_container.py
```

The first run pulls the official Home Assistant **2026.11.2** image from GHCR;
its digest is pinned in the script. Subsequent runs can use the cache offline.
No Compose project, HA credentials or host port is needed. The runner refuses
remote Docker endpoints. Each run gets a new container with networking disabled,
a disposable `/config` in RAM and read-only mounts for the integration and test
fixtures. HA's real mDNS resolver is bound to loopback because there is no
multicast route; the synthetic Frigate and model endpoints also live on loopback.

The test uses HA's config flow, fetches the registered versioned Card over
HTTP and compares the served bytes to the bundled file. It requests camera
stream suggestions over a real authenticated HA WebSocket, once as a read-only
user and once as a user without entity access, using only synthetic aliases. It then calls
`frigate_vision.analyze_event` on a generated image; the model fixture checks
the actual JPEG and prompt before replying. Unloading the last entry must remove
all three services. After setting up that entry again, the same checks must
pass without duplicate registrations. This tests **one Core version**, not
HACS installation, real Frigate, model quality, hardware or browser rendering.
Use the Chromium suite separately for the Card UI.

Success, test failure, interruption or the run deadline (120 seconds by default;
`--timeout SECONDS` to adjust) cleans up this run's container and configuration.
The image stays cached. The runner does not start or stop Docker Desktop or
other containers. The fast unit/browser suites and PR checks do not require this
container run.

### Verify two-way audio without a physical camera

Run `npm ci`, then `python scripts/test_ha_container.py --audio` on a local Linux
Docker engine with support for isolated bridge gateway mode. This mode uses the
same disposable HA Core fixture plus the pinned Playwright browser image. It
creates a temporary **internal** bridge for WebRTC ICE, publishes no ports,
and removes the containers and network afterwards. After the images and npm
packages are cached, the test runs offline. No host audio device is mounted.

The real live tile asks HA to sign the selected stream path. A test view stands
in for Frigate's WebSocket proxy and forwards signaling to the real go2rtc in
the HA image; the unsigned request must return 401. FFmpeg supplies video and a
440 Hz camera tone. Chromium measures that tone in the received audio track,
then captures a different, generated 880 Hz WAV via `getUserMedia`. The camera
fixture measures decoded G.711 samples at its simulated speaker. The test fails
if either tone is missing, the two frequencies are confused, or new speaker
samples arrive after stopping. It repeats click-to-talk and hold-to-talk with
both HA-proxy playback and a profile-matched direct playback URL. In all four
cases the browser must send the microphone offer on the same-origin signed HA
WebSocket for the playing alias. Direct microphone signaling fails the test.
Neither an SDP answer nor a track count is accepted as audio evidence.

Example local acceptance run (HA Core 2026.11.2, go2rtc 1.9.15):

| Playback | Control | Camera → browser (440 Hz source, FFT peak) | Browser → camera (880 Hz amplitude) | New speaker samples after stop¹ |
| --- | --- | --- | --- | --- |
| HA proxy | Tap to start/stop | 441 Hz | 0.353 | 0 |
| HA proxy | Hold/release | 441 Hz | 0.342 | 0 |
| Direct override | Tap to start/stop | 441 Hz | 0.342 | 0 |
| Direct override | Hold/release | 441 Hz | 0.342 | 0 |

¹ Measured over 1.2 s after allowing 0.6 s for in-flight audio. FFT binning
accounts for 441 Hz rather than exactly 440 Hz. This verifies the Card and
media path with synthetic endpoints, not a physical camera or loudspeaker.

The same run checks a doorbell call in the single player (HA proxy) and a
live tile (profile-matched direct playback). A separate fixture user controls
`input_boolean.besucher` only in the disposable HA. The read-only browser gets
real HA `state_changed` events. It must not ring on initial `on`, an attribute
update, or `unavailable` recovery. The test checks that the local ringtone
plays in Chromium without reaching go2rtc, then selects each German reply,
measures decoded speech at the synthetic speaker and asserts zero microphone
requests. Answering must carry the simulated voice input, and hanging up must
end its track. Ending an announcement early must also stop its generated track
and the flow of audio samples to the synthetic speaker. The video element,
media stream and receiving WebRTC peer must stay identical while decoded frames
keep advancing. The fast Chromium suite also covers blocked ringtone autoplay,
reconnect and a late grant after detach, and checks the Close/Cancel/End button
with desktop clicks and narrow touchscreen taps while the reply menu is open,
while stream verification, permission or WebRTC setup are pending, and after
verification, permission or backchannel errors. The Doorbell-only view also
runs inside a native test dialog mounted after the HA edge. It must present
the recent call without requesting capture, resize without replacing the
receive peer, and never query events or recordings. Fast tests verify normal
panel startup, popup replay rejection and capture cleanup on hide or detach.

## Bundled browser and brand assets

The small files in `frontend/doorbell/` are standalone audio assets served by
Home Assistant. `wait.flac` and `leave.flac` are speech rendered offline with
[eSpeak NG](https://github.com/espeak-ng/espeak-ng) 1.51 (`-v de -s 150 -w …`,
texts `Einen Moment bitte.` and `Bitte vor der Tür abstellen.` respectively).
The output is mono FLAC at 16 kHz with 250 ms of trailing silence. `ring.flac`
is a locally synthesized two-tone chime (660 Hz, then 523.25 Hz). No speech
engine or cloud TTS connection is needed at runtime.

The released Card never fetches JavaScript from a CDN. Rebuild the pinned
browser bundles and their checksum manifest with:

```powershell
npm ci
npm run build:vendor
npm run check:vendor
```

`npm run verify` fails if the committed vendor files no longer match the
exact dependency versions in `package-lock.json`.

The local integration icons are generated from the approved violet winged-eye
artwork in `assets/brand/frigate-vision.png`. Keep that square, full-resolution
PNG as the source. The pinned `sharp` development dependency produces the
256-pixel `icon.png` and 512-pixel `icon@2x.png` in
`custom_components/frigate_vision/brand/`.

The same build also exports the integration logos, local documentation logo
and favicon, and `assets/brand/social-preview.png` for GitHub's social preview.

```powershell
npm run build:brand
npm run check:brand
```

Commit the source and all generated brand images together. `check:brand` detects
outputs that no longer match the source; it does not rewrite them.

## Documentation dependencies

`requirements-docs.in` contains the direct Material for MkDocs requirement:

```text
mkdocs-material==9.8.1
```

`requirements-docs.txt` records the complete tested environment. Regenerate it
in a clean Python 3.12 virtual environment, review every version change, and
confirm `mkdocs build --strict`.

Material for MkDocs is in maintenance mode, so upgrades should be deliberate.
Version 9.8.1 is pinned for the security-fixed release line. Its Python 3.11
minimum is satisfied by the project's Python 3.12 CI. The contract test verifies
that the direct requirement, lock file, and installation example agree rather
than hard-coding a second version inside the test.

## Release process

1. Update the version in the integration manifest, Python constant, Card, and
   package metadata.
2. Run all local checks, including the disposable HA container test above, and
   scan for credentials, private hosts, event IDs, and personal configuration.
3. Open a pull request. Merge to `main` after review and successful validation.
4. Verify the merge commit and its CI results. Tag that exact commit as `vX.Y.Z`
   and publish the matching GitHub release with upgrade instructions; never move
   a tag to fix a release.
5. Verify the published tag, release status, and Pages deployment.
6. Install the release through HACS in a clean Home Assistant test path.
7. Complete the config flow with newly entered provider credentials.
8. Confirm the Card loads without a manual Lovelace resource.

For a first beta, use the same SemVer prerelease string (for example,
`0.3.5-beta.1`) in package metadata, the manifest, Python constant, and Card;
create a matching Git tag and mark its GitHub release as **pre-release**, not
latest. Prefer validating HACS beta selection and downgrade in a disposable
Home Assistant instance. If the owner explicitly chooses a productive first
test, follow the [German beta checklist](beta-testing.md): require a manual
backup, disclose that installation and downgrade are unverified, and obtain
the owner's test feedback before any stable/main promotion. The exact beta
control in HACS is UI-version dependent. Keep stable install instructions
stable-only; never describe manual checks as already completed.

Never publish a release from manually copied Home Assistant files. Subsequent
fixes should use a new GitHub tag and HACS version.

## Version 0.4.0

- [PTZ](card.md#ptz-button) in WebRTC and MSE live views: show the supported
  pan/tilt and zoom commands for the current camera. Each movement and its
  Stop request target the same HA entity, even when the view changes.
- [Two-way audio](card.md#talk-to-the-camera) in single and multiview WebRTC
  players: tap to toggle or hold to talk. Only the active stream gets a
  microphone session; stopping does not interrupt playback. Direct playback
  needs a matching HA profile and stream alias before capture.
- Include the hls.js **1.7.4** browser bundle and the development updates to
  Playwright **1.65.1** and Ruff **0.17.5** already merged since 0.3.13.
- No change to service schemas or the notification Blueprint. Upgrade the
  HACS integration, restart HA and reload the dashboard; no Blueprint re-import
  or configuration migration is required from 0.3.13.

## Version 0.3.13

- Select Frigate cameras in the [visual editor](card.md#visual-editor). Stream
  suggestions use the selected entity's read permission and its instance's
  cached aliases. Ambiguous Main/Sub assignments stay manual; opening a saved
  camera changes nothing.
- Show labelled filter and advanced controls on current HA frontends. Use the
  Card background for the event list and a subtle theme tint for each row.
- Display the first clips before optional metadata arrives, retain rows during
  refresh, and ignore stale loads and malformed reviews. Group distinct events
  by camera and label within the configured time window; `0` disables time grouping.
- Stop outstanding video-frame work early once the encoded request would exceed
  the size budget. The final payload check and provider limits are unchanged.
- Add behavioral Chromium coverage and an optional offline HA Core container
  test, including permission checks for stream suggestions. No Blueprint
  re-import or configuration migration is required from 0.3.12.

## Version 0.3.12

- Match the Card's Clips media root and its event/review metadata to the same
  Frigate instance, including when the selected profile loads asynchronously.
  Ambiguous or unavailable media roots are reported instead of guessed.
- Remove unused internal Card state and a redundant timeline segment listener.
  Existing camera configuration formats and the legacy live proxy are unchanged.
- Share integration initialization and cover service availability across
  setup, partial unload, last-entry unload, and subsequent setup.
- Update the build-only `sharp` dependency to 0.35.5 and enable npm update checks.
  No Blueprint re-import or configuration migration is needed for this patch.

## Version 0.3.11

- Release the opt-in [alarm-based notification intervals](blueprint.md#alarm-based-notification-intervals)
  from PR #27. Fixed cooldowns remain the default. To opt in, re-import the
  Blueprint and configure a dedicated restoring date-and-time helper.
- Separate provider request encoding from transport; the JSON payload and byte
  limit are unchanged. Share exception-chain traversal for Frigate authentication
  without changing which failures are retried.
- Add regression tests for request bytes, size boundaries, nested HTTP/network
  errors and cyclic exceptions. Update the HACS installation and contributor guides.

## Version 0.3.10

- confirm ambiguous description writes with one bounded readback of the exact
  event and description, without repeating inference or the write;
- preserve image/video analysis results when storage cannot be confirmed,
  returning `stored: false` and `store_error` and logging a warning;
- finish an active pending notification with an error update under the same
  tag, followed by optional custom error actions; mute and shadow semantics stay;
- regression coverage for commit-before-timeout, readback failure, conflicting
  descriptions, wrong-event readback, cancellation and shared concurrent writes.

## Version 0.3.9

- optional reasoning control for all image and video analysis requests;
- backward-compatible server default, with Off sending `reasoning_effort: none`
  only when selected for a compatible provider/model;
- German and English setup/options labels and token-budget guidance;
- regression coverage for legacy/default requests, reasoning disabled in image
  and video requests, and rejection of reasoning-only responses.

## Version 0.3.8

- per-camera **Ultra-Wide** editor switch (`ultra_wide: true`), off by default;
- full-row multiview tiles across all desktop or mobile grid columns, without
  changing stream selection or media aspect ratio;
- saved camera settings survive editor changes and reloads; disabling the
  option restores the normal column width;
- regression tests for existing camera formats, editor persistence, and
  responsive mixed normal/Ultra-Wide layouts using the actual Lit/Chromium runtime;
- Ruff development dependency updated to 0.16.8 and hassfest action reference
  refreshed through the reviewed Dependabot updates.

## Version 0.3.7

- use a Markdown image in the README so HACS resolves the repository image URL;
- no integration behavior changes.

## Version 0.3.6

- violet winged-eye icon and logo bundled with the integration;
- project image in the GitHub/HACS README and documentation, including favicon;
- reproducible image exports from the approved full-resolution source;
- no changes to event analysis, notifications, or streaming behavior.

Local integration brand images require Home Assistant 2026.3 or newer. Older
versions can still use the integration but may show a generic integration icon.
HACS 2.0.5 still uses the legacy brands CDN for repository-list icons; support
for local brand images is tracked in
[HACS issue #5179](https://github.com/hacs/integration/issues/5179).

## Version 0.3.5

- stable release of the 0.3.5 line, superseding the `0.3.5-beta.1`
  pre-release;
- bundled hls.js 1.7.3 and Lit 3.3.3 (LitElement 4.2.2 / lit-html 3.3.3);
- actual-vendored-runtime Chromium browser test in CI and local validation;
- Card validation runs on Node 24; the `beta/**` CI trigger stays enabled for
  future pre-releases.

## Version 0.3.5-beta.1 (pre-release candidate)

- bundled hls.js 1.7.3 and Lit 3.3.3 (LitElement 4.2.2 / lit-html 3.3.3);
- actual-vendored-runtime browser test and beta-branch CI validation;
- see [Beta-Test: 0.3.5-beta.1](beta-testing.md) for productive installation,
  testing, and manual rollback guidance; superseded by the stable 0.3.5
  release.

## Version 0.3.4

- query-free relative notification image URLs for reliable iOS attachments;
- event thumbnail initially and stored snapshot for the completed same-tag push;
- Frigate's stored event annotations remain unchanged.

## Version 0.3.3

- latest Frigate sub-label and confidence in event-service responses;
- recognized-person titles in the Blueprint and bundled Card;
- no duplicate analysis for later face-recognition MQTT updates.

## Version 0.3.2

- clean Frigate event snapshots are preferred for AI analysis;
- annotated event snapshots remain an explicit last-resort fallback;
- initial and completed notification images use phase-specific cache keys.

## Version 0.3.1

- fixed 1080-pixel maximum video-frame height with preserved aspect ratio;
- separate 180-second default provider timeout for video analysis;
- stabilized 5–15 second, 1-fps event-video windows.

## Version 0.3.0

- initial 1-fps event-video API with configurable 5–60 second windows;
- independent image and video single-flight tasks;
- in-memory frame processing with a 25 MB serialized-request limit;
- image/video selection and result variables in the notification Blueprint.

## Version 0.2.2

- recording/main-stream event images with detect-snapshot fallback;
- strict event-frame timestamp precedence and actual-source response metadata;
- bounded recording readiness retries with an immediate authentication failure;
- no image upscaling and preserved ultra-wide aspect ratios.

## Version 0.2.1

- authenticated Home Assistant Frigate proxy for local and remote live view;
- WebRTC-first playback with MSE fallback through Home Assistant;
- automatic Frigate MQTT client-ID discovery for proxy routing;
- direct go2rtc URLs retained as explicit advanced/standalone overrides;
- no signed paths, endpoint URLs, SDP, or ICE candidates in Card logs.

## Version 0.2.0

- one HACS package for integration and Card;
- 20-second event and snapshot readiness;
- event-scoped analysis and write single-flight;
- queued notification Blueprint with notification-only cooldown and mute;
- Material for MkDocs documentation and GitHub Pages deployment;
- no historical backfill or LLM Vision migration.
