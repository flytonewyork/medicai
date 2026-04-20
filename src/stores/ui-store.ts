import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EnteredBy, Locale, Role } from "~/types/clinical";

interface UIState {
  locale: Locale;
  enteredBy: EnteredBy;
  role: Role;
  setLocale: (l: Locale) => void;
  setEnteredBy: (who: EnteredBy) => void;
  setRole: (r: Role) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      locale: "en",
      enteredBy: "hulin",
      role: "patient",
      setLocale: (locale) => set({ locale }),
      setEnteredBy: (enteredBy) => set({ enteredBy }),
      setRole: (role) => {
        // Keep entered_by in sync with role where sensible.
        const next: Partial<UIState> = { role };
        if (role === "caregiver") next.enteredBy = "catherine";
        else if (role === "clinician") next.enteredBy = "clinician";
        else next.enteredBy = "hulin";
        set(next as UIState);
      },
    }),
    { name: "anchor_ui" },
  ),
);
