# Working on Frigate Vision

This repository ships one HACS integration, a bundled dashboard Card and a
notification Blueprint. Make changes here, not in a running Home Assistant
installation. Use synthetic events, images and credentials in tests.

| Area | Start here | Check |
| --- | --- | --- |
| Setup, options and services | `custom_components/frigate_vision/config_flow.py`, `__init__.py`, `services.yaml` | Keep `strings.json` and both translations aligned with form changes. |
| Image/video analysis and Frigate I/O | `custom_components/frigate_vision/analysis.py` | `python -m unittest discover -s tests -p "test_event_analysis.py"` |
| Dashboard Card | `custom_components/frigate_vision/frontend/frigate-vision-card.js` | `npm run verify` includes tests against vendored code in Chromium. |
| Notifications | `blueprints/automation/frigate_vision/event_notification.yaml` | `python -m unittest discover -s tests -p "test_blueprint*.py"` runs contract and simulated runtime checks. |
| Documentation | `README.md`, `docs/`, `mkdocs.yml` | `python -m mkdocs build --strict` then `python tests/check_built_docs.py site` |

Use Python 3.12 in a virtual environment and Node.js 24. Install the Python
dependencies with `python -m pip install -r requirements-dev.txt -r requirements-docs.txt`.
Run `npm ci` and `npx playwright install chromium` before the Card suite.
Do not hand-edit generated brand images or vendor bundles. The rebuild commands
and the complete local check sequence are in [Development](docs/development.md).
`.github/workflows/validate.yml` defines the five PR checks, including HACS and
hassfest. The fast Python tests use stubs. For setup, service or frontend
registration changes and before releasing, also run `python scripts/test_ha_container.py`
with a local Linux Docker engine. It uses disposable HA Core and synthetic
Frigate/model endpoints, not a running installation.

## Preparing a stable release

1. Compare `main` with the latest stable GitHub release (`gh release view`).
   Include already-merged changes in the notes and call out any Blueprint
   re-import separately from the HACS update.
2. Keep `manifest.json`, `const.py` (`VERSION`), the Card's `CARD_VERSION`,
   `package.json`, and both root version entries in `package-lock.json` in sync.
3. Review the release diff and merge the PR only after its checks pass.
   Run `git fetch origin main --tags`, confirm the intended merge commit passed
   CI, and ensure the proposed version tag does not already exist.
4. For an authorized release, replace the placeholders below with the actual
   version, verified full commit SHA, and reviewed release notes. Then verify the
   tag target with `git ls-remote` and confirm the stable release is published.

   ```sh
   git tag vX.Y.Z <verified-merge-sha>
   git push origin refs/tags/vX.Y.Z
   gh release create vX.Y.Z --verify-tag --latest --title "vX.Y.Z" --notes-file <notes-file>
   gh release view vX.Y.Z --json tagName,isDraft,isPrerelease,url
   ```

Never rewrite an existing release tag. Record a manual HACS or hardware check
only if it actually ran in a disposable test installation.
