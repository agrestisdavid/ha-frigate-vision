import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUTS = [
  ["custom_components/frigate_vision/brand/icon.png", 256],
  ["custom_components/frigate_vision/brand/icon@2x.png", 512],
];
const SUPERSAMPLE = 4;
const CHECK_ONLY = process.argv.includes("--check");
const unknownArguments = process.argv.slice(2).filter((value) => value !== "--check");

if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    scanlines[row] = 0;
    rgba.copy(scanlines, row + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND"),
  ]);
}

function render(size) {
  const scale = SUPERSAMPLE;
  const width = size * scale;
  const pixels = Buffer.alloc(width * width * 4);

  function blend(x, y, color) {
    if (x < 0 || y < 0 || x >= width || y >= width) return;
    const offset = (Math.floor(y) * width + Math.floor(x)) * 4;
    const alpha = color[3] / 255;
    const oldAlpha = pixels[offset + 3] / 255;
    const outAlpha = alpha + oldAlpha * (1 - alpha);
    if (outAlpha === 0) return;
    for (let channel = 0; channel < 3; channel += 1) {
      pixels[offset + channel] = Math.round(
        (color[channel] * alpha +
          pixels[offset + channel] * oldAlpha * (1 - alpha)) /
          outAlpha,
      );
    }
    pixels[offset + 3] = Math.round(outAlpha * 255);
  }

  function circle(cx, cy, radius, color) {
    const left = Math.floor(cx - radius);
    const right = Math.ceil(cx + radius);
    for (let y = left; y <= right; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= radius * radius) blend(x, y, color);
      }
    }
  }

  function roundedRect(x, y, rectWidth, rectHeight, radius, color) {
    for (let py = Math.floor(y); py < Math.ceil(y + rectHeight); py += 1) {
      for (let px = Math.floor(x); px < Math.ceil(x + rectWidth); px += 1) {
        const nearestX = Math.max(x + radius, Math.min(px + 0.5, x + rectWidth - radius));
        const nearestY = Math.max(y + radius, Math.min(py + 0.5, y + rectHeight - radius));
        const dx = px + 0.5 - nearestX;
        const dy = py + 0.5 - nearestY;
        if (dx * dx + dy * dy <= radius * radius) blend(px, py, color);
      }
    }
  }

  const s = (value) => value * size * scale;
  const navy = [15, 23, 42, 255];
  const cyan = [34, 211, 238, 255];
  const cyanDark = [8, 145, 178, 255];
  const white = [248, 250, 252, 255];

  circle(s(0.5), s(0.5), s(0.46), cyan);
  circle(s(0.5), s(0.5), s(0.405), navy);
  roundedRect(s(0.21), s(0.35), s(0.58), s(0.38), s(0.07), white);
  roundedRect(s(0.31), s(0.27), s(0.22), s(0.12), s(0.035), white);
  circle(s(0.51), s(0.54), s(0.145), cyanDark);
  circle(s(0.51), s(0.54), s(0.105), navy);
  circle(s(0.51), s(0.54), s(0.052), cyan);
  circle(s(0.69), s(0.43), s(0.025), cyanDark);

  roundedRect(s(0.76), s(0.19), s(0.035), s(0.13), s(0.0175), white);
  roundedRect(s(0.7125), s(0.2375), s(0.13), s(0.035), s(0.0175), white);
  circle(s(0.7775), s(0.255), s(0.035), cyan);

  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const source = ((y * scale + sy) * width + x * scale + sx) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            sums[channel] += pixels[source + channel];
          }
        }
      }
      const target = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output[target + channel] = Math.round(sums[channel] / (scale * scale));
      }
    }
  }
  return encodePng(size, size, output);
}

for (const [relativePath, size] of OUTPUTS) {
  const path = resolve(ROOT, relativePath);
  const generated = render(size);
  if (CHECK_ONLY) {
    const existing = await readFile(path);
    if (!existing.equals(generated)) {
      throw new Error(`Brand image is stale: ${relativePath}`);
    }
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, generated);
  }
}

console.log(
  CHECK_ONLY
    ? "Verified local Frigate Vision brand icons."
    : "Generated local Frigate Vision brand icons.",
);
