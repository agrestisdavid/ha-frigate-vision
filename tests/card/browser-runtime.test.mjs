import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { chromium } from "playwright";

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

  assert.equal(result.hlsVersion, "1.7.3");
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
      const field = [...editor.renderRoot.querySelectorAll(".cam-entry-body ha-formfield")]
        .find((field) => /Ultra-Wide/i.test(field.getAttribute("label") || ""));
      if (!field) throw new Error("Per-camera Ultra-Wide control is missing");
      return field.querySelector("ha-switch");
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
    const name = editor.renderRoot.querySelector('ha-textfield[label="Anzeigename"]');
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
