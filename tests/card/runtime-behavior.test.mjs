import assert from "node:assert/strict";
import test from "node:test";

import { loadCardRuntime } from "./load-card-runtime.mjs";

const runtime = await loadCardRuntime();
const {
  FrigateVisionCard,
  FrigateVisionLiveTile,
  go2rtcBase,
} = runtime;

test("go2rtc URL resolution follows local and external runtime context", () => {
  globalThis.location.hostname = "localhost";
  assert.equal(
    go2rtcBase({
      go2rtc_url: "http://go2rtc.internal:1984/",
      frigate_url: "http://frigate.internal:5000",
    }),
    "http://go2rtc.internal:1984",
  );
  assert.equal(
    go2rtcBase({ frigate_url: "http://frigate.internal:5000/" }),
    "http://frigate.internal:5000/api/go2rtc",
  );

  globalThis.location.hostname = "ha.example.com";
  assert.equal(
    go2rtcBase({
      go2rtc_url: "http://go2rtc.internal:1984",
      go2rtc_url_external: "https://go2rtc.example.com/",
    }),
    "https://go2rtc.example.com",
  );
  assert.equal(
    go2rtcBase({ go2rtc_url: "http://go2rtc.vpn:1984/" }),
    "http://go2rtc.vpn:1984",
  );
});

test("central profile fills only missing card values and requests a render", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({ cameras: "all" });
  card.hass = {
    callWS: async () => ({
      profile: {
        go2rtc_url: "http://central.internal:1984",
        go2rtc_url_external: "https://central.example.com",
        go2rtc_modes: "mjpeg,hls",
      },
    }),
  };
  const updatesBefore = card.__requestUpdateCount;

  await card._loadCentralProfile();

  assert.equal(card._config.go2rtc_url, "http://central.internal:1984");
  assert.equal(
    card._config.go2rtc_url_external,
    "https://central.example.com",
  );
  assert.equal(card._config.go2rtc_modes, "mjpeg,hls");
  assert.equal(card.__requestUpdateCount, updatesBefore + 1);

  const overrideCard = new FrigateVisionCard();
  overrideCard.setConfig({
    cameras: "all",
    go2rtc_url: "http://card.internal:1984",
    go2rtc_url_external: "https://card.example.com",
    go2rtc_modes: "webrtc,mp4",
  });
  overrideCard.hass = card.hass;

  await overrideCard._loadCentralProfile();

  assert.equal(overrideCard._config.go2rtc_url, "http://card.internal:1984");
  assert.equal(
    overrideCard._config.go2rtc_url_external,
    "https://card.example.com",
  );
  assert.equal(overrideCard._config.go2rtc_modes, "webrtc,mp4");
});

test("single-card autostart waits for central profile resolution", async () => {
  let resolveProfile;
  const profileResult = new Promise((resolve) => {
    resolveProfile = resolve;
  });
  const card = new FrigateVisionCard();
  card.setConfig({ cameras: { driveway: {} }, live_autostart: true });
  card.hass = { callWS: () => profileResult };
  card._fetchAll = () => Promise.resolve();
  let starts = 0;
  card._maybeStartAutoLive = () => {
    starts++;
  };

  card.updated(new Map([["hass", undefined]]));
  await Promise.resolve();
  assert.equal(starts, 0);

  resolveProfile({ profile: { go2rtc_url: "http://central:1984" } });
  await card._centralProfilePromise;
  await Promise.resolve();
  assert.equal(starts, 1);
});

test("exact Frigate match replaces media-source label and camera", () => {
  const card = new FrigateVisionCard();
  card._frigateApiById = new Map([
    [
      "event-exact",
      {
        id: "event-exact",
        label: "delivery_box",
        camera: "front_gate",
        description: "A parcel was delivered.",
      },
    ],
  ]);
  const exact = {
    _eventId: "event-exact",
    _label: "person",
    _camera: "driveway",
  };
  const unrelated = {
    _eventId: "event-other",
    _label: "car",
    _camera: "garage",
  };

  card._enrichEvents([exact, unrelated]);

  assert.equal(exact._label, "delivery_box");
  assert.equal(exact._camera, "front_gate");
  assert.equal(exact._frigate.description, "A parcel was delivered.");
  assert.equal(unrelated._label, "car");
  assert.equal(unrelated._camera, "garage");
  assert.equal(unrelated._frigate, undefined);
});

test("embedded media-source metadata keeps the exact Frigate event identity", () => {
  const card = new FrigateVisionCard();
  const embedded = card._embeddedFrigateEvent({
    media_content_id: "media-source://frigate/wrong-parsed-id",
    frigate: {
      event: {
        id: "1712345678.123456-exact",
        camera: "einfahrt",
        label: "person",
        sub_label: "visitor",
        start_time: 1712345678.25,
        end_time: 1712345684.5,
        has_clip: true,
        data: JSON.stringify({
          description: "Eine Person geht zum Eingang.",
        }),
      },
    },
  });

  assert.deepEqual(
    {
      id: embedded.id,
      camera: embedded.camera,
      label: embedded.label,
      subLabel: embedded.subLabel,
      description: embedded.description,
      hasClip: embedded.hasClip,
      startTime: embedded.startTime,
      endTime: embedded.endTime,
    },
    {
      id: "1712345678.123456-exact",
      camera: "einfahrt",
      label: "person",
      subLabel: "visitor",
      description: "Eine Person geht zum Eingang.",
      hasClip: true,
      startTime: 1712345678.25,
      endTime: 1712345684.5,
    },
  );
});

test("API enrichment preserves an embedded Frigate description when API data is empty", () => {
  const card = new FrigateVisionCard();
  const event = {
    _eventId: "exact-id",
    _camera: "fallback-camera",
    _label: "fallback-label",
    _frigate: {
      id: "exact-id",
      camera: "einfahrt",
      label: "person",
      description: "Eingebettete Beschreibung.",
      hasClip: true,
      startTime: 1712345678,
    },
  };
  card._frigateApiById = new Map([
    [
      "exact-id",
      {
        id: "exact-id",
        camera: "einfahrt",
        label: "person",
        description: "",
        hasClip: true,
        reviewTitle: "Besucher",
      },
    ],
  ]);

  card._enrichEvents([event]);

  assert.equal(event._frigate.description, "Eingebettete Beschreibung.");
  assert.equal(event._frigate.reviewTitle, "Besucher");
  assert.equal(event._hasClip, true);
  assert.equal(event._ts.getTime(), 1712345678 * 1000);
});

test("event titles use only the translated label and configured camera name", () => {
  const card = new FrigateVisionCard();
  card.setConfig({
    cameras: {
      einfahrt: {
        name: "Einfahrt",
        main: "einfahrt_1",
        sub: "einfahrt_2",
      },
    },
  });
  const event = {
    _label: "person",
    _camera: "einfahrt",
    _frigate: {
      reviewTitle: "KI-Titel",
      subLabel: "Bekannter Besucher",
      description: "Diese Beschreibung darf nicht zum Titel werden.",
    },
  };

  assert.equal(
    card._eventTitle(event, "en", { event_label: "Event" }),
    "Person in Einfahrt wurde erkannt",
  );

  event._label = "delivery_box";
  assert.equal(
    card._eventTitle(event, "de", { event_label: "Event" }),
    "Delivery Box in Einfahrt wurde erkannt",
  );
  assert.equal(
    card._eventFullDesc(event),
    "Diese Beschreibung darf nicht zum Titel werden.",
  );
});

test("unsigned HA Frigate paths use auth/sign_path and never the raw access token", async () => {
  const card = new FrigateVisionCard();
  const calls = [];
  card.hass = {
    auth: { data: { access_token: "must-not-appear" } },
    callWS: async (message) => {
      calls.push(message);
      return { path: `${message.path}?authSig=signed-value` };
    },
  };

  const signed = await card._signMediaPath(
    "/api/frigate/frigate/notifications/exact-id/clip.mp4",
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    type: "auth/sign_path",
    path: "/api/frigate/frigate/notifications/exact-id/clip.mp4",
    expires: 300,
  });
  assert.match(signed, /authSig=signed-value/);
  assert.doesNotMatch(signed, /must-not-appear/);

  const alreadySigned =
    "/api/frigate/frigate/notifications/exact-id/clip.mp4?authSig=existing";
  assert.equal(await card._signMediaPath(alreadySigned), alreadySigned);
  assert.equal(calls.length, 1);
});

test("clip playback starts with direct MP4 and keeps loading visible", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({
    cameras: "all",
    frigate_client_id: "frigate",
    language: "de",
  });
  const calls = [];
  card.hass = {
    callWS: async (message) => {
      calls.push(message);
      assert.equal(message.type, "auth/sign_path");
      return { path: `${message.path}?authSig=test` };
    },
  };
  const event = {
    _eventId: "event-mp4-first",
    _camera: "einfahrt",
    _hasClip: true,
    media_content_id: "media-source://frigate/event-mp4-first",
  };

  await card._openClip(event);

  assert.equal(card._activeClip, event);
  assert.equal(card._clipSourceKind, "event_mp4");
  assert.equal(card._clipLoading, true);
  assert.equal(card._clipError, null);
  assert.match(card._clipUrl, /clip\.mp4\?authSig=test$/);
  assert.equal(
    calls.some((message) => message.type === "media_source/resolve_media"),
    false,
  );
});

test("failed direct MP4 falls back to resolved HLS and bounded recording", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({
    cameras: "all",
    frigate_client_id: "frigate",
    language: "de",
  });
  card.hass = {
    callWS: async (message) => {
      if (message.type === "auth/sign_path") {
        const separator = message.path.includes("?") ? "&" : "?";
        return { path: `${message.path}${separator}authSig=test` };
      }
      if (message.type === "media_source/resolve_media") {
        return {
          url: "/api/frigate/frigate/vod/einfahrt/start/10/end/20/index.m3u8",
        };
      }
      throw new Error(`Unexpected call: ${message.type}`);
    },
  };
  const event = {
    _eventId: "event-fallbacks",
    _camera: "einfahrt",
    _hasClip: true,
    media_content_id: "media-source://frigate/event-fallbacks",
  };
  await card._openClip(event);
  const token = card._clipLoadToken;

  const mp4Timeout = new Error("MP4 timeout");
  mp4Timeout.clipKind = "timeout";
  await card._handleClipSourceFailure(
    mp4Timeout,
    token,
    card._clipAttemptId,
  );
  assert.equal(card._clipSourceKind, "resolved_hls");
  assert.match(card._clipUrl, /index\.m3u8\?authSig=test$/);

  const hlsNetwork = new Error("manifestLoadError");
  hlsNetwork.clipKind = "network";
  await card._handleClipSourceFailure(
    hlsNetwork,
    token,
    card._clipAttemptId,
  );
  assert.equal(card._clipSourceKind, "bounded_recording");
  assert.match(
    card._clipUrl,
    /\/recording\/einfahrt\/start\/10\/end\/20\?authSig=test$/,
  );

  const decoder = new Error("MEDIA_ERR_DECODE");
  decoder.clipKind = "decoder";
  await card._handleClipSourceFailure(
    decoder,
    token,
    card._clipAttemptId,
  );
  assert.equal(card._clipLoading, false);
  assert.match(card._clipError, /decodieren/);
  assert.doesNotMatch(card._clipError, /kein Clip/i);
});

test("resolve network errors and empty URLs still use metadata-bounded recording", async () => {
  const scenarios = [
    {
      name: "network error",
      resolve: () => {
        const error = new Error("resolve network failed");
        error.clipKind = "network";
        throw error;
      },
      event: {
        _eventId: "event-resolve-network",
        _camera: "fallback-camera",
        _hasClip: true,
        _frigate: {
          id: "event-resolve-network",
          camera: "einfahrt",
          startTime: 100,
          endTime: 400,
          hasClip: true,
        },
        media_content_id:
          "media-source://frigate/event-resolve-network",
      },
      expected:
        /\/recording\/einfahrt\/start\/100\/end\/220\?authSig=test$/,
    },
    {
      name: "empty URL",
      resolve: () => ({}),
      event: {
        _eventId: "event-resolve-empty",
        _camera: "garage",
        _hasClip: true,
        _frigate: {
          id: "event-resolve-empty",
          camera: "garage",
          startTime: 200.125,
          endTime: null,
          hasClip: true,
        },
        media_content_id: "media-source://frigate/event-resolve-empty",
      },
      expected:
        /\/recording\/garage\/start\/200\.125\/end\/230\.125\?authSig=test$/,
    },
  ];

  for (const scenario of scenarios) {
    const card = new FrigateVisionCard();
    card.setConfig({
      cameras: "all",
      frigate_client_id: "frigate",
      language: "de",
    });
    card.hass = {
      callWS: async (message) => {
        if (message.type === "auth/sign_path") {
          const separator = message.path.includes("?") ? "&" : "?";
          return { path: `${message.path}${separator}authSig=test` };
        }
        if (message.type === "media_source/resolve_media") {
          return scenario.resolve();
        }
        throw new Error(`Unexpected call: ${message.type}`);
      },
    };
    await card._openClip(scenario.event);
    const token = card._clipLoadToken;
    const timeout = new Error("direct MP4 timeout");
    timeout.clipKind = "timeout";

    await card._handleClipSourceFailure(
      timeout,
      token,
      card._clipAttemptId,
    );

    assert.equal(
      card._clipSourceKind,
      "bounded_recording",
      scenario.name,
    );
    assert.equal(card._clipLoading, true, scenario.name);
    assert.match(card._clipUrl, scenario.expected, scenario.name);
    assert.equal(card._clipError, null, scenario.name);
  }
});

test("no-clip text is limited to has_clip false and HTTP 404/410", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({
    cameras: "all",
    frigate_client_id: "frigate",
    language: "de",
  });
  let calls = 0;
  card.hass = {
    callWS: async () => {
      calls++;
      return {};
    },
  };

  await card._openClip({
    _eventId: "without-clip",
    _hasClip: false,
    media_content_id: "media-source://frigate/without-clip",
  });
  assert.equal(calls, 0);
  assert.match(card._clipError, /kein Clip verfügbar/);

  card._disposeActiveClip();
  card._activeClip = {
    _eventId: "gone",
    _hasClip: true,
    media_content_id: "media-source://frigate/gone",
  };
  card._clipLoadToken++;
  card._clipAttemptId++;
  card._clipLoading = true;
  card._clipSourceKind = "event_mp4";
  const gone = new Error("HTTP 410");
  gone.status = 410;
  await card._handleClipSourceFailure(
    gone,
    card._clipLoadToken,
    card._clipAttemptId,
  );
  assert.match(card._clipError, /kein Clip verfügbar/);

  const timeout = new Error("timeout");
  timeout.clipKind = "timeout";
  assert.equal(card._classifyClipError(timeout), "timeout");
  assert.match(card._clipFailureText("timeout"), /Zeitüberschreitung/);
  assert.doesNotMatch(card._clipFailureText("network"), /kein Clip/i);
});

test("a stale async signing result cannot replace the newer selected clip", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({
    cameras: "all",
    frigate_client_id: "frigate",
    language: "de",
  });
  card.hass = { callWS: async () => ({}) };
  let resolveFirst;
  const firstSigning = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  card._signMediaPath = async (url) => {
    if (url.includes("first-event")) return firstSigning;
    return `${url}?authSig=second`;
  };
  const first = {
    _eventId: "first-event",
    _camera: "einfahrt",
    _hasClip: true,
    media_content_id: "media-source://frigate/first-event",
  };
  const second = {
    _eventId: "second-event",
    _camera: "einfahrt",
    _hasClip: true,
    media_content_id: "media-source://frigate/second-event",
  };

  const firstOpen = card._openClip(first);
  await Promise.resolve();
  await card._openClip(second);
  resolveFirst(
    "/api/frigate/frigate/notifications/first-event/clip.mp4?authSig=first",
  );
  await firstOpen;

  assert.equal(card._activeClip, second);
  assert.equal(card._activeClip._eventId, "second-event");
  assert.match(card._clipUrl, /second-event\/clip\.mp4\?authSig=second$/);
  assert.doesNotMatch(card._clipUrl, /first-event/);
});

test("player gives MP4 40 seconds and resolved HLS 60 seconds", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({ cameras: "all", language: "de" });
  card._activeClip = { _eventId: "timeout-test" };
  card._clipLoadToken = 1;
  card._clipAttemptId = 1;
  card._clipUrl = "/event.mp4?authSig=test";
  card._clipSourceKind = "event_mp4";
  const video = {
    muted: false,
    volume: 0,
    pause: () => {},
    removeAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    load: () => {},
    play: async () => {},
  };
  card.renderRoot = { querySelector: () => video };
  const timeouts = [];
  card._loadVideoSrcAwait = async (_video, _url, timeout) => {
    timeouts.push(timeout);
  };
  card._tryAutoplay = async () => {};

  await card._initPlayer();

  card._clipAttemptId++;
  card._clipUrl = "/index.m3u8?authSig=test";
  card._clipSourceKind = "resolved_hls";
  card._loadHlsSrcAwait = async (_video, _url, timeout) => {
    timeouts.push(timeout);
  };
  await card._initPlayer();

  assert.deepEqual(timeouts, [40000, 60000]);
});

test("multiview tile reports metadata success and late decoder failure for the same attempt", async () => {
  const listeners = new Map();
  const video = {
    error: null,
    src: "",
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
    removeAttribute: (name) => {
      if (name === "src") video.src = "";
    },
    load: () => {},
    pause: () => {},
    play: async () => {},
  };
  const tile = new FrigateVisionLiveTile();
  tile.renderRoot = {
    querySelector: (selector) => selector === "video.clip" ? video : null,
  };
  tile.clipUrl = "/event.mp4?authSig=test";
  tile.clipSourceKind = "event_mp4";
  tile.clipLoadToken = 4;
  tile.clipAttemptId = 7;
  const emitted = [];
  tile.dispatchEvent = (event) => emitted.push(event);

  await tile._enterClipMode();
  listeners.get("loadedmetadata")();

  assert.equal(emitted[0].type, "clip-source-loaded");
  assert.deepEqual(emitted[0].detail, { token: 4, attemptId: 7 });

  video.error = { code: 3, message: "decode failed" };
  listeners.get("error")();

  assert.equal(emitted[1].type, "clip-source-error");
  assert.equal(emitted[1].detail.kind, "decoder");
  assert.equal(emitted[1].detail.token, 4);
  assert.equal(emitted[1].detail.attemptId, 7);
  tile._cleanupClip();
});

test("multiview tile ignores callbacks from a superseded clip attempt", async () => {
  const listeners = new Map();
  const video = {
    error: null,
    src: "",
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
    removeAttribute: (name) => {
      if (name === "src") video.src = "";
    },
    load: () => {},
    pause: () => {},
    play: async () => {},
  };
  const tile = new FrigateVisionLiveTile();
  tile.renderRoot = {
    querySelector: (selector) => selector === "video.clip" ? video : null,
  };
  const emitted = [];
  tile.dispatchEvent = (event) => emitted.push(event);
  tile.clipUrl = "/first.mp4?authSig=first";
  tile.clipSourceKind = "event_mp4";
  tile.clipLoadToken = 10;
  tile.clipAttemptId = 1;
  await tile._enterClipMode();
  const staleError = listeners.get("error");

  tile.clipUrl = "/second.mp4?authSig=second";
  tile.clipLoadToken = 11;
  tile.clipAttemptId = 2;
  await tile._enterClipMode();
  video.error = { code: 2, message: "network failed" };
  staleError();

  assert.equal(emitted.length, 0);

  listeners.get("error")();
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].detail.token, 11);
  assert.equal(emitted[0].detail.attemptId, 2);
  assert.equal(emitted[0].detail.kind, "network");
  tile._cleanupClip();
});

test("live tile restarts on profile-backed cardConfig changes outside clips", () => {
  const tile = new FrigateVisionLiveTile();
  tile._started = true;
  tile.hass = {};
  tile.cameraId = "driveway";
  tile.cardConfig = { go2rtc_url: "http://central:1984" };
  let starts = 0;
  tile._start = () => {
    starts++;
  };

  tile.updated(new Map([["cardConfig", {}]]));
  assert.equal(starts, 1);

  tile._clipMode = true;
  tile.updated(new Map([["cardConfig", tile.cardConfig]]));
  assert.equal(starts, 1);
});
