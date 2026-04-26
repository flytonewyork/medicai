"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useSettings } from "~/hooks/use-settings";
import { PillarTiles } from "~/components/dashboard/pillar-tiles";
import { EmergencyCard } from "~/components/dashboard/emergency-card";
import { QuickCheckinCard } from "~/components/dashboard/quick-checkin-card";
import { PendingInvitesCard } from "~/components/dashboard/pending-invites-card";
import { InviteFamilyCard } from "~/components/dashboard/invite-family-card";
import { RecentlyAcceptedCard } from "~/components/dashboard/recently-accepted-card";
import { BaselineNudgeCard } from "~/components/dashboard/baseline-nudge-card";
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
  const settings = useSettings();
  const profileName = settings?.profile_name;
  const { membership } = useHousehold();

  // Single redirect effect with a clear precedence ladder so two
  // racing useEffects can't both call router.replace on the same
  // render. Order:
  //   1. Settings still loading (undefined) → wait.
  //   2. No settings row OR no onboarded_at → /onboarding (everyone
  //      finishes onboarding before any role-based routing).
  //   3. Caregiver / clinician (per Dexie settings.user_type) →
  //      /family. Set during onboarding before any sign-in.
  //   4. Authenticated household member with a non-patient,
  //      non-primary-carer role (per Supabase) → /family. We wait
  //      for the household hook to resolve (membership === undefined)
  //      before acting on this branch so we don't route a
  //      yet-to-load primary_carer to the family view by accident.
  //   5. Otherwise (patient / primary carer) → stay on dashboard.
  useEffect(() => {
    if (settings === undefined) return; // still loading
    if (!settings?.onboarded_at) {
      router.replace("/onboarding");
      return;
    }
    if (settings.user_type === "caregiver" || settings.user_type === "clinician") {
      router.replace("/family");
      return;
    }
    if (membership === undefined) return; // hook still resolving
    if (
      membership !== null &&
      membership.role !== "primary_carer" &&
      membership.role !== "patient"
    ) {
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

  // While the redirect effect is deciding (settings still loading, or
  // an explicit perspective bounce in flight), render nothing rather
  // than flash the patient dashboard at a caregiver who's about to be
  // routed to /family. The app-level loading.tsx covers the visual.
  if (settings === undefined) return null;
  if (!settings?.onboarded_at) return null;
  if (settings.user_type === "caregiver" || settings.user_type === "clinician") {
    return null;
  }

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

      {/* Order = priority. Clinical (zone alert, change signals,
        medication prompts) sits first because acting on them is
        time-sensitive. Today's check-in / schedule come next as
        the "what's now" layer. Behavioural cards (practices,
        nutrition) and the data overview (PillarTiles, TodayFeed)
        follow. Setup nudges (invites, baseline, sync) live at the
        bottom so they never push a clinical alert below the fold
        — they're low-stakes housekeeping, not the reason the
        patient opened the app. */}
      <EmergencyCard />

      <ChangeSignalsCard />

      <MedicationPromptsCard />

      <QuickCheckinCard />

      <NextClinicCard />

      <ScheduleCard />

      <PracticesCard />

      <NutritionCard />

      <PillarTiles />

      <TodayFeed excludeIds={EXCLUDE_IDS} />

      <BaselineNudgeCard />

      <RecentlyAcceptedCard />

      <PendingInvitesCard />

      <InviteFamilyCard />

      <SyncPromptCard />

      <footer className="pt-6 text-center text-xs text-ink-400">
        {t("common.localOnly")}
      </footer>
    </div>
  );
}
