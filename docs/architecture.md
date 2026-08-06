# Architecture

## Package layout

The public repository is one HACS integration:

```text
custom_components/frigate_vision/   Integration and bundled Card
blueprints/automation/              Notification Blueprint
docs/                               Material for MkDocs source
tests/                              Python and Card tests
.github/workflows/                  Validation and Pages deployment
```

The Card runtime is served from
`custom_components/frigate_vision/frontend/frigate-vision-card.js`. The
integration registers a versioned Home Assistant module URL once per process.

## Event analysis pipeline

1. Validate the opaque event ID.
2. Join or create the event-scoped analysis task.
3. Read event metadata directly with Frigate authentication.
4. Return a newly visible cached description when `force` is false.
5. Read the event snapshot within the same readiness deadline.
6. Call the provider once.
7. Join or create one event-scoped description write when requested.
8. Return the shared result with caller-specific duration and storage status.

Temporary source errors remain inside steps 3–5. Provider and write failures
are outside the retry loop.

Analysis and write tasks are attached to the Frigate Vision config entry so a
reload or unload cancels work that still references its runtime.

## Storage model

Frigate owns:

- event metadata;
- snapshots and clips;
- reviews and recordings;
- successful AI descriptions.

Home Assistant owns:

- integration configuration and provider credentials;
- Card and Blueprint configuration;
- optional timer and mute helpers.

Frigate Vision owns no timeline database. Generic titles are calculated at
display or notification time and are never stored.

## Mixed operation

The `frigate_vision` domain, Card elements, frontend route, deep-link key, and
notification tags are independent. An existing LLM Vision integration and
legacy Card can remain installed indefinitely.
