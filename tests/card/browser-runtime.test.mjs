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

async function openRuntimePage(t, options = {}) {
  const { server, url } = await startHarnessServer();
  t.after(() => server.close());
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage(options);
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

test("talk mode defaults to toggle; the editor saves hold and reloads it without changing cameras", async (t) => {
  const page = await openRuntimePage(t);
  const cameras = { door: { name: "Door", main: "door_hd", sub: "door_sd" } };
  const mount = async () => page.evaluate(async (cameras) => {
    const config = JSON.parse(sessionStorage.getItem("card") || "null") || { cameras };
    const editor = document.createElement("frigate-vision-card-editor");
    editor.setConfig(config);
    editor._expandedSection = "livestream";
    editor.addEventListener("config-changed", e => sessionStorage.setItem("card", JSON.stringify(e.detail.config)));
    document.body.append(editor);
    await editor.updateComplete;
    const card = document.createElement("frigate-vision-card");
    card.setConfig(config);
    return card._config.talk_mode;
  }, cameras);
  assert.equal(await mount(), "toggle");
  const select = page.getByLabel("Sprechtaste");
  assert.equal(await select.inputValue(), "toggle");
  await select.selectOption("hold");
  await page.reload();
  await page.waitForFunction(() => window.__frigateVisionBrowserRuntime);
  assert.equal(await mount(), "hold");
  assert.equal(await select.inputValue(), "hold");
  await select.selectOption("toggle");
  assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem("card"))), { cameras, talk_mode: "toggle" });
});

test("talk button toggles on click, holds across pointer travel, and stops on cancel, keyup or removal", async (t) => {
  const page = await openRuntimePage(t);
  await page.evaluate(async () => {
    const button = document.createElement("frigate-vision-talk-button");
    window.talkActions = [];
    button.controller = {
      talkRequested: false,
      startTalk() { this.talkRequested = true; window.talkActions.push("start"); button.state = "sending"; },
      stopTalk() { this.talkRequested = false; window.talkActions.push("stop"); button.state = "idle"; },
    };
    document.body.append(button);
    await button.updateComplete;
  });
  const button = page.getByRole("button");
  const actions = () => page.evaluate(() => window.talkActions);
  assert.deepEqual(await actions(), []);
  await button.click();
  assert.equal(await button.getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("status").textContent(), "Microphone on air");
  await button.click();
  await page.locator("frigate-vision-talk-button").evaluate(el => { el.mode = "hold"; });
  await button.hover(); await page.mouse.down();
  await page.mouse.move(350, 180); await page.mouse.up();
  await button.hover(); await page.mouse.down();
  await button.dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.up(); // a trailing native click must not reopen it
  await button.focus(); await page.keyboard.down("Space"); await page.keyboard.down("Space"); await page.keyboard.up("Space");
  await button.hover(); await page.mouse.down();
  await page.locator("frigate-vision-talk-button").evaluate(el => el.remove());
  await page.mouse.up();
  assert.deepEqual(await actions(), Array.from({ length: 5 }, () => ["start", "stop"]).flat());
});

async function openPtzCard(t, config = {}) {
  const page = await openRuntimePage(t, { hasTouch: true, viewport: { width: 360, height: 780 } });
  await page.evaluate(config => {
    const card = document.createElement("frigate-vision-card");
    const state = (camera_name, client_id = "demo") => ({ state: "streaming", attributes: { camera_name, client_id } });
    window.ptzCalls = []; window.ptzLookups = []; window.ptzAliasLookups = []; window.profileLookups = 0;
    card.hass = {
      states: { "camera.other_instance": state("Gate", "frigate"), "camera.renamed": state("Gate"),
        "camera.fixed": state("fixed"), "camera.zoom": state("zoom"), "camera.pending": state("pending"),
        "camera.alias_a": state("duplicate"), "camera.alias_b": state("duplicate") },
      services: { frigate: { ptz: {} } },
      callWS: async msg => {
        if (msg.type === "frigate_vision/profile") {
          window.profileLookups++;
          const profile = { profile: { frigate_client_id: "demo" } };
          return config.frigate_vision_entry_id ? new Promise(resolve => { window.finishProfile = () => resolve(profile); }) : profile;
        }
        if (msg.type === "media_source/browse_media") return { children: msg.media_content_id === "media-source://frigate" ? [{ media_content_id: "media-source://frigate/demo/event-search/clips//////" }] : [] };
        if (msg.type === "frigate_vision/camera_streams") {
          window.ptzAliasLookups.push(msg.entity_id);
          return { streams: msg.entity_id === "camera.renamed" ? ["alias_sd", "alias_hd"] : [] };
        }
        if (msg.type !== "frigate/ptz/info") return [];
        window.ptzLookups.push(msg);
        if (msg.camera === "pending") return new Promise(resolve => { window.finishInfo = () => resolve({ features: ["pt"] }); });
        if (msg.camera === "Gate") return JSON.stringify({ features: ["pt", "zoom"] });
        return { features: msg.camera === "zoom" ? ["zoom"] : [] };
      },
      callService: async (...args) => { window.ptzCalls.push(args); if (window.denyPtz) throw Error("Unauthorized"); },
    };
    card.setConfig({ language: "de", go2rtc_modes: "webrtc", live_autostart: false, layout: "stacked", multiview_layout: "stacked",
      cameras: { gate: { name: "Display alias", main: "alias_hd", sub: "alias_sd" }, fixed: {}, zoom: {}, duplicate: {} },
      frigate_client_id: "demo", ...config });
    // Keep the real live lifecycle/target selection; only replace media I/O.
    const proto = Object.getPrototypeOf(card._ensureLivestreamController());
    proto._startWebRTCviaHTTP = proto._startWebRTCviaWS = async function (name, video, runId) {
      this._playbackReady(name, video, runId, this._config());
    };
    document.body.append(card);
    if (!card._config.multiview) card._openLive("gate");
  }, config);
  return page;
}

const ptzCall = (entity, action, argument) => ["frigate", "ptz", argument ? { action, argument } : { action }, { entity_id: `camera.${entity}` }];

test("PTZ is a normal disclosure button; only its controls send targeted, bounded moves", async (t) => {
  const page = await openPtzCard(t);
  const toggle = page.getByRole("button", { name: "PTZ", exact: true });
  await toggle.waitFor();
  const panel = page.getByRole("dialog");
  assert.equal(await panel.count(), 0);
  await toggle.tap(); await panel.waitFor();
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await toggle.tap(); await panel.waitFor({ state: "hidden" });
  await toggle.press("Enter"); await panel.waitFor();
  assert.deepEqual(await page.evaluate(() => window.ptzCalls), []);
  await panel.getByRole("button", { name: "Nach rechts" }).press("Space");
  await page.waitForFunction(() => window.ptzCalls.length >= 2);
  assert.deepEqual(await page.evaluate(() => window.ptzCalls), [ptzCall("renamed", "move", "right"), ptzCall("renamed", "stop")]);
  await page.evaluate(() => { window.denyPtz = true; });
  await panel.getByRole("button", { name: "Hineinzoomen" }).click();
  await panel.getByRole("alert").waitFor();
  await page.keyboard.press("Escape"); await panel.waitFor({ state: "hidden" });
  assert.deepEqual(await page.evaluate(() => window.ptzCalls.slice(2)), [ptzCall("renamed", "zoom", "in"), ptzCall("renamed", "stop")]);
  assert.deepEqual(await page.evaluate(() => window.ptzLookups), [{ type: "frigate/ptz/info", instance_id: "demo", camera: "Gate" }]);
});

test("multiview PTZ waits for the selected instance and exposes only that tile's capabilities", async (t) => {
  const page = await openPtzCard(t, { multiview: true, hd_sd_button_position: "bottom", frigate_client_id: null, frigate_vision_entry_id: "selected" });
  await page.waitForFunction(() => window.finishProfile && document.querySelector("frigate-vision-card").renderRoot.querySelectorAll("frigate-vision-live-tile").length === 4);
  assert.deepEqual(await page.evaluate(() => window.ptzLookups), []);
  await page.evaluate(() => window.finishProfile());
  const tiles = page.locator("frigate-vision-live-tile");
  const toggle = tiles.nth(2).getByRole("button", { name: "PTZ", exact: true });
  await toggle.click();
  const panel = tiles.nth(2).getByRole("dialog");
  assert.equal(await panel.getByRole("button", { name: "Nach links" }).count(), 0);
  // Press Stop in the same turn, before the automatic stop timer can fire.
  await panel.getByRole("button", { name: "Herauszoomen" }).evaluate(button => {
    button.click(); button.closest("dialog").querySelector('[aria-label="Stopp"]').click();
  });
  assert.equal(await tiles.nth(1).getByText("PTZ", { exact: true }).count(), 0);
  assert.equal(await tiles.nth(3).getByText("PTZ", { exact: true }).count(), 0);
  assert.deepEqual(await page.evaluate(() => window.ptzLookups.map(m => [m.instance_id, m.camera]).sort()), [["demo", "Gate"], ["demo", "fixed"], ["demo", "zoom"]]);
  assert.deepEqual(await page.evaluate(() => window.ptzCalls), [ptzCall("zoom", "zoom", "out"), ptzCall("zoom", "stop")]);
  await page.evaluate(() => { document.querySelector("frigate-vision-card")._clipError = "Synthetic clip";
    document.querySelector("frigate-vision-card")._activeClip = { _camera: "zoom" }; });
  await panel.waitFor({ state: "hidden" });
  assert.equal(await toggle.count(), 0);
  assert.equal(await tiles.nth(2).locator("frigate-vision-talk-button").count(), 0);
  const gate = tiles.first();
  assert.equal(await gate.getByRole("button", { name: "PTZ", exact: true }).count(), 1);
  assert.equal(await gate.locator(".hd-sd-wrap--top frigate-vision-talk-button").count(), 1);
  assert.equal(await gate.locator(".hd-sd-wrap--bottom .hd-sd-btn").count(), 1);
});

test("switching to an unrelated HD alias keeps playback but removes PTZ", async (t) => {
  const page = await openPtzCard(t, { cameras: { gate: { main: "other_camera", sub: "alias_sd" } } });
  const ptz = page.getByRole("button", { name: "PTZ", exact: true });
  await ptz.waitFor();
  await page.locator(".hd-sd-btn").click();
  await page.waitForFunction(() => window.ptzAliasLookups.length >= 2);
  assert.equal(await ptz.count(), 0);
  assert.equal(await page.locator("frigate-vision-talk-button button").count(), 1);
  assert.deepEqual(await page.evaluate(() => window.ptzCalls), []);
});

test("an unverified direct playback endpoint cannot expose PTZ for a same-named camera", async (t) => {
  const page = await openPtzCard(t, { go2rtc_url: "https://other.example.invalid" });
  await page.waitForFunction(() => window.profileLookups >= 2);
  await page.locator("frigate-vision-talk-button button").waitFor();
  assert.equal(await page.getByRole("button", { name: "PTZ", exact: true }).count(), 0);
  assert.deepEqual(await page.evaluate(() => [window.ptzLookups, window.ptzCalls]), [[], []]);
});

test("hiding the live controls hides both camera actions without removing HD/SD", async (t) => {
  const page = await openPtzCard(t, { live_controls: false });
  await page.waitForFunction(() => document.querySelector("frigate-vision-card")._liveProvider === "webrtc");
  assert.equal(await page.locator("frigate-vision-talk-button, frigate-vision-ptz").count(), 0);
  assert.equal(await page.locator(".hd-sd-btn").count(), 1);
  assert.deepEqual(await page.evaluate(() => window.ptzLookups), []);
});

test("switching cameras stops the original entity and stale PTZ info cannot open controls", async (t) => {
  const page = await openPtzCard(t);
  const toggle = page.getByRole("button", { name: "PTZ", exact: true });
  await toggle.click();
  await page.getByRole("button", { name: "Nach oben" }).evaluate(button => {
    button.click(); document.querySelector("frigate-vision-card")._switchLiveCamera("pending");
  });
  await page.waitForFunction(() => window.finishInfo && window.ptzCalls.length === 2);
  await page.evaluate(async () => {
    const card = document.querySelector("frigate-vision-card");
    card._switchLiveCamera("fixed"); await card.updateComplete; window.finishInfo();
  });
  await page.waitForFunction(() => window.ptzLookups.some(m => m.camera === "fixed"));
  assert.equal(await toggle.count(), 0);
  assert.deepEqual(await page.evaluate(() => window.ptzCalls), [ptzCall("renamed", "move", "up"), ptzCall("renamed", "stop")]);
});

test("doorbell editor persists exact states and disabled settings without losing camera fields", async (t) => {
  const page = await openRuntimePage(t);
  const input = {
    type: "custom:frigate-vision-card", title: "Keep title",
    cameras: [{ id: "Door", name: "Door", main: "door HD", sub: "door SD", ultra_wide: true,
      extra_camera_setting: { keep: true }, doorbell: { enabled: true, entity: " BINARY_SENSOR.BELL ", from: "Ready", to: "Pressed", extra_setting: 2 } }, "side"],
  };
  await page.evaluate(config => {
    const editor = document.createElement("frigate-vision-card-editor");
    editor.setConfig(config);
    editor.addEventListener("config-changed", ({ detail }) => { window.lastConfig = detail.config; });
    document.body.append(editor);
  }, input);
  await page.getByRole("button", { name: "Kameras", exact: true }).click();
  await page.getByRole("button", { name: "Door", exact: true }).click();
  const toggle = page.getByLabel("Doorbell (Türklingel)");
  const entity = page.getByLabel("Klingel-Entität (Home Assistant)");
  assert.equal(await entity.inputValue(), "binary_sensor.bell");
  const target = page.getByLabel("Zielzustand");
  await target.fill(" Door Pressed "); await target.blur();
  await toggle.uncheck();
  const expected = {
    type: input.type, title: input.title, cameras: { door: {
      ...Object.fromEntries(Object.entries(input.cameras[0]).filter(([key]) => key !== "id")),
      doorbell: { enabled: false, entity: "binary_sensor.bell", from: "Ready", to: " Door Pressed ", extra_setting: 2 },
    }, side: {} },
  };
  assert.deepEqual(await page.evaluate(() => window.lastConfig), expected);
  await page.evaluate(() => document.querySelector("frigate-vision-card-editor").setConfig(JSON.parse(JSON.stringify(window.lastConfig))));
  await toggle.check();
  assert.equal(await target.inputValue(), " Door Pressed ");
  const from = page.getByLabel("Von-Zustand");
  await from.fill(""); await from.blur();
  assert.equal(await page.evaluate(() => window.lastConfig.cameras.door.doorbell.from), "");
});

test("doorbell only reacts to subscribed edges; blocked autoplay, retries and late capture do not change the player", async (t) => {
  const page = await openRuntimePage(t);
  await page.evaluate(() => {
    const card = document.createElement("frigate-vision-card");
    const connection = Object.assign(new EventTarget(), {
      async subscribeEvents(cb, type) {
        if (type !== "state_changed") throw Error("Wrong subscription type");
        window.bellEvent = (from, to, id = "binary_sensor.bell") => cb({ data: { entity_id: id,
          old_state: from == null ? null : { state: from }, new_state: to == null ? null : { state: to } } });
        return async () => { window.unsubscribed = true; };
      },
    });
    window.connection = connection;
    window.doorTarget = false; window.micCalls = 0; window.ringAttempts = 0; window.videoStarts = 0;
    window.Audio = class {
      play() { window.ringAttempts++; return Promise.reject(new DOMException("blocked", "NotAllowedError")); }
      pause() {}
    };
    navigator.mediaDevices.getUserMedia = () => {
      window.micCalls++;
      if (!window.lateMic) return Promise.reject(new DOMException("denied", "NotAllowedError"));
      return new Promise(resolve => { window.releaseMic = () => resolve({ getTracks: () => [{ stop() { window.lateStopped = true; } }] }); });
    };
    const hass = { connection, connected: true,
      states: { "binary_sensor.bell": { state: "Pressed" }, "camera.door": { state: "idle", attributes: { camera_name: "door", client_id: "demo" } } },
      callWS: async msg => {
        if (msg.type === "frigate_vision/camera_streams") return { streams: window.doorTarget ? ["door_audio"] : ["other_alias"] };
        if (msg.type === "auth/sign_path") window.signedBackchannel = true;
        return { children: [] };
      },
    };
    card.hass = hass;
    card.setConfig({ language: "en", layout: "stacked", cameras: {
      door: { sub: "door_audio", doorbell: { enabled: true, entity: "binary_sensor.bell", from: "Ready", to: "Pressed" } },
      other: {},
    }, frigate_client_id: "demo", auto_refresh_seconds: 0 });
    card._hasFetchedOnce = true;
    const live = card._ensureLivestreamController();
    live._startWebRTCviaWS = async function (name, video, runId) {
      this._peerConnection = { close() {} };
      window.videoStarts++;
      this._playbackReady(name, video, runId, this._config());
    };
    document.body.append(card);
    card._openLive("door");
    window.card = card;
  });
  await page.waitForFunction(() => window.bellEvent);
  const phone = page.getByRole("button", { name: "Answer", exact: true });
  assert.equal(await phone.count(), 0);
  await page.evaluate(() => {
    const bell = window.bellEvent;
    bell(null, "Pressed"); bell("Pressed", "Pressed"); bell("unavailable", "Pressed");
    bell("Ready", "unknown"); bell("Ready", "Pressed", "binary_sensor.other");
    window.connection.dispatchEvent(new Event("disconnected"));
    bell("Ready", "Pressed");
    window.card.hass = { ...window.card.hass, states: { ...window.card.hass.states, "binary_sensor.bell": { state: "Pressed" } } };
    window.connection.dispatchEvent(new Event("ready"));
  });
  assert.equal(await phone.count(), 0);
  assert.equal(await page.evaluate(() => window.ringAttempts), 0);
  await page.evaluate(() => window.bellEvent("Ready", "Pressed"));
  await phone.waitFor();
  await page.getByText("Doorbell ringing").waitFor();
  await page.getByRole("button", { name: "Quick replies" }).click();
  await page.getByRole("button", { name: "Einen Moment bitte" }).click();
  await page.getByText("Could not send the announcement.").waitFor();
  await phone.click();
  await page.getByText("Home Assistant could not verify that this stream belongs to this camera.").waitFor();
  assert.equal(await page.evaluate(() => window.micCalls), 0, "a wrong alias must not open the mic");
  await page.evaluate(() => { window.doorTarget = true; });
  await phone.click();
  await page.getByText("Microphone access denied.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "End", exact: true }).count(), 0);
  await page.evaluate(() => { window.lateMic = true; });
  await phone.click();
  await page.getByRole("button", { name: "Cancel", exact: true }).waitFor();
  assert.equal(await phone.count(), 0, "pending must not look like answering again");
  await page.waitForFunction(() => window.releaseMic);
  await page.evaluate(() => { window.card.remove(); window.releaseMic(); });
  await page.waitForFunction(() => window.lateStopped && window.unsubscribed);
  assert.deepEqual(await page.evaluate(() => [window.signedBackchannel || false, window.ringAttempts, window.micCalls, window.videoStarts]), [false, 1, 2, 1]);
});

for (const touch of [false, true]) test(`doorbell exit stays operable in every call state (${touch ? "360px touch" : "desktop"})`, async (t) => {
  const page = await openRuntimePage(t, touch ? { hasTouch: true, viewport: { width: 360, height: 740 } } : {});
  await page.evaluate(() => {
    const card = document.createElement("frigate-vision-card");
    const f = window.doorbellExit = { micRequests: 0, joins: 0, closes: 0, starts: 0 };
    window.Audio = class {
      play() { f.ringtone = this; this.playing = true; return Promise.resolve(); }
      pause() { this.playing = false; }
    };
    navigator.mediaDevices.getUserMedia = async () => {
      f.micRequests++;
      if (f.mode === "denied") throw new DOMException("Denied", "NotAllowedError");
      if (f.mode === "permission") await new Promise(resolve => { f.release = resolve; });
      const audio = f.audio = { enabled: true, readyState: "live", stop() { this.readyState = "ended"; } };
      return { getTracks: () => [audio], getAudioTracks: () => [audio] };
    };
    card.hass = {
      connection: Object.assign(new EventTarget(), { async subscribeEvents(cb) {
        f.ring = () => cb({ data: { entity_id: "input_boolean.fixture", old_state: { state: "off" }, new_state: { state: "on" } } });
        return async () => {};
      } }),
      states: { "camera.door": { state: "idle", attributes: { camera_name: "door", client_id: "demo" } } },
      async callWS(msg) {
        if (msg.type !== "frigate_vision/camera_streams") return { children: [] };
        if (f.mode === "mapping") await new Promise(resolve => { f.release = resolve; });
        return { streams: f.mode === "blocked" ? ["other"] : ["fixture_speaker"] };
      },
    };
    card.setConfig({ language: "de", layout: "stacked", frigate_client_id: "demo", auto_refresh_seconds: 0,
      cameras: { door: { sub: "fixture_speaker", doorbell: { enabled: true, entity: "input_boolean.fixture", from: "off", to: "on" } } } });
    card._hasFetchedOnce = true;
    const live = f.live = card._ensureLivestreamController();
    live._startWebRTCviaWS = async function (name, video, runId) {
      f.starts++;
      // A synthetic porch view places controls over both bright and dark video.
      const canvas = document.createElement("canvas");
      canvas.width = 960; canvas.height = 540;
      const ctx = canvas.getContext("2d");
      const draw = () => {
        const rect = (color, ...position) => { ctx.fillStyle = color; ctx.fillRect(...position); };
        rect("#dae0dc", 0, 0, 960, 540);
        rect("#f4ece1", 0, 0, 660, 418);
        for (let y = 18; y < 411; y += 22) rect("#ded5cb", 0, y, 660, 1);
        rect("#bfc9c3", 660, 90, 300, 328);
        rect("#d4c4a9", 0, 418, 960, 122);
        rect("#e1d0b5", 162, 422, 492, 118);
        rect("#bcac97", 220, 26, 315, 392);
        rect("#364446", 234, 38, 285, 380);
        rect("#63736d", 261, 64, 231, 141);
        rect("#8fa399", 271, 73, 211, 122);
        rect("#364446", 375, 73, 5, 122);
        rect("#253332", 263, 231, 232, 152);
        rect("#485856", 269, 237, 220, 140);
        rect("#d2b689", 472, 212, 26, 6);
        rect("#91806d", 240, 437, 278, 35);
        rect("#776857", 753, 362, 78, 60);
        ctx.fillStyle = "#596f55";
        for (const [x, y, a] of [[767, 336, -.6], [796, 304, .15], [823, 335, .7], [801, 347, .3]]) {
          ctx.beginPath(); ctx.ellipse(x, y, 21, 46, a, 0, Math.PI * 2); ctx.fill();
        }
        rect("#aa9d8c", 900 + (Math.floor(performance.now() / 100) % 12), 525, 15, 2);
      };
      draw();
      const stream = canvas.captureStream(12);
      const timer = setInterval(draw, 83);
      video.srcObject = stream;
      f.video = video;
      const play = video.play.bind(video);
      video.play = () => {
        if (!video.muted && f.mode === "audio-blocked" && !f.unmutePolicyAllows) {
          video.pause(); // Simulate a browser that pauses on asynchronous unmute.
          return Promise.reject(new DOMException("User gesture required", "NotAllowedError"));
        }
        return play();
      };
      this._peerConnection = f.videoPeer = { close() { clearInterval(timer); stream.getTracks().forEach(track => track.stop()); } };
      this._playbackReady(name, video, runId, this._config());
    };
    live._backchannel = () => ({
      runGeneration: 1, _withTimeout: promise => promise,
      async _startWebRTCviaWS() {
        f.joins++;
        if (f.mode === "webrtc") await new Promise(resolve => { f.release = resolve; });
        if (f.mode === "failed") throw Error("No compatible audio backchannel");
      },
      close() { f.closes++; },
    });
    live.playDoorbellReply = () => new Promise(resolve => { f.finishReply = resolve; });
    live.stopAnnouncement = () => { if (f.finishReply) f.stoppedReply = true; };
    document.body.append(card);
    card._openLive("door");
  });
  await page.waitForFunction(() => window.doorbellExit.ring);
  const door = page.locator("frigate-vision-doorbell");
  const phone = door.getByRole("button", { name: "Annehmen", exact: true });
  const dismiss = door.locator(".dismiss");
  const status = door.getByRole("status");
  const activate = locator => touch ? locator.tap() : locator.click();
  const ring = async mode => {
    await page.evaluate(mode => {
      Object.assign(window.doorbellExit, { mode, release: null, audio: null });
      window.doorbellExit.ring();
    }, mode);
    await phone.waitFor();
  };
  const exit = async label => {
    await door.getByRole("button", { name: label, exact: true }).waitFor();
    const box = await dismiss.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, "exit target must be large enough for touch");
    await activate(dismiss);
    await dismiss.waitFor({ state: "hidden" });
  };
  const snapshot = () => page.evaluate(() => {
    const f = window.doorbellExit;
    const bell = document.querySelector("frigate-vision-card").renderRoot.querySelector("frigate-vision-doorbell");
    return { requests: f.micRequests, joins: f.joins, active: f.live.talkRequested, audio: f.audio?.readyState,
      cameraMuted: f.video.muted, cameraPaused: f.video.paused, cameraVolume: f.video.volume,
      enabled: f.audio?.enabled, ringing: !!bell._ringAudio?.playing, samePeer: f.starts === 1 && f.live._peerConnection === f.videoPeer };
  });
  const screen = async name => {
    if (!process.env.FV_DOORBELL_SCREENSHOTS) return;
    await page.locator(".player-wrap.live").screenshot({ path: resolve(process.env.FV_DOORBELL_SCREENSHOTS, `${touch ? "touch" : "desktop"}-${name}.png`) });
  };
  await ring("menu");
  const video = page.locator("video.player");
  await page.waitForFunction(() => window.doorbellExit.video.getVideoPlaybackQuality().totalVideoFrames > 1);
  const firstFrameCount = await video.evaluate(v => v.getVideoPlaybackQuality().totalVideoFrames);
  const beforeDecline = await snapshot();
  const more = door.getByRole("button", { name: "Schnellantworten" });
  assert.deepEqual(await dismiss.evaluate(el => ({ text: el.textContent.trim(), tag: el.tagName,
    circle: getComputedStyle(el).borderRadius, red: getComputedStyle(el).backgroundColor, path: el.querySelector("svg path")?.getAttribute("transform") })),
  { text: "", tag: "BUTTON", circle: "50%", red: "rgb(189, 39, 59)", path: "" });
  assert.equal(await phone.locator("svg path").getAttribute("transform"), "rotate(135 12 12)");
  assert.ok((await more.boundingBox()).x < (await phone.boundingBox()).x);
  await screen("ringing");
  if (!touch) {
    await dismiss.press("Tab"); await more.press("Shift+Tab");
    assert.equal(await dismiss.evaluate(el => el.matches(":focus-visible") && getComputedStyle(el).outlineWidth === "2px"), true);
    await more.press("Enter");
    const first = door.getByRole("button", { name: "Einen Moment bitte" });
    await first.waitFor();
    assert.equal(await first.evaluate(el => el.getRootNode().activeElement === el), true);
    await page.keyboard.press("Tab");
    const second = door.getByRole("button", { name: "Bitte vor der Tür abstellen" });
    assert.equal(await second.evaluate(el => el.getRootNode().activeElement === el), true);
    await page.keyboard.press("Escape");
    await first.waitFor({ state: "hidden" });
    assert.equal(await more.evaluate(el => el.getRootNode().activeElement === el), true);
  } else {
    // Verify that the controls remain tappable inside a narrow video tile.
    const player = page.locator(".player-wrap.live");
    await player.evaluate(el => { el.style.width = "164px"; });
    const frame = await player.boundingBox();
    for (const button of [dismiss, more, phone]) {
      const b = await button.boundingBox();
      assert.ok(b.x >= frame.x && b.x + b.width <= frame.x + frame.width && b.y >= frame.y && b.y + b.height <= frame.y + frame.height);
    }
    await exit("Anruf ablehnen");
    await player.evaluate(el => { el.style.width = ""; });
    await ring("menu");
  }
  await activate(more);
  const replyChoice = door.getByRole("button", { name: "Einen Moment bitte" });
  await replyChoice.waitFor();
  assert.ok((await replyChoice.boundingBox()).y < (await more.boundingBox()).y);
  await screen("menu");
  await exit("Anruf ablehnen"); // First click/tap also closes an open popover.
  const afterDecline = await snapshot();
  assert.equal(afterDecline.ringing, false);
  assert.equal(afterDecline.requests, beforeDecline.requests);
  assert.equal(afterDecline.joins, beforeDecline.joins);
  assert.equal(afterDecline.samePeer, true);
  assert.equal(await page.evaluate(() => window.doorbellExit.ringtone.playing), false);
  await page.waitForFunction(frames => window.doorbellExit.video.getVideoPlaybackQuality().totalVideoFrames > frames, firstFrameCount);
  if (!touch) {
    await ring("keyboard");
    await dismiss.press("Space");
    await dismiss.waitFor({ state: "hidden" });
    assert.equal((await snapshot()).requests, beforeDecline.requests);
  }

  for (const [mode, text] of [["blocked", /nicht eindeutig zuordnen/], ["denied", /Mikrofonzugriff verweigert/], ["failed", /keinen kompatiblen Audiorückkanal/]]) {
    const previous = await snapshot();
    await ring(mode); await activate(phone); await status.filter({ hasText: text }).waitFor();
    const current = await snapshot();
    assert.equal(current.active, false);
    assert.equal(current.cameraMuted, true, "mapping and backchannel errors must not make the camera audible");
    if (mode === "blocked") assert.equal(current.requests, previous.requests);
    if (mode === "failed") assert.equal(current.audio, "ended");
    await exit("Schließen");
  }
  for (const mode of ["mapping", "permission", "webrtc"]) {
    const previous = await snapshot();
    await ring(mode); await activate(phone);
    await page.waitForFunction(() => window.doorbellExit.release);
    assert.equal(await phone.count(), 0);
    assert.equal((await snapshot()).cameraMuted, true, "keep camera audio off until the call has connected");
    if (mode === "webrtc") assert.equal((await snapshot()).enabled, false);
    await exit("Abbrechen");
    if (mode === "webrtc") assert.equal((await snapshot()).audio, "ended");
    await page.evaluate(() => window.doorbellExit.release());
    if (mode !== "mapping") await page.waitForFunction(() => window.doorbellExit.audio?.readyState === "ended");
    const current = await snapshot();
    if (mode === "mapping") assert.equal(current.requests, previous.requests);
    assert.equal(current.joins, previous.joins + (mode === "webrtc" ? 1 : 0));
    assert.equal(current.active, false);
  }
  await ring("audio-blocked"); await activate(phone);
  const enableAudio = door.getByRole("button", { name: "Kameraton einschalten", exact: true });
  await enableAudio.waitFor();
  const blocked = await snapshot();
  assert.equal(blocked.cameraMuted, true);
  assert.equal(blocked.cameraPaused, false, "a denied unmute must keep silent video running");
  await page.evaluate(() => { window.doorbellExit.unmutePolicyAllows = true; });
  await activate(enableAudio);
  await enableAudio.waitFor({ state: "hidden" });
  assert.equal((await snapshot()).cameraMuted, false);
  assert.equal((await snapshot()).requests, blocked.requests);
  assert.equal((await snapshot()).joins, blocked.joins);
  await exit("Beenden");
  assert.equal((await snapshot()).cameraMuted, true);

  // Explicitly enabling sound may temporarily lift zero volume; restore the
  // individual value/pause rather than applying a global playback default.
  await page.evaluate(() => { const v = window.doorbellExit.video; v.volume = 0; v.pause(); });
  await ring("zero-volume"); await activate(phone);
  await activate(enableAudio);
  assert.equal((await snapshot()).cameraVolume, 1);
  assert.equal((await snapshot()).cameraMuted, false);
  await exit("Beenden");
  assert.equal((await snapshot()).cameraVolume, 0);
  assert.equal((await snapshot()).cameraPaused, true);

  await page.evaluate(async () => { const v = window.doorbellExit.video; v.volume = 0.3; v.muted = false; await v.play(); });
  await ring("active"); await activate(phone);
  await status.filter({ hasText: "Mikrofon sendet" }).waitFor();
  assert.equal(await dismiss.getAttribute("data-sending"), "");
  const mute = door.getByRole("button", { name: "Mikrofon stummschalten", exact: true });
  const active = await snapshot();
  const box = await mute.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44);
  if (touch) await mute.tap(); else await mute.press("Space");
  await status.filter({ hasText: "Mikrofon stumm" }).waitFor();
  assert.equal(await mute.getAttribute("aria-pressed"), "true");
  assert.equal((await snapshot()).enabled, false);
  await screen("muted");
  await activate(mute);
  await status.filter({ hasText: "Mikrofon sendet" }).waitFor();
  assert.equal(await mute.getAttribute("aria-pressed"), "false");
  assert.equal((await snapshot()).enabled, true);
  assert.equal((await snapshot()).requests, active.requests);
  assert.equal((await snapshot()).joins, active.joins);
  await activate(mute);
  await status.filter({ hasText: "Mikrofon stumm" }).waitFor();
  await exit("Beenden");
  assert.equal((await snapshot()).audio, "ended");
  assert.equal((await snapshot()).cameraMuted, false, "restore pre-existing manual camera listening");
  assert.equal((await snapshot()).cameraVolume, 0.3);

  await ring("reply"); await activate(door.getByRole("button", { name: "Schnellantworten" }));
  await activate(door.getByRole("button", { name: "Einen Moment bitte" }));
  const reply = await dismiss.evaluate(button => ({ focused: button.getRootNode().activeElement === button, sending: button.hasAttribute("data-sending") }));
  assert.deepEqual(reply, { focused: true, sending: false });
  await exit("Beenden");
  await page.evaluate(() => {
    if (!window.doorbellExit.stoppedReply) throw Error("reply was not stopped");
    window.doorbellExit.finishReply(false);
  });
  assert.equal(await dismiss.count(), 0, "late completion must not reopen the call");
  assert.equal((await snapshot()).samePeer, true);
});

test("Doorbell view editor requires an explicit camera and preserves normal settings and other entries", async (t) => {
  const page = await openRuntimePage(t);
  const input = { multiview: true, auto_refresh_seconds: 30, cameras: {
    front: { main: "klingel_talk", sub: "klingel_talk", doorbell: { enabled: true, entity: "input_boolean.fixture" } },
    side: { name: "Side" },
  } };
  await page.evaluate(config => {
    const editor = document.createElement("frigate-vision-card-editor");
    editor.setConfig(config);
    editor.addEventListener("config-changed", e => { window.config = e.detail.config; });
    document.body.append(editor);
  }, input);
  await page.getByRole("button", { name: "Anzeige", exact: true }).click();
  await page.getByLabel("Ansicht", { exact: true }).selectOption("doorbell");
  await page.getByRole("button", { name: "Kameras", exact: true }).click();
  const camera = page.getByLabel("Doorbell-Kamera", { exact: true });
  assert.equal(await camera.inputValue(), "");
  await page.getByRole("alert").filter({ hasText: "genau eine Kamera" }).waitFor();
  await camera.selectOption("side");
  await page.getByRole("alert").filter({ hasText: "Aktiviere Doorbell" }).waitFor();
  await camera.selectOption("front");
  assert.equal(await camera.getAttribute("aria-invalid"), "false");
  assert.deepEqual(await page.evaluate(() => window.config), { ...input, doorbell_camera: "front", view_mode: "doorbell" });
  await page.getByRole("button", { name: "Anzeige", exact: true }).click();
  await page.getByLabel("Ansicht", { exact: true }).selectOption("events");
  assert.deepEqual(await page.evaluate(() => window.config), { ...input, doorbell_camera: "front", view_mode: "events" });
});

test("Doorbell view refuses absent, disabled and ambiguous selections without starting a player", async (t) => {
  const page = await openRuntimePage(t);
  const scenarios = [
    [undefined, "Select exactly one camera"], ["other", "not configured"], ["side", "Enable Doorbell"],
    ["door", "ambiguous", true], ["door", "ambiguous", false, true], ["door", "needs live streaming", false, false, true],
  ];
  for (const [id, message, duplicateDefinitions, duplicateEntities, liveOff] of scenarios) {
    await page.evaluate(({ id, duplicateDefinitions, duplicateEntities, liveOff }) => {
      window.card?.remove();
      const card = window.card = document.createElement("frigate-vision-card");
      const camera = { attributes: { camera_name: "door", client_id: "demo" } };
      card.hass = { callWS: async () => ({}), states: { "camera.door": camera, ...(duplicateEntities ? { "camera.duplicate": camera } : {}) } };
      const door = { doorbell: { enabled: true, entity: "input_boolean.fixture" } };
      card.setConfig({ view_mode: "doorbell", doorbell_camera: id, language: "en", live_provider: liveOff ? "off" : "auto",
        cameras: { door, side: {}, ...(duplicateDefinitions ? { Door: door } : {}) } });
      document.body.append(card);
    }, { id, duplicateDefinitions, duplicateEntities, liveOff });
    await page.getByRole("alert").filter({ hasText: message }).waitFor();
    assert.equal(await page.locator("frigate-vision-live-tile, video").count(), 0);
  }
});

test("Doorbell view keeps one player on panel resize and releases capture on popup close or detach", async (t) => {
  const page = await openRuntimePage(t, { viewport: { width: 1100, height: 800 } });
  await page.evaluate(() => {
    const card = document.createElement("frigate-vision-card");
    const f = window.dedicated = { asks: [], plays: [], stops: 0, card };
    const proto = Object.getPrototypeOf(card._ensureLivestreamController());
    proto._startWebRTCviaWS = async function (name, video, runId) {
      f.plays.push(name);
      const canvas = document.createElement("canvas"); canvas.width = 160; canvas.height = 90;
      canvas.getContext("2d").fillRect(0,0,160,90);
      const stream = canvas.captureStream(10);
      this._peerConnection = { close() { stream.getTracks().forEach(track => track.stop()); } };
      video.srcObject = stream;
      this._playbackReady(name, video, runId, this._config());
    };
    proto._backchannel = () => ({ runGeneration: 1, _withTimeout: promise => promise, async _startWebRTCviaWS() {}, close() {} });
    navigator.mediaDevices.getUserMedia = async () => {
      const track = { enabled: true, readyState: "live", stop() { this.readyState = "ended"; f.stops++; } };
      return { getAudioTracks: () => [track], getTracks: () => [track] };
    };
    window.Audio = class { play() { return Promise.resolve(); } pause() {} };
    f.connection = Object.assign(new EventTarget(), { async subscribeEvents(cb) {
      f.ring = (entity_id = "input_boolean.door") => cb({ data: { entity_id, old_state: { state: "off" }, new_state: { state: "on" } } });
      return async () => {};
    } });
    card.hass = { connection: f.connection, states: {
      "camera.door": { attributes: { camera_name: "door", client_id: "demo" } },
      "camera.side": { attributes: { camera_name: "side", client_id: "demo" } },
    }, async callWS(msg) {
      f.asks.push(msg.type);
      if (msg.type === "frigate_vision/profile") return { profile: { frigate_client_id: "demo" } };
      if (msg.type === "frigate_vision/camera_streams") return { streams: ["klingel_talk"] };
      if (msg.type === "media_source/browse_media") return { children: [{ media_content_id: "media-source://frigate/demo/event-search/clips//////" }] };
      return [];
    } };
    f.config = { language: "en", view_mode: "doorbell", doorbell_camera: "door", layout: "stacked", go2rtc_modes: "webrtc", live_autostart: false,
      section_mode: true, multiview: true, live_controls: false, auto_refresh_seconds: 60, cameras: {
      door: { main: "klingel_talk", sub: "klingel_talk", doorbell: { enabled: true, entity: "input_boolean.door" } },
      side: { doorbell: { enabled: true, entity: "input_boolean.side" } },
    } };
    card.setConfig(f.config);
    const dialog = f.dialog = document.createElement("dialog");
    Object.assign(dialog.style, { width: "320px", height: "220px", padding: "0" });
    dialog.append(card); document.body.append(dialog); dialog.showModal();
  });
  const video = page.locator("video.player");
  const answer = page.getByRole("button", { name: "Answer", exact: true });
  await page.waitForFunction(() => {
    const tile = window.dedicated.card.renderRoot.querySelector("frigate-vision-live-tile");
    return tile?.renderRoot.querySelector("frigate-vision-doorbell")?._surfaceVisible;
  });
  assert.equal(await video.count(), 1);
  assert.equal(await page.locator(".header, .filters, .live-controls, .player-top-buttons, .timeline, .list-wrap, .multiview-grid").count(), 0);
  assert.deepEqual(await video.evaluate(v => ({ controls: v.controls, fullscreen: !!document.fullscreenElement })), { controls: false, fullscreen: false });
  const size = await video.boundingBox();
  assert.ok(size.width <= 320 && size.height <= 220 && size.height > 100);
  await video.evaluate(v => {
    const f = window.dedicated;
    const tile = f.card.renderRoot.querySelector("frigate-vision-live-tile");
    f.initial = [v, v.srcObject, tile._lc._peerConnection];
    f.dialog.style.width = "950px"; f.dialog.style.height = "610px";
    f.card.hass = { ...f.card.hass, states: { ...f.card.hass.states } };
    f.ring("input_boolean.side");
  });
  assert.equal(await answer.count(), 0);
  await page.waitForFunction(() => window.dedicated.initial[0].getBoundingClientRect().width > 900);
  assert.deepEqual(await video.evaluate(v => {
    const f = window.dedicated;
    const tile = f.card.renderRoot.querySelector("frigate-vision-live-tile");
    return [v === f.initial[0] && v.srcObject === f.initial[1] && tile._lc._peerConnection === f.initial[2], f.plays, f.asks, !!f.card._autoRefreshTimer];
  }), [true, ["klingel_talk"], ["frigate_vision/profile"], false]);
  await page.evaluate(() => window.dedicated.ring());
  await answer.click(); await page.getByRole("button", { name: "End", exact: true }).waitFor();
  assert.equal(await video.evaluate(v => v.muted), false);
  await page.evaluate(() => window.dedicated.dialog.close());
  await page.waitForFunction(() => window.dedicated.stops === 1 && window.dedicated.initial[0].muted);
  await page.evaluate(() => window.dedicated.ring());
  assert.equal(await answer.count(), 0);
  await page.evaluate(() => window.dedicated.dialog.showModal());
  await page.waitForFunction(() => window.dedicated.card.renderRoot.querySelector("frigate-vision-live-tile").renderRoot.querySelector("frigate-vision-doorbell")._surfaceVisible);
  await page.evaluate(() => window.dedicated.ring());
  await answer.click(); await page.getByRole("button", { name: "End", exact: true }).waitFor();
  await page.getByRole("button", { name: "Mute microphone", exact: true }).click();
  await page.getByText("Microphone muted", { exact: true }).waitFor();
  await page.evaluate(() => window.dedicated.card.remove());
  await page.waitForFunction(() => window.dedicated.stops === 2);
  await page.evaluate(() => {
    const f = window.dedicated;
    f.dialog.close(); f.card.setConfig({ ...f.config, view_mode: "events", multiview: false, auto_refresh_seconds: 0 });
    document.body.append(f.card);
  });
  await page.locator(".header").waitFor();
  await page.waitForFunction(() => window.dedicated.asks.includes("media_source/browse_media"));
  assert.equal(await page.locator("frigate-vision-live-tile").count(), 0);
});

async function openFullscreenDoorbell(t, { popup, touch, answerCall = true }) {
  const page = await openRuntimePage(t, { viewport: touch ? { width: 360, height: 680 } : { width: 1100, height: 700 }, hasTouch: touch });
  await page.evaluate(({ popup, touch }) => {
    const card = document.createElement("frigate-vision-card");
    const f = window.fullscreenDoor = { card, starts: 0, captures: 0, joins: 0, stops: 0, closes: 0, events: [] };
    const controller = Object.getPrototypeOf(card._ensureLivestreamController());
    controller._startWebRTCviaWS = async function (name, video, runId) {
      f.starts++;
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext("2d");
      const draw = () => {
        ctx.fillStyle = "#ddd9d0"; ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = "#263e42"; ctx.fillRect(190, 20, 260, 305);
        ctx.fillStyle = "#596f6a"; ctx.fillRect(224, 43, 191, 117);
        ctx.fillStyle = "#a9bfb6"; ctx.fillRect(233, 52, 173, 99);
        ctx.fillStyle = "#3a4a50"; ctx.fillRect(232, 193, 175, 106);
        ctx.fillStyle = "#cfaa75"; ctx.fillRect(404, 175, 24, 4);
        ctx.fillStyle = "#999180"; ctx.fillRect(0, 325, 640, 35);
        ctx.fillRect(470 + (Math.floor(performance.now() / 90) % 50), 308, 4, 4);
      };
      draw();
      const stream = canvas.captureStream(12);
      const timer = setInterval(draw, 83);
      video.srcObject = stream;
      this._peerConnection = { close() { clearInterval(timer); stream.getTracks().forEach(track => track.stop()); } };
      f.video = video; f.stream = stream; f.peer = this._peerConnection;
      this._playbackReady(name, video, runId, this._config());
    };
    controller._backchannel = () => ({ runGeneration: 1, _withTimeout: p => p,
      async _startWebRTCviaWS() { f.joins++; if (f.deferJoin) await new Promise(resolve => { f.finishJoin = resolve; }); },
      close() { f.closes++; } });
    navigator.mediaDevices.getUserMedia = async () => {
      f.captures++;
      const track = f.mic = { enabled: true, readyState: "live", stop() { f.stops++; this.readyState = "ended"; } };
      if (f.deferMic) await new Promise(resolve => { f.grant = resolve; });
      return { getAudioTracks: () => [track], getTracks: () => [track] };
    };
    window.Audio = class { play() { f.rings = (f.rings || 0) + 1; return Promise.resolve(); } pause() {} };
    card.hass = { connection: Object.assign(new EventTarget(), { async subscribeEvents(cb) {
      f.ring = last_changed => cb({ data: { entity_id: "input_boolean.fixture", old_state: { state: "off" }, new_state: { state: "on", last_changed } } });
      return async () => {};
    } }), states: { "camera.door": { attributes: { camera_name: "door", client_id: "demo" } } },
    async callWS(msg) { return msg.type === "frigate_vision/profile" ? { profile: { frigate_client_id: "demo" } } : { streams: ["fixture"] }; } };
    card.setConfig({ language: "en", view_mode: "doorbell", doorbell_camera: "door", go2rtc_modes: "webrtc", section_mode: true,
      cameras: { door: { sub: "fixture", doorbell: { enabled: true, entity: "input_boolean.fixture" } } } });
    const host = f.host = document.createElement(popup ? "dialog" : "main");
    Object.assign(host.style, { width: touch ? "320px" : "960px", height: touch ? "228px" : "572px", padding: "0" });
    host.append(card);
    document.body.append(host);
    if (popup) host.showModal();
    host.addEventListener("cancel", () => f.events.push("cancel"));
    host.addEventListener("close", () => f.events.push("close"));
    document.addEventListener("fullscreenchange", () => f.events.push(document.fullscreenElement ? "enter" : "exit"));
    f.tile = () => card.renderRoot.querySelector("frigate-vision-live-tile");
    f.bell = () => f.tile()?.renderRoot.querySelector("frigate-vision-doorbell");
  }, { popup, touch });
  await page.waitForFunction(() => fullscreenDoor.ring && fullscreenDoor.bell()?._surfaceVisible);
  if (!answerCall) return page;
  await page.evaluate(() => fullscreenDoor.ring());
  const answer = page.getByRole("button", { name: "Answer", exact: true });
  await answer[touch ? "tap" : "click"]();
  await page.getByRole("button", { name: "End", exact: true }).waitFor();
  return page;
}

test("Doorbell-only speaker and idle microphone are independent on one live player, including after hangup", async (t) => {
  const page = await openFullscreenDoorbell(t, { popup: false, touch: false, answerCall: false });
  const speaker = page.getByRole("button", { name: "Camera sound", exact: true });
  const start = page.getByRole("button", { name: "Start talking", exact: true });
  const stop = page.getByRole("button", { name: "Stop talking", exact: true });
  const answer = page.getByRole("button", { name: "Answer", exact: true });
  const status = () => page.evaluate(() => {
    const f = fullscreenDoor;
    const videos = f.tile().renderRoot.querySelectorAll("video");
    return [videos.length === 1 && videos[0] === f.video && f.video.srcObject === f.stream && f.tile()._lc._peerConnection === f.peer,
      f.video.muted, f.video.controls, f.captures, f.joins, f.stops, f.closes, f.starts];
  });
  assert.equal(await speaker.getAttribute("aria-pressed"), "false");
  assert.deepEqual(await status(), [true, true, false, 0, 0, 0, 0, 1]);
  await speaker.press("Space");
  assert.equal(await speaker.getAttribute("aria-pressed"), "true");
  assert.deepEqual(await status(), [true, false, false, 0, 0, 0, 0, 1]);
  assert.equal(await answer.count(), 0);
  await start.click();
  await page.getByText("Microphone on air", { exact: true }).waitFor();
  await speaker.click();
  assert.equal(await page.evaluate(() => fullscreenDoor.mic.enabled), true);
  assert.deepEqual(await status(), [true, true, false, 1, 1, 0, 0, 1]);
  await stop.click();
  assert.deepEqual(await status(), [true, true, false, 1, 1, 1, 1, 1]);
  await start.click();
  await page.getByText("Microphone on air", { exact: true }).waitFor();
  const frame = await page.evaluate(() => fullscreenDoor.video.getVideoPlaybackQuality().totalVideoFrames);
  await page.getByRole("button", { name: "Enter fullscreen", exact: true }).click();
  await page.getByRole("button", { name: "Exit fullscreen", exact: true }).waitFor();
  assert.deepEqual(await status(), [true, true, false, 2, 2, 1, 1, 1]);
  await speaker.click();
  await page.getByRole("button", { name: "Exit fullscreen", exact: true }).click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.evaluate(() => {
    fullscreenDoor.card.hass = { ...fullscreenDoor.card.hass };
    fullscreenDoor.ring();
  });
  await answer.click(); // Adopt the existing mic; this is still a real Answer.
  await page.getByRole("button", { name: "End", exact: true }).waitFor();
  assert.deepEqual(await status(), [true, false, false, 2, 2, 1, 1, 1]);
  await page.getByRole("button", { name: "Mute microphone", exact: true }).click();
  assert.equal(await page.evaluate(() => fullscreenDoor.mic.enabled), false);
  assert.deepEqual(await status(), [true, false, false, 2, 2, 1, 1, 1]);
  await page.getByRole("button", { name: "End", exact: true }).click();
  assert.deepEqual(await status(), [true, true, false, 2, 2, 2, 2, 1]);
  await speaker.click();
  assert.deepEqual(await status(), [true, false, false, 2, 2, 2, 2, 1]);
  assert.equal(await answer.count(), 0);
  await page.waitForFunction(frame => fullscreenDoor.video.getVideoPlaybackQuality().totalVideoFrames > frame, frame);
  await page.evaluate(() => fullscreenDoor.tile()._restart());
  await page.waitForFunction(() => fullscreenDoor.starts === 2);
  await speaker.waitFor();
  assert.equal(await speaker.getAttribute("aria-pressed"), "false");
  assert.deepEqual(await status(), [true, true, false, 2, 2, 2, 2, 2]);
});

test("Doorbell-only handles blocked camera playback, superseded Accept audio and idle mic cancellation", async (t) => {
  const page = await openFullscreenDoorbell(t, { popup: true, touch: false, answerCall: false });
  const speaker = page.getByRole("button", { name: "Camera sound", exact: true });
  const start = page.getByRole("button", { name: "Start talking", exact: true });
  await page.evaluate(() => {
    const f = fullscreenDoor;
    const play = f.video.play.bind(f.video);
    f.video.play = () => {
      if (f.block && !f.video.muted) {
        f.video.pause();
        return Promise.reject(new DOMException("fixture", "NotAllowedError"));
      }
      return play();
    };
    f.block = true;
  });
  await speaker.click();
  await page.getByText("Camera sound is off.", { exact: false }).waitFor();
  assert.equal(await speaker.getAttribute("aria-pressed"), "false");
  await page.waitForFunction(() => fullscreenDoor.video.muted && !fullscreenDoor.video.paused);
  await page.evaluate(() => { fullscreenDoor.block = false; fullscreenDoor.deferJoin = true; fullscreenDoor.ring(); });
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await page.waitForFunction(() => fullscreenDoor.finishJoin);
  await speaker.click(); // Receive while the call is still negotiating.
  await speaker.click(); // This newer mute must beat the Accept auto-listen.
  await page.evaluate(() => fullscreenDoor.finishJoin());
  const end = page.getByRole("button", { name: "End", exact: true });
  await end.waitFor();
  assert.equal(await speaker.getAttribute("aria-pressed"), "false");
  assert.equal(await page.evaluate(() => fullscreenDoor.video.muted), true);
  await end.click();

  await page.evaluate(() => {
    fullscreenDoor.getMic = navigator.mediaDevices.getUserMedia;
    // Model the API being unavailable on an insecure origin, not real capture.
    navigator.mediaDevices.getUserMedia = undefined;
  });
  await start.click();
  await page.getByText("Microphone unavailable. Check the input device and use HTTPS or localhost.").waitFor();
  await speaker.click();
  assert.equal(await speaker.getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(() => fullscreenDoor.captures), 1);
  await speaker.click();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = fullscreenDoor.getMic;
    fullscreenDoor.deferMic = true;
  });
  await start.click();
  await page.waitForFunction(() => fullscreenDoor.grant);
  await page.getByRole("button", { name: "Stop talking", exact: true }).click();
  await page.evaluate(() => fullscreenDoor.grant());
  await page.waitForFunction(() => fullscreenDoor.stops === 2 && fullscreenDoor.joins === 1 && fullscreenDoor.closes === 2);
  await page.evaluate(() => { fullscreenDoor.grant = null; });
  await start.click();
  await page.waitForFunction(() => fullscreenDoor.grant);
  await speaker.click();
  await page.evaluate(() => fullscreenDoor.host.close());
  await page.waitForFunction(() => fullscreenDoor.closes === 3 && fullscreenDoor.video.muted);
  await page.evaluate(() => fullscreenDoor.grant());
  await page.waitForFunction(() => fullscreenDoor.stops === 3 && fullscreenDoor.joins === 1);
  assert.equal(await page.evaluate(() => fullscreenDoor.mic.readyState), "ended");
  await page.evaluate(() => {
    fullscreenDoor.deferMic = fullscreenDoor.deferJoin = false;
    fullscreenDoor.host.showModal();
  });
  await page.waitForFunction(() => fullscreenDoor.bell()._surfaceVisible);
  await start.click();
  await page.getByText("Microphone on air", { exact: true }).waitFor();
  await speaker.click();
  await page.evaluate(() => fullscreenDoor.card.hass.connection.dispatchEvent(new Event("disconnected")));
  await page.waitForFunction(() => fullscreenDoor.stops === 4 && fullscreenDoor.closes === 4 && fullscreenDoor.video.muted);
  assert.equal(await speaker.getAttribute("aria-pressed"), "false");
  await page.evaluate(() => fullscreenDoor.card.hass.connection.dispatchEvent(new Event("ready")));
  await start.click();
  await page.getByText("Microphone on air", { exact: true }).waitFor();
  await page.evaluate(() => fullscreenDoor.host.style.display = "none"); // No dialog close event or detach.
  await page.waitForFunction(() => fullscreenDoor.stops === 5 && fullscreenDoor.closes === 5 && fullscreenDoor.video.muted);
});

test("Doorbell-only keeps listening and fullscreen across TTS reply, next ring, Accept race and decline", async (t) => {
  const page = await openFullscreenDoorbell(t, { popup: true, touch: false, answerCall: false });
  await page.evaluate(() => {
    const f = fullscreenDoor;
    f.card.hass.callWS = async msg => {
      if (msg.type === "frigate_vision/doorbell_replies") {
        return msg.reply_id ? { audio: "Zg==" } : { replies: [{ id: "d".repeat(32), text: "Fixture TTS" }] };
      }
      return { streams: ["fixture"] };
    };
    // Exercise the real announcement lock/pipeline without decoding or playing media.
    window.AudioContext = class {
      resume() { return Promise.resolve(); }
      close() { f.contextCloses = (f.contextCloses || 0) + 1; return Promise.resolve(); }
      decodeAudioData(bytes) {
        if (new Uint8Array(bytes)[0] !== 102) throw Error("unexpected TTS bytes");
        return f.deferReply ? new Promise(resolve => { f.finishDecode = () => resolve({ duration: 1 }); }) : Promise.resolve({ duration: 1 });
      }
      createMediaStreamDestination() {
        const track = { stop() { f.replyStops = (f.replyStops || 0) + 1; } };
        return { stream: { getAudioTracks: () => [track], getTracks: () => [track] } };
      }
      createBufferSource() { return { connect() {}, stop() {}, start() { this.onended(); } }; }
    };
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const speaker = button("Camera sound"), answer = button("Answer"), decline = button("Decline call");
  const reply = async () => { await button("Quick replies").click(); await button("Fixture TTS").click(); };
  const quiet = page.getByText("Incoming call (ringtone muted)", { exact: true });
  const snapshot = () => page.evaluate(() => {
    const f = fullscreenDoor;
    return { same: f.tile().renderRoot.querySelector("video") === f.video && f.video.srcObject === f.stream && f.tile()._lc._peerConnection === f.peer,
      captures: f.captures, joins: f.joins, rings: f.rings, muted: f.video.muted, full: !!document.fullscreenElement };
  });
  await speaker.click();
  await button("Enter fullscreen").click();
  await button("Exit fullscreen").waitFor();
  const stamp = await page.evaluate(() => {
    const stamp = new Date().toISOString(); fullscreenDoor.ring(stamp); return stamp;
  });
  await reply();
  await quiet.waitFor();
  await answer.waitFor();
  await decline.waitFor();
  await page.evaluate(stamp => fullscreenDoor.ring(stamp), stamp);
  assert.deepEqual(await snapshot(), { same: true, captures: 0, joins: 1, rings: 1, muted: false, full: true });
  await page.evaluate(() => fullscreenDoor.ring(new Date().toISOString()));
  await page.getByText("Doorbell ringing", { exact: true }).waitFor();
  assert.deepEqual(await snapshot(), { same: true, captures: 0, joins: 1, rings: 2, muted: false, full: true });

  await page.evaluate(() => { fullscreenDoor.deferReply = true; });
  await reply();
  await page.waitForFunction(() => fullscreenDoor.finishDecode && fullscreenDoor.tile()._lc._announcement);
  await answer.click();
  await button("Mute microphone").waitFor();
  await page.evaluate(() => fullscreenDoor.finishDecode());
  await page.waitForFunction(() => fullscreenDoor.contextCloses === 2 && !fullscreenDoor.tile()._lc._announcement);
  assert.deepEqual(await snapshot(), { same: true, captures: 1, joins: 2, rings: 2, muted: false, full: true });
  assert.equal(await page.evaluate(() => fullscreenDoor.mic.enabled), true);
  await button("End").click();
  await page.waitForFunction(() => fullscreenDoor.mic.readyState === "ended");
  assert.equal(await speaker.getAttribute("aria-pressed"), "false");
  await speaker.click();
  await page.evaluate(() => { fullscreenDoor.deferReply = false; fullscreenDoor.ring(new Date().toISOString()); });
  await reply();
  await quiet.waitFor();
  await decline.click();
  await answer.waitFor({ state: "hidden" });
  assert.deepEqual(await snapshot(), { same: true, captures: 1, joins: 3, rings: 3, muted: true, full: true });
  await button("Exit fullscreen").click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await button("Start talking").click();
  await page.getByText("Microphone on air", { exact: true }).waitFor();
  await button("Stop talking").click();
  assert.deepEqual(await snapshot(), { same: true, captures: 2, joins: 4, rings: 3, muted: true, full: false });
});

test("custom Doorbell replies decode the padded 20-second boundary, but not larger payloads", async (t) => {
  const cases = JSON.parse(await readFile(new URL("./reply-audio-cases.json", import.meta.url), "utf8"));
  const page = await openFullscreenDoorbell(t, { popup: false, touch: false, answerCall: false });
  await page.evaluate(() => {
    const f = fullscreenDoor;
    f.card.hass.callWS = async msg => msg.reply_id ? { audio: f.audio } : { streams: ["fixture"] };
    const atob = window.atob;
    window.atob = value => { f.base64Decodes = (f.base64Decodes || 0) + 1; return atob(value); };
    window.AudioContext = class {
      async decodeAudioData(bytes) {
        // Decode the real WAV using Chromium, without any audio output device.
        const audio = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(bytes);
        f.decoded = [audio.length, audio.sampleRate, audio.numberOfChannels,
          audio.getChannelData(0).findIndex(sample => sample === 0)];
        return audio;
      }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createMediaStreamDestination() {
        const track = { stop() {} };
        return { stream: { getAudioTracks: () => [track], getTracks: () => [track] } };
      }
      createBufferSource() { return { connect() {}, stop() {}, start() { this.onended(); } }; }
    };
    f.send = async audio => {
      f.decoded = null;
      const sent = await f.tile()._lc.playDoorbellReply("d".repeat(32));
      return [sent, f.decoded, f.base64Decodes];
    };
  });
  const send = audio => page.evaluate(async audio => {
    fullscreenDoor.audio = audio;
    return fullscreenDoor.send(audio);
  }, audio);
  for (const [i, fixture] of cases.entries()) {
    // Match wave.writeframes in the Python save/reload test: PCM16 mono at
    // 16 kHz, sample value 1 until the actual 4000-frame silence tail.
    const wav = Buffer.alloc(44 + fixture.outputFrames * 2);
    wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
    for (let j = 0; j < fixture.sourceFrames; j++) wav[44 + j * 2] = 1;
    const audio = wav.toString("base64");
    assert.equal(wav.length, fixture.wavBytes);
    assert.equal(audio.length, fixture.base64Chars);
    assert.deepEqual(await send(audio), [true, [fixture.outputFrames, 16000, 1, fixture.sourceFrames], i + 1], fixture.text);
  }
  const max = cases[1];
  for (const extra of [1, 2]) {
    const audio = Buffer.alloc(max.wavBytes + extra).toString("base64");
    assert.equal(audio.length, max.base64Chars + (extra === 1 ? 0 : 4));
    assert.deepEqual(await send(audio), [false, null, cases.length], `oversize by ${extra} byte(s)`);
  }
});

for (const popup of [false, true]) for (const touch of [false, true]) {
  test(`doorbell fullscreen retains its live call in the ${popup ? "popup" : "panel"} (${touch ? "touch" : "desktop"})`, async (t) => {
    const page = await openFullscreenDoorbell(t, { popup, touch });
    const exit = page.getByRole("button", { name: "End", exact: true });
    const mute = page.getByRole("button", { name: "Mute microphone", exact: true });
    const fs = page.locator("frigate-vision-doorbell .fullscreen");
    const display = () => page.evaluate(() => {
      const f = fullscreenDoor;
      const box = f.bell().renderRoot.querySelector(".buttons").getBoundingClientRect();
      const image = f.video.getBoundingClientRect();
      return { full: !!document.fullscreenElement, target: f.video.getRootNode().fullscreenElement === f.video.parentElement,
        popupOpen: f.host.open ?? true, video: f.tile().renderRoot.querySelector("video") === f.video,
        onlyOneVideo: f.tile().renderRoot.querySelectorAll("video").length === 1,
        stream: f.video.srcObject === f.stream, peer: f.tile()._lc._peerConnection === f.peer,
        track: f.mic.readyState, enabled: f.mic.enabled, talking: f.tile()._lc.talkRequested, cameraMuted: f.video.muted,
        counts: [f.starts, f.captures, f.joins, f.stops, f.closes],
        centered: Math.abs((box.left + box.right) - (image.left + image.right)) <= 2,
        belowCenter: box.top > (image.top + image.bottom) / 2 && box.bottom <= image.bottom,
        missedPopup: f.events.includes("close") || f.events.includes("cancel") };
    });
    const press = locator => touch ? locator.tap() : locator.click();
    const confirm = async (full, enabled) => {
      assert.deepEqual(await display(), { full, target: full, popupOpen: true, video: true, onlyOneVideo: true,
        stream: true, peer: true, track: "live", enabled, talking: true, cameraMuted: false,
        counts: [1, 1, 1, 0, 0], centered: true, belowCenter: true, missedPopup: false });
      assert.equal(await mute.getAttribute("aria-pressed"), String(!enabled));
      const frame = await page.locator("video.player").evaluate(v => v.getVideoPlaybackQuality().totalVideoFrames);
      await page.waitForFunction(frame => fullscreenDoor.video.getVideoPlaybackQuality().totalVideoFrames > frame, frame);
    };
    await confirm(false, true);
    assert.equal(await exit.textContent().then(text => text.trim()), "");
    assert.equal(await exit.locator("svg").count(), 1);
    assert.ok((await exit.boundingBox()).height >= 44 && (await exit.boundingBox()).width >= 44);
    assert.equal(await page.locator("video.player").getAttribute("controlslist"), "nofullscreen");
    await press(fs);
    await page.getByRole("button", { name: "Exit fullscreen", exact: true }).waitFor();
    await confirm(true, true);
    await press(mute);
    await confirm(true, false);
    await press(fs);
    await page.waitForFunction(() => !document.fullscreenElement);
    await confirm(false, false);
    await press(fs);
    await page.waitForFunction(() => document.fullscreenElement);
    if (!touch) {
      // Escape must exit fullscreen, not the active call or enclosing dialog.
      await mute.focus();
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.fullscreenElement);
      await confirm(false, false);
      assert.equal(await mute.evaluate(button => button.getRootNode().activeElement === button), true);
      await page.keyboard.press("Shift+Tab");
      assert.equal(await exit.evaluate(button => button.matches(":focus-visible")), true);
      await page.keyboard.press("Shift+Tab");
      assert.equal(await fs.evaluate(button => button.matches(":focus-visible")), true);
      await mute.press("Space");
    } else {
      await press(fs);
      await page.waitForFunction(() => !document.fullscreenElement);
      await confirm(false, false);
      await press(mute);
    }
    await confirm(false, true);
    await press(exit);
    await page.waitForFunction(() => fullscreenDoor.stops === 1 && fullscreenDoor.closes === 1 && fullscreenDoor.video.muted);
    await exit.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => fullscreenDoor.video.srcObject === fullscreenDoor.stream), true);

    // Real close/detach still terminates even if the player is fullscreen.
    await page.evaluate(() => fullscreenDoor.ring());
    await press(page.getByRole("button", { name: "Answer", exact: true }));
    await exit.waitFor();
    await press(fs);
    await page.waitForFunction(() => document.fullscreenElement);
    await page.evaluate(popup => { if (popup) fullscreenDoor.host.close(); else fullscreenDoor.card.remove(); }, popup);
    await page.waitForFunction(() => fullscreenDoor.stops === 2 && fullscreenDoor.closes === 2 && !document.fullscreenElement);
    assert.equal(await page.evaluate(() => fullscreenDoor.mic.readyState), "ended");
  });
}

test("opt-in popup can take over a recent ring on mount; the panel, stale snapshots and repeat mounts cannot", async (t) => {
  const page = await openRuntimePage(t);
  await page.evaluate(() => {
    const seed = document.createElement("frigate-vision-card");
    const proto = Object.getPrototypeOf(seed._ensureLivestreamController());
    proto._startWebRTCviaWS = async function (name, video, runId) { this._playbackReady(name, video, runId, this._config()); };
    window.Audio = class { play() { return Promise.resolve(); } pause() {} };
    window.gumRequests = 0;
    navigator.mediaDevices.getUserMedia = () => { window.gumRequests++; throw Error("unexpected capture"); };
    const connection = Object.assign(new EventTarget(), { async subscribeEvents(cb) {
      window.deliverFresh = () => cb({ data: { entity_id: "input_boolean.fixture", old_state: { state: "off" }, new_state: window.mountState } });
      return async () => {};
    } });
    const dialog = document.createElement("dialog");
    dialog.style.width = "340px"; document.body.append(dialog); dialog.showModal();
    window.fresh = new Date().toISOString();
    window.mount = (popup, state, stamp) => {
      dialog.replaceChildren();
      const card = document.createElement("frigate-vision-card");
      window.mountState = { state, last_changed: stamp };
      card.hass = { connection, states: {
        "input_boolean.fixture": window.mountState,
        "camera.door": { attributes: { camera_name: "door", client_id: "demo" } },
      }, callWS: async () => ({ profile: { frigate_client_id: "demo" } }) };
      card.setConfig({ view_mode: "doorbell", doorbell_camera: "door", doorbell_ring_on_mount: popup, language: "en", go2rtc_modes: "webrtc",
        cameras: { door: { doorbell: { enabled: true, entity: "input_boolean.fixture" } } } });
      dialog.append(card);
    };
  });
  const answer = page.getByRole("button", { name: "Answer", exact: true });
  const mount = async (popup, state, when) => {
    await page.evaluate(({ popup, state, when }) => window.mount(popup, state, when === "fresh" ? window.fresh : when), { popup, state, when });
    await page.waitForFunction(() => {
      const tile = document.querySelector("frigate-vision-card").renderRoot.querySelector("frigate-vision-live-tile");
      const bell = tile?.renderRoot.querySelector("frigate-vision-doorbell");
      return bell?._subscription?.unsubscribe && bell?._surfaceVisible && (!bell.ringOnMount || bell._mountChecked);
    });
  };
  await mount(false, "on", "fresh"); assert.equal(await answer.count(), 0);
  await mount(true, "off", "fresh"); assert.equal(await answer.count(), 0);
  await mount(true, "on", "2000-01-01T00:00:00Z"); assert.equal(await answer.count(), 0);
  await mount(true, "on", "fresh"); await answer.waitFor();
  await page.getByRole("button", { name: "Decline call", exact: true }).click();
  await page.evaluate(() => window.deliverFresh());
  assert.equal(await answer.count(), 0);
  await mount(true, "on", "fresh"); assert.equal(await answer.count(), 0);
  assert.equal(await page.evaluate(() => window.gumRequests), 0);
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

async function openCameraNamesCard(t, config) {
  const page = await openRuntimePage(t);
  await page.evaluate(config => {
    const card = document.createElement("frigate-vision-card");
    card.hass = {
      states: {}, services: {}, callService: async () => {},
      callWS: async msg => msg.type === "media_source/browse_media" ? { children: [] } : [],
    };
    card.setConfig({ language: "de", go2rtc_modes: "webrtc", live_autostart: false, layout: "stacked",
      multiview_layout: "stacked", frigate_client_id: "demo", ...config });
    // Keep the real live lifecycle; only replace media I/O.
    const proto = Object.getPrototypeOf(card._ensureLivestreamController());
    proto._startWebRTCviaHTTP = proto._startWebRTCviaWS = async function (name, video, runId) {
      this._playbackReady(name, video, runId, this._config());
    };
    document.body.append(card);
  }, config);
  return page;
}

test("multiview tiles show the same camera names as the single live view", async (t) => {
  // Without a name, with an empty name and with a configured name.
  const cameras = { "front_door-cam": {}, back_yard: { name: "" }, garage: { name: "Garage Nord" } };
  const expected = { "front_door-cam": "Front Door Cam", back_yard: "Back Yard", garage: "Garage Nord" };

  const single = await openCameraNamesCard(t, { cameras });
  const singleNames = {};
  for (const camera of Object.keys(expected)) {
    singleNames[camera] = await single.evaluate(async camera => {
      const card = document.querySelector("frigate-vision-card");
      card._openLive(camera);
      await card.updateComplete;
      return card.renderRoot.querySelector(".player-wrap.live .live-cam-name").textContent.trim();
    }, camera);
  }
  assert.deepEqual(singleNames, expected);

  const multi = await openCameraNamesCard(t, { cameras, multiview: true });
  await multi.waitForFunction(() => {
    const tiles = [...document.querySelector("frigate-vision-card").renderRoot.querySelectorAll("frigate-vision-live-tile")];
    return tiles.length === 3 && tiles.every(tile => tile.renderRoot?.querySelector(".player-wrap.live .live-cam-name"));
  });
  const tileNames = await multi.evaluate(() => {
    const tiles = document.querySelector("frigate-vision-card").renderRoot.querySelectorAll("frigate-vision-live-tile");
    return Object.fromEntries([...tiles].map(tile => [tile.cameraId,
      tile.renderRoot.querySelector(".player-wrap.live .live-cam-name").textContent.trim()]));
  });
  assert.deepEqual(tileNames, expected);

  // A clip opened in a tile keeps the same name in its clip overlay.
  for (const camera of Object.keys(expected)) {
    const clipName = await multi.evaluate(async camera => {
      const card = document.querySelector("frigate-vision-card");
      card._activeClip = { _camera: camera };
      card._clipError = "Synthetic clip";
      await card.updateComplete;
      const tile = [...card.renderRoot.querySelectorAll("frigate-vision-live-tile")].find(tile => tile.cameraId === camera);
      await tile.updateComplete;
      return tile.renderRoot.querySelector(".player-wrap.clip .live-cam-name")?.textContent.trim();
    }, camera);
    assert.equal(clipName, expected[camera], camera);
  }
});
