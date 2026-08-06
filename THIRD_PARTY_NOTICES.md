# Third-party notices

The Frigate Vision Card bundles these exact browser libraries so Home
Assistant does not need a runtime CDN connection:

- LitElement 2.5.1 — BSD 3-Clause License
- lit-html 1.4.1 — BSD 3-Clause License
- hls.js 1.5.17 — Apache License 2.0

The generated files, SHA-256 manifest, and complete license texts are stored
under `custom_components/frigate_vision/frontend/vendor/`. They can be
reproduced from the exact npm lock file with `npm run build:vendor`.

The corresponding upstream projects are:

- <https://github.com/lit/lit-element>
- <https://github.com/lit/lit-html>
- <https://github.com/video-dev/hls.js>

## Project provenance

The Card was consolidated from
`agrestisdavid/frigate-llm-vision-timeline-card`, a repository owned and
authored by the same copyright holder. That earlier repository advertised MIT
licensing in its README but did not contain the linked license file when
audited. The copyright holder licenses the consolidated work in this
repository under the complete MIT text in `LICENSE`.

No LLM Vision runtime code is bundled. Frigate Vision communicates only
through documented Home Assistant, Frigate, go2rtc, and provider interfaces.

Frigate Vision itself is licensed under the MIT License. See `LICENSE`.
