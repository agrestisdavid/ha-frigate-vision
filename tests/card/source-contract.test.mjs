import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../custom_components/frigate_vision/frontend/frigate-vision-card.js",
  import.meta.url,
);
const source = await readFile(sourceUrl, "utf8");
const vendorRoot = new URL(
  "../../custom_components/frigate_vision/frontend/vendor/",
  import.meta.url,
);
const vendorManifest = JSON.parse(
  await readFile(new URL("vendor-manifest.json", vendorRoot), "utf8"),
);
const litRuntime = await readFile(
  new URL("lit-element-2.5.1.js", vendorRoot),
  "utf8",
);
const hlsRuntime = await readFile(
  new URL("hls-1.5.17.js", vendorRoot),
  "utf8",
);
const hlsModule = await import(new URL("hls-1.5.17.js", vendorRoot));

test("uses independent card and custom-element names", () => {
  for (const name of [
    "frigate-vision-card",
    "frigate-vision-card-editor",
    "frigate-vision-live-tile",
  ]) {
    assert.match(source, new RegExp(`customElements\\.define\\(\\s*["']${name}["']`));
  }
  assert.match(source, /type:\s*"frigate-vision-card"/);
  assert.doesNotMatch(source, /frigate-llm-vision-timeline-card/i);
  assert.doesNotMatch(source, /frigate-llm-live-tile/i);
});

test("has no legacy analysis timeline client or fuzzy event fallback", () => {
  for (const forbidden of [
    /\/api\/llmvision/i,
    /llmvision\/timeline/i,
    /\b_llmEvents\b/,
    /\bllm_vision\b/,
    /\bev\._llm\b/,
    /\b_fetchLlmVisionEvents\b/,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test("uses its own deep-link key", () => {
  assert.match(source, /k === "frigate_vision_clip"/);
  assert.doesNotMatch(source, /k === "clip"/);
});

test("joins Frigate metadata by exact event id", () => {
  assert.match(source, /this\._frigateApiById\.get\(ev\._eventId\)/);
  assert.match(source, /ev\._label = merged\.label\.trim\(\)/);
  assert.match(source, /ev\._camera = merged\.camera\.trim\(\)/);
  assert.match(source, /mediaItem\?\.frigate\?\.event/);
  assert.match(source, /embedded\?\.id \|\| parseFrigateEventId/);
  assert.match(source, /description:\s*String\(data\?\.description/);
  assert.match(source, /typeof raw\.has_clip === "boolean"/);
  assert.doesNotMatch(source, /\bTOL\s*=/);
  assert.doesNotMatch(source, /\bbestDelta\b/);
});

test("uses signed MP4-first clip playback without raw HA tokens", () => {
  assert.match(source, /type:\s*"auth\/sign_path"/);
  assert.match(
    source,
    /_beginClipSource\("event_mp4",\s*directUrl,\s*token\)/,
  );
  assert.match(
    source,
    /_beginClipSource\("resolved_hls",\s*result\.url,\s*token\)/,
  );
  assert.match(
    source,
    /_beginClipSource\(\s*"bounded_recording"/,
  );
  assert.match(source, /sourceKind === "resolved_hls" \? 60000 : 40000/);
  assert.match(source, /this\._clipLoading && !this\._clipError/);
  assert.doesNotMatch(source, /access_token/);
  assert.doesNotMatch(source, /authSig=\$\{/);
});

test("does not write signed HA media URLs to the console", () => {
  const consoleCalls =
    source.match(/console\.(?:info|warn|error|debug)\([\s\S]*?\);/g) || [];
  for (const call of consoleCalls) {
    assert.doesNotMatch(
      call,
      /_clipUrl|_mjpegSignedUrl|_mp4SignedUrl|signedManifestPath|signedUrl|authSig/,
    );
  }
});

test("does not classify generic HLS timeouts and network failures as no clip", () => {
  const classifierStart = source.indexOf("  _classifyClipError(");
  const classifierEnd = source.indexOf("  _clipFailureText(", classifierStart);
  assert.ok(classifierStart >= 0 && classifierEnd > classifierStart);
  const classifier = source.slice(classifierStart, classifierEnd);
  assert.match(classifier, /status === 404 \|\| status === 410/);
  assert.match(classifier, /return "timeout"/);
  assert.match(classifier, /return "network"/);
  assert.match(classifier, /return "decoder"/);
  assert.doesNotMatch(classifier, /manifestLoadTimeOut.*no_clip/s);
});

test("builds German titles with recognized person sub-labels only", () => {
  const titleStart = source.indexOf("  _eventTitle(");
  const titleEnd = source.indexOf("  _eventShortDesc(", titleStart);
  assert.ok(titleStart >= 0 && titleEnd > titleStart);
  const titleHelper = source.slice(titleStart, titleEnd);
  assert.match(titleHelper, /translateLabel\(ev\?\._label \|\| "", "de"\)/);
  assert.match(
    titleHelper,
    /`\$\{detection\}\$\{identity\} in \$\{camera\} wurde erkannt`/,
  );
  assert.match(titleHelper, /ev\?\._frigate\?\.subLabel/);
  assert.match(titleHelper, /=== "person" && subLabel/);
  for (const forbidden of ["reviewTitle", "description"]) {
    assert.doesNotMatch(titleHelper, new RegExp(forbidden));
  }
});

test("keeps descriptions separate with the documented Frigate priority", () => {
  const descriptionStart = source.indexOf("  _eventFullDesc(");
  const descriptionEnd = source.indexOf("  _renderRow(", descriptionStart);
  assert.ok(descriptionStart >= 0 && descriptionEnd > descriptionStart);
  const helpers = source.slice(descriptionStart, descriptionEnd);
  const descriptionOrder = [
    "reviewScene",
    "reviewSummary",
    "description",
  ].map((token) => helpers.indexOf(token));
  assert.ok(descriptionOrder.every((position) => position >= 0));
  assert.deepEqual(
    descriptionOrder,
    [...descriptionOrder].sort((a, b) => a - b),
  );
});

test("retains all five go2rtc transports and the pinned HLS runtime", () => {
  assert.match(
    source,
    /VALID_GO2RTC_MODES\s*=\s*\["webrtc",\s*"mse",\s*"mp4",\s*"hls",\s*"mjpeg"\]/,
  );
  for (const mode of ["webrtc", "mse", "mp4", "hls", "mjpeg"]) {
    assert.match(source, new RegExp(`mode === ["']${mode}["']`));
  }
  assert.equal(vendorManifest.packages["hls.js"], "1.5.17");
  assert.match(source, /const HLS_MODULE = "\.\/vendor\/hls-1\.5\.17\.js"/);
});

test("loads browser dependencies only from the bundled vendor directory", () => {
  assert.equal(vendorManifest.packages["lit-element"], "2.5.1");
  assert.equal(vendorManifest.packages["lit-html"], "1.4.1");
  assert.match(source, /from "\.\/vendor\/lit-element-2\.5\.1\.js"/);
  assert.match(source, /import\(HLS_MODULE\)/);
  for (const runtimeSource of [source, litRuntime, hlsRuntime]) {
    assert.doesNotMatch(
      runtimeSource,
      /\b(?:import|export)[\s\S]{0,120}\bfrom\s*["']https?:\/\//,
    );
    assert.doesNotMatch(
      runtimeSource,
      /\bimport\s*\(\s*["']https?:\/\//,
    );
  }
  assert.doesNotMatch(source, /document\.createElement\(["']script["']\)/);
  assert.doesNotMatch(source, /\bwindow\.Hls\b/);
});

test("WebRTC uses go2rtc candidates without a public STUN service", () => {
  assert.doesNotMatch(source, /\bstun:/i);
  assert.doesNotMatch(source, /\biceServers\b/);
  const peerConnections =
    source.match(
      /new RTCPeerConnection\(\{\s*bundlePolicy:\s*"max-bundle",?\s*\}\)/g,
    ) || [];
  assert.equal(peerConnections.length, 2);
});

test("uses the authenticated HA Frigate proxy without logging signaling secrets", () => {
  assert.match(
    source,
    /const endpoint = legacy \? "mse\/api\/ws" : "go2rtc\/ws\/api\/ws"/,
  );
  assert.match(source, /src=\$\{encodeURIComponent\(cameraName\)\}/);
  assert.match(source, /type:\s*"auth\/sign_path"/);
  assert.match(source, /expires:\s*300/);
  assert.match(source, /location\.protocol === "https:" \? "wss:" : "ws:"/);
  assert.match(source, /DEFAULT_GO2RTC_MODES\s*=\s*"webrtc,mse,mp4,hls,mjpeg"/);
  assert.doesNotMatch(source, /bad candidate:["']?,?\s*data\.value/);
  assert.doesNotMatch(source, /WebRTC-HTTP:\s*POST["']?,?\s*url/);
  assert.doesNotMatch(source, /server error:\s*\$\{data\.value\}/);
  assert.doesNotMatch(source, /connected:["']?,?\s*streamName/);
  assert.match(source, /videoTrackReceived\s*&&\s*transportConnected/);
  assert.match(source, /_runGeneration/);
  assert.doesNotMatch(source, /setRemoteDescription[^\n]{0,200}e\?\.message/);
  assert.doesNotMatch(source, /candidate rejected[^\n]{0,200}e\?\.message/);
});

test("bundled hls.js exposes the pinned default runtime", () => {
  assert.equal(typeof hlsModule.default, "function");
  assert.equal(hlsModule.default.version, "1.5.17");
});

test("keeps standalone URLs and supports the optional central profile", () => {
  assert.match(source, /type:\s*"frigate_vision\/profile"/);
  assert.match(source, /frigate_vision_entry_id/);
  assert.match(source, /profileMessage\.entry_id/);
  assert.match(source, /config\.go2rtc_url/);
  assert.match(source, /config\.go2rtc_url_external/);
  assert.match(source, /config\.frigate_url/);
});
