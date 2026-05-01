import { describe, it, expect } from "vitest";
import {
  detectAcute,
  acuteExcludedDates,
} from "~/lib/state/analytical";

describe("analytical / detectAcute — fever", () => {
  it("fires fever when temperature ≥ 38°C and not in nadir window", () => {
    const flag = detectAcute({
      metric_id: "body_temperature_c",
      current: { date: "2026-01-03", value: 38.4 },
      cycle_day: 3,
    });
    expect(flag).not.toBeNull();
    expect(flag?.kind).toBe("fever");
    expect(flag?.excluded_from_residual).toBe(true);
    expect(flag?.protocol_action.en).toMatch(/GnP unit/);
  });

  it("upgrades to fn_suspected when fever lands in the nadir window", () => {
    const flag = detectAcute({
      metric_id: "body_temperature_c",
      current: { date: "2026-01-15", value: 38.5 },
      cycle_day: 15,
    });
    expect(flag?.kind).toBe("fn_suspected");
    expect(flag?.protocol_action.en).toMatch(/febrile neutropenia/i);
  });

  it("does not fire below 38°C", () => {
    const flag = detectAcute({
      metric_id: "body_temperature_c",
      current: { date: "2026-01-03", value: 37.8 },
      cycle_day: 3,
    });
    expect(flag).toBeNull();
  });
});

describe("analytical / detectAcute — pain spike", () => {
  it("fires when pain delta ≥ 3 vs prior", () => {
    const flag = detectAcute({
      metric_id: "pain_worst",
      current: { date: "2026-01-05", value: 7 },
      prior: { date: "2026-01-04", value: 3 },
    });
    expect(flag?.kind).toBe("pain_spike");
  });

  it("does not fire on small deltas", () => {
    const flag = detectAcute({
      metric_id: "pain_worst",
      current: { date: "2026-01-05", value: 5 },
      prior: { date: "2026-01-04", value: 4 },
    });
    expect(flag).toBeNull();
  });

  it("does not fire when there is no prior observation", () => {
    const flag = detectAcute({
      metric_id: "pain_worst",
      current: { date: "2026-01-01", value: 8 },
    });
    expect(flag).toBeNull();
  });
});

describe("analytical / detectAcute — flag observations", () => {
  it("fires jaundice when the patient flag is set", () => {
    const flag = detectAcute({
      metric_id: "jaundice_flag",
      current: { date: "2026-01-08", value: 1 },
    });
    expect(flag?.kind).toBe("jaundice");
    expect(flag?.protocol_action.en).toMatch(/yellow|stent/i);
  });

  it("fires dyspnoea when the patient flag is set", () => {
    const flag = detectAcute({
      metric_id: "dyspnoea_flag",
      current: { date: "2026-01-08", value: 1 },
    });
    expect(flag?.kind).toBe("dyspnoea");
  });

  it("fires neuro_emergency when the flag is set", () => {
    const flag = detectAcute({
      metric_id: "neuro_emergency_flag",
      current: { date: "2026-01-08", value: 1 },
    });
    expect(flag?.kind).toBe("neuro_emergency");
  });

  it("does not fire for a flag observation with value 0", () => {
    const flag = detectAcute({
      metric_id: "jaundice_flag",
      current: { date: "2026-01-08", value: 0 },
    });
    expect(flag).toBeNull();
  });
});

describe("analytical / detectAcute — sibling flags", () => {
  it("excludes a numeric metric on a day where a sibling flag is set", () => {
    const flag = detectAcute({
      metric_id: "weight_kg",
      current: { date: "2026-01-08", value: 72 },
      daily_flags: { jaundice_flag: true },
    });
    expect(flag?.kind).toBe("jaundice");
  });

  it("returns null for a numeric metric when no sibling flag is set", () => {
    const flag = detectAcute({
      metric_id: "weight_kg",
      current: { date: "2026-01-08", value: 72 },
      daily_flags: {},
    });
    expect(flag).toBeNull();
  });
});

describe("analytical / acuteExcludedDates", () => {
  it("collects all dates that triggered an acute flag", () => {
    const observations = [
      { date: "2026-01-01", value: 36.8 },
      { date: "2026-01-15", value: 38.5 },  // fever in nadir → fn_suspected
      { date: "2026-01-16", value: 37.2 },
      { date: "2026-01-17", value: 38.1 },  // fever in nadir
    ];
    const excluded = acuteExcludedDates({
      metric_id: "body_temperature_c",
      observations,
      cycle_day_for: (d) => {
        if (d === "2026-01-15") return 15;
        if (d === "2026-01-17") return 17;
        return 1;
      },
    });
    expect(excluded.has("2026-01-15")).toBe(true);
    expect(excluded.has("2026-01-17")).toBe(true);
    expect(excluded.has("2026-01-01")).toBe(false);
  });
});
