"use client";

import { useLocale } from "~/hooks/use-translate";
import type { NudgeCategory, NudgeTemplate } from "~/types/treatment";
import {
  Apple,
  Bed,
  Brain,
  Dumbbell,
  Heart,
  Pill,
  ShieldAlert,
  SprayCan,
  Activity,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

const CATEGORY_ICON: Record<
  NudgeCategory,
  React.ComponentType<{ className?: string }>
> = {
  diet: Apple,
  hygiene: SprayCan,
  exercise: Dumbbell,
  sleep: Bed,
  mental: Brain,
  safety: ShieldAlert,
  activity: Activity,
  meds: Pill,
  intimacy: Heart,
};

const CATEGORY_LABEL: Record<NudgeCategory, { en: string; zh: string }> = {
  diet: { en: "Diet", zh: "饮食" },
  hygiene: { en: "Hygiene", zh: "卫生" },
  exercise: { en: "Exercise", zh: "运动" },
  sleep: { en: "Sleep", zh: "睡眠" },
  mental: { en: "Mental", zh: "心理" },
  safety: { en: "Safety", zh: "安全" },
  activity: { en: "Activity", zh: "活动" },
  meds: { en: "Meds", zh: "用药" },
  intimacy: { en: "Intimacy", zh: "亲密" },
};

type SeverityTone = {
  ringStyle: React.CSSProperties;
  bgStyle: React.CSSProperties;
  pillStyle: React.CSSProperties;
  icon: React.ComponentType<{ className?: string }>;
};

const SEVERITY_TONE: Record<"warning" | "caution" | "info", SeverityTone> = {
  warning: {
    ringStyle: { borderColor: "color-mix(in oklch, var(--warn), transparent 60%)" },
    bgStyle: { background: "var(--warn-soft)" },
    pillStyle: { background: "var(--warn-soft)", color: "var(--warn)" },
    icon: AlertTriangle,
  },
  caution: {
    ringStyle: { borderColor: "color-mix(in oklch, var(--sand-2), transparent 40%)" },
    bgStyle: { background: "var(--sand)" },
    pillStyle: { background: "var(--shell)", color: "oklch(35% 0.04 70)" },
    icon: ShieldAlert,
  },
  info: {
    ringStyle: { borderColor: "var(--ink-200)" },
    bgStyle: { background: "var(--paper-2)" },
    pillStyle: { background: "var(--ink-100)", color: "var(--ink-700)" },
    icon: Info,
  },
};

export function NudgeCard({
  nudge,
  onSnooze,
  compact = false,
}: {
  nudge: NudgeTemplate;
  onSnooze?: (id: string) => void;
  compact?: boolean;
}) {
  const locale = useLocale();
  const tone = SEVERITY_TONE[nudge.severity];
  const CatIcon = CATEGORY_ICON[nudge.category];

  return (
    <div
      className="rounded-[var(--r-md)] border p-3 transition-colors"
      style={{ ...tone.ringStyle, ...tone.bgStyle }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={tone.pillStyle}
          >
            <CatIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold leading-tight text-ink-900">
                {nudge.title[locale]}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                style={tone.pillStyle}
              >
                {CATEGORY_LABEL[nudge.category][locale]}
              </span>
            </div>
            {!compact && (
              <p className="mt-1 text-xs leading-relaxed text-ink-700">
                {nudge.body[locale]}
              </p>
            )}
          </div>
        </div>
        {onSnooze && (
          <button
            type="button"
            onClick={() => onSnooze(nudge.id)}
            aria-label="Snooze this nudge"
            className="rounded-[var(--r-sm)] p-1 text-ink-400 hover:bg-paper hover:text-ink-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
