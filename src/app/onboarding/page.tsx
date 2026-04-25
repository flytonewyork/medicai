"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db, now } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";
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
// that gets every user onto the dashboard quickly. Team / treatment are
// optional detail — skippable via "Finish setup later" so the patient
// isn't gated behind data they don't have on hand.
//
// Baselines (weight, grip, gait speed, sit-to-stand, MUAC, calf) are
// deliberately NOT collected here. They belong in the first
// comprehensive assessment, where they are taken with proper
// instruments and form part of the pillar baseline that subsequent
// assessments compare against. Onboarding's job is to get the patient
// onto the dashboard fast; clinical measurements come later.
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

  const [form, setForm] = useState<FormState>({ ...EMPTY, locale });
  const [step, setStep] = useState<StepKey>("welcome");
  const [saving, setSaving] = useState(false);

  // If already onboarded, bounce back to dashboard.
  useEffect(() => {
    const s = existingSettings;
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
        locale: s.locale,
        home_city: s.home_city ?? "",
      }));
    }
  }, [existingSettings, router]);

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
        // Baselines are deliberately NOT collected during onboarding —
        // they belong in the first comprehensive assessment, where the
        // measurements can be taken with proper instruments and form
        // the pillar baseline. The settings row will pick them up the
        // first time the patient runs through /assessment.
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
      setEnteredBy(
        form.user_type === "caregiver"
          ? "catherine"
          : form.user_type === "clinician"
            ? "clinician"
            : "hulin",
      );

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
        <div className="eyebrow">
          {STEP_LABELS[locale][step]} · {stepIdx + 1}/{steps.length}
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-ink-100">
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
            <button
              type="button"
              onClick={skipToEnd}
              className="text-[12px] text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
            >
              {locale === "zh" ? "其余稍后再填" : "Finish setup later"}
            </button>
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
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      name: string;
      patient_display_name: string;
      created_at: string;
      member_count: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When the discovery RPC isn't installed (typically because the carer-
  // onboarding migration hasn't been applied), we fall back to an
  // invite-token paste box so the user can still complete onboarding.
  const [pickerUnavailable, setPickerUnavailable] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { listAllHouseholds } = await import(
          "~/lib/supabase/households"
        );
        const all = await listAllHouseholds();
        if (!cancelled) setRows(all);
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
  }, []);

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
          "Pick the patient already using Anchor. You'll join their care team — no baselines or clinical setup on your end.",
          "选择已在使用 Anchor 的患者。您将加入其护理团队 —— 无需输入基线或临床信息。",
        )}
      </p>

      {joinedName && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--ok)]/40 bg-[var(--ok-soft)] p-3 text-[12.5px] text-ink-700">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ok)]" />
          <div>
            <div className="font-semibold text-ink-900">
              {L("You're in.", "已加入。")}
            </div>
            <div className="text-ink-500">
              {L(`Joined ${joinedName}'s care team.`, `已加入 ${joinedName} 的护理团队。`)}
            </div>
          </div>
        </div>
      )}

      {loading && !joinedName && (
        <div className="rounded-md border border-ink-200 bg-paper-2 p-3 text-[12.5px] text-ink-500">
          {L("Loading patients…", "加载中…")}
        </div>
      )}

      {!loading && !joinedName && !pickerUnavailable && !error && rows.length === 0 && (
        <div className="rounded-md border border-dashed border-ink-300 bg-paper p-4 text-[12.5px] text-ink-600">
          {L(
            "No patients have set up Anchor yet. Ask the person you're supporting to create their profile first, or set up a fresh patient yourself.",
            "尚无患者设置 Anchor。请先请患者本人创建资料,或由您自己开始新患者流程。",
          )}
        </div>
      )}

      {!loading && !joinedName && rows.length > 0 && (
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

      {!loading && !joinedName && pickerUnavailable && (
        <div className="space-y-3 rounded-md border border-ink-200 bg-paper-2 p-4">
          <div className="text-[12.5px] text-ink-700">
            {L(
              "Browsing every patient isn't enabled on this server yet. If the patient already has Anchor set up, paste the invite link they sent you.",
              "本服务器尚未开启患者浏览功能。如对方已在使用 Anchor,请粘贴 ta 发来的邀请链接。",
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
          <p className="text-[11.5px] text-ink-400">
            {L(
              "Server admin: apply migration 2026_04_24_slice_p_caregiver_onboarding_reload.sql in Supabase to enable the picker.",
              "服务器管理员:在 Supabase 中应用迁移 2026_04_24_slice_p_caregiver_onboarding_reload.sql 即可启用选择器。",
            )}
          </p>
        </div>
      )}

      {error && !joinedName && (
        <div className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2.5 text-[12px] text-[var(--warn)]">
          {error}
        </div>
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
