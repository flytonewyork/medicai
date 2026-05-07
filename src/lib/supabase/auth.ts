import { getSupabaseBrowser } from "~/lib/supabase/client";

// Outcome of a password sign-in or sign-up. `signed-in` means a session
// is now active and the caller can advance the UI. `confirmation-required`
// means sign-up succeeded but Supabase has email confirmation enabled —
// the user has to click the link in their inbox before they can sign in.
export type AuthOutcome =
  | { status: "signed-in" }
  | { status: "confirmation-required" };

export type AuthMode = "signin" | "signup";

// Shared sign-in / sign-up entry point used by every auth surface
// (welcome modal, inline panel, /login page). Throws on Supabase errors
// so callers can surface them via their own error UI.
export async function submitPasswordAuth(
  mode: AuthMode,
  email: string,
  password: string,
): Promise<AuthOutcome> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Supabase is not configured");

  if (mode === "signin") {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { status: "signed-in" };
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // If Supabase returned a session, email confirmation was off — we're in.
  // Otherwise the user has to confirm via email before signing in.
  return data.session
    ? { status: "signed-in" }
    : { status: "confirmation-required" };
}
