"use client";

import { db, now } from "~/lib/db/dexie";
import { useHouseholdProfiles } from "~/hooks/use-household-profiles";
import {
  nextStatus,
  setAttendance,
  statusFor,
  type PendingOrStatus,
} from "~/lib/appointments/attendance";
import { useLocale, useL } from "~/hooks/use-translate";
import type { Appointment } from "~/types/appointment";
import { Check, Clock, X, CircleDashed } from "lucide-react";
import { cn } from "~/lib/utils/cn";
import type { LocalizedText } from "~/types/localized";

// Per-member attendance chip row on the appointment detail page.
// Each household member gets one button that cycles through the
// attendance states. Non-member attendees (freetext in
// appointment.attendees) render as passive pending chips — they
// can't claim themselves from this device.

const STATUS_LABEL: Record<PendingOrStatus, LocalizedText> = {
  pending: { en: "Tap to confirm", zh: "点击确认" },
  confirmed: { en: "Going", zh: "参加" },
  tentative: { en: "Maybe", zh: "可能" },
  declined: { en: "Can't make it", zh: "无法参加" },
};

const STATUS_TONE: Record<PendingOrStatus, string> = {
  pending: "bg-paper-2 text-ink-500 border-ink-200",
  confirmed: "bg-[var(--ok-soft)] text-[var(--ok)] border-[var(--ok)]/30",
  tentative: "bg-[var(--sand)] text-ink-900 border-[var(--sand-2)]",
  declined: "bg-ink-100 text-ink-500 border-ink-300 line-through",
};

const STATUS_ICON: Record<PendingOrStatus, React.ComponentType<{ className?: string }>> = {
  pending: CircleDashed,
  confirmed: Check,
  tentative: Clock,
  declined: X,
};

export function AttendanceControls({
  appt,
  locale: localeOverride,
}: {
  appt: Appointment;
  locale?: "en" | "zh";
}) {
  const localeCtx = useLocale();
  const locale = localeOverride ?? localeCtx;
  const { profilesById } = useHouseholdProfiles();
  const L = useL();

  const members = Array.from(profilesById.values());

  // Build the render list: every household member, plus any freetext
  // attendee whose name isn't already covered by a member.
  const memberNames = new Set(
    members.map((m) => m.display_name.trim().toLowerCase()),
  );
  const extras = (appt.attendees ?? []).filter(
    (n) => n.trim() && !memberNames.has(n.trim().toLowerCase()),
  );

  async function cycle(name: string, user_id?: string) {
    if (typeof appt.id !== "number") return;
    const current = statusFor(appt.attendance, name);
    const next = nextStatus(current);
    const attendance = setAttendance(appt.attendance, {
      name,
      user_id,
      status: next,
      now: new Date(),
    });
    await db.appointments.update(appt.id, {
      attendance,
      updated_at: now(),
    });
  }

  if (members.length === 0 && extras.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mono mr-1 text-[10px] uppercase tracking-[0.12em] text-ink-400">
        {L("Going?", "到场？")}
      </span>
      {members.map((m) => {
        const status = statusFor(appt.attendance, m.display_name);
        const Icon = STATUS_ICON[status];
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => void cycle(m.display_name, m.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors",
              STATUS_TONE[status],
            )}
            aria-label={`${m.display_name}: ${STATUS_LABEL[status][locale]}`}
          >
            <Icon className="h-3 w-3" />
            {m.display_name}
          </button>
        );
      })}
      {extras.map((name, i) => {
        const status = statusFor(appt.attendance, name);
        const Icon = STATUS_ICON[status];
        return (
          <span
            key={`extra-${i}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px]",
              STATUS_TONE[status],
            )}
          >
            <Icon className="h-3 w-3" />
            {name}
          </span>
        );
      })}
    </div>
  );
}
