"use client";

import { WeeklyForm } from "~/components/weekly/weekly-form";
import { PageHeader } from "~/components/ui/page-header";
import { useLocale, useT } from "~/hooks/use-translate";

export default function NewWeeklyPage() {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={t("nav.weekly")}
        subtitle={
          locale === "zh"
            ? "修习完整性、感受、担忧、想问的事。"
            : "Practice, how you felt, what concerned you, what to ask."
        }
      />
      <WeeklyForm />
    </div>
  );
}
