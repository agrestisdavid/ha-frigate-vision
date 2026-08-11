# Development and releases

## Local checks

Create a documentation environment and install the lock file:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-docs.txt
```

Run:

```powershell
python -m compileall custom_components
python -m ruff check custom_components tests
python -m ruff format --check custom_components tests
python -m unittest discover -s tests -p "test_*.py" -v
npm ci
npm run verify
.\.venv\Scripts\python.exe -m mkdocs build --strict
.\.venv\Scripts\python.exe tests\check_built_docs.py site
```

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
4. Create a matching GitHub release and tag such as `v0.3.2`.
5. Verify the Pages deployment.
6. Install the release through HACS in a clean Home Assistant test path.
7. Complete the config flow with newly entered provider credentials.
8. Confirm the Card loads without a manual Lovelace resource.

Never publish a release from manually copied Home Assistant files. Subsequent
fixes should use a new GitHub tag and HACS version.

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
