"use client";

import { cn } from "~/lib/utils/cn";

// Three-segment macro bar: protein / fat / carbs by calories. Used in
// dashboard cards and meal summaries. Visual only — exact gram values
// live in the surrounding component.
export function MacroBar({
  protein_g,
  fat_g,
  net_carbs_g,
  className,
}: {
  protein_g: number;
  fat_g: number;
  net_carbs_g: number;
  className?: string;
}) {
  const pCal = protein_g * 4;
  const fCal = fat_g * 9;
  const cCal = net_carbs_g * 4;
  const total = Math.max(1, pCal + fCal + cCal);
  const pPct = (pCal / total) * 100;
  const fPct = (fCal / total) * 100;
  const cPct = 100 - pPct - fPct;
  return (
    <div
      className={cn(
        "flex h-2 w-full overflow-hidden rounded-full bg-ink-100",
        className,
      )}
      aria-label="Macro distribution"
    >
      <span
        className="block h-full bg-[var(--tide-2)]"
        style={{ width: `${pPct}%` }}
        title={`Protein ${protein_g}g`}
      />
      <span
        className="block h-full bg-[var(--warn,#d97706)]"
        style={{ width: `${fPct}%` }}
        title={`Fat ${fat_g}g`}
      />
      <span
        className="block h-full bg-ink-300"
        style={{ width: `${cPct}%` }}
        title={`Net carbs ${net_carbs_g}g`}
      />
    </div>
  );
}

// Single-axis target progress bar. Accepts an optional cap; if `cap`
// is true the colour shifts to amber/red as we approach max.
export function TargetBar({
  value,
  target,
  cap = false,
  className,
}: {
  value: number;
  target: number;
  cap?: boolean;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, target)) * 100));
  let tone = "bg-[var(--tide-2)]";
  if (cap) {
    if (pct >= 100) tone = "bg-[var(--warn,#d97706)]";
    else if (pct >= 75) tone = "bg-[var(--tide-2)]";
    else tone = "bg-ink-400";
  } else {
    if (pct >= 100) tone = "bg-[var(--tide-2)]";
    else if (pct >= 60) tone = "bg-[var(--tide-2)]/80";
    else tone = "bg-ink-300";
  }
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-ink-100",
        className,
      )}
    >
      <span
        className={cn("block h-full transition-[width]", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
