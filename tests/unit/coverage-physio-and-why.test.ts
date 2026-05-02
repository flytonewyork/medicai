import { describe, it, expect } from "vitest";
import { computeCoverageGaps } from "~/lib/coverage/log-coverage";
import { formatCoverageSnapshot } from "~/lib/coverage/agent-snapshot";
import type { DailyEntry, Settings } from "~/types/clinical";

function entry(date: string, overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date,
    entered_at: `${date}T07:00:00Z`,
    entered_by: "hulin",
    created_at: `${date}T07:00:00Z`,
    updated_at: `${date}T07:00:00Z`,
    ...overrides,
  };
}

function settings(over: Partial<Settings> = {}): Settings {
  return {
    profile_name: "x",
    locale: "en",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...over,
  };
}

describe("AI Physio coverage support", () => {
  it("does not surface resistance_training without prior history", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      // Active engagement (logged something today) but resistance_training
      // never filled before — should stay invisible.
      recentDailies: [entry("2026-05-01", { energy: 5 })],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    expect(
      r.gaps.some((g) => g.field_key === "resistance_training"),
    ).toBe(false);
  });

  it("surfaces resistance_training once a single prior log exists", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      recentDailies: [
        entry("2026-05-01", { energy: 5 }),
        // Two weeks ago, the patient logged resistance training once.
        entry("2026-04-17", { resistance_training: true }),
      ],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    const rt = r.gaps.find((g) => g.field_key === "resistance_training");
    expect(rt).toBeDefined();
    expect(rt?.cta_href).toBe("/daily/new?step=movement");
  });

  it("includes the why text on every emitted gap", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      recentDailies: [entry("2026-05-01", { energy: 5 })],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    expect(r.gaps.length).toBeGreaterThan(0);
    for (const g of r.gaps) {
      expect(typeof g.why.en).toBe("string");
      expect(g.why.en.length).toBeGreaterThan(0);
      expect(typeof g.why.zh).toBe("string");
      expect(g.why.zh.length).toBeGreaterThan(0);
    }
  });

  it("routes a resistance_training gap into the rehabilitation snapshot", () => {
    const out = formatCoverageSnapshot({
      agentId: "rehabilitation",
      todayISO: "2026-05-01",
      engagement: "active",
      gaps: [
        {
          id: "coverage_resistance_training",
          field_key: "resistance_training",
          priority: 50,
          title: { en: "AI Physio", zh: "AI 物理治疗师" },
          body: { en: "Any resistance work today?", zh: "今天有阻力训练吗？" },
          why: { en: "Sarcopenia prevention", zh: "预防肌少症" },
          cta_href: "/daily/new?step=movement",
          icon: "walk",
        },
      ],
    });
    expect(out).toMatch(/resistance_training/);
  });

  it("does NOT include a resistance_training gap in the dietician snapshot", () => {
    const out = formatCoverageSnapshot({
      agentId: "nutrition",
      todayISO: "2026-05-01",
      engagement: "active",
      gaps: [
        {
          id: "coverage_resistance_training",
          field_key: "resistance_training",
          priority: 50,
          title: { en: "AI Physio", zh: "AI 物理治疗师" },
          body: { en: "Any resistance work today?", zh: "今天有阻力训练吗？" },
          why: { en: "Sarcopenia prevention", zh: "预防肌少症" },
          cta_href: "/daily/new?step=movement",
          icon: "walk",
        },
      ],
    });
    expect(out).not.toMatch(/resistance_training/);
  });
});
