// Runs only in the pinned Playwright container sharing the HA fixture's loopback.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '/opt/playwright-core/index.mjs';

const base = 'http://127.0.0.1:8123';
const settings = JSON.parse(readFileSync(0, 'utf8'));
const headers = { Authorization: `Bearer ${settings.token}` };

// Chromium captures this generated WAV through its native getUserMedia path.
// No microphone device, PulseAudio socket or host recording is mounted.
const rate = 48000, length = rate * 5;
const wav = Buffer.alloc(44 + length * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
for (let i = 0; i < length; ++i) wav.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * 880 * i / rate)), 44 + i * 2);
writeFileSync('/tmp/fv-mic.wav', wav);

async function speaker() {
  const response = await fetch(`${base}/api/fv_audio_test/speaker`, { headers });
  assert.equal(response.status, 200, 'fixture speaker meter must be authenticated');
  return response.json();
}

const browser = await chromium.launch({ args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--use-file-for-fake-audio-capture=/tmp/fv-mic.wav',
  '--autoplay-policy=no-user-gesture-required',
] });
try {
  // Verify the HA middleware is really in the signaling path (no unsigned proxy).
  assert.equal((await fetch(`${base}/api/frigate/smoke/go2rtc/ws/api/ws?src=fixture_b`)).status, 401);
  for (const [mode, direct] of [['toggle', false], ['hold', false], ['toggle', true], ['hold', true]]) {
    const page = await browser.newPage({ permissions: ['microphone'] });
    const errors = [], trace = [], signedMicOffers = [];
    let directPlayback = false;
    const directBase = 'http://127.0.0.1:1984';
    const proxyPath = '/api/frigate/smoke/go2rtc/ws/api/ws';
    page.on('response', response => {
      if (response.ok() && response.request().method() === 'POST' && response.url() === `${directBase}/api/webrtc?src=fixture_b`) directPlayback = true;
    });
    page.on('pageerror', error => errors.push(error.name));
    // Retain protocol stages, never auth payloads, SDP, ICE addresses or signed URLs.
    page.on('websocket', socket => {
      for (const event of ['framesent', 'framereceived']) socket.on(event, ({ payload }) => {
        if (typeof payload !== 'string') return;
        let msg; try { msg = JSON.parse(payload); } catch { return; }
        if (['webrtc/offer', 'webrtc/answer', 'webrtc/candidate', 'mse', 'error', 'auth/sign_path'].includes(msg.type)) {
          trace.push(`${event}:${msg.type}`);
          if (event === 'framesent' && msg.type === 'webrtc/offer') {
            const url = new URL(socket.url());
            if (msg.value.includes('a=sendonly')) {
              signedMicOffers.push(url.origin === base.replace(/^http/, 'ws') && url.pathname === proxyPath && url.searchParams.get('src') === 'fixture_b' && !!url.searchParams.get('authSig'));
            } else if (url.origin === directBase.replace(/^http/, 'ws')) directPlayback = true;
          }
          if (['webrtc/offer', 'webrtc/answer'].includes(msg.type)) trace.push(`embedded-candidates:${String(msg.value).split('a=candidate:').length - 1}`);
        } else if (msg.type === 'result') trace.push(`ha-result:${!!msg.success}`);
      });
    });
    page.on('console', msg => {
      const state = msg.text().match(/WebRTC-WS: (iceState|connState|track) (\w+)\b/);
      if (state) trace.push(`${state[1]}:${state[2]}`);
      if (msg.text().includes('candidate rejected')) trace.push('candidate-rejected');
    });
    const wait = async (predicate, timeout) => {
      try { await page.waitForFunction(predicate, null, { timeout }); }
      catch {
        const status = await page.evaluate(() => {
          const t = document.querySelector('frigate-vision-live-tile');
          return { provider: t?._provider, talk: t?._talkState, loading: t?._loading, failed: !!t?._error };
        });
        throw Error(`Audio check timed out: ${JSON.stringify({ status, trace, errors })}`);
      }
    };
    await page.goto(`${base}/local/audio-check.html`);
    await page.evaluate(async ({ settings, mode, direct, directBase }) => {
      await import(settings.module);
      const socket = new WebSocket(`ws://${location.host}/api/websocket`);
      await new Promise((resolve, reject) => {
        socket.onerror = () => reject(Error('HA fixture websocket unavailable'));
        socket.onmessage = e => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'auth_required') socket.send(JSON.stringify({ type: 'auth', access_token: settings.token }));
          else if (msg.type === 'auth_ok') resolve();
          else reject(Error('HA fixture auth failed'));
        };
      });
      let id = 0;
      const pending = new Map();
      socket.onmessage = e => {
        const msg = JSON.parse(e.data), request = pending.get(msg.id);
        if (!request) return;
        pending.delete(msg.id);
        if (msg.success) request.resolve(msg.result); else request.reject(Error('HA call failed'));
      };
      window.signed = [];
      const tile = document.createElement('frigate-vision-live-tile');
      tile.hass = { callWS(msg) {
        if (msg.type === 'auth/sign_path') window.signed.push(msg.path);
        return new Promise((resolve, reject) => {
          pending.set(++id, { resolve, reject });
          socket.send(JSON.stringify({ id, ...msg }));
        });
      } };
      tile.cameraId = 'synthetic_camera'; tile.cameraEntry = { sub: 'fixture_b', main: 'fixture_b' };
      tile.cardConfig = { frigate_client_id: 'smoke', go2rtc_modes: 'webrtc,mse', talk_mode: mode };
      if (direct) {
        tile.cardConfig.go2rtc_url = directBase;
        const states = await tile.hass.callWS({ type: 'get_states' });
        tile.hass.states = Object.fromEntries(states.map(s => [s.entity_id, s]));
      }
      document.body.append(tile);
    }, { settings, mode, direct, directBase });
    const video = page.locator('video.player');
    await wait(() => document.querySelector('frigate-vision-live-tile')?._provider === 'webrtc', 25000);
    // Measure decoded samples from the receiving player's media stream, not SDP,
    // packet counters, the generator or a microphone local-monitor stream.
    const down = await video.evaluate(async video => {
      const ctx = new AudioContext();
      try {
        const [received] = video.srcObject.getAudioTracks();
        const src = ctx.createMediaStreamSource(new MediaStream([received]));
        const meter = ctx.createAnalyser(); meter.fftSize = 8192; meter.smoothingTimeConstant = 0;
        src.connect(meter); await ctx.resume();
        const bins = new Float32Array(meter.frequencyBinCount), binHz = ctx.sampleRate / meter.fftSize;
        const at = hz => { const i = Math.round(hz / binHz); return Math.max(...bins.slice(i - 1, i + 2)); };
        // The first FFT windows can contain silence or WebRTC startup transients.
        // Require the expected tone to dominate three consecutive windows; a
        // little energy near 440 Hz with a different spectral peak is not proof.
        let stable = 0, peakHz = 0;
        for (let n = 0; n < 80; n++) {
          await new Promise(resolve => setTimeout(resolve, 100)); meter.getFloatFrequencyData(bins);
          const camera = at(440), mic = at(880);
          peakHz = Math.round(bins.indexOf(Math.max(...bins)) * binHz);
          stable = camera > -55 && camera - mic > 16 && Math.abs(peakHz - 440) <= binHz ? stable + 1 : 0;
          if (stable >= 3) return { hz: peakHz, db: Math.round(camera) };
        }
        throw Error(`No sustained 440 Hz camera tone in the browser (last peak ${peakHz} Hz)`);
      } finally { await ctx.close(); }
    });
    assert.ok(Math.abs(down.hz - 440) < 10, `unexpected browser peak ${down.hz} Hz`);
    const before = (await speaker()).samples;
    const button = page.locator('frigate-vision-talk-button button');
    if (mode === 'toggle') await button.click();
    else { await button.hover(); await page.mouse.down(); }
    await wait(() => document.querySelector('frigate-vision-live-tile')._talkState === 'sending', 16000);
    let up;
    for (let n = 0; n < 80; ++n) {
      up = await speaker();
      if (up.samples >= before + 1600 && up.mic880 > 0.01 && up.mic880 > up.camera440 * 6) break;
      await delay(100);
    }
    assert.ok(up.samples >= before + 1600 && up.mic880 > 0.01 && up.mic880 > up.camera440 * 6,
      `no fresh 880 Hz microphone tone at synthetic speaker: ${JSON.stringify(up)}`);
    if (mode === 'toggle') await button.click(); else await page.mouse.up();
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    await delay(600); // allow in-flight RTP/jitter buffer to drain
    const off = (await speaker()).samples;
    await delay(1200);
    const after = (await speaker()).samples;
    assert.equal(after, off, 'speaker still received microphone samples after stop');
    assert.equal(directPlayback, direct, 'did not exercise the requested playback path');
    assert.deepEqual(signedMicOffers, [true], 'every microphone offer must use the signed HA WebSocket');
    assert.deepEqual(await page.evaluate(() => window.signed), Array(direct ? 1 : 2).fill(`${proxyPath}?src=fixture_b`));
    assert.deepEqual(errors, []);
    console.log(`${direct ? 'direct' : 'proxy'}/${mode}: browser ${down.hz} Hz (${down.db} dB); speaker 880 Hz amplitude ${up.mic880}, 440 Hz ${up.camera440}; after stop ${after - off} new samples / 1200 ms`);
    await page.close();
  }
} finally { await browser.close(); }
