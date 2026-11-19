import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { chromium } from "playwright";
import sharp from "sharp";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

async function startHarnessServer() {
  const server = createServer(async (request, response) => {
    const requestedPath = decodeURIComponent((request.url || "/").split("?")[0]);
    const filePath = resolve(rootDirectory, `.${requestedPath}`);
    if (relative(rootDirectory, filePath).startsWith("..")) {
      response.writeHead(403).end();
      return;
    }
    try {
      const contents = await readFile(filePath);
      response.writeHead(200, {
        "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      }).end(contents);
    } catch {
      response.writeHead(404).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("actual vendored Lit runtime renders card/editor and completes lifecycle", async (t) => {
  const { server, url } = await startHarnessServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(`${url}/tests/card/browser-runtime-harness.html`);
  await page.waitForFunction(() => window.__frigateVisionBrowserRuntime);
  const result = await page.evaluate(async () => {
    const card = document.createElement("frigate-vision-card");
    card.setConfig({
      title: "Synthetic Frigate",
      cameras: {},
      initial_events: 1,
      events_per_load: 1,
      auto_refresh_seconds: 0,
      live_autostart: false,
    });
    document.body.append(card);
    await card.updateComplete;
    const initialText = card.renderRoot.textContent;

    card.setConfig({
      title: "Updated synthetic Frigate",
      cameras: {},
      initial_events: 1,
      events_per_load: 1,
      auto_refresh_seconds: 0,
      live_autostart: false,
    });
    await card.updateComplete;
    const updatedText = card.renderRoot.textContent;

    const editor = document.createElement("frigate-vision-card-editor");
    let editorConfig;
    editor.addEventListener("config-changed", (event) => {
      editorConfig = event.detail.config;
    });
    editor.setConfig({ title: "Editor synthetic" });
    document.body.append(editor);
    await editor.updateComplete;
    const editorRendered = Boolean(editor.renderRoot.querySelector(".editor"));
    editor._set("title", "Editor updated");
    await editor.updateComplete;

    card.remove();
    editor.remove();
    return {
      hlsVersion: window.__frigateVisionBrowserRuntime.hlsVersion,
      initialText,
      updatedText,
      editorRendered,
      editorTitle: editorConfig?.title,
    };
  });

  assert.equal(result.hlsVersion, "1.7.4");
  assert.match(result.initialText, /Synthetic Frigate/);
  assert.match(result.updatedText, /Updated synthetic Frigate/);
  assert.equal(result.editorRendered, true);
  assert.equal(result.editorTitle, "Editor updated");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
});

async function openRuntimePage(t) {
  const { server, url } = await startHarnessServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(`${url}/tests/card/browser-runtime-harness.html`);
  await page.waitForFunction(() => window.__frigateVisionBrowserRuntime);
  return page;
}

test("first clip renders before a delayed review; a detached load cannot overwrite the reconnected card", async (t) => {
  const page = await openRuntimePage(t);
  await page.evaluate(() => {
    const card = document.createElement("frigate-vision-card");
    const clips = "media-source://frigate/demo/event-search/clips//////";
    const event = {id: "first", camera: "gate", label: "person", start_time: 1700000000, data: {description: "Embedded description"}};
    const review = title => [{data: {metadata: {shortSummary: title}, detections: [event.id]}}];
    let reviewCalls = 0;
    card.setConfig({cameras: {gate: {}}, live_autostart: false});
    card.hass = {states: {}, callWS: async message => {
      if (message.type === "frigate_vision/profile") return {profile: {frigate_client_id: "demo"}};
      if (message.type === "frigate/events/get") return [event];
      if (message.type === "frigate/reviews/get") {
        if (++reviewCalls === 1) return new Promise(resolve => { window.releaseOld = () => resolve(review("Old review")); });
        return review("Fresh review");
      }
      if (message.media_content_id === "media-source://frigate") return {children: [{media_content_id: clips}]};
      if (message.media_content_id === clips) return {children: [{title: "Clip", can_expand: false,
        media_content_id: "media-source://frigate/demo/event/clips/gate/first", frigate: {event}}]};
      throw Error("Unexpected browse");
    }};
    const fetch = card._fetchAll.bind(card);
    card._fetchAll = () => {
      const run = fetch();
      window.firstLoad ??= run;
      return run;
    };
    document.body.append(card);
  });
  const desc = page.locator("frigate-vision-card .list .row .desc");
  await desc.filter({hasText: "Embedded description"}).waitFor(); // Old review still pending.
  await page.evaluate(() => {
    const card = document.querySelector("frigate-vision-card");
    card.remove();
    document.body.append(card);
  });
  await desc.filter({hasText: "Fresh review"}).waitFor();
  await page.evaluate(async () => { window.releaseOld(); await window.firstLoad; });
  assert.equal(await desc.textContent(), "Fresh review");
});

test("event panel matches the card and only event rows carry the subtle tint in light and dark layouts", async (t) => {
  const page = await openRuntimePage(t);
  for (const [layout, base, text] of [["split", 32, 245], ["stacked", 250, 25]]) {
    const points = await page.evaluate(async ({ layout, base, text }) => {
      document.body.replaceChildren();
      const card = document.createElement("frigate-vision-card");
      card.style.setProperty("--primary-text-color", `rgb(${text} ${text} ${text})`);
      card.setConfig({ layout, height: "450px", live_autostart: false, show_filters: false });
      card._events = [{ _eventId: "sample", _camera: "demo", _label: "test", _ts: new Date() }];
      card._snapshotUrl = () => null; // only render synthetic geometry, never load a picture
      document.body.append(card); await card.updateComplete;
      const root = card.renderRoot;
      root.querySelector("ha-card").style.background = `rgb(${base} ${base} ${base})`;
      const wrap = root.querySelector(`.is-${layout} > .right .list-wrap`);
      const row = wrap.querySelector(".list > .row");
      const w = wrap.getBoundingClientRect(), r = row.getBoundingClientRect();
      return [[w.left + 2, r.top + 25], [r.left + 4, r.top + 25]];
    }, { layout, base, text });
    // Sample the painted surfaces, not the CSS string: transparent overlays
    // and themes must composite on the actual card. Nothing is written to disk.
    const { data, info } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [i, [x, y]] of points.entries()) {
      const offset = (Math.floor(y) * info.width + Math.floor(x)) * info.channels;
      const expected = i === 0 ? base : base * .96 + text * .04;
      for (const actual of data.subarray(offset, offset + 3)) assert.ok(Math.abs(actual - expected) <= 1, `${layout} surface ${i}: ${actual} vs ${expected}`);
    }
  }
});

test("timeline wheel zoom still works and pending clip links are resolved after events arrive", async (t) => {
  const page = await openRuntimePage(t);
  const result = await page.evaluate(async () => {
    const card = document.createElement("frigate-vision-card");
    card.setConfig({ view_mode: "timeline", cameras: {}, live_autostart: false });
    document.body.append(card);
    card._timelineRangeStart = 1000;
    card._timelineRangeEnd = 3601000;
    await card.updateComplete;
    const track = card.renderRoot.querySelector(".timeline-track");
    track.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, cancelable: true }));
    const range = card._timelineVisibleRange();
    const opened = [];
    card._openClip = ev => opened.push(ev._eventId);
    history.replaceState(null, "", "#frigate_vision_clip=synthetic-clip");
    card._checkHashForClip();
    card._events = [{ _eventId: "synthetic-clip" }];
    card._checkHashForClip();
    card.remove();
    return { span: range.end - range.start, opened };
  });
  assert.deepEqual(result, { span: 1800000, opened: ["synthetic-clip"] });
});

test("camera picker uses the Frigate ID even for renamed HA entities; additions preserve existing camera settings", async (t) => {
  const page = await openRuntimePage(t);
  await page.evaluate(() => {
    const editor = document.createElement("frigate-vision-card-editor");
    const camera = (camera_name, client_id, friendly_name) => ({ attributes: { camera_name, client_id, friendly_name } });
    editor.hass = {
      states: {
        "camera.renamed_in_ha": camera("front_gate", "house", "Eingang"),
        "camera.alias_of_same_camera": camera("front_gate", "house", "Duplicate"),
        "camera.existing": camera("drive", "house", "Einfahrt"),
        "camera.other_site": camera("barn", "farm", "Scheune"),
        "camera.unrelated": { attributes: { friendly_name: "Webcam" } },
        "camera.not_frigate": camera("unrelated", "house", "Other platform"),
        "sensor.not_a_camera": camera("sensor", "house", "Sensor"),
      },
      entities: { "camera.not_frigate": { platform: "another_camera" } },
      callWS: async ({ type }) => {
        if (type !== "frigate_vision/camera_streams") throw Error("No profile lookup needed for an explicit client");
        return { streams: [], main: null, sub: null };
      },
    };
    editor.setConfig({ title: "Unchanged", frigate_client_id: "house", cameras: { drive: { name: "Carport", main: "hq", sub: "lq", ultra_wide: true } } });
    window.edits = [];
    editor.addEventListener("config-changed", (e) => { window.edits.push(e.detail.config); editor.setConfig(e.detail.config); });
    document.body.append(editor);
  });
  await page.getByRole("button", { name: "Kameras", exact: true }).click();
  const picker = page.getByRole("combobox", { name: "Kamera aus Frigate hinzufügen" });
  assert.deepEqual(await picker.locator("option").evaluateAll(opts => opts.map(o => [o.value, o.disabled])), [["", true], ["drive", true], ["front_gate", false]]);
  assert.equal(await page.evaluate(() => window.edits.length), 0);
  await picker.selectOption({ label: "Eingang (front_gate)" });
  const saved = await page.evaluate(() => window.edits.at(-1));
  assert.deepEqual(saved, { title: "Unchanged", frigate_client_id: "house", cameras: { drive: { name: "Carport", main: "hq", sub: "lq", ultra_wide: true }, front_gate: {} } });
  assert.ok(await picker.locator('option[value="front_gate"]').evaluate(o => o.disabled));
  await page.getByRole("button", { name: "front_gate entfernen" }).click();
  await page.getByRole("button", { name: "Kamera-ID manuell eingeben" }).click();
  const manual = page.getByRole("textbox", { name: "Frigate Kamera-ID" });
  await manual.fill("test_id"); await manual.press("Tab");
  assert.deepEqual(await page.evaluate(() => window.edits.at(-1).cameras), { drive: saved.cameras.drive, test_id: {} });
});

test("standalone camera picker handles a late HA state without fetching media or changing the all-cameras default", async (t) => {
  const page = await openRuntimePage(t);
  await page.setViewportSize({ width: 360, height: 720 });
  await page.evaluate(() => {
    const editor = document.createElement("frigate-vision-card-editor");
    window.lookups = []; window.saved = [];
    editor.setConfig({ cameras: "all" });
    editor.addEventListener("config-changed", (e) => window.saved.push(e.detail.config));
    editor.hass = { states: {}, callWS: async message => {
      window.lookups.push(message.type); throw Error("No optional Frigate Vision profile");
    } };
    document.body.append(editor);
  });
  await page.getByRole("button", { name: "Kameras", exact: true }).click();
  await page.getByText(/Keine Frigate-Kameras für diese Instanz/).waitFor();
  await page.evaluate(() => {
    const editor = document.querySelector("frigate-vision-card-editor");
    editor.hass = { ...editor.hass, states: { "camera.renamed": { attributes: { camera_name: "gate", client_id: "demo" } } } };
  });
  const picker = page.getByRole("combobox", { name: "Kamera aus Frigate hinzufügen" });
  await picker.waitFor();
  assert.deepEqual(await page.evaluate(() => [window.lookups, window.saved]), [["frigate_vision/profile"], []]);
  await picker.selectOption("gate");
  assert.deepEqual(await page.evaluate(() => window.saved.at(-1)), { cameras: { gate: {} } });
  await page.getByRole("button", { name: "gate entfernen" }).click();
  assert.deepEqual(await page.evaluate(() => window.saved.at(-1)), {});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

test("picker follows the selected profile, ignores stale replies and does not mix ambiguous instances", async (t) => {
  const page = await openRuntimePage(t);
  await page.evaluate(() => {
    const editor = document.createElement("frigate-vision-card-editor");
    window.finishProfile = {};
    editor.hass = { states: Object.fromEntries(["a", "b"].map(id => ["camera." + id, { attributes: { camera_name: id + "_cam", client_id: id } }])),
      callWS: ({ type, entry_id }) => {
        if (type !== "frigate_vision/profile") throw Error("Unexpected lookup");
        return new Promise(resolve => { window.finishProfile[entry_id || "auto"] = resolve; });
      } };
    editor.setConfig({ frigate_vision_entry_id: "old" }); document.body.append(editor);
  });
  await page.getByRole("button", { name: "Kameras", exact: true }).click();
  const setConfig = (cfg) => page.evaluate(cfg => document.querySelector("frigate-vision-card-editor").setConfig(cfg), cfg);
  const picker = page.getByRole("combobox", { name: "Kamera aus Frigate hinzufügen" });
  await setConfig({ frigate_vision_entry_id: "new" });
  await page.evaluate(() => window.finishProfile.new({profile: {frigate_client_id: "b"}}));
  await picker.waitFor();
  await page.evaluate(async () => { window.finishProfile.old({profile: {frigate_client_id: "a"}}); await document.querySelector("frigate-vision-card-editor").updateComplete; });
  const ids = () => picker.locator("option").evaluateAll(opts => opts.map(o => o.value));
  assert.deepEqual(await ids(), ["", "b_cam"]);
  await setConfig({ frigate_vision_entry_id: "missing" });
  await page.evaluate(() => window.finishProfile.missing(null));
  await page.getByText(/Profil ist nicht verfügbar/).waitFor();
  assert.equal(await picker.count(), 0);
  await setConfig({});
  await page.evaluate(() => window.finishProfile.auto(null));
  await page.getByRole("combobox", { name: "Frigate-Instanz auswählen" }).selectOption("a");
  await picker.waitFor();
  assert.deepEqual(await ids(), ["", "a_cam"]);
  assert.equal(await page.evaluate(() => document.querySelector("frigate-vision-card-editor")._config.frigate_client_id), "a");
});

async function openStreamEditor(t, cameras = {}) {
  const page = await openRuntimePage(t);
  await page.evaluate(cameras => {
    const editor = document.createElement("frigate-vision-card-editor");
    window.pendingStreams = {};
    window.saved = [];
    editor.hass = { states: Object.fromEntries(["gate", "yard"].map(id => ["camera.renamed_" + id, { attributes: { camera_name: id, client_id: "demo" } }])),
      callWS: msg => {
        if (msg.type !== "frigate_vision/camera_streams" || msg.instance_id !== "demo") throw Error("Unexpected command");
        return new Promise(resolve => { window.pendingStreams[msg.entity_id] = resolve; });
      } };
    editor.setConfig({ frigate_client_id: "demo", cameras });
    editor.addEventListener("config-changed", e => { window.saved.push(e.detail.config); editor.setConfig(e.detail.config); });
    document.body.append(editor);
  }, cameras);
  await page.getByRole("button", { name: "Kameras", exact: true }).click();
  return { page,
    add: id => page.getByRole("combobox", { name: "Kamera aus Frigate hinzufügen" }).selectOption(id),
    reply: (id, options) => page.evaluate(([id,options]) => window.pendingStreams["camera.renamed_" + id](options), [id,options]),
    field: (role, kind = "combobox") => page.getByRole(kind, { name: role === "main" ? "Main-Stream (HD)" : "Sub-Stream (SD)" }),
    saved: () => page.evaluate(() => window.saved.at(-1)?.cameras),
  };
}

test("new cameras get unambiguous stream aliases, ambiguous names stay selectable and manual values survive", async (t) => {
  const { page, add, reply, field, saved } = await openStreamEditor(t);
  await add("gate");
  await reply("gate", { streams: ["a", "b"], main: "a", sub: "b" });
  await field("main").waitFor();
  assert.equal(await field("main").inputValue(), "a");
  assert.equal(await field("sub").inputValue(), "b");
  assert.deepEqual(await saved(), { gate: { main: "a", sub: "b" } });
  await add("yard");
  await reply("yard", { streams: ["one", "two"], main: null, sub: null });
  assert.equal(await field("main").inputValue(), ""); assert.equal(await field("sub").inputValue(), "");
  assert.deepEqual(await field("main").locator("option").evaluateAll(opts => opts.map(o => o.value)), ["", "one", "two"]);
  await field("sub").selectOption("two");
  await page.getByRole("button", { name: "Namen manuell eingeben" }).click();
  await field("main", "textbox").fill("custom_unchanged"); await field("main", "textbox").press("Tab");
  await page.getByRole("button", { name: "Streamliste anzeigen" }).click();
  assert.equal(await field("main").inputValue(), "custom_unchanged");
  assert.deepEqual(await saved(), { gate: { main: "a", sub: "b" }, yard: { main: "custom_unchanged", sub: "two" } });
});

test("opening saved cameras is read-only; apply fills only empty fields, never an existing override", async (t) => {
  const { page, reply, field, saved } = await openStreamEditor(t, { gate: { name: "Gate", main: "existing", ultra_wide: true } });
  await page.getByRole("button", { name: "Gate", exact: true }).click();
  await reply("gate", { streams: ["hd", "sd"], main: "hd", sub: "sd" });
  assert.equal(await field("main").inputValue(), "existing"); assert.equal(await field("sub").inputValue(), "");
  assert.equal(await saved(), undefined);
  await page.getByRole("button", { name: "Vorschläge für leere Felder übernehmen" }).click();
  assert.deepEqual(await saved(), { gate: { name: "Gate", main: "existing", sub: "sd", ultra_wide: true } });
  await field("sub").selectOption("");
  assert.equal(await field("sub").inputValue(), "", "a deliberately cleared field stays empty");
});

test("a stale lookup cannot cross camera rows and a slow reply does not replace a focused draft", async (t) => {
  const { add, reply, field, saved } = await openStreamEditor(t);
  await add("gate"); await add("yard");
  await field("main", "textbox").fill("draft");
  await reply("gate", { streams: ["old"], main: "old", sub: null });
  await reply("yard", { streams: ["new_main", "new_sub"], main: "new_main", sub: "new_sub" });
  assert.equal(await field("main", "textbox").inputValue(), "draft");
  assert.equal(await field("sub", "textbox").inputValue(), "new_sub");
  await field("main", "textbox").press("Tab");
  assert.deepEqual(await saved(), { gate: {}, yard: { main: "draft", sub: "new_sub" } });
});

test("filter switch and language are independent; advanced numbers are visible, editable and retain zero", async (t) => {
  const page = await openRuntimePage(t);
  // No HA form custom elements are registered by this harness (as in frontends
  // without ha-textfield/ha-formfield). Drive the controls as a user would.
  await page.evaluate(() => {
    const editor = document.createElement("frigate-vision-card-editor");
    editor.setConfig({ title: "Keep me", cameras: "all" });
    window.saved = null;
    editor.addEventListener("config-changed", (e) => { window.saved = e.detail.config; editor.setConfig(e.detail.config); });
    document.body.append(editor);
  });
  const section = name => page.getByRole("button", { name, exact: true }).click();
  await section("Filter & Sprache");
  const filters = page.getByRole("switch", { name: "Ereignisfilter anzeigen" });
  const language = page.getByRole("combobox", { name: "Sprache der Karte" });
  assert.ok(await filters.isChecked());
  await filters.uncheck();
  assert.equal(await language.inputValue(), "auto");
  await language.selectOption("en");
  assert.equal(await filters.isChecked(), false);
  await section("Erweitert");
  const group = page.getByRole("spinbutton", { name: "Gruppierungszeitraum (Sekunden)" });
  const refresh = page.getByRole("spinbutton", { name: "Aktualisierungsintervall (Sekunden)" });
  assert.ok(await group.isVisible() && await refresh.isVisible());
  assert.equal(await group.inputValue(), "30"); assert.equal(await refresh.inputValue(), "0");
  await group.fill("0"); await group.press("Tab");
  await refresh.fill("15"); await refresh.press("Tab");
  await section("Filter & Sprache"); await section("Erweitert");
  assert.equal(await group.inputValue(), "0"); assert.equal(await refresh.inputValue(), "15");
  assert.deepEqual(await page.evaluate(() => window.saved), { title: "Keep me", cameras: "all", show_filters: false, language: "en", dedupe_window_seconds: 0, auto_refresh_seconds: 15 });
  await group.fill(""); await group.press("Tab");
  await refresh.fill("0"); await refresh.press("Tab");
  assert.equal(await group.inputValue(), "30"); assert.equal(await page.evaluate(() => window.saved.auto_refresh_seconds), 0);
});

test("Ultra-Wide editor switch persists across unrelated edits, save/reload and disable", async (t) => {
  const page = await openRuntimePage(t);
  const result = await page.evaluate(async () => {
    const makeEditor = async (config) => {
      const editor = document.createElement("frigate-vision-card-editor");
      editor.setConfig(config);
      editor._expandedSection = "cameras";
      editor._expandedCam = 0;
      document.body.append(editor);
      await editor.updateComplete;
      return editor;
    };
    const findSwitch = (editor) => {
      const input = editor.renderRoot.querySelector('.cam-entry-body input[role="switch"]');
      if (!input?.labels[0]?.textContent.includes("Ultra-Wide")) throw new Error("Per-camera Ultra-Wide control is missing");
      return input;
    };
    let saved;
    const capture = (editor) => editor.addEventListener("config-changed", (event) => {
      saved = JSON.parse(JSON.stringify(event.detail.config));
    });
    let editor = await makeEditor({
      type: "custom:frigate-vision-card", title: "Keep title", multiview_columns_desktop: 3,
      cameras: { front: { name: "Front", main: "main", sub: "sub" }, side: { name: "Side", main: "side" } },
    });
    capture(editor);
    const initiallyChecked = findSwitch(editor).checked;
    findSwitch(editor).checked = true;
    findSwitch(editor).dispatchEvent(new Event("change", { bubbles: true }));
    await editor.updateComplete;
    const enabled = saved;
    const name = [...editor.renderRoot.querySelectorAll('input[type="text"]')]
      .find(input => input.labels[0]?.textContent.includes("Anzeigename"));
    name.value = "Updated front";
    name.dispatchEvent(new Event("change", { bubbles: true }));
    await editor.updateComplete;
    const afterNameEdit = saved;
    editor.remove();
    editor = await makeEditor(JSON.parse(JSON.stringify(saved)));
    capture(editor);
    const reloadedChecked = findSwitch(editor).checked;
    findSwitch(editor).checked = false;
    findSwitch(editor).dispatchEvent(new Event("change", { bubbles: true }));
    await editor.updateComplete;
    const disabled = saved;
    editor.remove();
    editor = await makeEditor(JSON.parse(JSON.stringify(disabled)));
    const disabledAfterReload = findSwitch(editor).checked;
    editor.renderRoot.querySelector(".add-btn").click();
    await editor.updateComplete;
    const newCameraChecked = findSwitch(editor).checked;
    editor.remove();
    return { initiallyChecked, enabled, afterNameEdit, reloadedChecked, disabled, disabledAfterReload, newCameraChecked };
  });
  assert.equal(result.initiallyChecked, false);
  assert.equal(result.enabled.cameras.front.ultra_wide, true);
  assert.equal(result.afterNameEdit.cameras.front.ultra_wide, true);
  assert.equal(result.afterNameEdit.cameras.front.name, "Updated front");
  assert.equal(result.reloadedChecked, true);
  assert.equal(result.disabled.cameras.front.ultra_wide, undefined);
  assert.equal(result.disabledAfterReload, false);
  assert.equal(result.newCameraChecked, false);
  for (const config of [result.enabled, result.afterNameEdit, result.disabled]) {
    assert.equal(config.title, "Keep title");
    assert.equal(config.multiview_columns_desktop, 3);
    assert.equal(config.cameras.front.main, "main");
    assert.equal(config.cameras.front.sub, "sub");
    assert.deepEqual(config.cameras.side, { name: "Side", main: "side" });
  }
});

test("mixed Ultra-Wide tiles span responsive grid rows without overflow or distorted media", async (t) => {
  const page = await openRuntimePage(t);
  const scenarios = [
    ...[1, 2, 3, 4].map((columns) => ({ width: 1280, desktop: columns, mobile: 1, columns })),
    ...[1, 2, 4].map((columns) => ({ width: 360, desktop: 3, mobile: columns, columns })),
  ];
  for (const scenario of scenarios) {
    await page.setViewportSize({ width: scenario.width, height: 1000 });
    await page.evaluate(async ({ desktop, mobile }) => {
      window.layoutCard?.remove();
      const card = document.createElement("frigate-vision-card");
      card.style.display = "block";
      card.setConfig({
        cameras: {
          front: { name: "Front" }, panorama: { name: "Panorama", ultra_wide: true },
          side: { name: "Side" }, garden: { name: "Garden" },
          panoramic_rear: { name: "Rear", ultra_wide: true }, garage: { name: "Garage" },
        },
        multiview: true, multiview_layout: "stacked", layout: "mobile", desktop_breakpoint: 800,
        multiview_columns_desktop: desktop, multiview_columns_mobile: mobile,
        live_autostart: false, live_provider: "off", auto_refresh_seconds: 0,
      });
      window.layoutCard = card;
      document.body.append(card);
      await card.updateComplete;
    }, scenario);
    await page.waitForFunction(() => {
      const card = window.layoutCard;
      return card._cardWidth > 0 && Math.abs(card._cardWidth - card.getBoundingClientRect().width) < 1;
    });
    const result = await page.evaluate(async () => {
      const card = window.layoutCard;
      await card.updateComplete;
      const tiles = [...card.renderRoot.querySelectorAll("frigate-vision-live-tile")];
      for (const tile of tiles) {
        const width = tile.cameraEntry.ultra_wide ? 1600 : 800;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="450"><rect width="100%" height="100%" fill="teal"/></svg>`;
        tile._provider = "mjpeg";
        tile._loading = false;
        tile._mjpegSignedUrl = "data:image/svg+xml," + encodeURIComponent(svg);
        await tile.updateComplete;
        await tile.renderRoot.querySelector("img").decode();
      }
      const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const grid = card.renderRoot.querySelector(".multiview-grid");
      const gridRect = rect(grid);
      const tileRects = tiles.map((tile) => {
        const image = tile.renderRoot.querySelector("img");
        return { id: tile.cameraId, wide: tile.cameraEntry.ultra_wide, ...rect(tile), image: rect(image), ratio: image.naturalWidth / image.naturalHeight, fit: getComputedStyle(image).objectFit };
      });
      const overflow = document.documentElement.scrollWidth > innerWidth;
      const cameras = Object.fromEntries(Object.entries(card._config.cameras).map(([id, entry]) => [id, { ...entry, ultra_wide: false }]));
      card.setConfig({ ...card._config, cameras });
      await card.updateComplete;
      const disabledWidths = [...card.renderRoot.querySelectorAll("frigate-vision-live-tile")].map((tile) => rect(tile).width);
      return { grid: gridRect, tiles: tileRects, overflow, disabledWidths };
    });
    const normalWidth = (result.grid.width - (scenario.columns - 1) * 4) / scenario.columns;
    assert.equal(result.overflow, false, `overflow at ${scenario.width}px/${scenario.columns} columns`);
    assert.deepEqual(result.tiles.map((tile) => tile.id), ["front", "panorama", "side", "garden", "panoramic_rear", "garage"]);
    for (const tile of result.tiles) {
      assert.ok(Math.abs(tile.width - (tile.wide ? result.grid.width : normalWidth)) < 1, `${tile.id}: wrong tile width`);
      assert.ok(tile.x >= result.grid.x - 1 && tile.x + tile.width <= result.grid.x + result.grid.width + 1);
      assert.ok(Math.abs(tile.image.width / tile.image.height - tile.ratio) < 0.02, `${tile.id}: distorted media`);
      assert.equal(tile.fit, "contain");
      if (tile.wide) {
        assert.ok(Math.abs(tile.x - result.grid.x) < 1);
        assert.ok(result.tiles.every((other) => other.id === tile.id || Math.abs(other.y - tile.y) > 1), "wide camera shares a row");
      }
    }
    assert.ok(result.disabledWidths.every((width) => Math.abs(width - normalWidth) < 1), "disabling must restore one-column tiles");
  }
});
