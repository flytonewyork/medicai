import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// scripts/release-notes.mjs is exercised end-to-end via the real Node
// CLI inside a throwaway working directory. We inject merged-PR data
// with --prs-file so the test never has to touch the gh CLI or the
// network. Today is also pinned via --today to keep snapshots stable.

const SCRIPT = resolve(__dirname, "../../scripts/release-notes.mjs");

let fixtureDir = "";

beforeEach(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), "release-notes-"));
});

afterEach(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

function writePRs(prs: unknown[]): string {
  const p = join(fixtureDir, "prs.json");
  writeFileSync(p, JSON.stringify(prs));
  return p;
}

function run(
  args: string[],
): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], {
      encoding: "utf8",
      cwd: fixtureDir,
      env: { ...process.env, GITHUB_OUTPUT: "" },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    const e = err as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      status?: number;
    };
    return {
      stdout:
        typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString() ?? ""),
      stderr:
        typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? ""),
      status: e.status ?? 1,
    };
  }
}

function readChangelog(): string {
  return readFileSync(join(fixtureDir, "CHANGELOG.md"), "utf8");
}

describe("scripts/release-notes.mjs", () => {
  it("creates a fresh CHANGELOG.md and groups by category prefix", () => {
    const prsFile = writePRs([
      {
        number: 5,
        title: "Add coverage engine",
        mergedAt: "2026-04-30T09:00:00Z",
      },
      {
        number: 4,
        title: "fix: meal photo 401",
        mergedAt: "2026-04-28T11:00:00Z",
      },
      {
        number: 3,
        title: "docs: clinical signs literature",
        mergedAt: "2026-04-27T08:00:00Z",
      },
    ]);

    const r = run([
      "--prs-file",
      prsFile,
      "--since",
      "2026-04-25",
      "--today",
      "2026-05-02",
    ]);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("changed=true");
    expect(existsSync(join(fixtureDir, "CHANGELOG.md"))).toBe(true);

    const txt = readChangelog();
    expect(txt).toContain("# Changelog");
    expect(txt).toContain("## 2026-05-02");
    expect(txt).toContain("### Changes");
    expect(txt).toContain("- Add coverage engine (#5)");
    expect(txt).toContain("### Fixes");
    expect(txt).toContain("- fix: meal photo 401 (#4)");
    expect(txt).toContain("### Docs");
    expect(txt).toContain("- docs: clinical signs literature (#3)");
  });

  it("prepends the new entry above existing entries", () => {
    writeFileSync(
      join(fixtureDir, "CHANGELOG.md"),
      "# Changelog\n\nblah\n\n## 2026-04-25\n\n### Changes\n\n- old PR (#1)\n\n",
    );
    const prsFile = writePRs([
      { number: 9, title: "New feature", mergedAt: "2026-05-01T09:00:00Z" },
    ]);

    run([
      "--prs-file",
      prsFile,
      "--since",
      "2026-04-26",
      "--today",
      "2026-05-02",
    ]);

    const txt = readChangelog();
    expect(txt.indexOf("## 2026-05-02")).toBeLessThan(
      txt.indexOf("## 2026-04-25"),
    );
    expect(txt).toContain("- New feature (#9)");
    expect(txt).toContain("- old PR (#1)");
  });

  it("re-running on the same day replaces today's entry rather than stacking", () => {
    const prsFile1 = writePRs([
      { number: 1, title: "First PR", mergedAt: "2026-05-01T01:00:00Z" },
    ]);
    run([
      "--prs-file",
      prsFile1,
      "--since",
      "2026-04-30",
      "--today",
      "2026-05-02",
    ]);

    const prsFile2 = writePRs([
      { number: 1, title: "First PR", mergedAt: "2026-05-01T01:00:00Z" },
      { number: 2, title: "Second PR", mergedAt: "2026-05-02T01:00:00Z" },
    ]);
    run([
      "--prs-file",
      prsFile2,
      "--since",
      "2026-04-30",
      "--today",
      "2026-05-02",
    ]);

    const txt = readChangelog();
    const matches = txt.match(/^## 2026-05-02$/gm) ?? [];
    expect(matches.length).toBe(1);
    expect(txt).toContain("- Second PR (#2)");
    expect(txt).toContain("- First PR (#1)");
  });

  it("emits changed=false and writes nothing when no PRs are passed", () => {
    const prsFile = writePRs([]);
    const r = run([
      "--prs-file",
      prsFile,
      "--since",
      "2026-04-25",
      "--today",
      "2026-05-02",
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("changed=false");
    expect(existsSync(join(fixtureDir, "CHANGELOG.md"))).toBe(false);
  });

  it("filters PRs merged before --since", () => {
    const prsFile = writePRs([
      {
        number: 10,
        title: "Recent change",
        mergedAt: "2026-05-01T09:00:00Z",
      },
      { number: 11, title: "Old change", mergedAt: "2026-04-01T09:00:00Z" },
    ]);
    run([
      "--prs-file",
      prsFile,
      "--since",
      "2026-04-25",
      "--today",
      "2026-05-02",
    ]);

    const txt = readChangelog();
    expect(txt).toContain("- Recent change (#10)");
    expect(txt).not.toContain("Old change");
  });

  it("orders PRs by mergedAt descending within a category", () => {
    const prsFile = writePRs([
      { number: 1, title: "Earliest", mergedAt: "2026-04-26T09:00:00Z" },
      { number: 2, title: "Latest", mergedAt: "2026-04-30T09:00:00Z" },
      { number: 3, title: "Middle", mergedAt: "2026-04-28T09:00:00Z" },
    ]);
    run([
      "--prs-file",
      prsFile,
      "--since",
      "2026-04-25",
      "--today",
      "2026-05-02",
    ]);

    const txt = readChangelog();
    const i1 = txt.indexOf("- Latest (#2)");
    const i2 = txt.indexOf("- Middle (#3)");
    const i3 = txt.indexOf("- Earliest (#1)");
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });
});
