import assert from "node:assert/strict";
import test from "node:test";
import { loadCardRuntime } from "./load-card-runtime.mjs";

const { FrigateVisionCard } = await loadCardRuntime();

for (const [name, cameras] of [
  ["camera map", { Panorama: { name: "Panorama", main: "main", sub: "sub", ultra_wide: true } }],
  ["legacy id array", [{ id: "Panorama", name: "Panorama", main: "main", sub: "sub", ultra_wide: true }]],
  ["legacy keyed array", [{ Panorama: { name: "Panorama", main: "main", sub: "sub", ultra_wide: true } }]],
]) {
  test(`Ultra-Wide survives normalization and reload for ${name}`, () => {
    const input = { cameras };
    const original = JSON.stringify(input);
    const normalized = FrigateVisionCard._normalizeCamerasMap(input);
    assert.deepEqual(normalized.panorama, {
      name: "Panorama", main: "main", sub: "sub", ultra_wide: true,
    });
    assert.equal(JSON.stringify(input), original, "normalization must not mutate caller config");
    const card = new FrigateVisionCard();
    card.setConfig(JSON.parse(JSON.stringify({ cameras: normalized })));
    assert.equal(card._camEntry("PANORAMA").ultra_wide, true);
    assert.equal(card._go2rtcStreamFor("panorama", true), "main");
    assert.equal(card._go2rtcStreamFor("panorama", false), "sub");
    card.setConfig({ cameras: { panorama: { ...normalized.panorama, ultra_wide: false } } });
    assert.equal(card._camEntry("panorama").ultra_wide, false);
  });
}

test("Ultra-Wide is off for old configurations and non-boolean truthy values", () => {
  for (const cameras of ["entrance", ["entrance"], { entrance: {} }, [{ id: "entrance" }], [{ entrance: {} }]]) {
    assert.equal(FrigateVisionCard._normalizeCamerasMap({ cameras }).entrance.ultra_wide, false);
  }
  for (const value of [false, "true", "false", 1, 0, null, undefined]) {
    for (const cameras of [
      { entrance: { ultra_wide: value } },
      [{ id: "entrance", ultra_wide: value }],
      [{ entrance: { ultra_wide: value } }],
    ]) {
      assert.equal(FrigateVisionCard._normalizeCamerasMap({ cameras }).entrance.ultra_wide, false);
    }
  }
  assert.deepEqual(FrigateVisionCard._normalizeCamerasMap({ cameras: "all" }), {});
});
