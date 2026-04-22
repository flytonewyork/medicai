"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput, Textarea } from "~/components/ui/field";
import { PROTOCOL_LIBRARY, PROTOCOL_BY_ID } from "~/config/protocols";
import type { ProtocolId } from "~/types/treatment";
import type { Locale, Settings } from "~/types/clinical";
import {
  Anchor,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

// Order is load-bearing: welcome + profile + preferences is the "core" path
// that gets every user onto the dashboard quickly. Team / baselines /
// treatment are optional detail — skippable via "Finish setup later" so the
// patient isn't gated behind data they don't have on hand.
const STEPS = [
  "welcome",
  "profile",
  "preferences",
  "team",
  "baselines",
  "treatment",
  "done",
] as const;

// Steps the user can "Finish setup later" from — i.e. jump straight to
// done without filling the remaining steps.
const CAN_SKIP_FROM: StepKey[] = ["profile", "preferences", "team", "baselines", "treatment"];

type StepKey = (typeof STEPS)[number];

const STEP_LABELS: Record<Locale, Record<StepKey, string>> = {
  en: {
    welcome: "Welcome",
    profile: "About you",
    team: "Clinical team",
    baselines: "Baselines",
    treatment: "Treatment",
    preferences: "Preferences",
    done: "All set",
  },
  zh: {
    welcome: "欢迎",
    profile: "基本信息",
    team: "医疗团队",
    baselines: "基线数据",
    treatment: "治疗方案",
    preferences: "偏好设置",
    done: "完成",
  },
};

interface FormState {
  profile_name: string;
  dob: string;
  diagnosis_date: string;
  managing_oncologist: string;
  managing_oncologist_phone: string;
  hospital_name: string;
  hospital_phone: string;
  hospital_address: string;
  oncall_phone: string;
  emergency_instructions: string;
  height_cm: string;
  baseline_weight_kg: string;
  baseline_grip_dominant_kg: string;
  baseline_gait_speed_ms: string;
  baseline_sit_to_stand: string;       // 30-second count
  baseline_sts_5x_seconds: string;     // 5× STS time
  baseline_tug_seconds: string;        // Timed Up-and-Go seconds
  baseline_muac_cm: string;
  baseline_calf_cm: string;
  start_cycle: boolean;
  protocol_id: ProtocolId;
  cycle_start_date: string;
  locale: Locale;
  home_city: string;
  anthropic_api_key: string;
}

const EMPTY: FormState = {
  profile_name: "",
  dob: "",
  diagnosis_date: "",
  managing_oncologist: "",
  managing_oncologist_phone: "",
  hospital_name: "",
  hospital_phone: "",
  hospital_address: "",
  oncall_phone: "",
  emergency_instructions: "",
  height_cm: "",
  baseline_weight_kg: "",
  baseline_grip_dominant_kg: "",
  baseline_gait_speed_ms: "",
  baseline_sit_to_stand: "",
  baseline_sts_5x_seconds: "",
  baseline_tug_seconds: "",
  baseline_muac_cm: "",
  baseline_calf_cm: "",
  start_cycle: false,
  protocol_id: "gnp_weekly",
  cycle_start_date: todayISO(),
  locale: "en",
  home_city: "",
  anthropic_api_key: "",
};

function toNum(s: string): number | undefined {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export default function OnboardingPage() {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const setUILocale = useUIStore((s) => s.setLocale);
  const setEnteredBy = useUIStore((s) => s.setEnteredBy);
  const existingSettings = useLiveQuery(() => db.settings.toArray());

  const [form, setForm] = useState<FormState>({ ...EMPTY, locale });
  const [step, setStep] = useState<StepKey>("welcome");
  const [saving, setSaving] = useState(false);

  // If already onboarded, bounce back to dashboard.
  useEffect(() => {
    const s = existingSettings?.[0];
    if (s?.onboarded_at) {
      router.replace("/");
    } else if (s) {
      // Prefill from partial existing settings
      setForm((f) => ({
        ...f,
        profile_name: s.profile_name ?? "",
        dob: s.dob ?? "",
        diagnosis_date: s.diagnosis_date ?? "",
        managing_oncologist: s.managing_oncologist ?? "",
        managing_oncologist_phone: s.managing_oncologist_phone ?? "",
        hospital_name: s.hospital_name ?? "",
        hospital_phone: s.hospital_phone ?? "",
        hospital_address: s.hospital_address ?? "",
        oncall_phone: s.oncall_phone ?? "",
        emergency_instructions: s.emergency_instructions ?? "",
        height_cm: s.height_cm ? String(s.height_cm) : "",
        baseline_weight_kg: s.baseline_weight_kg
          ? String(s.baseline_weight_kg)
          : "",
        baseline_grip_dominant_kg: s.baseline_grip_dominant_kg
          ? String(s.baseline_grip_dominant_kg)
          : "",
        baseline_gait_speed_ms: s.baseline_gait_speed_ms
          ? String(s.baseline_gait_speed_ms)
          : "",
        baseline_sit_to_stand: s.baseline_sit_to_stand
          ? String(s.baseline_sit_to_stand)
          : "",
        baseline_sts_5x_seconds: s.baseline_sts_5x_seconds
          ? String(s.baseline_sts_5x_seconds)
          : "",
        baseline_tug_seconds: s.baseline_tug_seconds
          ? String(s.baseline_tug_seconds)
          : "",
        baseline_muac_cm: s.baseline_muac_cm ? String(s.baseline_muac_cm) : "",
        baseline_calf_cm: s.baseline_calf_cm ? String(s.baseline_calf_cm) : "",
        locale: s.locale,
        home_city: s.home_city ?? "",
        anthropic_api_key: s.anthropic_api_key ?? "",
      }));
    }
  }, [existingSettings, router]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const stepIdx = STEPS.indexOf(step);
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  function back() {
    const i = STEPS.indexOf(step);
    if (i > 0) {
      const prev = STEPS[i - 1];
      if (prev) setStep(prev);
    }
  }

  function forward() {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) {
      const next = STEPS[i + 1];
      if (next) setStep(next);
    }
  }

  function skipToEnd() {
    setStep("done");
  }

  const canContinue = useMemo(() => {
    if (step === "profile") return form.profile_name.trim().length > 0;
    return true;
  }, [step, form.profile_name]);

  async function finish() {
    setSaving(true);
    try {
      const ts = now();
      // Optional geocode for weather
      let home_lat: number | undefined;
      let home_lon: number | undefined;
      let home_timezone: string | undefined;
      if (form.home_city.trim()) {
        try {
          const { geocodeCity } = await import("~/lib/weather/open-meteo");
          const geo = await geocodeCity(form.home_city);
          if (geo) {
            home_lat = geo.latitude;
            home_lon = geo.longitude;
            home_timezone = geo.timezone;
          }
        } catch {
          // geocode failure is non-fatal
        }
      }
      const payload: Settings = {
        profile_name: form.profile_name.trim() || "Patient",
        dob: form.dob || undefined,
        diagnosis_date: form.diagnosis_date || undefined,
        height_cm: toNum(form.height_cm),
        baseline_weight_kg: toNum(form.baseline_weight_kg),
        baseline_date: form.baseline_weight_kg ? todayISO() : undefined,
        baseline_grip_dominant_kg: toNum(form.baseline_grip_dominant_kg),
        baseline_gait_speed_ms: toNum(form.baseline_gait_speed_ms),
        baseline_sit_to_stand: toNum(form.baseline_sit_to_stand),
        baseline_sts_5x_seconds: toNum(form.baseline_sts_5x_seconds),
        baseline_tug_seconds: toNum(form.baseline_tug_seconds),
        baseline_muac_cm: toNum(form.baseline_muac_cm),
        baseline_calf_cm: toNum(form.baseline_calf_cm),
        locale: form.locale,
        managing_oncologist: form.managing_oncologist.trim() || undefined,
        managing_oncologist_phone:
          form.managing_oncologist_phone.trim() || undefined,
        hospital_name: form.hospital_name.trim() || undefined,
        hospital_phone: form.hospital_phone.trim() || undefined,
        hospital_address: form.hospital_address.trim() || undefined,
        oncall_phone: form.oncall_phone.trim() || undefined,
        emergency_instructions:
          form.emergency_instructions.trim() || undefined,
        home_city: form.home_city.trim() || undefined,
        home_lat,
        home_lon,
        home_timezone,
        anthropic_api_key: form.anthropic_api_key.trim() || undefined,
        onboarded_at: ts,
        created_at: existingSettings?.[0]?.created_at ?? ts,
        updated_at: ts,
      };
      const existing = existingSettings?.[0];
      if (existing?.id) {
        await db.settings.put({ ...payload, id: existing.id });
      } else {
        await db.settings.add(payload);
      }
      setUILocale(form.locale);
      setEnteredBy("hulin");

      if (form.start_cycle && form.cycle_start_date) {
        await db.treatment_cycles.add({
          protocol_id: form.protocol_id,
          cycle_number: 1,
          start_date: form.cycle_start_date,
          status: "active",
          dose_level: 0,
          created_at: ts,
          updated_at: ts,
        });
      }
      router.replace("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Anchor className="h-5 w-5 text-[var(--tide-2)]" />
          <div className="serif text-lg tracking-tight">Anchor</div>
        </div>
        <div className="eyebrow">
          {STEP_LABELS[locale][step]} · {stepIdx + 1}/{STEPS.length}
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-ink-900 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {step === "welcome" && <WelcomeStep locale={locale} />}
      {step === "profile" && (
        <ProfileStep form={form} update={update} locale={locale} />
      )}
      {step === "team" && (
        <TeamStep form={form} update={update} locale={locale} />
      )}
      {step === "baselines" && (
        <BaselinesStep form={form} update={update} locale={locale} />
      )}
      {step === "treatment" && (
        <TreatmentStep form={form} update={update} locale={locale} />
      )}
      {step === "preferences" && (
        <PreferencesStep form={form} update={update} locale={locale} />
      )}
      {step === "done" && <DoneStep form={form} locale={locale} />}

      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {step !== "welcome" && (
            <Button variant="ghost" onClick={back}>
              <ChevronLeft className="h-4 w-4" />
              {t("onboarding.back")}
            </Button>
          )}
          {CAN_SKIP_FROM.includes(step) && (
            <button
              type="button"
              onClick={skipToEnd}
              className="text-[12px] text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
            >
              {locale === "zh" ? "其余稍后再填" : "Finish setup later"}
            </button>
          )}
        </div>
        {step !== "done" ? (
          <Button onClick={forward} disabled={!canContinue} size="lg">
            {step === "welcome"
              ? t("onboarding.begin")
              : t("onboarding.continue")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={saving} size="lg">
            <Check className="h-4 w-4" />
            {saving ? t("onboarding.saving") : t("onboarding.saveAndContinue")}
          </Button>
        )}
      </div>
    </div>
  );
}

function WelcomeStep({ locale }: { locale: Locale }) {
  return (
    <Card className="p-6">
      <div className="serif text-[26px] leading-tight">
        {locale === "zh"
          ? "我们一起开始吧"
          : "Let's set up Anchor together"}
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-700">
        {locale === "zh"
          ? "只需一两分钟：填姓名与语言偏好就能进入主界面。其余（医疗团队、基线数据、化疗方案）可以随时在设置里补齐。"
          : "One or two minutes: a name and language preference is all that's needed to reach the dashboard. Everything else (clinical team, baselines, treatment) can be filled in later from Settings."}
      </p>
      <ul className="mt-4 space-y-2 text-[13px] text-ink-500">
        {(locale === "zh"
          ? [
              "数据留在本设备。登录后可同步。",
              "每一步都可以选择“其余稍后再填”。",
              "所有字段都不是硬性的。",
            ]
          : [
              "Data stays on this device. Sync is optional, after signing in.",
              "At any step you can tap 'Finish setup later'.",
              "No field is required.",
            ]
        ).map((t, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--tide-2)]" />
            {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProfileStep({
  form,
  update,
  locale,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  locale: Locale;
}) {
  return (
    <Card className="p-6 space-y-4">
      <div className="serif text-[22px] leading-tight">
        {locale === "zh" ? "你的信息" : "About you"}
      </div>
      <Field label={locale === "zh" ? "姓名" : "Name"}>
        <TextInput
          value={form.profile_name}
          onChange={(e) => update("profile_name", e.target.value)}
          placeholder={locale === "zh" ? "例如：胡林" : "e.g. Hu Lin"}
          autoFocus
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={locale === "zh" ? "出生日期" : "Date of birth"}>
          <TextInput
            type="date"
            value={form.dob}
            onChange={(e) => update("dob", e.target.value)}
          />
        </Field>
        <Field label={locale === "zh" ? "确诊日期" : "Diagnosis date"}>
          <TextInput
            type="date"
            value={form.diagnosis_date}
            onChange={(e) => update("diagnosis_date", e.target.value)}
          />
        </Field>
      </div>
    </Card>
  );
}

function TeamStep({
  form,
  update,
  locale,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  locale: Locale;
}) {
  return (
    <Card className="p-6 space-y-4">
      <div>
        <div className="serif text-[22px] leading-tight">
          {locale === "zh" ? "医疗团队" : "Clinical team"}
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {locale === "zh"
            ? "这些电话会出现在紧急情况下的提示卡上。"
            : "These numbers appear on the emergency card when a red-zone alert fires."}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={locale === "zh" ? "主诊肿瘤科医师" : "Managing oncologist"}>
          <TextInput
            value={form.managing_oncologist}
            onChange={(e) => update("managing_oncologist", e.target.value)}
            placeholder="Dr Michael Lee"
          />
        </Field>
        <Field label={locale === "zh" ? "主诊电话" : "Oncologist phone"}>
          <TextInput
            type="tel"
            value={form.managing_oncologist_phone}
            onChange={(e) =>
              update("managing_oncologist_phone", e.target.value)
            }
            placeholder="+61 …"
          />
        </Field>
        <Field label={locale === "zh" ? "医院 / 中心" : "Hospital / centre"}>
          <TextInput
            value={form.hospital_name}
            onChange={(e) => update("hospital_name", e.target.value)}
            placeholder="Epworth Richmond"
          />
        </Field>
        <Field label={locale === "zh" ? "医院电话" : "Hospital main line"}>
          <TextInput
            type="tel"
            value={form.hospital_phone}
            onChange={(e) => update("hospital_phone", e.target.value)}
          />
        </Field>
        <Field
          label={locale === "zh" ? "24 小时值班电话" : "24/7 on-call"}
          className="sm:col-span-2"
        >
          <TextInput
            type="tel"
            value={form.oncall_phone}
            onChange={(e) => update("oncall_phone", e.target.value)}
            placeholder={
              locale === "zh"
                ? "发热或急症时拨打"
                : "Ring this for fever or emergency"
            }
          />
        </Field>
        <Field
          label={locale === "zh" ? "医院地址" : "Hospital address"}
          className="sm:col-span-2"
        >
          <TextInput
            value={form.hospital_address}
            onChange={(e) => update("hospital_address", e.target.value)}
          />
        </Field>
        <Field
          label={
            locale === "zh"
              ? "何时直接去医院（可选）"
              : "When to go straight to hospital (optional)"
          }
          className="sm:col-span-2"
        >
          <Textarea
            rows={3}
            value={form.emergency_instructions}
            onChange={(e) =>
              update("emergency_instructions", e.target.value)
            }
            placeholder={
              locale === "zh"
                ? "体温 ≥ 38 °C、寒战、持续呕吐…"
                : "Temp ≥ 38 °C, uncontrolled vomiting, new bleeding…"
            }
          />
        </Field>
      </div>
    </Card>
  );
}

function BaselinesStep({
  form,
  update,
  locale,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  locale: Locale;
}) {
  return (
    <Card className="p-6 space-y-4">
      <div>
        <div className="serif text-[22px] leading-tight">
          {locale === "zh" ? "基线数据" : "Baselines"}
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {locale === "zh"
            ? "用于后续的体重、握力、步速等对比。没有测量过的可以先跳过。"
            : "Used to compare weight / grip / gait over time. Skip any you haven't measured."}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={locale === "zh" ? "身高 (cm)" : "Height (cm)"}>
          <TextInput
            type="number"
            step="0.5"
            value={form.height_cm}
            onChange={(e) => update("height_cm", e.target.value)}
          />
        </Field>
        <Field label={locale === "zh" ? "体重 (kg)" : "Weight (kg)"}>
          <TextInput
            type="number"
            step="0.1"
            value={form.baseline_weight_kg}
            onChange={(e) => update("baseline_weight_kg", e.target.value)}
          />
        </Field>
        <Field
          label={
            locale === "zh"
              ? "握力 — 惯用手 (kg)"
              : "Grip — dominant (kg)"
          }
        >
          <TextInput
            type="number"
            step="0.5"
            value={form.baseline_grip_dominant_kg}
            onChange={(e) =>
              update("baseline_grip_dominant_kg", e.target.value)
            }
          />
        </Field>
        <Field
          label={locale === "zh" ? "4 米步速 (m/s)" : "4 m gait speed (m/s)"}
        >
          <TextInput
            type="number"
            step="0.05"
            value={form.baseline_gait_speed_ms}
            onChange={(e) => update("baseline_gait_speed_ms", e.target.value)}
          />
        </Field>
        <Field
          label={
            locale === "zh"
              ? "30 秒坐立次数"
              : "30 s sit-to-stand (count)"
          }
        >
          <TextInput
            type="number"
            step="1"
            value={form.baseline_sit_to_stand}
            onChange={(e) => update("baseline_sit_to_stand", e.target.value)}
          />
        </Field>
        <Field
          label={
            locale === "zh" ? "5 次坐立 (秒)" : "5× sit-to-stand (s)"
          }
        >
          <TextInput
            type="number"
            step="0.1"
            value={form.baseline_sts_5x_seconds}
            onChange={(e) =>
              update("baseline_sts_5x_seconds", e.target.value)
            }
          />
        </Field>
        <Field
          label={
            locale === "zh" ? "起立行走 TUG (秒)" : "Timed Up-and-Go (s)"
          }
        >
          <TextInput
            type="number"
            step="0.1"
            value={form.baseline_tug_seconds}
            onChange={(e) => update("baseline_tug_seconds", e.target.value)}
          />
        </Field>
        <Field
          label={locale === "zh" ? "上臂围 MUAC (cm)" : "Upper arm (MUAC, cm)"}
        >
          <TextInput
            type="number"
            step="0.5"
            value={form.baseline_muac_cm}
            onChange={(e) => update("baseline_muac_cm", e.target.value)}
          />
        </Field>
        <Field label={locale === "zh" ? "小腿围 (cm)" : "Calf (cm)"}>
          <TextInput
            type="number"
            step="0.5"
            value={form.baseline_calf_cm}
            onChange={(e) => update("baseline_calf_cm", e.target.value)}
          />
        </Field>
      </div>
    </Card>
  );
}

function TreatmentStep({
  form,
  update,
  locale,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  locale: Locale;
}) {
  const protocol = PROTOCOL_BY_ID[form.protocol_id];
  return (
    <Card className="p-6 space-y-4">
      <div>
        <div className="serif text-[22px] leading-tight">
          {locale === "zh" ? "当前化疗" : "Active treatment"}
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {locale === "zh"
            ? "如果现在在化疗中，选方案和第 1 次用药日期 —— 今日卡片就会显示周期第几天。"
            : "If chemotherapy is underway, pick the protocol and day-1 date. The Today card and nudges key off this."}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.start_cycle}
          onChange={(e) => update("start_cycle", e.target.checked)}
          className="h-4 w-4"
        />
        {locale === "zh"
          ? "我当前正在治疗"
          : "I'm currently on a protocol"}
      </label>

      {form.start_cycle && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={locale === "zh" ? "方案" : "Protocol"}>
            <select
              value={form.protocol_id}
              onChange={(e) =>
                update("protocol_id", e.target.value as ProtocolId)
              }
              className="h-11 w-full rounded-[var(--r-md)] border border-ink-200 bg-paper-2 px-3 text-sm"
            >
              {PROTOCOL_LIBRARY.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.short_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={locale === "zh" ? "第 1 天日期" : "Day-1 date"}>
            <TextInput
              type="date"
              value={form.cycle_start_date}
              onChange={(e) => update("cycle_start_date", e.target.value)}
            />
          </Field>
          {protocol && (
            <div className="sm:col-span-2 rounded-[var(--r-md)] bg-[var(--tide-soft)] p-3 text-xs leading-relaxed text-ink-900">
              <div className="eyebrow mb-1 text-[var(--tide-2)]">
                {protocol.short_name}
              </div>
              {protocol.description[locale]}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PreferencesStep({
  form,
  update,
  locale,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  locale: Locale;
}) {
  return (
    <Card className="p-6 space-y-4">
      <div>
        <div className="serif text-[22px] leading-tight">
          {locale === "zh" ? "偏好设置" : "Preferences"}
        </div>
      </div>

      <Field label={locale === "zh" ? "语言" : "Language"}>
        <div className="flex gap-2">
          {(
            [
              ["en", "English"],
              ["zh", "中文"],
            ] as const
          ).map(([v, label]) => {
            const active = form.locale === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => update("locale", v)}
                className={cn(
                  "flex-1 rounded-[var(--r-md)] border px-3 py-2 text-sm font-medium",
                  active
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper-2 text-ink-700",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label={locale === "zh" ? "所在城市（可选 — 用于天气建议）" : "Home city (optional — used for weather-aware nudges)"}
        hint={
          locale === "zh"
            ? "例如：Melbourne。我们只把城市名发给 open-meteo 的天气 API。"
            : "e.g. Melbourne. We only send the city name to open-meteo's public weather API."
        }
      >
        <TextInput
          value={form.home_city}
          onChange={(e) => update("home_city", e.target.value)}
          placeholder="Melbourne"
        />
      </Field>

      <Field
        label={
          locale === "zh"
            ? "Anthropic API Key（可选 — 用于 AI 教练和报告解析）"
            : "Anthropic API key (optional — unlocks the AI coach and report parsing)"
        }
        hint={
          locale === "zh"
            ? "留空也没关系，本地功能全部可用。之后可以在设置里加。"
            : "Leave blank and everything local still works. You can add it later in Settings."
        }
      >
        <TextInput
          type="password"
          value={form.anthropic_api_key}
          onChange={(e) => update("anthropic_api_key", e.target.value)}
          placeholder="sk-ant-..."
          autoComplete="off"
        />
      </Field>
    </Card>
  );
}

function DoneStep({ form, locale }: { form: FormState; locale: Locale }) {
  const rows: Array<[string, string]> = [
    [
      locale === "zh" ? "姓名" : "Name",
      form.profile_name || (locale === "zh" ? "—" : "—"),
    ],
    [
      locale === "zh" ? "主诊" : "Oncologist",
      form.managing_oncologist || (locale === "zh" ? "未填" : "Not set"),
    ],
    [
      locale === "zh" ? "医院" : "Hospital",
      form.hospital_name || (locale === "zh" ? "未填" : "Not set"),
    ],
    [
      locale === "zh" ? "24 小时值班" : "24/7 on-call",
      form.oncall_phone || (locale === "zh" ? "未填" : "Not set"),
    ],
    [
      locale === "zh" ? "体重基线" : "Weight baseline",
      form.baseline_weight_kg
        ? `${form.baseline_weight_kg} kg`
        : locale === "zh"
          ? "未填"
          : "Not set",
    ],
    [
      locale === "zh" ? "方案" : "Protocol",
      form.start_cycle
        ? `${form.protocol_id} · ${form.cycle_start_date}`
        : locale === "zh"
          ? "暂未开始"
          : "Not started",
    ],
  ];

  return (
    <Card className="p-6 space-y-4">
      <div className="serif text-[22px] leading-tight">
        {locale === "zh" ? "准备好了" : "You're ready"}
      </div>
      <p className="text-sm text-ink-500">
        {locale === "zh"
          ? "下面是你的设置摘要。按“保存并继续”进入今日页面。"
          : "Here's what we've captured. Hit save to go to Today."}
      </p>
      <CardContent className="p-0">
        <dl className="divide-y divide-ink-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <dt className="text-sm text-ink-500">{label}</dt>
              <dd className="text-sm font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
