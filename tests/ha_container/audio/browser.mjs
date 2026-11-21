// Runs only in the pinned Playwright container sharing the HA fixture's loopback.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '/opt/playwright-core/index.mjs';
import { browserOutput } from './output.mjs';

const base = 'http://127.0.0.1:8123';
const settings = JSON.parse(readFileSync(0, 'utf8'));
const headers = { Authorization: `Bearer ${settings.token}` };
const bellEntity = 'input_boolean.besucher';

async function setBell(state, attributeOnly = false) {
  const emitter = { Authorization: `Bearer ${settings.emitter}`, 'Content-Type': 'application/json' };
  const manual = attributeOnly || state === 'unavailable';
  const response = await fetch(`${base}/api/${manual ? `states/${bellEntity}` : `services/input_boolean/turn_${state}`}`, {
    method: 'POST', headers: emitter,
    body: JSON.stringify(manual ? { state, attributes: { fixture: true } } : { entity_id: bellEntity }),
  });
  assert.ok(response.ok, 'synthetic bell update failed');
}

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

const output = await browserOutput();
let browser;
try {
  browser = await chromium.launch({ ignoreDefaultArgs: ['--mute-audio'], env: output.env, args: [
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    '--use-file-for-fake-audio-capture=/tmp/fv-mic.wav',
  ] });
  // Verify the HA middleware is really in the signaling path (no unsigned proxy).
  assert.equal((await fetch(`${base}/api/frigate/smoke/go2rtc/ws/api/ws?src=fixture_b`)).status, 401);
  for (const [mode, direct] of [['toggle', false], ['hold', false], ['toggle', true], ['hold', true], ['doorbell', false], ['doorbell', true], ['doorbell-view', true]]) {
    const dedicated = mode === 'doorbell-view';
    const doorbell = mode === 'doorbell' || dedicated;
    const single = (doorbell && !direct) || dedicated;
    const description = dedicated ? 'direct/dedicated-popup' : direct ? 'direct/tile' : 'proxy/single';
    if (doorbell) await setBell('on');
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
          const t = window.player?.();
          return { provider: t?._provider || t?._liveProvider, talk: t?._talkState, loading: t?._loading || t?._liveLoading, failed: !!(t?._error || t?._liveError) };
        });
        throw Error(`Audio check timed out: ${JSON.stringify({ status, trace, errors })}`);
      }
    };
    await page.goto(`${base}/local/audio-check.html`);
    await page.evaluate(async ({ settings, mode, direct, directBase, bellEntity, single, dedicated, doorbell }) => {
      await import(settings.module);
      window.micRequests = 0;
      window.micTracks = [];
      const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (...args) => {
        window.micRequests++;
        const stream = await capture(...args);
        window.micTracks.push(...stream.getTracks());
        return stream;
      };
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
      window.wsCalls = [];
      const pending = new Map(), subscriptions = new Map();
      window.bellEvents = 0;
      socket.onmessage = e => {
        const msg = JSON.parse(e.data), request = pending.get(msg.id);
        if (msg.type === 'event') {
          if (msg.event.data?.entity_id === bellEntity) window.bellEvents++;
          subscriptions.get(msg.id)?.(msg.event);
          return;
        }
        if (!request) return;
        pending.delete(msg.id);
        if (msg.success) request.resolve(msg.result); else request.reject(Error('HA call failed'));
      };
      const send = (id, msg) => new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, ...msg }));
      });
      const connection = Object.assign(new EventTarget(), {
        async subscribeEvents(cb, event_type) {
          const subscription = ++id;
          subscriptions.set(subscription, cb);
          await send(subscription, { type: 'subscribe_events', event_type });
          window.ringSubscribed = true;
          return async () => {
            subscriptions.delete(subscription);
            await send(++id, { type: 'unsubscribe_events', subscription });
          };
        },
      });
      window.signed = [];
      const viewer = document.createElement(single ? 'frigate-vision-card' : 'frigate-vision-live-tile');
      window.player = () => dedicated ? viewer.shadowRoot?.querySelector('frigate-vision-live-tile') : viewer;
      viewer.hass = { connection, callWS(msg) {
        window.wsCalls.push(msg.type);
        if (msg.type === 'auth/sign_path') window.signed.push(msg.path);
        return send(++id, msg);
      } };
      const cameraEntry = { sub: 'fixture_b', main: 'fixture_b' };
      const cardConfig = { frigate_client_id: 'smoke', go2rtc_modes: 'webrtc,mse', talk_mode: mode };
      if (direct) cardConfig.go2rtc_url = directBase;
      if (doorbell) cameraEntry.doorbell = { enabled: true, entity: bellEntity, from: 'off', to: 'on' };
      if (direct || doorbell) {
        const states = await viewer.hass.callWS({ type: 'get_states' });
        viewer.hass.states = Object.fromEntries(states.map(s => [s.entity_id, s]));
      }
      if (single) {
        const options = { ...cardConfig, layout: 'stacked', auto_refresh_seconds: 0, cameras: { synthetic_camera: cameraEntry } };
        if (dedicated) {
          // Mounted by a dashboard container only after HA has published the ringing edge.
          viewer.setConfig({ ...options, view_mode: 'doorbell', doorbell_camera: 'synthetic_camera', doorbell_ring_on_mount: true, section_mode: true });
          const dialog = window.popup = document.createElement('dialog');
          Object.assign(dialog.style, { width: '320px', height: '240px', padding: '0' });
          dialog.append(viewer);
          document.body.append(dialog);
          dialog.showModal();
        } else {
          viewer.setConfig(options);
          viewer._hasFetchedOnce = true; // legacy single-player test excludes clip browsing
          document.body.append(viewer);
          viewer._openLive('synthetic_camera');
        }
      } else {
        viewer.cameraId = 'synthetic_camera'; viewer.cameraEntry = cameraEntry; viewer.cardConfig = cardConfig;
        document.body.append(viewer);
      }
    }, { settings: { token: settings.token, module: settings.module }, mode, direct, directBase, bellEntity, single, dedicated, doorbell });
    const video = page.locator('video.player');
    await wait(() => (window.player()?._provider || window.player()?._liveProvider) === 'webrtc', 25000);
    // Legacy talk buttons do not change the user's playback mute preference.
    // Keep their existing receive-track check. In Doorbell cases the actual
    // OS sink is the only receiver measurement; no probe or player injection.
    const down = doorbell ? null : await video.evaluate(async video => {
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
    if (down) assert.ok(Math.abs(down.hz - 440) < 10, `unexpected receive-track peak ${down.hz} Hz`);
    let checkFrames;
    const phone = page.locator('frigate-vision-doorbell .phone');
    const dismiss = page.locator('frigate-vision-doorbell .dismiss');
    const assertSpeakerStops = async (message) => {
      await delay(600); // allow in-flight RTP/jitter buffer to drain
      const off = (await speaker()).samples;
      await delay(1200);
      const after = (await speaker()).samples;
      assert.equal(after, off, message);
      return after - off;
    };
    const ring = async () => {
      await setBell('off');
      await setBell('on');
      await phone.waitFor({ state: 'visible' });
    };
    if (doorbell) {
      await wait(() => window.ringSubscribed, 10000);
      if (dedicated) {
        await phone.waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => window.micRequests), 0, 'taking over a call must not access the microphone');
        await dismiss.click();
        assert.equal(await video.count(), 1);
        assert.equal(await video.evaluate(v => v.controls), false);
      } else assert.equal(await phone.count(), 0, 'initial on is not an edge');
      await setBell('on', true);
      await wait(() => window.bellEvents >= 1, 5000);
      assert.equal(await phone.count(), 0, 'attribute-only update must not ring');
      await setBell('off'); await setBell('unavailable'); await setBell('on');
      await wait(() => window.bellEvents >= 4, 5000);
      assert.equal(await phone.count(), 0, 'unavailable gaps do not count as an edge');
      await output.noTone(`${description}/idle`);
      await ring();
      await output.noTone(`${description}/ringing`);
      await dismiss.click();
      await dismiss.waitFor({ state: 'hidden' });
      await output.noTone(`${description}/declined`);
      assert.equal(await page.evaluate(() => window.micRequests), 0);
      await video.evaluate(video => {
        const controller = window.player()._lc;
        window.frameProof = { video, stream: video.srcObject, peer: controller._peerConnection, frames: video.getVideoPlaybackQuality().totalVideoFrames };
      });
      checkFrames = async () => {
        await wait(() => window.frameProof.video.getVideoPlaybackQuality().totalVideoFrames > window.frameProof.frames + 1, 5000);
        assert.equal(await video.evaluate(video => {
          const previous = window.frameProof;
          previous.frames = video.getVideoPlaybackQuality().totalVideoFrames;
          return video === previous.video && video.srcObject === previous.stream && window.player()._lc._peerConnection === previous.peer;
        }), true, 'doorbell changed video, media stream or receive peer');
      };
      if (dedicated) {
        await page.evaluate(() => Object.assign(window.popup.style, { width: '760px', height: '450px' }));
        await checkFrames();
      }
      for (const [id, label, interrupt] of [['wait', 'Einen Moment bitte'], ['leave', 'Bitte vor der Tür abstellen'], ['leave', 'Bitte vor der Tür abstellen', true]]) {
        const sampleStart = (await speaker()).samples;
        await ring();
        await wait(() => window.player().shadowRoot.querySelector('frigate-vision-doorbell')._ringAudio?.currentTime > 0, 5000);
        assert.equal((await speaker()).samples, sampleStart, 'the local ringtone must not go to the camera');
        await checkFrames();
        const more = page.locator('frigate-vision-doorbell .more');
        await more.click();
        const choice = page.getByRole('button', { name: label });
        assert.ok((await choice.boundingBox()).y < (await more.boundingBox()).y, 'answer selection must open upwards');
        const loaded = page.waitForResponse(response => response.ok() && response.url().endsWith(`/doorbell/${id}.flac`));
        await choice.click();
        await loaded;
        let rms = 0;
        for (let n = 0; n < 180; ++n) {
          const sample = await speaker();
          if (sample.samples >= sampleStart + 1600 && sample.mic880 < sample.rms * .2) rms = Math.max(rms, sample.rms);
          if (rms > .04) break;
          await delay(60);
        }
        assert.ok(rms > .04, 'no decoded speech at the synthetic speaker');
        if (interrupt) {
          await dismiss.evaluate(() => {
            const attempt = window.player()._lc._announcement;
            window.replyTrack = attempt?.output?.stream.getAudioTracks()[0];
            if (window.replyTrack?.readyState !== 'live') throw Error('speech track is not running before End');
          });
          await dismiss.click();
          assert.equal(await page.evaluate(() => window.replyTrack.readyState), 'ended');
          await assertSpeakerStops('speaker still received speech samples after End');
        }
        await dismiss.waitFor({ state: 'hidden', timeout: 10000 });
        assert.equal(await page.evaluate(() => window.micRequests), 0, 'quick replies must never request the microphone');
        await checkFrames();
        console.log(`${description}/doorbell ${id}${interrupt ? ' (End)' : ''}: decoded speech RMS ${rms}, no mic, same live peer with advancing frames`);
      }
      await ring();
    }
    const before = (await speaker()).samples;
    const waitForMic = async (baseline) => {
      for (let n = 0; n < 80; ++n) {
        const sample = await speaker();
        if (sample.samples >= baseline + 1600 && sample.mic880 > 0.01 && sample.mic880 > sample.camera440 * 6) return sample;
        await delay(100);
      }
      throw Error('no fresh 880 Hz microphone tone at synthetic speaker');
    };
    const button = doorbell ? phone : page.locator('frigate-vision-talk-button button');
    if (mode !== 'hold') await button.click();
    else { await button.hover(); await page.mouse.down(); }
    await wait(() => window.player()._talkState === 'sending', 16000);
    const up = await waitForMic(before);
    if (doorbell) {
      await checkFrames();
      await output.tone(`${description}/microphone active`);
      await video.evaluate(v => {
        const a = window.player()._lc._talk;
        const peer = a.link._peerConnection;
        window.muteProof = { attempt: a, peer, sender: peer.getSenders()[0], track: a.mic, cameraMuted: v.muted, offers: window.signed.length };
      });
      const mic = page.locator('frigate-vision-doorbell .mic-toggle');
      const toggle = async (muted) => {
        await mic.click();
        await page.waitForFunction(muted => window.player()._talkMuted === muted, muted);
        assert.equal(await mic.getAttribute('aria-pressed'), String(muted));
        assert.equal(await video.evaluate((v, muted) => {
          const p = window.muteProof, a = window.player()._lc._talk, peer = a.link._peerConnection;
          window.frameProof.frames = v.getVideoPlaybackQuality().totalVideoFrames;
          return a === p.attempt && peer === p.peer && peer.getSenders()[0] === p.sender && p.sender.track === p.track &&
            p.track.enabled !== muted && v.muted === p.cameraMuted && window.micRequests === 1 && window.signed.length === p.offers;
        }, muted), true, 'Mute changed media, source or signaling instead of only the mic track');
        await checkFrames();
      };
      await toggle(true);
      await output.tone(`${description}/microphone muted`);
      await delay(600);
      let quiet = await speaker();
      const mutedBaseline = quiet.samples;
      let worstMutedTone = 0;
      for (let n = 0; n < 4; ++n) {
        await delay(250);
        const sample = await speaker();
        if (sample.samples !== quiet.samples) {
          assert.ok(sample.rms < 0.012 && sample.mic880 < 0.004, 'voice/tone leaked while muted');
          worstMutedTone = Math.max(worstMutedTone, sample.mic880);
        }
        quiet = sample;
      }
      await toggle(false);
      const resumed = await waitForMic(quiet.samples);
      await output.tone(`${description}/microphone restored`);
      console.log(`${description}/mute: ${up.mic880} → ${quiet.samples === mutedBaseline ? 'no new samples' : worstMutedTone} → ${resumed.mic880} at 880 Hz, same peers and running frames`);
      await toggle(true);
      assert.equal(await dismiss.getAttribute('data-sending'), '');
      if (dedicated) await page.evaluate(() => window.popup.close());
      else await dismiss.click();
      await dismiss.waitFor({ state: 'hidden' });
      // A closed dialog becomes non-visible before the intersection callback.
      await wait(() => !window.player()._lc.talkRequested, 5000);
      assert.deepEqual(await page.evaluate(() => ({ tracks: window.micTracks.map(track => track.readyState),
        sendPeer: window.muteProof.peer.connectionState, attempt: window.player()._lc.talkRequested })),
      { tracks: ['ended'], sendPeer: 'closed', attempt: false });
      await output.noTone(`${description}/${dedicated ? 'popup closed' : 'ended'}`);
      await checkFrames();
    } else {
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      if (mode === 'toggle') await button.click(); else await page.mouse.up();
      assert.equal(await button.getAttribute('aria-pressed'), 'false');
    }
    const afterStop = await assertSpeakerStops('speaker still received microphone samples after stop');
    assert.equal(directPlayback, direct, 'did not exercise the requested playback path');
    const outgoingCount = doorbell ? 4 : 1;
    assert.deepEqual(signedMicOffers, Array(outgoingCount).fill(true), 'every outgoing offer must use the exact signed HA WebSocket');
    assert.deepEqual(await page.evaluate(() => window.signed), Array(outgoingCount + (direct ? 0 : 1)).fill(`${proxyPath}?src=fixture_b`));
    assert.deepEqual(errors, []);
    if (dedicated) assert.ok((await page.evaluate(() => window.wsCalls)).every(type => ['get_states', 'frigate_vision/profile', 'auth/sign_path', 'frigate_vision/camera_streams'].includes(type)), 'Doorbell view must not browse events or recordings');
    const receiver = down ? `receive track ${down.hz} Hz (${down.db} dB)` : 'browser PCM checked above';
    console.log(`${direct ? 'direct' : 'proxy'}/${mode}: ${receiver}; speaker 880 Hz amplitude ${up.mic880}, 440 Hz ${up.camera440}; after stop ${afterStop} new samples / 1200 ms`);
    await page.close();
  }
} finally {
  try { await browser?.close(); }
  finally { await output.close(); }
}
