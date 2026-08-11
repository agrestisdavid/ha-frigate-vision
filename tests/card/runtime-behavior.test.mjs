import assert from "node:assert/strict";
import test from "node:test";

import { loadCardRuntime } from "./load-card-runtime.mjs";

const runtime = await loadCardRuntime();
const {
  FrigateVisionCard,
  FrigateVisionLiveTile,
  LivestreamController,
  frigateProxyWsPath,
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
    null,
  );
});

test("central profile fills only missing card values and requests a render", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({ cameras: "all" });
  card.hass = {
    callWS: async () => ({
      profile: {
        frigate_client_id: "central-frigate",
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
  assert.equal(card._config.frigate_client_id, "central-frigate");
  assert.equal(card._config._go2rtc_direct_override, true);
  assert.equal(card.__requestUpdateCount, updatesBefore + 1);

  const overrideCard = new FrigateVisionCard();
  overrideCard.setConfig({
    cameras: "all",
    frigate_client_id: "card-frigate",
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
  assert.equal(overrideCard._config.frigate_client_id, "card-frigate");
});

test("profile client id falls back to the legacy id without creating a direct URL", async () => {
  const profileCard = new FrigateVisionCard();
  profileCard.setConfig({ cameras: "all" });
  profileCard.hass = {
    callWS: async () => ({
      profile: { frigate_client_id: "profile-frigate" },
    }),
  };

  await profileCard._loadCentralProfile();

  assert.equal(profileCard._config.frigate_client_id, "profile-frigate");
  assert.equal(profileCard._config.go2rtc_url, null);
  assert.equal(profileCard._config.go2rtc_url_external, null);
  assert.equal(profileCard._config._go2rtc_direct_override, false);

  const legacyCard = new FrigateVisionCard();
  legacyCard.setConfig({ cameras: "all" });
  legacyCard.hass = {
    callWS: async () => ({ profile: {} }),
  };
  await legacyCard._loadCentralProfile();
  assert.equal(legacyCard._config.frigate_client_id, "frigate");
});

test("connected profile lifecycle retries one transient selection failure", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({
    cameras: "all",
    frigate_vision_entry_id: "entry-one",
  });
  card.isConnected = true;
  card._fetchAll = async () => {};
  card._maybeStartAutoLive = () => {};
  card._waitForProfileRetry = async () => {};
  const calls = [];
  card.hass = {
    callWS: async (message) => {
      calls.push(message);
      if (calls.length === 1) throw new Error("temporary unavailable");
      return {
        profile: { frigate_client_id: "selected-frigate" },
      };
    },
  };

  card.updated(new Map([["hass", undefined]]));
  const recovered = await card._profileLifecyclePromise;

  assert.equal(recovered.frigate_client_id, "selected-frigate");
  assert.equal(card._config.frigate_client_id, "selected-frigate");
  assert.deepEqual(calls, [
    { type: "frigate_vision/profile", entry_id: "entry-one" },
    { type: "frigate_vision/profile", entry_id: "entry-one" },
  ]);
});

test("connected standalone profile lifecycle stops after two failures", async () => {
  const card = new FrigateVisionCard();
  card.setConfig({ cameras: "all" });
  card.isConnected = true;
  card._fetchAll = async () => {};
  card._maybeStartAutoLive = () => {};
  card._waitForProfileRetry = async () => {};
  let calls = 0;
  card.hass = {
    callWS: async () => {
      calls++;
      throw new Error("integration unavailable");
    },
  };

  card.updated(new Map([["hass", undefined]]));
  assert.equal(await card._profileLifecyclePromise, null);
  assert.equal(calls, 2);
});

test("connected entry changes reload the profile and restart only the latest live generation", async () => {
  const card = new FrigateVisionCard();
  const calls = [];
  const pending = new Map();
  card.hass = {
    callWS: async (message) => {
      calls.push(message);
      if (message.entry_id !== "entry-one") {
        return new Promise((resolve) => pending.set(message.entry_id, resolve));
      }
      return {
        profile: { frigate_client_id: "frigate-one" },
      };
    },
  };
  card.setConfig({
    cameras: "all",
    frigate_vision_entry_id: "entry-one",
  });
  card.isConnected = true;
  card._fetchAll = async () => {};
  card._maybeStartAutoLive = () => {};
  card.updated(new Map([["hass", undefined]]));
  await card._profileLifecyclePromise;
  card._liveMode = true;
  card._liveCamera = "driveway";
  let restarts = 0;
  card._ensureLivestreamController = () => ({
    restart: () => { restarts++; },
  });

  card.setConfig({
    cameras: "all",
    frigate_vision_entry_id: "entry-two",
  });
  const entryTwoLifecycle = card._profileLifecyclePromise;
  await Promise.resolve();
  card.setConfig({
    cameras: "all",
    frigate_vision_entry_id: "entry-three",
  });
  const entryThreeLifecycle = card._profileLifecyclePromise;
  await Promise.resolve();
  pending.get("entry-three")({
    profile: { frigate_client_id: "frigate-three" },
  });
  await entryThreeLifecycle;
  pending.get("entry-two")({
    profile: { frigate_client_id: "frigate-two" },
  });
  await entryTwoLifecycle;

  assert.deepEqual(
    calls.map((message) => message.entry_id),
    ["entry-one", "entry-two", "entry-three"],
  );
  assert.equal(card._config.frigate_client_id, "frigate-three");
  assert.equal(restarts, 1);
});

function makeLivestreamController(config, hass = null) {
  const video = {
    pause: () => {},
    removeAttribute: () => {},
    load: () => {},
    srcObject: null,
  };
  return new LivestreamController({
    getConfig: () => config,
    getHass: () => hass,
    getVideoEl: () => video,
    getStreamName: () => "driveway_main",
    onState: () => {},
    onUpdate: async () => {},
    logPrefix: "[Test Live]",
  });
}

test("Frigate proxy paths encode both MQTT client id and stream name", () => {
  assert.equal(
    frigateProxyWsPath(
      { frigate_client_id: "frigate/yard" },
      "driveway main/hd",
    ),
    "/api/frigate/frigate%2Fyard/go2rtc/ws/api/ws?src=driveway%20main%2Fhd",
  );
  assert.equal(
    frigateProxyWsPath(
      { frigate_client_id: "frigate/yard" },
      "driveway main/hd",
      true,
    ),
    "/api/frigate/frigate%2Fyard/mse/api/ws?src=driveway%20main%2Fhd",
  );
});

test("default live WebSocket uses a signed same-origin Frigate proxy path", async () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const socketUrls = [];
  const calls = [];
  const logged = [];
  globalThis.location.hostname = "ha.example.com";
  globalThis.location.protocol = "https:";
  globalThis.location.origin = "https://ha.example.com";
  globalThis.WebSocket = class WebSocketStub {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      socketUrls.push(url);
      queueMicrotask(() => {
        this.readyState = 1;
        this.onopen?.();
      });
    }
    close() {
      this.readyState = 3;
    }
  };
  console.info = (...args) => logged.push(args.join(" "));
  console.warn = (...args) => logged.push(args.join(" "));
  try {
    const controller = makeLivestreamController(
      {
        frigate_client_id: "yard/frigate",
        _go2rtc_direct_override: false,
      },
      {
        auth: { data: { access_token: "raw-token-must-not-appear" } },
        callWS: async (message) => {
          calls.push(message);
          return { path: `${message.path}&authSig=signed-secret` };
        },
      },
    );

    const ws = await controller._openGo2rtcWs("driveway main");

    assert.equal(ws.readyState, 1);
    assert.deepEqual(calls, [{
      type: "auth/sign_path",
      path:
        "/api/frigate/yard%2Ffrigate/go2rtc/ws/api/ws?src=driveway%20main",
      expires: 300,
    }]);
    assert.equal(socketUrls.length, 1);
    assert.match(
      socketUrls[0],
      /^wss:\/\/ha\.example\.com\/api\/frigate\/yard%2Ffrigate\/go2rtc\/ws\/api\/ws\?/,
    );
    assert.match(socketUrls[0], /authSig=signed-secret/);
    assert.doesNotMatch(socketUrls[0], /raw-token-must-not-appear/);
    assert.doesNotMatch(logged.join("\n"), /signed-secret|raw-token-must-not-appear/);
    controller.cleanup();
  } finally {
    globalThis.WebSocket = originalWebSocket;
    console.info = originalInfo;
    console.warn = originalWarn;
  }
});

test("proxy connection failure falls back to the signed legacy WebSocket path", async () => {
  const originalWebSocket = globalThis.WebSocket;
  const calls = [];
  const socketUrls = [];
  globalThis.location.hostname = "ha.example.com";
  globalThis.location.protocol = "https:";
  globalThis.location.origin = "https://ha.example.com";
  globalThis.WebSocket = class WebSocketStub {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      socketUrls.push(url);
      queueMicrotask(() => {
        if (url.includes("/go2rtc/ws/api/ws")) {
          this.onerror?.();
        } else {
          this.readyState = 1;
          this.onopen?.();
        }
      });
    }
    close() {
      this.readyState = 3;
    }
  };
  try {
    const controller = makeLivestreamController(
      {
        frigate_client_id: "frigate",
        _go2rtc_direct_override: false,
      },
      {
        callWS: async (message) => {
          calls.push(message);
          return { path: `${message.path}&authSig=test` };
        },
      },
    );

    const ws = await controller._openGo2rtcWs("driveway");

    assert.equal(ws.readyState, 1);
    assert.equal(calls.length, 2);
    assert.match(calls[0].path, /\/go2rtc\/ws\/api\/ws\?/);
    assert.match(calls[1].path, /\/mse\/api\/ws\?/);
    assert.equal(socketUrls.length, 2);
    assert.equal(controller._proxyRoute, "legacy");
    controller.cleanup();
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});

test("an explicit URL keeps direct go2rtc and does not request a HA signature", async () => {
  const originalWebSocket = globalThis.WebSocket;
  const socketUrls = [];
  globalThis.location.hostname = "ha.example.com";
  globalThis.location.protocol = "https:";
  globalThis.location.origin = "https://ha.example.com";
  globalThis.WebSocket = class WebSocketStub {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      socketUrls.push(url);
      queueMicrotask(() => {
        this.readyState = 1;
        this.onopen?.();
      });
    }
    close() {
      this.readyState = 3;
    }
  };
  try {
    const controller = makeLivestreamController(
      {
        go2rtc_url_external: "https://video.example.com",
        _go2rtc_direct_override: true,
      },
      {
        callWS: async () => {
          throw new Error("sign_path must not be used for a direct override");
        },
      },
    );

    await controller._openGo2rtcWs("driveway main");

    assert.deepEqual(
      socketUrls,
      ["wss://video.example.com/api/ws?src=driveway%20main"],
    );
    controller.cleanup();
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});

test("an internal-only direct URL uses the HA proxy from an external HA origin", () => {
  globalThis.location.hostname = "ha.example.com";
  globalThis.location.protocol = "https:";
  globalThis.location.origin = "https://ha.example.com";
  const controller = makeLivestreamController({
    go2rtc_url: "http://video.internal:1984",
    _go2rtc_direct_override: true,
  });

  assert.equal(controller._go2rtcBase(), null);
  assert.equal(controller._usesDirectGo2rtc(), false);
});

test("proxy mode tries WebRTC over WebSocket first and skips HTTP WHIP", async () => {
  const originalRtc = window.RTCPeerConnection;
  window.RTCPeerConnection = class {};
  try {
    const controller = makeLivestreamController({
      frigate_client_id: "frigate",
      go2rtc_modes: "webrtc,mse,mp4,hls,mjpeg",
      _go2rtc_direct_override: false,
    });
    let httpAttempts = 0;
    const order = [];
    controller._startWebRTCviaHTTP = async () => {
      httpAttempts++;
    };
    controller._startWebRTCviaWS = async () => {
      order.push("webrtc-ws");
    };

    await controller.start("driveway");

    assert.equal(httpAttempts, 0);
    assert.deepEqual(order, ["webrtc-ws"]);
  } finally {
    window.RTCPeerConnection = originalRtc;
  }
});

test("a failed proxy WebRTC attempt falls through to MSE without reordering", async () => {
  const originalRtc = window.RTCPeerConnection;
  const originalMediaSource = window.MediaSource;
  window.RTCPeerConnection = class {};
  window.MediaSource = class {};
  try {
    const controller = makeLivestreamController({
      frigate_client_id: "frigate",
      go2rtc_modes: "webrtc,mse,mp4,hls,mjpeg",
      _go2rtc_direct_override: false,
    });
    const order = [];
    controller._startWebRTCviaWS = async () => {
      order.push("webrtc");
      throw new Error("ICE unavailable");
    };
    controller._openGo2rtcWs = async () => {
      order.push("mse-open");
      return {};
    };
    controller._startMSE = async () => {
      order.push("mse");
    };

    await controller.start("driveway");

    assert.deepEqual(order, ["webrtc", "mse-open", "mse"]);
  } finally {
    window.RTCPeerConnection = originalRtc;
    window.MediaSource = originalMediaSource;
  }
});

class PeerConnectionRuntimeStub {
  static instances = [];

  constructor() {
    this.iceGatheringState = "complete";
    this.iceConnectionState = "new";
    this.connectionState = "new";
    this.localDescription = null;
    this.listeners = new Map();
    this.closed = false;
    PeerConnectionRuntimeStub.instances.push(this);
  }
  addTransceiver() {}
  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }
  emit(type) {
    this.listeners.get(type)?.();
  }
  async createOffer() {
    return { type: "offer", sdp: "offer" };
  }
  async setLocalDescription(description) {
    this.localDescription = description;
  }
  async setRemoteDescription() {}
  async addIceCandidate() {
    throw new Error("candidate contained 192.0.2.8 and secret details");
  }
  close() {
    this.closed = true;
    this.connectionState = "closed";
  }
}

function makeOpenWebSocket() {
  return {
    readyState: 1,
    sent: [],
    send(value) {
      this.sent.push(value);
    },
    close() {
      this.readyState = 3;
    },
  };
}

test("WebRTC WS requires both a video track and a connected transport", async () => {
  const originalRtc = globalThis.RTCPeerConnection;
  const originalWindowRtc = window.RTCPeerConnection;
  const originalMediaStream = globalThis.MediaStream;
  PeerConnectionRuntimeStub.instances = [];
  globalThis.RTCPeerConnection = PeerConnectionRuntimeStub;
  window.RTCPeerConnection = PeerConnectionRuntimeStub;
  globalThis.MediaStream = class {
    addTrack() {}
  };
  try {
    const states = [];
    const controller = new LivestreamController({
      getConfig: () => ({ _go2rtc_direct_override: false }),
      getHass: () => ({}),
      getVideoEl: () => null,
      getStreamName: () => "driveway",
      onState: (patch) => states.push(patch),
      onUpdate: async () => {},
    });
    const video = { srcObject: null, play: async () => {} };
    controller._openGo2rtcWs = async () => makeOpenWebSocket();
    let settled = false;
    const connecting = controller
      ._startWebRTCviaWS("driveway", video)
      .then(() => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();
    const pc = PeerConnectionRuntimeStub.instances.at(-1);

    pc.ontrack({ track: { kind: "video" } });
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(states.some((patch) => patch.provider === "webrtc"), false);

    pc.iceConnectionState = "connected";
    pc.emit("iceconnectionstatechange");
    await connecting;

    assert.equal(settled, true);
    assert.equal(states.some((patch) => patch.provider === "webrtc"), true);
    controller.cleanup();
  } finally {
    globalThis.RTCPeerConnection = originalRtc;
    window.RTCPeerConnection = originalWindowRtc;
    globalThis.MediaStream = originalMediaStream;
  }
});

test("direct HTTP WebRTC requires both a video track and connected ICE", async () => {
  const originalRtc = globalThis.RTCPeerConnection;
  const originalWindowRtc = window.RTCPeerConnection;
  const originalMediaStream = globalThis.MediaStream;
  const originalFetch = globalThis.fetch;
  PeerConnectionRuntimeStub.instances = [];
  globalThis.RTCPeerConnection = PeerConnectionRuntimeStub;
  window.RTCPeerConnection = PeerConnectionRuntimeStub;
  globalThis.MediaStream = class {
    addTrack() {}
  };
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => "answer",
  });
  globalThis.location.hostname = "localhost";
  globalThis.location.protocol = "http:";
  globalThis.location.origin = "http://localhost";
  try {
    const states = [];
    const controller = new LivestreamController({
      getConfig: () => ({
        go2rtc_url: "http://video.internal:1984",
        _go2rtc_direct_override: true,
      }),
      getHass: () => ({}),
      getVideoEl: () => null,
      getStreamName: () => "driveway",
      onState: (patch) => states.push(patch),
      onUpdate: async () => {},
    });
    const video = { srcObject: null, play: async () => {} };
    let settled = false;
    const connecting = controller
      ._startWebRTCviaHTTP("driveway", video)
      .then(() => { settled = true; });
    const pc = PeerConnectionRuntimeStub.instances.at(-1);

    pc.ontrack({ track: { kind: "video" } });
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(states.some((patch) => patch.provider === "webrtc"), false);

    pc.iceConnectionState = "connected";
    pc.emit("iceconnectionstatechange");
    await connecting;

    assert.equal(settled, true);
    assert.equal(states.some((patch) => patch.provider === "webrtc"), true);
    controller.cleanup();
  } finally {
    globalThis.RTCPeerConnection = originalRtc;
    window.RTCPeerConnection = originalWindowRtc;
    globalThis.MediaStream = originalMediaStream;
    globalThis.fetch = originalFetch;
  }
});

test("failed direct HTTP ICE falls through to the configured live fallback", async () => {
  const originalRtc = globalThis.RTCPeerConnection;
  const originalWindowRtc = window.RTCPeerConnection;
  const originalMediaSource = window.MediaSource;
  const originalFetch = globalThis.fetch;
  PeerConnectionRuntimeStub.instances = [];
  globalThis.RTCPeerConnection = PeerConnectionRuntimeStub;
  window.RTCPeerConnection = PeerConnectionRuntimeStub;
  window.MediaSource = class {};
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => "answer",
  });
  globalThis.location.hostname = "localhost";
  globalThis.location.protocol = "http:";
  globalThis.location.origin = "http://localhost";
  try {
    const controller = makeLivestreamController({
      go2rtc_url: "http://video.internal:1984",
      go2rtc_modes: "webrtc,mse",
      _go2rtc_direct_override: true,
    });
    const order = [];
    controller._startWebRTCviaWS = async () => {
      order.push("webrtc-ws");
      throw new Error("WebRTC candidates were unreachable");
    };
    controller._openGo2rtcWs = async () => {
      order.push("mse-open");
      return {};
    };
    controller._startMSE = async () => {
      order.push("mse");
    };

    const running = controller.start("driveway");
    const pc = PeerConnectionRuntimeStub.instances.at(-1);
    pc.iceConnectionState = "failed";
    pc.emit("iceconnectionstatechange");
    await running;

    assert.deepEqual(order, ["webrtc-ws", "mse-open", "mse"]);
    controller.cleanup();
  } finally {
    globalThis.RTCPeerConnection = originalRtc;
    window.RTCPeerConnection = originalWindowRtc;
    window.MediaSource = originalMediaSource;
    globalThis.fetch = originalFetch;
  }
});

test("unreachable WebRTC candidates fall back to MSE without exposing API errors", async () => {
  const originalRtc = globalThis.RTCPeerConnection;
  const originalWindowRtc = window.RTCPeerConnection;
  const originalMediaSource = window.MediaSource;
  const originalMediaStream = globalThis.MediaStream;
  const originalWarn = console.warn;
  PeerConnectionRuntimeStub.instances = [];
  globalThis.RTCPeerConnection = PeerConnectionRuntimeStub;
  window.RTCPeerConnection = PeerConnectionRuntimeStub;
  window.MediaSource = class {};
  globalThis.MediaStream = class {
    addTrack() {}
  };
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const states = [];
    const video = {
      srcObject: null,
      play: async () => {},
      pause: () => {},
      removeAttribute: () => {},
      load: () => {},
    };
    const controller = new LivestreamController({
      getConfig: () => ({
        frigate_client_id: "frigate",
        go2rtc_modes: "webrtc,mse",
        _go2rtc_direct_override: false,
      }),
      getHass: () => ({}),
      getVideoEl: () => video,
      getStreamName: () => "driveway",
      onState: (patch) => states.push(patch),
      onUpdate: async () => {},
    });
    const sockets = [];
    controller._openGo2rtcWs = async () => {
      const ws = makeOpenWebSocket();
      sockets.push(ws);
      controller._go2rtcWs = ws;
      return ws;
    };
    let mseStarts = 0;
    controller._startMSE = async () => {
      mseStarts++;
    };
    const running = controller.start("driveway");
    await Promise.resolve();
    await Promise.resolve();
    const pc = PeerConnectionRuntimeStub.instances.at(-1);
    const ws = sockets[0];

    await ws.onmessage({
      data: JSON.stringify({
        type: "webrtc/candidate",
        value: "candidate with private address",
      }),
    });
    pc.ontrack({ track: { kind: "video" } });
    pc.iceConnectionState = "failed";
    pc.emit("iceconnectionstatechange");
    await running;

    assert.equal(mseStarts, 1);
    assert.equal(states.some((patch) => patch.provider === "webrtc"), false);
    assert.doesNotMatch(
      warnings.join("\n"),
      /192\.0\.2\.8|secret details|private address/,
    );
    controller.cleanup();
  } finally {
    globalThis.RTCPeerConnection = originalRtc;
    window.RTCPeerConnection = originalWindowRtc;
    window.MediaSource = originalMediaSource;
    globalThis.MediaStream = originalMediaStream;
    console.warn = originalWarn;
  }
});

test("a superseded same-camera run cannot close the newer peer connection", async () => {
  const originalRtc = window.RTCPeerConnection;
  window.RTCPeerConnection = class {};
  try {
    const controller = makeLivestreamController({
      go2rtc_modes: "webrtc",
      _go2rtc_direct_override: false,
    });
    let resolveOld;
    const oldAttempt = new Promise((resolve) => {
      resolveOld = resolve;
    });
    let attempt = 0;
    const newerPeer = {
      closed: false,
      close() {
        this.closed = true;
      },
    };
    controller._startWebRTCviaWS = async () => {
      attempt++;
      if (attempt === 1) return oldAttempt;
      controller._peerConnection = newerPeer;
    };

    const firstRun = controller.start("driveway");
    await Promise.resolve();
    const secondRun = controller.start("driveway");
    await secondRun;
    resolveOld();
    await firstRun;

    assert.equal(newerPeer.closed, false);
    assert.equal(controller._peerConnection, newerPeer);
    controller.cleanup();
  } finally {
    window.RTCPeerConnection = originalRtc;
  }
});

test("failed direct HTTP WebRTC setup leaves no track timeout behind", async () => {
  const originalRtc = globalThis.RTCPeerConnection;
  const originalWindowRtc = window.RTCPeerConnection;
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const activeTimers = new Set();
  let nextTimer = 0;
  class PeerConnectionStub {
    constructor() {
      this.iceGatheringState = "complete";
      this.localDescription = null;
    }
    addTransceiver() {}
    addEventListener() {}
    async createOffer() {
      return { type: "offer", sdp: "offer" };
    }
    async setLocalDescription(description) {
      this.localDescription = description;
    }
    close() {}
  }
  globalThis.RTCPeerConnection = PeerConnectionStub;
  window.RTCPeerConnection = PeerConnectionStub;
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };
  globalThis.setTimeout = () => {
    const id = ++nextTimer;
    activeTimers.add(id);
    return id;
  };
  globalThis.clearTimeout = (id) => {
    activeTimers.delete(id);
  };
  globalThis.location.hostname = "localhost";
  globalThis.location.protocol = "http:";
  globalThis.location.origin = "http://localhost";
  try {
    const controller = makeLivestreamController({
      go2rtc_url: "http://video.internal:1984",
      _go2rtc_direct_override: true,
    });

    await assert.rejects(
      controller._startWebRTCviaHTTP("driveway", {}),
      /WebRTC signaling network failure/,
    );

    assert.equal(activeTimers.size, 0);
  } finally {
    globalThis.RTCPeerConnection = originalRtc;
    window.RTCPeerConnection = originalWindowRtc;
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("single-card autostart waits for central profile resolution", async () => {
  let resolveProfile;
  const profileResult = new Promise((resolve) => {
    resolveProfile = resolve;
  });
  const card = new FrigateVisionCard();
  card.setConfig({ cameras: { driveway: {} }, live_autostart: true });
  card.isConnected = true;
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
  await card._profileLifecyclePromise;
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

test("event titles show recognized people without reusing unrelated metadata", () => {
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
    "Person (Bekannter Besucher) in Einfahrt wurde erkannt",
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
