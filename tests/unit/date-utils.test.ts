import { describe, it, expect } from "vitest";
import { shiftIsoDate, shiftIsoDays } from "~/lib/utils/date";

describe("shiftIsoDate", () => {
  it("shifts forward and back without flipping calendar days", () => {
    expect(shiftIsoDate("2026-05-04", 1)).toBe("2026-05-05");
    expect(shiftIsoDate("2026-05-04", -1)).toBe("2026-05-03");
    expect(shiftIsoDate("2026-05-04", 0)).toBe("2026-05-04");
  });

  it("handles month and year boundaries", () => {
    expect(shiftIsoDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses leap-day correctly", () => {
    expect(shiftIsoDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftIsoDate("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("is stable across DST spring-forward (Australia, October)", () => {
    // AEST→AEDT happens early October; the noon-UTC anchor must keep
    // the calendar day intact regardless of the runner's local zone.
    expect(shiftIsoDate("2026-10-04", 1)).toBe("2026-10-05");
    expect(shiftIsoDate("2026-10-05", -1)).toBe("2026-10-04");
  });

  it("accepts an ISO datetime and only uses its date portion", () => {
    expect(shiftIsoDate("2026-05-04T23:00:00Z", 1)).toBe("2026-05-05");
    expect(shiftIsoDate("2026-05-04T01:00:00+10:00", -1)).toBe("2026-05-03");
  });
});

describe("shiftIsoDays", () => {
  it("preserves the time-of-day component while shifting UTC days", () => {
    expect(shiftIsoDays("2026-05-04T13:30:00.000Z", 1)).toBe(
      "2026-05-05T13:30:00.000Z",
    );
    expect(shiftIsoDays("2026-05-04T13:30:00.000Z", -7)).toBe(
      "2026-04-27T13:30:00.000Z",
    );
  });
});
