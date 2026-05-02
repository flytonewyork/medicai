import type { CoverageGap, EngagementState } from "~/types/coverage";
import type { AgentId } from "~/types/agent";

// Pure formatter: turns the day's coverage state into a small markdown
// block the agents see as a cached system message. Mirrors the design
// brief — agents reason over absence + data together, but only emit
// follow-ups when absence + a recent concerning datum point at a real
// issue (never just because a field wasn't logged).
//
// Stays out of `src/lib/coverage/log-coverage.ts` so the detector can
// stay free of agent-specific concerns; this module is the agent-side
// view of the same data.

export interface AgentSnapshotInputs {
  agentId: AgentId;
  todayISO: string;
  engagement: EngagementState;
  gaps: readonly CoverageGap[];
  // Number of consecutive days the patient has gone without any GI /
  // nutrition / movement signal — informs the "quiet streak" line.
  // Pass 0 when the patient logged today; the formatter renders a
  // softer line in that case.
  quiet_streak_days?: number;
}

// Field-key → which agent voice owns the prompt, mirrored from
// src/config/tracked-fields.ts. Kept here so the formatter doesn't
// import the config module (which is fine in a server context but
// keeps the unit test cheap).
const AGENT_VOICE_FOR_FIELD: Record<string, AgentId> = {
  digestion: "nutrition",
  pert_with_meals: "nutrition",
  weight: "nutrition",
  fluids: "nutrition",
  protein: "nutrition",
  appetite: "nutrition",
  energy: "rehabilitation",
  walking: "rehabilitation",
  resistance_training: "rehabilitation",
  temperature_nadir: "toxicity",
};

export function formatCoverageSnapshot(inputs: AgentSnapshotInputs): string {
  const { agentId, todayISO, engagement, gaps, quiet_streak_days = 0 } = inputs;
  const lines: string[] = [];
  lines.push(`Coverage state for ${todayISO}:`);
  lines.push(`- Engagement: ${engagement}`);

  if (engagement === "rough") {
    lines.push(
      "- The patient is in a rough patch (red zone alert active or severe symptom signal).",
      "- Do NOT emit cadence-style follow-ups. Stay quiet on coverage; surface only what's clinically required.",
    );
    return lines.join("\n");
  }

  if (engagement === "quiet" && quiet_streak_days >= 3) {
    lines.push(
      `- Patient has been quiet for ${quiet_streak_days} days. Don't pile on; if you need anything, ask the single most useful question only.`,
    );
  }

  // Filter gaps to ones this agent's voice owns. Keeps the snapshot
  // proportional to what each specialist can act on; the dietician
  // doesn't see the rehab gaps and vice versa.
  const ownedGaps = gaps.filter(
    (g) => AGENT_VOICE_FOR_FIELD[g.field_key] === agentId,
  );
  if (ownedGaps.length === 0) {
    lines.push("- No outstanding coverage gaps in your discipline today.");
    return lines.join("\n");
  }

  lines.push("- Outstanding coverage gaps in your discipline today:");
  for (const g of ownedGaps) {
    lines.push(`  · ${g.field_key} — ${g.body.en}`);
  }

  lines.push("");
  lines.push("Reasoning rules (read carefully):");
  lines.push(
    "- A gap is ABSENCE of a logged value. Absence alone is NOT a reason to emit a follow-up.",
  );
  lines.push(
    "- Emit a follow-up ONLY when absence intersects a recent concerning datum (e.g. patient said 'nauseous' yesterday + appetite not logged today → ask once, gently). Phrase the question in a way that meets the patient where they are: 'was it a hard day, or just forgotten?'",
  );
  lines.push(
    "- The system already surfaces a coverage card for each gap. Do NOT re-prompt the same field — only add value when you can connect the absence to something else you've seen.",
  );
  lines.push(
    "- Cap yourself at 1 absence-driven follow-up per run. Calm engagement is the rule.",
  );

  return lines.join("\n");
}
