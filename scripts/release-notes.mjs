#!/usr/bin/env node
// Generate the maintainer-facing weekly changelog.
//
// Reads merged PRs from GitHub since the last entry in CHANGELOG.md
// (advanced one day so we don't re-list PRs already captured), groups
// them by category inferred from a `feat:` / `fix:` / `docs:` style
// prefix, and prepends a dated section. Designed to run from
// .github/workflows/release-notes.yml on a Sunday-night cron, but also
// runnable locally:
//
//   gh auth login
//   node scripts/release-notes.mjs
//
// This file is maintainer surface only — it does not feed into the
// patient or carer single-channel feed. Patient UX tone (see
// docs/UX_PRINCIPLES.md) is incompatible with cheerful product-launch
// language; release notes belong in a separate channel.
//
// Test injection: pass --prs-file <path> with a JSON array shaped like
// `gh pr list --json number,title,mergedAt`. That bypasses the gh CLI
// so vitest can run against fixtures without network or auth.
//
// Idempotent on the same calendar day: re-running replaces today's
// section instead of stacking duplicates. Exits 0 always; signals "no
// work to do" by writing changed=false to $GITHUB_OUTPUT (and stdout).

import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CHANGELOG = "CHANGELOG.md";
const DEFAULT_LOOKBACK_DAYS = 7;

const HEADER =
  "# Changelog\n\n" +
  "Auto-generated weekly summary of merged PRs, produced by\n" +
  "`scripts/release-notes.mjs` on a Sunday-night cron. Maintainer-facing —\n" +
  "patient and carer surfaces are intentionally untouched.\n\n";

const CATEGORY_ORDER = [
  "Changes",
  "Fixes",
  "Refactor",
  "Tests",
  "Docs",
  "Chore",
];

function categorise(title) {
  const t = title.toLowerCase();
  if (/^docs?:/.test(t)) return "Docs";
  if (/^fix:/.test(t)) return "Fixes";
  if (/^chore:/.test(t)) return "Chore";
  if (/^test:/.test(t)) return "Tests";
  if (/^refactor:/.test(t)) return "Refactor";
  return "Changes";
}

function lastEntryDate(path) {
  if (!existsSync(path)) return null;
  const txt = readFileSync(path, "utf8");
  const m = txt.match(/^## (\d{4}-\d{2}-\d{2})/m);
  return m ? m[1] : null;
}

function defaultSince(path, today) {
  const last = lastEntryDate(path);
  if (!last) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - DEFAULT_LOOKBACK_DAYS);
    return d.toISOString().slice(0, 10);
  }
  // Advance one day so we don't re-list PRs already captured in the
  // previous entry. GitHub's `merged:>=` is inclusive of the boundary.
  const d = new Date(`${last}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fetchPRsFromGh(since) {
  const args = [
    "pr",
    "list",
    "--state",
    "merged",
    "--base",
    "main",
    "--limit",
    "200",
    "--search",
    `merged:>=${since}`,
    "--json",
    "number,title,mergedAt,url",
  ];
  const stdout = execFileSync("gh", args, { encoding: "utf8" });
  return JSON.parse(stdout);
}

function loadPRs(opts) {
  if (opts["prs-file"]) {
    return JSON.parse(readFileSync(opts["prs-file"], "utf8"));
  }
  return fetchPRsFromGh(opts.since);
}

export function buildEntry(prs, today) {
  if (!prs || prs.length === 0) return null;
  const sorted = [...prs].sort((a, b) => {
    if (a.mergedAt !== b.mergedAt) return a.mergedAt < b.mergedAt ? 1 : -1;
    return b.number - a.number;
  });
  const groups = new Map();
  for (const pr of sorted) {
    const cat = categorise(pr.title);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(pr);
  }
  const lines = [`## ${today}`, ""];
  const seen = new Set();
  for (const cat of CATEGORY_ORDER) {
    const items = groups.get(cat);
    if (!items) continue;
    seen.add(cat);
    lines.push(`### ${cat}`, "");
    for (const pr of items) {
      lines.push(`- ${pr.title} (#${pr.number})`);
    }
    lines.push("");
  }
  // Defensive: any category not in CATEGORY_ORDER (none today, but
  // future-proofs the function if a new bucket is added).
  for (const [cat, items] of groups) {
    if (seen.has(cat)) continue;
    lines.push(`### ${cat}`, "");
    for (const pr of items) {
      lines.push(`- ${pr.title} (#${pr.number})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function removeEntryFor(existing, today) {
  const re = new RegExp(`^## ${today}\\b`, "m");
  const m = existing.match(re);
  if (!m) return existing;
  const start = m.index ?? 0;
  const after = existing.slice(start + 1);
  const nextRel = after.search(/^## \d{4}-\d{2}-\d{2}/m);
  const end = nextRel === -1 ? existing.length : start + 1 + nextRel;
  return existing.slice(0, start) + existing.slice(end);
}

export function applyEntry(existing, entry, today) {
  if (!existing) return HEADER + entry + "\n";
  const stripped = removeEntryFor(existing, today);
  const firstEntry = stripped.search(/^## \d{4}-\d{2}-\d{2}/m);
  if (firstEntry === -1) {
    return stripped.replace(/\n*$/, "\n\n") + entry + "\n";
  }
  return (
    stripped.slice(0, firstEntry) + entry + "\n" + stripped.slice(firstEntry)
  );
}

function setOutput(name, value) {
  const line = `${name}=${value}`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, line + "\n");
  }
  console.log(line);
}

function parseCli() {
  const { values } = parseArgs({
    options: {
      out: { type: "string", default: DEFAULT_CHANGELOG },
      since: { type: "string" },
      "prs-file": { type: "string" },
      today: { type: "string" },
    },
  });
  return values;
}

function main() {
  const opts = parseCli();
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const path = resolve(process.cwd(), opts.out);
  const since = opts.since ?? defaultSince(path, today);

  const prs = loadPRs({ ...opts, since }).filter(
    (pr) => pr.mergedAt && pr.mergedAt.slice(0, 10) >= since,
  );

  const entry = buildEntry(prs, today);
  if (!entry) {
    console.error(`release-notes: no merged PRs since ${since}`);
    setOutput("changed", "false");
    return;
  }

  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const next = applyEntry(existing, entry, today);
  if (next === existing) {
    console.error("release-notes: no diff after rewrite");
    setOutput("changed", "false");
    return;
  }
  writeFileSync(path, next);
  console.error(`release-notes: wrote ${prs.length} PR(s) to ${opts.out}`);
  setOutput("changed", "true");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
