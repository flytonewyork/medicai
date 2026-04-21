"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { addDays, parseISO } from "date-fns";
import { TASK_PRESETS } from "~/config/task-presets";
import type { PatientTask, TaskPreset } from "~/types/task";
import { todayISO } from "~/lib/utils/date";
import { cn } from "~/lib/utils/cn";
import { Card, CardContent } from "~/components/ui/card";
import { Plus, Check } from "lucide-react";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function PresetPicker() {
  const locale = useLocale();
  const existing = useLiveQuery(() => db.patient_tasks.toArray());
  const existingPresetIds = new Set(
    (existing ?? []).map((t) => t.preset_id).filter((id): id is string => !!id),
  );

  async function add(preset: TaskPreset) {
    const ts = now();
    const base: PatientTask = {
      title: preset.title.en,
      title_zh: preset.title.zh,
      notes: preset.rationale.en,
      category: preset.category,
      priority: preset.priority,
      schedule_kind: preset.schedule_kind,
      lead_time_days: preset.lead_time_days,
      surface_dashboard: true,
      surface_daily: false,
      active: true,
      preset_id: preset.id,
      created_at: ts,
      updated_at: ts,
    };
    if (preset.schedule_kind === "recurring") {
      base.recurrence_interval_days = preset.recurrence_interval_days;
      base.due_date = toISODate(
        addDays(parseISO(todayISO()), preset.default_due_offset_days ?? 0),
      );
    } else if (preset.schedule_kind === "once") {
      base.due_date = toISODate(
        addDays(parseISO(todayISO()), preset.default_due_offset_days ?? 7),
      );
    } else if (preset.schedule_kind === "cycle_day") {
      base.cycle_day = preset.cycle_day;
    } else if (preset.schedule_kind === "cycle_phase") {
      base.cycle_phase = preset.cycle_phase;
    }
    await db.patient_tasks.add(base);
  }

  const byCategory = TASK_PRESETS.reduce<Record<string, TaskPreset[]>>(
    (acc, p) => {
      (acc[p.category] ??= []).push(p);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      {Object.entries(byCategory).map(([cat, items]) => (
        <section key={cat}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {cat.replace("_", " ")}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((p) => {
              const added = existingPresetIds.has(p.id);
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "transition-colors",
                    added && "opacity-60",
                  )}
                >
                  <CardContent className="flex items-start justify-between gap-3 pt-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {p.title[locale]}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {p.rationale[locale]}
                      </div>
                      <div className="mt-2 text-[11px] text-slate-400">
                        {p.schedule_kind === "recurring" &&
                          p.recurrence_interval_days &&
                          (locale === "zh"
                            ? `每 ${p.recurrence_interval_days} 天`
                            : `every ${p.recurrence_interval_days}d`)}
                        {p.schedule_kind === "cycle_phase" &&
                          ` · ${p.cycle_phase}`}
                        {p.schedule_kind === "cycle_day" &&
                          ` · ${locale === "zh" ? "周期日" : "day"} ${p.cycle_day}`}
                        {" · "}
                        {p.priority}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!added) void add(p);
                      }}
                      disabled={added}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                        added
                          ? "border-emerald-500 text-emerald-600"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900",
                      )}
                      aria-label={added ? "added" : "add"}
                    >
                      {added ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
