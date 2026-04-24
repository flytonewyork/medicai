"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getCurrentProfile,
  getHousehold,
  isProfileComplete,
  updateMyProfile,
} from "~/lib/supabase/households";
import { useHousehold } from "~/hooks/use-household";
import { pickL } from "~/hooks/use-bilingual";
import { useUIStore } from "~/stores/ui-store";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import type { Household, Profile } from "~/types/household";
import type { Locale } from "~/types/clinical";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Heart,
  Loader2,
  Users,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

// Post-acceptance onboarding for an invited family / care-team member. The
// /invite/[token] flow hands off here after `acceptInvite` succeeds so the
// new member can fill in a display name, relationship, locale, and timezone
// before they're dropped into /family. Skippable by design — anything left
// blank falls back to sensible defaults and can be edited later from
// Settings → Household → Your profile.

type Step = "welcome" | "about" | "preferences" | "done";
const STEPS: Step[] = ["welcome", "about", "preferences", "done"];

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

  const L = (en: string, zh: string) => pickL(locale, en, zh);

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
        {step === "preferences" ? (
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
