import { describe, it, expect } from "vitest";
import { pickNextPrompt, promptToFeedItem } from "~/lib/legacy/cadence";
import type { ProfilePrompt } from "~/types/legacy";

function pp(overrides: Partial<ProfilePrompt> & Pick<ProfilePrompt, "id">): ProfilePrompt {
  return {
    category: "origins",
    depth: "biographical",
    audience: "hulin",
    source: "butler_life_review",
    sensitivity: "low",
    cadence_weight: 0.5,
    question: { en: "Q", zh: "问" },
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  };
}

describe("pickNextPrompt", () => {
  it("picks the highest cadence-weight prompt for the audience", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "green",
      prompts: [
        pp({ id: 1, cadence_weight: 0.3 }),
        pp({ id: 2, cadence_weight: 0.9 }),
        pp({ id: 3, cadence_weight: 0.5 }),
      ],
    });
    expect(out?.id).toBe(2);
  });

  it("excludes prompts for other audiences", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "green",
      prompts: [
        pp({ id: 1, audience: "catherine", cadence_weight: 0.99 }),
        pp({ id: 2, audience: "hulin", cadence_weight: 0.2 }),
      ],
    });
    expect(out?.id).toBe(2);
  });

  it("excludes high-sensitivity prompts when zone is Orange", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "orange",
      prompts: [
        pp({ id: 1, sensitivity: "high", cadence_weight: 0.9 }),
        pp({ id: 2, sensitivity: "low", cadence_weight: 0.2 }),
      ],
    });
    expect(out?.id).toBe(2);
  });

  it("excludes high-sensitivity prompts when zone is Red", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "red",
      prompts: [pp({ id: 1, sensitivity: "high", cadence_weight: 0.9 })],
    });
    expect(out).toBeNull();
  });

  it("includes high-sensitivity prompts in Green zone", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "green",
      prompts: [pp({ id: 1, sensitivity: "high", cadence_weight: 0.9 })],
    });
    expect(out?.id).toBe(1);
  });

  it("excludes prompts asked within the re-ask window", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "green",
      min_days_between_reasks: 30,
      prompts: [
        pp({ id: 1, asked_at: "2026-04-10T09:00:00", cadence_weight: 0.9 }),
        pp({ id: 2, cadence_weight: 0.3 }),
      ],
    });
    expect(out?.id).toBe(2);
  });

  it("re-includes prompts asked beyond the window", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "green",
      min_days_between_reasks: 30,
      prompts: [
        pp({ id: 1, asked_at: "2025-11-01T09:00:00", cadence_weight: 0.9 }),
        pp({ id: 2, cadence_weight: 0.3 }),
      ],
    });
    // id=1 was asked > 30 days ago, so eligible; higher weight wins.
    expect(out?.id).toBe(1);
  });

  it("tilts toward lightness in non-Green zones", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "yellow",
      prompts: [
        pp({ id: 1, category: "values", cadence_weight: 0.5 }),
        pp({ id: 2, category: "lightness", cadence_weight: 0.45 }),
      ],
    });
    // lightness gets +0.2 boost in non-green, so should overtake.
    expect(out?.id).toBe(2);
  });

  it("returns null when nothing eligible", () => {
    const out = pickNextPrompt({
      todayISO: "2026-04-24",
      audience: "hulin",
      zone: "green",
      prompts: [],
    });
    expect(out).toBeNull();
  });
});

describe("promptToFeedItem", () => {
  it("emits low-priority positive feed item with source tag", () => {
    const item = promptToFeedItem(pp({ id: 42 }), "hulin");
    expect(item.category).toBe("memory");
    expect(item.tone).toBe("positive");
    expect(item.priority).toBe(92);
    expect(item.source).toBe("dignity_prompt");
    expect(item.id).toContain("42");
  });

  it("uses audience-specific title", () => {
    const hulin = promptToFeedItem(pp({ id: 1 }), "hulin");
    const family = promptToFeedItem(pp({ id: 1 }), "any_family");
    expect(hulin.title.en).not.toBe(family.title.en);
  });
});
