import { describe, it, expect } from "vitest";
import { buildDigest } from "~/lib/cron/digest";

const NOW = new Date("2026-04-23T07:00:00+10:00"); // 07:00 AEST Thu 23 Apr

const baseArgs = {
  patient_name: "Hu Lin",
  locale: "en" as const,
  now: NOW,
};

describe("buildDigest", () => {
  it("returns null when there's nothing worth saying", () => {
    const out = buildDigest({
      ...baseArgs,
      appointments: [],
      zone_alerts: [],
    });
    expect(out).toBeNull();
  });

  it("returns null when zone is green and no appointments/follow-ups", () => {
    const out = buildDigest({
      ...baseArgs,
      appointments: [],
      zone_alerts: [{ zone: "green", resolved: false }],
      follow_ups: [],
    });
    expect(out).toBeNull();
  });

  it("summarises today's appointments", () => {
    const out = buildDigest({
      ...baseArgs,
      appointments: [
        {
          kind: "chemo",
          title: "GnP cycle 3",
          starts_at: "2026-04-23T00:30:00.000Z", // 10:30 AEST
          location: "Epworth DOU",
        },
      ],
      zone_alerts: [],
    });
    expect(out).not.toBeNull();
    expect(out!.title).toContain("Hu Lin");
    expect(out!.body).toMatch(/GnP cycle 3/);
    expect(out!.body).toMatch(/Epworth DOU/);
    expect(out!.url).toBe("/family");
    expect(out!.tag).toMatch(/^digest-\d{4}-\d{2}-\d{2}$/);
  });

  it("caps the shown appointments at 2 and adds '…and N more'", () => {
    const appointments = Array.from({ length: 4 }, (_, i) => ({
      kind: "blood_test",
      title: `Test ${i + 1}`,
      starts_at: `2026-04-23T0${i + 1}:00:00.000Z`,
    }));
    const out = buildDigest({ ...baseArgs, appointments, zone_alerts: [] });
    expect(out!.body).toMatch(/Test 1/);
    expect(out!.body).toMatch(/Test 2/);
    expect(out!.body).toMatch(/…and 2 more/);
  });

  it("surfaces orange/red zone as the headline and routes to /", () => {
    const out = buildDigest({
      ...baseArgs,
      appointments: [],
      zone_alerts: [{ zone: "red", resolved: false }],
    });
    expect(out).not.toBeNull();
    expect(out!.title).toMatch(/Immediate action/);
    expect(out!.url).toBe("/");
  });

  it("skips cancelled and rescheduled appointments", () => {
    const out = buildDigest({
      ...baseArgs,
      appointments: [
        {
          kind: "clinic",
          title: "Skipped",
          starts_at: "2026-04-23T02:00:00.000Z",
          status: "cancelled",
        },
        {
          kind: "clinic",
          title: "Kept",
          starts_at: "2026-04-23T03:00:00.000Z",
        },
      ],
      zone_alerts: [],
    });
    expect(out!.body).not.toMatch(/Skipped/);
    expect(out!.body).toMatch(/Kept/);
  });

  it("includes up to three follow-up tasks in the body", () => {
    const out = buildDigest({
      ...baseArgs,
      appointments: [],
      zone_alerts: [],
      follow_ups: [
        { title: "Check scan results" },
        { title: "Chase blood results" },
        { title: "Log clinic notes" },
        { title: "Should not appear" },
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.body).toMatch(/Check scan results/);
    expect(out!.body).toMatch(/Chase blood results/);
    expect(out!.body).toMatch(/Log clinic notes/);
    expect(out!.body).not.toMatch(/Should not appear/);
  });

  it("respects Simplified Chinese locale", () => {
    const out = buildDigest({
      ...baseArgs,
      locale: "zh",
      appointments: [
        {
          kind: "chemo",
          title: "第三轮化疗",
          starts_at: "2026-04-23T02:00:00.000Z",
        },
      ],
      zone_alerts: [],
    });
    expect(out).not.toBeNull();
    expect(out!.title).toMatch(/今日/);
    expect(out!.body).toMatch(/第三轮化疗/);
  });

  it("only considers events today and tomorrow", () => {
    const out = buildDigest({
      ...baseArgs,
      appointments: [
        {
          kind: "scan",
          title: "Way in the future",
          starts_at: "2026-05-15T02:00:00.000Z",
        },
      ],
      zone_alerts: [],
    });
    expect(out).toBeNull();
  });
});
