"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { dailyEntrySchema } from "~/lib/validators/schemas";
import { todayISO } from "~/lib/utils/date";
import { useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { runEngineAndPersist } from "~/lib/rules/engine";
import { ScaleInput } from "./scale-input";
import { Toggle } from "./toggle";

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
};

const STEPS = ["subjective", "objective", "symptoms", "reflection"] as const;

export function MorningCheckin({ entryId, date }: { entryId?: number; date?: string }) {
  const t = useT();
  const router = useRouter();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const locale = useUIStore((s) => s.locale);
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
      });
    }
  }, [existing]);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const currentStep = STEPS[step];

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
        await db.daily_entries.add(payload);
      }
      await runEngineAndPersist();
      router.push("/daily");
    } finally {
      setSaving(false);
    }
  }

  const progress = useMemo(
    () => `${step + 1} / ${STEPS.length}`,
    [step],
  );

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("daily.title")}</h1>
          <span className="text-xs text-slate-500">{progress}</span>
        </div>
        <p className="text-sm text-slate-500">{t("daily.subtitle")}</p>
      </header>

      {currentStep === "subjective" && (
        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("daily.morning.title")}
          </h2>
          <ScaleInput label={t("daily.morning.energy")} value={form.energy} onChange={(v) => update("energy", v)} />
          <ScaleInput label={t("daily.morning.sleep")} value={form.sleep_quality} onChange={(v) => update("sleep_quality", v)} />
          <ScaleInput label={t("daily.morning.appetite")} value={form.appetite} onChange={(v) => update("appetite", v)} />
          <ScaleInput label={t("daily.morning.pain_current")} value={form.pain_current} onChange={(v) => update("pain_current", v)} />
          <ScaleInput label={t("daily.morning.pain_worst")} value={form.pain_worst} onChange={(v) => update("pain_worst", v)} />
          <ScaleInput label={t("daily.morning.mood")} value={form.mood_clarity} onChange={(v) => update("mood_clarity", v)} />
          <ScaleInput label={t("daily.morning.nausea")} value={form.nausea} onChange={(v) => update("nausea", v)} />
        </section>
      )}

      {currentStep === "objective" && (
        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("daily.objective.title")}
          </h2>
          <NumberField
            label={t("daily.objective.weight")}
            value={form.weight_kg}
            step={0.1}
            onChange={(v) => update("weight_kg", v)}
          />
          <NumberField
            label={t("daily.objective.steps")}
            value={form.steps}
            onChange={(v) => update("steps", v)}
          />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 pt-4">
            {t("daily.practice.title")}
          </h2>
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
        </section>
      )}

      {currentStep === "symptoms" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("daily.symptoms.title")}
          </h2>
          <Toggle label={t("daily.symptoms.cold_dysaesthesia")} checked={form.cold_dysaesthesia} onChange={(v) => update("cold_dysaesthesia", v)} />
          <Toggle label={t("daily.symptoms.neuropathy_hands")} checked={form.neuropathy_hands} onChange={(v) => update("neuropathy_hands", v)} />
          <Toggle label={t("daily.symptoms.neuropathy_feet")} checked={form.neuropathy_feet} onChange={(v) => update("neuropathy_feet", v)} />
          <Toggle label={t("daily.symptoms.mouth_sores")} checked={form.mouth_sores} onChange={(v) => update("mouth_sores", v)} />
          <Toggle label={t("daily.symptoms.new_bruising")} checked={form.new_bruising} onChange={(v) => update("new_bruising", v)} />
          <Toggle label={t("daily.symptoms.dyspnoea")} checked={form.dyspnoea} onChange={(v) => update("dyspnoea", v)} />
          <NumberField
            label={t("daily.symptoms.diarrhoea_count")}
            value={form.diarrhoea_count}
            onChange={(v) => update("diarrhoea_count", v ?? 0)}
          />
          <Toggle label={t("daily.symptoms.fever")} checked={form.fever} onChange={(v) => update("fever", v)} />
          {form.fever && (
            <NumberField
              label={t("daily.symptoms.fever_temp")}
              value={form.fever_temp}
              step={0.1}
              onChange={(v) => update("fever_temp", v)}
            />
          )}
        </section>
      )}

      {currentStep === "reflection" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("daily.reflection.title")}
          </h2>
          <textarea
            rows={6}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            placeholder={t("daily.reflection.placeholder")}
            value={form.reflection}
            onChange={(e) => update("reflection", e.target.value)}
          />
        </section>
      )}

      {error && (
        <div className="rounded-md border border-red-400 bg-red-50 text-red-800 text-sm p-3 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {t("common.back")}
        </button>
        {isLastStep ? (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            {t("common.next")}
          </button>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type="number"
        step={step}
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? undefined : Number(raw));
        }}
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
      />
    </label>
  );
}
