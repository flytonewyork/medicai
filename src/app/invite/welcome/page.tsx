"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentProfile,
  getHousehold,
  isProfileComplete,
  updateMyProfile,
} from "~/lib/supabase/households";
import { useHousehold } from "~/hooks/use-household";
import { useUIStore } from "~/stores/ui-store";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import type { Household, Profile } from "~/types/household";
import type { Locale } from "~/types/clinical";
import {
  ACTION_LABEL,
  actionsFor,
  ROLE_LABEL,
} from "~/lib/auth/permissions";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Heart,
  Loader2,
  Users,
  ShieldCheck,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

// Post-acceptance onboarding for an invited family / care-team member. The
// /invite/[token] flow hands off here after `acceptInvite` succeeds so the
// new member can fill in a display name, relationship, locale, and timezone
// before they're dropped into /family. Skippable by design — anything left
// blank falls back to sensible defaults and can be edited later from
// Settings → Household → Your profile.
//
// New in the carer-invite-flow PR: a role-specific "what you can do here"
// step (after preferences). Pulls from the permission matrix so the new
// member knows which surfaces are theirs to use and which are read-only,
// without having to discover it by hitting a disabled button.

type Step = "welcome" | "about" | "preferences" | "permissions" | "done";
const STEPS: Step[] = [
  "welcome",
  "about",
  "preferences",
  "permissions",
  "done",
];

const RELATIONSHIP_SUGGESTIONS: Array<{ id: string; en: string; zh: string }> = [
  { id: "son", en: "Son", zh: "儿子" },
  { id: "daughter", en: "Daughter", zh: "女儿" },
  { id: "spouse", en: "Spouse / partner", zh: "配偶 / 伴侣" },
  { id: "sibling", en: "Sibling", zh: "兄弟姐妹" },
  { id: "parent", en: "Parent", zh: "父母" },
  { id: "friend", en: "Close friend", zh: "好友" },
  { id: "nurse", en: "Nurse", zh: "护士" },
  { id: "doctor", en: "Doctor", zh: "医师" },
  { id: "allied_health", en: "Allied health", zh: "康复 / 营养" },
];

export default function InviteWelcomePage() {
  const router = useRouter();
  const { membership, loading } = useHousehold();
  const setUILocale = useUIStore((s) => s.setLocale);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [step, setStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);

  // Form state; prefilled from existing profile if something's already there.
  const [displayName, setDisplayName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [customRelationship, setCustomRelationship] = useState("");
  const [locale, setLocale] = useState<Locale>("en");
  const [timezone, setTimezone] = useState<string>("");

  // Resolve the browser's IANA timezone as a sensible default. Falls back
  // to Australia/Melbourne (the patient's locale) when the browser can't
  // tell us.
  const browserTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "Australia/Melbourne";
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await getCurrentProfile();
        if (cancelled) return;
        setProfile(p);
        if (p) {
          setDisplayName(p.display_name ?? "");
          setRelationship(p.relationship ?? "");
          setLocale(p.locale ?? "en");
          setTimezone(p.timezone ?? browserTimezone);
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [browserTimezone]);

  useEffect(() => {
    if (!membership?.household_id) return;
    let cancelled = false;
    void (async () => {
      const h = await getHousehold(membership.household_id);
      if (!cancelled) setHousehold(h);
    })();
    return () => {
      cancelled = true;
    };
  }, [membership?.household_id]);

  // Route-guard: if the user hits this URL without an active membership,
  // send them home. And if their profile is already complete, skip the
  // welcome and drop them straight on /family.
  useEffect(() => {
    if (loading || loadingProfile) return;
    if (!membership) {
      router.replace("/");
      return;
    }
    if (isProfileComplete(profile) && step === "welcome") {
      router.replace("/family");
    }
  }, [loading, loadingProfile, membership, profile, router, step]);

  const stepIdx = STEPS.indexOf(step);
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  function pickRelationship(id: string, label: string) {
    setRelationship(label);
    setCustomRelationship("");
  }

  async function finish() {
    setSaving(true);
    try {
      const finalRelationship =
        customRelationship.trim() || relationship.trim() || null;
      await updateMyProfile({
        display_name: displayName.trim() || "Care team member",
        relationship: finalRelationship,
        care_role_label: finalRelationship,
        locale,
        timezone: timezone || browserTimezone,
      });
      setUILocale(locale);
      router.replace("/family");
    } catch {
      // Fail-open: even if the profile write errors we still drop them on
      // /family rather than trapping them here. Settings → Household lets
      // them retry.
      router.replace("/family");
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingProfile) {
    return (
      <div className="mx-auto max-w-md space-y-5 p-6 pt-16">
        <Card>
          <CardContent className="flex items-center gap-2 pt-5 text-[13px] text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!membership) return null;

  const canContinue =
    step !== "about" ||
    displayName.trim().length > 0;

  return (
    <div className="mx-auto max-w-md space-y-5 p-6 pt-12">
      <PageHeader
        eyebrow={L("CARE TEAM", "护理团队")}
        title={L("Welcome to the team", "欢迎加入团队")}
      />
      <div className="h-1 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full bg-[var(--tide-2)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {step === "welcome" && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-[var(--tide-2)]" />
              <div className="text-[14px] font-semibold text-ink-900">
                {household
                  ? L(
                      `You've joined ${household.patient_display_name}'s care team.`,
                      `您已加入 ${household.patient_display_name} 的护理团队。`,
                    )
                  : L("You've joined the care team.", "您已加入护理团队。")}
              </div>
            </div>
            <p className="text-[13px] text-ink-500">
              {L(
                "Two quick questions so everyone knows how you're involved, and you'll see times in your own timezone.",
                "两个简短问题，让大家知道您的身份，并让时间显示为您所在时区。",
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {step === "about" && (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="eyebrow">
              {L("About you", "您的信息")}
            </div>
            <Field label={L("Your name", "您的姓名")}>
              <TextInput
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={L("e.g. Thomas Hu", "例如：胡先生")}
                autoFocus
              />
            </Field>
            <Field
              label={L("Your relationship to the patient", "您与患者的关系")}
              hint={L(
                "Shown on the care-team list — tap a chip or type your own.",
                "会显示在护理团队名单上 —— 点选或自定义。",
              )}
            >
              <div className="flex flex-wrap gap-1.5">
                {RELATIONSHIP_SUGGESTIONS.map((r) => {
                  const label = locale === "zh" ? r.zh : r.en;
                  const active =
                    relationship === label && !customRelationship.trim();
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => pickRelationship(r.id, label)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                        active
                          ? "border-ink-900 bg-ink-900 text-paper"
                          : "border-ink-200 bg-paper-2 text-ink-700 hover:border-ink-400",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <TextInput
                value={customRelationship}
                onChange={(e) => setCustomRelationship(e.target.value)}
                placeholder={L("Or type something else", "或自行输入")}
                className="mt-2"
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {step === "permissions" && membership && (
        <PermissionsStep role={membership.role} locale={locale} />
      )}

      {step === "preferences" && (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="eyebrow">
              {L("Preferences", "偏好设置")}
            </div>
            <Field label={L("Language", "语言")}>
              <div className="flex gap-1.5">
                {(["en", "zh"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocale(l)}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-[12.5px] transition-colors",
                      locale === l
                        ? "border-ink-900 bg-ink-900 text-paper"
                        : "border-ink-200 bg-paper-2 text-ink-700",
                    )}
                  >
                    {l === "en" ? "English" : "中文"}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label={L("Your timezone", "您所在时区")}
              hint={L(
                "Appointment times on /family are shown in this zone. Auto-detected — edit if you're travelling.",
                "家庭视图中的预约时间会按此时区显示。已自动识别 —— 外出时可修改。",
              )}
            >
              <TextInput
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Australia/Melbourne"
              />
              <button
                type="button"
                onClick={() => setTimezone(browserTimezone)}
                className="mt-1 text-[11.5px] text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
              >
                {L(
                  `Use detected (${browserTimezone})`,
                  `使用识别到的（${browserTimezone}）`,
                )}
              </button>
            </Field>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <Users className="mt-0.5 h-5 w-5 text-[var(--tide-2)]" />
            <div>
              <div className="text-[14px] font-semibold text-ink-900">
                {L("All set — opening the family view", "设置完成 —— 正在进入家庭视图")}
              </div>
              <p className="mt-1 text-[13px] text-ink-500">
                {L(
                  "You can change any of this later from Settings → Household.",
                  "可随时在「设置 → 家庭」中修改。",
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        {step !== "welcome" && step !== "done" ? (
          <Button
            variant="ghost"
            onClick={() => {
              const prev = STEPS[Math.max(0, stepIdx - 1)];
              if (prev) setStep(prev);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            {L("Back", "上一步")}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => router.replace("/family")}
            className="text-[12px] text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
          >
            {L("Skip and finish later", "跳过，稍后再填")}
          </button>
        )}
        {step === "permissions" ? (
          <Button onClick={() => void finish()} disabled={saving} size="lg">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {L("Finish", "完成")}
          </Button>
        ) : step === "done" ? null : (
          <Button
            onClick={() => {
              const next = STEPS[Math.min(STEPS.length - 1, stepIdx + 1)];
              if (next) setStep(next);
            }}
            disabled={!canContinue}
            size="lg"
          >
            {L("Continue", "继续")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Role-specific "what you can do here" step. Pulls labels from the
// permission matrix so the screen stays in sync with the actual
// authorisation rules — adding a new action only needs the matrix
// row + label, this component picks it up automatically.
//
// Splits actions into "you can" (the role's allow-list) and "you
// won't" (notable actions explicitly denied) so the new member knows
// both their capability and their limits. We deliberately don't
// show every denied action — only ones a person could reasonably
// expect to be able to do (editing the treatment plan, inviting
// people, logging clinical notes).
function PermissionsStep({
  role,
  locale,
}: {
  role: import("~/types/household").HouseholdRole;
  locale: Locale;
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const allowed = actionsFor(role);
  const allActions = Object.keys(ACTION_LABEL) as Array<
    keyof typeof ACTION_LABEL
  >;
  // The handful of "you'd reasonably expect to be able to" actions
  // worth calling out when a role doesn't have them. Listing every
  // disabled action would be exhausting; this curated list covers
  // the cases where surprise would feel like a bug.
  const noteworthyDenials: Array<keyof typeof ACTION_LABEL> = [
    "edit_treatment_plan",
    "edit_medications",
    "log_clinical_note",
    "invite_members",
  ];
  const denied = allActions.filter(
    (a) => !allowed.includes(a) && noteworthyDenials.includes(a),
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            {L("What you can do here", "您能做什么")}
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-500">
            {L(
              `As ${ROLE_LABEL[role].en.toLowerCase()}, here's what you can — and can't — do. The primary carer can change your role later.`,
              `作为${ROLE_LABEL[role].zh}，您可以做以下事项。日后由主要照护者调整角色。`,
            )}
          </p>
        </div>

        <ul className="space-y-1.5">
          {allowed.map((a) => (
            <li
              key={`allow-${a}`}
              className="flex items-start gap-2 text-[12.5px]"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ok)]" />
              <span className="text-ink-900">{ACTION_LABEL[a][locale]}</span>
            </li>
          ))}
        </ul>

        {denied.length > 0 && (
          <div>
            <div className="eyebrow text-ink-400">
              {L("Not yours to change", "无修改权限")}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {denied.map((a) => (
                <li
                  key={`deny-${a}`}
                  className="flex items-start gap-2 text-[12.5px] text-ink-500"
                >
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink-200" />
                  <span>{ACTION_LABEL[a][locale]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
