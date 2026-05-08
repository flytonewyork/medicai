#!/usr/bin/env tsx
//
// Anchor — Phase 1 eval runner.
//
// Reads .claude/evals/cases/*.yaml, executes each against
// src/eligibility/, writes a single result file under eval-runs/.
// Honest pass/fail recording — Phase 1 success bar is "every case
// runs", not "every case passes".
//
// Run: pnpm evals:run

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import {
  diffShortlistSnapshots,
  getCurrentBridgeStatus,
  loadShortlist,
  parseEligibility,
} from "../../src/eligibility/index.js";
import type {
  BridgeInputs,
  EligibilityCriteria,
  Shortlist,
  ShortlistSnapshot,
} from "../../src/eligibility/types.js";

interface CaseFile {
  id: string;
  description?: string;
  kind:
    | "bridge_status"
    | "bridge_status_with_inline_criteria"
    | "shortlist_diff";
  inputs: Record<string, unknown>;
  expect: Record<string, unknown>;
}

interface CaseResult {
  id: string;
  status: "pass" | "fail" | "error";
  notes: string[];
}

const REPO_ROOT = process.cwd();
const CASES_DIR = join(REPO_ROOT, ".claude/evals/cases");
const FIXTURES_DIR = join(REPO_ROOT, ".claude/evals/fixtures");
const RESULTS_DIR = join(REPO_ROOT, "eval-runs");

async function loadCase(path: string): Promise<CaseFile> {
  const raw = await readFile(path, "utf-8");
  return parseYaml(raw) as CaseFile;
}

async function loadFixtureJson<T>(name: string): Promise<T> {
  const raw = await readFile(join(FIXTURES_DIR, `${name}.json`), "utf-8");
  return JSON.parse(raw) as T;
}

async function runBridgeStatusCase(c: CaseFile): Promise<CaseResult> {
  const notes: string[] = [];
  const bridgeInputs = (c.inputs.bridge_inputs as BridgeInputs) ?? null;
  if (!bridgeInputs) {
    return {
      id: c.id,
      status: "error",
      notes: ["bridge_inputs missing from case inputs"],
    };
  }
  const shortlistPath = (c.inputs.shortlist_path as string) ?? null;
  const shortlist = shortlistPath
    ? await loadShortlist(join(REPO_ROOT, shortlistPath))
    : ((c.inputs.inline_shortlist as Shortlist) ?? []);

  const result = getCurrentBridgeStatus({ inputs: bridgeInputs, shortlist });

  const e = c.expect;

  if (typeof e.unverified_count === "number" && result.unverified_count !== e.unverified_count) {
    notes.push(
      `expected unverified_count=${e.unverified_count}, got ${result.unverified_count}`,
    );
  }
  if (typeof e.any_eligible_now === "boolean" && result.any_eligible_now !== e.any_eligible_now) {
    notes.push(
      `expected any_eligible_now=${e.any_eligible_now}, got ${result.any_eligible_now}`,
    );
  }
  if (typeof e.any_eligible_if_stable === "boolean" && result.any_eligible_if_stable !== e.any_eligible_if_stable) {
    notes.push(
      `expected any_eligible_if_stable=${e.any_eligible_if_stable}, got ${result.any_eligible_if_stable}`,
    );
  }
  if (typeof e.every_verdict_kind_is === "string") {
    const target = e.every_verdict_kind_is;
    const off = result.trials.filter((t) => t.verdict.kind !== target);
    if (off.length > 0) {
      notes.push(
        `expected every verdict kind to be "${target}"; ${off.length} trials differ (${off.map((o) => `${o.nct_id}=${o.verdict.kind}`).join(", ")})`,
      );
    }
  }

  return {
    id: c.id,
    status: notes.length === 0 ? "pass" : "fail",
    notes,
  };
}

async function runBridgeStatusInlineCase(c: CaseFile): Promise<CaseResult> {
  const notes: string[] = [];
  const bridgeInputs = c.inputs.bridge_inputs as BridgeInputs;
  const shortlist = (c.inputs.inline_shortlist as Shortlist) ?? [];

  // Load the inline criteria fixture(s) — these are stored as plain
  // JSON files in src/eligibility/__tests__/fixtures/, NOT under
  // .claude/evals/fixtures/. The eval runner reuses the source-of-
  // truth fixtures rather than duplicating them.
  const fixtureNames: string[] = c.inputs.inline_criteria_fixtures
    ? (c.inputs.inline_criteria_fixtures as string[])
    : c.inputs.inline_criteria_fixture
      ? [c.inputs.inline_criteria_fixture as string]
      : [];

  const parsedByNct = new Map<string, EligibilityCriteria>();
  for (const name of fixtureNames) {
    const path = join(REPO_ROOT, "src/eligibility/__tests__/fixtures", `${name}.json`);
    const criteria = JSON.parse(
      await readFile(path, "utf-8"),
    ) as EligibilityCriteria;
    // Force verified:true within the eval scope so the engine actually
    // exercises evaluateVerdict. The shortlist file's verified flag
    // remains false in the repo.
    criteria.verified = true;
    parsedByNct.set(criteria.nct_id, criteria);
  }

  const result = getCurrentBridgeStatus({
    inputs: bridgeInputs,
    shortlist,
    parsedByNct,
  });

  const e = c.expect;

  if (typeof e.trial_count === "number" && result.trials.length !== e.trial_count) {
    notes.push(`expected trial_count=${e.trial_count}, got ${result.trials.length}`);
  }
  if (typeof e.trial_0_verdict_kind === "string" && result.trials[0]?.verdict.kind !== e.trial_0_verdict_kind) {
    notes.push(
      `expected trial_0_verdict_kind=${e.trial_0_verdict_kind}, got ${result.trials[0]?.verdict.kind ?? "<no trial>"}`,
    );
  }
  if (typeof e.trial_0_verified === "boolean" && result.trials[0]?.verified !== e.trial_0_verified) {
    notes.push(
      `expected trial_0_verified=${e.trial_0_verified}, got ${result.trials[0]?.verified ?? "<no trial>"}`,
    );
  }
  if (typeof e.any_eligible_now === "boolean" && result.any_eligible_now !== e.any_eligible_now) {
    notes.push(
      `expected any_eligible_now=${e.any_eligible_now}, got ${result.any_eligible_now}`,
    );
  }
  if (e.trial_verdicts && typeof e.trial_verdicts === "object") {
    const expected = e.trial_verdicts as Record<string, string>;
    for (const [nct, expectedKind] of Object.entries(expected)) {
      const trial = result.trials.find((t) => t.nct_id === nct);
      if (!trial) {
        notes.push(`expected verdict for ${nct} but trial missing from result`);
        continue;
      }
      if (trial.verdict.kind !== expectedKind) {
        notes.push(
          `expected ${nct} verdict=${expectedKind}, got ${trial.verdict.kind}`,
        );
      }
    }
  }

  return {
    id: c.id,
    status: notes.length === 0 ? "pass" : "fail",
    notes,
  };
}

async function runShortlistDiffCase(c: CaseFile): Promise<CaseResult> {
  const notes: string[] = [];
  const prevName = c.inputs.prev_fixture as string;
  const nextName = c.inputs.next_fixture as string;
  const prev = await loadFixtureJson<ShortlistSnapshot>(prevName);
  const next = await loadFixtureJson<ShortlistSnapshot>(nextName);
  const diff = diffShortlistSnapshots(prev, next);

  const e = c.expect;

  if (Array.isArray(e.new_trial_nct_ids)) {
    const expected = (e.new_trial_nct_ids as string[]).slice().sort();
    const actual = diff.new_trials.map((t) => t.nct_id).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      notes.push(
        `expected new_trial_nct_ids=${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  }
  if (typeof e.closed_trial_count === "number" && diff.closed_trials.length !== e.closed_trial_count) {
    notes.push(
      `expected closed_trial_count=${e.closed_trial_count}, got ${diff.closed_trials.length}`,
    );
  }
  if (typeof e.status_change_count === "number" && diff.status_changes.length !== e.status_change_count) {
    notes.push(
      `expected status_change_count=${e.status_change_count}, got ${diff.status_changes.length}`,
    );
  }
  if (Array.isArray(e.status_changes)) {
    const expected = e.status_changes as Array<{ nct_id: string; from: string; to: string }>;
    for (const exp of expected) {
      const found = diff.status_changes.find(
        (s) => s.nct_id === exp.nct_id && s.from === exp.from && s.to === exp.to,
      );
      if (!found) {
        notes.push(
          `expected status_change ${JSON.stringify(exp)} not found in ${JSON.stringify(diff.status_changes)}`,
        );
      }
    }
  }

  return {
    id: c.id,
    status: notes.length === 0 ? "pass" : "fail",
    notes,
  };
}

async function runCase(c: CaseFile): Promise<CaseResult> {
  try {
    if (c.kind === "bridge_status") return await runBridgeStatusCase(c);
    if (c.kind === "bridge_status_with_inline_criteria")
      return await runBridgeStatusInlineCase(c);
    if (c.kind === "shortlist_diff") return await runShortlistDiffCase(c);
    return {
      id: c.id,
      status: "error",
      notes: [`unknown case kind: ${c.kind}`],
    };
  } catch (err) {
    return {
      id: c.id,
      status: "error",
      notes: [String(err)],
    };
  }
}

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const files = (await readdir(CASES_DIR))
    .filter((f) => f.endsWith(".yaml"))
    .sort();

  const results: CaseResult[] = [];
  for (const f of files) {
    const c = await loadCase(join(CASES_DIR, f));
    const r = await runCase(c);
    results.push(r);
    const symbol = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "!";
    console.log(`${symbol} ${r.id} — ${r.status}`);
    for (const n of r.notes) console.log(`    ${n}`);
  }

  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const err = results.filter((r) => r.status === "error").length;
  const summary = `${pass}/${results.length} pass, ${fail} fail, ${err} error`;
  console.log(`\nsummary: ${summary}`);

  await mkdir(RESULTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(RESULTS_DIR, `${ts}.json`);
  await writeFile(
    outPath,
    JSON.stringify(
      {
        as_of: new Date().toISOString(),
        git_sha: gitSha(),
        summary: { pass, fail, error: err, total: results.length },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`wrote ${outPath}`);

  // Phase 1 success bar = every case ran. Errors are blockers (bug
  // in runner / cases). Failures are acceptable and recorded honestly.
  if (err > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
