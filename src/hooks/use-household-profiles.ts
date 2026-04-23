"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "./use-household";
import { listHouseholdMembers } from "~/lib/supabase/households";
import type { Profile } from "~/types/household";

// Household-wide profile lookup by user_id. Used by <Attribution /> so
// daily-entry rows, follow-up notes, and log events can render
// "Catherine · 2h ago" instead of the legacy string label.
//
// Returns a Map keyed by auth.uid. Load-once on household resolve;
// refreshes only when the household changes. Safe to call from many
// components — the membership query is cheap and the result cached.

export function useHouseholdProfiles(): {
  profilesById: Map<string, Profile>;
  loading: boolean;
} {
  const { membership } = useHousehold();
  const [map, setMap] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!membership) {
      setMap(new Map());
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const members = await listHouseholdMembers(membership.household_id);
        if (cancelled) return;
        const next = new Map<string, Profile>();
        for (const m of members) next.set(m.user_id, m.profile);
        setMap(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [membership]);

  return { profilesById: map, loading };
}
