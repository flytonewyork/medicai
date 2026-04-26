"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale, useL } from "~/hooks/use-translate";
import { todayISO } from "~/lib/utils/date";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import { cn } from "~/lib/utils/cn";
import { PROTOCOL_LIBRARY, PROTOCOL_BY_ID } from "~/config/protocols";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import { deriveCycleAppointments } from "~/lib/treatment/calendar-sync";
import type {
  CycleStatus,
  ProtocolId,
  TreatmentCycle,
} from "~/types/treatment";
import type {
  DoseSchedule,
  Medication,
  MedicationCategory,
} from "~/types/medication";
import type { Appointment } from "~/types/appointment";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

// Three-step wizard for setting up a chemo cycle. Replaces the previous
// one-shot CycleForm so the patient (or carer) can preview every linked
// record (chemo-day appointments, protocol agents, supportive meds) and
// switch them on/off before anything is written. Save commits the cycle,
// the selected appointments, and the selected medications atomically. The
// existing /prescriptions review screen still loads after save for any
// further dose / schedule fine-tuning.

const SUPPORTIVE_TO_DRUG: Record<string, string> = {
  "supportive.gcsf_prophylaxis": "pegfilgrastim",
  "supportive.olanzapine": "olanzapine",
  "supportive.duloxetine": "duloxetine",
  "supportive.pert": "pancrelipase",
  "supportive.vte_prophylaxis": "apixaban",
};

type Step = 1 | 2 | 3;

interface WizardState {
  protocol_id: ProtocolId;
  cycle_number: number;
  start_date: string;
  status: CycleStatus;
  dose_level: number;
  // Logistics
  default_start_time: string;
  default_duration_min: number;
  location: string;
  notes: string;
  // Selection (step 3 toggles)
  excluded_dose_days: Set<number>;
  excluded_agent_ids: Set<string>;
  excluded_supportive_ids: Set<string>;
}

export default function NewTreatmentCyclePage() {
  const locale = useLocale();
  const router = useRouter();
  const L = useL();

  const prior = useLiveQuery(() =>
    db.treatment_cycles.orderBy("cycle_number").reverse().limit(1).first(),
  );
  const nextNumber = (prior?.cycle_number ?? 0) + 1;

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [s, setS] = useState<WizardState>(() => ({
    protocol_id: "gnp_weekly",
    cycle_number: nextNumber,
    start_date: todayISO(),
    status: "active",
    dose_level: 0,
    default_start_time: "09:00",
    default_duration_min: 240,
    location: "",
    notes: "",
    excluded_dose_days: new Set(),
    excluded_agent_ids: new Set(),
    excluded_supportive_ids: new Set(),
  }));
  function patch<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  // Re-pull cycle_number once the DB query resolves so the very first cycle
  // (no prior row) starts at 1 instead of NaN.
  const computedNumber = useMemo(() => {
    return s.cycle_number || nextNumber || 1;
  }, [s.cycle_number, nextNumber]);

  const protocol = PROTOCOL_BY_ID[s.protocol_id];

  // Live preview shapes, recomputed on every state change so the toggles in
  // step 3 immediately reflect what the save will write.
  const previewCycle: TreatmentCycle = useMemo(
    () => ({
      id: -1, // placeholder; deriveCycleAppointments still needs a number
      protocol_id: s.protocol_id,
      cycle_number: computedNumber,
      start_date: s.start_date,
      status: s.status,
      dose_level: s.dose_level,
      created_at: now(),
      updated_at: now(),
    }),
    [s.protocol_id, computedNumber, s.start_date, s.status, s.dose_level],
  );

  const derivedAppointments = useMemo(() => {
    if (!protocol) return [];
    return deriveCycleAppointments(
      previewCycle,
      protocol,
      s.default_start_time,
      s.default_duration_min,
    );
  }, [previewCycle, protocol, s.default_start_time, s.default_duration_min]);

  async function commit() {
    if (!protocol) return;
    setSaving(true);
    setError(null);
    try {
      const ts = now();
      const cycleId = (await db.treatment_cycles.add({
        protocol_id: s.protocol_id,
        cycle_number: computedNumber,
        start_date: s.start_date,
        status: s.status,
        dose_level: s.dose_level,
        notes: s.notes.trim() ? s.notes.trim() : undefined,
        created_at: ts,
        updated_at: ts,
      })) as number;

      // Appointments — re-derive with the real cycle id so ics_uid + cycle_id
      // are correct, then drop any day the user toggled off.
      const apptsToWrite = deriveCycleAppointments(
        { ...previewCycle, id: cycleId },
        protocol,
        s.default_start_time,
        s.default_duration_min,
      ).filter((row) => {
        const dayMatch = row.ics_uid?.match(/-day-(\d+)$/);
        const day = dayMatch ? Number(dayMatch[1]) : NaN;
        return !s.excluded_dose_days.has(day);
      });
      for (const row of apptsToWrite) {
        await db.appointments.add({
          ...row,
          location: s.location.trim() || undefined,
          created_at: ts,
          updated_at: ts,
        } as Appointment);
      }

      // Medications — protocol agents + selected supportive meds.
      const meds: Medication[] = [];
      for (const agent of protocol.agents) {
        if (s.excluded_agent_ids.has(agent.id)) continue;
        const drug = DRUGS_BY_ID[agent.id];
        meds.push({
          drug_id: agent.id,
          display_name: drug?.name.en ?? agent.name,
          category: (drug?.category ?? "chemo") as MedicationCategory,
          dose: agent.typical_dose,
          route: agent.route,
          schedule: {
            kind: "cycle_linked",
            cycle_days: agent.dose_days,
          } as DoseSchedule,
          source: "protocol_agent",
          cycle_id: cycleId,
          active: true,
          started_on: s.start_date,
          created_at: ts,
          updated_at: ts,
        });
      }
      for (const supportiveId of protocol.typical_supportive) {
        if (s.excluded_supportive_ids.has(supportiveId)) continue;
        const drugId = SUPPORTIVE_TO_DRUG[supportiveId];
        if (!drugId) continue;
        const drug = DRUGS_BY_ID[drugId];
        if (!drug) continue;
        meds.push({
          drug_id: drugId,
          display_name: drug.name.en,
          category: drug.category,
          dose: drug.typical_doses[0]?.en ?? "See protocol",
          route: drug.default_route,
          schedule: drug.default_schedules[0] ?? { kind: "prn" },
          source: "protocol_supportive",
          cycle_id: cycleId,
          active: true,
          started_on: s.start_date,
          created_at: ts,
          updated_at: ts,
        });
      }
      if (meds.length > 0) await db.medications.bulkAdd(meds);

      router.push(`/treatment/${cycleId}?cycle_added=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!protocol) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <PageHeader
        title={L("Start new cycle", "开始新周期")}
        subtitle={L(
          "Pick a protocol → confirm logistics → review what gets created.",
          "挑方案 → 确认细节 → 检查将生成的日程与处方。",
        )}
      />

      <Stepper step={step} locale={locale} />

      {step === 1 && (
        <ProtocolStep
          selectedId={s.protocol_id}
          onSelect={(id) => {
            patch("protocol_id", id);
            patch("excluded_dose_days", new Set());
            patch("excluded_agent_ids", new Set());
            patch("excluded_supportive_ids", new Set());
          }}
          locale={locale}
        />
      )}

      {step === 2 && (
        <ScheduleStep
          state={s}
          patch={patch}
          computedNumber={computedNumber}
          locale={locale}
        />
      )}

      {step === 3 && (
        <ReviewStep
          state={s}
          patch={patch}
          previewAppointments={derivedAppointments}
          locale={locale}
        />
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-3 text-[12.5px] text-[var(--warn)]"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            if (step === 1) router.push("/treatment");
            else setStep((step - 1) as Step);
          }}
          disabled={saving}
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 1 ? L("Cancel", "取消") : L("Back", "上一步")}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((step + 1) as Step)} size="lg">
            {L("Next", "下一步")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => void commit()} disabled={saving} size="lg">
            <Check className="h-4 w-4" />
            {saving
              ? L("Saving…", "保存中…")
              : L("Create cycle", "创建周期")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step, locale }: { step: Step; locale: "en" | "zh" }) {
  const labels: Array<{ en: string; zh: string }> = [
    { en: "Protocol", zh: "方案" },
    { en: "Schedule", zh: "细节" },
    { en: "Review", zh: "检查" },
  ];
  return (
    <ol className="flex items-center gap-2 text-[11.5px]">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label.en} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                active
                  ? "bg-ink-900 text-paper"
                  : done
                    ? "bg-[var(--tide-2)] text-paper"
                    : "bg-ink-100 text-ink-500",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span
              className={cn(
                "truncate",
                active ? "font-semibold text-ink-900" : "text-ink-500",
              )}
            >
              {label[locale]}
            </span>
            {i < labels.length - 1 && (
              <span className="h-px flex-1 bg-ink-100" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ProtocolStep({
  selectedId,
  onSelect,
  locale,
}: {
  selectedId: ProtocolId;
  onSelect: (id: ProtocolId) => void;
  locale: "en" | "zh";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {locale === "zh" ? "选择方案" : "Pick a protocol"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {PROTOCOL_LIBRARY.map((p) => {
          const active = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
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
                  {p.cycle_length_days}d · D{p.dose_days.join(", D")}
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
  );
}

function ScheduleStep({
  state,
  patch,
  computedNumber,
  locale,
}: {
  state: WizardState;
  patch: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  computedNumber: number;
  locale: "en" | "zh";
}) {
  const L = useL();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{L("Schedule & logistics", "日程与细节")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label={L("Cycle number", "周期编号")}>
          <TextInput
            type="number"
            min={1}
            value={state.cycle_number || computedNumber}
            onChange={(e) => patch("cycle_number", Number(e.target.value))}
          />
        </Field>
        <Field label={L("Start date (D1)", "开始日期 (D1)")}>
          <TextInput
            type="date"
            value={state.start_date}
            onChange={(e) => patch("start_date", e.target.value)}
          />
        </Field>
        <Field label={L("Default infusion start", "默认输注开始时间")}>
          <TextInput
            type="time"
            value={state.default_start_time}
            onChange={(e) => patch("default_start_time", e.target.value)}
          />
        </Field>
        <Field label={L("Infusion duration (min)", "输注时长（分钟）")}>
          <TextInput
            type="number"
            min={30}
            step={15}
            value={state.default_duration_min}
            onChange={(e) =>
              patch("default_duration_min", Number(e.target.value))
            }
          />
        </Field>
        <Field
          label={L("Infusion location", "输注地点")}
          className="sm:col-span-2"
        >
          <TextInput
            value={state.location}
            onChange={(e) => patch("location", e.target.value)}
            placeholder={L(
              "e.g. Epworth Richmond, Day Oncology L4",
              "例如：Epworth Richmond 四楼日间肿瘤",
            )}
          />
        </Field>
        <Field
          label={L("Dose level (0 = full)", "减量等级 (0 = 全剂量)")}
          hint={L("Each level ≈ 20% reduction.", "每级约减 20%")}
        >
          <TextInput
            type="number"
            max={0}
            min={-4}
            value={state.dose_level}
            onChange={(e) => patch("dose_level", Number(e.target.value))}
          />
        </Field>
        <Field
          label={L("Notes for this cycle", "本周期备注")}
          className="sm:col-span-2"
        >
          <TextInput
            value={state.notes}
            onChange={(e) => patch("notes", e.target.value)}
            placeholder={L(
              "e.g. nab-P held due to neuropathy",
              "例如：因神经病变暂停 nab-P",
            )}
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  state,
  patch,
  previewAppointments,
  locale,
}: {
  state: WizardState;
  patch: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  previewAppointments: ReturnType<typeof deriveCycleAppointments>;
  locale: "en" | "zh";
}) {
  const L = useL();
  const protocol = PROTOCOL_BY_ID[state.protocol_id];
  if (!protocol) return null;

  function toggleSet<K extends keyof WizardState>(
    k: K,
    value: WizardState[K] extends Set<infer T> ? T : never,
  ) {
    const current = state[k] as unknown as Set<typeof value>;
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    patch(k, next as unknown as WizardState[K]);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{L("Chemo-day appointments", "化疗日预约")}</CardTitle>
          <p className="mt-1 text-[12px] text-ink-500">
            {L(
              "One scheduled appointment per dose day. Untick any you don't want auto-created — you can always add them later.",
              "每个用药日生成一次预约。取消勾选则不自动创建，之后仍可手动添加。",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {previewAppointments.map((appt) => {
            const dayMatch = appt.ics_uid?.match(/-day-(\d+)$/);
            const day = dayMatch ? Number(dayMatch[1]) : 0;
            const checked = !state.excluded_dose_days.has(day);
            return (
              <label
                key={appt.ics_uid}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-ink-100 bg-paper-2 p-3"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => toggleSet("excluded_dose_days", day)}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink-900">
                    {appt.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ink-500">
                    {appt.starts_at.replace("T", " · ")}
                  </div>
                </div>
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{L("Chemo agents", "化疗药物")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {protocol.agents.map((agent) => {
            const checked = !state.excluded_agent_ids.has(agent.id);
            return (
              <label
                key={agent.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-ink-100 bg-paper-2 p-3"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => toggleSet("excluded_agent_ids", agent.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink-900">
                    {agent.display[locale]}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ink-500">
                    {agent.typical_dose} · {agent.route} · D
                    {agent.dose_days.join(", D")}
                  </div>
                </div>
              </label>
            );
          })}
        </CardContent>
      </Card>

      {protocol.typical_supportive.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{L("Supportive medications", "支持治疗")}</CardTitle>
            <p className="mt-1 text-[12px] text-ink-500">
              {L(
                "Premeds + standing supportive meds your oncologist usually orders alongside this protocol.",
                "本方案常配合的预处理与支持治疗用药。",
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {protocol.typical_supportive.map((sid) => {
              const drugId = SUPPORTIVE_TO_DRUG[sid];
              const drug = drugId ? DRUGS_BY_ID[drugId] : undefined;
              if (!drug) return null;
              const checked = !state.excluded_supportive_ids.has(sid);
              return (
                <label
                  key={sid}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-ink-100 bg-paper-2 p-3"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={() => toggleSet("excluded_supportive_ids", sid)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink-900">
                      {drug.name[locale]}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-500">
                      {drug.typical_doses[0]?.[locale] ?? ""}
                    </div>
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>
      )}

      {protocol.premeds && (
        <div className="rounded-md border border-ink-100 bg-paper-2 p-3 text-[12px] text-ink-600">
          <div className="mono mb-1 text-[10px] uppercase tracking-[0.12em] text-ink-400">
            {L("Premed reminder", "预处理提示")}
          </div>
          {protocol.premeds[locale]}
        </div>
      )}
    </div>
  );
}
