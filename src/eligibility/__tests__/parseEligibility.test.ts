import { describe, it, expect } from "vitest";
import { parseEligibility } from "../parseEligibility";

describe("parseEligibility", () => {
  it("returns the parsed JSON for a known NCT", async () => {
    const result = await parseEligibility("NCT06625320");
    expect(result).not.toBeNull();
    expect(result!.nct_id).toBe("NCT06625320");
    expect(result!.verified).toBe(false);
    expect(typeof result!.source_quote).toBe("string");
    expect(result!.source_quote).toMatch(/VERIFY/);
  });

  it("returns null for an unknown NCT", async () => {
    const result = await parseEligibility("NCT99999999");
    expect(result).toBeNull();
  });

  it("is case-insensitive on NCT ID", async () => {
    const a = await parseEligibility("NCT06625320");
    const b = await parseEligibility("nct06625320");
    expect(a).toEqual(b);
  });

  it("loads MTAPESTRY 103 with mtap_deletion: required", async () => {
    const result = await parseEligibility("NCT06360354");
    expect(result!.biomarker_requirements.mtap_deletion).toBe("required");
  });

  it("loads MRTX1133 with kras_mutation: g12d", async () => {
    const result = await parseEligibility("NCT05737706");
    expect(result!.biomarker_requirements.kras_mutation).toBe("g12d");
  });
});
