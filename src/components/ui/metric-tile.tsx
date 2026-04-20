import { cn } from "~/lib/utils/cn";
import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

export type Direction = "up" | "down" | "flat" | "none";

export function MetricTile({
  label,
  value,
  unit,
  delta,
  direction,
  goodDirection,
  footnote,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: string;
  direction?: Direction;
  goodDirection?: "up" | "down";
  footnote?: ReactNode;
  className?: string;
}) {
  let deltaClass = "text-slate-500";
  if (direction && direction !== "flat" && direction !== "none" && goodDirection) {
    const good = direction === goodDirection;
    deltaClass = good
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-amber-600 dark:text-amber-400";
  }
  const Icon =
    direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : ArrowRight;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>
        )}
      </div>
      {(delta || direction) && (
        <div className={cn("mt-1 inline-flex items-center gap-1 text-xs", deltaClass)}>
          {direction && direction !== "none" && <Icon className="h-3 w-3" />}
          {delta}
        </div>
      )}
      {footnote && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{footnote}</div>
      )}
    </div>
  );
}
