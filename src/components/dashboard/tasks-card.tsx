"use client";

import Link from "next/link";
import { useLocale } from "~/hooks/use-translate";
import {
  completeTaskFromInstance,
  snoozeTaskFromInstance,
  useTaskInstances,
} from "~/hooks/use-task-instances";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TaskRow } from "~/components/tasks/task-row";
import { Button } from "~/components/ui/button";
import { ListTodo, Sparkles, ChevronRight } from "lucide-react";

export function TasksCard() {
  const locale = useLocale();
  const instances = useTaskInstances();
  const actionable = instances.filter(
    (i) => i.task.surface_dashboard !== false && i.bucket !== "snoozed" && i.bucket !== "scheduled",
  );
  const top = actionable.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {locale === "zh" ? "待办" : "To do"}
          </CardTitle>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {locale === "zh" ? "全部" : "View all"}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {top.length === 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60">
            <ListTodo className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-slate-700 dark:text-slate-300">
                {locale === "zh"
                  ? "没有到期任务"
                  : "Nothing due right now"}
              </div>
              <div className="mt-0.5 text-xs">
                {locale === "zh"
                  ? "从建议中添加照护任务，它们会在相关时自动出现。"
                  : "Add care tasks from the suggestions — they surface automatically when relevant."}
              </div>
              <Link href="/tasks" className="mt-3 inline-block">
                <Button size="sm" variant="secondary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {locale === "zh" ? "建议任务" : "Suggested tasks"}
                </Button>
              </Link>
            </div>
          </div>
        )}
        <ul className="space-y-2">
          {top.map((inst) => (
            <li key={inst.task.id ?? inst.task.title}>
              <TaskRow
                instance={inst}
                onComplete={completeTaskFromInstance}
                onSnooze={snoozeTaskFromInstance}
                compact={false}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
