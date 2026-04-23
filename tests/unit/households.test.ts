import { describe, it, expect } from "vitest";
import {
  friendlyInviteError,
  inviteUrl,
} from "~/lib/supabase/households";

describe("friendlyInviteError", () => {
  const cases: Array<[string, string]> = [
    ["invite_not_found", "This invite link is invalid."],
    ["invite_revoked", "This invite has been revoked."],
    ["invite_already_accepted", "This invite has already been accepted."],
    ["invite_expired", "This invite has expired."],
    ["not_signed_in", "Please sign in first."],
  ];

  for (const [needle, expected] of cases) {
    it(`maps ${needle} to "${expected}"`, () => {
      expect(friendlyInviteError(new Error(needle))).toBe(expected);
    });
  }

  it("maps an anywhere-containing message", () => {
    const err = new Error("something: invite_expired at db");
    expect(friendlyInviteError(err)).toBe("This invite has expired.");
  });

  it("falls back to the raw message for unknown errors", () => {
    expect(friendlyInviteError(new Error("boom"))).toBe("boom");
    expect(friendlyInviteError("plain string")).toBe("plain string");
  });
});

describe("inviteUrl", () => {
  it("joins origin and token correctly", () => {
    expect(inviteUrl("abc-123", "https://anchor.example.com")).toBe(
      "https://anchor.example.com/invite/abc-123",
    );
  });
  it("strips a trailing slash on the origin", () => {
    expect(inviteUrl("xyz", "https://anchor.example.com/")).toBe(
      "https://anchor.example.com/invite/xyz",
    );
  });
  it("works with a localhost origin", () => {
    expect(inviteUrl("t", "http://localhost:3000")).toBe(
      "http://localhost:3000/invite/t",
    );
  });
});
