"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ListOrdered } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";

// Collapsible numbered instruction list shown in the wizard header for
// each test that defines `instructions` in the catalog. Defaults to OPEN
// for built-in-timer tests (because the helper needs the cues to drive
// the timer correctly), and CLOSED for already-self-explanatory tests
// (questionnaires, anthropometrics) so the form isn't pushed off-screen.
export function StepInstructions({
  steps,
  defaultOpen = true,
}: {
  steps: string[];
  defaultOpen?: boolean;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(defaultOpen);
  if (steps.length === 0) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-paper-2/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-ink-900">
          <ListOrdered className="h-4 w-4 text-ink-500" aria-hidden />
          {locale === "zh" ? "怎么做（读给患者听）" : "How to run this (read aloud)"}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-ink-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-400" />
        )}
      </button>
      {open && (
        <ol className="space-y-2 border-t border-ink-100 px-3 py-3 text-sm text-ink-700">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  "bg-ink-900 text-[11px] font-semibold text-paper",
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="leading-snug">{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
