import { NextResponse } from "next/server";
import { getSupabaseServer } from "~/lib/supabase/server";

// Server-side session gate for /api/ai/* and /api/agent/* route handlers.
// Returns either the authenticated user + their household id, or a
// NextResponse the caller can `return` directly.
//
// Three failure modes get distinct responses:
//   - 503 if Supabase isn't configured (mis-deployed server, not a client problem)
//   - 401 if there's no signed-in user
//   - 200 + null household_id if the user is signed in but hasn't joined a
//     household yet (caller decides whether that's acceptable)

export interface RequireSessionResult {
  user: { id: string; email: string | null };
  household_id: string | null;
}

export type RequireSessionOutcome =
  | { ok: true; session: RequireSessionResult; error?: undefined }
  | { ok: false; error: NextResponse; session?: undefined };

export async function requireSession(): Promise<RequireSessionOutcome> {
  const sb = getSupabaseServer();
  if (!sb) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "supabase_not_configured" },
        { status: 503 },
      ),
    };
  }
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  const { data: membership } = await sb
    .from("household_memberships")
    .select("household_id")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  return {
    ok: true,
    session: {
      user: { id: data.user.id, email: data.user.email ?? null },
      household_id: (membership?.household_id as string | undefined) ?? null,
    },
  };
}
