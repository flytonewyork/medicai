"use client";

import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";

const ECOG_DESCRIPTIONS: Record<"en" | "zh", Record<0 | 1 | 2 | 3 | 4, { label: string; detail: string }>> = {
  en: {
    0: {
      label: "Fully active",
      detail: "No restrictions. Able to carry on all pre-disease activity.",
    },
    1: {
      label: "Restricted strenuous activity",
      detail:
        "Ambulatory and able to do light work (household, office). Strenuous activity limited.",
    },
    2: {
      label: "Up and about > 50% of day",
      detail:
        "Ambulatory, self-care capable. Unable to do any work. Up for more than half of waking hours.",
    },
    3: {
      label: "Limited self-care",
      detail:
        "Confined to bed or chair for more than half of waking hours.",
    },
    4: {
      label: "Completely disabled",
      detail:
        "Cannot carry out any self-care. Totally confined to bed or chair.",
    },
  },
  zh: {
    0: {
      label: "完全正常",
      detail: "无限制，能进行发病前的所有活动。",
    },
    1: {
      label: "轻度活动受限",
      detail: "能走动并从事轻度工作（家务、办公）。剧烈活动受限。",
    },
    2: {
      label: "白天活动超过 50%",
      detail:
        "能走动并自理，但不能工作。白天清醒时间中超过一半可以起身活动。",
    },
    3: {
      label: "自理受限",
      detail: "白天清醒时间中超过一半卧床或坐着。",
    },
    4: {
      label: "完全无法自理",
      detail: "不能自理，完全卧床或坐着。",
    },
  },
};

export function EcogSelfReport({
  value,
  onChange,
}: {
  value: 0 | 1 | 2 | 3 | 4;
  onChange: (v: 0 | 1 | 2 | 3 | 4) => void;
}) {
  const locale = useLocale();
  const descriptions = ECOG_DESCRIPTIONS[locale];

  return (
    <div className="space-y-2">
      {([0, 1, 2, 3, 4] as const).map((level) => {
        const { label, detail } = descriptions[level];
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              active
                ? "border-ink-900 bg-ink-900 text-paper"
                : "border-ink-200 bg-paper-2 hover:border-ink-300",
            )}
            aria-pressed={active}
          >
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                active
                  ? "bg-paper text-ink-900"
                  : "bg-ink-100 text-ink-700",
              )}
              aria-hidden
            >
              {level}
            </span>
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{label}</span>
              <span
                className={cn(
                  "block text-xs leading-relaxed",
                  active ? "text-paper/80" : "text-ink-500",
                )}
              >
                {detail}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
