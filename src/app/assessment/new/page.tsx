"use client";

import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { PageHeader } from "~/components/ui/page-header";
import { TestListBuilder } from "~/components/assessment/test-list-builder";
import { todayISO } from "~/lib/utils/date";
import { useLocale } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import type {
  ComprehensiveAssessment,
  ComprehensiveAssessmentTrigger,
} from "~/types/clinical";

export default function NewAssessmentPage() {
  const locale = useLocale();
  const router = useRouter();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const assessments = useLiveQuery(() =>
    db.comprehensive_assessments.toArray(),
  );
  const hasAny = (assessments ?? []).some((a) => a.status === "complete");

  async function start(testIds: string[]) {
    const trigger: ComprehensiveAssessmentTrigger = hasAny
      ? "ad_hoc"
      : "baseline";
    const record: ComprehensiveAssessment = {
      assessment_date: todayISO(),
      started_at: now(),
      status: "draft",
      trigger,
      entered_by: enteredBy,
      tests_included: testIds,
      tests_completed: [],
      tests_skipped: [],
      created_at: now(),
      updated_at: now(),
    };
    const id = (await db.comprehensive_assessments.add(record)) as number;
    router.push(`/assessment/run/${id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "定制测试列表" : "Build your test list"}
        subtitle={
          locale === "zh"
            ? "挑选一个预设或自行挑选。流程中随时可以跳过或删除测试。"
            : "Pick a preset or customise. You can still skip or remove any test mid-flow."
        }
      />
      <TestListBuilder onStart={(ids) => void start(ids)} />
    </div>
  );
}
