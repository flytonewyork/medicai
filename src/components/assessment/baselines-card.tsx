"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { db, now } from "~/lib/db/dexie";
import { settingsSchema, type SettingsInput } from "~/lib/validators/schemas";
import { useT } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";
import { Card, CardContent } from "~/components/ui/card";

// Baseline anthropometrics + functional benchmarks. Lives next to the
// /assessment list because clinically these numbers ARE the patient's
// pre-treatment baseline — comparing them to a current assessment is
// what surfaces drift in functional reserve. Keeps reading/writing the
// same `settings` row the original Settings form used so existing data
// carries forward without migration.

const numberOptional = {
  setValueAs: (v: unknown) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  },
};

export function BaselinesCard() {
  const t = useT();
  const current = useSettings();

  const { register, handleSubmit, reset, formState } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { profile_name: "Hu Lin", locale: "en" },
  });

  useEffect(() => {
    if (current) {
      reset({
        profile_name: current.profile_name,
        locale: current.locale,
        height_cm: current.height_cm,
        baseline_weight_kg: current.baseline_weight_kg,
        baseline_date: current.baseline_date,
        baseline_grip_dominant_kg: current.baseline_grip_dominant_kg,
        baseline_grip_nondominant_kg: current.baseline_grip_nondominant_kg,
        baseline_gait_speed_ms: current.baseline_gait_speed_ms,
        baseline_sit_to_stand: current.baseline_sit_to_stand,
        baseline_muac_cm: current.baseline_muac_cm,
        baseline_calf_cm: current.baseline_calf_cm,
      });
    }
  }, [current, reset]);

  async function onSubmit(values: SettingsInput) {
    const patch = {
      height_cm: values.height_cm,
      baseline_weight_kg: values.baseline_weight_kg,
      baseline_date: values.baseline_date,
      baseline_grip_dominant_kg: values.baseline_grip_dominant_kg,
      baseline_grip_nondominant_kg: values.baseline_grip_nondominant_kg,
      baseline_gait_speed_ms: values.baseline_gait_speed_ms,
      baseline_sit_to_stand: values.baseline_sit_to_stand,
      baseline_muac_cm: values.baseline_muac_cm,
      baseline_calf_cm: values.baseline_calf_cm,
      updated_at: now(),
    };
    if (current?.id) {
      await db.settings.update(current.id, patch);
    } else {
      await db.settings.add({
        profile_name: values.profile_name,
        locale: values.locale,
        ...patch,
        created_at: now(),
      });
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div>
          <h2 className="eyebrow">{t("settings.baselines")}</h2>
          <p className="mt-1 text-xs text-ink-500">
            Anchor compares every assessment back to these numbers — the
            pre-treatment benchmark for grip strength, gait speed, weight,
            and anthropometry. Update them once before treatment starts and
            again if a clinician re-baselines after a long break.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("settings.height_cm")}>
              <input
                type="number"
                step="0.5"
                className={inputCls}
                {...register("height_cm", numberOptional)}
              />
            </Field>
            <Field label={t("settings.baseline_weight_kg")}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                {...register("baseline_weight_kg", numberOptional)}
              />
            </Field>
            <Field label={t("settings.baseline_date")}>
              <input
                type="date"
                className={inputCls}
                {...register("baseline_date")}
              />
            </Field>
            <Field label={t("settings.baseline_grip_dominant_kg")}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                {...register("baseline_grip_dominant_kg", numberOptional)}
              />
            </Field>
            <Field label={t("settings.baseline_grip_nondominant_kg")}>
              <input
                type="number"
                step="0.1"
                className={inputCls}
                {...register("baseline_grip_nondominant_kg", numberOptional)}
              />
            </Field>
            <Field label={t("settings.baseline_gait_speed_ms")}>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                {...register("baseline_gait_speed_ms", numberOptional)}
              />
            </Field>
            <Field label={t("settings.baseline_sit_to_stand")}>
              <input
                type="number"
                className={inputCls}
                {...register("baseline_sit_to_stand", numberOptional)}
              />
            </Field>
            <Field label={t("settings.baseline_muac_cm")}>
              <input
                type="number"
                step="0.5"
                className={inputCls}
                {...register("baseline_muac_cm", numberOptional)}
              />
            </Field>
            <Field label={t("settings.baseline_calf_cm")}>
              <input
                type="number"
                step="0.5"
                className={inputCls}
                {...register("baseline_calf_cm", numberOptional)}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="inline-flex items-center rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-paper hover:brightness-110 disabled:opacity-50"
            >
              {formState.isSubmitting
                ? t("common.saving")
                : t("common.save")}
            </button>
            {formState.isSubmitSuccessful && (
              <span className="text-xs text-ink-500">{t("common.saved")}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const inputCls =
  "w-full rounded-md border border-ink-200 bg-paper-2 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900/10 focus:border-ink-900";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-ink-700">{label}</span>
      {children}
    </label>
  );
}
