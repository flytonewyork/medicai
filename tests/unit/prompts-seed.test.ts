import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  PROMPTS_SEED,
  seedProfilePrompts,
} from "~/lib/legacy/prompts-seed";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("PROMPTS_SEED shape", () => {
  it("has the full breadth of evidence-base sources", () => {
    const sources = new Set(PROMPTS_SEED.map((p) => p.source));
    expect(sources.has("dignity_therapy")).toBe(true);
    expect(sources.has("butler_life_review")).toBe(true);
    expect(sources.has("mcp")).toBe(true);
    expect(sources.has("fgft")).toBe(true);
    expect(sources.has("narrative_med")).toBe(true);
    expect(sources.has("pennebaker")).toBe(true);
    expect(sources.has("ambiguous_loss")).toBe(true);
    expect(sources.has("chinese_tradition")).toBe(true);
  });

  it("covers all audiences", () => {
    const audiences = new Set(PROMPTS_SEED.map((p) => p.audience));
    expect(audiences.has("hulin")).toBe(true);
    expect(audiences.has("catherine")).toBe(true);
    expect(audiences.has("thomas")).toBe(true);
    expect(audiences.has("any_family")).toBe(true);
    expect(audiences.has("shared_family")).toBe(true);
  });

  it("every prompt is bilingual", () => {
    for (const p of PROMPTS_SEED) {
      expect(typeof p.question.en).toBe("string");
      expect(typeof p.question.zh).toBe("string");
      expect(p.question.en.length).toBeGreaterThan(10);
      expect(p.question.zh.length).toBeGreaterThan(1);
    }
  });

  it("cadence_weight is in (0, 1]", () => {
    for (const p of PROMPTS_SEED) {
      expect(p.cadence_weight).toBeGreaterThan(0);
      expect(p.cadence_weight).toBeLessThanOrEqual(1);
    }
  });

  it("paired prompts are linked by a shared pair_id", () => {
    const pairIds = PROMPTS_SEED.map((p) => p.pair_id).filter(
      (x): x is string => typeof x === "string",
    );
    const byPair = new Map<string, number>();
    for (const id of pairIds) byPair.set(id, (byPair.get(id) ?? 0) + 1);
    // Every paired prompt should have at least one other prompt sharing
    // its pair_id (not necessarily exactly 2 — could be 3 for trios).
    for (const count of byPair.values()) {
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it("includes a deliberate lightness band", () => {
    const light = PROMPTS_SEED.filter((p) => p.category === "lightness");
    expect(light.length).toBeGreaterThanOrEqual(4);
    // Lightness prompts should all be low-sensitivity.
    for (const p of light) {
      expect(p.sensitivity).toBe("low");
    }
  });

  it("high-sensitivity prompts are Dignity Therapy / ambiguous loss frames", () => {
    const high = PROMPTS_SEED.filter((p) => p.sensitivity === "high");
    expect(high.length).toBeGreaterThan(0);
    for (const p of high) {
      expect(["dignity_therapy", "ambiguous_loss"]).toContain(p.source);
    }
  });
});

describe("seedProfilePrompts writes to Dexie", () => {
  it("writes every seed prompt and assigns created_at / updated_at", async () => {
    const count = await seedProfilePrompts(db);
    expect(count).toBe(PROMPTS_SEED.length);
    const all = await db.profile_prompts.toArray();
    expect(all).toHaveLength(PROMPTS_SEED.length);
    expect(all[0]?.created_at).toBeDefined();
    expect(all[0]?.updated_at).toBeDefined();
  });

  it("lets per-audience queries cheaply find unasked prompts for Hu Lin", async () => {
    await seedProfilePrompts(db);
    const unasked = await db.profile_prompts
      .where("audience")
      .equals("hulin")
      .filter((p) => !p.asked_at)
      .toArray();
    expect(unasked.length).toBeGreaterThan(10);
  });
});
