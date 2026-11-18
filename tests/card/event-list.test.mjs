import assert from "node:assert/strict";
import test from "node:test";
import { loadCardRuntime } from "./load-card-runtime.mjs";

const { FrigateVisionCard } = await loadCardRuntime();
const instance = "media-source://frigate/demo/";
const search = `${instance}event-search/clips/`;
const root = { media_content_id: search + "/////" };
const directory = (id, title) => ({ media_content_id: id, title, can_expand: true });
const gate = directory(search + ".front_gate///front_gate//", "Front Gate (3)");

function clip(id, seconds, camera = "front_gate") {
  return {
    media_content_id: `${instance}event/clips/${camera}/${id}`, can_expand: false,
    title: "Same display title", frigate: { event: { id, camera, label: "person", start_time: 1720000000 + seconds } },
  };
}

function fixture(config, folders, contents = new Map()) {
  const card = new FrigateVisionCard();
  card.setConfig({ cameras: {front_gate: {}}, live_autostart: false, ...config });
  const reads = [];
  card.hass = { states: { "camera.unrelated_ha_name": {} }, callWS: async ({media_content_id}) => {
    reads.push(media_content_id);
    if (media_content_id === root.media_content_id) return { children: folders };
    assert.ok(contents.has(media_content_id), `unexpected media browse: ${media_content_id}`);
    return {children: contents.get(media_content_id)};
  } };
  return {card, reads};
}

test("camera ID comes from the selected instance's search path, not a display title, label or HA entity name", async () => {
  const folders = [directory(search + ".front_gate////front_gate/", gate.title),
    directory(search + ".front_gate/////front_gate", gate.title),
    directory(gate.media_content_id.replace("/demo/", "/other/"), gate.title), gate];
  const {card, reads} = fixture({}, folders, new Map([[gate.media_content_id, [clip("gate-event", 10)]]]));
  const {cameras, events} = await card._fetchFrigateEvents(root);
  assert.deepEqual(cameras, ["front_gate"]);
  assert.deepEqual(events.map(e => e._eventId), ["gate-event"]);
  assert.deepEqual(reads, [root.media_content_id, gate.media_content_id]);
});

test("direct media events from a small library need no camera-folder round trip", async () => {
  const {card, reads} = fixture({}, [clip("gate-event", 0), clip("other-event", 0, "back_door")]);
  const {cameras, events} = await card._fetchFrigateEvents(root);
  assert.deepEqual(cameras, ["front_gate"]);
  assert.deepEqual(events.map(e => e._eventId), ["gate-event"]);
  assert.deepEqual(reads, [root.media_content_id]);
});

test("older opaque folder IDs can still use the camera title", async () => {
  const legacy = directory(`${instance}legacy-folder`, "Front Gate (1)");
  const {card} = fixture({}, [legacy], new Map([[legacy.media_content_id, [clip("old", 0)]]]));
  card.hass.states = {"camera.front_gate": {}};
  assert.deepEqual((await card._fetchFrigateEvents(root)).events.map(e => e._eventId), ["old"]);
});

for (const [label, config, expected] of [
  ["default 30", {}, ["second"]],
  ["numeric zero", {dedupe_window_seconds: 0}, ["second", "first"]],
  ["string zero", {dedupe_window_seconds: "0"}, ["second", "first"]],
  ["custom 5", {dedupe_window_seconds: 5}, ["second", "first"]],
  ["invalid falls back", {dedupe_window_seconds: "invalid"}, ["second"]],
]) {
  test(`dedupe window: ${label}, repeated exact ID never shown twice`, async () => {
    const {card} = fixture(config, [gate], new Map([[gate.media_content_id, [clip("first", 0), clip("second", 10), clip("second", 10)]]]));
    const {events} = await card._fetchFrigateEvents(root);
    assert.deepEqual(events.map(e => e._eventId), expected);
  });
}

test("editing the dedupe window reloads an existing card only when the value changes", () => {
  const {card} = fixture({}, []);
  card.isConnected = true;
  card._hasFetchedOnce = true;
  let reloads = 0;
  card._fetchAll = () => reloads++;
  card.setConfig({dedupe_window_seconds: 0});
  card.setConfig({dedupe_window_seconds: "0"});
  assert.equal(card._config.dedupe_window_seconds, 0);
  assert.equal(reloads, 1);
});

test("a malformed review only affects that review, not valid event descriptions and sibling reviews", async () => {
  const card = new FrigateVisionCard();
  card.hass = { callWS: async ({ type }) => type === "frigate/events/get"
    ? [{id: "one", data: {description: "Original"}}, {id: "two", data: {description: "Second"}}]
    : [{data: "not JSON"}, {data: {metadata: {title: 7}, detections: {}}},
       {data: JSON.stringify({metadata: {title: "Valid"}, detections: ["two"]})}] };
  const rows = await card._fetchFrigateApiEvents("demo");
  assert.deepEqual(rows.map(r => [r.id, r.description, r.reviewTitle]), [["one", "Original", ""], ["two", "Second", "Valid"]]);
});
