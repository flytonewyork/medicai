"use client";

import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { EmergencyCard } from "~/components/dashboard/emergency-card";
import { HouseholdHeader } from "~/components/family/household-header";
import { ZoneBanner } from "~/components/family/zone-banner";
import { NextUp } from "~/components/family/next-up";
import { QuickNote } from "~/components/family/quick-note";
import { CallList } from "~/components/family/call-list";

// Family-facing landing page. Purpose-built for the carer who isn't
// Thomas: calm status, what's coming up, a quick way to note what they
// saw, and one-tap access to the care team. Thomas still lands on /.

export default function FamilyPage() {
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "家人视图" : "FAMILY VIEW"}
        title={locale === "zh" ? "爸爸今天" : "Today with dad"}
      />

      <HouseholdHeader />

      <EmergencyCard />

      <ZoneBanner />

      <NextUp />

      <QuickNote />

      <CallList />

      <footer className="pt-4 text-center text-[11px] text-ink-400">
        {locale === "zh"
          ? "同一账户的家人都能看到相同的内容。"
          : "Everyone signed into this account sees the same thing."}
      </footer>
    </div>
  );
}
