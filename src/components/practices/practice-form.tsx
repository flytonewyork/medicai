"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput, Textarea } from "~/components/ui/field";
import { useLocale } from "~/hooks/use-translate";
import {
  createCustomPractice,
  updateCustomPractice,
  type CustomPracticeInput,
} from "~/lib/medication/practices";
import type { Medication, ScheduleKind } from "~/types/medication";
import { todayISO } from "~/lib/utils/date";
import { cn } from "~/lib/utils/cn";

type Cadence = "daily" | "multiple_daily" | "mwf" | "weekdays" | "as_needed";

const CADENCES: { key: Cadence; en: string; zh: string; hint: string }[] = [
  {
    key: "daily",
    en: "Once daily",
    zh: "每日一次",
    hint: "e.g. morning breathing, evening meditation",
  },
  {
    key: "multiple_daily",
    en: "Multiple times daily",
    zh: "每日多次",
    hint: "e.g. 4 × breathing breaks",
  },
  {
    key: "mwf",
    en: "Mon / Wed / Fri",
    zh: "周一 / 三 / 五",
    hint: "resistance training on recovery days",
  },
  {
    key: "weekdays",
    en: "Weekdays",
    zh: "工作日",
    hint: "structured weekday routine",
  },
  {
    key: "as_needed",
    en: "As needed",
    zh: "按需",
    hint: "not scheduled — log whenever you do it",
  },
];

interface FormState {
  name: string;
  duration: string;
  cadence: Cadence;
  times_per_day: string;
  clock_time: string;
  notes: string;
}

function cadenceToSchedule(form: FormState): {
  kind: ScheduleKind;
  times_per_day?: number;
  clock_times?: string[];
  rrule?: string;
} {
  switch (form.cadence) {
    case "daily":
      return {
        kind: "fixed",
        times_per_day: 1,
        clock_times: form.clock_time ? [form.clock_time] : undefined,
      };
    case "multiple_daily":
      return {
        kind: "fixed",
        times_per_day: Number(form.times_per_day) || 2,
      };
    case "mwf":
      return { kind: "custom", rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" };
    case "weekdays":
      return { kind: "custom", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" };
    case "as_needed":
      return { kind: "prn" };
  }
}

function scheduleToFormCadence(med?: Medication): FormState["cadence"] {
  if (!med) return "daily";
  const s = med.schedule;
  if (s.kind === "prn") return "as_needed";
  if (s.kind === "custom" && s.rrule) {
    if (s.rrule.includes("BYDAY=MO,WE,FR")) return "mwf";
    if (s.rrule.includes("BYDAY=MO,TU,WE,TH,FR")) return "weekdays";
  }
  if (s.kind === "fixed" || s.kind === "with_meals") {
    if ((s.times_per_day ?? 1) > 1) return "multiple_daily";
    return "daily";
  }
  return "daily";
}

export function PracticeForm({ existing }: { existing?: Medication }) {
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    duration: "",
    cadence: "daily",
    times_per_day: "2",
    clock_time: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.display_name ?? "",
      duration: existing.dose ?? "",
      cadence: scheduleToFormCadence(existing),
      times_per_day: String(existing.schedule.times_per_day ?? 2),
      clock_time: existing.schedule.clock_times?.[0] ?? "",
      notes: existing.notes ?? "",
    });
  }, [existing]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const canSave = form.name.trim().length > 0 && form.duration.trim().length > 0;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const schedule = cadenceToSchedule(form);
      const input: CustomPracticeInput = {
        name: form.name.trim(),
        duration: form.duration.trim(),
        schedule_kind: schedule.kind,
        times_per_day: schedule.times_per_day,
        clock_times: schedule.clock_times,
        rrule: schedule.rrule,
        notes: form.notes.trim() || undefined,
        started_on: existing?.started_on ?? todayISO(),
      };
      if (existing?.id) {
        await updateCustomPractice(existing.id, input);
      } else {
        await createCustomPractice(input);
      }
      router.push("/practices");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <Field label={locale === "zh" ? "名称" : "Name"}>
          <TextInput
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder={
              locale === "zh"
                ? "例如：晨间呼吸"
                : "e.g. Morning breathing"
            }
            autoFocus
          />
        </Field>
        <Field
          label={locale === "zh" ? "单次时长 / 次数" : "Duration / dose"}
          hint={
            locale === "zh"
              ? "例如：10 分钟、20 次呼吸、3 组"
              : "e.g. 10 min, 20 breaths, 3 sets"
          }
        >
          <TextInput
            value={form.duration}
            onChange={(e) => update("duration", e.target.value)}
            placeholder={locale === "zh" ? "10 分钟" : "10 min"}
          />
        </Field>

        <Field
          label={locale === "zh" ? "频率" : "How often"}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CADENCES.map((c) => {
              const active = form.cadence === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => update("cadence", c.key)}
                  className={cn(
                    "rounded-[var(--r-md)] border p-3 text-left transition-colors",
                    active
                      ? "border-ink-900 bg-ink-900 text-paper"
                      : "border-ink-200 bg-paper-2 text-ink-700 hover:border-ink-400",
                  )}
                >
                  <div className="text-[13px] font-medium">
                    {locale === "zh" ? c.zh : c.en}
                  </div>
                  <div
                    className={cn(
                      "text-[11px]",
                      active ? "text-paper/80" : "text-ink-500",
                    )}
                  >
                    {c.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </Field>

        {form.cadence === "daily" && (
          <Field
            label={
              locale === "zh" ? "时间（可选）" : "Clock time (optional)"
            }
          >
            <TextInput
              type="time"
              value={form.clock_time}
              onChange={(e) => update("clock_time", e.target.value)}
            />
          </Field>
        )}
        {form.cadence === "multiple_daily" && (
          <Field label={locale === "zh" ? "每日次数" : "Times per day"}>
            <TextInput
              type="number"
              min={1}
              max={12}
              step={1}
              value={form.times_per_day}
              onChange={(e) => update("times_per_day", e.target.value)}
            />
          </Field>
        )}

        <Field
          label={locale === "zh" ? "笔记（可选）" : "Notes (optional)"}
        >
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder={
              locale === "zh"
                ? "任何具体形式、目标或提醒"
                : "Any specifics, goals, or reminders"
            }
          />
        </Field>
      </Card>

      <CardContent className="flex items-center justify-end gap-2 p-0">
        <Button variant="ghost" onClick={() => router.back()}>
          {locale === "zh" ? "取消" : "Cancel"}
        </Button>
        <Button onClick={() => void save()} disabled={!canSave || saving}>
          {saving
            ? locale === "zh"
              ? "保存中…"
              : "Saving…"
            : locale === "zh"
              ? "保存"
              : "Save"}
        </Button>
      </CardContent>
    </div>
  );
}
