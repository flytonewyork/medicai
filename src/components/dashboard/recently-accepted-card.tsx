"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "~/hooks/use-can";
import { useHousehold } from "~/hooks/use-household";
import { listInvites } from "~/lib/supabase/households";
import { ROLE_LABEL } from "~/lib/auth/permissions";
import type { HouseholdInvite } from "~/types/household";
import { useLocale, pickL } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { UserCheck, ChevronRight } from "lucide-react";

// Closes the invite loop for the primary carer. When a relative
// accepts an invite, Thomas wants to know without having to dig.
// This surfaces a glanceable card for invites accepted in the last
// 72 hours, then quietly disappears.
//
// Auto-dismisses (per-token) once Thomas opens /household so the
// dashboard doesn't keep nagging about something he's already
// reviewed. The dismiss state lives in localStorage — these are
// transient acknowledgements, not data we need synced cross-device.

const DISMISS_KEY = "anchor.invite.recently_accepted.dismissed";
const RECENT_WINDOW_HOURS = 72;

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage can be disabled (Safari private mode); silently ignore.
  }
}

export function RecentlyAcceptedCard() {
  const locale = useLocale();
  const canSee = useCan("see_pending_invites"); // primary_carer-gated
  const { membership } = useHousehold();
  const [recent, setRecent] = useState<HouseholdInvite[] | null>(null);

  useEffect(() => {
    if (!canSee || !membership) {
      setRecent(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const rows = await listInvites(membership.household_id);
      if (cancelled) return;
      const cutoff = Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000;
      const dismissed = readDismissed();
      setRecent(
        rows.filter(
          (i) =>
            i.accepted_at &&
            new Date(i.accepted_at).getTime() >= cutoff &&
            !dismissed.has(i.id),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [canSee, membership]);

  if (!canSee || !recent || recent.length === 0) return null;

  const L = pickL(locale);
  // Most-recent first.
  const sorted = [...recent].sort(
    (a, b) =>
      new Date(b.accepted_at!).getTime() - new Date(a.accepted_at!).getTime(),
  );
  const newest = sorted[0]!;
  const extras = sorted.length - 1;

  function dismiss() {
    const ids = readDismissed();
    for (const inv of sorted) ids.add(inv.id);
    writeDismissed(ids);
    setRecent([]);
  }

  return (
    <Card className="border-[var(--ok)]/40 bg-[var(--ok-soft)]">
      <CardContent className="flex items-start justify-between gap-3 pt-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--ok)]/15 text-[var(--ok)]">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink-900">
              {extras === 0
                ? L(
                    `${newest.email_hint?.trim() || "A new member"} just joined`,
                    `${newest.email_hint?.trim() || "新成员"} 刚刚加入`,
                  )
                : L(
                    `${sorted.length} new members joined`,
                    `${sorted.length} 位新成员加入`,
                  )}
            </div>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
              {extras === 0
                ? L(
                    `Joined as ${ROLE_LABEL[newest.role].en}.`,
                    `角色：${ROLE_LABEL[newest.role].zh}。`,
                  )
                : L(
                    "Tap manage to see who and confirm their roles.",
                    "点击「管理」查看成员并确认角色。",
                  )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Link
            href="/household"
            onClick={dismiss}
            className="inline-flex items-center gap-0.5 text-[12px] text-ink-700 hover:text-ink-900"
          >
            {L("Manage", "管理")}
            <ChevronRight className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="text-[10.5px] text-ink-400 hover:text-ink-700"
          >
            {L("Dismiss", "忽略")}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
