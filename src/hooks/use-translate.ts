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
