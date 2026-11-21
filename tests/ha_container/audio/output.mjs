// Measure Chromium's operating-system audio output, not a browser audio graph.
// The default PulseAudio device is a private virtual sink with no hardware path.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

export async function browserOutput() {
  const dir = mkdtempSync('/tmp/fv-output-');
  const socket = `${dir}/pulse`;
  const env = { ...process.env, PULSE_SERVER: `unix:${socket}`, PULSE_SINK: 'fv_browser' };
  const pulse = spawn('pulseaudio', ['-n', '--daemonize=no', '--exit-idle-time=-1',
    '--load', `module-native-protocol-unix socket=${socket} auth-anonymous=1`,
    '--load', 'module-null-sink sink_name=fv_browser rate=48000 channels=2'], { env, stdio: 'ignore' });
  let monitor;
  const stop = async child => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exit = once(child, 'exit');
    child.kill();
    await exit;
  };
  async function close() {
    await stop(monitor);
    await stop(pulse);
    rmSync(dir, { recursive: true, force: true });
  }
  try {
    let sinks;
    for (let i = 0; i < 50; i++) {
      sinks = spawnSync('pactl', ['list', 'short', 'sinks'], { env, encoding: 'utf8', timeout: 1000 });
      if (sinks.status === 0) break;
      await delay(100);
    }
    assert.equal(sinks?.status, 0, 'private PulseAudio server not ready');
    assert.deepEqual(sinks.stdout.trim().split('\n').map(line => line.split('\t')[1]), ['fv_browser'], 'must expose only the null sink');
    monitor = spawn('parec', ['--device=fv_browser.monitor', '--raw', '--format=s16le', '--rate=48000',
      '--channels=1', '--latency-msec=50'], { env, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (error) {
    await close();
    throw error;
  }

  const frames = 4800; // 100 ms at 48 kHz; both tone bins land on integral cycles.
  const bins = [440, 880].map(hz => Array.from({ length: frames }, (_, i) => {
    const phase = 2 * Math.PI * i * hz / 48000;
    return [Math.cos(phase), Math.sin(phase)];
  }));
  let sequence = 0, chunk = Buffer.alloc(0);
  const recent = [];
  monitor.stdout.on('data', data => {
    chunk = Buffer.concat([chunk, data]);
    while (chunk.length >= frames * 2) {
      let cameraX = 0, cameraY = 0, micX = 0, micY = 0;
      for (let i = 0; i < frames; i++) {
        const x = chunk.readInt16LE(i * 2) / 32768;
        cameraX += x * bins[0][i][0]; cameraY += x * bins[0][i][1];
        micX += x * bins[1][i][0]; micY += x * bins[1][i][1];
      }
      recent.push({ id: ++sequence, camera: 2 * Math.hypot(cameraX, cameraY) / frames, mic: 2 * Math.hypot(micX, micY) / frames });
      if (recent.length > 120) recent.shift();
      chunk = chunk.subarray(frames * 2);
    }
  });
  const after = cursor => recent.filter(({ id }) => id > cursor);
  return {
    env, close,
    async tone(label) {
      const start = sequence;
      for (let i = 0; i < 65; i++) {
        const lately = after(start).slice(-3);
        if (lately.length === 3 && lately.every(x => x.camera > .012 && x.mic < x.camera * .2)) {
          const min = Math.min(...lately.map(x => x.camera));
          console.log(`Browser PCM ${label}: 440 Hz amplitude >= ${min.toFixed(4)} in 3 fresh windows`);
          return min;
        }
        await delay(100);
      }
      throw Error(`No audible 440 Hz from the product video at browser output (${label}): ${JSON.stringify(after(start).slice(-3))}`);
    },
    async noTone(label) {
      // Ignore queued samples from the previous phase, then reject a camera
      // tone even if there is a legitimate other sound (e.g. the ringtone).
      await delay(300);
      const start = sequence;
      await delay(600);
      const windows = after(start);
      const max = Math.max(0, ...windows.map(x => x.camera));
      assert.ok(windows.length >= 3, `Null-sink monitor has no fresh PCM (${label})`);
      assert.ok(max < .006, `Unexpected 440 Hz camera tone at browser output (${label}): ${max}`);
      console.log(`Browser PCM ${label}: no 440 Hz tone (${windows.length} output windows, peak ${max.toFixed(5)})`);
    },
  };
}
