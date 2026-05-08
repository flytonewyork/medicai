import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { EligibilityCriteria } from "./types";

// Phase 1: parseEligibility reads a hand-curated fixture for an NCT.
// Production path (Phase 2): the trial-monitor subagent invokes the
// pdac-trial-eligibility-parse skill against the ClinicalTrials.gov
// MCP, the operator reviews the JSON, then writes it into the
// fixtures directory. Layer 2's public surface stays the same either
// way.

const DEFAULT_FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__tests__",
  "fixtures",
);

export async function parseEligibility(
  nctId: string,
  options: { fixtureDir?: string } = {},
): Promise<EligibilityCriteria | null> {
  const dir = options.fixtureDir ?? DEFAULT_FIXTURE_DIR;
  const path = join(dir, `${nctId.toLowerCase()}.json`);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as EligibilityCriteria;
}
