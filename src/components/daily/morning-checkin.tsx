"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { dailyEntrySchema } from "~/lib/validators/schemas";
import { todayISO } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { runEngineAndPersist } from "~/lib/rules/engine";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { SectionHeader } from "~/components/ui/page-header";
import { ScaleInput } from "./scale-input";
import { Toggle } from "./toggle";
import { CycleBanner } from "./cycle-banner";
import { MedicationsStep } from "./medications-step";

const INITIAL = {
  date: todayISO(),
  energy: 5,
  sleep_quality: 5,
  appetite: 5,
  pain_worst: 0,
  pain_current: 0,
  mood_clarity: 5,
  nausea: 0,
  weight_kg: undefined as number | undefined,
  steps: undefined as number | undefined,
  practice_morning_completed: false,
  practice_morning_quality: undefined as number | undefined,
  practice_evening_completed: false,
  practice_evening_quality: undefined as number | undefined,
  cold_dysaesthesia: false,
  neuropathy_hands: false,
  neuropathy_feet: false,
  mouth_sores: false,
  diarrhoea_count: 0,
  new_bruising: false,
  dyspnoea: false,
  fever: false,
  fever_temp: undefined as number | undefined,
  reflection: "",
  protein_grams: undefined as number | undefined,
  meals_count: undefined as number | undefined,
  snacks_count: undefined as number | undefined,
  fluids_ml: undefined as number | undefined,
  walking_minutes: undefined as number | undefined,
  resistance_training: false,
  other_exercise_minutes: undefined as number | undefined,
};

const STEPS = [
  "subjective",
  "objective",
  "body",
  "symptoms",
  "medications",
  "reflection",
] as const;

type StepKey = (typeof STEPS)[number];

const STEP_LABELS: Record<"en" | "zh", Record<StepKey, string>> = {
  en: {
    subjective: "How you feel",
    objective: "Weight & practice",
    body: "Food & movement",
    symptoms: "Symptom flags",
    medications: "Today's medications",
    reflection: "Reflection",
  },
  zh: {
    subjective: "主观感受",
    objective: "体重与修习",
    body: "饮食与运动",
    symptoms: "症状",
    medications: "今日用药",
    reflection: "反思",
  },
};

export function MorningCheckin({
  entryId,
  date,
}: {
  entryId?: number;
  date?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const existing = useLiveQuery(
    () => (entryId ? db.daily_entries.get(entryId) : undefined),
    [entryId],
  );

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...INITIAL, date: date ?? todayISO() });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        date: existing.date,
        energy: existing.energy,
        sleep_quality: existing.sleep_quality,
        appetite: existing.appetite,
        pain_worst: existing.pain_worst,
        pain_current: existing.pain_current,
        mood_clarity: existing.mood_clarity,
        nausea: existing.nausea,
        weight_kg: existing.weight_kg,
        steps: existing.steps,
        practice_morning_completed: existing.practice_morning_completed,
        practice_morning_quality: existing.practice_morning_quality,
        practice_evening_completed: existing.practice_evening_completed,
        practice_evening_quality: existing.practice_evening_quality,
        cold_dysaesthesia: existing.cold_dysaesthesia,
        neuropathy_hands: existing.neuropathy_hands,
        neuropathy_feet: existing.neuropathy_feet,
        mouth_sores: existing.mouth_sores,
        diarrhoea_count: existing.diarrhoea_count,
        new_bruising: existing.new_bruising,
        dyspnoea: existing.dyspnoea,
        fever: existing.fever,
        fever_temp: existing.fever_temp,
        reflection: existing.reflection ?? "",
        protein_grams: existing.protein_grams,
        meals_count: existing.meals_count,
        snacks_count: existing.snacks_count,
        fluids_ml: existing.fluids_ml,
        walking_minutes: existing.walking_minutes,
        resistance_training: existing.resistance_training ?? false,
        other_exercise_minutes: existing.other_exercise_minutes,
      });
    }
  }, [existing]);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const currentStep = STEPS[step] ?? "subjective";
  const isLastStep = step === STEPS.length - 1;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const parsed = dailyEntrySchema.safeParse({
        ...form,
        entered_by: enteredBy,
        reflection_lang: locale,
      });
      if (!parsed.success) {
        setError(parsed.error.issues.map((i) => i.message).join(", "));
        return;
      }
      const payload = {
        ...parsed.data,
        entered_at: now(),
        created_at: existing?.created_at ?? now(),
        updated_at: now(),
      };
      if (entryId) {
        await db.daily_entries.update(entryId, payload);
      } else {
        // Upsert by date so QuickCheckinCard + full log don't create
        // duplicate rows — the dashboard tiles key off `date`.
        const existingForDate = await db.daily_entries
          .where("date")
          .equals(payload.date)
          .first();
        if (existingForDate?.id) {
          await db.daily_entries.update(existingForDate.id, {
            ...payload,
            created_at: existingForDate.created_at,
          });
        } else {
          await db.daily_entries.add(payload);
        }
      }
      await runEngineAndPersist();
      router.push("/daily");
    } finally {
      setSaving(false);
    }
  }

  const progress = useMemo(
    () => ((step + 1) / STEPS.length) * 100,
    [step],
  );

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-8">
      <CycleBanner />
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("daily.title")}
          </h1>
          <span className="text-xs font-medium text-slate-500">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <p className="text-sm text-slate-500">{t("daily.subtitle")}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-slate-900 transition-all duration-300 dark:bg-slate-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {STEP_LABELS[locale][currentStep]}
        </div>
      </header>

      {currentStep === "subjective" && (
        <Card>
          <CardContent className="space-y-6 pt-5">
            <ScaleInput
              label={t("daily.morning.energy")}
              value={form.energy}
              onChange={(v) => update("energy", v)}
            />
            <ScaleInput
              label={t("daily.morning.sleep")}
              value={form.sleep_quality}
              onChange={(v) => update("sleep_quality", v)}
            />
            <ScaleInput
              label={t("daily.morning.appetite")}
              value={form.appetite}
              onChange={(v) => update("appetite", v)}
            />
            <ScaleInput
              label={t("daily.morning.pain_current")}
              value={form.pain_current}
              onChange={(v) => update("pain_current", v)}
            />
            <ScaleInput
              label={t("daily.morning.pain_worst")}
              value={form.pain_worst}
              onChange={(v) => update("pain_worst", v)}
            />
            <ScaleInput
              label={t("daily.morning.mood")}
              value={form.mood_clarity}
              onChange={(v) => update("mood_clarity", v)}
            />
            <ScaleInput
              label={t("daily.morning.nausea")}
              value={form.nausea}
              onChange={(v) => update("nausea", v)}
            />
          </CardContent>
        </Card>
      )}

      {currentStep === "objective" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("daily.objective.title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <NumberField
                label={t("daily.objective.weight")}
                suffix="kg"
                value={form.weight_kg}
                step={0.1}
                onChange={(v) => update("weight_kg", v)}
              />
              <NumberField
                label={t("daily.objective.steps")}
                value={form.steps}
                onChange={(v) => update("steps", v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("daily.practice.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Toggle
                label={t("daily.practice.morning_completed")}
                checked={form.practice_morning_completed}
                onChange={(v) => update("practice_morning_completed", v)}
              />
              {form.practice_morning_completed && (
                <ScaleInput
                  label={t("daily.practice.quality")}
                  value={form.practice_morning_quality ?? 3}
                  onChange={(v) => update("practice_morning_quality", v)}
                  min={0}
                  max={5}
                />
              )}
              <Toggle
                label={t("daily.practice.evening_completed")}
                checked={form.practice_evening_completed}
                onChange={(v) => update("practice_evening_completed", v)}
              />
              {form.practice_evening_completed && (
                <ScaleInput
                  label={t("daily.practice.quality")}
                  value={form.practice_evening_quality ?? 3}
                  onChange={(v) => update("practice_evening_quality", v)}
                  min={0}
                  max={5}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {currentStep === "body" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("daily.diet.title")}</CardTitle>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("daily.diet.subtitle")}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <NumberField
                label={t("daily.diet.protein")}
                suffix="g"
                value={form.protein_grams}
                step={5}
                onChange={(v) => update("protein_grams", v)}
                hint={t("daily.diet.protein_hint")}
              />
              <NumberField
                label={t("daily.diet.fluids")}
                suffix="ml"
                value={form.fluids_ml}
                step={100}
                onChange={(v) => update("fluids_ml", v)}
              />
              <NumberField
                label={t("daily.diet.meals")}
                value={form.meals_count}
                onChange={(v) => update("meals_count", v)}
              />
              <NumberField
                label={t("daily.diet.snacks")}
                value={form.snacks_count}
                onChange={(v) => update("snacks_count", v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("daily.exercise.title")}</CardTitle>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("daily.exercise.subtitle")}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <NumberField
                label={t("daily.exercise.walking")}
                suffix={locale === "zh" ? "分钟" : "min"}
                value={form.walking_minutes}
                step={5}
                onChange={(v) => update("walking_minutes", v)}
              />
              <NumberField
                label={t("daily.exercise.other")}
                suffix={locale === "zh" ? "分钟" : "min"}
                value={form.other_exercise_minutes}
                step={5}
                onChange={(v) => update("other_exercise_minutes", v)}
              />
              <Toggle
                label={t("daily.exercise.resistance")}
                checked={form.resistance_training}
                onChange={(v) => update("resistance_training", v)}
              />
            </CardContent>
          </Card>
        </>
      )}

      {currentStep === "symptoms" && (
        <Card>
          <CardContent className="space-y-2.5 pt-5">
            <Toggle
              label={t("daily.symptoms.cold_dysaesthesia")}
              checked={form.cold_dysaesthesia}
              onChange={(v) => update("cold_dysaesthesia", v)}
            />
            <Toggle
              label={t("daily.symptoms.neuropathy_hands")}
              checked={form.neuropathy_hands}
              onChange={(v) => update("neuropathy_hands", v)}
            />
            <Toggle
              label={t("daily.symptoms.neuropathy_feet")}
              checked={form.neuropathy_feet}
              onChange={(v) => update("neuropathy_feet", v)}
            />
            <Toggle
              label={t("daily.symptoms.mouth_sores")}
              checked={form.mouth_sores}
              onChange={(v) => update("mouth_sores", v)}
            />
            <Toggle
              label={t("daily.symptoms.new_bruising")}
              checked={form.new_bruising}
              onChange={(v) => update("new_bruising", v)}
            />
            <Toggle
              label={t("daily.symptoms.dyspnoea")}
              checked={form.dyspnoea}
              onChange={(v) => update("dyspnoea", v)}
            />
            <NumberField
              label={t("daily.symptoms.diarrhoea_count")}
              value={form.diarrhoea_count}
              onChange={(v) => update("diarrhoea_count", v ?? 0)}
            />
            <Toggle
              label={t("daily.symptoms.fever")}
              checked={form.fever}
              onChange={(v) => update("fever", v)}
            />
            {form.fever && (
              <NumberField
                label={t("daily.symptoms.fever_temp")}
                suffix="°C"
                value={form.fever_temp}
                step={0.1}
                onChange={(v) => update("fever_temp", v)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === "medications" && <MedicationsStep />}

      {currentStep === "reflection" && (
        <Card>
          <CardContent className="pt-5">
            <textarea
              rows={8}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-100"
              placeholder={t("daily.reflection.placeholder")}
              value={form.reflection}
              onChange={(e) => update("reflection", e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          {t("common.back")}
        </Button>
        {isLastStep ? (
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        ) : (
          <Button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            size="lg"
          >
            {t("common.next")}
          </Button>
        )}
      </div>

      <SectionHeader
        title={locale === "zh" ? "提示" : "Tips"}
        description={
          locale === "zh"
            ? "可以跳过任何不适用的项目。每项都会自动保存。"
            : "Skip anything that doesn't apply. Every field auto-saves."
        }
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  suffix,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          step={step}
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? undefined : Number(raw));
          }}
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-base tabular-nums focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-100"
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      )}
    </label>
  );
}
