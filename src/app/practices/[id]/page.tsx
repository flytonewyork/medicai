"use client";

import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { PracticeForm } from "~/components/practices/practice-form";
import { Card } from "~/components/ui/card";

export default function EditPracticePage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const med = useLiveQuery(
    () => (Number.isFinite(id) ? db.medications.get(id) : undefined),
    [id],
  );

  if (!Number.isFinite(id)) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Card className="p-5 text-sm text-ink-500">
          {locale === "zh" ? "无效链接" : "Invalid link"}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "编辑" : "Edit"}
        title={med?.display_name ?? (locale === "zh" ? "修习" : "Practice")}
      />
      {med ? (
        <PracticeForm existing={med} />
      ) : (
        <Card className="p-5 text-sm text-ink-500">
          {locale === "zh" ? "加载中…" : "Loading…"}
        </Card>
      )}
    </div>
  );
}
