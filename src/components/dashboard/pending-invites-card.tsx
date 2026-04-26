"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "~/hooks/use-can";
import { useHousehold } from "~/hooks/use-household";
import { listInvites } from "~/lib/supabase/households";
import type { HouseholdInvite } from "~/types/household";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { Clock, ChevronRight } from "lucide-react";

// Nudges the primary carer when invites are still pending — so no
// family member is forgotten. Only rendered for primary_carer (via
// the permission matrix). Hides when there are no actionable
// pending invites.

export function PendingInvitesCard() {
  const locale = useLocale();
  const canSee = useCan("see_pending_invites");
  const { membership } = useHousehold();
  const [pending, setPending] = useState<HouseholdInvite[] | null>(null);

  useEffect(() => {
    if (!canSee || !membership) {
      setPending(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const rows = await listInvites(membership.household_id);
      if (cancelled) return;
      const now = Date.now();
      setPending(
        rows.filter(
          (i) =>
            !i.accepted_at &&
            !i.revoked_at &&
            new Date(i.expires_at).getTime() > now,
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [canSee, membership]);

  if (!canSee || !pending || pending.length === 0) return null;

  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--sand)] text-ink-900">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-ink-900">
              {L(
                `${pending.length} invite${pending.length === 1 ? "" : "s"} waiting`,
                `有 ${pending.length} 份邀请等待接受`,
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              {L(
                "They haven't signed up yet. Nudge them or revoke the link.",
                "对方尚未接受。可以提醒或撤销链接。",
              )}
            </p>
          </div>
        </div>
        <Link
          href="/carers"
          className="inline-flex items-center gap-0.5 text-[12px] text-ink-500 hover:text-ink-900"
        >
          {L("Manage", "管理")}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
