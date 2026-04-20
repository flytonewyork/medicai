import { describe, it, expect } from "vitest";
import { parseHeuristic } from "~/lib/ingest/heuristic-parser";

describe("heuristic lab parser", () => {
  it("extracts CA19-9 with colon", () => {
    const text = "CA 19-9: 87 U/mL\nReference range <37";
    const out = parseHeuristic(text);
    expect(out.labs?.ca199).toBe(87);
  });

  it("extracts CA19-9 with hyphenated label", () => {
    const text = "Carbohydrate antigen 19-9   242";
    const out = parseHeuristic(text);
    expect(out.labs?.ca199).toBe(242);
  });

  it("normalises albumin g/dL → g/L", () => {
    const text = "Albumin: 3.5 g/dL";
    const out = parseHeuristic(text);
    expect(out.labs?.albumin).toBe(35);
  });

  it("keeps albumin g/L as is", () => {
    const text = "Albumin 32 g/L";
    const out = parseHeuristic(text);
    expect(out.labs?.albumin).toBe(32);
  });

  it("normalises haemoglobin g/dL → g/L", () => {
    const text = "Haemoglobin 11.2 g/dL";
    const out = parseHeuristic(text);
    expect(out.labs?.hemoglobin).toBeCloseTo(112, 0);
  });

  it("normalises creatinine mg/dL → umol/L", () => {
    const text = "Creatinine: 0.9 mg/dL";
    const out = parseHeuristic(text);
    expect(out.labs?.creatinine).toBe(80);
  });

  it("parses a DD/MM/YYYY collection date", () => {
    const text = "Specimen date: 03/04/2026\nCA 19-9 150";
    const out = parseHeuristic(text);
    expect(out.document_date).toBe("2026-04-03");
  });

  it("detects CT imaging with RECIST", () => {
    const text = "CT chest / abdo / pelvis\nIMPRESSION: Stable disease (SD) per RECIST.";
    const out = parseHeuristic(text);
    expect(out.imaging?.modality).toBe("CT");
    expect(out.imaging?.recist_status).toBe("SD");
    expect(out.imaging?.findings_summary).toContain("Stable disease");
  });

  it("detects ctDNA detected / not-detected", () => {
    const pos = parseHeuristic("Signatera result: detected, 0.5 MTM/mL");
    expect(pos.ctdna?.platform).toBe("signatera");
    expect(pos.ctdna?.detected).toBe(true);

    const neg = parseHeuristic("Signatera: ctDNA not detected");
    expect(neg.ctdna?.detected).toBe(false);
  });
});
