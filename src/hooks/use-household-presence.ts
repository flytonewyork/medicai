"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { nowISO } from "~/lib/utils/date";
import { useHousehold } from "./use-household";

// Ephemeral presence: which household members have Anchor open right
// now. Backed by a Supabase Realtime channel keyed on the
// household_id; nothing lands in the database. Call on any page where
// "who's here" is useful (currently /schedule and /family).
//
// Each tab that mounts this hook joins the channel and tracks itself
// with { user_id, display_name, surface, joined_at }. Unmount leaves
// the channel, so closing a tab cleans up within a few seconds.
//
// Returns a de-duplicated list keyed by user_id (a single user with
// two tabs shows once).

export interface PresentMember {
  user_id: string;
  display_name: string;
  surface: string; // "/family" | "/schedule" | ...
  joined_at: string;
}

export function useHouseholdPresence(surface: string): {
  present: PresentMember[];
  loading: boolean;
} {
  const { membership, profile } = useHousehold();
  const [present, setPresent] = useState<PresentMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!membership || !profile) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;

    const channelName = `presence:household:${membership.household_id}`;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const me: PresentMember = {
      user_id: profile.id,
      display_name: profile.display_name || "",
      surface,
      joined_at: nowISO(),
    };

    channel = sb
      .channel(channelName, {
        config: { presence: { key: profile.id } },
      })
      .on("presence", { event: "sync" }, () => {
        if (cancelled || !channel) return;
        const state = channel.presenceState<PresentMember>();
        const unique = new Map<string, PresentMember>();
        for (const key of Object.keys(state)) {
          const entries = state[key];
          if (!entries || entries.length === 0) continue;
          // Supabase wraps tracked objects in presence_ref metadata
          // keys we don't need — our tracked payload is the inner
          // properties.
          const raw = entries[0] as unknown as PresentMember;
          unique.set(raw.user_id ?? key, raw);
        }
        setPresent(Array.from(unique.values()));
        setLoading(false);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && channel) {
          await channel.track(me);
        }
      });

    return () => {
      cancelled = true;
      if (channel) {
        void channel.untrack().then(() => {
          if (channel) void sb.removeChannel(channel);
        });
      }
    };
    // We intentionally don't re-subscribe on every render — the
    // surface string is a tracking payload detail, not a rejoin key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membership?.household_id, profile?.id]);

  return { present, loading };
}
