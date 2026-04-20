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
              "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
              active
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600",
            )}
            aria-pressed={active}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                active
                  ? "bg-white text-slate-900 dark:bg-slate-900 dark:text-white"
                  : grade >= 3
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : grade === 2
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
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
