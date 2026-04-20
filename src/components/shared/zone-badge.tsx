"use client";

import type { Zone } from "~/types/clinical";
import { cn } from "~/lib/utils/cn";
import { useT } from "~/hooks/use-translate";
import { Circle, AlertCircle, AlertTriangle, AlertOctagon } from "lucide-react";

const ZONE_CLASS: Record<Zone, string> = {
  green: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  yellow: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900",
  orange: "bg-orange-50 text-orange-800 border-orange-400 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-900",
  red: "bg-red-50 text-red-800 border-red-500 dark:bg-red-950/50 dark:text-red-100 dark:border-red-900",
};

const ZONE_ICON: Record<Zone, React.ComponentType<{ className?: string }>> = {
  green: Circle,
  yellow: AlertCircle,
  orange: AlertTriangle,
  red: AlertOctagon,
};

export function ZoneBadge({ zone, className }: { zone: Zone; className?: string }) {
  const t = useT();
  const Icon = ZONE_ICON[zone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        ZONE_CLASS[zone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {t(`zones.${zone}`)}
    </span>
  );
}
