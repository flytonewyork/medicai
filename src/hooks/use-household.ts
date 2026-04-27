"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import {
  getCurrentMembership,
  getCurrentProfile,
} from "~/lib/supabase/households";
import type {
  HouseholdMembership,
  Profile,
} from "~/types/household";

// Live-loading current-user membership + profile. Returns undefined
// while loading so components can fall back; null when the user is
// signed out or Supabase isn't configured.
//
// Has a hard 4-second loading-resolve timeout: if the underlying
// Supabase calls don't finish (poor network on Capacitor / iOS, a
// hung WebView fetch, expired session that's mid-refresh), we flip
// any still-undefined values to null instead of leaving the UI on a
// permanent loading spinner. The next call to refresh() (e.g. after
// auth state change) will retry. This is a UX safety net, not a
// correctness boundary — the actual auth check is server-side RLS.
const LOAD_TIMEOUT_MS = 4000;

export function useHousehold(): {
  membership: HouseholdMembership | null | undefined;
  profile: Profile | null | undefined;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [membership, setMembership] =
    useState<HouseholdMembership | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  const load = async () => {
    const [m, p] = await Promise.all([
      getCurrentMembership().catch(() => null),
      getCurrentProfile().catch(() => null),
    ]);
    setMembership(m);
    setProfile(p);
  };

  useEffect(() => {
    void load();

    // Safety net: never let the UI hang on the loading state.
    const timeout = setTimeout(() => {
      setMembership((m) => (m === undefined ? null : m));
      setProfile((p) => (p === undefined ? null : p));
    }, LOAD_TIMEOUT_MS);

    const sb = getSupabaseBrowser();
    if (!sb) {
      clearTimeout(timeout);
      return;
    }
    const { data: sub } = sb.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      clearTimeout(timeout);
      sub?.subscription.unsubscribe();
    };
  }, []);

  return {
    membership,
    profile,
    loading: membership === undefined || profile === undefined,
    refresh: load,
  };
}
