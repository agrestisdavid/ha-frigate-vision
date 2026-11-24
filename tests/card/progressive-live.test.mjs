import assert from "node:assert/strict";
import test from "node:test";
import { loadCardRuntime } from "./load-card-runtime.mjs";

// Native HLS and progressive MP4 live playback both hand a go2rtc URL to the
// <video> element and wait for its first decoded data. These tests pin the
// observable contract of both starts: provider state, URL, listeners,
// timeouts, errors and cancellation of a superseded run.

const { LivestreamController } = await loadCardRuntime();

const MODES = [
  {
    label: "HLS",
    provider: "hls",
    start: "_startHLS",
    timeoutMs: 8000,
    url: "http://video.internal:1984/api/stream.m3u8?src=front%20door&mp4=flac",
  },
  {
    label: "MP4",
    provider: "mp4",
    start: "_startMP4",
    timeoutMs: 6000,
    url: "http://video.internal:1984/api/stream.mp4?src=front%20door",
  },
];

const STALE = { message: "Livestream run was superseded", staleRun: true };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fakeVideo() {
  const listeners = new Map();
  return {
    src: undefined,
    loads: 0,
    plays: 0,
    added: [],
    addEventListener(type, listener, options) {
      this.added.push({ type, options });
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    load() {
      this.loads++;
    },
    async play() {
      this.plays++;
    },
    emit(type) {
      listeners.get(type)?.();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

function withBrowser(t, { protocol = "http:", nativeHls = true } = {}) {
  const originalLocation = { ...globalThis.location };
  const originalCreateElement = globalThis.document.createElement;
  globalThis.location.hostname = "localhost";
  globalThis.location.protocol = protocol;
  globalThis.location.origin = `${protocol}//localhost`;
  globalThis.document.createElement = (tag) => ({
    ...originalCreateElement(tag),
    canPlayType: (type) =>
      nativeHls && type === "application/vnd.apple.mpegurl" ? "maybe" : "",
  });
  t.after(() => {
    Object.assign(globalThis.location, originalLocation);
    globalThis.document.createElement = originalCreateElement;
  });
}

function makeController(video) {
  const states = [];
  const controller = new LivestreamController({
    getConfig: () => ({
      go2rtc_url: "http://video.internal:1984",
      _go2rtc_direct_override: true,
    }),
    getHass: () => null,
    getVideoEl: () => video,
    getStreamName: () => "front door",
    onState: (patch) => states.push(patch),
    onUpdate: async () => {},
    logPrefix: "[Test Live]",
  });
  return { controller, states };
}

function track(promise) {
  const outcome = { settled: false, error: null };
  promise.then(
    () => { outcome.settled = true; },
    (error) => { outcome.settled = true; outcome.error = error; },
  );
  return outcome;
}

for (const mode of MODES) {
  test(`${mode.label} live start loads the stream URL and resolves on first data`, async (t) => {
    withBrowser(t);
    const video = fakeVideo();
    const { controller, states } = makeController(video);

    const starting = controller[mode.start]("front door");
    const outcome = track(starting);
    assert.deepEqual(states, [{ provider: mode.provider }]);
    await flush();

    assert.equal(video.src, mode.url);
    assert.equal(video.loads, 1);
    assert.deepEqual(video.added, [
      { type: "loadeddata", options: { once: true } },
      { type: "error", options: { once: true } },
    ]);
    assert.equal(outcome.settled, false);

    video.emit("loadeddata");
    await starting;
    await flush();

    assert.deepEqual(states, [{ provider: mode.provider }, { loading: false }]);
    assert.equal(video.plays, 1);
    assert.equal(video.listenerCount, 0);
  });

  test(`${mode.label} live start rejects a media error without leaving listeners`, async (t) => {
    withBrowser(t);
    const video = fakeVideo();
    const { controller, states } = makeController(video);

    const starting = controller[mode.start]("front door");
    await flush();
    video.emit("error");

    await assert.rejects(starting, { message: `${mode.label} media failed` });
    assert.deepEqual(states, [{ provider: mode.provider }]);
    assert.equal(video.plays, 0);
    assert.equal(video.listenerCount, 0);
  });

  test(`${mode.label} live start times out after ${mode.timeoutMs} ms`, async (t) => {
    withBrowser(t);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const video = fakeVideo();
    const { controller, states } = makeController(video);

    const starting = controller[mode.start]("front door");
    const outcome = track(starting);
    await flush();

    t.mock.timers.tick(mode.timeoutMs - 1);
    await flush();
    assert.equal(outcome.settled, false);

    t.mock.timers.tick(1);
    await assert.rejects(starting, { message: `${mode.label} load timeout` });
    assert.deepEqual(states, [{ provider: mode.provider }]);
    assert.equal(video.listenerCount, 0);
  });

  test(`${mode.label} live start is cancelled before the video element is used`, async (t) => {
    withBrowser(t);
    const video = fakeVideo();
    const { controller, states } = makeController(video);

    const starting = controller[mode.start]("front door");
    controller._invalidateRun();

    await assert.rejects(starting, STALE);
    await flush();
    assert.equal(video.src, undefined);
    assert.equal(video.loads, 0);
    assert.deepEqual(video.added, []);
    assert.deepEqual(states, [{ provider: mode.provider }]);
  });

  test(`${mode.label} live start is cancelled while the stream is loading`, async (t) => {
    withBrowser(t);
    const video = fakeVideo();
    const { controller, states } = makeController(video);

    const starting = controller[mode.start]("front door");
    await flush();
    assert.equal(video.src, mode.url);
    controller._invalidateRun();

    await assert.rejects(starting, STALE);
    assert.equal(video.listenerCount, 0);
    video.emit("loadeddata");
    await flush();
    assert.deepEqual(states, [{ provider: mode.provider }]);
    assert.equal(video.plays, 0);
  });

  test(`${mode.label} live start rejects a missing video element`, async (t) => {
    withBrowser(t);
    const { controller, states } = makeController(null);

    await assert.rejects(controller[mode.start]("front door"), {
      message: "No video element",
    });
    assert.deepEqual(states, [{ provider: mode.provider }]);
  });

  test(`${mode.label} live start refuses a superseded run before any state change`, async (t) => {
    withBrowser(t);
    const video = fakeVideo();
    const { controller, states } = makeController(video);
    const staleRun = controller.runGeneration;
    controller._invalidateRun();

    await assert.rejects(controller[mode.start]("front door", staleRun), STALE);
    assert.deepEqual(states, []);
    assert.equal(video.src, undefined);
  });

  test(`${mode.label} live start refuses mixed content before any state change`, async (t) => {
    withBrowser(t, { protocol: "https:" });
    const video = fakeVideo();
    const { controller, states } = makeController(video);

    await assert.rejects(controller[mode.start]("front door"), {
      message:
        "Mixed Content: HA ist HTTPS, go2rtc_url ist HTTP. Browser blockiert den Request.",
    });
    assert.deepEqual(states, []);
    assert.equal(video.src, undefined);
  });
}

test("HLS live start requires native HLS support before any state change", async (t) => {
  withBrowser(t, { nativeHls: false });
  const video = fakeVideo();
  const { controller, states } = makeController(video);

  await assert.rejects(controller._startHLS("front door"), {
    message: "HLS native not supported in this browser",
  });
  assert.deepEqual(states, []);
  assert.equal(video.src, undefined);
});
