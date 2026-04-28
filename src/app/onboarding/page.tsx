"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db, now } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { useLocale, useT, useL } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";
import { useUIStore } from "~/stores/ui-store";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Select, TextInput, Textarea } from "~/components/ui/field";
import { Alert } from "~/components/ui/alert";
import { InlineSignIn } from "~/components/auth/inline-sign-in";
import { PROTOCOL_LIBRARY, PROTOCOL_BY_ID } from "~/config/protocols";
import {
  MELBOURNE_ONCOLOGISTS,
  HOSPITAL_BY_ID,
  ONCOLOGIST_BY_ID,
} from "~/config/oncologists";
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
// that gets every user onto the dashboard quickly. Team / treatment are
// optional detail — skippable via "Finish setup later" so the patient
// isn't gated behind data they don't have on hand.
//
// Anthropometric baselines that need calipers (MUAC, calf) and the
// functional baselines (grip, gait speed, sit-to-stand) belong in the
// first comprehensive assessment, where they're taken with proper
// instruments. Onboarding only captures weight + height — values the
// patient already knows or can read off a bathroom scale. The captured
// weight is filed into today's daily_entries row so the metrics
// registry, graph views, and subsequent /log entries all read from the
// same place.
const PATIENT_STEPS = [
  "welcome",
  "user_type",
  "profile",
  "preferences",
  "team",
  "treatment",
  "done",
] as const;

// Caregiver / clinician onboarding: pick the patient they're joining
// from a list, fill in their own name + preferences, land on /family.
// Baselines / team / treatment belong to the patient and are skipped.
const CAREGIVER_STEPS = [
  "welcome",
  "user_type",
  "pick_patient",
  "profile",
  "preferences",
  "done",
] as const;

type StepKey =
  | (typeof PATIENT_STEPS)[number]
  | (typeof CAREGIVER_STEPS)[number];

// Steps the user can "Finish setup later" from — i.e. jump straight to
// done without filling the remaining steps.
const CAN_SKIP_FROM: StepKey[] = [
  "profile",
  "preferences",
  "team",
  "treatment",
  "pick_patient",
];

const STEP_LABELS: Record<Locale, Record<StepKey, string>> = {
  en: {
    welcome: "Welcome",
    user_type: "Who you are",
    pick_patient: "Pick a patient",
    profile: "About you",
    team: "Clinical team",
    treatment: "Treatment",
    preferences: "Preferences",
    done: "All set",
  },
  zh: {
    welcome: "欢迎",
    user_type: "您的身份",
    pick_patient: "选择患者",
    profile: "基本信息",
    team: "医疗团队",
    treatment: "治疗方案",
    preferences: "偏好设置",
    done: "完成",
  },
};

interface FormState {
  user_type: "patient" | "caregiver" | "clinician" | "";
  invite_code: string;
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
  weight_kg: string;
  start_cycle: boolean;
  protocol_id: ProtocolId;
  cycle_start_date: string;
  locale: Locale;
  home_city: string;
}

const EMPTY: FormState = {
  user_type: "",
  invite_code: "",
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
  weight_kg: "",
  start_cycle: false,
  protocol_id: "gnp_weekly",
  cycle_start_date: todayISO(),
  locale: "en",
  home_city: "",
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
  const existingSettings = useSettings();

  // Re-entry escape hatch. A caregiver who completed onboarding on
  // device but never picked a patient (cancelled mid-flow, or the join
  // RPC errored) was previously trapped: /onboarding bounced to / and
  // / bounced back to /family, which had no recovery surface. The
  // NoHouseholdBanner on /family now links here with `?step=pick_patient`
  // so we can skip the "already onboarded" bounce and drop them
  // straight into the PickPatientStep.
  const [rejoinTarget, setRejoinTarget] = useState<StepKey | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("step");
    if (target === "pick_patient" || target === "user_type") {
      setRejoinTarget(target as StepKey);
    }
  }, []);

  const [form, setForm] = useState<FormState>({ ...EMPTY, locale });
  const [step, setStep] = useState<StepKey>("welcome");
  const [saving, setSaving] = useState(false);

  // If already onboarded, bounce back to dashboard — UNLESS the user
  // is explicitly re-entering via `?step=…` (caregiver-finds-patient
  // recovery flow). In that case we drop them on the requested step
  // and prefill EVERY field from existing settings so finish() (which
  // does a full `db.settings.put`) doesn't blow away other fields.
  useEffect(() => {
    const s = existingSettings;
    if (s?.onboarded_at && rejoinTarget) {
      setForm((f) => ({
        ...f,
        user_type:
          rejoinTarget === "pick_patient"
            ? "caregiver"
            : s.user_type ?? f.user_type,
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
        weight_kg: s.baseline_weight_kg ? String(s.baseline_weight_kg) : "",
        locale: s.locale ?? f.locale,
        home_city: s.home_city ?? "",
      }));
      setStep(rejoinTarget);
      return;
    }
    if (s?.onboarded_at) {
      router.replace("/");
    } else if (s) {
      // Prefill from partial existing settings
      setForm((f) => ({
        ...f,
        user_type: s.user_type ?? f.user_type,
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
        weight_kg: s.baseline_weight_kg ? String(s.baseline_weight_kg) : "",
        locale: s.locale,
        home_city: s.home_city ?? "",
      }));
    }
  }, [existingSettings, rejoinTarget, router]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // The visible step sequence follows user type — caregivers don't get
  // walked through baselines / team / treatment, which are all patient-
  // authored values.
  const steps: readonly StepKey[] =
    form.user_type === "caregiver" || form.user_type === "clinician"
      ? CAREGIVER_STEPS
      : PATIENT_STEPS;

  const stepIdx = steps.indexOf(step);
  const progress = ((Math.max(0, stepIdx) + 1) / steps.length) * 100;

  function back() {
    const i = steps.indexOf(step);
    if (i > 0) {
      const prev = steps[i - 1];
      if (prev) setStep(prev);
    }
  }

  function forward() {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) {
      const next = steps[i + 1];
      if (next) setStep(next);
    }
  }

  function skipToEnd() {
    setStep("done");
  }

  const canContinue = useMemo(() => {
    if (step === "user_type") return form.user_type !== "";
    if (step === "profile") return form.profile_name.trim().length > 0;
    return true;
  }, [step, form.profile_name, form.user_type]);

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
      const isCaregiver =
        form.user_type === "caregiver" || form.user_type === "clinician";
      const weightOnboarding = isCaregiver ? undefined : toNum(form.weight_kg);
      const today = todayISO();
      const payload: Settings = {
        user_type: form.user_type || undefined,
        // Caregivers don't own baselines, team contacts, or treatment
        // data — that's the patient's territory. Write their own name +
        // locale + timezone only. The Supabase join ensures the patient's
        // data is still reachable via /family.
        profile_name: form.profile_name.trim() || "Patient",
        dob: isCaregiver ? undefined : form.dob || undefined,
        diagnosis_date: isCaregiver ? undefined : form.diagnosis_date || undefined,
        height_cm: isCaregiver ? undefined : toNum(form.height_cm),
        // Weight captured during onboarding seeds the baseline used by
        // the nutrition card and the BMI / weight-change calculations
        // in useBodyMetrics. The same value is also written into a
        // daily_entries row below so the metrics registry / graph
        // views see today's reading and so subsequent /log "weight 68
        // kg" entries upsert into that same row.
        baseline_weight_kg: weightOnboarding ?? existingSettings?.baseline_weight_kg,
        baseline_date:
          weightOnboarding != null
            ? today
            : existingSettings?.baseline_date,
        // Functional + caliper baselines (grip, gait, MUAC, calf, etc.)
        // are still collected on the first comprehensive assessment,
        // where they're taken with proper instruments.
        locale: form.locale,
        managing_oncologist: isCaregiver
          ? undefined
          : form.managing_oncologist.trim() || undefined,
        managing_oncologist_phone: isCaregiver
          ? undefined
          : form.managing_oncologist_phone.trim() || undefined,
        hospital_name: isCaregiver
          ? undefined
          : form.hospital_name.trim() || undefined,
        hospital_phone: isCaregiver
          ? undefined
          : form.hospital_phone.trim() || undefined,
        hospital_address: isCaregiver
          ? undefined
          : form.hospital_address.trim() || undefined,
        oncall_phone: isCaregiver
          ? undefined
          : form.oncall_phone.trim() || undefined,
        emergency_instructions: isCaregiver
          ? undefined
          : form.emergency_instructions.trim() || undefined,
        home_city: form.home_city.trim() || undefined,
        home_lat,
        home_lon,
        home_timezone,
        onboarded_at: ts,
        created_at: existingSettings?.created_at ?? ts,
        updated_at: ts,
      };
      const existing = existingSettings;
      if (existing?.id) {
        await db.settings.put({ ...payload, id: existing.id });
      } else {
        await db.settings.add(payload);
      }
      setUILocale(form.locale);
      const enteredBy =
        form.user_type === "caregiver"
          ? "catherine"
          : form.user_type === "clinician"
            ? "clinician"
            : "hulin";
      setEnteredBy(enteredBy);

      // Seed today's daily_entries row with the onboarding weight (and
      // height, if entered). The /log route's direct-file parser
      // upserts into the same row keyed by date, so a later "weight
      // 68 kg" message updates this entry rather than creating a
      // parallel one. The metrics registry reads weight_kg straight
      // off daily_entries, so any graph/trend view picks the value up
      // automatically.
      if (!isCaregiver && weightOnboarding != null) {
        const heightOnboarding = toNum(form.height_cm);
        const existingDaily = await db.daily_entries
          .where("date")
          .equals(today)
          .first();
        if (existingDaily?.id) {
          await db.daily_entries.update(existingDaily.id, {
            weight_kg: weightOnboarding,
            ...(heightOnboarding != null
              ? { height_cm: heightOnboarding }
              : {}),
            updated_at: ts,
          });
        } else {
          await db.daily_entries.add({
            date: today,
            entered_at: ts,
            entered_by: enteredBy,
            weight_kg: weightOnboarding,
            ...(heightOnboarding != null
              ? { height_cm: heightOnboarding }
              : {}),
            created_at: ts,
            updated_at: ts,
          });
        }
      }

      if (!isCaregiver && form.start_cycle && form.cycle_start_date) {
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

      // Slice A — if the user is signed in and doesn't already belong to
      // a household, stand one up now with themselves as primary_carer.
      // Invited family members arrive via /invite/<token> which skips
      // onboarding entirely, so any user reaching this point is the one
      // creating the household.
      try {
        const { getSupabaseBrowser } = await import("~/lib/supabase/client");
        const sb = getSupabaseBrowser();
        if (sb) {
          const { data: auth } = await sb.auth.getUser();
          if (auth.user) {
            const {
              getCurrentMembership,
              createHousehold,
              updateMyProfile,
            } = await import("~/lib/supabase/households");
            const existing = await getCurrentMembership();
            if (!existing) {
              await createHousehold({
                name: `${(form.profile_name || "Patient").trim()}'s family`,
                patient_name: (form.profile_name || "Patient").trim(),
              });
            }
            // Mirror the user-facing name + locale onto their profile
            // so carers see a sensible display name everywhere.
            await updateMyProfile({
              display_name: (form.profile_name || "").trim() || "Patient",
              locale: form.locale,
            });
          }
        }
      } catch {
        // Network or Supabase hiccup shouldn't block onboarding; the
        // Settings → Household section lets the user finish setup.
      }

      // Caregivers + clinicians land on /family — the caregiver-focused
      // shell. Patients stay on / (the full dashboard).
      router.replace(isCaregiver ? "/family" : "/");
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
        <div
          className="eyebrow"
          aria-current="step"
          aria-label={
            locale === "zh"
              ? `${STEP_LABELS[locale][step]} · 第 ${stepIdx + 1} 步，共 ${steps.length} 步`
              : `${STEP_LABELS[locale][step]} · step ${stepIdx + 1} of ${steps.length}`
          }
        >
          {STEP_LABELS[locale][step]} · {stepIdx + 1}/{steps.length}
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-ink-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label={
            locale === "zh"
              ? `第 ${stepIdx + 1} 步，共 ${steps.length} 步`
              : `Step ${stepIdx + 1} of ${steps.length}`
          }
        >
          <div
            className="h-full bg-ink-900 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {step === "welcome" && <WelcomeStep locale={locale} />}
      {step === "user_type" && (
        <UserTypeStep form={form} update={update} locale={locale} />
      )}
      {step === "pick_patient" && (
        <PickPatientStep
          onJoined={() => setStep("profile")}
          onStartFresh={() => {
            update("user_type", "patient");
            setStep("profile");
          }}
          locale={locale}
        />
      )}
      {step === "profile" && (
        <ProfileStep form={form} update={update} locale={locale} />
      )}
      {step === "team" && (
        <TeamStep form={form} update={update} locale={locale} />
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
            <Button variant="ghost" onClick={skipToEnd} className="text-ink-500 hover:text-ink-800">
              {locale === "zh" ? "其余稍后再填" : "Finish setup later"}
            </Button>
          )}
        </div>
        {step === "done" ? (
          <Button onClick={finish} disabled={saving} size="lg">
            <Check className="h-4 w-4" />
            {saving ? t("onboarding.saving") : t("onboarding.saveAndContinue")}
          </Button>
        ) : step === "pick_patient" ? (
          // Pick-patient drives its own navigation (tap a row → joins →
          // advances), so no Continue button. Skip + Back still work.
          null
        ) : (
          <Button onClick={forward} disabled={!canContinue} size="lg">
            {step === "welcome"
              ? t("onboarding.begin")
              : t("onboarding.continue")}
            <ChevronRight className="h-4 w-4" />
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

function UserTypeStep({
  form,
  update,
  locale,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  locale: Locale;
}) {
  const options: Array<{
    id: "patient" | "caregiver" | "clinician";
    title: { en: string; zh: string };
    body: { en: string; zh: string };
  }> = [
    {
      id: "patient",
      title: { en: "I'm the patient", zh: "我是患者" },
      body: {
        en: "You'll log your own check-ins. Family and clinicians can join later via an invite link.",
        zh: "您本人记录每日检查。家人和医生可稍后通过邀请链接加入。",
      },
    },
    {
      id: "caregiver",
      title: { en: "I'm family or a caregiver", zh: "我是家人或照护者" },
      body: {
        en: "You're setting this up to support the patient — or you're already part of their care circle.",
        zh: "您在为患者设置 Anchor —— 或您已是照护圈的一员。",
      },
    },
    {
      id: "clinician",
      title: { en: "I'm a clinician", zh: "我是医护" },
      body: {
        en: "You're part of the medical team and will view the patient's record with their consent.",
        zh: "您是医疗团队的一员，将在患者同意下查看记录。",
      },
    },
  ];
  return (
    <Card className="p-6 space-y-4">
      <div className="serif text-[22px] leading-tight">
        {locale === "zh" ? "您是谁？" : "Who are you?"}
      </div>
      <p className="text-[13px] text-ink-500">
        {locale === "zh"
          ? "这决定了你的第一屏：记录、照护，还是查看。随时可在设置里更改。"
          : "Sets your first screen — logging, supporting, or reviewing. You can change this in Settings anytime."}
      </p>
      <div className="space-y-2">
        {options.map((opt) => {
          const active = form.user_type === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => update("user_type", opt.id)}
              aria-pressed={active}
              className={cn(
                "w-full rounded-xl border p-4 text-left transition-colors",
                active
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-ink-200 bg-paper-2 hover:border-ink-400",
              )}
            >
              <div className="text-[14px] font-semibold">
                {opt.title[locale]}
              </div>
              <div
                className={cn(
                  "mt-1 text-[12.5px]",
                  active ? "text-paper/75" : "text-ink-500",
                )}
              >
                {opt.body[locale]}
              </div>
            </button>
          );
        })}
      </div>
      {form.user_type && form.user_type !== "patient" && (
        <Field
          label={
            locale === "zh"
              ? "患者的邀请代码（如果已有）"
              : "Patient's invite code (if you have one)"
          }
          hint={
            locale === "zh"
              ? "之后也可在「设置 → 家庭/医疗团队」里关联。"
              : "You can also link later from Settings → Family / care team."
          }
        >
          <TextInput
            value={form.invite_code}
            onChange={(e) => update("invite_code", e.target.value)}
            placeholder={locale === "zh" ? "粘贴邀请代码" : "Paste invite code"}
          />
        </Field>
      )}
    </Card>
  );
}

// Supabase's PostgrestError is a plain object, not an Error instance, so the
// usual `String(err)` fallback produces "[object Object]". Prefer `.message`
// whenever it's there.
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return typeof err === "string" && err.length > 0 ? err : "Something went wrong.";
}

function PickPatientStep({
  onJoined,
  onStartFresh,
  locale,
}: {
  onJoined: () => void;
  onStartFresh: () => void;
  locale: Locale;
}) {
  const L = useL();
  const [authState, setAuthState] = useState<
    "unknown" | "signed_out" | "signed_in"
  >("unknown");
  const [rows, setRows] = useState<
    Array<{
      id: string;
      name: string;
      patient_display_name: string;
      created_at: string;
      member_count: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When the discovery RPC isn't installed (typically because the carer-
  // onboarding migration hasn't been applied), the picker becomes
  // pure-paste — used to gate copy that says "or paste a link" vs the
  // standalone fallback. The paste-invite block itself is now ALWAYS
  // visible (a legitimate alternative even when discovery works), so
  // a caregiver who only has a token is never gated behind a flag.
  const [pickerUnavailable, setPickerUnavailable] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  // Resolve auth state up-front. The household-discovery RPC is granted
  // only to `authenticated`; calling it as anon hits a raw permission-
  // denied error that surfaces as untranslated PostgreSQL text. We
  // gate the picker behind sign-in and render <InlineSignIn> when
  // the caregiver hasn't authenticated yet.
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      const { getSupabaseBrowser, isSupabaseConfigured } = await import(
        "~/lib/supabase/client"
      );
      if (!isSupabaseConfigured()) {
        if (!cancelled) setAuthState("signed_out");
        return;
      }
      const sb = getSupabaseBrowser();
      if (!sb) {
        if (!cancelled) setAuthState("signed_out");
        return;
      }
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setAuthState(data.session?.user ? "signed_in" : "signed_out");
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
        if (cancelled) return;
        setAuthState(session?.user ? "signed_in" : "signed_out");
      });
      unsub = () => sub.subscription.unsubscribe();
      // If the component unmounted between the await and here, fire
      // the cleanup we just registered. Otherwise the outer cleanup
      // closure will pick it up.
      if (cancelled) unsub();
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Once signed in, fetch the household list. Re-runs after sign-in
  // because authState transitions from `signed_out` → `signed_in`.
  useEffect(() => {
    if (authState !== "signed_in") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { listAllHouseholds } = await import(
          "~/lib/supabase/households"
        );
        const all = await listAllHouseholds();
        if (!cancelled) {
          setRows(all);
          setPickerUnavailable(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (
          err &&
          typeof err === "object" &&
          (err as { code?: string }).code === "caregiver_picker_unavailable"
        ) {
          setPickerUnavailable(true);
        } else {
          setError(errorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authState]);

  async function join(id: string, displayName: string) {
    setJoining(id);
    setError(null);
    try {
      const { joinHouseholdAsFamily } = await import(
        "~/lib/supabase/households"
      );
      await joinHouseholdAsFamily(id);
      setJoinedName(displayName);
      // Brief celebratory beat so the carer sees the join landed before
      // the wizard pushes them onto the profile step.
      setTimeout(() => onJoined(), 700);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setJoining(null);
    }
  }

  async function acceptPastedInvite() {
    setError(null);
    const { extractInviteToken, acceptInvite } = await import(
      "~/lib/supabase/households"
    );
    const token = extractInviteToken(inviteInput);
    if (!token) {
      setError(
        L(
          "That doesn't look like an Anchor invite link. Paste the full URL or just the token.",
          "这不像是 Anchor 邀请链接。请粘贴完整网址或令牌。",
        ),
      );
      return;
    }
    setAcceptingInvite(true);
    try {
      await acceptInvite(token);
      setJoinedName(L("the care team", "护理团队"));
      setTimeout(() => onJoined(), 700);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAcceptingInvite(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="serif text-[22px] leading-tight">
        {L("Who are you supporting?", "您要支持的是哪位患者?")}
      </div>
      <p className="text-[13px] text-ink-500">
        {L(
          "Pick the patient already using Anchor — or paste an invite link they sent you. You'll join their care team; no clinical setup on your end.",
          "选择已在使用 Anchor 的患者，或粘贴对方发来的邀请链接。您将加入其护理团队 —— 无需输入临床信息。",
        )}
      </p>

      {joinedName && (
        <Alert
          variant="ok"
          title={L("You're in.", "已加入。")}
          dense
        >
          {L(`Joined ${joinedName}'s care team.`, `已加入 ${joinedName} 的护理团队。`)}
        </Alert>
      )}

      {/* Auth gate. The picker RPC requires `authenticated`, so we
          inline a sign-in/sign-up panel rather than punting the user
          out to /login mid-onboarding (which loses every other field
          they entered). After auth the household-list effect re-runs
          automatically. */}
      {!joinedName && authState === "signed_out" && (
        <div className="rounded-md border border-ink-200 bg-paper-2 p-4">
          <InlineSignIn
            title={L(
              "Sign in to find the patient",
              "登录后查找患者",
            )}
            subtitle={L(
              "We need to know who you are before we can list the patients on Anchor or accept an invite link on your behalf.",
              "查看患者列表或代您接受邀请链接前，需先确认您的身份。",
            )}
          />
        </div>
      )}

      {!joinedName && authState === "signed_in" && loading && (
        <div className="rounded-md border border-ink-200 bg-paper-2 p-3 text-[12.5px] text-ink-500">
          {L("Loading patients…", "加载中…")}
        </div>
      )}

      {!joinedName &&
        authState === "signed_in" &&
        !loading &&
        rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((h) => {
              const display = h.patient_display_name || h.name;
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => void join(h.id, display)}
                    disabled={joining !== null}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                      joining === h.id
                        ? "border-[var(--tide-2)] bg-[var(--tide-soft)]"
                        : "border-ink-200 bg-paper-2 hover:border-ink-400",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-semibold text-ink-900">
                        {display}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-ink-500">
                        {h.member_count}{" "}
                        {h.member_count === 1
                          ? L("member", "位成员")
                          : L("members", "位成员")}
                      </div>
                    </div>
                    <span className="mono text-[10px] uppercase tracking-[0.12em] text-ink-400">
                      {joining === h.id ? L("Joining…", "加入中…") : L("Join", "加入")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

      {!joinedName &&
        authState === "signed_in" &&
        !loading &&
        rows.length === 0 &&
        !pickerUnavailable && (
          <div className="rounded-md border border-dashed border-ink-300 bg-paper p-4 text-[12.5px] text-ink-600">
            {L(
              "No patients have set up Anchor yet. Paste an invite link below if you've been sent one, or tap \"I'm setting up a new patient instead\" to start the patient flow yourself.",
              "尚无患者设置 Anchor。如已收到邀请链接，请在下方粘贴；或点击下方“我要新建一位患者”自行开始患者流程。",
            )}
          </div>
        )}

      {/* Paste-invite block — ALWAYS visible once signed in. The
          previous version hid it behind `pickerUnavailable` so a
          caregiver with a token but a working RPC had no way to use
          their token. */}
      {!joinedName && authState === "signed_in" && (
        <div className="space-y-2 rounded-md border border-ink-200 bg-paper-2 p-4">
          <div className="text-[12.5px] text-ink-700">
            {L(
              "Have an invite link from the patient? Paste it here.",
              "已收到患者发来的邀请链接？请在此粘贴。",
            )}
          </div>
          <div className="flex gap-2">
            <TextInput
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder={L(
                "https://anchor.app/invite/…",
                "https://anchor.app/invite/…",
              )}
              disabled={acceptingInvite}
            />
            <Button
              onClick={() => void acceptPastedInvite()}
              disabled={acceptingInvite || inviteInput.trim().length === 0}
            >
              {acceptingInvite ? L("Joining…", "加入中…") : L("Join", "加入")}
            </Button>
          </div>
        </div>
      )}

      {error && !joinedName && (
        <Alert variant="warn" dense>
          {error}
        </Alert>
      )}

      {!joinedName && (
        <button
          type="button"
          onClick={onStartFresh}
          className="text-[12px] text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
        >
          {L("I'm setting up a new patient instead", "我要新建一位患者")}
        </button>
      )}
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
  const isCaregiver =
    form.user_type === "caregiver" || form.user_type === "clinician";
  return (
    <Card className="p-6 space-y-4">
      <div className="serif text-[22px] leading-tight">
        {locale === "zh" ? "你的信息" : "About you"}
      </div>
      <Field label={locale === "zh" ? "姓名" : "Name"}>
        <TextInput
          value={form.profile_name}
          onChange={(e) => update("profile_name", e.target.value)}
          placeholder={locale === "zh" ? "您的姓名" : "Your name"}
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
      {!isCaregiver && (
        <div className="space-y-3">
          <p className="text-xs text-ink-500">
            {locale === "zh"
              ? "今天的体重和身高（可选）。会进入今日记录，并成为体重趋势图的起点；之后在「记录」里说「体重 68 kg」就会更新到同一份资料。"
              : "Today's weight and height (optional). These seed today's check-in and the weight trend; later messages like \"weight 68 kg\" in /log update the same record."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={locale === "zh" ? "体重 (kg)" : "Weight (kg)"}>
              <TextInput
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={form.weight_kg}
                onChange={(e) => update("weight_kg", e.target.value)}
                placeholder="68.0"
              />
            </Field>
            <Field label={locale === "zh" ? "身高 (cm)" : "Height (cm)"}>
              <TextInput
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={form.height_cm}
                onChange={(e) => update("height_cm", e.target.value)}
                placeholder="170"
              />
            </Field>
          </div>
        </div>
      )}
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
  // Match the typed name back to the seed list so re-entering this
  // step shows the correct selection. Fall back to "" (custom).
  const pickedId =
    MELBOURNE_ONCOLOGISTS.find((o) => o.name.en === form.managing_oncologist)
      ?.id ?? "";

  function pickOncologist(id: string) {
    if (!id) {
      // "Other / type my own" — clear the seeded fields so the user
      // can enter their own without overwriting any in-progress edit.
      update("managing_oncologist", "");
      return;
    }
    const onc = ONCOLOGIST_BY_ID[id];
    if (!onc) return;
    const hosp = HOSPITAL_BY_ID[onc.hospital_id];
    update("managing_oncologist", onc.name[locale] ?? onc.name.en);
    if (hosp) {
      update("hospital_name", hosp.name[locale] ?? hosp.name.en);
      update("hospital_phone", hosp.phone);
      update("hospital_address", hosp.address);
      if (hosp.oncall_phone) update("oncall_phone", hosp.oncall_phone);
    }
  }

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
      <Field
        label={
          locale === "zh"
            ? "从墨尔本肿瘤科医师中选择（可选）"
            : "Pick a Melbourne oncologist (optional)"
        }
        hint={
          locale === "zh"
            ? "选定后会自动填写医院信息，可再次修改。"
            : "Selecting prefills the hospital details — you can edit any field after."
        }
      >
        <Select
          value={pickedId}
          onChange={(e) => pickOncologist(e.target.value)}
        >
          <option value="">
            {locale === "zh"
              ? "其他 / 自行输入"
              : "Other / type my own"}
          </option>
          {MELBOURNE_ONCOLOGISTS.map((o) => {
            const hosp = HOSPITAL_BY_ID[o.hospital_id];
            const where = hosp
              ? (hosp.name[locale] ?? hosp.name.en)
              : "";
            return (
              <option key={o.id} value={o.id}>
                {(o.name[locale] ?? o.name.en) +
                  (where ? ` — ${where}` : "")}
              </option>
            );
          })}
        </Select>
      </Field>
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

    </Card>
  );
}

const MONTH_SHORT_EN = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
] as const;

function formatCycleDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return locale === "zh"
    ? `${y} 年 ${m} 月 ${d} 日`
    : `${d} ${MONTH_SHORT_EN[(m - 1) as keyof typeof MONTH_SHORT_EN] ?? ""} ${y}`;
}

function DoneStep({ form, locale }: { form: FormState; locale: Locale }) {
  const protocolLabel = (() => {
    if (!form.start_cycle) return locale === "zh" ? "暂未开始" : "Not started";
    const proto = PROTOCOL_BY_ID[form.protocol_id];
    const name = proto?.short_name ?? form.protocol_id;
    return `${name} · ${formatCycleDate(form.cycle_start_date, locale)}`;
  })();

  const measurementsLabel = (() => {
    const parts: string[] = [];
    if (form.weight_kg) parts.push(`${form.weight_kg} kg`);
    if (form.height_cm) parts.push(`${form.height_cm} cm`);
    if (parts.length === 0) return locale === "zh" ? "未填" : "Not set";
    return parts.join(" · ");
  })();

  const rows: Array<[string, string]> = [
    [
      locale === "zh" ? "姓名" : "Name",
      form.profile_name || (locale === "zh" ? "—" : "—"),
    ],
    [
      locale === "zh" ? "体重 / 身高" : "Weight / height",
      measurementsLabel,
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
    [locale === "zh" ? "方案" : "Protocol", protocolLabel],
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
