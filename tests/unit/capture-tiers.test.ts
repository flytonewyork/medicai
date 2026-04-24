import { describe, it, expect } from "vitest";
import { TIER_CAPS, capsFor } from "~/lib/capture/tiers";

describe("capture tiers", () => {
  it("moment tier caps are tight enough for casual posts", () => {
    const m = capsFor("moment");
    expect(m.videoMaxMs).toBe(10_000);
    expect(m.voiceMaxMs).toBe(60_000);
    expect(m.softSizeCeilingBytes).toBeLessThan(TIER_CAPS.legacy.softSizeCeilingBytes);
  });

  it("legacy tier caps fit cooking, storytelling, Qigong envelopes", () => {
    const l = capsFor("legacy");
    expect(l.videoMaxMs).toBe(10 * 60_000);
    expect(l.voiceMaxMs).toBe(30 * 60_000);
  });

  it("every tier declares all cap fields", () => {
    for (const tier of ["moment", "legacy"] as const) {
      const c = capsFor(tier);
      expect(typeof c.videoMaxMs).toBe("number");
      expect(typeof c.voiceMaxMs).toBe("number");
      expect(typeof c.softSizeCeilingBytes).toBe("number");
      expect(c.videoMaxMs).toBeGreaterThan(0);
      expect(c.voiceMaxMs).toBeGreaterThan(0);
    }
  });
});
