import { describe, it, expect } from "vitest";
import {
  suggestTasteTweaks,
  TASTE_ISSUES,
  type TasteIssue,
} from "~/lib/nutrition/taste-tweaks";

describe("suggestTasteTweaks — JPCC p. 16 quadrants", () => {
  it("exposes all four taste-issue keys + 'normal'", () => {
    expect(TASTE_ISSUES).toEqual(
      expect.arrayContaining([
        "too_sweet",
        "too_salty",
        "too_bland",
        "metallic",
      ]),
    );
  });

  it("too_sweet suggests savoury / cool tweaks", () => {
    const t = suggestTasteTweaks("too_sweet");
    const text = t.suggestions.map((s) => s.en.toLowerCase()).join(" ");
    expect(text).toMatch(/cool|cold|salt|vinegar|lemon|savoury/);
  });

  it("too_salty suggests sugar / herbs / dairy tweaks", () => {
    const t = suggestTasteTweaks("too_salty");
    const text = t.suggestions.map((s) => s.en.toLowerCase()).join(" ");
    expect(text).toMatch(/pinch of sugar|herbs|spice|milk|coconut|cream/);
  });

  it("too_bland suggests strong flavours / marinades", () => {
    const t = suggestTasteTweaks("too_bland");
    const text = t.suggestions.map((s) => s.en.toLowerCase()).join(" ");
    expect(text).toMatch(/mustard|pickle|herbs|salt and pepper|parmesan|marinad/);
  });

  it("metallic suggests fresh fruit / hard lollies / plastic cutlery", () => {
    const t = suggestTasteTweaks("metallic");
    const text = t.suggestions.map((s) => s.en.toLowerCase()).join(" ");
    expect(text).toMatch(/fresh fruit|hard lollies|plastic cutlery/);
  });

  it("attaches a JPCC p. 16 citation to every result", () => {
    const issues: TasteIssue[] = [
      "too_sweet",
      "too_salty",
      "too_bland",
      "metallic",
    ];
    for (const i of issues) {
      const t = suggestTasteTweaks(i);
      const c = t.citations.find((c) => c.source_id === "jpcc_2021");
      expect(c).toBeDefined();
      expect(c!.page).toBe(16);
    }
  });

  it("provides bilingual suggestions", () => {
    const t = suggestTasteTweaks("too_sweet");
    expect(t.suggestions.length).toBeGreaterThan(0);
    for (const s of t.suggestions) {
      expect(s.en.length).toBeGreaterThan(0);
      expect(s.zh.length).toBeGreaterThan(0);
    }
  });

  it("normal returns empty suggestions", () => {
    const t = suggestTasteTweaks("normal");
    expect(t.suggestions).toEqual([]);
  });
});
