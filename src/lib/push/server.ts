import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side push helpers. VAPID keys live as Vercel env vars:
//   VAPID_PUBLIC_KEY  (base64-url, also exposed to the client via
//                      /api/push/public-key so the SW can subscribe)
//   VAPID_PRIVATE_KEY (base64-url, never leaves the server)
//   VAPID_SUBJECT     ("mailto:ops@anchor.example" — identifies the
//                      push sender to push providers)
//
// The morning-digest cron (Slice E) needs a service-role Supabase
// client to read every household's subscriptions; the subscribe /
// unsubscribe routes use the request-scoped client so RLS gates them
// to the caller's own rows.

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT ?? "mailto:ops@anchor.invalid";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Returns a service-role Supabase client when the env var is set.
// Only call this from a server route / cron handler — never from a
// client bundle. No-op (returns null) if the env var is missing so
// local dev without the service key doesn't break.
export function getServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Sends one notification to one subscription. Caller is responsible
// for deleting the row if this returns 410 (Gone) — that's the
// convention PushManager uses to signal the subscription is dead.
export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!ensureConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "VAPID keys not configured on the server.",
    };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 },
    );
    return { ok: true };
  } catch (err) {
    const statusCode =
      (err as { statusCode?: number })?.statusCode ??
      (err as { status?: number })?.status ??
      500;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: statusCode, error: message };
  }
}

// Dispatches a push to every active subscription for a user. Rows
// that come back 410 are deleted so we don't keep retrying dead
// endpoints. Requires a service-role client.
export async function sendPushToUser(
  serviceRole: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number; failed: number }> {
  const { data, error } = await serviceRole
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = (data ?? []) as PushSubscriptionRow[];
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const sub of rows) {
    const res = await sendPush(sub, payload);
    if (res.ok) {
      sent += 1;
      await serviceRole
        .from("push_subscriptions")
        .update({ last_pushed_at: new Date().toISOString() })
        .eq("id", sub.id);
    } else if (res.status === 404 || res.status === 410) {
      // Endpoint gone — drop the row so it doesn't linger.
      await serviceRole.from("push_subscriptions").delete().eq("id", sub.id);
      removed += 1;
    } else {
      failed += 1;
    }
  }
  return { sent, removed, failed };
}
