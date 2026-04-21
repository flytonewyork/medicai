import { describe, it, expect } from "vitest";
import { composeTodayFeed } from "~/lib/nudges/compose";
import type { CurrentWeather } from "~/lib/weather/open-meteo";
import type { PatientTask } from "~/types/task";
import type {
  CycleContext,
  Protocol,
  NudgeTemplate,
} from "~/types/treatment";
import type { ZoneAlert } from "~/types/clinical";

const protocol: Protocol = {
  id: "gnp_weekly",
  name: { en: "GnP weekly", zh: "" },
  short_name: "GnP weekly",
  description: { en: "", zh: "" },
  cycle_length_days: 28,
  agents: [],
  dose_days: [1, 8, 15],
  phase_windows: [
    {
      key: "nadir",
      day_start: 16,
      day_end: 21,
      label: { en: "Nadir", zh: "低谷" },
      description: { en: "", zh: "" },
    },
  ],
  side_effect_profile: { en: "", zh: "" },
  typical_supportive: [],
};

function ctx(day: number, nudges: NudgeTemplate[] = []): CycleContext {
  return {
    cycle: {
      protocol_id: "gnp_weekly",
      cycle_number: 1,
      start_date: "2026-04-01",
      status: "active",
      dose_level: 0,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    },
    protocol,
    cycle_day: day,
    phase: null,
    is_dose_day: protocol.dose_days.includes(day),
    days_until_next_dose: null,
    days_until_nadir: null,
    applicable_nudges: nudges,
  };
}

describe("composeTodayFeed ranking", () => {
  it("zone red alerts sort to the very top", () => {
    const redAlert: ZoneAlert = {
      rule_id: "fever",
      rule_name: "Fever on treatment",
      zone: "red",
      category: "toxicity",
      triggered_at: "2026-04-21T10:00:00Z",
      resolved: false,
      acknowledged: false,
      recommendation: "Hospital now",
      recommendation_zh: "立即就医",
      suggested_levers: [],
      created_at: "2026-04-21T10:00:00Z",
      updated_at: "2026-04-21T10:00:00Z",
    };
    const feed = composeTodayFeed({
      todayISO: "2026-04-21",
      settings: null,
      recentDailies: [],
      recentLabs: [],
      tasks: [],
      activeAlerts: [redAlert],
      cycleContext: null,
      weather: null,
    });
    expect(feed[0]?.category).toBe("safety");
    expect(feed[0]?.priority).toBe(0);
  });

  it("overdue task ranks above cycle-phase nudge", () => {
    const task: PatientTask = {
      id: 1,
      title: "Dental clean",
      category: "dental",
      priority: "normal",
      schedule_kind: "once",
      due_date: "2026-04-14", // 7 days overdue
      lead_time_days: 7,
      surface_dashboard: true,
      surface_daily: false,
      active: true,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    };
    const nudge: NudgeTemplate = {
      id: "sun_protection",
      protocol_ids: ["gnp_weekly"],
      day_range: [1, 28],
      category: "activity",
      severity: "info",
      title: { en: "Slip, slop, slap", zh: "" },
      body: { en: "", zh: "" },
    };
    const feed = composeTodayFeed({
      todayISO: "2026-04-21",
      settings: null,
      recentDailies: [],
      recentLabs: [],
      tasks: [task],
      activeAlerts: [],
      cycleContext: ctx(17, [nudge]),
      weather: null,
    });
    const taskIdx = feed.findIndex((f) => f.category === "task");
    const treatmentIdx = feed.findIndex((f) => f.category === "treatment");
    expect(taskIdx).toBeGreaterThanOrEqual(0);
    expect(treatmentIdx).toBeGreaterThanOrEqual(0);
    expect(taskIdx).toBeLessThan(treatmentIdx);
  });

  it("dedupes by item id", () => {
    const redAlert: ZoneAlert = {
      id: 42,
      rule_id: "fever",
      rule_name: "Fever",
      zone: "red",
      category: "toxicity",
      triggered_at: "2026-04-21T10:00:00Z",
      resolved: false,
      acknowledged: false,
      recommendation: "Hospital",
      recommendation_zh: "",
      suggested_levers: [],
      created_at: "2026-04-21T10:00:00Z",
      updated_at: "2026-04-21T10:00:00Z",
    };
    const feed = composeTodayFeed({
      todayISO: "2026-04-21",
      settings: null,
      recentDailies: [],
      recentLabs: [],
      tasks: [],
      activeAlerts: [redAlert, redAlert],
      cycleContext: null,
      weather: null,
    });
    expect(feed.filter((f) => f.id === "alert_42")).toHaveLength(1);
  });

  it("weather nudge included when weather provided", () => {
    const weather: CurrentWeather = {
      fetched_at: "2026-04-21T10:00:00Z",
      city: "Melbourne",
      latitude: -37.8,
      longitude: 144.9,
      temperature_c: 8,
      apparent_c: 5,
      weather_code: 3,
      is_day: true,
      min_temp_c_24h: 4,
      max_temp_c_24h: 12,
    };
    const feed = composeTodayFeed({
      todayISO: "2026-04-21",
      settings: null,
      recentDailies: [],
      recentLabs: [],
      tasks: [],
      activeAlerts: [],
      cycleContext: null,
      weather,
    });
    expect(feed.some((f) => f.category === "weather")).toBe(true);
  });

  it("always surfaces check-in when today not logged", () => {
    const feed = composeTodayFeed({
      todayISO: "2026-04-21",
      settings: null,
      recentDailies: [],
      recentLabs: [],
      tasks: [],
      activeAlerts: [],
      cycleContext: null,
      weather: null,
    });
    expect(feed.some((f) => f.id === "checkin_today")).toBe(true);
  });
});
