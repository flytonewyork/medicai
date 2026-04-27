"use client";

import { useUIStore } from "~/stores/ui-store";
import { cn } from "~/lib/utils/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-full border border-ink-200 text-xs",
        className,
      )}
      role="group"
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "mono px-3 py-1 tracking-[0.06em] transition-colors",
          locale === "en"
            ? "bg-ink-900 text-paper"
            : "text-ink-500 hover:bg-ink-100/60 hover:text-ink-700",
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={cn(
          "px-3 py-1 transition-colors",
          locale === "zh"
            ? "bg-ink-900 text-paper"
            : "text-ink-500 hover:bg-ink-100/60 hover:text-ink-700",
        )}
      >
        中文
      </button>
    </div>
  );
}
