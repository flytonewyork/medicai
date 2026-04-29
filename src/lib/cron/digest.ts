import type { Zone } from "~/types/clinical";
import { highestZone } from "~/lib/rules/engine";
import { localeTag } from "~/lib/utils/date";
import type { LocalizedText } from "~/types/localized";

// Pure digest builder: given a household's context (appointments,
// open zone alerts, follow-up tasks) + a user's locale, produces the
// push-payload the morning cron fans out. Returns null when there's
// nothing worth pinging about (no events, no follow-ups, zone green)
// — the cron then skips this user entirely so we don't wake anyone
// up for "everything's fine."
//
// The shape is narrow on purpose so the builder is easy to test
// server-side without touching Dexie or Supabase.

export interface DigestAppointment {
  kind: string;
  title: string;
  starts_at: string;
  location?: string | null;
  status?: string | null;
}

export interface DigestZoneAlert {
  zone: Zone;
  resolved?: boolean;
}

export interface DigestFollowUp {
  title: string;
  due_date?: string;
}

export interface DigestPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface BuildDigestArgs {
  patient_name: string;
  locale: "en" | "zh";
  now: Date;
  appointments: readonly DigestAppointment[];
  zone_alerts: readonly DigestZoneAlert[];
  follow_ups?: readonly DigestFollowUp[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function zoneLabel(z: Zone, locale: "en" | "zh"): string {
  const labels: Record<Zone, LocalizedText> = {
    green: { en: "Stable", zh: "稳定" },
    yellow: { en: "Review needed", zh: "需复核" },
    orange: { en: "Urgent review", zh: "紧急复核" },
    red: { en: "Immediate action", zh: "立即处理" },
  };
  return labels[z][locale];
}

export function buildDigest(args: BuildDigestArgs): DigestPayload | null {
  const today = startOfDay(args.now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const upcoming = args.appointments
    .filter((a) => {
      if (a.status === "cancelled" || a.status === "rescheduled") return false;
      const t = new Date(a.starts_at).getTime();
      return (
        Number.isFinite(t) && t >= today.getTime() && t < dayAfter.getTime()
      );
    })
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

  const openAlerts = (args.zone_alerts ?? []).filter((z) => !z.resolved);
  const zone = highestZone(openAlerts.map((a) => a.zone));

  const followUps = (args.follow_ups ?? []).slice(0, 3);

  // Nothing to say: no events today or tomorrow, zone green, no
  // overdue follow-ups. Skip the user.
  if (upcoming.length === 0 && zone === "green" && followUps.length === 0) {
    return null;
  }

  const isAttentionZone = zone === "red" || zone === "orange";
  const title = isAttentionZone
    ? args.locale === "zh"
      ? `${args.patient_name} · ${zoneLabel(zone, "zh")}`
      : `${args.patient_name} · ${zoneLabel(zone, "en")}`
    : args.locale === "zh"
      ? `${args.patient_name} · 今日`
      : `Today · ${args.patient_name}`;

  const lines: string[] = [];

  if (zone !== "green" && !isAttentionZone) {
    // yellow — note it but don't alarm
    lines.push(zoneLabel(zone, args.locale));
  }

  for (const a of upcoming.slice(0, 2)) {
    const time = new Date(a.starts_at).toLocaleTimeString(
      localeTag(args.locale),
      { hour: "numeric", minute: "2-digit" },
    );
    const location = a.location ? ` · ${a.location}` : "";
    lines.push(`${time} — ${a.title}${location}`);
  }

  if (upcoming.length > 2) {
    lines.push(
      args.locale === "zh"
        ? `…还有 ${upcoming.length - 2} 项`
        : `…and ${upcoming.length - 2} more`,
    );
  }

  for (const f of followUps) {
    const prefix = args.locale === "zh" ? "待记录：" : "Follow up: ";
    lines.push(`${prefix}${f.title}`);
  }

  return {
    title,
    body: lines.join("\n"),
    url: isAttentionZone ? "/" : "/family",
    tag: `digest-${today.toISOString().slice(0, 10)}`,
  };
}
