"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "~/components/ui/page-header";
import { TaskEditor } from "~/components/tasks/task-editor";
import { useLocale } from "~/hooks/use-translate";

export default function EditTaskPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  if (!Number.isFinite(id)) {
    return (
      <div className="p-6 text-sm text-[var(--warn)]">Invalid id.</div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <PageHeader title={locale === "zh" ? "编辑任务" : "Edit task"} />
      <TaskEditor taskId={id} />
    </div>
  );
}
