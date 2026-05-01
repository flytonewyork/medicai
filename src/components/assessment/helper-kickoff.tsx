"use client";

import { useState } from "react";
import { Check, User, Users, Stethoscope, Heart } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { Field, TextInput, Textarea } from "~/components/ui/field";
import { cn } from "~/lib/utils/cn";
import type { AssessmentHelperRole } from "~/types/clinical";

// Captured at the start of a guided assessment session. The patient
// rarely runs this alone — for the bridge strategy we want to know who
// drove the session (so AI summaries and clinician reports can
// attribute "STS-30 = 7 (helper: Thomas, family member)") and we want
// the helper to consciously confirm the equipment is ready before they
// start, because a missing dynamometer one hour in is a wasted
// session.
//
// The fields are all optional. Patient-only sessions just leave them
// blank and tap Start. The component pre-fills the role to "self" in
// that case.
const ROLE_OPTIONS: Array<{
  id: AssessmentHelperRole;
  icon: React.ComponentType<{ className?: string }>;
  label: { en: string; zh: string };
  hint: { en: string; zh: string };
}> = [
  {
    id: "self",
    icon: User,
    label: { en: "Patient alone", zh: "患者独自" },
    hint: {
      en: "Hu Lin is doing this on his own.",
      zh: "胡林独自完成。",
    },
  },
  {
    id: "family",
    icon: Heart,
    label: { en: "Family member", zh: "家人" },
    hint: {
      en: "A son, daughter, or partner running the session.",
      zh: "由子女、伴侣等家人协助。",
    },
  },
  {
    id: "coach",
    icon: Users,
    label: { en: "Coach / friend", zh: "教练 / 友人" },
    hint: {
      en: "Trained coach or trusted friend walking through it.",
      zh: "受过训练的教练或可信赖的朋友带做。",
    },
  },
  {
    id: "clinician",
    icon: Stethoscope,
    label: { en: "Clinician", zh: "临床医生" },
    hint: {
      en: "Doctor, nurse, or allied health professional.",
      zh: "医师、护士或专职医疗人员。",
    },
  },
];

export interface HelperKickoffValue {
  helper_name?: string;
  helper_role?: AssessmentHelperRole;
  helper_notes?: string;
}

const EQUIPMENT_ITEMS: Array<{
  id: string;
  label: { en: string; zh: string };
}> = [
  { id: "scale", label: { en: "Bathroom scale", zh: "体重秤" } },
  { id: "tape", label: { en: "Soft tape measure", zh: "软尺" } },
  { id: "dyno", label: { en: "Hand dynamometer", zh: "握力器" } },
  { id: "chair", label: { en: "Sturdy chair (no arms)", zh: "稳固无扶手的椅子" } },
  { id: "space", label: { en: "4 m of clear floor", zh: "4 米平整地面" } },
  {
    id: "phone",
    label: {
      en: "Phone with this app (used as the timer)",
      zh: "装有本应用的手机（用作计时器）",
    },
  },
];

export function HelperKickoff({
  value,
  onChange,
}: {
  value: HelperKickoffValue;
  onChange: (v: HelperKickoffValue) => void;
}) {
  const locale = useLocale();
  const [equipChecks, setEquipChecks] = useState<Set<string>>(
    () => new Set(["phone"]),
  );

  function patch<K extends keyof HelperKickoffValue>(
    k: K,
    v: HelperKickoffValue[K],
  ) {
    onChange({ ...value, [k]: v });
  }

  function toggleEquip(id: string) {
    setEquipChecks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const role = value.helper_role ?? "self";

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">
          {locale === "zh" ? "今天是谁带做？" : "Who's running this session?"}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_OPTIONS.map((opt) => {
            const active = role === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch("helper_role", opt.id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper-2 hover:border-ink-300",
                )}
              >
                <Icon className="h-4 w-4" />
                <div className="serif text-sm">{opt.label[locale]}</div>
                <div
                  className={cn(
                    "text-[11px] leading-tight",
                    active ? "text-paper/80" : "text-ink-500",
                  )}
                >
                  {opt.hint[locale]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {role !== "self" && (
        <Field
          label={locale === "zh" ? "带做人的姓名（可选）" : "Helper's name (optional)"}
          hint={
            locale === "zh"
              ? "记录在评估上，方便医生看到是谁带做。"
              : "Stamped on the assessment so the clinician knows who ran it."
          }
        >
          <TextInput
            value={value.helper_name ?? ""}
            onChange={(e) => patch("helper_name", e.target.value)}
            placeholder={
              locale === "zh" ? "例如 Thomas（儿子）" : "e.g. Thomas (son)"
            }
            autoComplete="name"
          />
        </Field>
      )}

      <div>
        <div className="eyebrow">
          {locale === "zh" ? "出发前检查器材" : "Equipment check"}
        </div>
        <div className="mt-1 text-xs text-ink-500">
          {locale === "zh"
            ? "需要器材的测试可在中途跳过。仅勾选「现在确认有」的项目。"
            : "Tests that need missing equipment can still be skipped mid-flow. Tick only what you actually have on hand."}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {EQUIPMENT_ITEMS.map((item) => {
            const on = equipChecks.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleEquip(item.id)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  on
                    ? "border-ink-900 bg-paper-2"
                    : "border-dashed border-ink-200 bg-paper/60 text-ink-500",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border",
                    on
                      ? "border-ink-900 bg-ink-900 text-paper"
                      : "border-ink-300 bg-paper",
                  )}
                  aria-hidden
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className={on ? "text-ink-900" : ""}>
                  {item.label[locale]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Field
        label={
          locale === "zh"
            ? "今天的环境备注（可选）"
            : "Notes about today's setup (optional)"
        }
        hint={
          locale === "zh"
            ? "例如 在客厅地毯上、午饭后 1 小时、患者刚从化疗回来。"
            : "e.g. on living-room rug, 1 h after lunch, patient just back from infusion."
        }
      >
        <Textarea
          rows={3}
          value={value.helper_notes ?? ""}
          onChange={(e) => patch("helper_notes", e.target.value)}
          placeholder={
            locale === "zh"
              ? "环境、时间、患者状态…"
              : "Environment, time of day, patient state…"
          }
        />
      </Field>
    </div>
  );
}
