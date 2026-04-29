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
import { MemoFollowUpsCard } from "~/components/dashboard/memo-followups-card";
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
  //   2. Supabase household membership still resolving → wait. The
  //      hook has a 4s timeout, so this branch can't deadlock.
  //   3. Authenticated household member with a non-patient,
  //      non-primary-carer role (per Supabase) → /family. Checked
  //      BEFORE the Dexie onboarded_at gate because a freshly-
  //      signed-in carer who came via /invite/<token> has no Dexie
  //      settings row yet — sending them to /onboarding would dump
  //      them in the patient wizard, which is the wrong audience.
  //   4. No settings row OR no onboarded_at → /onboarding (the
  //      patient / primary-carer onboarding wizard).
  //   5. Caregiver / clinician (per Dexie settings.user_type) →
  //      /family. Set during onboarding before any sign-in.
  //   6. Otherwise (patient / primary carer) → stay on dashboard.
  useEffect(() => {
    if (settings === undefined) return; // dexie still loading
    if (membership === undefined) return; // supabase still resolving
    if (
      membership !== null &&
      membership.role !== "primary_carer" &&
      membership.role !== "patient"
    ) {
      router.replace("/family");
      return;
    }
    if (!settings?.onboarded_at) {
      router.replace("/onboarding");
      return;
    }
    if (settings.user_type === "caregiver" || settings.user_type === "clinician") {
      router.replace("/family");
      return;
    }
    // Otherwise stay on the dashboard (patient / primary carer).
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
  if (membership === undefined) return null;
  if (
    membership !== null &&
    membership.role !== "primary_carer" &&
    membership.role !== "patient"
  ) {
    return null;
  }
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

      <MemoFollowUpsCard />

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
