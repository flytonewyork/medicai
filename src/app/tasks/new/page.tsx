"use client";

import { PageHeader } from "~/components/ui/page-header";
import { TaskEditor } from "~/components/tasks/task-editor";
import { useLocale } from "~/hooks/use-translate";

export default function NewTaskPage() {
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "新建任务" : "New task"}
        subtitle={
          locale === "zh"
            ? "任何与照护相关的事：环境维护、复查、补药、行政事项。"
            : "Anything care-adjacent: environmental upkeep, reviews, refills, admin."
        }
      />
      <TaskEditor />
    </div>
  );
}
