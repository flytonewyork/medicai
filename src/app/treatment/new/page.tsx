"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { PROTOCOL_LIBRARY } from "~/config/protocols";
import { useLocale } from "~/hooks/use-translate";
import { todayISO } from "~/lib/utils/date";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import { cn } from "~/lib/utils/cn";
import type { ProtocolId } from "~/types/treatment";

export default function NewTreatmentCyclePage() {
  const locale = useLocale();
  const router = useRouter();

  const prior = useLiveQuery(() =>
    db.treatment_cycles.orderBy("cycle_number").reverse().limit(1).first(),
  );
  const nextNumber = (prior?.cycle_number ?? 0) + 1;

  const [protocolId, setProtocolId] = useState<ProtocolId>("gnp_weekly");
  const [startDate, setStartDate] = useState<string>(todayISO());
  const [cycleNumber, setCycleNumber] = useState<number>(nextNumber);
  const [doseLevel, setDoseLevel] = useState<number>(0);
  const [notes, setNotes] = useState("");

  async function save() {
    const id = await db.treatment_cycles.add({
      protocol_id: protocolId,
      cycle_number: cycleNumber,
      start_date: startDate,
      status: "active",
      dose_level: doseLevel,
      notes: notes || undefined,
      created_at: now(),
      updated_at: now(),
    });
    router.push(`/treatment/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "开始新周期" : "Start new cycle"}
        subtitle={
          locale === "zh"
            ? "挑方案 → 填开始日期 → Anchor 按日期给出提示。"
            : "Pick a protocol → set the start date → Anchor surfaces day-specific nudges."
        }
      />

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
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 bg-white hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600",
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
                        ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                    )}
                  >
                    {p.cycle_length_days}d · dose D{p.dose_days.join(", D")}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    active
                      ? "text-slate-200 dark:text-slate-700"
                      : "text-slate-500",
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
          <CardTitle>{locale === "zh" ? "周期信息" : "Cycle details"}</CardTitle>
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
          <Field label={locale === "zh" ? "备注" : "Notes"}>
            <TextInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                locale === "zh"
                  ? "e.g. 减量 nab-P，因 CIPN"
                  : "e.g. nab-P reduced for CIPN"
              }
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} size="lg">
          {locale === "zh" ? "保存并开始" : "Save and activate"}
        </Button>
      </div>
    </div>
  );
}
