import { describe, expect, it } from "vitest";
import { agentRunsToFeedItems } from "~/lib/nudges/agent-runs";
import type { AgentOutput, AgentRunRow } from "~/types/agent";

function makeRun(
  overrides: Partial<AgentRunRow> & { id?: number },
): AgentRunRow {
  const empty: AgentOutput = {
    daily_report: { en: "Nutrition steady.", zh: "营养稳定。" },
    safety_flags: [],
    filings: [],
    questions: [],
    nudges: [],
    state_diff: "",
  };
  const { output: outputOverride, ...rest } = overrides;
  return {
    id: 1,
    agent_id: "nutrition",
    ran_at: "2026-04-22T08:00:00.000Z",
    trigger: "on_demand",
    referral_ids: [],
    ...rest,
    output: { ...empty, ...(outputOverride ?? {}) },
  };
}

describe("agentRunsToFeedItems", () => {
  it("keeps only the latest run per agent", () => {
    const items = agentRunsToFeedItems([
      makeRun({
        id: 1,
        agent_id: "nutrition",
        ran_at: "2026-04-21T08:00:00.000Z",
        output: { daily_report: { en: "old", zh: "旧" } } as AgentOutput,
      }),
      makeRun({
        id: 2,
        agent_id: "nutrition",
        ran_at: "2026-04-22T08:00:00.000Z",
        output: { daily_report: { en: "new", zh: "新" } } as AgentOutput,
      }),
      makeRun({
        id: 3,
        agent_id: "toxicity",
        ran_at: "2026-04-22T08:00:00.000Z",
        output: { daily_report: { en: "tox", zh: "毒" } } as AgentOutput,
      }),
    ]);
    expect(items).toHaveLength(2);
    const nutrition = items.find((i) => i.source === "agent:nutrition");
    expect(nutrition?.body.en).toBe("new");
  });

  it("priority bumps to safety zone when a red flag fires", () => {
    const items = agentRunsToFeedItems([
      makeRun({
        agent_id: "toxicity",
        output: {
          daily_report: { en: "fever in nadir", zh: "" },
          safety_flags: [
            {
              level: "red",
              title: { en: "Fever", zh: "" },
              detail: { en: "≥38C in nadir", zh: "" },
            },
          ],
        } as AgentOutput,
      }),
    ]);
    expect(items[0]?.priority).toBe(5);
    expect(items[0]?.tone).toBe("warning");
  });

  it("orange + yellow flags map to caution band priority", () => {
    const items = agentRunsToFeedItems([
      makeRun({
        agent_id: "rehabilitation",
        output: {
          daily_report: { en: "grip drift", zh: "" },
          safety_flags: [
            {
              level: "yellow",
              title: { en: "Grip drift", zh: "" },
              detail: { en: "10% down", zh: "" },
            },
          ],
        } as AgentOutput,
      }),
    ]);
    expect(items[0]?.priority).toBe(25);
    expect(items[0]?.tone).toBe("caution");
  });

  it("drops runs whose daily_report is empty in both locales", () => {
    const items = agentRunsToFeedItems([
      makeRun({
        agent_id: "psychology",
        output: { daily_report: { en: "", zh: "" } } as AgentOutput,
      }),
    ]);
    expect(items).toEqual([]);
  });
});
