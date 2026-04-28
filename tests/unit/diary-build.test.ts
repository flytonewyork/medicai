import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import { buildDiaryDays } from "~/lib/diary/build";
import { persistVoiceMemo } from "~/lib/voice-memo/persist";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("buildDiaryDays", () => {
  it("groups voice memos and other rows by their local day, newest first", async () => {
    // Two voice memos on 2026-04-26, one on 2026-04-27.
    await persistVoiceMemo({
      blob: new Blob([new Uint8Array(8)], { type: "audio/webm" }),
      mime: "audio/webm",
      duration_ms: 4000,
      transcript: "morning walk",
      locale: "en",
      entered_by: "hulin",
      source_screen: "diary",
      recorded_at: "2026-04-26T07:00:00",
    });
    await persistVoiceMemo({
      blob: new Blob([new Uint8Array(8)], { type: "audio/webm" }),
      mime: "audio/webm",
      duration_ms: 5000,
      transcript: "felt tired after lunch",
      locale: "en",
      entered_by: "hulin",
      source_screen: "log",
      recorded_at: "2026-04-26T13:30:00",
    });
    await persistVoiceMemo({
      blob: new Blob([new Uint8Array(8)], { type: "audio/webm" }),
      mime: "audio/webm",
      duration_ms: 6000,
      transcript: "good sleep",
      locale: "en",
      entered_by: "hulin",
      source_screen: "diary",
      recorded_at: "2026-04-27T08:00:00",
    });

    // A daily entry, a log event, a lab, and an agent run on 2026-04-26.
    await db.daily_entries.add({
      date: "2026-04-26",
      entered_at: "2026-04-26T20:00:00",
      entered_by: "hulin",
      energy: 7,
    });
    await db.log_events.add({
      at: "2026-04-26T15:00:00",
      input: { text: "right hand still numb", tags: ["toxicity"], locale: "en" },
    });
    await db.labs.add({ date: "2026-04-26" });
    await db.agent_runs.add({
      agent_id: "toxicity",
      ran_at: "2026-04-26T20:30:00",
      trigger: "on_demand",
      referral_ids: [],
      output: {
        daily_report: { en: "Stable.", zh: "平稳。" },
        safety_flags: [],
        filings: [],
        questions: [],
        nudges: [],
        state_diff: "",
      },
    });

    const days = await buildDiaryDays({
      from: "2026-04-26",
      to: "2026-04-27",
    });

    expect(days.map((d) => d.day)).toEqual(["2026-04-27", "2026-04-26"]);
    const today = days[0];
    const earlier = days[1];

    expect(today.voice_memos).toHaveLength(1);
    expect(today.voice_memos[0]?.transcript).toBe("good sleep");
    expect(today.daily_entry).toBeUndefined();
    expect(today.log_events).toHaveLength(0);
    expect(today.labs).toHaveLength(0);
    expect(today.agent_runs).toHaveLength(0);
    expect(today.has_content).toBe(true);

    // Memos for the older day come back newest-first.
    expect(earlier.voice_memos.map((m) => m.transcript)).toEqual([
      "felt tired after lunch",
      "morning walk",
    ]);
    expect(earlier.daily_entry?.energy).toBe(7);
    expect(earlier.log_events).toHaveLength(1);
    expect(earlier.labs).toHaveLength(1);
    expect(earlier.agent_runs).toHaveLength(1);
    expect(earlier.has_content).toBe(true);
  });

  it("includeEmpty fills in days with no rows so navigation can step through them", async () => {
    const days = await buildDiaryDays({
      from: "2026-04-25",
      to: "2026-04-27",
      includeEmpty: true,
    });
    expect(days.map((d) => d.day)).toEqual([
      "2026-04-27",
      "2026-04-26",
      "2026-04-25",
    ]);
    expect(days.every((d) => d.has_content === false)).toBe(true);
  });
});

describe("persistVoiceMemo", () => {
  it("writes the memo + the audio blob and links them", async () => {
    const { memo_id, audio_media_id } = await persistVoiceMemo({
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" }),
      mime: "audio/webm",
      duration_ms: 1234,
      transcript: "hello diary",
      locale: "en",
      entered_by: "hulin",
      source_screen: "diary",
      recorded_at: "2026-04-28T10:00:00",
    });
    const memo = await db.voice_memos.get(memo_id);
    const media = await db.timeline_media.get(audio_media_id);

    expect(memo?.transcript).toBe("hello diary");
    expect(memo?.day).toBe("2026-04-28");
    expect(memo?.audio_media_id).toBe(audio_media_id);
    expect(memo?.audio_size_bytes).toBe(4);
    expect(memo?.audio_path).toBeUndefined();

    expect(media?.owner_type).toBe("voice_memo");
    expect(media?.owner_id).toBe(memo_id);
    expect(media?.kind).toBe("voice");
    expect(media?.duration_ms).toBe(1234);
  });
});
