"use client";

import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";
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

const SEVERITY_TONE = {
  warning: {
    ring: "border-red-300 dark:border-red-900",
    bg: "bg-red-50/70 dark:bg-red-950/30",
    pill: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    icon: AlertTriangle,
  },
  caution: {
    ring: "border-amber-300 dark:border-amber-900",
    bg: "bg-amber-50/70 dark:bg-amber-950/30",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    icon: ShieldAlert,
  },
  info: {
    ring: "border-slate-200 dark:border-slate-800",
    bg: "bg-white dark:bg-slate-900",
    pill: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
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
      className={cn(
        "rounded-xl border p-3 transition-colors",
        tone.ring,
        tone.bg,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              tone.pill,
            )}
          >
            <CatIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold leading-tight">
                {nudge.title[locale]}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  tone.pill,
                )}
              >
                {CATEGORY_LABEL[nudge.category][locale]}
              </span>
            </div>
            {!compact && (
              <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
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
            className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
