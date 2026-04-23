"use client";

import { FortnightlyForm } from "~/components/fortnightly/fortnightly-form";
import { PageHeader } from "~/components/ui/page-header";
import { useLocale, useT } from "~/hooks/use-translate";
import { formatDate, todayISO } from "~/lib/utils/date";
import { useRedirectCaregiverAway } from "~/lib/caregiver/guard";

export default function NewFortnightlyPage() {
  useRedirectCaregiverAway();
  const t = useT();
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={t("nav.fortnightly")}
        subtitle={`${locale === "zh" ? "今天" : "Today"} · ${formatDate(todayISO(), locale)}`}
      />
      <FortnightlyForm />
    </div>
  );
}
