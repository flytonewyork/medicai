import { describe, it, expect } from "vitest";
import { resurfaceFollowUps } from "~/lib/nudges/follow-up-resurface";
import { computeCadencePrompts } from "~/lib/nudges/cadence-prompts";
import {
  AGENT_VOICES,
  MAX_FOLLOW_UPS_PER_DAY,
  MAX_CADENCE_PROMPTS_PER_DAY,
} from "~/config/agent-cadence";
import type { AgentFollowUpRow } from "~/types/agent";
import type { ZoneAlert } from "~/types/clinical";

function fu(
  i: number,
  overrides: Partial<AgentFollowUpRow> = {},
): AgentFollowUpRow {
  return {
    id: i,
    agent_id: "nutrition",
    question_key: `q${i}`,
    asked_at: "2026-04-29T07:00:00.000Z",
    due_at: "2026-05-01T07:00:00.000Z",
    prompt_en: `q${i} prompt`,
    prompt_zh: `q${i} 提示`,
    priority: 40,
    ...overrides,
  };
}

describe("resurfaceFollowUps", () => {
  it("surfaces follow-ups whose due_at <= today", () => {
    const items = resurfaceFollowUps({
      todayISO: "2026-05-01",
      followUps: [fu(1)],
      redZoneActive: false,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("followup_nutrition_q1");
    expect(items[0]?.title.en).toContain(AGENT_VOICES.nutrition.display_name.en);
  });

  it("hides follow-ups not yet due", () => {
    const items = resurfaceFollowUps({
      todayISO: "2026-04-30",
      followUps: [fu(1)],
      redZoneActive: false,
    });
    expect(items).toHaveLength(0);
  });

  it("hides resolved follow-ups", () => {
    const items = resurfaceFollowUps({
      todayISO: "2026-05-01",
      followUps: [
        fu(1, { resolved_at: "2026-04-30T00:00:00Z" }),
      ],
      redZoneActive: false,
    });
    expect(items).toHaveLength(0);
  });

  it("caps at MAX_FOLLOW_UPS_PER_DAY when no red zone", () => {
    const many = Array.from({ length: 10 }, (_, i) => fu(i));
    const items = resurfaceFollowUps({
      todayISO: "2026-05-01",
      followUps: many,
      redZoneActive: false,
    });
    expect(items).toHaveLength(MAX_FOLLOW_UPS_PER_DAY);
  });

  it("caps to 1 when red zone is active", () => {
    const many = Array.from({ length: 5 }, (_, i) => fu(i));
    const items = resurfaceFollowUps({
      todayISO: "2026-05-01",
      followUps: many,
      redZoneActive: true,
    });
    expect(items).toHaveLength(1);
  });

  it("ranks by priority then earliest due", () => {
    const items = resurfaceFollowUps({
      todayISO: "2026-05-01",
      followUps: [
        fu(1, { priority: 50, due_at: "2026-04-30T07:00:00Z" }),
        fu(2, { priority: 30, due_at: "2026-04-29T07:00:00Z" }),
        fu(3, { priority: 30, due_at: "2026-04-28T07:00:00Z" }),
      ],
      redZoneActive: false,
    });
    expect(items.map((i) => i.id)).toEqual([
      "followup_nutrition_q3",
      "followup_nutrition_q2",
      "followup_nutrition_q1",
    ]);
  });

  it("renders the reason in body when present", () => {
    const items = resurfaceFollowUps({
      todayISO: "2026-05-01",
      followUps: [
        fu(1, {
          prompt_en: "How are stools today?",
          prompt_zh: "今日排便如何？",
          reason_en: "loose 3 days running",
          reason_zh: "稀便已 3 天",
        }),
      ],
      redZoneActive: false,
    });
    expect(items[0]?.body.en).toContain("loose 3 days running");
    expect(items[0]?.body.zh).toContain("稀便已 3 天");
  });
});

describe("computeCadencePrompts", () => {
  function redAlert(): ZoneAlert {
    return {
      rule_id: "fever",
      rule_name: "Fever",
      zone: "red",
      category: "toxicity",
      triggered_at: "2026-05-01T07:00:00Z",
      resolved: false,
      acknowledged: false,
      recommendation: "Hospital",
      recommendation_zh: "",
      suggested_levers: [],
      created_at: "2026-05-01T07:00:00Z",
      updated_at: "2026-05-01T07:00:00Z",
    };
  }

  it("emits the dietician prompt on a daily-cadence day", () => {
    // 2026-05-01 = Friday → dietician daily, nurse Mon/Wed/Fri (Fri = true).
    const items = computeCadencePrompts({
      todayISO: "2026-05-01",
      cycleContext: null,
      todayDaily: null,
      activeAlerts: [],
    });
    expect(items.some((i) => i.source === "agent_voice:dietician")).toBe(true);
  });

  it("suppresses everything when a red zone is active", () => {
    const items = computeCadencePrompts({
      todayISO: "2026-05-01",
      cycleContext: null,
      todayDaily: null,
      activeAlerts: [redAlert()],
    });
    expect(items).toHaveLength(0);
  });

  it("caps at MAX_CADENCE_PROMPTS_PER_DAY", () => {
    const items = computeCadencePrompts({
      todayISO: "2026-05-01",
      cycleContext: null,
      todayDaily: null,
      activeAlerts: [],
    });
    expect(items.length).toBeLessThanOrEqual(MAX_CADENCE_PROMPTS_PER_DAY);
  });

  it("skips the dietician when meals + stool already logged today", () => {
    const items = computeCadencePrompts({
      todayISO: "2026-05-01",
      cycleContext: null,
      todayDaily: {
        date: "2026-05-01",
        entered_at: "2026-05-01T07:00:00Z",
        entered_by: "hulin",
        meals_count: 3,
        stool_count: 2,
        stool_bristol: 4,
        created_at: "2026-05-01T07:00:00Z",
        updated_at: "2026-05-01T07:00:00Z",
      },
      activeAlerts: [],
    });
    expect(items.some((i) => i.source === "agent_voice:dietician")).toBe(false);
  });
});
