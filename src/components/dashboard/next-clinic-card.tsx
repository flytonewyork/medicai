"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, formatDistanceToNowStrict, isToday, isTomorrow } from "date-fns";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card } from "~/components/ui/card";
import { activeFast, hasActivePrep } from "~/lib/appointments/prep";
import { Stethoscope, ChevronRight, Clock, MapPin, UserRound } from "lucide-react";

// Dedicated "NEXT CLINIC APPOINTMENT" card. Separate from the broader
// Schedule card because (a) clinic consults drive the bridge-strategy
// conversation and (b) the patient has asked that this be surfaced as a
// single glance rather than buried in a day-window list.

export function NextClinicCard() {
  const locale = useLocale();
  const appointments = useLiveQuery(
    () =>
      db.appointments
        .where("[kind+starts_at]")
        .between(["clinic", ""], ["clinic", "￿"])
        .toArray(),
    [],
  );

  const next = useMemo(() => {
    if (!appointments) return null;
    const now = Date.now();
    const upcoming = appointments
      .filter((a) => a.status !== "cancelled" && a.status !== "missed")
      .map((a) => ({ a, t: new Date(a.starts_at).getTime() }))
      .filter(({ t }) => Number.isFinite(t) && t >= now)
      .sort((x, y) => x.t - y.t);
    return upcoming[0]?.a ?? null;
  }, [appointments]);

  if (!next) return null;
  // ScheduleCard already shows today + tomorrow appointments. Suppress this
  // dedicated card when the next clinic is already in that window so the
  // dashboard doesn't surface the same appointment twice.
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const endTomorrow = startToday.getTime() + 2 * 24 * 60 * 60 * 1000;
  const nextStart = new Date(next.starts_at).getTime();
  if (Number.isFinite(nextStart) && nextStart < endTomorrow) return null;

  const when = new Date(next.starts_at);
  const dateLabel = isToday(when)
    ? locale === "zh"
      ? "今天"
      : "Today"
    : isTomorrow(when)
      ? locale === "zh"
        ? "明天"
        : "Tomorrow"
      : locale === "zh"
        ? format(when, "M 月 d 日 EEEE")
        : format(when, "EEE · d MMM");
  const timeLabel = next.all_day
    ? locale === "zh"
      ? "全天"
      : "All day"
    : format(when, locale === "zh" ? "HH:mm" : "h:mm a");
  const awayLabel = formatDistanceToNowStrict(when, { addSuffix: true });

  const fast = activeFast(next);
  const prepBadge = hasActivePrep(next);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="eyebrow">
              {locale === "zh" ? "下一次就诊" : "Next clinic appointment"}
            </div>
            <div className="serif truncate text-[17px] text-ink-900">
              {next.title}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-500">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dateLabel} · {timeLabel}
                <span className="mono text-[10.5px] text-ink-400">
                  · {awayLabel}
                </span>
              </span>
              {next.doctor && (
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3 w-3" />
                  {next.doctor}
                </span>
              )}
              {next.location && (
                <span className="inline-flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3" />
                  {next.location}
                </span>
              )}
            </div>
            {(fast || prepBadge) && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {fast && (
                  <span className="a-chip warn">
                    {locale === "zh" ? "需空腹" : "Fasting"}
                  </span>
                )}
                {!fast && prepBadge && (
                  <span className="a-chip sand">
                    {locale === "zh" ? "需准备" : "Prep"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <Link
          href={next.id ? `/schedule/${next.id}` : "/schedule"}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-700 hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]"
        >
          {locale === "zh" ? "打开" : "Open"}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
