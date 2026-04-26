"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHousehold } from "~/hooks/use-household";
import {
  getHousehold,
  listHouseholdMembers,
} from "~/lib/supabase/households";
import type {
  Household,
  HouseholdMemberWithProfile,
} from "~/types/household";
import { useLocale } from "~/hooks/use-translate";
import { Users, Settings as SettingsIcon } from "lucide-react";

// Small avatar stack + household name at the top of /family so any
// carer landing on the page sees which household they're looking at
// and who else is on it. Tap goes to Settings → Household.

export function HouseholdHeader() {
  const locale = useLocale();
  const { membership, profile } = useHousehold();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMemberWithProfile[]>([]);

  useEffect(() => {
    if (!membership) {
      setHousehold(null);
      setMembers([]);
      return;
    }
    void (async () => {
      const [h, ms] = await Promise.all([
        getHousehold(membership.household_id),
        listHouseholdMembers(membership.household_id),
      ]);
      setHousehold(h);
      setMembers(ms);
    })();
  }, [membership]);

  if (!membership || !household) return null;
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  return (
    <Link
      href="/household"
      className="flex items-center gap-3 rounded-[var(--r-md)] border border-ink-100 bg-paper-2 px-3 py-2.5 hover:border-ink-300"
    >
      <Users className="h-4 w-4 shrink-0 text-[var(--tide-2)]" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink-900">
          {household.patient_display_name}
        </div>
        <div className="truncate text-[11.5px] text-ink-500">
          {members.length === 0
            ? L("No one else yet", "暂无其他成员")
            : members
                .map((m) =>
                  m.user_id === profile?.id
                    ? L(`${m.profile.display_name} (you)`, `${m.profile.display_name}（你）`)
                    : m.profile.display_name || "—",
                )
                .join(" · ")}
        </div>
      </div>
      <SettingsIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
    </Link>
  );
}
