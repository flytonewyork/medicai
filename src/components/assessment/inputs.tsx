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
        <span className="text-sm font-medium text-ink-900">{label}</span>
        <span className="text-sm tabular-nums text-ink-500">
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
                "h-10 min-w-[2.25rem] rounded-md border text-sm font-medium transition-colors",
                active
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-ink-200 bg-paper text-ink-700 hover:border-ink-300 hover:bg-ink-100/60",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[11px] text-ink-500">
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
    <div className="flex items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper px-3 py-2">
      <span className="text-sm text-ink-900">{label}</span>
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
                "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-ink-200 text-ink-700 hover:border-ink-300",
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
      <div className="text-sm font-medium text-ink-900">{label}</div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((opt, i) => {
          const active = value === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={cn(
                "rounded-md border p-2 text-xs font-medium transition-colors",
                active
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-ink-200 text-ink-700 hover:border-ink-300",
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
