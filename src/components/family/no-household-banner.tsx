"use client";

import Link from "next/link";
import { useAuthSession } from "~/hooks/use-auth-session";
import { useHousehold } from "~/hooks/use-household";
import { isSupabaseConfigured } from "~/lib/supabase/client";
import { useL } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";

// Shown at the top of /family when the user landed there without a
// household membership. The page itself is built for caregivers who
// HAVE joined a household; without one, every other card short-
// circuits on `!membership` and the user sees a half-empty shell with
// no way out. This banner gives them a deterministic next action:
// finish caregiver onboarding (where they'll pick a patient or paste
// an invite link). Never renders for fully-joined members.
//
// "Signed in" detection goes through useAuthSession (session-direct)
// rather than `profile != null` — a user with a valid session but a
// missing profiles row is still signed in.
export function NoHouseholdBanner() {
  const L = useL();
  const session = useAuthSession();
  const { membership, loading } = useHousehold();

  if (!isSupabaseConfigured()) return null;
  if (loading || session === undefined) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-4 text-[12.5px] text-ink-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {L("Checking your account…", "正在检查账号…")}
        </CardContent>
      </Card>
    );
  }
  if (membership) return null;

  // Two distinct states get the same recovery destination
  // (/onboarding) but different copy so the user understands which
  // gap they're in.
  const signedOut = !session.signedIn;

  return (
    <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)]">
      <CardContent className="space-y-3 pt-4 text-[13px]">
        <div className="flex items-center gap-2 text-ink-900">
          <UserPlus className="h-4 w-4 text-[var(--tide-2)]" />
          <span className="font-semibold">
            {signedOut
              ? L(
                  "Sign in to find your patient",
                  "登录后查找您要支持的患者",
                )
              : L("You're not on a care team yet", "您尚未加入护理团队")}
          </span>
        </div>
        <p className="text-ink-700">
          {signedOut
            ? L(
                "Anchor doesn't know who you're caring for yet. Sign in and pick the patient — or open the invite link they sent you.",
                "Anchor 尚不知道您要支持的患者。请登录并选择患者，或打开对方发来的邀请链接。",
              )
            : L(
                "We've signed you in but you haven't joined anyone's care team. Pick the patient you're supporting, or paste an invite link if you have one.",
                "您已登录，但尚未加入任何护理团队。请选择您要支持的患者，或粘贴邀请链接。",
              )}
        </p>
        <Link
          href={
            signedOut
              ? "/login?next=%2Ffamily"
              : "/onboarding?step=pick_patient"
          }
        >
          <Button size="md">
            {signedOut
              ? L("Sign in", "登录")
              : L("Find a patient", "查找患者")}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
