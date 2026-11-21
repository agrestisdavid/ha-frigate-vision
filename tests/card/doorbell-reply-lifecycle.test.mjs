import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const frontend = new URL("../../custom_components/frigate_vision/frontend/", import.meta.url);
const ttsId = "d".repeat(32);

async function fixture(t, { tts = false, fakeClock = false } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const origin = "https://doorbell-fixture.invalid";
  await page.route("**/*", async route => {
    const { origin: requestOrigin, pathname } = new URL(route.request().url());
    if (requestOrigin !== origin) return route.abort();
    if (pathname === "/") return route.fulfill({ contentType: "text/html", body: '<!doctype html><script type="module" src="/frigate-vision-card.js"></script>' });
    if (["/frigate-vision-card.js", "/vendor/lit-3.3.3.js", "/vendor/hls-1.7.4.js"].includes(pathname)) {
      return route.fulfill({ contentType: "text/javascript", path: fileURLToPath(new URL(pathname.slice(1), frontend)) });
    }
    return route.abort();
  });
  if (fakeClock) await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto(origin);
  await page.evaluate(async ({ tts, ttsId }) => {
    await customElements.whenDefined("frigate-vision-doorbell");
    const entity = "binary_sensor.fixture_bell";
    const events = new Set();
    const f = window.f = { actions: [], rings: 0, micCalls: 0, press: 0 };
    window.Audio = class {
      play() {
        f.rings++;
        f.ringing = true;
        return new Promise(resolve => { f.finishRingPlay = resolve; });
      }
      pause() { f.ringing = false; f.actions.push("silence"); }
    };
    navigator.mediaDevices.getUserMedia = () => { f.micCalls++; throw Error("Must not access a microphone"); };
    const connection = {
      async subscribeEvents(callback, type) {
        if (type !== "state_changed") throw Error("Unexpected subscription");
        events.add(callback);
        return async () => events.delete(callback);
      },
    };
    const parent = document.body.appendChild(document.createElement("div"));
    parent.style = "position:relative;width:360px;height:240px";
    const video = f.video = parent.appendChild(document.createElement("video"));
    const hass = {
      connection,
      states: { "camera.door": { attributes: { camera_name: "door", client_id: "test" } } },
      async callWS(msg) {
        if (msg.type !== "frigate_vision/doorbell_replies" || msg.reply_id) throw Error("Unexpected callWS");
        return { replies: tts ? [{ id: ttsId, text: "Synthetic TTS" }] : null };
      },
    };
    f.mount = async ({ popup = false } = {}) => {
      f.bell?.remove();
      const bell = f.bell = document.createElement("frigate-vision-doorbell");
      Object.assign(bell, { hass, cameraId: "door", instanceId: "test", talkState: "idle", ringOnMount: popup,
        settings: { entity, from: "off", to: "on" } });
      bell.controller = {
        playbackTarget: { client: "test", camera: "door" },
        playDoorbellReply(reply) {
          f.actions.push(["reply", reply, f.ringing]);
          this.announcement = true;
          return new Promise(resolve => { f.finishReply = sent => { this.announcement = false; resolve(sent); }; });
        },
        stopAnnouncement() {
          if (this.announcement) f.actions.push("stopAnnouncement");
          this.announcement = false;
        },
        async startTalk(options) {
          f.actions.push(["startTalk", options, this.announcement, f.ringing]);
          this.talkRequested = true;
          bell.talkState = "sending";
        },
        stopTalk() { f.actions.push("stopTalk"); this.talkRequested = false; bell.talkState = "idle"; },
      };
      parent.appendChild(bell);
      await bell.updateComplete;
    };
    f.stamp = () => new Date().toISOString().replace("Z", `${String(++f.press).padStart(3, "0")}Z`);
    f.ring = (stamp = f.stamp()) => {
      const state = { state: "on", last_changed: stamp };
      hass.states[entity] = state;
      for (const cb of events) cb({ data: { entity_id: entity, old_state: { state: "off" }, new_state: state } });
      return stamp;
    };
    f.setSnapshot = stamp => { hass.states[entity] = { state: "on", last_changed: new Date(stamp).toISOString() }; };
    f.resetSensor = () => {
      hass.states[entity] = { state: "off", last_changed: f.stamp() };
      f.bell.hass = { ...hass };
    };
    f.snapshot = () => ({ actions: f.actions, rings: f.rings, ringing: f.ringing, micCalls: f.micCalls,
      sameVideo: parent.querySelector("video") === video, hasAudioRef: !!f.bell._ringAudio });
    await f.mount();
  }, { tts, ttsId });
  await page.waitForFunction(() => f.bell._subscription?.unsubscribe);
  return page;
}

const button = (page, name) => page.getByRole("button", { name, exact: true });
async function chooseReply(page, text = "Einen Moment bitte") {
  await button(page, "Quick replies").click();
  await button(page, text).click();
}

for (const tts of [false, true]) test(`${tts ? "TTS" : "bundled"} reply silences immediately; the same call remains answerable after success`, async t => {
  const page = await fixture(t, { tts });
  const stamp = await page.evaluate(() => f.ring());
  await chooseReply(page, tts ? "Synthetic TTS" : undefined);
  assert.deepEqual(await page.evaluate(() => f.snapshot()), {
    actions: ["silence", ["reply", tts ? ttsId : "wait", false]],
    rings: 1, ringing: false, micCalls: 0, sameVideo: true, hasAudioRef: false,
  });
  await page.evaluate(stamp => { f.resetSensor(); f.ring(stamp); f.finishReply(true); }, stamp);
  await page.getByText("Incoming call (ringtone muted)").waitFor();
  await button(page, "Decline call").waitFor();
  await button(page, "Answer").click();
  await button(page, "End").click();
  assert.deepEqual((await page.evaluate(() => f.snapshot())).actions.slice(2), [
    ["startTalk", { verifyTarget: true, listen: true }, false, false], "stopTalk",
  ]);
  assert.equal((await page.evaluate(() => f.snapshot())).rings, 1);
});

for (const accept of [true, false]) test(`${accept ? "answer" : "end"} during reply cancels pending audio; late completion is ignored`, async t => {
  const page = await fixture(t);
  await page.evaluate(() => f.ring());
  await chooseReply(page);
  await button(page, accept ? "Answer" : "End").click();
  await page.evaluate(() => { f.finishRingPlay(); f.finishReply(false); });
  if (accept) await button(page, "End").click();
  assert.deepEqual(await page.evaluate(() => f.snapshot()), {
    actions: ["silence", ["reply", "wait", false], "stopAnnouncement", ...(accept ? [
      ["startTalk", { verifyTarget: true, listen: true }, false, false], "stopTalk",
    ] : [])], rings: 1, ringing: false, micCalls: 0, sameVideo: true, hasAudioRef: false,
  });
  await button(page, "Answer").waitFor({ state: "hidden" });
});

test("a muted call survives panel and popup rebuilds without ringing or reviving a declined call", async t => {
  const page = await fixture(t);
  const stamp = await page.evaluate(() => f.ring());
  await chooseReply(page);
  await page.evaluate(() => { f.finishReply(false); f.resetSensor(); });
  await page.getByText("Could not send the announcement.").waitFor();
  await page.evaluate(() => f.mount());
  await page.getByText("Incoming call (ringtone muted)").waitFor();
  await page.evaluate(async stamp => { await f.mount({ popup: true }); f.ring(stamp); }, stamp);
  await button(page, "Decline call").click();
  await page.evaluate(async stamp => { await f.mount({ popup: true }); f.ring(stamp); }, stamp);
  assert.equal(await button(page, "Answer").count(), 0);
  assert.equal((await page.evaluate(() => f.snapshot())).rings, 1);
  await page.evaluate(() => f.ring());
  await button(page, "Answer").waitFor();
  assert.equal((await page.evaluate(() => f.snapshot())).rings, 2);
});

test("the rounded popup snapshot aliases the precise HA edge, even when rebuilt during a reply", async t => {
  const page = await fixture(t);
  const stamp = await page.evaluate(async () => {
    const stamp = f.stamp();
    f.setSnapshot(stamp);
    await f.mount({ popup: true });
    return stamp;
  });
  await chooseReply(page);
  await page.evaluate(async stamp => {
    f.ring(stamp);
    f.setSnapshot(stamp);
    await f.mount({ popup: true });
    f.finishReply(true);
  }, stamp);
  await page.getByText("Incoming call (ringtone muted)").waitFor();
  assert.deepEqual(await page.evaluate(() => f.snapshot()), {
    actions: ["silence", ["reply", "wait", false], "stopAnnouncement"],
    rings: 1, ringing: false, micCalls: 0, sameVideo: true, hasAudioRef: false,
  });
  await button(page, "Decline call").click();
});

test("a distinct edge in the same millisecond can replace a muted reply, but an older replay cannot", async t => {
  const page = await fixture(t);
  const initial = await page.evaluate(() => f.ring());
  await chooseReply(page);
  await page.evaluate(initial => {
    f.ring(initial.replace(/001Z$/, "002Z"));
    f.ring(initial);
    f.finishReply(false);
  }, initial);
  await page.getByText("Doorbell ringing").waitFor();
  const result = await page.evaluate(() => f.snapshot());
  assert.deepEqual(result.actions, ["silence", ["reply", "wait", false], "stopAnnouncement"]);
  assert.equal(result.rings, 2);
  assert.equal(result.ringing, true);
});

test("call cache and audio references expire without new events; stale edges cannot ring again", async t => {
  const page = await fixture(t, { fakeClock: true });
  const stamp = await page.evaluate(() => f.ring());
  await chooseReply(page);
  await page.clock.fastForward(61_000); // reply deliberately does not complete
  assert.deepEqual(await page.evaluate(() => ({ entries: f.bell._subscription.calls.size, reply: f.bell._reply,
    timer: f.bell._expires, audio: f.bell._ringAudio, incoming: f.bell._incoming, actions: f.actions })), {
    entries: 0, reply: null, timer: null, audio: null, incoming: false,
    actions: ["silence", ["reply", "wait", false], "stopAnnouncement"],
  });
  await page.evaluate(async stamp => { f.finishReply(true); f.ring(stamp); await f.mount({ popup: true }); }, stamp);
  assert.equal(await button(page, "Answer").count(), 0);
  await page.evaluate(() => f.ring());
  await button(page, "Decline call").click();
  await page.clock.fastForward(26_000);
  assert.equal(await page.evaluate(() => f.bell._subscription.calls.size), 0);
  assert.equal((await page.evaluate(() => f.snapshot())).rings, 2);
});
