import { describe, it, expect } from "vitest";
import { SOURCES, getSource } from "~/lib/nutrition/sources";

// Cancer Institute NSW (eviq.org.au) is the canonical Australian
// source for the chemo-safety-at-home and neutropenia patient
// information sheets that JPCC distributes to its patients. Adding
// them as first-class citations so the safety pages can render the
// "where this comes from" pill the same way nutrition does.

describe("eviq Cancer Institute NSW sources", () => {
  it("includes the chemotherapy safety at home sheet (2025)", () => {
    const s = SOURCES.eviq_chemo_safety_2025;
    expect(s).toBeDefined();
    expect(s.short_label).toMatch(/eviq|Chemotherapy safety/i);
    expect(s.full_citation).toMatch(/Cancer Institute NSW/);
    expect(s.url).toMatch(/eviq\.org\.au/);
    expect(s.year).toBe(2025);
  });

  it("includes the neutropenia / infection prevention sheet (2025)", () => {
    const s = SOURCES.eviq_neutropenia_2025;
    expect(s).toBeDefined();
    expect(s.short_label).toMatch(/eviq|Neutropenia|Infection/i);
    expect(s.full_citation).toMatch(/Cancer Institute NSW/);
    expect(s.url).toMatch(/eviq\.org\.au/);
    expect(s.year).toBe(2025);
  });

  it("getSource resolves both new sources", () => {
    expect(getSource("eviq_chemo_safety_2025").short_label).toBeTruthy();
    expect(getSource("eviq_neutropenia_2025").short_label).toBeTruthy();
  });
});
