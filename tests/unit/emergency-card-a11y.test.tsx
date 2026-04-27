import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

// Phase 3.11 acceptance: when the zone is red or orange, the
// EmergencyCard wrapper announces itself via role="alert" +
// aria-live="assertive" so screen readers surface the change
// without the user having to navigate to it.

vi.mock("~/hooks/use-zone-status", () => ({
  useZoneStatus: () => ({ zone: "red" }),
}));

vi.mock("~/hooks/use-settings", () => ({
  useSettings: () => ({
    oncall_phone: "+61 3 9000 0000",
    managing_oncologist_phone: undefined,
    hospital_phone: undefined,
  }),
}));

vi.mock("~/hooks/use-translate", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "en",
}));

afterEach(() => cleanup());

describe("EmergencyCard accessibility", () => {
  it("announces a red-zone alert via role=alert + aria-live=assertive", async () => {
    const { EmergencyCard } = await import(
      "~/components/dashboard/emergency-card"
    );
    const { container } = render(<EmergencyCard />);
    const section = container.querySelector("section");
    expect(section).toBeTruthy();
    expect(section?.getAttribute("role")).toBe("alert");
    expect(section?.getAttribute("aria-live")).toBe("assertive");
    expect(section?.getAttribute("aria-atomic")).toBe("true");
  });
});
