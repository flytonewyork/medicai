import { NextResponse } from "next/server";
import { getServiceRoleClient, sendPushToUser } from "~/lib/push/server";
import {
  buildDigest,
  type DigestAppointment,
  type DigestZoneAlert,
  type DigestFollowUp,
} from "~/lib/cron/digest";
import { deriveFollowUpTasks } from "~/lib/appointments/follow-up-tasks";
import type { Appointment } from "~/types/appointment";
import type { ZoneAlert } from "~/types/clinical";

export const runtime = "nodejs";
// Daily digest fans out push notifications and may iterate households;
// give it generous headroom so it doesn't cut off mid-send.
export const maxDuration = 300;

// Vercel Cron entry point. Fires at 21:00 UTC daily (configured in
// vercel.json), which is 07:00 AEST — Hu Lin's morning in Melbourne.
// Multi-timezone fan-out isn't handled yet; this is a single fire.
//
// Auth: Vercel's cron invocation carries `x-vercel-cron: 1` (only
// from their edge). We also accept `authorization: Bearer <CRON_SECRET>`
// so dev / staging can trigger it manually via curl.
//
// Work: iterate every unique push-subscribed user, load their
// household's data from cloud_rows, compose a per-user digest, fan out
// via sendPushToUser. Users whose digest would be empty are skipped.

interface CloudRow<T> {
  data: T;
}

function authorised(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const service = getServiceRoleClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  const { data: subRows, error: subErr } = await service
    .from("push_subscriptions")
    .select("user_id");
  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }
  const userIds = Array.from(
    new Set((subRows ?? []).map((r) => r.user_id as string)),
  );
  if (userIds.length === 0) {
    return NextResponse.json({ users: 0, sent: 0, skipped: 0 });
  }

  const now = new Date();
  let totalSent = 0;
  let totalSkipped = 0;

  // Cache household lookups across users in the same household so we
  // don't re-fetch cloud_rows for every member.
  const householdCache = new Map<
    string,
    {
      patient_name: string;
      appointments: DigestAppointment[];
      zone_alerts: DigestZoneAlert[];
      follow_ups: DigestFollowUp[];
    }
  >();

  for (const userId of userIds) {
    const { data: membership } = await service
      .from("household_memberships")
      .select("household_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const householdId = membership?.household_id as string | undefined;
    if (!householdId) {
      totalSkipped += 1;
      continue;
    }

    let ctx = householdCache.get(householdId);
    if (!ctx) {
      const { data: householdRow } = await service
        .from("households")
        .select("patient_display_name")
        .eq("id", householdId)
        .maybeSingle();
      const patient_name =
        (householdRow?.patient_display_name as string | undefined) ??
        "Your family";

      const { data: apptRows } = await service
        .from("cloud_rows")
        .select("data")
        .eq("household_id", householdId)
        .eq("table_name", "appointments")
        .eq("deleted", false);
      const appointmentsRaw = ((apptRows ?? []) as CloudRow<Appointment>[]).map(
        (r) => r.data,
      );

      const { data: zoneRows } = await service
        .from("cloud_rows")
        .select("data")
        .eq("household_id", householdId)
        .eq("table_name", "zone_alerts")
        .eq("deleted", false);
      const zoneAlertsRaw = ((zoneRows ?? []) as CloudRow<ZoneAlert>[]).map(
        (r) => r.data,
      );

      const followUps = deriveFollowUpTasks({
        appointments: appointmentsRaw,
        now,
      }).map((t) => ({
        title: t.title,
        due_date: t.due_date,
      }));

      ctx = {
        patient_name,
        appointments: appointmentsRaw.map((a) => ({
          kind: a.kind,
          title: a.title,
          starts_at: a.starts_at,
          location: a.location ?? null,
          status: a.status ?? null,
        })),
        zone_alerts: zoneAlertsRaw.map((z) => ({
          zone: z.zone,
          resolved: z.resolved,
        })),
        follow_ups: followUps,
      };
      householdCache.set(householdId, ctx);
    }

    const { data: profile } = await service
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .maybeSingle();
    const locale = ((profile?.locale as string | undefined) ?? "en") as
      | "en"
      | "zh";

    const payload = buildDigest({
      patient_name: ctx.patient_name,
      locale,
      now,
      appointments: ctx.appointments,
      zone_alerts: ctx.zone_alerts,
      follow_ups: ctx.follow_ups,
    });
    if (!payload) {
      totalSkipped += 1;
      continue;
    }

    try {
      const result = await sendPushToUser(service, userId, payload);
      totalSent += result.sent;
    } catch {
      totalSkipped += 1;
    }
  }

  return NextResponse.json({
    users: userIds.length,
    sent: totalSent,
    skipped: totalSkipped,
  });
}
