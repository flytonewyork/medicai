import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  applyMemoPatches,
  buildSafeFillPatch,
  extractDailyShape,
} from "~/lib/voice-memo/apply";
import { persistVoiceMemo } from "~/lib/voice-memo/persist";
import { scrubForSync } from "~/lib/sync/hooks";
import type { DailyEntry } from "~/types/clinical";
import type { VoiceMemoParsedFields } from "~/types/voice-memo";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("buildSafeFillPatch", () => {
  it("fills empty numeric fields and leaves populated ones alone", () => {
    const existing: Partial<DailyEntry> = { energy: 7, pain_current: 0 };
    const patch = buildSafeFillPatch(existing, {
      energy: 4,
      pain_current: 5,
      sleep_quality: 6,
    });
    expect(patch.sleep_quality).toBe(6);
    expect("energy" in patch).toBe(false);
    expect("pain_current" in patch).toBe(false);
  });

  it("flips booleans only undefined → true, never true → false", () => {
    const patch1 = buildSafeFillPatch(
      {},
      { cold_dysaesthesia: true, mouth_sores: false },
    );
    expect(patch1.cold_dysaesthesia).toBe(true);
    expect("mouth_sores" in patch1).toBe(false);

    const patch2 = buildSafeFillPatch(
      { cold_dysaesthesia: true },
      { cold_dysaesthesia: false },
    );
    expect("cold_dysaesthesia" in patch2).toBe(false);
  });
});

describe("extractDailyShape", () => {
  it("only carries numerics + booleans the daily form represents", () => {
    const parsed: VoiceMemoParsedFields = {
      energy: 6,
      sleep_quality: 7,
      neuropathy_hands: 1,
      cold_dysaesthesia: true,
      notes: "felt fine",
      confidence: "high",
      // clinical / personal must not leak into the daily-form shape
      clinical: {
        clinic_visit: { summary: "saw Sumi" },
      },
      personal: { food_mentions: ["eggs"] },
    };
    const shape = extractDailyShape(parsed);
    expect(shape).toEqual({
      energy: 6,
      sleep_quality: 7,
      neuropathy_hands: 1,
      cold_dysaesthesia: true,
    });
  });
});

describe("applyMemoPatches", () => {
  async function makeMemo(parsed: VoiceMemoParsedFields, day = "2026-04-29") {
    const { memo_id } = await persistVoiceMemo({
      blob: new Blob([new Uint8Array(8)], { type: "audio/webm" }),
      mime: "audio/webm",
      duration_ms: 4000,
      transcript: "test",
      locale: "en",
      entered_by: "hulin",
      source_screen: "diary",
      recorded_at: `${day}T08:00:00`,
    });
    await db.voice_memos.update(memo_id, {
      parsed_fields: parsed,
      updated_at: new Date().toISOString(),
    });
    return memo_id;
  }

  it("creates a new daily_entries row + records an audit patch", async () => {
    const memoId = await makeMemo({
      energy: 6,
      sleep_quality: 6,
      confidence: "high",
    });
    const patches = await applyMemoPatches(memoId);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.table).toBe("daily_entries");
    expect(patches[0]?.op).toBe("create");
    expect(patches[0]?.fields).toEqual({ energy: 6, sleep_quality: 6 });

    const stored = await db.voice_memos.get(memoId);
    expect(stored?.parsed_fields?.applied_patches).toHaveLength(1);
  });

  it("merges into existing daily_entries without overwriting filled fields", async () => {
    const ts = "2026-04-29T07:00:00";
    await db.daily_entries.add({
      date: "2026-04-29",
      entered_at: ts,
      entered_by: "hulin",
      energy: 8,
      created_at: ts,
      updated_at: ts,
    });
    const memoId = await makeMemo({
      energy: 4,
      sleep_quality: 4,
      confidence: "high",
    });
    const patches = await applyMemoPatches(memoId);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.op).toBe("update");
    expect(patches[0]?.fields).toEqual({ sleep_quality: 4 });

    const row = await db.daily_entries.where("date").equals("2026-04-29").first();
    expect(row?.energy).toBe(8); // user form wins
    expect(row?.sleep_quality).toBe(4);
  });

  it("applies a clinic visit as a life_events medical row", async () => {
    const memoId = await makeMemo({
      confidence: "high",
      clinical: {
        clinic_visit: {
          provider: "A/Prof Sumitra Ananda",
          summary: "Reviewed cycle 3 toxicity, dose held this week.",
          key_points: ["Hold gem next week", "Rebook in 14 days"],
        },
      },
    });
    const patches = await applyMemoPatches(memoId);
    expect(patches.some((p) => p.table === "life_events")).toBe(true);
    const visitPatch = patches.find((p) => p.table === "life_events");
    expect(visitPatch?.op).toBe("create");
    expect(visitPatch?.fields.summary).toContain("cycle 3");

    const row = await db.life_events.get(visitPatch!.row_id);
    expect(row?.category).toBe("medical");
    expect(row?.is_memory).toBe(false);
    expect(row?.notes).toContain("Hold gem next week");
  });

  it("auto-creates only high-confidence appointments", async () => {
    const memoId = await makeMemo({
      confidence: "high",
      clinical: {
        appointments_mentioned: [
          {
            title: "Cycle 3 chemo",
            starts_at: "2026-05-02T08:00:00",
            kind: "chemo",
            location: "Epworth Richmond",
            confidence: "high",
          },
          {
            title: "Maybe a scan",
            confidence: "low",
          },
        ],
      },
    });
    const patches = await applyMemoPatches(memoId);
    const apptPatches = patches.filter((p) => p.table === "appointments");
    expect(apptPatches).toHaveLength(1);
    expect(apptPatches[0]?.fields.title).toBe("Cycle 3 chemo");
    expect(apptPatches[0]?.fields.kind).toBe("chemo");
  });

  it("respects per-section toggles passed via ApplyOptions", async () => {
    const memoId = await makeMemo({
      energy: 5,
      confidence: "high",
      clinical: {
        clinic_visit: { summary: "Saw Sumi briefly" },
      },
    });
    const patches = await applyMemoPatches(memoId, {
      apply_daily: false,
      apply_clinic_visit: true,
      apply_appointments: true,
    });
    expect(patches.some((p) => p.table === "daily_entries")).toBe(false);
    expect(patches.some((p) => p.table === "life_events")).toBe(true);
  });

  it("uses daily_overrides instead of the parsed values when supplied", async () => {
    const memoId = await makeMemo({
      energy: 5,
      sleep_quality: 5,
      confidence: "high",
    });
    const patches = await applyMemoPatches(memoId, {
      daily_overrides: { energy: 7, sleep_quality: 6 },
    });
    expect(patches[0]?.fields).toEqual({ energy: 7, sleep_quality: 6 });
  });
});

describe("scrubForSync", () => {
  it("strips parsed_fields.personal from voice_memos before enqueue", () => {
    const row = {
      id: 1,
      transcript: "hi",
      parsed_fields: {
        confidence: "high",
        energy: 7,
        personal: { food_mentions: ["eggs"], mood_narrative: "felt good" },
      },
    } as const;
    const out = scrubForSync("voice_memos", row);
    const parsed = (out as { parsed_fields: Record<string, unknown> }).parsed_fields;
    expect("personal" in parsed).toBe(false);
    expect(parsed.energy).toBe(7);
    expect(parsed.confidence).toBe("high");
  });

  it("passes other tables through untouched", () => {
    const row = { id: 1, energy: 7 };
    expect(scrubForSync("daily_entries", row)).toBe(row);
  });

  it("handles voice_memos with no parsed_fields cleanly", () => {
    const row = { id: 1, transcript: "" };
    const out = scrubForSync("voice_memos", row);
    expect(out).toEqual(row);
  });
});
