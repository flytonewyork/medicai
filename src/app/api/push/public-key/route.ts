import { NextResponse } from "next/server";

// Exposes the VAPID public key to the browser so it can subscribe via
// PushManager. Public by design — anyone with the key can only *send*
// to subscriptions they've been given the endpoint + auth for, and
// those are bound to the user's browser.
export const runtime = "nodejs";

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "VAPID_PUBLIC_KEY not configured." },
      { status: 503 },
    );
  }
  return NextResponse.json({ public_key: key });
}
