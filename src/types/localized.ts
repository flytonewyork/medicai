import type { Locale } from "./clinical";

// Single source of truth for the bilingual text shape used across feed,
// treatment, agent outputs, legacy, and medication metadata. Previously
// duplicated as `LocalizedString` (feed.ts) and `LocalizedText`
// (treatment.ts) with identical `{ en; zh }` bodies.

export interface LocalizedText {
  en: string;
  zh: string;
}

export function localize(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en;
}
