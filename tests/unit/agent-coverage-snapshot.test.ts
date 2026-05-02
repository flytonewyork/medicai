import { describe, it, expect } from "vitest";
import { formatCoverageSnapshot } from "~/lib/coverage/agent-snapshot";
import type { CoverageGap } from "~/types/coverage";

function gap(field_key: string, body = "(prompt)"): CoverageGap {
  return {
    id: `coverage_${field_key}`,
    field_key,
    priority: 50,
    title: { en: "x", zh: "x" },
    body: { en: body, zh: body },
    why: { en: "(why)", zh: "(why)" },
    cta_href: `/daily/new?step=${field_key}`,
    icon: "salad",
  };
}

describe("formatCoverageSnapshot", () => {
  it("renders the rough-state instruction and stops there", () => {
    const out = formatCoverageSnapshot({
      agentId: "nutrition",
      todayISO: "2026-05-01",
      engagement: "rough",
      gaps: [gap("digestion")],
    });
    expect(out).toMatch(/rough patch/);
    expect(out).toMatch(/Do NOT emit cadence-style follow-ups/);
    // Should not include reasoning rules — the agent is told to stay silent.
    expect(out).not.toMatch(/Reasoning rules/);
  });

  it("includes only gaps in this agent's discipline", () => {
    const out = formatCoverageSnapshot({
      agentId: "nutrition",
      todayISO: "2026-05-01",
      engagement: "active",
      gaps: [
        gap("digestion", "stool prompt"),
        gap("walking", "walking prompt"),  // rehabilitation — should be filtered out
        gap("temperature_nadir", "temp prompt"), // toxicity — should be filtered out
      ],
    });
    expect(out).toMatch(/digestion/);
    expect(out).not.toMatch(/walking prompt/);
    expect(out).not.toMatch(/temp prompt/);
  });

  it("scopes the toxicity snapshot to nurse-owned fields", () => {
    const out = formatCoverageSnapshot({
      agentId: "toxicity",
      todayISO: "2026-05-01",
      engagement: "active",
      gaps: [
        gap("digestion", "should not appear"),
        gap("temperature_nadir", "temperature here"),
      ],
    });
    expect(out).toMatch(/temperature_nadir/);
    expect(out).not.toMatch(/should not appear/);
  });

  it("renders 'no outstanding gaps' when nothing in this discipline matches", () => {
    const out = formatCoverageSnapshot({
      agentId: "nutrition",
      todayISO: "2026-05-01",
      engagement: "active",
      gaps: [gap("walking")],
    });
    expect(out).toMatch(/No outstanding coverage gaps/);
  });

  it("includes the absence+data reasoning rules and the 1-per-run cap", () => {
    const out = formatCoverageSnapshot({
      agentId: "nutrition",
      todayISO: "2026-05-01",
      engagement: "active",
      gaps: [gap("digestion")],
    });
    expect(out).toMatch(/Absence alone is NOT a reason/);
    expect(out).toMatch(/Cap yourself at 1 absence-driven follow-up per run/);
    expect(out).toMatch(/Do NOT re-prompt the same field/);
  });

  it("adds a quiet-streak hint when the patient has been silent for 3+ days", () => {
    const out = formatCoverageSnapshot({
      agentId: "nutrition",
      todayISO: "2026-05-01",
      engagement: "quiet",
      gaps: [gap("digestion")],
      quiet_streak_days: 5,
    });
    expect(out).toMatch(/quiet for 5 days/);
    expect(out).toMatch(/single most useful question only/);
  });

  it("does not add the quiet-streak hint when below threshold", () => {
    const out = formatCoverageSnapshot({
      agentId: "nutrition",
      todayISO: "2026-05-01",
      engagement: "quiet",
      gaps: [gap("digestion")],
      quiet_streak_days: 1,
    });
    expect(out).not.toMatch(/quiet for/);
  });
});
