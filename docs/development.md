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
.\.venv\Scripts\python.exe -m ruff check custom_components tests
.\.venv\Scripts\python.exe -m ruff format --check custom_components tests
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

Pull requests run Python, JavaScript, HACS, hassfest, and strict documentation
validation. Actions are referenced by immutable commit SHA. Dependabot watches
GitHub Actions and Python documentation dependencies.

## Bundled browser and brand assets

The released Card never fetches JavaScript from a CDN. Rebuild the pinned
browser bundles and their checksum manifest with:

```powershell
npm ci
npm run build:vendor
npm run check:vendor
```

`npm run verify` fails if the committed vendor files no longer match the
exact dependency versions in `package-lock.json`.

The local integration icons are deterministic project assets:

```powershell
npm run build:brand
npm run check:brand
```

## Documentation dependencies

`requirements-docs.in` contains the direct Material for MkDocs requirement:

```text
mkdocs-material==9.7.7
```

`requirements-docs.txt` records the complete tested environment. Regenerate it
in a clean Python 3.12 virtual environment, review every version change, and
confirm `mkdocs build --strict`.

Material for MkDocs is in maintenance mode, so upgrades should be deliberate.
Version 9.7.7 is pinned for the current security-fixed release line.

## Release process

1. Update the version in the integration manifest, Python constant, Card, and
   package metadata.
2. Run all local checks and scan for credentials, private hosts, event IDs, and
   personal configuration.
3. Merge to `main`.
4. Create a matching GitHub release and tag such as `v0.3.4`.
5. Verify the Pages deployment.
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
