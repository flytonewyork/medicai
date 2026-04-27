"use client";

import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";

interface ScaleInputProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}

export function ScaleInput({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
}: ScaleInputProps) {
  const locale = useLocale();
  const count = max - min + 1;
  // Bilingual range hint surfaces the scale endpoints to assistive
  // tech ("Energy level 0 to 10" / "精力水平 0 至 10"). The
  // role=radiogroup matches the click-to-select chip pattern below.
  const rangeHint =
    locale === "zh" ? `${min} 至 ${max}` : `${min} to ${max}`;
  const groupLabel = `${label} ${rangeHint}`;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-900">{label}</span>
        <span className="serif num text-lg leading-none text-ink-900">
          {value}
          <span className="ml-0.5 mono text-[10px] font-normal text-ink-400">
            /{max}
          </span>
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label={groupLabel}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: count }, (_, i) => {
          const n = i + min;
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(n)}
              aria-label={`${label} ${n}`}
              className={cn(
                "h-10 rounded-md border text-[12px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900",
                active
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-ink-200 bg-paper-2 text-ink-500 hover:border-ink-400",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
