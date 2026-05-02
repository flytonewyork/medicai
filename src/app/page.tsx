"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useSettings } from "~/hooks/use-settings";
import { useAuthSession } from "~/hooks/use-auth-session";
import { isSupabaseConfigured } from "~/lib/supabase/client";
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
  const session = useAuthSession();

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

  // Date-only eyebrow + neutral title. CLAUDE.md prescribes a measured,
  // respectful tone — a time-of-day "Good morning" can read as tone-deaf
  // to a patient on a hard chemo day. We keep the date for orientation
  // and surface the patient's name without a cheerful adverb.
  const eyebrow = useMemo(() => {
    const today = new Date();
    return locale === "zh"
      ? format(today, "yyyy 年 M 月 d 日 · EEEE")
      : format(today, "EEEE · d MMM yyyy").toUpperCase();
  }, [locale]);

  const firstName = profileName?.split(" ").slice(-1)[0] ?? "";

  // While the redirect effect is deciding (settings still loading, or
  // an explicit perspective bounce in flight), show a quiet skeleton
  // rather than a blank screen. The app-level loading.tsx covers the
  // first paint, but Dexie + Supabase resolves can land mid-render and
  // a flash of nothing reads as "the app broke". Caregiver bounce keeps
  // returning null so we don't flash patient content at a carer.
  if (settings === undefined || membership === undefined) {
    return <DashboardSkeleton />;
  }
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

  // Local-only footer is misleading when the user is signed in (data
  // is syncing to Supabase). Show it only when there's no cloud option
  // — Supabase isn't configured at all, or the user is genuinely
  // signed out.
  const showLocalOnly =
    !isSupabaseConfigured() || (session !== undefined && !session.signedIn);

  const titleFallback = locale === "zh" ? "今日" : "Today";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={eyebrow}
        title={firstName || titleFallback}
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

      {showLocalOnly && (
        <footer className="pt-6 text-center text-xs text-ink-400">
          {t("common.localOnly")}
        </footer>
      )}
    </div>
  );
}

// Quiet skeleton shown while settings + household resolves are in flight.
// Two muted cards mirror the dashboard's actual layout so nothing jumps
// when the real content lands. Animation is subtle (no spinner) — the
// app-level pattern avoids cheerful loading states.
function DashboardSkeleton() {
  return (
    <div
      className="mx-auto max-w-4xl space-y-6 p-4 md:p-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-ink-100" />
        <div className="h-7 w-44 animate-pulse rounded bg-ink-100" />
      </div>
      <div className="h-24 animate-pulse rounded-md bg-ink-100/70" />
      <div className="h-32 animate-pulse rounded-md bg-ink-100/70" />
    </div>
  );
}
