"use client";

import { cn } from "~/lib/utils/cn";

interface ScaleInputProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}

export function ScaleInput({ label, value, onChange, min = 0, max = 10 }: ScaleInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
        </span>
        <span className="text-sm tabular-nums text-slate-600 dark:text-slate-400">
          {value}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: max - min + 1 }, (_, i) => {
          const n = i + min;
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "h-10 min-w-[2.25rem] rounded-md border text-sm font-medium",
                active
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
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
