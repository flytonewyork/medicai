import { describe, it, expect } from "vitest";
import {
  composeEthicalWill,
  ETHICAL_WILL_SECTIONS,
} from "~/lib/legacy/ethical-will";

describe("ethical will scaffold", () => {
  it("has required sections in a reasonable order", () => {
    const keys = ETHICAL_WILL_SECTIONS.map((s) => s.key);
    expect(keys).toContain("values");
    expect(keys).toContain("gratitude");
    expect(keys).toContain("blessings");
    expect(keys).toContain("wisdom");
    expect(keys).toContain("practice");
    expect(keys).toContain("closing");
    // Values should land early, closing last.
    expect(keys.indexOf("values")).toBeLessThan(keys.indexOf("closing"));
  });

  it("apologies + forgiveness are optional", () => {
    const apologies = ETHICAL_WILL_SECTIONS.find((s) => s.key === "apologies");
    const forgiveness = ETHICAL_WILL_SECTIONS.find(
      (s) => s.key === "forgiveness",
    );
    expect(apologies?.optional).toBe(true);
    expect(forgiveness?.optional).toBe(true);
  });

  it("every section is fully bilingual", () => {
    for (const s of ETHICAL_WILL_SECTIONS) {
      expect(s.title.en).toBeTruthy();
      expect(s.title.zh).toBeTruthy();
      expect(s.prompt.en).toBeTruthy();
      expect(s.prompt.zh).toBeTruthy();
    }
  });

  it("composes responses into a markdown body keyed by locale", () => {
    const body = composeEthicalWill(
      {
        values: "Compassion. Stillness. Carrying family forward.",
        blessings: "For Thomas: curiosity. For Catherine: peace.",
      },
      "en",
    );
    expect(body).toContain("What I believe to be most important");
    expect(body).toContain("Compassion. Stillness.");
    expect(body).toContain("Blessings and hopes");
    // Skipped sections should not appear.
    expect(body).not.toContain("Closing words");
  });

  it("handles the zh locale", () => {
    const body = composeEthicalWill(
      { values: "慈悲。安住。代代相传。" },
      "zh",
    );
    expect(body).toContain("我认为最重要的事");
    expect(body).toContain("慈悲。安住。代代相传。");
  });

  it("returns empty string on empty responses", () => {
    expect(composeEthicalWill({}, "en")).toBe("");
  });
});
