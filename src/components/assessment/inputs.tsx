"use client";

import { cn } from "~/lib/utils/cn";

export function NumberScale({
  label,
  value,
  onChange,
  leftLabel,
  rightLabel,
  min = 0,
  max = 10,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
  leftLabel?: string;
  rightLabel?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
        </span>
        <span className="text-sm tabular-nums text-slate-500">
          {typeof value === "number" ? value : "—"}
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
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

export function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-sm text-slate-800 dark:text-slate-200">{label}</span>
      <div className="flex gap-1">
        {(
          [
            ["no", false],
            ["yes", true],
          ] as const
        ).map(([k, v]) => {
          const active = value === v;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium",
                active
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-400",
              )}
            >
              {k === "yes" ? "Yes" : "No"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OrdinalScale({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {label}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((opt, i) => {
          const active = value === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={cn(
                "rounded-lg border p-2 text-xs font-medium",
                active
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-200 text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:text-slate-300",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
