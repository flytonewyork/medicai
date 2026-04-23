"use client";

import { Check } from "lucide-react";
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
      aria-pressed={checked}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-3 text-left text-[13.5px] transition-colors",
        checked
          ? "border-ink-900 bg-ink-900 text-paper"
          : "border-ink-200 bg-paper-2 text-ink-700 hover:border-ink-400",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          checked
            ? "border-paper/40 bg-paper text-ink-900"
            : "border-ink-200 bg-paper",
        )}
        aria-hidden
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
