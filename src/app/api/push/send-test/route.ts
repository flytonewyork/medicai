import { NextResponse } from "next/server";
import { getSupabaseServer } from "~/lib/supabase/server";
import { getServiceRoleClient, sendPushToUser } from "~/lib/push/server";

// Dev helper: sends a test push to every subscription belonging to the
// currently signed-in user. Not gated by an "admin" flag because the
// payload + recipient are constrained to self; still, we refuse to run
// if NODE_ENV is production AND ALLOW_PUSH_TEST isn't set, so a
// misplaced bookmark doesn't wake dad up in the middle of the night.

export const runtime = "nodejs";

export async function POST() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PUSH_TEST !== "1"
  ) {
    return NextResponse.json(
      { error: "Push test disabled in production." },
      { status: 403 },
    );
  }
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
  const service = getServiceRoleClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured." },
      { status: 503 },
    );
  }

  const result = await sendPushToUser(service, auth.user.id, {
    title: "Anchor test",
    body: "Push is wired up.",
    url: "/",
    tag: "test",
  });
  return NextResponse.json(result);
}
