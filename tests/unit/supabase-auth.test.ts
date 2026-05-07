import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Lock in the discriminated-union contract of submitPasswordAuth() —
// the helper unifies sign-in and sign-up across the welcome modal,
// inline auth panel, and /login page. If this contract drifts, every
// caller's success path breaks silently.

const signInWithPasswordMock = vi.fn();
const signUpMock = vi.fn();
const supabaseClient = {
  auth: {
    signInWithPassword: signInWithPasswordMock,
    signUp: signUpMock,
  },
};

vi.mock("~/lib/supabase/client", () => ({
  getSupabaseBrowser: () => supabaseClient,
}));

beforeEach(() => {
  signInWithPasswordMock.mockReset();
  signUpMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitPasswordAuth", () => {
  it("returns signed-in on successful sign-in", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    const { submitPasswordAuth } = await import("~/lib/supabase/auth");
    const result = await submitPasswordAuth("signin", "a@b.co", "secret");
    expect(result).toEqual({ status: "signed-in" });
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "a@b.co",
      password: "secret",
    });
  });

  it("throws when sign-in errors", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: new Error("bad credentials"),
    });
    const { submitPasswordAuth } = await import("~/lib/supabase/auth");
    await expect(
      submitPasswordAuth("signin", "a@b.co", "wrong"),
    ).rejects.toThrow("bad credentials");
  });

  it("returns signed-in on sign-up that yields a session", async () => {
    signUpMock.mockResolvedValue({
      data: { session: { access_token: "x" } },
      error: null,
    });
    const { submitPasswordAuth } = await import("~/lib/supabase/auth");
    const result = await submitPasswordAuth("signup", "a@b.co", "secret");
    expect(result).toEqual({ status: "signed-in" });
  });

  it("returns confirmation-required on sign-up without a session", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    const { submitPasswordAuth } = await import("~/lib/supabase/auth");
    const result = await submitPasswordAuth("signup", "a@b.co", "secret");
    expect(result).toEqual({ status: "confirmation-required" });
  });

  it("throws when sign-up errors", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: new Error("email taken"),
    });
    const { submitPasswordAuth } = await import("~/lib/supabase/auth");
    await expect(
      submitPasswordAuth("signup", "a@b.co", "secret"),
    ).rejects.toThrow("email taken");
  });
});
