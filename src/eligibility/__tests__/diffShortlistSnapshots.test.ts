import { describe, it, expect } from "vitest";
import { diffShortlistSnapshots } from "../diffShortlistSnapshots";
import type { ShortlistSnapshot, ShortlistSnapshotTrial } from "../types";

const trial = (
  nct_id: string,
  status: string,
  sites: number,
): ShortlistSnapshotTrial => ({
  nct_id,
  overall_status: status,
  last_update_post_date: "2026-05-08",
  au_site_count: sites,
});

describe("diffShortlistSnapshots", () => {
  it("treats every trial as new on the first run (prev = null)", () => {
    const next: ShortlistSnapshot = {
      as_of: "2026-05-08",
      trials: [trial("NCT06625320", "Recruiting", 0)],
    };
    const diff = diffShortlistSnapshots(null, next);
    expect(diff.new_trials).toHaveLength(1);
    expect(diff.closed_trials).toHaveLength(0);
    expect(diff.status_changes).toHaveLength(0);
    expect(diff.unchanged_count).toBe(0);
  });

  it("flags new and closed trials between snapshots", () => {
    const prev: ShortlistSnapshot = {
      as_of: "2026-05-01",
      trials: [trial("NCT06625320", "Recruiting", 0)],
    };
    const next: ShortlistSnapshot = {
      as_of: "2026-05-08",
      trials: [trial("NCT06360354", "Recruiting", 1)],
    };
    const diff = diffShortlistSnapshots(prev, next);
    expect(diff.new_trials.map((t) => t.nct_id)).toEqual(["NCT06360354"]);
    expect(diff.closed_trials.map((t) => t.nct_id)).toEqual(["NCT06625320"]);
  });

  it("flags status changes", () => {
    const prev: ShortlistSnapshot = {
      as_of: "2026-05-01",
      trials: [trial("NCT06625320", "Recruiting", 0)],
    };
    const next: ShortlistSnapshot = {
      as_of: "2026-05-08",
      trials: [trial("NCT06625320", "Active, not recruiting", 0)],
    };
    const diff = diffShortlistSnapshots(prev, next);
    expect(diff.status_changes).toEqual([
      {
        nct_id: "NCT06625320",
        from: "Recruiting",
        to: "Active, not recruiting",
      },
    ]);
    expect(diff.unchanged_count).toBe(0);
  });

  it("flags AU site-count changes", () => {
    const prev: ShortlistSnapshot = {
      as_of: "2026-05-01",
      trials: [trial("NCT06625320", "Recruiting", 0)],
    };
    const next: ShortlistSnapshot = {
      as_of: "2026-05-08",
      trials: [trial("NCT06625320", "Recruiting", 1)],
    };
    const diff = diffShortlistSnapshots(prev, next);
    expect(diff.site_changes).toEqual([
      { nct_id: "NCT06625320", from: 0, to: 1 },
    ]);
  });

  it("counts unchanged trials", () => {
    const t = trial("NCT06625320", "Recruiting", 0);
    const prev: ShortlistSnapshot = { as_of: "2026-05-01", trials: [t] };
    const next: ShortlistSnapshot = { as_of: "2026-05-08", trials: [t] };
    const diff = diffShortlistSnapshots(prev, next);
    expect(diff.unchanged_count).toBe(1);
    expect(diff.status_changes).toHaveLength(0);
    expect(diff.site_changes).toHaveLength(0);
  });
});
