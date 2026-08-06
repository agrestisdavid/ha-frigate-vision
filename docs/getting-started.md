# Getting started

## Prerequisites

You need:

- Home Assistant 2024.10.0 or newer;
- the Frigate integration configured and loaded;
- HACS;
- an OpenAI-compatible Chat Completions endpoint with a vision-capable model.

The integration analyzes still images. A provider may support video or audio,
but version 0.2.0 does not send those media types.

## Install one HACS package

1. Open HACS.
2. Add `agrestisdavid/ha-frigate-vision` as a custom repository.
3. Select the **Integration** category.
4. Install release `0.2.0`.
5. Restart Home Assistant.

Do not add a separate Lovelace resource for the bundled Card.

### Upgrading from the split 0.1.x test packages

Remove only the separate **Frigate Vision Card** Lovelace resource before
loading version 0.2.0. Both versions register the same
`frigate-vision-card` custom element, so whichever module loads first would
otherwise remain active until the browser is reloaded.

Do not remove an LLM Vision integration, legacy timeline Card resource, or
legacy automation. Those packages use separate public names and can remain in
parallel.

## Add the integration

1. Open **Settings → Devices & services**.
2. Select **Add integration**.
3. Search for **Frigate Vision**.
4. Select the existing Frigate instance.
5. Enter the provider endpoint, API key, and model.
6. Review the image and timeout limits.
7. Optionally configure central go2rtc URLs.

The API key is not copied from another integration. Enter it directly in the
Frigate Vision config flow.

## Add the Card

Add a Manual card to a dashboard:

```yaml
type: custom:frigate-vision-card
title: Frigate Vision
frigate_client_id: frigate
cameras:
  driveway:
    name: Driveway
    main: driveway_main
    sub: driveway_sub
initial_events: 6
events_per_load: 6
auto_refresh_seconds: 0
```

The Card module is available after the integration has loaded. If the visual
editor still reports an unknown card, reload the browser once.

## Import the Blueprint

Import this URL from **Settings → Automations & scenes → Blueprints**:

```text
https://github.com/agrestisdavid/ha-frigate-vision/blob/main/blueprints/automation/frigate_vision/event_notification.yaml
```

Importing a Blueprint does not create an automation. Start with `shadow` mode,
then configure a dedicated restoring timer before enabling a positive
notification cooldown.
