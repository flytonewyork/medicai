"use client";

import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { todayISO } from "~/lib/utils/date";
import { PageHeader } from "~/components/ui/page-header";
import { CycleForm, type CycleFormValues } from "~/components/treatment/cycle-form";

export default function NewTreatmentCyclePage() {
  const locale = useLocale();
  const router = useRouter();

  const prior = useLiveQuery(() =>
    db.treatment_cycles.orderBy("cycle_number").reverse().limit(1).first(),
  );
  const nextNumber = (prior?.cycle_number ?? 0) + 1;

  async function save(values: CycleFormValues) {
    const id = await db.treatment_cycles.add({
      ...values,
      created_at: now(),
      updated_at: now(),
    });
    router.push(`/treatment/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "开始新周期" : "Start new cycle"}
        subtitle={
          locale === "zh"
            ? "挑方案 → 填开始日期 → Anchor 按日期给出提示。"
            : "Pick a protocol → set the start date → Anchor surfaces day-specific nudges."
        }
      />

      <CycleForm
        initial={{
          protocol_id: "gnp_weekly",
          cycle_number: nextNumber,
          start_date: todayISO(),
          status: "active",
          dose_level: 0,
          created_at: now(),
          updated_at: now(),
        }}
        submitLabel={{
          en: "Save and activate",
          zh: "保存并开始",
        }}
        onSubmit={save}
        onCancel={() => router.push("/treatment")}
      />
    </div>
  );
}
