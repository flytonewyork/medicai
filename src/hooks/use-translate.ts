"use client";

import { useUIStore } from "~/stores/ui-store";
import { translate } from "~/lib/i18n/config";

export function useT() {
  const locale = useUIStore((s) => s.locale);
  return (key: string) => translate(locale, key);
}

export function useLocale() {
  return useUIStore((s) => s.locale);
}

// Inline en/zh chooser used by ~50 components. Exported here so each
// component doesn't need to redefine `const L = (en, zh) => ...` in scope.
export function useL() {
  const locale = useUIStore((s) => s.locale);
  return (en: string, zh: string) => (locale === "zh" ? zh : en);
}
