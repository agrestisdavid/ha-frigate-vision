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
