"use client";

import { cn } from "~/lib/utils/cn";

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between w-full rounded-md border px-3 py-3 text-sm text-left",
        checked
          ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
          : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
      )}
      aria-pressed={checked}
    >
      <span>{label}</span>
      <span className="text-xs">{checked ? "✓" : ""}</span>
    </button>
  );
}
