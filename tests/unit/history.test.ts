import { describe, it, expect } from "vitest";
import { aggregateHistory, groupByDate } from "~/lib/state/history";
import type {
  CareTeamContact,
  ChangeSignalRow,
  DailyEntry,
  LabResult,
  SignalEventRow,
} from "~/types/clinical";
import type { TreatmentCycle } from "~/types/treatment";

function signal(
  over: Partial<ChangeSignalRow> = {},
): ChangeSignalRow {
  return {
    id: 1,
    detector: "steps_decline",
    fired_for: "steps_decline:2026-W15",
    metric_id: "steps",
    axis: "individual",
    severity: "caution",
    shape: "rolling_drift",
    status: "open",
    payload_json: "{}",
    detected_at: "2026-04-10T08:00:00Z",
    ...over,
  };
}

function signalEvent(
  over: Partial<SignalEventRow> = {},
): SignalEventRow {
  return {
    signal_id: 1,
    kind: "emitted",
    created_at: "2026-04-10T08:00:00Z",
    ...over,
  };
}

function careContact(
  date: string,
  over: Partial<CareTeamContact> = {},
): CareTeamContact {
  return {
    date,
    kind: "clinic_visit",
    created_at: `${date}T09:00:00Z`,
    updated_at: `${date}T09:00:00Z`,
    ...over,
    id: over.id ?? 10,
  };
}

function daily(date: string, over: Partial<DailyEntry> = {}): DailyEntry {
  return {
    id: 99,
    date,
    entered_at: `${date}T09:00:00Z`,
    entered_by: "hulin",
    energy: 6,
    sleep_quality: 6,
    appetite: 6,
    pain_worst: 2,
    pain_current: 1,
    mood_clarity: 6,
    nausea: 1,
    practice_morning_completed: true,
    practice_evening_completed: true,
    cold_dysaesthesia: false,
    neuropathy_hands: false,
    neuropathy_feet: false,
    mouth_sores: false,
    diarrhoea_count: 0,
    new_bruising: false,
    dyspnoea: false,
    fever: false,
    created_at: `${date}T09:00:00Z`,
    updated_at: `${date}T09:00:00Z`,
    ...over,
  };
}

function lab(date: string, over: Partial<LabResult> = {}): LabResult {
  return {
    id: 50,
    date,
    source: "epworth",
    created_at: `${date}T08:00:00Z`,
    updated_at: `${date}T08:00:00Z`,
    ...over,
  };
}

function cycle(
  over: Partial<TreatmentCycle> = {},
): TreatmentCycle {
  return {
    id: 7,
    protocol_id: "gnp_weekly",
    cycle_number: 3,
    start_date: "2026-04-01",
    status: "active",
    dose_level: 0,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

const EMPTY = {
  signals: [],
  signalEvents: [],
  medications: [],
  medicationEvents: [],
  careTeamContacts: [],
  labs: [],
  imaging: [],
  cycles: [],
  dailyEntries: [],
  decisions: [],
  lifeEvents: [],
};

describe("aggregateHistory", () => {
  it("returns an empty list when all sources are empty", () => {
    expect(aggregateHistory(EMPTY)).toEqual([]);
  });

  it("emits both an 'emitted' and a 'resolved' entry for a resolved signal", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      signals: [
        signal({
          id: 1,
          status: "resolved",
          detected_at: "2026-04-10T08:00:00Z",
          resolved_at: "2026-04-17T08:00:00Z",
        }),
      ],
    });
    const kinds = entries.map((e) => e.id);
    expect(kinds).toContain("signal-emitted-1");
    expect(kinds).toContain("signal-resolved-1");
    const resolved = entries.find((e) => e.id === "signal-resolved-1")!;
    expect(resolved.tone).toBe("positive");
  });

  it("includes a care-team entry with follow-up tone when flagged", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      careTeamContacts: [
        careContact("2026-04-05", {
          id: 10,
          follow_up_needed: true,
          with_who: "Dr Lee",
        }),
      ],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe("care_team");
    expect(entries[0]!.tone).toBe("caution");
  });

  it("flags fever dailies as warning tone", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      dailyEntries: [daily("2026-04-10", { id: 1, fever: true })],
    });
    expect(entries[0]!.tone).toBe("warning");
    expect(entries[0]!.category).toBe("check_in");
  });

  it("marks imaging PD as warning and PR/CR as positive", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      imaging: [
        {
          id: 1,
          date: "2026-04-08",
          modality: "CT",
          findings_summary: "Progressive disease",
          recist_status: "PD",
          created_at: "",
          updated_at: "",
        },
        {
          id: 2,
          date: "2026-04-09",
          modality: "CT",
          findings_summary: "Partial response",
          recist_status: "PR",
          created_at: "",
          updated_at: "",
        },
      ],
    });
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId["img-1"].tone).toBe("warning");
    expect(byId["img-2"].tone).toBe("positive");
  });

  it("filters entries to the specified windowDays", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      now: "2026-04-30T00:00:00Z",
      windowDays: 14,
      labs: [
        lab("2026-04-01", { id: 1 }),  // 29 days before — excluded
        lab("2026-04-20", { id: 2 }),  // 10 days before — included
      ],
    });
    expect(entries.map((e) => e.id)).toEqual(["lab-2"]);
  });

  it("sorts entries chronologically descending", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      labs: [
        lab("2026-04-01", { id: 1 }),
        lab("2026-04-20", { id: 2 }),
        lab("2026-04-10", { id: 3 }),
      ],
    });
    const ids = entries.map((e) => e.id);
    expect(ids).toEqual(["lab-2", "lab-3", "lab-1"]);
  });

  it("generates a treatment entry per cycle start", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      cycles: [cycle({ id: 1, start_date: "2026-03-01" })],
    });
    expect(entries.some((e) => e.id === "cycle-start-1")).toBe(true);
  });

  it("surfaces only action_taken events as actions, not emitted/etc", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      signalEvents: [
        signalEvent({ id: 1, kind: "emitted" }),
        signalEvent({
          id: 2,
          kind: "action_taken",
          action_ref_id: "gentle_walk_10min",
        }),
        signalEvent({ id: 3, kind: "resolved_auto" }),
      ],
    });
    const actionEntries = entries.filter((e) => e.category === "action");
    expect(actionEntries).toHaveLength(1);
    expect(actionEntries[0]!.title.en).toContain("gentle_walk_10min");
  });
});

describe("groupByDate", () => {
  it("groups already-sorted entries into contiguous date buckets", () => {
    const entries = aggregateHistory({
      ...EMPTY,
      labs: [
        lab("2026-04-10", { id: 1 }),
        lab("2026-04-10", { id: 2 }),
        lab("2026-04-09", { id: 3 }),
      ],
    });
    const groups = groupByDate(entries);
    expect(groups.map((g) => g.date)).toEqual(["2026-04-10", "2026-04-09"]);
    expect(groups[0]!.entries).toHaveLength(2);
  });
});
