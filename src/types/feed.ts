import type { Locale } from "./clinical";

export type FeedCategory =
  | "safety"
  | "checkin"
  | "treatment"
  | "task"
  | "weather"
  | "body"
  | "trend"
  | "encouragement";

export type FeedTone = "info" | "caution" | "warning" | "positive";

export interface LocalizedString {
  en: string;
  zh: string;
}

export interface FeedItem {
  id: string;
  priority: number;
  category: FeedCategory;
  tone: FeedTone;
  title: LocalizedString;
  body: LocalizedString;
  cta?: { href: string; label: LocalizedString };
  icon?: string;
  source?: string;
}

export function localize(s: LocalizedString, locale: Locale): string {
  return s[locale] ?? s.en;
}
