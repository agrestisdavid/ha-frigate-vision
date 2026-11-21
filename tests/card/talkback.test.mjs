import assert from "node:assert/strict";
import test from "node:test";
import { loadCardRuntime } from "./load-card-runtime.mjs";

const { LivestreamController } = await loadCardRuntime();

function microphone() {
  const track = { kind: "audio", enabled: true, readyState: "live", stop() { this.readyState = "ended"; } };
  return { track, getAudioTracks: () => [track], getTracks: () => [track] };
}

// Simulates only signaling/lifecycle. Decoded audio is checked separately in HA.
function fixture(t, { getMic = async () => microphone(), response = "accept", transport = "webrtc", config = {}, hass = {}, independentAudio = false } = {}) {
  const peers = [], paths = [], sockets = [], states = [], captures = [];
  const video = {
    paused: true, volume: 1, async play() { this.paused = false; }, pause() { this.paused = true; },
    removeAttribute() {}, getAttribute() { return null; }, load() {},
  };
  class Peer extends EventTarget {
    constructor() {
      super(); peers.push(this); this.transceivers = [];
      this.iceGatheringState = "complete"; this.iceConnectionState = "new";
    }
    addTransceiver(source, { direction }) {
      const tr = { source, direction, currentDirection: null };
      this.transceivers.push(tr); return tr;
    }
    async createOffer() { return { type: "offer", sdp: this.transceivers[0].direction }; }
    async setLocalDescription(desc) { this.localDescription = desc; }
    async setRemoteDescription() {
      for (const tr of this.transceivers) tr.currentDirection = response === "inactive" ? "inactive" : tr.direction;
      if (this.transceivers[0].source === "video") this.ontrack({ track: { kind: "video" } });
      // A backchannel must never wire up any receive track, even if emitted.
      this.ontrack({ track: { kind: "audio", peer: this } });
      this.iceConnectionState = "connected"; this.dispatchEvent(new Event("iceconnectionstatechange"));
    }
    close() { this.iceConnectionState = "closed"; }
  }
  class Socket {
    constructor(url) { this.url = url; sockets.push(this); this.readyState = 1; queueMicrotask(() => this.onopen?.()); }
    send(raw) {
      const { value } = JSON.parse(raw);
      const reject = value === "sendonly" && response === "reject" || value === "recvonly" && response === "rejectPlayback";
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(reject
        ? { type: "error", value: "private server details" } : { type: "webrtc/answer", value: "answer" }) }));
    }
    close() { this.readyState = 3; }
  }
  const globals = { RTCPeerConnection: Peer, WebSocket: Socket, MediaStream: class {
    tracks = [];
    addTrack(track) { this.tracks.push(track); }
    getAudioTracks() { return this.tracks.filter(track => track.kind === "audio"); }
  } };
  for (const [key, val] of Object.entries(globals)) {
    const old = globalThis[key]; globalThis[key] = val;
    t.after(() => { if (old) globalThis[key] = old; else delete globalThis[key]; });
  }
  window.RTCPeerConnection = Peer;
  t.after(() => { delete window.RTCPeerConnection; delete navigator.mediaDevices; });
  navigator.mediaDevices = { getUserMedia: async (options) => {
    assert.deepEqual(options, { audio: true, video: false });
    const stream = await getMic(); captures.push(stream); return stream;
  } };
  const live = new LivestreamController({
    independentAudio,
    getConfig: () => ({ frigate_client_id: "isolated", go2rtc_modes: transport, ...config }),
    getHass: () => ({ callWS: async (msg) => {
      assert.equal(msg.type, "auth/sign_path"); paths.push(msg.path);
      return { path: `${msg.path}&authSig=synthetic` };
    }, ...hass }),
    getVideoEl: () => video, getStreamName: () => "door SD", onState: (patch) => states.push(patch), onUpdate: async () => {},
  });
  t.after(() => live.cleanup());
  return { live, peers, paths, sockets, states, captures, video, get talk() { return states.filter(s => s.talk).at(-1)?.talk; } };
}

test("listening never asks for a microphone; talking signs a separate send-only consumer for exactly the playing alias", async (t) => {
  const f = fixture(t);
  await f.live.start("front_door");
  assert.equal(f.captures.length, 0);
  assert.deepEqual(f.peers[0].transceivers.map(({ source, direction }) => [source, direction]), [["video", "recvonly"], ["audio", "recvonly"]]);
  const playing = f.video.srcObject;
  await f.live.startTalk();
  assert.deepEqual(f.paths, Array(2).fill("/api/frigate/isolated/go2rtc/ws/api/ws?src=door%20SD"));
  assert.equal(f.talk, "sending");
  assert.deepEqual(f.peers[1].transceivers.map(tr => tr.direction), ["sendonly"]);
  assert.equal(f.peers[1].transceivers[0].source, f.captures[0].track);
  assert.deepEqual(playing.getAudioTracks().map(track => track.peer), [f.peers[0]]);
  f.live.stopTalk();
  assert.equal(f.captures[0].track.readyState, "ended");
  assert.equal(f.sockets[1].readyState, 3);
  assert.equal(f.peers[0].iceConnectionState, "connected");
  assert.equal(f.video.srcObject, playing);
});

const directUrl = "https://viewer.example.invalid/rtc";

test("Doorbell-only WS fallback does not inherit tracks from a failed direct HTTP playback attempt", async (t) => {
  const f = fixture(t, { independentAudio: true, config: { go2rtc_url_external: directUrl } });
  const failedSource = new MediaStream();
  failedSource.addTrack({ kind: "audio" });
  t.mock.method(f.live, "_startWebRTCviaHTTP", async (_name, video) => {
    video.srcObject = failedSource;
    throw Error("WebRTC ICE failed");
  });
  await f.live.start("door");
  assert.equal(f.video.muted, true);
  assert.notEqual(f.video.srcObject, failedSource);
  await f.live.enableCameraAudio();
  assert.equal(f.video.muted, false);
  assert.deepEqual(f.video.srcObject.getAudioTracks().map(track => track.peer), [f.peers[0]]);
  assert.equal(f.captures.length, 0);
  assert.equal(f.sockets.length, 1);
});

test("Doorbell-only MSE fallback receives on the existing video without capture and ignores stale unmute results", async (t) => {
  const f = fixture(t, { independentAudio: true, response: "rejectPlayback", transport: "webrtc,mse" });
  window.MediaSource = class {}; t.after(() => { delete window.MediaSource; });
  t.mock.method(f.live, "_startMSE", async (_socket, video) => {
    assert.equal(video.srcObject, null);
    video.srcObject = new window.MediaSource();
    f.live._setState({ provider: "mse" });
  });
  await f.live.start("door");
  const playing = f.video.srcObject;
  assert.equal(f.video.muted, true);
  await f.live.enableCameraAudio();
  assert.equal(f.video.muted, false);
  await f.live.startTalk({ verifyTarget: true });
  assert.equal(f.talk, "requiresWebRTC");
  assert.equal(f.video.srcObject, playing);
  assert.equal(f.captures.length, 0);
  assert.equal(f.sockets.length, 2); // Failed WebRTC and successful MSE, no talk link.
  assert.equal(f.sockets[0].readyState, 3);
  assert.equal(f.sockets[1].readyState, 1);

  f.live.muteCameraAudio();
  let rejectPlay;
  const normalPlay = f.video.play;
  f.video.play = () => new Promise((_resolve, reject) => { rejectPlay = reject; });
  const stale = f.live.enableCameraAudio();
  f.video.play = normalPlay;
  f.live.muteCameraAudio();
  await f.live.enableCameraAudio();
  rejectPlay(new DOMException("fixture", "NotAllowedError"));
  await stale;
  assert.equal(f.video.muted, false);
  assert.equal(f.states.at(-1).cameraAudio, "on");
});

function directFixture(t, { httpWorks = true, endpoint = directUrl, client = "isolated", streams = ["door SD"], standalone = false, duplicate = false, connected = true, lookup } = {}) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(url, `${directUrl}/api/webrtc?src=door%20SD`);
    return { ok: httpWorks, status: httpWorks ? 200 : 503, text: async () => "answer" };
  });
  const f = fixture(t, {
    config: { go2rtc_url_external: directUrl, frigate_vision_entry_id: "selected-profile" },
    hass: {
      connected,
      states: {
        "camera.renamed": { attributes: { camera_name: "front_door", client_id: "isolated" } },
        ...(duplicate ? { "camera.second": { attributes: { camera_name: "Front_Door", client_id: "isolated" } } } : {}),
      },
      callWS: standalone ? undefined : async msg => {
        calls.push(msg);
        if (msg.type === "frigate_vision/profile") return { profile: { go2rtc_url_external: endpoint, frigate_client_id: client } };
        if (msg.type === "frigate_vision/camera_streams") return lookup ? lookup() : { streams };
        if (msg.type === "auth/sign_path") return { path: `${msg.path}&authSig=synthetic` };
        throw Error("Unexpected HA command");
      },
    },
  });
  return { f, calls };
}

for (const httpWorks of [true, false]) {
  test(`direct ${httpWorks ? "HTTP" : "WS"} playback: only the verified stream's HA proxy may signal talk`, async (t) => {
    const { f, calls } = directFixture(t, { httpWorks });
    await f.live.start("front_door");
    assert.deepEqual(calls, []); assert.equal(f.captures.length, 0);
    const playing = f.video.srcObject;
    if (!httpWorks) assert.equal(f.sockets[0].url, "wss://viewer.example.invalid/rtc/api/ws?src=door%20SD");
    await f.live.startTalk();
    assert.equal(f.talk, "sending");
    assert.deepEqual(calls, [
      { type: "frigate_vision/profile", entry_id: "selected-profile" },
      { type: "frigate_vision/camera_streams", entity_id: "camera.renamed", instance_id: "isolated" },
      { type: "auth/sign_path", path: "/api/frigate/isolated/go2rtc/ws/api/ws?src=door%20SD", expires: 300 },
    ]);
    assert.equal(f.sockets.length, httpWorks ? 1 : 2);
    const actual = new URL(f.sockets.at(-1).url);
    assert.equal(actual.origin, location.origin.replace(/^http/, "ws"));
    assert.equal(actual.searchParams.get("authSig"), "synthetic");
    f.live.stopTalk(); assert.equal(f.video.srcObject, playing);
  });
}
for (const [description, opts, result] of [
  ["same alias on a different endpoint", { endpoint: "https://other.example.invalid" }, "unmapped"],
  ["different Frigate instance", { client: "not-the-selected-NVR" }, "unmapped"],
  ["alias not advertised for this camera", { streams: ["other door SD"] }, "unmapped"],
  ["duplicate camera identity", { duplicate: true }, "unmapped"],
  ["disconnected HA session", { connected: false }, "haUnavailable"],
  ["lookup denied", { lookup: () => { throw Error("no access"); } }, "unmapped"],
  ["standalone without HA", { standalone: true }, "haUnavailable"],
]) {
  test(`direct playback remains receive-only: ${description}`, async (t) => {
    const { f, calls } = directFixture(t, opts);
    await f.live.start("front_door"); const playing = f.video.srcObject;
    await f.live.startTalk();
    assert.equal(f.talk, result); assert.equal(f.captures.length, 0);
    assert.equal(f.sockets.length, 0); assert.ok(!calls.some(msg => msg.type === "auth/sign_path"));
    assert.equal(f.video.srcObject, playing); assert.equal(f.peers[0].iceConnectionState, "connected");
  });
}

test("releasing during direct stream verification cannot later start capture", async (t) => {
  let confirm;
  const lookup = () => new Promise(resolve => { confirm = resolve; });
  const { f } = directFixture(t, { lookup });
  await f.live.start("front_door"); const pending = f.live.startTalk();
  await Promise.resolve(); f.live.stopTalk(); confirm({ streams: ["door SD"] }); await pending;
  assert.equal(f.talk, "idle"); assert.equal(f.captures.length, 0); assert.equal(f.sockets.length, 0);
});

for (const [name, settings, expected] of [
  ["permission denied", { getMic: async () => { throw new DOMException("private device details", "NotAllowedError"); } }, "denied"],
  ["missing backchannel", { response: "reject" }, "noChannel"],
  ["inactive SDP answer", { response: "inactive" }, "noChannel"],
]) {
  test(`${name}: explain without exposing details or restarting playback`, async (t) => {
    const f = fixture(t, settings);
    await f.live.start("front_door"); const playing = f.video.srcObject;
    await f.live.startTalk();
    assert.equal(f.talk, expected);
    assert.equal(f.live.talkRequested, false);
    assert.equal(f.video.srcObject, playing);
    assert.equal(f.peers[0].iceConnectionState, "connected");
    for (const stream of f.captures) assert.equal(stream.track.readyState, "ended");
  });
}

test("cancel while permission is pending stops a late grant without signing a talk path", async (t) => {
  let grant;
  const f = fixture(t, { getMic: () => new Promise(resolve => { grant = resolve; }) });
  await f.live.start("door");
  const pending = f.live.startTalk();
  assert.equal(f.talk, "pending"); f.live.stopTalk();
  const stream = microphone(); grant(stream); await pending;
  assert.equal(f.paths.length, 1); assert.equal(f.talk, "idle"); assert.equal(stream.track.readyState, "ended");
});

for (const reason of ["camera switch", "playback disconnect", "talk socket close", "exit"]) {
  test(`${reason} releases capture and cannot resume it automatically`, async (t) => {
    const f = fixture(t);
    await f.live.start("door"); await f.live.startTalk();
    if (reason === "camera switch") f.live.switchCamera("yard");
    if (reason === "exit") f.live.cleanup();
    if (reason === "talk socket close") f.sockets[1].onclose();
    if (reason === "playback disconnect") {
      f.peers[0].iceConnectionState = "disconnected";
      f.peers[0].dispatchEvent(new Event("iceconnectionstatechange"));
      f.peers[0].iceConnectionState = "connected";
      f.peers[0].dispatchEvent(new Event("iceconnectionstatechange"));
    }
    assert.equal(f.captures[0].track.readyState, "ended"); assert.equal(f.live.talkRequested, false);
    assert.equal(f.captures.length, 1);
    f.live.cleanup(); // also invalidate any queued camera restart
  });
}

test("non-WebRTC playback never requests a microphone or opens a backchannel", async (t) => {
  const f = fixture(t, { transport: "mse" });
  t.mock.method(f.live, "_startMSE", async () => f.live._setState({ provider: "mse" }));
  window.MediaSource = class {}; t.after(() => { delete window.MediaSource; });
  await f.live.start("door"); await f.live.startTalk();
  assert.equal(f.states.find(s => s.provider)?.provider, "mse");
  assert.equal(f.live.playbackTarget.client, "isolated");
  assert.equal(f.live.playbackTarget.name, "door SD");
  assert.equal(f.talk, "requiresWebRTC"); assert.equal(f.captures.length, 0); assert.equal(f.paths.length, 1);
});
