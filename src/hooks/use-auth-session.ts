"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";

// Lightweight "is the current visitor authenticated?" hook. Reads the
// Supabase session straight from local storage / cookies (no network
// round-trip) and subscribes to onAuthStateChange so it reflects
// sign-in / sign-out as it happens.
//
// Why this exists separately from useHousehold: useHousehold conflates
// "is the user authenticated" with "do they have a profiles row + a
// membership". A signed-in user CAN legitimately have profile=null
// (handle_new_user trigger never fired, profile got reset in dev,
// schema migration pending). Components that only need "are they
// signed in" should use this hook so they don't misclassify those
// users as signed-out.
//
// Returns:
//   - undefined → still resolving (first paint, between renders)
//   - { signedIn: false, userId: null } → genuinely signed out
//   - { signedIn: true, userId: "<uuid>" } → has a session
export interface AuthSession {
  signedIn: boolean;
  userId: string | null;
}

export function useAuthSession(): AuthSession | undefined {
  const [state, setState] = useState<AuthSession | undefined>(undefined);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({ signedIn: false, userId: null });
      return;
    }
    const sb = getSupabaseBrowser();
    if (!sb) {
      setState({ signedIn: false, userId: null });
      return;
    }
    let cancelled = false;
    void sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const uid = data.session?.user?.id ?? null;
      setState({ signedIn: !!uid, userId: uid });
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const uid = session?.user?.id ?? null;
      setState({ signedIn: !!uid, userId: uid });
    });
    return () => {
      cancelled = true;
      sub?.subscription.unsubscribe();
    };
  }, []);

  return state;
}
