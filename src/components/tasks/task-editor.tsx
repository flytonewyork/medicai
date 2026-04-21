"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { useLocale } from "~/hooks/use-translate";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, TextInput, Textarea } from "~/components/ui/field";
import type {
  CyclePhaseKey,
  PatientTask,
  TaskCategory,
  TaskPriority,
  TaskScheduleKind,
} from "~/types/task";
import { Trash2 } from "lucide-react";

const CATEGORIES: TaskCategory[] = [
  "environmental",
  "household",
  "dental",
  "nutrition",
  "pharmacy",
  "physio",
  "clinical",
  "vaccine",
  "admin",
  "self_care",
  "other",
];

const PRIORITIES: TaskPriority[] = ["low", "normal", "high"];

const PHASES: CyclePhaseKey[] = [
  "pre_dose",
  "dose_day",
  "post_dose",
  "recovery_early",
  "nadir",
  "recovery_late",
  "rest",
];

interface Props {
  taskId?: number;
  presetId?: string;
}

export function TaskEditor({ taskId, presetId }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const existing = useLiveQuery(
    () => (taskId ? db.patient_tasks.get(taskId) : undefined),
    [taskId],
  );

  const [title, setTitle] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<TaskCategory>("self_care");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [scheduleKind, setScheduleKind] = useState<TaskScheduleKind>("once");
  const [dueDate, setDueDate] = useState(todayISO());
  const [interval, setInterval] = useState<number>(90);
  const [cycleDay, setCycleDay] = useState<number>(16);
  const [cyclePhase, setCyclePhase] = useState<CyclePhaseKey>("nadir");
  const [leadTime, setLeadTime] = useState<number>(7);
  const [surfaceDashboard, setSurfaceDashboard] = useState(true);
  const [surfaceDaily, setSurfaceDaily] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setTitleZh(existing.title_zh ?? "");
      setNotes(existing.notes ?? "");
      setCategory(existing.category);
      setPriority(existing.priority);
      setScheduleKind(existing.schedule_kind);
      setDueDate(existing.due_date ?? todayISO());
      setInterval(existing.recurrence_interval_days ?? 90);
      setCycleDay(existing.cycle_day ?? 16);
      setCyclePhase(existing.cycle_phase ?? "nadir");
      setLeadTime(existing.lead_time_days);
      setSurfaceDashboard(existing.surface_dashboard);
      setSurfaceDaily(existing.surface_daily);
    }
  }, [existing]);

  async function save() {
    setSaving(true);
    try {
      const ts = now();
      const payload: PatientTask = {
        title: title.trim(),
        title_zh: titleZh.trim() || undefined,
        notes: notes.trim() || undefined,
        category,
        priority,
        schedule_kind: scheduleKind,
        due_date:
          scheduleKind === "once" || scheduleKind === "recurring"
            ? dueDate
            : undefined,
        recurrence_interval_days:
          scheduleKind === "recurring" ? interval : undefined,
        cycle_day: scheduleKind === "cycle_day" ? cycleDay : undefined,
        cycle_phase:
          scheduleKind === "cycle_phase" ? cyclePhase : undefined,
        lead_time_days: leadTime,
        surface_dashboard: surfaceDashboard,
        surface_daily: surfaceDaily,
        active: true,
        preset_id: existing?.preset_id ?? presetId,
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      if (existing?.id) {
        await db.patient_tasks.put({ ...payload, id: existing.id });
      } else {
        await db.patient_tasks.add(payload);
      }
      router.push("/tasks");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing?.id) return;
    if (!confirm(locale === "zh" ? "删除这个任务？" : "Delete this task?")) return;
    await db.patient_tasks.delete(existing.id);
    router.push("/tasks");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "任务详情" : "Task details"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={locale === "zh" ? "标题" : "Title"}>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                locale === "zh"
                  ? "例如：更换空调滤网"
                  : "e.g. Change aircon filters"
              }
            />
          </Field>
          <Field label={locale === "zh" ? "标题（中文，可选）" : "Title (Chinese, optional)"}>
            <TextInput
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
            />
          </Field>
          <Field label={locale === "zh" ? "备注" : "Notes"}>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                locale === "zh"
                  ? "为何重要、注意事项、联系人…"
                  : "Why it matters, caveats, contact details…"
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={locale === "zh" ? "类别" : "Category"}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={locale === "zh" ? "优先级" : "Priority"}>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "什么时候？" : "When?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["once", locale === "zh" ? "一次" : "One-off"],
                ["recurring", locale === "zh" ? "定期" : "Recurring"],
                ["cycle_phase", locale === "zh" ? "周期阶段" : "Cycle phase"],
                ["cycle_day", locale === "zh" ? "周期日" : "Cycle day"],
              ] as [TaskScheduleKind, string][]
            ).map(([k, label]) => {
              const active = scheduleKind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setScheduleKind(k)}
                  className={
                    active
                      ? "rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>

          {scheduleKind === "once" && (
            <Field label={locale === "zh" ? "到期日" : "Due date"}>
              <TextInput
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          )}
          {scheduleKind === "recurring" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={locale === "zh" ? "首次到期" : "First due"}>
                <TextInput
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
              <Field label={locale === "zh" ? "每几天" : "Every N days"}>
                <TextInput
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value) || 0)}
                />
              </Field>
            </div>
          )}
          {scheduleKind === "cycle_day" && (
            <Field label={locale === "zh" ? "化疗周期日（1–28）" : "Cycle day (1–28)"}>
              <TextInput
                type="number"
                min={1}
                max={28}
                value={cycleDay}
                onChange={(e) => setCycleDay(Number(e.target.value) || 1)}
              />
            </Field>
          )}
          {scheduleKind === "cycle_phase" && (
            <Field label={locale === "zh" ? "周期阶段" : "Cycle phase"}>
              <select
                value={cyclePhase}
                onChange={(e) => setCyclePhase(e.target.value as CyclePhaseKey)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label={locale === "zh" ? "提前几天提醒" : "Lead time (days before due)"}
          >
            <TextInput
              type="number"
              min={0}
              value={leadTime}
              onChange={(e) => setLeadTime(Number(e.target.value) || 0)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "在哪里出现" : "Where to surface"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={surfaceDashboard}
              onChange={(e) => setSurfaceDashboard(e.target.checked)}
              className="h-4 w-4"
            />
            {locale === "zh" ? "在仪表板显示" : "Show on dashboard"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={surfaceDaily}
              onChange={(e) => setSurfaceDaily(e.target.checked)}
              className="h-4 w-4"
            />
            {locale === "zh" ? "在每日记录中显示" : "Show on daily check-in"}
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving || !title.trim()}>
            {locale === "zh" ? "保存" : "Save"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/tasks")}>
            {locale === "zh" ? "取消" : "Cancel"}
          </Button>
        </div>
        {existing?.id && (
          <Button variant="danger" size="sm" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" />
            {locale === "zh" ? "删除" : "Delete"}
          </Button>
        )}
      </div>
    </div>
  );
}
