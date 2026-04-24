import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  DEFAULT_PROFILE_CONSENT,
  type ProfileEntry,
  type ProfilePrompt,
} from "~/types/legacy";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("v17 Legacy schema round-trips", () => {
  it("writes and reads profile_entries by author index", async () => {
    const entry: ProfileEntry = {
      kind: "voice_memo",
      language: "zh",
      recorded_at: "2026-04-24T09:15:00",
      author: "hulin",
      entry_mode: "first_person_subject",
      visibility: "family",
      propagate: true,
      tags: ["childhood", "village"],
      created_at: "2026-04-24T09:15:30",
      updated_at: "2026-04-24T09:15:30",
    };
    await db.profile_entries.add(entry);
    const fromHulin = await db.profile_entries
      .where("author")
      .equals("hulin")
      .toArray();
    expect(fromHulin).toHaveLength(1);
    expect(fromHulin[0]?.kind).toBe("voice_memo");
  });

  it("writes profile_prompts and finds unseen ones per audience", async () => {
    const base = {
      category: "childhood",
      depth: "biographical" as const,
      source: "butler_life_review" as const,
      sensitivity: "low" as const,
      cadence_weight: 0.7,
      created_at: "2026-04-24T09:00:00",
      updated_at: "2026-04-24T09:00:00",
    };
    const a: ProfilePrompt = {
      ...base,
      audience: "hulin",
      question: { en: "Tell me about your village", zh: "说说您的家乡" },
    };
    const b: ProfilePrompt = {
      ...base,
      audience: "thomas",
      question: {
        en: "What do you wish you knew about Dad's childhood?",
        zh: "您希望对爸爸的童年了解些什么?",
      },
    };
    await db.profile_prompts.bulkAdd([a, b]);
    const unseenForHulin = await db.profile_prompts
      .where("audience")
      .equals("hulin")
      .filter((p) => !p.asked_at)
      .toArray();
    expect(unseenForHulin).toHaveLength(1);
    expect(unseenForHulin[0]?.question.en).toBe("Tell me about your village");
  });

  it("consent table is a singleton row", async () => {
    const now = new Date().toISOString();
    await db.profile_consent.put({
      ...DEFAULT_PROFILE_CONSENT,
      last_updated_by: "hulin",
      updated_at: now,
    });
    // Writing id=1 again is an upsert, not a new row.
    await db.profile_consent.put({
      ...DEFAULT_PROFILE_CONSENT,
      reminiscence_mode: true,
      last_updated_by: "hulin",
      updated_at: now,
    });
    const all = await db.profile_consent.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]?.reminiscence_mode).toBe(true);
    expect(all[0]?.free_form_chat).toBe(false);
  });

  it("memory_clusters look up by seed_entry_id", async () => {
    await db.memory_clusters.add({
      title: "Rotorua 1998",
      people_mentioned: ["Catherine", "Thomas", "Grandma"],
      household_members_involved: ["catherine", "thomas"],
      propagate: true,
      seed_entry_id: 42,
      created_by: "hulin",
      created_at: "2026-04-24T09:00:00",
      updated_at: "2026-04-24T09:00:00",
    });
    const found = await db.memory_clusters
      .where("seed_entry_id")
      .equals(42)
      .first();
    expect(found?.title).toBe("Rotorua 1998");
  });

  it("biographical_outline orders by arc_position", async () => {
    await db.biographical_outline.bulkAdd([
      {
        chapter: "Career",
        arc_position: 4,
        target_depth: "rich",
        coverage: 0,
        family_coverage: { hulin: 0, catherine: 0, thomas: 0 },
        linked_entries: [],
        open_prompts: [],
        updated_at: "2026-04-24",
      },
      {
        chapter: "Origins",
        arc_position: 1,
        target_depth: "essential",
        coverage: 0,
        family_coverage: { hulin: 0, catherine: 0, thomas: 0 },
        linked_entries: [],
        open_prompts: [],
        updated_at: "2026-04-24",
      },
    ]);
    const ordered = await db.biographical_outline
      .orderBy("arc_position")
      .toArray();
    expect(ordered.map((c) => c.chapter)).toEqual(["Origins", "Career"]);
  });
});
