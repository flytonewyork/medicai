"use client";

import { type ReactNode } from "react";
import { HelpCircle, Minus, Plus } from "lucide-react";
import { Disclosure } from "~/components/ui/disclosure";
import { percentChange } from "~/lib/calculations/trends";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";

interface MeasurementInputProps {
  label: string;
  unit: string;
  value: number | undefined;
  baseline?: number;
  baselineLabel?: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (n: number | undefined) => void;
  howTo?: ReactNode;
  goodDirection?: "higher" | "lower";
}

export function MeasurementInput({
  label,
  unit,
  value,
  baseline,
  baselineLabel,
  step = 0.5,
  min = 0,
  max,
  onChange,
  howTo,
  goodDirection,
}: MeasurementInputProps) {
  const locale = useLocale();

  function bump(delta: number) {
    const next = Number(((value ?? baseline ?? 0) + delta).toFixed(2));
    if (Number.isNaN(next)) return;
    if (next < min) return;
    if (max !== undefined && next > max) return;
    onChange(next);
  }

  let deltaText: string | null = null;
  let deltaTone: "neutral" | "good" | "watch" = "neutral";
  if (baseline !== undefined && value !== undefined) {
    const pct = percentChange(baseline, value);
    const abs = Math.abs(pct);
    deltaText = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
    if (abs < 2) {
      deltaTone = "neutral";
    } else {
      const higherIsBetter = goodDirection === "higher";
      const rose = pct > 0;
      const good = higherIsBetter ? rose : !rose;
      deltaTone = good ? "good" : "watch";
    }
  }

  return (
    <div className="a-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-ink-900">
            {label}
          </div>
          {baseline !== undefined && (
            <div className="mt-0.5 text-xs text-ink-500">
              {baselineLabel ?? (locale === "zh" ? "基线" : "Baseline")}: {baseline} {unit}
            </div>
          )}
        </div>
        {deltaText && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              deltaTone === "good" &&
                "bg-[var(--ok-soft)] text-[var(--ok)]",
              deltaTone === "watch" &&
                "bg-[var(--warn-soft)] text-[var(--warn)]",
              deltaTone === "neutral" &&
                "bg-ink-100 text-ink-500",
            )}
          >
            {deltaText}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="decrement"
          onClick={() => bump(-step)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-paper text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-700"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex-1 relative">
          <input
            inputMode="decimal"
            type="number"
            step={step}
            min={min}
            max={max}
            value={value ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === "" ? undefined : Number(raw));
            }}
            className="h-11 w-full rounded-md border border-ink-200 bg-paper px-3 pr-12 text-center text-xl font-semibold tabular-nums text-ink-900 focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-900/10"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-500">
            {unit}
          </span>
        </div>
        <button
          type="button"
          aria-label="increment"
          onClick={() => bump(step)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-paper text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-700"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {howTo && (
        <div className="mt-3">
          <Disclosure
            label={
              <span className="inline-flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" />
                {locale === "zh" ? "如何测量" : "How to measure"}
              </span>
            }
          >
            {howTo}
          </Disclosure>
        </div>
      )}
    </div>
  );
}
