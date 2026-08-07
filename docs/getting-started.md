# Getting started

## Prerequisites

You need:

- Home Assistant 2024.10.0 or newer;
- the Frigate integration configured and loaded;
- HACS;
- an OpenAI-compatible Chat Completions endpoint with a vision-capable model.

The integration analyzes still images. A provider may support video or audio,
but version 0.2.x does not send those media types.

## Install one HACS package

1. Open HACS.
2. Add `agrestisdavid/ha-frigate-vision` as a custom repository.
3. Select the **Integration** category.
4. Install release `0.2.1`.
5. Restart Home Assistant.

Do not add a separate Lovelace resource for the bundled Card.

### Upgrading from the split 0.1.x test packages

Remove only the separate **Frigate Vision Card** Lovelace resource before
loading version 0.2.x. Both versions register the same
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
7. Leave the direct go2rtc URL fields empty to use the authenticated Home
   Assistant Frigate proxy.

The API key is not copied from another integration. Enter it directly in the
Frigate Vision config flow.

The proxy is the default for local and remote Home Assistant access. An
external go2rtc URL is not required. Direct local or remote URLs are retained
only as advanced/standalone overrides.

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

Live view tries WebRTC first and then MSE. WebRTC media still requires working
ICE candidates and reachability of go2rtc port `8555`. During initial
negotiation, the Card waits for both a media track and a connected/completed
ICE state before accepting WebRTC. An initial failure or readiness timeout
advances to MSE, which runs completely through Home Assistant.

If this Home Assistant instance has more than one Frigate Vision config entry,
select the intended profile in the Card:

```yaml
frigate_vision_entry_id: example-frigate-vision-entry
```

With one entry, omit the field and let Home Assistant resolve it
automatically.

## Import the Blueprint

[![Open your Home Assistant instance and show the Blueprint import dialog with the Frigate Vision Blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fagrestisdavid%2Fha-frigate-vision%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Ffrigate_vision%2Fevent_notification.yaml)

Import this URL from **Settings → Automations & scenes → Blueprints**:

```text
https://github.com/agrestisdavid/ha-frigate-vision/blob/main/blueprints/automation/frigate_vision/event_notification.yaml
```

Importing a Blueprint does not create an automation. Start with `shadow` mode,
then configure a dedicated restoring timer before enabling a positive
notification cooldown.
