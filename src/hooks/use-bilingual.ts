"use client";

import { useLocale } from "~/hooks/use-translate";
import type { Locale } from "~/types/clinical";

// The patient-facing surface is bilingual (en + zh). For copy that does
// not live in the i18n message catalog (one-off labels, dynamic strings,
// derived sentence fragments) every component was redefining
// `const L = (en, zh) => locale === "zh" ? zh : en`. This hook returns
// that picker once.
export function useBilingual() {
  const locale = useLocale();
  return (en: string, zh: string) => (locale === "zh" ? zh : en);
}

// Stateless variant for callers that already have `locale` in scope
// (e.g. components that receive it as a prop, or non-React code paths).
export function pickL(locale: Locale, en: string, zh: string): string {
  return locale === "zh" ? zh : en;
}
