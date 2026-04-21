import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EnteredBy, Locale } from "~/types/clinical";

interface UIState {
  locale: Locale;
  enteredBy: EnteredBy;
  setLocale: (l: Locale) => void;
  setEnteredBy: (who: EnteredBy) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      locale: "en",
      enteredBy: "hulin",
      setLocale: (locale) => set({ locale }),
      setEnteredBy: (enteredBy) => set({ enteredBy }),
    }),
    { name: "anchor_ui" },
  ),
);
