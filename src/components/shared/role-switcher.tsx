"use client";

import { useUIStore } from "~/stores/ui-store";
import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";
import type { Role } from "~/types/clinical";
import { User, Users, Stethoscope } from "lucide-react";

const LABELS: Record<"en" | "zh", Record<Role, string>> = {
  en: { patient: "Patient", caregiver: "Caregiver", clinician: "Clinician" },
  zh: { patient: "患者", caregiver: "家属", clinician: "医师" },
};

const ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  patient: User,
  caregiver: Users,
  clinician: Stethoscope,
};

export function RoleSwitcher({ className }: { className?: string }) {
  const role = useUIStore((s) => s.role);
  const setRole = useUIStore((s) => s.setRole);
  const locale = useLocale();

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-slate-200 dark:border-slate-800 overflow-hidden text-xs",
        className,
      )}
      role="radiogroup"
    >
      {(["patient", "caregiver", "clinician"] as const).map((r) => {
        const Icon = ICONS[r];
        const active = role === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            role="radio"
            aria-checked={active}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1",
              active
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            <Icon className="h-3 w-3" />
            {LABELS[locale][r]}
          </button>
        );
      })}
    </div>
  );
}

export function useIsReadOnly(): boolean {
  return useUIStore((s) => s.role) === "clinician";
}
