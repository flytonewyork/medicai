"use client";

import { cn } from "~/lib/utils/cn";

export function PillarRing({
  score,
  size = 64,
  stroke = 6,
}: {
  score: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const tone =
    score >= 75
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 50
        ? "text-amber-600 dark:text-amber-400"
        : score >= 30
          ? "text-orange-600 dark:text-orange-400"
          : "text-red-600 dark:text-red-400";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={cn("transition-all duration-500", tone)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums">
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

export function PillarTile({
  label,
  score,
  note,
}: {
  label: string;
  score: number;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <PillarRing score={score} />
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
            {note}
          </div>
        </div>
      </div>
    </div>
  );
}
