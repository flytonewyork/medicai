import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// scripts/apk-publish.mjs hard-codes the manifest path relative to the
// script file (REPO_ROOT/public/apk/manifest.json). To test it in
// isolation we copy the script into a throwaway repo-shaped fixture
// and exercise it via the real Node CLI — same surface the GitHub
// Actions workflow hits.

const SCRIPT_SRC = resolve(__dirname, "../../scripts/apk-publish.mjs");

function runFixture(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync("node", [SCRIPT_SRC, ...args], {
      encoding: "utf8",
      cwd: fixtureDir,
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString() ?? ""),
      stderr: typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? ""),
      status: e.status ?? 1,
    };
  }
}

let fixtureDir = "";
let scriptCopy = "";

beforeEach(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), "apk-publish-"));
  // Recreate the layout the script expects: scripts/ + public/apk/.
  mkdirSync(join(fixtureDir, "scripts"), { recursive: true });
  mkdirSync(join(fixtureDir, "public", "apk"), { recursive: true });
  scriptCopy = join(fixtureDir, "scripts", "apk-publish.mjs");
  writeFileSync(scriptCopy, readFileSync(SCRIPT_SRC, "utf8"));
  writeFileSync(
    join(fixtureDir, "public", "apk", "manifest.json"),
    JSON.stringify({ latest: null, releases: [] }) + "\n",
  );
});

afterEach(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

function makeApk(name: string, contents: string): string {
  const apkPath = join(fixtureDir, name);
  writeFileSync(apkPath, contents);
  return apkPath;
}

function readManifest() {
  return JSON.parse(
    readFileSync(join(fixtureDir, "public", "apk", "manifest.json"), "utf8"),
  );
}

describe("scripts/apk-publish.mjs", () => {
  it("registers a fresh release and sets it as latest", () => {
    const apk = makeApk("input.apk", "fake apk bytes");
    const result = execFileSync(
      "node",
      [
        scriptCopy,
        "--apk", apk,
        "--version", "1.0.0",
        "--released-at", "2026-04-28T00:00:00Z",
        "--notes-en", "First release.",
        "--notes-zh", "首次发布。",
      ],
      { encoding: "utf8" },
    );
    expect(result).toContain("registered anchor-1.0.0.apk");

    const manifest = readManifest();
    expect(manifest.latest).toBe("1.0.0");
    expect(manifest.releases).toHaveLength(1);
    const [release] = manifest.releases;
    expect(release.version).toBe("1.0.0");
    expect(release.filename).toBe("anchor-1.0.0.apk");
    expect(release.size_bytes).toBe(Buffer.byteLength("fake apk bytes"));
    // SHA-256 of "fake apk bytes" — sanity-check the hash isn't being faked.
    expect(release.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(release.notes_en).toBe("First release.");
    expect(release.notes_zh).toBe("首次发布。");
    expect(release.released_at).toBe("2026-04-28T00:00:00Z");

    expect(
      existsSync(join(fixtureDir, "public", "apk", "anchor-1.0.0.apk")),
    ).toBe(true);
  });

  it("appends new releases without dropping older ones", () => {
    const apk1 = makeApk("v1.apk", "v1 bytes");
    execFileSync("node", [
      scriptCopy,
      "--apk", apk1,
      "--version", "1.0.0",
      "--released-at", "2026-04-28T00:00:00Z",
    ]);

    const apk2 = makeApk("v2.apk", "v2 bytes");
    execFileSync("node", [
      scriptCopy,
      "--apk", apk2,
      "--version", "1.0.1",
      "--released-at", "2026-05-10T00:00:00Z",
    ]);

    const manifest = readManifest();
    expect(manifest.latest).toBe("1.0.1");
    expect(manifest.releases.map((r: { version: string }) => r.version)).toEqual([
      "1.0.1",
      "1.0.0",
    ]);
  });

  it("re-publishing the same version overwrites the prior entry", () => {
    const apk1 = makeApk("v1.apk", "first build");
    execFileSync("node", [
      scriptCopy,
      "--apk", apk1,
      "--version", "1.0.0",
      "--notes-en", "first",
    ]);

    const apk2 = makeApk("v1-rebuild.apk", "rebuild bytes — different");
    execFileSync("node", [
      scriptCopy,
      "--apk", apk2,
      "--version", "1.0.0",
      "--notes-en", "rebuild",
    ]);

    const manifest = readManifest();
    expect(manifest.releases).toHaveLength(1);
    expect(manifest.releases[0].notes_en).toBe("rebuild");
    expect(manifest.releases[0].size_bytes).toBe(
      Buffer.byteLength("rebuild bytes — different"),
    );
  });

  it("rejects a non-semver version", () => {
    const apk = makeApk("input.apk", "x");
    const result = runFixture(["--apk", apk, "--version", "not-semver"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("not semver");
  });

  it("rejects a missing APK path", () => {
    const result = runFixture(["--apk", "/nonexistent.apk", "--version", "1.0.0"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("APK not found");
  });

  it("rejects a non-.apk file extension", () => {
    const wrong = join(fixtureDir, "input.zip");
    writeFileSync(wrong, "x");
    const result = runFixture(["--apk", wrong, "--version", "1.0.0"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("expected a .apk file");
  });
});
