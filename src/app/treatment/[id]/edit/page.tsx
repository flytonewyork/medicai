"use client";

import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { CycleForm, type CycleFormValues } from "~/components/treatment/cycle-form";

export default function EditCyclePage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const cycle = useLiveQuery(
    () => (Number.isFinite(id) ? db.treatment_cycles.get(id) : undefined),
    [id],
  );

  async function save(values: CycleFormValues) {
    if (!cycle?.id) return;
    await db.treatment_cycles.update(cycle.id, {
      ...values,
      updated_at: now(),
    });
    router.push(`/treatment/${cycle.id}`);
  }

  if (!cycle) {
    return <div className="p-6 text-sm text-ink-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "编辑周期" : "Edit cycle"}
        subtitle={
          locale === "zh"
            ? "调整方案、开始日期、剂量等级或状态。"
            : "Adjust protocol, start date, dose level, or status."
        }
      />

      <CycleForm
        initial={cycle}
        submitLabel={{ en: "Save changes", zh: "保存更改" }}
        onSubmit={save}
        onCancel={() => router.push(`/treatment/${cycle.id}`)}
      />
    </div>
  );
}
