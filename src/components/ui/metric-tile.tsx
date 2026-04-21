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
  let deltaClass = "text-ink-400";
  if (direction && direction !== "flat" && direction !== "none" && goodDirection) {
    const good = direction === goodDirection;
    deltaClass = good
      ? "text-[var(--ok)]"
      : "text-[var(--warn)]";
  }
  const Icon =
    direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : ArrowRight;

  return (
    <div className={cn("a-card p-4", className)}>
      <div className="eyebrow">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="serif num text-3xl text-ink-900">{value}</span>
        {unit && (
          <span className="mono text-xs text-ink-400 uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>
      {(delta || direction) && (
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-xs font-medium",
            deltaClass,
          )}
        >
          {direction && direction !== "none" && <Icon className="h-3 w-3" />}
          {delta}
        </div>
      )}
      {footnote && (
        <div className="mt-2 text-xs text-ink-500">{footnote}</div>
      )}
    </div>
  );
}
