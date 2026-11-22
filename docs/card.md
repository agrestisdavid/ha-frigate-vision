# Card, events, and clips

The bundled Card type is:

```yaml
type: custom:frigate-vision-card
```

Its custom elements are unique:

- `frigate-vision-card`
- `frigate-vision-card-editor`
- `frigate-vision-live-tile`
- `frigate-vision-ptz`
- `frigate-vision-talk-button`

They can coexist with a different Frigate timeline Card on the same dashboard.
The Card responds only to its own deep link:

```text
#frigate_vision_clip=example-event-id
```

## Visual editor

Under **Kameras → Kamera aus Frigate hinzufügen**, select a Home Assistant camera
by its display name. The editor saves the Frigate camera ID, not the HA entity
ID, so renamed entities work too. The choices come from the camera entities
visible to the current HA user; the picker does not request snapshots, clips,
stream URLs or the Frigate configuration. It uses the Card's explicit Frigate
client ID or its central profile. If several instances are visible and no
profile selects one, choose an instance first. **Kamera-ID manuell eingeben**
remains available when a camera has no HA entity. Leaving the list empty keeps
the default of all cameras for the selected instance. The Card's camera list
is a display setting, not a change to Frigate permissions.

Adding a camera also looks up its go2rtc stream **aliases**. The integration
uses that camera's `live.streams` mapping from the Frigate configuration already
loaded in HA. It returns only aliases present in the same instance's
`go2rtc.streams`, never the stream source URLs. With no live mapping, it can
offer an existing alias exactly matching the camera ID. It does not scan other
cameras or start a stream.

For example, `live.streams: {HD: gate_a, SD: gate_b}` suggests `gate_a` for
**Main-Stream (HD)** and `gate_b` for **Sub-Stream (SD)**. Only one unambiguous
alias per role can prefill an empty field on a newly added camera. With arbitrary
labels or conflicting hints, choose the aliases yourself. On a saved camera,
opening the editor changes nothing: use **Vorschläge für leere Felder übernehmen**
or select either stream individually. Manual names remain editable even if the
lookup is unavailable. Main and Sub are editing suggestions, not measurements
of resolution or changes to Frigate.

Under **Filter & Sprache**, **Ereignisfilter anzeigen** shows or hides the
camera, object and date filters in the event list. The language selector is
independent. Under **Erweitert**, **Gruppierungszeitraum** defaults to 30 seconds
(`0` disables time grouping); **Aktualisierungsintervall** defaults to `0`
(no automatic refresh). A positive interval refreshes the list only while its
tab is visible.

## Event metadata

The Card uses exact Frigate event IDs. It directly consumes embedded Media
Source metadata when available:

- event ID;
- `data.description`;
- `has_clip`;
- camera and label;
- start and end timestamps.

The event list uses the Card's own background. Individual rows, rather than
the whole list panel, have a subtle theme-relative tint.

On first load the Card shows clips as soon as the selected media source
responds. Optional event and review details can fill in later. Refreshing a
populated list keeps the previous rows visible. An unreadable review is
skipped without discarding descriptions from unrelated events.

Use the Frigate camera ID (for example `front_gate`) in `cameras`, not the
folder's display title (`Front Gate`). A library that lists clips directly
does not need a separate camera folder.

`dedupe_window_seconds` controls **display grouping**, not which events are
analyzed or stored. The default is 30 seconds for events with the same camera
and label. Set it to `0` to show distinct event IDs even when they occur close
together. Repeated entries with the same exact ID are still shown only once.
There is no fuzzy time matcher for metadata and no local event database.

Description priority is:

1. review scene metadata;
2. review summary metadata;
3. `event.data.description`.

Historical events analyzed only by another integration may therefore have no
description in this Card. Version 0.2.0 intentionally performs no backfill.

## Titles

Titles are derived locally and are not sent to or stored in Frigate:

```text
<Detection> in <Camera> wurde erkannt
```

Known labels are translated, for example `person` to `Person` and `dog` to
`Hund`. A recognized person sub-label changes the title to, for example,
`Person (Alex) in Eingang wurde erkannt`. Unknown labels are converted to
readable title case. AI descriptions and review titles do not change the title;
sub-labels on non-person objects remain metadata only.

## Clip playback order

The Card attempts:

1. direct event MP4 through the authenticated Home Assistant Frigate proxy;
2. resolved HLS from Home Assistant Media Source;
3. a bounded event recording as MP4.

MP4 metadata may take up to 40 seconds to become ready. HLS receives up to 60
seconds when used as a fallback. A race token prevents an older load from
overwriting a newly selected event.

Unsigned Home Assistant media paths are signed with `auth/sign_path`. Raw Home
Assistant access tokens are not appended to media URLs or written to console
logs.

“No clip” is shown only for confirmed `has_clip: false` or HTTP 404/410.
Network, timeout, and decoder failures have separate messages.

## Live view

The live tile retains WebRTC, MSE, MP4, HLS, and MJPEG transports, HD/SD
switching, multiview, clips, and the VoD timeline. Stream names must match the
actual go2rtc stream keys configured in Frigate.

By default, live requests use the authenticated Home Assistant Frigate proxy.
This works through both local and remote Home Assistant access without an
external go2rtc URL. The Card tries WebRTC first, then MSE. WebRTC media still
requires reachable ICE candidates and go2rtc port `8555`. During initial
startup, WebRTC is marked ready only after a media track arrives and ICE is
connected/completed. An initial failure, readiness timeout, or answer without
working media falls through to MSE. The same readiness rule applies to direct
HTTP/WHIP. MSE carries the complete initial fallback path through Home
Assistant; no automatic MSE switch is promised for a later WebRTC disconnect.

Direct `frigate_url`, `go2rtc_url`, and `go2rtc_url_external` values are
advanced/standalone overrides. Leave them unset for the normal integrated
installation. MP4, HLS, and MJPEG live transports remain available with these
direct overrides; normal proxy mode uses WebRTC followed by MSE.

`go2rtc_url` is local-only. For an external client, the Card uses
`go2rtc_url_external` when set and otherwise returns to the Home Assistant
proxy; it never exposes or reuses the local direct URL externally.

### Talk to the camera

In a live player or multiview tile, unmute the **video's speaker control** to
hear the camera. The separate **microphone** button sends your voice to that
camera. The [Doorbell-only card](#doorbell-only-card) instead has its own
**Camera sound** and **Start talking** buttons. By default, tap once to talk and
tap again to stop. The button shows *Connecting microphone…* while waiting and
*Microphone on air* only once the return connection is ready. Opening the Card
never requests the microphone.

For push-to-talk, choose **Livestream → Sprechtaste → Zum Sprechen gedrückt
halten** in the Card editor and save. Hold the button (or Space/Enter while
focused) and release to stop. In YAML, `talk_mode: hold` selects push-to-talk;
`talk_mode: toggle` or omitting the option restores tap-to-talk.

Talk requires a secure browser context (HTTPS or localhost), microphone
permission, WebRTC playback, and a go2rtc stream with a compatible camera
speaker backchannel. The button targets the **currently playing HD/SD alias**;
if only the main stream has a backchannel, switch to HD before speaking. A
missing permission, incompatible backchannel or playback-only transport (such
as MSE) produces a message without interrupting listening or live video.
Microphone signaling **always** uses the authenticated HA proxy, even with a
direct playback URL. For direct playback the Card first checks that the
selected HA profile identifies the same Frigate instance and direct endpoint,
and that HA reports the playing alias for that camera. An unverified direct
stream (including standalone playback without HA) stays listen-only; no
microphone is requested. Use HA proxy playback if the mapping is unavailable.
No new public endpoint or HA service is needed.

Stopping, switching camera/quality, leaving or hiding the view, or losing the
connection releases the microphone. A later connection does not turn it on
again. Starting another tile's microphone stops the previous one. Disabling
**Livestream → Live-Controls Overlay anzeigen** hides the microphone,
doorbell and PTZ controls; the separate HD/SD button setting is unchanged.

### Doorbell calls and quick replies

In the Card editor, open **Kameras**, expand the door camera and enable
**Doorbell (Türklingel)**. Enter a Home Assistant entity ID and the exact
internal **Von-Zustand** (from) and **Zielzustand** (to). Keep live controls
enabled. The equivalent Card YAML is:

```yaml
cameras:
  front_door:
    doorbell:
      enabled: true
      entity: binary_sensor.front_doorbell
      from: "off"
      to: "on"
```

Only a new matching state change rings, and only while that camera's live
image is open in a visible dashboard. Opening the card on `on`, reconnecting,
attribute-only updates and transitions through `unknown` or `unavailable`
do not ring. There are no push notifications. The incoming call still appears
if the browser blocks the local ringtone. Unanswered calls time out after
about 25 seconds.

The green handset answers the call, replacing the ordinary microphone button
for a doorbell-enabled camera. The red horizontal handset declines the call,
including with quick replies open, without turning on the microphone. During
connection setup use **Cancel**; if the browser is prompting for microphone
permission, you can also use its cancel or deny control. Camera sound starts
only after the call connects, not while the card is ringing. If the browser
blocks playback after the connection is ready, tap **Enable camera sound**.
The card restores the previous playback setting when the call ends. The
[Doorbell-only card](#doorbell-only-card) handles this differently: there
listening and talking are separate controls that also work outside a call.

Use the red horizontal handset to end the call and release the microphone,
even when muted. The microphone button mutes only your outgoing voice, not
camera sound. The fullscreen control keeps the live image and call buttons
together on browsers that support element fullscreen. Use that same control
or Escape to return without ending the call. Closing the popup itself still
ends the call.

The **…** button just left of the handset opens the quick replies. By default
these are the two prerecorded German replies **Einen Moment bitte** and
**Bitte vor der Tür abstellen**. Selecting a reply sends it to the door
camera without answering, opening the microphone, interrupting the live
video or playing the reply on the browser's speakers. Use **End** to stop an
announcement in progress.

Selecting a reply silences the local ringtone right away without muting any
camera sound you switched on. **Answer** during the announcement cancels it
and starts connecting the microphone. After a successful reply, the status
reads *Incoming call (ringtone muted)* (*Eingehender Anruf (Klingelton stumm)*).
If playback fails, the card shows *Could not send the announcement.* instead.
In either case the call stays silent and you have about 25 seconds to answer
or decline. If the reply never completes, the card cancels it and closes the
call after 60 seconds. A distinct new ring can replace a silenced call if
microphone setup is not pending and talkback is not active. A still-pending
quiet call can survive a card rebuild in the same browser tab and Home Assistant
connection without ringing again; that quiet state does not survive a full page
reload or a new connection.

To customize them, go to **Settings → Devices & services → Frigate Vision →
Configure** for this Frigate instance. Select an existing `tts.*` entity and
enter up to three short replies (120 characters each). Blank slots are not
shown. Clear all three to restore the prerecorded German replies.

Saving synthesizes new texts with the selected engine's default language and
voice. Saving does not play or send any sound. Frigate Vision adds no TTS
provider; if you choose a cloud TTS entity, that provider processes the text.
The cache survives HA restarts and serves prepared audio even when the TTS
entity is offline. Switching the entity prepares the replies again. If an edit
fails, the previous replies and other settings stay active. The cache is stored
outside the public Card files. Custom labels and audio require an authenticated
HA connection with read access to the corresponding Frigate camera.

Both actions use the authenticated Home Assistant proxy and check that the
playing alias belongs to that Frigate camera; there is no separate talk-alias
setting. For a custom alias, use a stream declared under that camera's
`live.streams` and present in `go2rtc.streams` in the Frigate configuration
that HA received. The selected alias needs a compatible go2rtc speaker
backchannel; answering additionally requires live
WebRTC and browser microphone permission. The Card does not automatically
switch streams or quality. With a synthetic door camera, you can test with a
HA Toggle helper (for example `input_boolean.besucher`): open the camera's
live view, set the helper to off, then turn it on.

### Doorbell-only card

Choose **Anzeige → Ansicht → Doorbell (eine Kamera)** and select the
**Doorbell-Kamera** under **Kameras**. Enable Doorbell and configure its
trigger as above. In YAML, use `view_mode: doorbell` and
`doorbell_camera: front_door` alongside the existing `cameras` mapping.
The mode shows only the selected live video with audio and call controls.
Other camera entries and normal view settings stay saved; the mode does not
load events or recordings. The Sub alias is used if set, otherwise Main or
then the exact camera ID. Main and Sub may name the same alias.

Embed the same card in a Home Assistant panel or in a popup that your dashboard
already manages. The card does not open popups or force fullscreen. For a popup
that is **mounted after** the configured edge, enable **Vorhandenen Ruf beim
Öffnen übernehmen (nur Klingel-Popup)** (YAML: `doorbell_ring_on_mount: true`).
The popup itself should be configured to open on that exact entity/edge: when
it mounts, the card can only check the resulting state and its `last_changed`
timestamp, not the previous state. It accepts a matching state newer than
25 seconds at most once for that camera/entity per browser connection. It
never starts the microphone on mount. The popup should remove the card from
the page or its layout when closed, not just make it transparent. Leave the
option off in a normal panel, which rings only on a live edge.

In this view listening and talking are separate controls:

- A newly opened or restarted player starts **muted**, and the microphone stays
  off until you use it.
- The **Camera sound** button (**Kameraton**) plays the camera audio over the
  browser's speakers or mutes it again. It works without a call and never asks
  for the microphone. The browser's own video controls are hidden here, and
  MJPEG playback carries no audio, so no speaker button appears for it.
- **Start talking** (**Sprechen starten**) opens the microphone while nothing is
  ringing. Tapping it again (**Stop talking** / **Sprechen beenden**) releases
  the capture or discards a pending permission request and leaves the camera
  sound unchanged. **Answer** reuses manual talkback if already requested and
  attempts to enable camera sound when talkback connects. You can still toggle
  the speaker independently and use the in-call microphone mute.
- **End** releases the microphone and mutes the camera sound. The live video
  keeps running, and the speaker button turns the sound back on afterwards.
  Closing the popup, hiding the card or losing the connection also releases
  the microphone; it doesn't restart by itself.
- When the browser refuses audible playback, the video continues muted with
  *Camera sound is off. Select “Enable camera sound”.*; the next tap retries.

The Doorbell-only card shows its own overlay even if **Live-Controls Overlay
anzeigen** is off for other live views. Talking still requires a secure browser
context (HTTPS or localhost), microphone permission and a WebRTC stream with a
compatible speaker backchannel. MSE playback can carry camera sound but cannot
send microphone audio.

### PTZ button

In live view, tap **PTZ** on the camera you want to control. Opening the panel
never moves the camera. Use the arrows to pan or tilt, or **+ / −** to zoom.
Each tap sends a short movement followed by a stop request; **■** sends Stop
immediately. Close the panel with **×** or **Esc**. The same button is available
on individual multiview tiles. PTZ works with WebRTC or MSE live playback, not
with clips, recordings or direct MP4/HLS/MJPEG playback.

No Card YAML is needed. Enable ONVIF/PTZ for the camera in Frigate and leave
**Livestream → Live-Controls Overlay anzeigen** enabled in the Card editor.
The Card asks the Frigate integration which controls the camera supports. If
no button appears, check that the camera is available as a Frigate camera
entity in Home Assistant and that the Card selects the correct Frigate instance.
A custom HD/SD alias must be listed for that camera in Frigate; a direct
playback endpoint must also match the selected HA profile. An unverified
stream can still play but cannot show controls for a different camera.
Commands use the `frigate.ptz` action with that entity as the target; the HA
user needs permission to control it. The Card never publishes directly to MQTT.

## Ultra-Wide cameras in multiview

In the visual Card editor, open **Kameras**, expand a camera, and enable
**Ultra-Wide** to give that camera a complete row in the multiview grid. The
option is off by default. It is saved separately for each camera and can be
turned off again without changing that camera's name or stream settings.

The equivalent per-camera configuration is `ultra_wide: true`:

```yaml
type: custom:frigate-vision-card
multiview: true
multiview_columns_desktop: 3
multiview_columns_mobile: 2
cameras:
  entrance:
    name: Entrance
  panorama:
    name: Panorama
    ultra_wide: true
  garden:
    name: Garden
```

An Ultra-Wide camera spans all columns, regardless of the desktop or mobile
column count. Other cameras still occupy one column each and retain their
configured order. Multiple Ultra-Wide cameras each get their own full row.
The width is the **multiview grid inside this Card**, not the entire Home
Assistant dashboard or a neighbouring event list.

Omitting `ultra_wide` or setting it to `false` restores the normal grid layout.
Only the boolean value `true` enables it. Existing camera configurations remain
valid. The option does not change stream resolution, aspect ratio, image fit,
or the single-camera player.

## Multiple Frigate Vision entries

One loaded Frigate Vision entry is selected automatically. When Home Assistant
has multiple entries, select the profile explicitly:

```yaml
type: custom:frigate-vision-card
frigate_vision_entry_id: example-frigate-vision-entry
```

Use the Frigate Vision config-entry ID, not the Frigate client ID, camera
entity ID, or event ID. The Card waits for this profile before loading events.
It matches the media browser's Clips folder by Frigate client ID, not by its
position or display title. Event and review metadata use that same instance.
If no profile or explicit `frigate_client_id` identifies an instance, the Card
can use a single available Clips root; it reports an error rather than picking
one of several. If the selected root is missing, check that the Frigate media
browser is enabled for that instance.
