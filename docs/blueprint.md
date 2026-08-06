# Notification Blueprint

The Blueprint processes only MQTT payloads that meet all of these conditions:

- `type` is exactly `new`;
- the event belongs to the selected Frigate camera;
- the label is allowed;
- the event is not a rejected false positive.

Invalid JSON and incomplete payloads do not pass the filter.

## Shadow mode

Shadow is the default:

- the event is analyzed;
- `store` is forced to false;
- production notification actions are skipped;
- Frigate is unchanged.

Optional shadow actions are intended for deliberate diagnostics. Leave them
empty for a completely quiet shadow run.

## Active mode

When an event obtains a notification slot:

1. the cooldown timer is started;
2. the initial notification action runs;
3. the event is analyzed;
4. the analysis notification action runs with the same tag.

The action selector receives stable variables including:

- `fv_phase`: `initial`, `analysis`, `shadow`, or `error`;
- `fv_title` and `fv_message`;
- `fv_event_id`, `fv_camera_key`, and `fv_label`;
- `fv_notification_tag` and `fv_notification_group`;
- snapshot, thumbnail, and clip URLs;
- `fv_analysis`, `fv_response_text`, `fv_stored`, and `fv_cached`.

The initial and analysis phases use the same tag, allowing a mobile
notification update instead of a second notification.

## Queue behavior

The automation uses `mode: queued`, `max: 50`, and
`max_exceeded: warning`. Allowed events are analyzed one after another per
Blueprint instance, protecting the provider from parallel calls.

At more than 50 active and queued runs, Home Assistant rejects additional
runs and logs a warning. This explicit overflow limit is not a persistent
message queue.

## Mute and cooldown

Mute and cooldown suppress only notification actions. They never suppress an
allowed event analysis.

For any cooldown greater than zero, create a dedicated Timer helper:

1. open **Settings → Devices & services → Helpers**;
2. create a **Timer**;
3. set the desired duration;
4. enable restore;
5. select that timer in the Blueprint instance.

Timer, mute state, and event age are evaluated only when a queued run actually
starts. An event already older than the cooldown does not produce a delayed
push. A timer failure closes the notification slot but does not stop analysis.

Error actions are an unthrottled diagnostic path and still run when analysis
fails. Do not place a push action there if it must obey mute and cooldown.

## Generic title

Both push phases use:

```text
<Detection> in <Camera> wurde erkannt
```

The model creates only the description. It does not create or store the title.
