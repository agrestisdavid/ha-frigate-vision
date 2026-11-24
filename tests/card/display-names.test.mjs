import assert from "node:assert/strict";
import test from "node:test";
import { loadCardRuntime } from "./load-card-runtime.mjs";

// Camera names and detection labels share one fallback that turns Frigate
// identifiers into readable words. Pin both callers, including the case
// handling that differs between them: labels are lowercased first, camera
// identifiers keep their remaining letters as configured.

const { FrigateVisionCard } = await loadCardRuntime();

function card(cameras = {}) {
  const instance = new FrigateVisionCard();
  instance.setConfig({ live_autostart: false, cameras });
  return instance;
}

function title(instance, label, camera = "driveway") {
  return instance._eventTitle({ _label: label, _camera: camera }, "en", {});
}

test("camera names prefer the configured name for any identifier case", () => {
  const instance = card({ front_door: { name: "Haustür" } });
  assert.equal(instance._camName("front_door"), "Haustür");
  assert.equal(instance._camName("FRONT_DOOR"), "Haustür");
});

test("unconfigured camera identifiers become capitalized words", () => {
  const instance = card();
  for (const [raw, expected] of [
    ["front_door", "Front Door"],
    ["front_door-cam", "Front Door Cam"],
    ["  garage__2--left  ", "Garage 2 Left"],
    ["back   yard", "Back Yard"],
    ["FRONT_door", "FRONT Door"],
    ["frontDoor", "FrontDoor"],
    ["über_tür", "Über Tür"],
    [42, "42"],
    ["_-_", ""],
    ["", ""],
    [null, ""],
    [undefined, ""],
  ]) {
    assert.equal(instance._camName(raw), expected, JSON.stringify(raw));
  }
});

test("event titles translate known labels and humanize unknown labels", () => {
  const instance = card({ driveway: { name: "Einfahrt" } });
  for (const [label, expected] of [
    ["person", "Person"],
    ["  CAR ", "Auto"],
    ["license_plate", "Kennzeichen"],
    ["delivery_box", "Delivery Box"],
    ["DELIVERY-Box", "Delivery Box"],
    ["  garbage__truck  ", "Garbage Truck"],
    ["", "Ereignis"],
    ["_", "Ereignis"],
  ]) {
    assert.equal(
      title(instance, label),
      `${expected} in Einfahrt wurde erkannt`,
      JSON.stringify(label),
    );
  }
});

test("event titles humanize an unconfigured camera and fall back to Frigate", () => {
  const instance = card();
  assert.equal(title(instance, "dog", "back_yard-2"), "Hund in Back Yard 2 wurde erkannt");
  assert.equal(title(instance, "dog", ""), "Hund in Frigate wurde erkannt");
});
