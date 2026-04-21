"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "~/components/ui/page-header";
import { AssessmentWizard } from "~/components/assessment/wizard";
import { useLocale } from "~/hooks/use-translate";

export default function RunAssessmentPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  if (!Number.isFinite(id)) {
    return <div className="p-6 text-sm text-red-700">Invalid id.</div>;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "综合评估" : "Comprehensive assessment"}
        subtitle={
          locale === "zh"
            ? "每步都可以跳过、删除，或问 AI 教练。"
            : "Skip, remove, or ask the AI coach on any step."
        }
      />
      <AssessmentWizard assessmentId={id} />
    </div>
  );
}
