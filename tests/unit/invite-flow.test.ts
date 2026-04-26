import { describe, expect, it } from "vitest";
import {
  daysUntilExpiry,
  friendlyInviteError,
  inviteStatusBucket,
  inviteUrl,
} from "~/lib/supabase/households";
import type { HouseholdInvite } from "~/types/household";

// Tests for the carer-invite-flow helpers. The Supabase RPCs themselves
// (get_invite_preview, update_member_role, extend_invite_expiry) are
// exercised through integration testing — these unit tests cover the
// pure helpers that drive the UI's status copy and the error mapping
// for the new failure modes (last_primary_carer, invalid_extension,
// not_authorised, …).

function makeInvite(overrides: Partial<HouseholdInvite> = {}): HouseholdInvite {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    household_id: "h",
    token: "00000000-0000-0000-0000-000000000002",
    email_hint: null,
    role: "family",
    invited_by: "u",
    created_at: "2026-04-01T00:00:00Z",
    expires_at: "2026-05-01T00:00:00Z",
    accepted_by: null,
    accepted_at: null,
    revoked_at: null,
    ...overrides,
  };
}

describe("inviteStatusBucket", () => {
  const now = new Date("2026-04-15T00:00:00Z");

  it("classifies a fresh, unaccepted, unrevoked invite as active", () => {
    expect(inviteStatusBucket(makeInvite(), now)).toBe("active");
  });

  it("classifies an expired invite as expired", () => {
    const inv = makeInvite({ expires_at: "2026-04-10T00:00:00Z" });
    expect(inviteStatusBucket(inv, now)).toBe("expired");
  });

  it("classifies an exactly-now expiry as expired (boundary)", () => {
    const inv = makeInvite({ expires_at: now.toISOString() });
    expect(inviteStatusBucket(inv, now)).toBe("expired");
  });

  it("classifies an accepted invite as accepted regardless of expiry", () => {
    const inv = makeInvite({
      accepted_at: "2026-04-10T00:00:00Z",
      expires_at: "2026-04-10T00:00:00Z",
    });
    expect(inviteStatusBucket(inv, now)).toBe("accepted");
  });

  it("classifies a revoked invite as revoked even if also accepted", () => {
    // Defensive: shouldn't happen in practice but the precedence matters.
    const inv = makeInvite({
      revoked_at: "2026-04-12T00:00:00Z",
      accepted_at: "2026-04-11T00:00:00Z",
    });
    expect(inviteStatusBucket(inv, now)).toBe("revoked");
  });
});

describe("daysUntilExpiry", () => {
  it("returns positive days for a future expiry", () => {
    const now = new Date("2026-04-15T00:00:00Z");
    expect(daysUntilExpiry("2026-04-25T00:00:00Z", now)).toBe(10);
  });

  it("returns 0 for an expiry within the same day", () => {
    const now = new Date("2026-04-15T00:00:00Z");
    expect(daysUntilExpiry("2026-04-15T18:00:00Z", now)).toBe(0);
  });

  it("returns negative days for an already-expired invite", () => {
    const now = new Date("2026-04-15T00:00:00Z");
    expect(daysUntilExpiry("2026-04-10T00:00:00Z", now)).toBe(-5);
  });
});

describe("friendlyInviteError — new failure modes", () => {
  const cases: Array<[string, string]> = [
    ["not_authenticated", "Please sign in first."],
    ["not_authorised", "Only the primary carer can do that."],
    ["not_a_member", "You're not a member of this household."],
    [
      "target_not_a_member",
      "That person isn't a member of this household.",
    ],
    [
      "last_primary_carer",
      "You can't change the role of the last primary carer — promote someone else first.",
    ],
    [
      "invalid_extension",
      "Invite extension must be between 1 and 90 days.",
    ],
  ];
  for (const [needle, expected] of cases) {
    it(`maps ${needle} to "${expected}"`, () => {
      expect(friendlyInviteError(new Error(needle))).toBe(expected);
    });
  }

  it("still maps the original Slice A errors", () => {
    expect(friendlyInviteError(new Error("invite_expired"))).toBe(
      "This invite has expired.",
    );
    expect(friendlyInviteError(new Error("invite_revoked"))).toBe(
      "This invite has been revoked.",
    );
  });
});

describe("inviteUrl", () => {
  it("still joins origin and token correctly (regression)", () => {
    expect(inviteUrl("abc-123", "https://anchor.example.com")).toBe(
      "https://anchor.example.com/invite/abc-123",
    );
  });
});
