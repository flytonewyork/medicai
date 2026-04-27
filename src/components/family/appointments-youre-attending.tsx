"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import { db } from "~/lib/db/dexie";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { useLocale, useL } from "~/hooks/use-translate";
import { useHousehold } from "~/hooks/use-household";
import { Card, CardContent } from "~/components/ui/card";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

// Caregiver-facing list of upcoming appointments they've said they'll
// attend. Filters the shared schedule to rows where the carer's own
// name (profile.display_name) is in `attendees` OR where they've
// explicitly claimed attendance via `attendance[].user_id`. Keeps the
// family view focused on "what am *I* doing today" rather than "every
// appointment the patient has."

export function AppointmentsYoureAttending() {
  const locale = useLocale();
  const L = useL();
  const { profile } = useHousehold();

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sb = getSupabaseBrowser();
      if (!sb) return;
      const { data } = await sb.auth.getUser();
      if (!cancelled) setUserId(data.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useLiveQuery(async () => {
    const all = await db.appointments.orderBy("starts_at").toArray();
    const now = Date.now();
    const myName = profile?.display_name?.trim().toLowerCase();
    return all
      .filter((a) => a.status !== "cancelled")
      .filter((a) => {
        const t = new Date(a.starts_at).getTime();
        return Number.isFinite(t) && t >= now - 12 * 3600 * 1000;
      })
      .filter((a) => {
        if (
          myName &&
          (a.attendees ?? []).some((n) => n.trim().toLowerCase() === myName)
        ) {
          return true;
        }
        if (
          userId &&
          (a.attendance ?? []).some((at) => at.user_id === userId)
        ) {
          return true;
        }
        return false;
      })
      .slice(0, 5);
  }, [profile?.display_name, userId]);

  if (!rows || rows.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
          <CalendarClock className="h-3.5 w-3.5 text-[var(--tide-2)]" />
          {L("You're going to these", "您将陪同出席")}
        </div>
        <ul className="space-y-1.5">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                href={`/schedule/${a.id}`}
                className="flex items-center gap-3 rounded-[var(--r-md)] bg-paper-2 px-3 py-2 transition-colors hover:bg-ink-100/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-ink-900">
                    {a.title}
                  </div>
                  <div className="mono mt-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-400">
                    {format(parseISO(a.starts_at), "EEE d MMM · HH:mm")}
                    {a.location ? ` · ${a.location}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-400" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
