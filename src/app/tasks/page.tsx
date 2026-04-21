"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { TaskRow } from "~/components/tasks/task-row";
import { PresetPicker } from "~/components/tasks/preset-picker";
import {
  completeTaskFromInstance,
  snoozeTaskFromInstance,
  useTaskInstances,
} from "~/hooks/use-task-instances";
import { Plus, Sparkles, ListTodo } from "lucide-react";

export default function TasksPage() {
  const t = useT();
  const locale = useLocale();
  const instances = useTaskInstances();
  const [showPresets, setShowPresets] = useState(false);

  const grouped = useMemo(() => {
    const buckets: Record<string, typeof instances> = {
      overdue: [],
      due_today: [],
      cycle_relevant: [],
      approaching: [],
      scheduled: [],
      snoozed: [],
    };
    for (const i of instances) {
      (buckets[i.bucket] ??= []).push(i);
    }
    return buckets;
  }, [instances]);

  const sectionOrder: [
    string,
    { en: string; zh: string },
  ][] = [
    ["overdue", { en: "Overdue", zh: "已超期" }],
    ["due_today", { en: "Due today", zh: "今日到期" }],
    ["cycle_relevant", { en: "Relevant now (cycle)", zh: "当前相关（周期）" }],
    ["approaching", { en: "Approaching", zh: "即将到期" }],
    ["scheduled", { en: "Scheduled", zh: "已排期" }],
    ["snoozed", { en: "Snoozed", zh: "已暂缓" }],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={t("nav.tasks")}
        subtitle={
          locale === "zh"
            ? "自定义提醒与行动。与化疗周期挂钩的任务在相关时间自动出现。"
            : "Custom reminders and actions. Cycle-linked tasks surface when they matter."
        }
        action={
          <div className="flex gap-2">
            <Link href="/tasks/new">
              <Button>
                <Plus className="h-4 w-4" />
                {locale === "zh" ? "新建" : "New task"}
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => setShowPresets((v) => !v)}
            >
              <Sparkles className="h-4 w-4" />
              {showPresets
                ? locale === "zh"
                  ? "隐藏建议"
                  : "Hide suggestions"
                : locale === "zh"
                  ? "建议任务"
                  : "Suggested tasks"}
            </Button>
          </div>
        }
      />

      {showPresets && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 text-sm text-slate-500">
              {locale === "zh"
                ? "从常见的照护任务中挑选 —— 一点即添加。"
                : "Add common care tasks in one click. You can edit any after adding."}
            </div>
            <PresetPicker />
          </CardContent>
        </Card>
      )}

      {instances.length === 0 && !showPresets && (
        <Card className="p-10 text-center">
          <ListTodo className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <div className="text-sm font-medium">
            {locale === "zh" ? "还没有任务" : "No tasks yet"}
          </div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {locale === "zh"
              ? "从建议列表添加，或自己写一个。"
              : "Start from a suggestion or write your own."}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button onClick={() => setShowPresets(true)}>
              <Sparkles className="h-4 w-4" />
              {locale === "zh" ? "建议任务" : "Suggestions"}
            </Button>
            <Link href="/tasks/new">
              <Button variant="secondary">
                <Plus className="h-4 w-4" />
                {locale === "zh" ? "新建" : "New"}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {sectionOrder.map(([key, label]) => {
        const items = grouped[key] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={key} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label[locale]} · {items.length}
            </h2>
            <ul className="space-y-2">
              {items.map((inst) => (
                <li key={inst.task.id ?? inst.task.title}>
                  <TaskRow
                    instance={inst}
                    onComplete={completeTaskFromInstance}
                    onSnooze={snoozeTaskFromInstance}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
