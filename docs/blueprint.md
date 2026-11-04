# Notification Blueprint

[![Open your Home Assistant instance and show the Blueprint import dialog with the Frigate Vision Blueprint pre-filled.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fagrestisdavid%2Fha-frigate-vision%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Ffrigate_vision%2Fevent_notification.yaml)

The button opens Home Assistant's Blueprint import dialog with the Frigate
Vision Blueprint pre-filled. It imports the Blueprint only; it does not create
or enable an automation.

If the button cannot find your Home Assistant instance, import this URL
manually:

```text
https://github.com/agrestisdavid/ha-frigate-vision/blob/main/blueprints/automation/frigate_vision/event_notification.yaml
```

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

The analysis medium defaults to **Image**, preserving existing automation
behavior. **Video** calls the 1-fps event-video service with configurable
5–15 second duration and pre-roll. The initial notification still runs before analysis;
recording readiness waiting occurs inside the service and introduces no fixed
Blueprint delay.

## Active mode

When an event obtains a notification slot:

1. the notification slot is reserved: the fixed-mode timer is started, or
   the alarm-mode timestamp is saved and its readback confirmed;
2. the initial notification action runs;
3. the event is analyzed;
4. the final notification action runs with the same tag, using `fv_phase="analysis"`
   for a description or `fv_phase="error"` when analysis fails.

Since 0.3.10, an analysis failure finishes an already-started notification even
when optional `error_actions` are empty. Those custom error actions run afterward.
Muted events, events without a notification slot, and shadow mode do not gain
an error push. Re-import the Blueprint to apply this change; updating the HACS
integration alone does not update an installed Blueprint.

A completed analysis survives a Frigate storage failure. `fv_analysis.store_error`
reports an unconfirmed write and `fv_stored` stays false, while the description
is still available for the final notification.

The action selector receives stable variables including:

- `fv_phase`: `initial`, `analysis`, `shadow`, or `error`;
- `fv_title` and `fv_message`;
- `fv_event_id`, `fv_camera_key`, `fv_label`, `fv_sub_label`, and
  `fv_sub_label_score`;
- `fv_notification_tag` and `fv_notification_group`;
- snapshot, thumbnail, and clip URLs;
- `fv_analysis`, `fv_response_text`, `fv_stored`, and `fv_cached`.
- `fv_media_type`, `fv_image_source`, `fv_image_has_overlay`, and
  `fv_source_frame_time`;
- `fv_frame_count`, `fv_window_start`, and `fv_window_end`.

The initial and analysis phases use the same tag, allowing a mobile
notification update instead of a second notification. The initial phase uses
Frigate's lightweight event thumbnail; the analysis phase replaces it with the
stored event snapshot. Both are query-free relative URLs. Query parameters are
intentionally avoided because the iOS notification attachment loader can
interpret them as part of the relative path and receive HTTP 404 from the Home
Assistant Frigate proxy. The final snapshot retains Frigate's configured
annotations.

## Queue behavior

The automation uses `mode: queued`, `max: 50`, and
`max_exceeded: warning`. Allowed events are analyzed one after another per
Blueprint instance, protecting the provider from parallel calls.
Longer video analyses can therefore delay later queued events for the same
Blueprint instance; they do not create parallel load on the model endpoint.
Separate Blueprint instances, for example one per camera, can run in parallel
and therefore use separate model-server slots.

At more than 50 active and queued runs, Home Assistant rejects additional
runs and logs a warning. This explicit overflow limit is not a persistent
message queue.

## Mute and cooldown

Mute and cooldown suppress only notification actions. They never suppress an
allowed event analysis.

By default, the Blueprint uses the existing fixed cooldown. With alarm-based
intervals **disabled**, any cooldown greater than zero needs a dedicated Timer
helper:

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

## Alarm-based notification intervals

The optional **Alarmabhängige Benachrichtigungsintervalle** section selects the
minimum interval from an `alarm_control_panel` entity's current state. It is
**off by default**: re-importing does not change existing automations' behavior.
This only limits new event notifications, not analyses. It does **not** send
periodic reminders, replay suppressed events, or send a push just because the
alarm state changes. Initial and final/error updates of one event still share
one slot and tag.

### Setup

1. Re-import the Blueprint from the canonical URL above. An integration/HACS
   update alone does not update an already imported Blueprint. Existing input
   keys and settings are preserved; each new input has a default.
2. Under **Settings → Devices & services → Helpers**, create a **Date and/or
   time** (`input_datetime`) helper with **both date and time** enabled. Use a
   separate helper for each Blueprint automation/camera; never share it with
   another automation or edit it while the automation is running.
3. Before enabling the option, set the helper once to a past date/time, for
   example yesterday, at least as old as your longest interval. Do not give a
   YAML-created helper an `initial:` value: that overrides restoration after
   every restart. A UI-created date/time helper restores its last value without
   a separate restore switch.
4. Select the alarm entity and this helper under **Alarmanlage** and **Letzter
   Benachrichtigungsbeginn**, then enable **Alarmsteuerung aktivieren**.
5. Set the desired intervals. Values are **seconds**, up to 86400 (24 hours).
   **-1** inherits the existing **Cooldown** setting (90 seconds by default).
   **0** removes time-based throttling; it does not disable notifications.

| Alarm state | Blueprint field | Default |
| --- | --- | --- |
| `disarmed` | Unscharf | -1: standard cooldown |
| `armed_home` | Zuhause scharf | 1800 seconds = 30 minutes |
| `armed_away` | Abwesend scharf | 300 seconds = 5 minutes |
| `armed_night` | Nacht scharf | -1: standard cooldown |
| `armed_vacation` | Urlaub scharf | -1: standard cooldown |
| `armed_custom_bypass` | Benutzerdefiniert scharf | -1: standard cooldown |
| `arming` | Wird scharfgeschaltet | -1: standard cooldown |
| `disarming` | Wird unscharfgeschaltet | -1: standard cooldown |
| `pending` | Eingangsverzögerung | -1: standard cooldown |
| `triggered` | Alarm ausgelöst | -1: standard cooldown |

All ten intervals are independently configurable; `triggered` has no automatic
bypass. If "home" for your alarm means **disarmed**, configure `disarmed`
explicitly; the 30-minute default applies to `armed_home`, not presence tracking.
Missing alarm entities, `unknown`, `unavailable`, and unrecognized states use the
standard **Cooldown** value, still measured against the saved timestamp.

### State changes, persistence, and failures

The alarm state, saved timestamp, mute state, and event age are read when a
queued event **actually starts**, not when its MQTT message arrived. The current
interval is measured from the last **notification start**, not the last
analysis, final update, or alarm-state change:

- Last push 10 minutes ago, change from home/30 minutes to away/5 minutes:
  the next fresh event can notify immediately.
- Last push 10 minutes ago, change from away/5 minutes to home/30 minutes:
  notifications wait until 30 minutes have elapsed since that push.

Alarm mode ignores the old cooldown timer entirely, including active, expired,
or unavailable timers. The date/time helper is required **even for interval 0**
and fallback states, so a later change to a positive interval can still use the
last start time. The timestamp is written before notification actions and read
back before allowing a push. It has one-second precision; rounding upward may
add less than one second, but never shortens a positive interval. Final/error
updates do not rewrite it, even when the alarm or mute state changes during
analysis. Failed notification actions still consume their reserved slot.

A missing, unavailable, malformed, date-only, or time-only helper, or a failed
or unconfirmed timestamp write, suppresses **only notifications**. Analyses
continue. A future timestamp blocks positive intervals until the clock catches
up; check the helper and system clock rather than resetting it on every event.
An event older than its selected positive interval is not pushed late. As in
fixed mode, interval 0 disables that age limit as well as time-based throttling.
Mute, shadow mode, and filtered or suppressed events never advance the timestamp.

To return to the previous behavior, disable **Alarmsteuerung aktivieren** and
ensure the restoring **Cooldown-Timer** is configured when the fixed cooldown
is positive. The timestamp helper may remain; fixed mode neither reads it for
throttling nor writes it. Switching this option is a configuration change, not
an alarm-state transition: timer and timestamp histories are not migrated.

## Notification title and face recognition

Without a recognized person, both push phases use:

```text
<Detection> in <Camera> wurde erkannt
```

After analysis, the event services refresh Frigate metadata once. If Frigate
has assigned a person sub-label in the meantime, the final update uses:

```text
Person (<Name>) in <Camera> wurde erkannt
```

The Blueprint still reacts only to the original `frigate/events` `new`
message. Later face updates never start a second analysis. The model creates
only the visual description; the recognized identity is neither sent to the
provider nor stored as part of that description. Custom actions can branch on
the normalized metadata, for example `{{ fv_sub_label == 'Alex' }}`.
