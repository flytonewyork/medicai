import { describe, it, expect } from "vitest";
import { matchMemberByName } from "~/lib/care-team/registry";
import type { CareTeamMember } from "~/types/care-team";

function member(over: Partial<CareTeamMember> = {}): CareTeamMember {
  return {
    id: 1,
    name: "Dr Michael Lee",
    role: "oncologist",
    created_at: "2026-04-22T00:00:00.000Z",
    updated_at: "2026-04-22T00:00:00.000Z",
    ...over,
  };
}

describe("matchMemberByName", () => {
  const roster: CareTeamMember[] = [
    member({ id: 1, name: "Dr Michael Lee", role: "oncologist" }),
    member({ id: 2, name: "Wendy", role: "family" }),
    member({ id: 3, name: "Catherine Hu", role: "family" }),
  ];

  it("returns the member when names match case-insensitively", () => {
    expect(matchMemberByName("wendy", roster)?.id).toBe(2);
    expect(matchMemberByName("WENDY", roster)?.id).toBe(2);
  });

  it("trims whitespace around the target name", () => {
    expect(matchMemberByName("  Dr Michael Lee  ", roster)?.id).toBe(1);
  });

  it("returns undefined when no member matches", () => {
    expect(matchMemberByName("Dr Strange", roster)).toBeUndefined();
  });

  it("returns undefined for empty / whitespace-only input", () => {
    expect(matchMemberByName("", roster)).toBeUndefined();
    expect(matchMemberByName("   ", roster)).toBeUndefined();
  });

  it("matches full name exactly, not substring — Wendy shouldn't match Catherine Hu and vice versa", () => {
    expect(matchMemberByName("Hu", roster)).toBeUndefined();
    expect(matchMemberByName("Catherine", roster)).toBeUndefined();
  });
});
