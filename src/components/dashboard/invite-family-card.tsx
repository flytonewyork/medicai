"use client";

import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { useAuthSession } from "~/hooks/use-auth-session";
import { useHousehold } from "~/hooks/use-household";
import { isSupabaseConfigured } from "~/lib/supabase/client";
import { Card, CardContent } from "~/components/ui/card";
import { useLocale, pickL } from "~/hooks/use-translate";

// Shows when the user is signed in but has no household yet (so no
// caregivers / family can see their data). Tapping the card deep-
// links to /carers with `?action=add-carer`, which auto-bootstraps
// the household and opens the invite flow in a single tap — closing
// the user-story gap where signing in left the patient with a profile
// but no team to invite people into.
//
// Auth check uses the session directly (not `profile != null`).
// Signed-in users CAN have profile=null (the handle_new_user trigger
// didn't fire, or the row got wiped in dev) — gating on profile would
// hide the CTA from people who actually need it.
//
// Hidden when:
// - Supabase isn't configured (offline-only setup, no point inviting)
// - Either hook is still resolving (avoid CTA flash)
// - The user is genuinely signed out
// - The user already has a household (PendingInvitesCard handles that)
export function InviteFamilyCard() {
  const locale = useLocale();
  const session = useAuthSession();
  const { membership, loading } = useHousehold();

  if (!isSupabaseConfigured()) return null;
  if (loading || session === undefined) return null;
  if (!session.signedIn) return null;
  if (membership) return null;   // already in a household

  const L = pickL(locale);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--tide-2)]/15 text-[var(--tide-2)]">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-ink-900">
              {L("Invite family to your care plan", "邀请家人加入护理计划")}
            </div>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              {L(
                "Share this dashboard with someone who helps with care.",
                "把这个面板分享给参与护理的家人。",
              )}
            </p>
          </div>
        </div>
        <Link
          href="/carers?action=add-carer"
          className="inline-flex items-center gap-0.5 text-[12px] text-ink-500 hover:text-ink-900"
        >
          {L("Set up", "开始")}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
