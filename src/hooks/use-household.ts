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
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const { data: sub } = sb.auth.onAuthStateChange(() => {
      void load();
    });
    return () => sub?.subscription.unsubscribe();
  }, []);

  return {
    membership,
    profile,
    loading: membership === undefined || profile === undefined,
    refresh: load,
  };
}
