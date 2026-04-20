import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "~/types/clinical";

interface UIState {
  locale: Locale;
  enteredBy: "hulin" | "catherine" | "thomas";
  setLocale: (l: Locale) => void;
  setEnteredBy: (who: "hulin" | "catherine" | "thomas") => void;
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
