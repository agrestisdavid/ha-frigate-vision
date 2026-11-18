import assert from "node:assert/strict";
import test from "node:test";
import { loadCardRuntime } from "./load-card-runtime.mjs";

const { FrigateVisionCard } = await loadCardRuntime();
const rootId = "media-source://frigate";
const clips = (id) => `${rootId}/${id}/event-search/clips//////`;

function fixture(folders, config = {}) {
  const card = new FrigateVisionCard();
  card.setConfig({ live_autostart: false, ...config });
  const calls = [];
  card.hass = { states: {}, callWS: async (msg) => {
    calls.push(msg);
    if (msg.media_content_id === rootId) {
      return { children: folders.map(media_content_id => ({ media_content_id, title: "Shared name" })) };
    }
    if (msg.media_content_id) return { children: [] };
    return [];
  } };
  return { card, calls };
}

for (const [name, folders, config, expected] of [
  ["explicit second instance", [clips("first"), `${rootId}/second/recordings`, `${rootId}/second/event-search/snapshots//////`, clips("second")], { frigate_client_id: "second" }, "second"],
  ["sole non-default instance", [clips("only")], {}, "only"],
  ["ambiguous default", [clips("first"), clips("frigate")], {}, null],
  ["unavailable explicit instance", [clips("first")], { frigate_client_id: "second" }, null],
  ["duplicate matching roots", [clips("second"), clips("second")], { frigate_client_id: "second" }, null],
  ["unresolved named profile", [clips("first")], { frigate_vision_entry_id: "missing" }, null],
]) {
  test(`media routing: ${name}`, async () => {
    const { card, calls } = fixture(folders, config);
    await card._fetchAll();
    const reads = calls.filter(m => m.media_content_id && m.media_content_id !== rootId);
    const api = calls.filter(m => m.type.startsWith("frigate/"));
    if (expected) {
      assert.equal(card._error, null);
      assert.deepEqual(reads.map(m => m.media_content_id), [clips(expected)]);
      assert.deepEqual(api.map(m => [m.type, m.instance_id]), [["frigate/events/get", expected], ["frigate/reviews/get", expected]]);
    } else {
      assert.ok(card._error);
      assert.deepEqual(reads, []);
      assert.deepEqual(api, []);
    }
  });
}

test("event fetch waits for the selected profile and never queries the default instance first", async () => {
  const { card, calls } = fixture([clips("frigate"), clips("second")], { frigate_vision_entry_id: "entry-b" });
  let resolveProfile;
  const browse = card.hass.callWS;
  card.hass.callWS = msg => msg.type === "frigate_vision/profile"
    ? new Promise(resolve => { resolveProfile = resolve; }) : browse(msg);
  card.isConnected = true;
  card._startProfileLifecycle();
  const fetch = card._fetchAll();
  await Promise.resolve();
  assert.deepEqual(calls, []);
  resolveProfile({ profile: { frigate_client_id: "second" } });
  await fetch;
  assert.equal(card._error, null);
  assert.deepEqual(calls.filter(m => m.instance_id).map(m => m.instance_id), ["second", "second"]);
  assert.ok(calls.some(m => m.media_content_id === clips("second")));
});
