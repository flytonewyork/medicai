"use client";

import { useUIStore } from "~/stores/ui-store";
import { cn } from "~/lib/utils/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);
  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-slate-200 dark:border-slate-800 text-xs overflow-hidden",
        className,
      )}
      role="group"
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "px-3 py-1",
          locale === "en"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 dark:text-slate-400",
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={cn(
          "px-3 py-1",
          locale === "zh"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-600 dark:text-slate-400",
        )}
      >
        中文
      </button>
    </div>
  );
}
