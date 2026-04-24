"use client";

import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";

const GRADES: Record<"en" | "zh", Record<0 | 1 | 2 | 3 | 4, string>> = {
  en: {
    0: "No symptoms",
    1: "Mild — occasional tingling, no functional impact",
    2: "Moderate — constant, interferes with buttons, handwriting, balance",
    3: "Severe — self-care limited (dressing, feeding)",
    4: "Disabling — not able to carry out activities",
  },
  zh: {
    0: "无症状",
    1: "轻度 —— 偶尔刺痛，不影响功能",
    2: "中度 —— 持续，影响扣扣子、写字、平衡",
    3: "重度 —— 自理受限（穿衣、进食）",
    4: "致残 —— 无法进行活动",
  },
};

export function NeuropathyGradeInput({
  value,
  onChange,
}: {
  value: 0 | 1 | 2 | 3 | 4 | undefined;
  onChange: (v: 0 | 1 | 2 | 3 | 4) => void;
}) {
  const locale = useLocale();
  return (
    <div className="space-y-1.5">
      {([0, 1, 2, 3, 4] as const).map((grade) => {
        const active = value === grade;
        const label = GRADES[locale][grade];
        return (
          <button
            key={grade}
            type="button"
            onClick={() => onChange(grade)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
              active
                ? "border-ink-900 bg-ink-900 text-paper"
                : "border-ink-200 bg-paper-2 text-ink-700 hover:border-ink-300",
            )}
            aria-pressed={active}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                active
                  ? "bg-paper text-ink-900"
                  : grade >= 3
                    ? "bg-[var(--warn-soft)] text-[var(--warn)]"
                    : grade === 2
                      ? "bg-[var(--sand)] text-[var(--ink-700)]"
                      : "bg-ink-100 text-ink-700",
              )}
            >
              {grade}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
