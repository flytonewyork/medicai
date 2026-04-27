"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { db, now } from "~/lib/db/dexie";
import { settingsSchema, type SettingsInput } from "~/lib/validators/schemas";
import { useLocale, useT } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";
import { useUIStore } from "~/stores/ui-store";
import { AccountButton } from "~/components/shared/account-button";
import { HouseholdSection } from "~/components/settings/household-section";
import { NotificationsSection } from "~/components/settings/notifications-section";
import { CareTeamSection } from "~/components/settings/care-team-section";
import { TrackedSymptomsSection } from "~/components/settings/tracked-symptoms-section";
import { PageHeader, SectionHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Field, Select, TextInput, Textarea } from "~/components/ui/field";

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useUIStore((s) => s.setLocale);
  const current = useSettings();

  const { register, handleSubmit, reset, formState } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      profile_name: "",
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
      <PageHeader title={t("settings.title")} />

      <AccountButton />

      <div id="care-team" />

      <HouseholdSection />

      <NotificationsSection />

      <CareTeamSection />

      <TrackedSymptomsSection />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="space-y-3">
          <SectionHeader title={t("settings.profile")} />
          <Field label={t("settings.profile_name")}>
            <TextInput {...register("profile_name")} />
          </Field>
          <Field label={t("settings.dob")}>
            <TextInput type="date" {...register("dob")} />
          </Field>
          <Field label={t("settings.diagnosis_date")}>
            <TextInput type="date" {...register("diagnosis_date")} />
          </Field>
          <Field label={t("settings.locale")}>
            <Select {...register("locale")}>
              <option value="en">{t("settings.locale_en")}</option>
              <option value="zh">{t("settings.locale_zh")}</option>
            </Select>
          </Field>
          <Field
            label={
              locale === "zh"
                ? "居住城市（用于天气提醒）"
                : "Home city (weather nudges)"
            }
          >
            <TextInput placeholder="Melbourne" {...register("home_city")} />
          </Field>
        </section>

        <section className="space-y-3">
          <SectionHeader
            title={locale === "zh" ? "紧急情况" : "Emergency"}
            description={
              locale === "zh"
                ? "肿瘤科医生、医院、24 小时联系人请在「护理团队」中维护;此处仅记录何时直接前往急诊。"
                : "Oncologist, hospital, and 24/7 contacts live in the Care team section above. Use this for the situation-specific guidance the patient should follow when something feels off."
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={
                locale === "zh"
                  ? "24 小时值班电话（备用）"
                  : "24/7 on-call (fallback)"
              }
            >
              <TextInput type="tel" {...register("oncall_phone")} />
            </Field>
            <Field
              label={
                locale === "zh" ? "医院地址（备用）" : "Hospital address (fallback)"
              }
            >
              <TextInput {...register("hospital_address")} />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label={
                  locale === "zh"
                    ? "什么时候直接去急诊"
                    : "When to go straight to hospital"
                }
              >
                <Textarea rows={3} {...register("emergency_instructions")} />
              </Field>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader
            title={locale === "zh" ? "AI 模型" : "AI model"}
            description={
              locale === "zh"
                ? "Claude 调用通过 Anchor 服务器(在 Vercel 中配置的共享 ANTHROPIC_API_KEY)进行 —— 无需每台设备单独配置密钥。此字段用于覆盖默认模型。"
                : "Claude calls run through Anchor’s server (the shared ANTHROPIC_API_KEY configured in Vercel) — no per-device key needed. This field lets you override the default model."
            }
          />
          <Field
            label={
              locale === "zh"
                ? "模型(默认 claude-opus-4-7)"
                : "Model (default claude-opus-4-7)"
            }
          >
            <TextInput
              placeholder="claude-opus-4-7"
              {...register("default_ai_model")}
            />
          </Field>
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
          {formState.isSubmitSuccessful && (
            <span className="text-xs text-ink-500">{t("common.saved")}</span>
          )}
        </div>
      </form>
    </div>
  );
}
