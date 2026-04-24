"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils/cn";

export function Disclosure({
  label,
  children,
  defaultOpen = false,
}: {
  label: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-ink-200 bg-paper/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-ink-700 transition-colors hover:bg-ink-100/40"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">{label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-ink-100 px-3 py-3 text-xs leading-relaxed text-ink-500">
          {children}
        </div>
      )}
    </div>
  );
}
