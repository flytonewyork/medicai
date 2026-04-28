import { NextResponse } from "next/server";
import { requireSupabaseUser } from "~/lib/auth/require-supabase-user";

// POST: delete the subscription row matching { user_id, endpoint }.
// The client calls this after PushSubscription.unsubscribe() so the
// cron never fires to a dead endpoint.

export const runtime = "nodejs";

interface RequestBody {
  endpoint: string;
}

export async function POST(req: Request) {
  const auth = await requireSupabaseUser();
  if (!auth.ok) return auth.error;
  const { user, sb } = auth.data;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body?.endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  const { error } = await sb
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
