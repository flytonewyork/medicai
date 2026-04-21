"use client";

import { useParams } from "next/navigation";
import { WeeklyForm } from "~/components/weekly/weekly-form";
import { PageHeader } from "~/components/ui/page-header";
import { useT } from "~/hooks/use-translate";

export default function EditWeeklyPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader title={t("nav.weekly")} />
      <WeeklyForm entryId={Number.isFinite(id) ? id : undefined} />
    </div>
  );
}
