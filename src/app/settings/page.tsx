"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { settingsSchema, type SettingsInput } from "~/lib/validators/schemas";
import { useLocale, useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { AccountButton } from "~/components/shared/account-button";
import { HouseholdSection } from "~/components/settings/household-section";
import { NotificationsSection } from "~/components/settings/notifications-section";
import { CareTeamSection } from "~/components/settings/care-team-section";
import { TrackedSymptomsSection } from "~/components/settings/tracked-symptoms-section";

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useUIStore((s) => s.setLocale);
  const settings = useLiveQuery(() => db.settings.toArray());
  const current = settings?.[0];

  const { register, handleSubmit, reset, formState } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      profile_name: "Hu Lin",
      locale: "en",
    },
  });

  useEffect(() => {
    if (current) {
      reset({
        profile_name: current.profile_name,
        dob: current.dob,
        diagnosis_date: current.diagnosis_date,
        height_cm: current.height_cm,
        baseline_weight_kg: current.baseline_weight_kg,
        baseline_date: current.baseline_date,
        baseline_grip_dominant_kg: current.baseline_grip_dominant_kg,
        baseline_grip_nondominant_kg: current.baseline_grip_nondominant_kg,
        baseline_gait_speed_ms: current.baseline_gait_speed_ms,
        baseline_sit_to_stand: current.baseline_sit_to_stand,
        baseline_muac_cm: current.baseline_muac_cm,
        baseline_calf_cm: current.baseline_calf_cm,
        locale: current.locale,
        managing_oncologist: current.managing_oncologist,
        managing_oncologist_phone: current.managing_oncologist_phone,
        hospital_name: current.hospital_name,
        hospital_phone: current.hospital_phone,
        hospital_address: current.hospital_address,
        oncall_phone: current.oncall_phone,
        emergency_instructions: current.emergency_instructions,
        home_city: current.home_city,
        home_lat: current.home_lat,
        home_lon: current.home_lon,
        home_timezone: current.home_timezone,
        anthropic_api_key: current.anthropic_api_key,
        default_ai_model: current.default_ai_model,
      });
    }
  }, [current, reset]);

  async function onSubmit(values: SettingsInput) {
    // If home_city changed or lat/lon missing, re-geocode.
    const needsGeocode =
      values.home_city &&
      (values.home_city !== current?.home_city ||
        typeof values.home_lat !== "number" ||
        typeof values.home_lon !== "number");
    if (needsGeocode && values.home_city) {
      try {
        const { geocodeCity } = await import("~/lib/weather/open-meteo");
        const geo = await geocodeCity(values.home_city);
        if (geo) {
          values.home_lat = geo.latitude;
          values.home_lon = geo.longitude;
          values.home_timezone = geo.timezone;
        }
      } catch {
        // non-fatal
      }
    }
    if (current?.id) {
      await db.settings.update(current.id, { ...values, updated_at: now() });
    } else {
      await db.settings.add({
        ...values,
        created_at: now(),
        updated_at: now(),
      });
    }
    setLocale(values.locale);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="serif text-2xl tracking-tight text-ink-900">
          {t("settings.title")}
        </h1>
      </div>

      <AccountButton />

      <HouseholdSection />

      <NotificationsSection />

      <CareTeamSection />

      <TrackedSymptomsSection />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="space-y-3">
          <h2 className="eyebrow">{t("settings.profile")}</h2>
          <Field label={t("settings.profile_name")}>
            <input className={inputCls} {...register("profile_name")} />
          </Field>
          <Field label={t("settings.dob")}>
            <input type="date" className={inputCls} {...register("dob")} />
          </Field>
          <Field label={t("settings.diagnosis_date")}>
            <input type="date" className={inputCls} {...register("diagnosis_date")} />
          </Field>
          <Field label={t("settings.locale")}>
            <select className={inputCls} {...register("locale")}>
              <option value="en">{t("settings.locale_en")}</option>
              <option value="zh">{t("settings.locale_zh")}</option>
            </select>
          </Field>
          <Field label="Home city (weather nudges)">
            <input
              className={inputCls}
              placeholder="Melbourne"
              {...register("home_city")}
            />
          </Field>
        </section>

        <section className="space-y-3">
          <h2 className="eyebrow">
            {locale === "zh" ? "紧急情况" : "Emergency"}
          </h2>
          <p className="text-xs text-ink-500">
            {locale === "zh"
              ? "肿瘤科医生、医院、24 小时联系人请在「护理团队」中维护;此处仅记录何时直接前往急诊。"
              : "Oncologist, hospital, and 24/7 contacts live in the Care team section above. Use this for the situation-specific guidance the patient should follow when something feels off."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="24/7 on-call (fallback)">
              <input
                type="tel"
                className={inputCls}
                {...register("oncall_phone")}
              />
            </Field>
            <Field label="Hospital address (fallback)">
              <input className={inputCls} {...register("hospital_address")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="When to go straight to hospital">
                <textarea
                  rows={3}
                  className={inputCls}
                  {...register("emergency_instructions")}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="eyebrow">AI model</h2>
          <p className="text-xs text-ink-500">
            Claude calls run through Anchor&rsquo;s server (the shared
            ANTHROPIC_API_KEY configured in Vercel) — no per-device key
            needed. This field lets you override the default model.
          </p>
          <Field label="Model (default claude-opus-4-7)">
            <input
              className={inputCls}
              placeholder="claude-opus-4-7"
              {...register("default_ai_model")}
            />
          </Field>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="inline-flex items-center rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-paper hover:brightness-110 disabled:opacity-50"
          >
            {formState.isSubmitting ? t("common.saving") : t("common.save")}
          </button>
          {formState.isSubmitSuccessful && (
            <span className="text-xs text-ink-500">{t("common.saved")}</span>
          )}
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-ink-200 bg-paper-2 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-900/10 focus:border-ink-900";

const numberOptional = {
  setValueAs: (v: unknown) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-ink-700">{label}</span>
      {children}
    </label>
  );
}
