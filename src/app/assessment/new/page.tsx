"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { TestListBuilder } from "~/components/assessment/test-list-builder";
import {
  HelperKickoff,
  type HelperKickoffValue,
} from "~/components/assessment/helper-kickoff";
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

  const [helper, setHelper] = useState<HelperKickoffValue>({
    helper_role: "self",
  });

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
      helper_role: helper.helper_role,
      helper_name: helper.helper_name?.trim() || undefined,
      helper_notes: helper.helper_notes?.trim() || undefined,
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
        title={locale === "zh" ? "开始一次综合评估" : "Start a comprehensive assessment"}
        subtitle={
          locale === "zh"
            ? "先记录今天是谁带做、有哪些器材，再选择测试组合。每一步都内置说明、计时器和可跳过按钮。"
            : "Record who's running it today and what equipment is on hand, then pick the tests. Every step ships with its own instructions, timer, and skip option."
        }
      />

      <Card>
        <CardContent className="pt-5">
          <HelperKickoff value={helper} onChange={setHelper} />
        </CardContent>
      </Card>

      <TestListBuilder onStart={(ids) => void start(ids)} />
    </div>
  );
}
