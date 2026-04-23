"use client";

import { useHousehold } from "~/hooks/use-household";
import { useLocale } from "~/hooks/use-translate";
import { Eye } from "lucide-react";

// Small sticky notice shown only when the current user's role is
// `observer`. Mounted once in the root providers so every page
// inherits it — sits above the nav, doesn't push content.

export function ObserverBanner() {
  const locale = useLocale();
  const { membership } = useHousehold();
  if (membership?.role !== "observer") return null;
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-1.5 bg-[var(--sand)] px-3 py-1.5 text-[11.5px] text-ink-800">
      <Eye className="h-3 w-3" aria-hidden />
      {L("Read-only · observer access", "仅读权限 · 观察者")}
    </div>
  );
}
