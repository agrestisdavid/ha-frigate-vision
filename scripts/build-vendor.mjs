import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_DIR = join(
  ROOT,
  "custom_components",
  "frigate_vision",
  "frontend",
  "vendor",
);
const EXPECTED_VENDOR_DIR = resolve(
  ROOT,
  "custom_components",
  "frigate_vision",
  "frontend",
  "vendor",
);
const PACKAGES = Object.freeze({
  esbuild: "0.28.2",
  "hls.js": "1.5.17",
  "lit-element": "2.5.1",
  "lit-html": "1.4.1",
});
const GENERATED_BY = "scripts/build-vendor.mjs";
const CHECK_ONLY = process.argv.includes("--check");
const unknownArguments = process.argv.slice(2).filter((value) => value !== "--check");

if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
}

function packagePath(packageName, ...parts) {
  return join(ROOT, "node_modules", ...packageName.split("/"), ...parts);
}

async function assertInstalledVersions() {
  for (const [packageName, expectedVersion] of Object.entries(PACKAGES)) {
    const metadata = JSON.parse(
      await readFile(packagePath(packageName, "package.json"), "utf8"),
    );
    if (metadata.version !== expectedVersion) {
      throw new Error(
        `${packageName} ${metadata.version} is installed; expected ${expectedVersion}. Run npm ci.`,
      );
    }
  }
}

async function sha256(filePath) {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const relativePath = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(directory, entry.name), relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath.split(sep).join("/"));
    }
  }
  return files;
}

async function writeManifest(outputDirectory, files) {
  const hashes = {};
  for (const file of [...files].sort()) {
    hashes[file] = await sha256(join(outputDirectory, file));
  }
  const manifest = {
    schema: 1,
    generated_by: GENERATED_BY,
    packages: PACKAGES,
    sha256: hashes,
  };
  await writeFile(
    join(outputDirectory, "vendor-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function generate(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await assertInstalledVersions();

  await build({
    absWorkingDir: ROOT,
    entryPoints: [packagePath("lit-element", "lit-element.js")],
    outfile: join(outputDirectory, "lit-element-2.5.1.js"),
    bundle: true,
    charset: "utf8",
    format: "esm",
    legalComments: "none",
    logLevel: "silent",
    minify: true,
    platform: "browser",
    sourcemap: false,
    target: ["es2018"],
    banner: {
      js: "/* Vendored LitElement 2.5.1 + lit-html 1.4.1; see adjacent license files. */",
    },
  });

  await build({
    absWorkingDir: ROOT,
    entryPoints: [packagePath("hls.js", "dist", "hls.mjs")],
    outfile: join(outputDirectory, "hls-1.5.17.js"),
    bundle: true,
    charset: "utf8",
    format: "esm",
    legalComments: "none",
    logLevel: "silent",
    minify: true,
    platform: "browser",
    sourcemap: false,
    target: ["es2018"],
    banner: {
      js: "/* Vendored hls.js 1.5.17; see hls.js-LICENSE.txt. */",
    },
  });
  await copyFile(
    packagePath("lit-element", "LICENSE"),
    join(outputDirectory, "lit-element-LICENSE.txt"),
  );
  await copyFile(
    packagePath("lit-html", "LICENSE"),
    join(outputDirectory, "lit-html-LICENSE.txt"),
  );
  await copyFile(
    packagePath("hls.js", "LICENSE"),
    join(outputDirectory, "hls.js-LICENSE.txt"),
  );

  await writeManifest(outputDirectory, [
    "hls.js-LICENSE.txt",
    "hls-1.5.17.js",
    "lit-element-LICENSE.txt",
    "lit-element-2.5.1.js",
    "lit-html-LICENSE.txt",
  ]);
}

async function assertDirectoriesEqual(expectedDirectory, actualDirectory) {
  const expectedFiles = await listFiles(expectedDirectory);
  const actualFiles = await listFiles(actualDirectory);
  if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) {
    throw new Error(
      `Vendored file list is stale. Run npm run build:vendor.\nExpected: ${expectedFiles.join(", ")}\nActual: ${actualFiles.join(", ")}`,
    );
  }
  for (const file of expectedFiles) {
    const expected = await readFile(join(expectedDirectory, file));
    const actual = await readFile(join(actualDirectory, file));
    if (!expected.equals(actual)) {
      throw new Error(
        `Vendored file ${file} is stale. Run npm run build:vendor.`,
      );
    }
  }
}

async function main() {
  if (resolve(VENDOR_DIR) !== EXPECTED_VENDOR_DIR) {
    throw new Error(`Refusing to replace unexpected path: ${VENDOR_DIR}`);
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), "frigate-vision-vendor-"));
  const generatedDirectory = join(temporaryRoot, "vendor");
  try {
    await generate(generatedDirectory);
    if (CHECK_ONLY) {
      await assertDirectoriesEqual(generatedDirectory, VENDOR_DIR);
      console.log(
        `Verified ${relative(ROOT, VENDOR_DIR)} against exact npm dependencies.`,
      );
      return;
    }

    await rm(VENDOR_DIR, { recursive: true, force: true });
    await mkdir(dirname(VENDOR_DIR), { recursive: true });
    await cp(generatedDirectory, VENDOR_DIR, { recursive: true });
    console.log(
      `Generated ${relative(ROOT, VENDOR_DIR)} from exact npm dependencies.`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await main();
