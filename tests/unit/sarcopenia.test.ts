import { describe, it, expect } from "vitest";
import {
  scoreSarcF,
  assessSarcopenia,
  sarcopeniaLevelLabel,
} from "~/lib/calculations/sarcopenia";
import type { FortnightlyAssessment, Settings } from "~/types/clinical";

function f(overrides: Partial<FortnightlyAssessment> = {}): FortnightlyAssessment {
  return {
    assessment_date: "2026-04-18",
    entered_at: "2026-04-18T12:00:00Z",
    entered_by: "hulin",
    ecog_self: 1,
    created_at: "2026-04-18T12:00:00Z",
    updated_at: "2026-04-18T12:00:00Z",
    ...overrides,
  };
}

const settings: Settings = {
  id: 1,
  profile_name: "Test",
  locale: "en",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("SARC-F scoring", () => {
  it("sums 5 responses", () => {
    expect(scoreSarcF([0, 1, 2, 0, 1])).toBe(4);
  });
  it("rejects wrong length", () => {
    expect(() => scoreSarcF([1, 2, 3])).toThrow();
  });
});

describe("assessSarcopenia", () => {
  it("returns low risk when no data", () => {
    const a = assessSarcopenia(null, null);
    expect(a.level).toBe("low");
    expect(a.signals).toEqual([]);
  });

  it("at-risk when SARC-F ≥ 4", () => {
    const a = assessSarcopenia(f({ sarc_f_total: 5 }), settings);
    expect(a.level).toBe("at-risk");
    expect(a.sarcfPositive).toBe(true);
  });

  it("at-risk when grip below male threshold", () => {
    const a = assessSarcopenia(f({ grip_dominant_kg: 24 }), settings);
    expect(a.level).toBe("at-risk");
    expect(a.lowGrip).toBe(true);
  });

  it("probable when low grip + low calf", () => {
    const a = assessSarcopenia(
      f({ grip_dominant_kg: 22, calf_circumference_cm: 32 }),
      settings,
    );
    expect(a.level).toBe("probable");
  });

  it("confirmed when low strength + low muscle + low performance", () => {
    const a = assessSarcopenia(
      f({
        grip_dominant_kg: 22,
        calf_circumference_cm: 32,
        gait_speed_ms: 0.6,
      }),
      settings,
    );
    expect(a.level).toBe("confirmed");
  });

  it("renders level labels for both locales", () => {
    expect(sarcopeniaLevelLabel("low", "en")).toBe("Low risk");
    expect(sarcopeniaLevelLabel("confirmed", "zh")).toBe("确诊肌少症");
  });

  it("scores from responses array when total missing", () => {
    const a = assessSarcopenia(
      f({ sarc_f_responses: [2, 2, 0, 0, 0] }),
      settings,
    );
    expect(a.sarcfScore).toBe(4);
    expect(a.sarcfPositive).toBe(true);
  });
});
