import { NextResponse } from "next/server";
import { getSupabaseServer } from "~/lib/supabase/server";

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
  const sb = getSupabaseServer();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

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
        user_id: auth.user.id,
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
