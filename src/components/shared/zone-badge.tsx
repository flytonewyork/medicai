"use client";

import type { Zone } from "~/types/clinical";
import { cn } from "~/lib/utils/cn";
import { useT } from "~/hooks/use-translate";
import {
  Circle,
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react";

const ZONE_CHIP: Record<Zone, string> = {
  green: "a-chip",
  yellow: "a-chip sand",
  orange: "a-chip warn",
  red: "a-chip warn",
};

const ZONE_ICON: Record<Zone, React.ComponentType<{ className?: string }>> = {
  green: Circle,
  yellow: AlertCircle,
  orange: AlertTriangle,
  red: AlertOctagon,
};

export function ZoneBadge({
  zone,
  className,
}: {
  zone: Zone;
  className?: string;
}) {
  const t = useT();
  const Icon = ZONE_ICON[zone];
  return (
    <span className={cn(ZONE_CHIP[zone], className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {t(`zones.${zone}`)}
    </span>
  );
}
