"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useActiveCycleContext } from "~/hooks/use-active-cycle";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  ensureCycleMedications,
  getActiveMedications,
} from "~/lib/medication/active";
import { syncCycleToCalendar } from "~/lib/treatment/calendar-sync";
import {
  compileTodayStatuses,
  logMedicationEvent,
} from "~/lib/medication/log";
import type { Medication, MedicationTodayStatus } from "~/types/medication";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import {
  Check,
  X,
  AlertCircle,
  Pill,
  ChevronRight,
  Pencil,
  Plus,
  ClipboardList,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

const COMMON_SIDE_EFFECTS = [
  { id: "nausea", en: "Nausea", zh: "恶心" },
  { id: "fatigue", en: "Fatigue", zh: "疲劳" },
  { id: "diarrhea", en: "Diarrhea", zh: "腹泻" },
  { id: "constipation", en: "Constipation", zh: "便秘" },
  { id: "headache", en: "Headache", zh: "头痛" },
  { id: "dizziness", en: "Dizziness", zh: "头晕" },
  { id: "neuropathy", en: "Tingling / numbness", zh: "刺痛 / 麻木" },
  { id: "rash", en: "Rash / itching", zh: "皮疹 / 瘙痒" },
  { id: "insomnia", en: "Insomnia", zh: "失眠" },
];

export default function MedicationLogPage() {
  const locale = useLocale();
  const router = useRouter();
  const ctx = useActiveCycleContext();
  const cycleId = ctx?.cycle.id;
  const cycleDay = ctx?.cycle_day;
  const [statuses, setStatuses] = useState<MedicationTodayStatus[]>([]);
  const [sheetFor, setSheetFor] = useState<Medication | null>(null);

  // Auto-seed protocol-derived meds + calendar events when a cycle is active.
  useEffect(() => {
    if (ctx?.cycle) {
      void ensureCycleMedications(ctx.cycle);
      void syncCycleToCalendar(ctx.cycle);
    }
  }, [ctx?.cycle]);

  // Reactive reload of today's statuses whenever events change
  const allEvents = useLiveQuery(() => db.medication_events.toArray(), []);
  useEffect(() => {
    void (async () => {
      const meds = await getActiveMedications(cycleId);
      const s = await compileTodayStatuses(meds, cycleDay);
      setStatuses(s);
    })();
  }, [cycleId, cycleDay, allEvents?.length]);

  const dueNow = useMemo(
    () => statuses.filter((s) => s.is_due_now),
    [statuses],
  );
  const otherActive = useMemo(
    () => statuses.filter((s) => !s.is_due_now),
    [statuses],
  );

  const handleQuickLog = async (
    med: Medication,
    event_type: "taken" | "missed",
  ) => {
    await logMedicationEvent({
      medication: med,
      event_type,
      source: "quick_log",
    });
  };

  const cycleLabel = ctx
    ? locale === "zh"
      ? `周期 ${ctx.cycle.cycle_number} · 第 ${cycleDay} 天 · ${ctx.protocol.short_name}`
      : `Cycle ${ctx.cycle.cycle_number} · Day ${cycleDay} · ${ctx.protocol.short_name}`
    : locale === "zh"
      ? "当前无活动治疗周期"
      : "No active treatment cycle";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "今日用药记录" : "Today's medication log"}
        subtitle={cycleLabel}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/prescriptions">
              <Button size="sm" variant="secondary">
                <ClipboardList className="h-3.5 w-3.5" />
                {locale === "zh" ? "管理处方" : "Prescriptions"}
              </Button>
            </Link>
            <Link href="/prescriptions">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" />
                {locale === "zh" ? "添加" : "Add"}
              </Button>
            </Link>
          </div>
        }
      />

      {!ctx && statuses.length === 0 && (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-ink-500">
            <div>
              {locale === "zh"
                ? "当前没有活动处方。开始一个治疗周期会自动填充药物，或你也可以手动添加。"
                : "No active prescriptions yet. Start a treatment cycle to auto-populate, or add one manually."}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/treatment/new">
                <Button variant="secondary" size="sm">
                  {locale === "zh" ? "开始新周期" : "Start a cycle"}
                </Button>
              </Link>
              <Link href="/prescriptions">
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  {locale === "zh" ? "添加处方" : "Add prescription"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {ctx && dueNow.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-500">
            <AlertCircle className="h-4 w-4" />
            {locale === "zh" ? "待服药" : "Due now"}
          </h2>
          <div className="space-y-2">
            {dueNow.map((s) => (
              <MedRow
                key={s.medication.id}
                status={s}
                locale={locale}
                onTaken={() => handleQuickLog(s.medication, "taken")}
                onMissed={() => handleQuickLog(s.medication, "missed")}
                onDetails={() => setSheetFor(s.medication)}
              />
            ))}
          </div>
        </section>
      )}

      {ctx && otherActive.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
            {locale === "zh" ? "其他活动药物" : "Other active medications"}
          </h2>
          <div className="space-y-2">
            {otherActive.map((s) => (
              <MedRow
                key={s.medication.id}
                status={s}
                locale={locale}
                onTaken={() => handleQuickLog(s.medication, "taken")}
                onMissed={() => handleQuickLog(s.medication, "missed")}
                onDetails={() => setSheetFor(s.medication)}
              />
            ))}
          </div>
        </section>
      )}

      {ctx && statuses.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-ink-500">
            {locale === "zh"
              ? "没有找到药物。正在从方案中填充 …"
              : "No medications registered yet. Protocol-derived meds are being seeded…"}
          </CardContent>
        </Card>
      )}

      {sheetFor && (
        <SideEffectSheet
          medication={sheetFor}
          locale={locale}
          onClose={() => setSheetFor(null)}
        />
      )}

      {statuses.length > 0 && (
        <div className="sticky bottom-24 flex items-center justify-end gap-2 pt-2 md:bottom-6">
          <Button variant="ghost" onClick={() => router.push("/prescriptions")}>
            {locale === "zh" ? "修改处方" : "Edit prescriptions"}
          </Button>
          <Button onClick={() => router.push("/")}>
            <Check className="h-4 w-4" />
            {locale === "zh" ? "完成" : "Save & close"}
          </Button>
        </div>
      )}
    </div>
  );
}

function MedRow({
  status,
  locale,
  onTaken,
  onMissed,
  onDetails,
}: {
  status: MedicationTodayStatus;
  locale: "en" | "zh";
  onTaken: () => void;
  onMissed: () => void;
  onDetails: () => void;
}) {
  const { medication, drug_name_en, drug_name_zh, due_count, logged_count } =
    status;
  const name = locale === "zh" ? drug_name_zh : drug_name_en;
  const allLogged = due_count > 0 && logged_count >= due_count;

  return (
    <Card
      className={cn(
        "transition-colors",
        allLogged && "bg-paper-1 opacity-80",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-1 items-center gap-3">
          <Pill className="h-5 w-5 text-ink-400" />
          <div className="flex-1">
            <div className="font-medium text-ink-900">{name}</div>
            <div className="text-xs text-ink-500">
              {medication.dose}
              {due_count > 0 && (
                <>
                  {" · "}
                  <span
                    className={cn(
                      logged_count >= due_count
                        ? "text-green-600"
                        : "text-ink-600",
                    )}
                  >
                    {locale === "zh"
                      ? `今日 ${logged_count}/${due_count}`
                      : `${logged_count}/${due_count} logged today`}
                  </span>
                </>
              )}
              {due_count === 0 && (
                <> · {locale === "zh" ? "按需" : "as needed"}</>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onTaken}
            size="sm"
            variant={allLogged ? "ghost" : "primary"}
            className="gap-1"
          >
            <Check className="h-3.5 w-3.5" />
            {locale === "zh" ? "已服" : "Taken"}
          </Button>
          <Button
            onClick={onMissed}
            size="sm"
            variant="secondary"
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" />
            {locale === "zh" ? "漏服" : "Missed"}
          </Button>
          <Link
            href="/prescriptions"
            aria-label={locale === "zh" ? "编辑处方" : "Edit prescription"}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-ink-400 hover:text-ink-900"
            title={locale === "zh" ? "修改剂量或停用" : "Change dose or stop"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <Button
            onClick={onDetails}
            size="sm"
            variant="ghost"
            className="gap-1"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SideEffectSheet({
  medication,
  locale,
  onClose,
}: {
  medication: Medication;
  locale: "en" | "zh";
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [note, setNote] = useState("");
  const drug = DRUGS_BY_ID[medication.drug_id];

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const submit = async () => {
    const hasSelections = selected.size > 0 || note.trim().length > 0;
    await logMedicationEvent({
      medication,
      event_type: hasSelections ? "side_effect_only" : "taken",
      side_effects: selected.size > 0 ? Array.from(selected) : undefined,
      side_effect_severity: selected.size > 0 ? severity : undefined,
      note: note.trim() || undefined,
      source: "quick_log",
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-paper p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="serif text-lg text-ink-900">
            {locale === "zh"
              ? drug?.name.zh ?? medication.display_name
              : drug?.name.en ?? medication.display_name}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mb-3 text-xs text-ink-500">
          {locale === "zh"
            ? "如有不良反应，请勾选。这会记录带注释的用药事件。"
            : "Tick any side effects you're experiencing. This logs an annotated medication event."}
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {COMMON_SIDE_EFFECTS.map((se) => (
            <button
              key={se.id}
              type="button"
              onClick={() => toggle(se.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                selected.has(se.id)
                  ? "border-[var(--warn)] bg-[var(--warn)]/10 text-[var(--warn)]"
                  : "border-ink-200 text-ink-600 hover:border-ink-300",
              )}
            >
              {locale === "zh" ? se.zh : se.en}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium text-ink-600">
              {locale === "zh" ? "严重度" : "Severity"}
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeverity(n as 1 | 2 | 3 | 4 | 5)}
                  className={cn(
                    "h-9 flex-1 rounded border text-sm transition-colors",
                    severity === n
                      ? "border-ink-900 bg-ink-900 text-paper"
                      : "border-ink-200 text-ink-600",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={locale === "zh" ? "备注（可选）" : "Note (optional)"}
          className="mb-4 w-full rounded border border-ink-200 bg-paper-1 p-2 text-sm"
          rows={2}
        />

        <div className="flex gap-2">
          <Button onClick={submit} className="flex-1">
            {locale === "zh" ? "记录" : "Log"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {locale === "zh" ? "取消" : "Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}
