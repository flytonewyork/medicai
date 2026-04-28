import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  applyParsedFieldsToDaily,
  buildSafeFillPatch,
} from "~/lib/voice-memo/parse";
import { persistVoiceMemo } from "~/lib/voice-memo/persist";
import type { DailyEntry } from "~/types/clinical";
import type { VoiceMemoParsedFields } from "~/types/voice-memo";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("buildSafeFillPatch", () => {
  it("fills empty numeric fields and leaves populated ones alone", () => {
    const existing: Partial<DailyEntry> = { energy: 7, pain_current: 0 };
    const parsed: VoiceMemoParsedFields = {
      energy: 4,
      pain_current: 5,
      sleep_quality: 6,
      confidence: "high",
    };
    const patch = buildSafeFillPatch(existing, parsed);
    // sleep_quality wasn't on the daily row → fills.
    expect(patch.sleep_quality).toBe(6);
    // energy and pain_current are already set → preserved.
    expect("energy" in patch).toBe(false);
    expect("pain_current" in patch).toBe(false);
  });

  it("flips booleans only undefined → true, never true → false", () => {
    const parsedFlipsOn: VoiceMemoParsedFields = {
      cold_dysaesthesia: true,
      mouth_sores: false,
      confidence: "high",
    };
    const patch1 = buildSafeFillPatch({}, parsedFlipsOn);
    expect(patch1.cold_dysaesthesia).toBe(true);
    // false from a memo never lands — silence is not denial.
    expect("mouth_sores" in patch1).toBe(false);

    const parsedTriesToInvert: VoiceMemoParsedFields = {
      cold_dysaesthesia: false,
      confidence: "high",
    };
    const patch2 = buildSafeFillPatch(
      { cold_dysaesthesia: true },
      parsedTriesToInvert,
    );
    expect("cold_dysaesthesia" in patch2).toBe(false);
  });

  it("ignores absent fields", () => {
    const patch = buildSafeFillPatch({}, { confidence: "high" });
    expect(Object.keys(patch)).toHaveLength(0);
  });

  it("handles neuropathy CTCAE grades 0–4 the same as other numerics", () => {
    const patch = buildSafeFillPatch(
      { neuropathy_hands: 1 },
      { neuropathy_hands: 3, neuropathy_feet: 2, confidence: "high" },
    );
    expect(patch.neuropathy_feet).toBe(2);
    expect("neuropathy_hands" in patch).toBe(false);
  });
});

describe("applyParsedFieldsToDaily", () => {
  it("creates a new daily_entries row when none exists for the day", async () => {
    const { memo_id } = await persistVoiceMemo({
      blob: new Blob([new Uint8Array(8)], { type: "audio/webm" }),
      mime: "audio/webm",
      duration_ms: 4000,
      transcript: "energy 6, slept ok",
      locale: "en",
      entered_by: "hulin",
      source_screen: "diary",
      recorded_at: "2026-04-29T08:00:00",
    });
    const memo = await db.voice_memos.get(memo_id);
    if (!memo) throw new Error("memo missing");

    await applyParsedFieldsToDaily(memo, {
      energy: 6,
      sleep_quality: 6,
      confidence: "high",
    });

    const row = await db.daily_entries.where("date").equals("2026-04-29").first();
    expect(row?.energy).toBe(6);
    expect(row?.sleep_quality).toBe(6);
    expect(row?.entered_by).toBe("hulin");
    expect(row?.date).toBe("2026-04-29");
  });

  it("merges into the existing daily_entries row without overwriting", async () => {
    const ts = "2026-04-29T07:00:00";
    await db.daily_entries.add({
      date: "2026-04-29",
      entered_at: ts,
      entered_by: "hulin",
      energy: 8, // user said 8 in the form earlier
      created_at: ts,
      updated_at: ts,
    });
    const { memo_id } = await persistVoiceMemo({
      blob: new Blob([new Uint8Array(8)], { type: "audio/webm" }),
      mime: "audio/webm",
      duration_ms: 4000,
      transcript: "felt sluggish, sleep was patchy",
      locale: "en",
      entered_by: "hulin",
      source_screen: "diary",
      recorded_at: "2026-04-29T20:00:00",
    });
    const memo = await db.voice_memos.get(memo_id);
    if (!memo) throw new Error("memo missing");

    await applyParsedFieldsToDaily(memo, {
      energy: 4, // memo disagrees, but user form wins
      sleep_quality: 4, // form had no value → fills
      confidence: "high",
    });

    const row = await db.daily_entries.where("date").equals("2026-04-29").first();
    expect(row?.energy).toBe(8);
    expect(row?.sleep_quality).toBe(4);
  });
});
