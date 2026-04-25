"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { db } from "~/lib/db/dexie";
import { PillarTiles } from "~/components/dashboard/pillar-tiles";
import { EmergencyCard } from "~/components/dashboard/emergency-card";
import { QuickCheckinCard } from "~/components/dashboard/quick-checkin-card";
import { PendingInvitesCard } from "~/components/dashboard/pending-invites-card";
import { NextClinicCard } from "~/components/dashboard/next-clinic-card";
import { ScheduleCard } from "~/components/dashboard/schedule-card";
import { ChangeSignalsCard } from "~/components/dashboard/change-signals-card";
import { MedicationPromptsCard } from "~/components/dashboard/medication-prompts-card";
import { PracticesCard } from "~/components/dashboard/practices-card";
import { NutritionCard } from "~/components/dashboard/nutrition-card";
import { TodayFeed } from "~/components/dashboard/today-feed";
import { SyncPromptCard } from "~/components/dashboard/sync-prompt-card";
import { useLocale, useT } from "~/hooks/use-translate";
import { useHousehold } from "~/hooks/use-household";
import { PageHeader } from "~/components/ui/page-header";

// Module-level constant so TodayFeed's effect deps stay stable across renders.
const EXCLUDE_IDS = ["checkin_today"];

export default function DashboardPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const settings = useLiveQuery(() => db.settings.toArray());
  const profileName = settings?.[0]?.profile_name;
  const { membership } = useHousehold();

  useEffect(() => {
    // First-run gate: no settings row (or no onboarded_at) → onboarding.
    if (settings && !settings[0]?.onboarded_at) {
      router.replace("/onboarding");
    }
  }, [router, settings]);

  // Anyone who isn't acting as the patient sees /family by default —
  // the clinician-heavy dashboard would overwhelm a visiting carer.
  // Primary carers keep the full dashboard (they proxy for the patient).
  // Checks both the Supabase household membership (authoritative once
  // joined) AND the local Dexie settings.user_type (set during first-
  // session onboarding before any sign-in).
  useEffect(() => {
    const type = settings?.[0]?.user_type;
    if (type === "caregiver" || type === "clinician") {
      router.replace("/family");
      return;
    }
    if (!membership) return;
    if (membership.role !== "primary_carer" && membership.role !== "patient") {
      router.replace("/family");
    }
  }, [membership, router, settings]);

  const { greeting, eyebrow } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const greetingEn =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
    const greetingZh =
      hour < 12 ? "早安" : hour < 18 ? "午安" : "晚安";
    const dateEyebrow =
      locale === "zh"
        ? format(now, "yyyy 年 M 月 d 日 · EEEE")
        : format(now, "EEEE · d MMM yyyy").toUpperCase();
    return {
      greeting: locale === "zh" ? greetingZh : greetingEn,
      eyebrow: dateEyebrow,
    };
  }, [locale]);

  const firstName = profileName?.split(" ").slice(-1)[0] ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={eyebrow}
        title={
          <>
            {greeting}
            {firstName && (
              <>
                ,{" "}
                <em className="font-normal italic text-ink-500">
                  {firstName}
                </em>
              </>
            )}
          </>
        }
      />

      <EmergencyCard />

      <SyncPromptCard />

      <QuickCheckinCard />

      <PendingInvitesCard />

      <NextClinicCard />

      <ScheduleCard />

      <ChangeSignalsCard />

      <MedicationPromptsCard />

      <PracticesCard />

      <NutritionCard />

      <PillarTiles />

      <TodayFeed excludeIds={EXCLUDE_IDS} />

      <footer className="pt-6 text-center text-xs text-ink-400">
        {t("common.localOnly")}
      </footer>
    </div>
  );
}
