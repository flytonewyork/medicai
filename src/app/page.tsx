"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { db } from "~/lib/db/dexie";
import { PillarTiles } from "~/components/dashboard/pillar-tiles";
import { PillarsCard } from "~/components/dashboard/pillars-card";
import { RecentTrends } from "~/components/dashboard/recent-trends";
import { EmergencyCard } from "~/components/dashboard/emergency-card";
import { QuickCheckinCard } from "~/components/dashboard/quick-checkin-card";
import { MedicationPromptsCard } from "~/components/dashboard/medication-prompts-card";
import { TodayFeed } from "~/components/dashboard/today-feed";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader, SectionHeader } from "~/components/ui/page-header";

export default function DashboardPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const settings = useLiveQuery(() => db.settings.toArray());
  const profileName = settings?.[0]?.profile_name;

  useEffect(() => {
    // First-run gate: no settings row (or no onboarded_at) → onboarding.
    if (settings && !settings[0]?.onboarded_at) {
      router.replace("/onboarding");
    }
  }, [router, settings]);

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

      <QuickCheckinCard />

      <MedicationPromptsCard />

      <TodayFeed excludeIds={["checkin_today"]} />

      <PillarTiles />

      <PillarsCard />

      <section className="space-y-3">
        <SectionHeader title={t("dashboard.recent_trends")} />
        <RecentTrends />
      </section>

      <footer className="pt-6 text-center text-xs text-ink-400">
        {t("common.localOnly")}
      </footer>
    </div>
  );
}
