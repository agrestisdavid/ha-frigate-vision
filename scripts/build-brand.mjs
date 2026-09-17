import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "assets/brand/frigate-vision.png");
const OUTPUTS = [
  ["custom_components/frigate_vision/brand/icon.png", 256],
  ["custom_components/frigate_vision/brand/icon@2x.png", 512],
  ["custom_components/frigate_vision/brand/logo.png", 256],
  ["custom_components/frigate_vision/brand/logo@2x.png", 512],
  ["docs/assets/frigate-vision.png", 512],
  ["docs/assets/favicon.png", 32],
  ["assets/brand/social-preview.png", 1280, 640],
];
const CHECK_ONLY = process.argv.includes("--check");
const unknownArguments = process.argv.slice(2).filter((value) => value !== "--check");

if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
}

// Keep the approved artwork as the source instead of redrawing the old icon.
const source = await readFile(SOURCE);
const metadata = await sharp(source).metadata();
if (
  metadata.format !== "png" ||
  metadata.width !== metadata.height ||
  metadata.width < 640
) {
  throw new Error("Brand source must be a square PNG of at least 640 pixels.");
}

for (const [relativePath, width, height = width] of OUTPUTS) {
  const path = resolve(ROOT, relativePath);
  const generated = await sharp(source)
    .resize(width, height, {
      fit: "contain",
      background: "#ffffff",
      kernel: "lanczos3",
    })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  if (CHECK_ONLY) {
    const existing = await readFile(path);
    if (!existing.equals(generated)) {
      throw new Error(`Brand image is stale: ${relativePath}. Run npm run build:brand.`);
    }
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, generated);
  }
}

console.log(
  CHECK_ONLY
    ? "Verified local Frigate Vision brand icons."
    : "Generated local Frigate Vision brand icons from the approved artwork.",
);
