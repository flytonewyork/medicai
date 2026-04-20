import type { Locale } from "~/types/clinical";
import en from "../../../public/locales/en/common.json";
import zh from "../../../public/locales/zh/common.json";

export const LOCALES: Locale[] = ["en", "zh"];
export const DEFAULT_LOCALE: Locale = "en";

export type Messages = typeof en;

export const MESSAGES: Record<Locale, Messages> = {
  en,
  zh: zh as Messages,
};

type NestedKey<T, Prefix extends string = ""> = T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? NestedKey<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

export type MessageKey = NestedKey<Messages>;

export function translate(locale: Locale, key: string): string {
  const parts = key.split(".");
  let node: unknown = MESSAGES[locale];
  for (const p of parts) {
    if (node && typeof node === "object" && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof node === "string" ? node : key;
}
