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
//
// Two flavours:
//   - useL(): a hook that subscribes to the locale store. Use when a
//     component doesn't already have `locale` in scope. Like all hooks,
//     it must run before any early return.
//   - pickL(locale): a plain factory. Use when the component already
//     called useLocale() (or received `locale` as a prop) and the L
//     binding sits below an early return — calling a hook there would
//     violate the rules of hooks.
export function useL() {
  const locale = useUIStore((s) => s.locale);
  return (en: string, zh: string) => (locale === "zh" ? zh : en);
}

export function pickL(locale: "en" | "zh") {
  return (en: string, zh: string) => (locale === "zh" ? zh : en);
}
