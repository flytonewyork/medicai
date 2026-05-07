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
      ? "text-[var(--ok)]"
      : score >= 50
        ? "text-[var(--sand-2)]"
        : "text-[var(--warn)]";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="stroke-ink-200"
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
        <span className="serif text-sm tabular-nums text-ink-900">
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
    <div className="a-card p-4">
      <div className="flex items-center gap-3">
        <PillarRing score={score} />
        <div>
          <div className="eyebrow">{label}</div>
          <div className="mt-0.5 text-sm text-ink-700">
            {note}
          </div>
        </div>
      </div>
    </div>
  );
}
