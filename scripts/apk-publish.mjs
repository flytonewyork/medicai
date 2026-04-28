#!/usr/bin/env node
// Register a freshly built APK in public/apk/manifest.json so the /apk
// landing page picks it up on the next deploy. Bubblewrap drops the
// signed file at android/app/build/outputs/apk/release/app-release-signed.apk
// — pass that path here.
//
// Usage:
//   node scripts/apk-publish.mjs \
//     --apk android/app/build/outputs/apk/release/app-release-signed.apk \
//     --version 1.0.0 \
//     [--notes-en "..."] [--notes-zh "..."] \
//     [--released-at 2026-04-28T03:00:00Z]
//
// The script is intentionally synchronous and idempotent at the version
// level: re-running with the same --version overwrites the prior entry
// (and the prior on-disk file). Different versions accumulate.

import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const APK_DIR = join(REPO_ROOT, "public", "apk");
const MANIFEST = join(APK_DIR, "manifest.json");

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/;

function die(msg) {
  console.error(`apk-publish: ${msg}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    apk: { type: "string" },
    version: { type: "string" },
    "notes-en": { type: "string" },
    "notes-zh": { type: "string" },
    "released-at": { type: "string" },
  },
  strict: true,
});

if (!values.apk) die("missing required --apk <path>");
if (!values.version) die("missing required --version <semver>");
if (!SEMVER_RE.test(values.version)) {
  die(`--version "${values.version}" is not semver (e.g. 1.0.0 or 1.0.0-rc.1)`);
}

const apkPath = resolve(values.apk);
if (!existsSync(apkPath)) die(`APK not found at ${apkPath}`);
if (!apkPath.endsWith(".apk")) die(`expected a .apk file, got ${apkPath}`);

const releasedAt = values["released-at"] ?? new Date().toISOString();
if (Number.isNaN(Date.parse(releasedAt))) {
  die(`--released-at "${releasedAt}" is not a valid date`);
}

const filename = `anchor-${values.version}.apk`;
const destPath = join(APK_DIR, filename);

mkdirSync(APK_DIR, { recursive: true });
copyFileSync(apkPath, destPath);

const buf = readFileSync(destPath);
const sha256 = createHash("sha256").update(buf).digest("hex");
const sizeBytes = statSync(destPath).size;

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const releases = Array.isArray(manifest.releases) ? manifest.releases : [];
const filtered = releases.filter((r) => r.version !== values.version);

const entry = {
  version: values.version,
  filename,
  size_bytes: sizeBytes,
  sha256,
  released_at: releasedAt,
};
if (values["notes-en"]) entry.notes_en = values["notes-en"];
if (values["notes-zh"]) entry.notes_zh = values["notes-zh"];

const next = {
  latest: values.version,
  releases: [entry, ...filtered].sort((a, b) =>
    b.released_at.localeCompare(a.released_at),
  ),
};

writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);

console.log(`apk-publish: registered ${filename}`);
console.log(`             size   ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`             sha256 ${sha256}`);
console.log(`             latest = ${values.version}`);
