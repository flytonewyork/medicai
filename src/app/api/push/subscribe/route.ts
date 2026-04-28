import { NextResponse } from "next/server";
import { requireSupabaseUser } from "~/lib/auth/require-supabase-user";

// POST: upsert a PushSubscription for the current user + device.
// The body shape mirrors what PushSubscription.toJSON() produces on
// the client, plus an optional user_agent so Settings → Notifications
// can show a per-device list.

export const runtime = "nodejs";

interface RequestBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent?: string;
  locale?: "en" | "zh";
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
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json(
      { error: "endpoint + keys.p256dh + keys.auth are required" },
      { status: 400 },
    );
  }

  const { error } = await sb
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: body.user_agent ?? null,
        locale: body.locale ?? "en",
      },
      { onConflict: "user_id,endpoint" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
