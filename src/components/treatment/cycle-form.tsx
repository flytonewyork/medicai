"use client";

import { useState } from "react";
import { useLocale } from "~/hooks/use-translate";
import { todayISO } from "~/lib/utils/date";
import { PROTOCOL_LIBRARY } from "~/config/protocols";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import { cn } from "~/lib/utils/cn";
import type { CycleStatus, ProtocolId, TreatmentCycle } from "~/types/treatment";
import type { LocalizedText } from "~/types/localized";

export interface CycleFormValues {
  protocol_id: ProtocolId;
  cycle_number: number;
  start_date: string;
  status: CycleStatus;
  dose_level: number;
  notes?: string;
  actual_end_date?: string;
}

const STATUSES: CycleStatus[] = [
  "planned",
  "active",
  "completed",
  "delayed",
  "cancelled",
];

const STATUS_LABEL: Record<CycleStatus, LocalizedText> = {
  planned: { en: "Planned", zh: "已计划" },
  active: { en: "Active", zh: "进行中" },
  completed: { en: "Completed", zh: "已完成" },
  delayed: { en: "Delayed", zh: "延迟" },
  cancelled: { en: "Cancelled", zh: "已取消" },
};

export function CycleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: TreatmentCycle;
  submitLabel: LocalizedText;
  onSubmit: (values: CycleFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const locale = useLocale();

  const [protocolId, setProtocolId] = useState<ProtocolId>(
    initial?.protocol_id ?? "gnp_weekly",
  );
  const [cycleNumber, setCycleNumber] = useState<number>(
    initial?.cycle_number ?? 1,
  );
  const [startDate, setStartDate] = useState<string>(
    initial?.start_date ?? todayISO(),
  );
  const [status, setStatus] = useState<CycleStatus>(initial?.status ?? "active");
  const [doseLevel, setDoseLevel] = useState<number>(initial?.dose_level ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [actualEnd, setActualEnd] = useState<string>(
    initial?.actual_end_date ?? "",
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({
        protocol_id: protocolId,
        cycle_number: cycleNumber,
        start_date: startDate,
        status,
        dose_level: doseLevel,
        notes: notes.trim() ? notes.trim() : undefined,
        actual_end_date:
          status === "completed" && actualEnd ? actualEnd : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{locale === "zh" ? "方案" : "Protocol"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PROTOCOL_LIBRARY.map((p) => {
            const active = protocolId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProtocolId(p.id)}
                className={cn(
                  "flex w-full flex-col items-start rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper-2 hover:border-ink-400",
                )}
                aria-pressed={active}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {p.name[locale]}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px]",
                      active
                        ? "bg-paper/20 text-paper"
                        : "bg-ink-100 text-ink-600",
                    )}
                  >
                    {p.cycle_length_days}d · dose D{p.dose_days.join(", D")}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    active ? "text-ink-200" : "text-ink-500",
                  )}
                >
                  {p.description[locale]}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "周期信息" : "Cycle details"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label={locale === "zh" ? "周期编号" : "Cycle number"}>
            <TextInput
              type="number"
              min={1}
              value={cycleNumber}
              onChange={(e) => setCycleNumber(Number(e.target.value))}
            />
          </Field>
          <Field label={locale === "zh" ? "开始日期 (D1)" : "Start date (D1)"}>
            <TextInput
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label={locale === "zh" ? "状态" : "Status"}>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CycleStatus)}
              className="h-10 w-full rounded-md border border-ink-200 bg-paper-2 px-3 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s][locale]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={
              locale === "zh"
                ? "减量等级 (0 = 全剂量)"
                : "Dose level (0 = full)"
            }
            hint={
              locale === "zh"
                ? "每级 -1 约减 20%"
                : "Each level = ~20% reduction"
            }
          >
            <TextInput
              type="number"
              max={0}
              min={-4}
              value={doseLevel}
              onChange={(e) => setDoseLevel(Number(e.target.value))}
            />
          </Field>
          {status === "completed" && (
            <Field
              label={
                locale === "zh" ? "实际结束日期" : "Actual end date"
              }
            >
              <TextInput
                type="date"
                value={actualEnd}
                onChange={(e) => setActualEnd(e.target.value)}
              />
            </Field>
          )}
          <Field
            label={locale === "zh" ? "备注" : "Notes"}
            className={status === "completed" ? "" : "sm:col-span-2"}
          >
            <TextInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                locale === "zh"
                  ? "例如：减量 nab-P，因 CIPN"
                  : "e.g. nab-P reduced for CIPN"
              }
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            {locale === "zh" ? "取消" : "Cancel"}
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={saving} size="lg">
          {saving
            ? locale === "zh"
              ? "保存中…"
              : "Saving…"
            : submitLabel[locale]}
        </Button>
      </div>
    </div>
  );
}
