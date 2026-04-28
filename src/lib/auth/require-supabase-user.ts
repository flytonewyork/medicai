import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "~/lib/supabase/server";

// Lightweight Supabase-only auth gate for routes that need a signed-in
// user but don't care about household membership (push subscription
// management, etc.). Distinct from requireSession() — that helper also
// resolves household_id, returns lowercase error codes, and is used by
// AI/agent routes where the household profile drives prompts.
//
// Returns either the user + the Supabase client (so the caller doesn't
// re-instantiate it), or a NextResponse the caller can return directly.

export interface RequireSupabaseUserResult {
  user: { id: string; email: string | null };
  sb: SupabaseClient;
}

export type RequireSupabaseUserOutcome =
  | { ok: true; data: RequireSupabaseUserResult; error?: undefined }
  | { ok: false; error: NextResponse; data?: undefined };

export async function requireSupabaseUser(): Promise<RequireSupabaseUserOutcome> {
  const sb = getSupabaseServer();
  if (!sb) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      ),
    };
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  return {
    ok: true,
    data: {
      user: { id: auth.user.id, email: auth.user.email ?? null },
      sb,
    },
  };
}
