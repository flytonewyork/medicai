"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import {
  acceptInvite,
  friendlyInviteError,
  getCurrentProfile,
  isProfileComplete,
} from "~/lib/supabase/households";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Loader2, Users, Check, AlertCircle } from "lucide-react";

// Landing page for someone following a household invite link. Handles
// three states:
//   (1) User is already signed in → accept immediately, redirect to /family
//   (2) User is signed out → bounce to /login with ?next= set so we come back here
//   (3) Accept failed (expired / revoked / already accepted) → show the reason
//
// The token in the URL is a uuid v4. It's not secret in the strict sense
// (leaks into browser history); security is enforced by expiry, single-
// use semantics, and revoke. Treat it as a bearer capability for joining
// one specific household.

type Phase =
  | { kind: "checking" }
  | { kind: "needs_signin" }
  | { kind: "accepting" }
  | { kind: "accepted" }
  | { kind: "error"; message: string };

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      const sb = getSupabaseBrowser();
      if (!sb) {
        if (!cancelled)
          setPhase({
            kind: "error",
            message: "Supabase is not configured on this build.",
          });
        return;
      }
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) {
        if (!cancelled) setPhase({ kind: "needs_signin" });
        return;
      }
      if (!cancelled) setPhase({ kind: "accepting" });
      try {
        await acceptInvite(token);
        if (cancelled) return;
        setPhase({ kind: "accepted" });
        // If the invitee's profile has no relationship / name yet, run
        // the welcome wizard so the care-team list renders something
        // useful. If they're returning (re-invite) and everything's set,
        // drop them straight on /family.
        const profile = await getCurrentProfile().catch(() => null);
        const next = isProfileComplete(profile) ? "/family" : "/invite/welcome";
        setTimeout(() => router.replace(next), 1200);
      } catch (err) {
        if (!cancelled)
          setPhase({ kind: "error", message: friendlyInviteError(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md space-y-5 p-6 pt-16">
      <PageHeader
        eyebrow="CARE TEAM"
        title="Joining the family"
      />

      {phase.kind === "checking" && <Spinner label="Checking invite…" />}

      {phase.kind === "needs_signin" && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--tide-2)]" />
              <div className="text-[14px] font-semibold text-ink-900">
                You&rsquo;ve been invited
              </div>
            </div>
            <p className="text-[13px] text-ink-500">
              Sign in or create your account to join this family. After
              signing in you&rsquo;ll land straight on the family view.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            >
              <Button size="lg" className="w-full">
                Sign in to accept
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {phase.kind === "accepting" && <Spinner label="Accepting invite…" />}

      {phase.kind === "accepted" && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <Check className="mt-0.5 h-5 w-5 text-[var(--ok)]" />
            <div>
              <div className="text-[14px] font-semibold text-ink-900">
                Welcome to the team
              </div>
              <p className="mt-1 text-[13px] text-ink-500">
                Taking you to the family view&hellip;
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {phase.kind === "error" && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--warn)]" />
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-ink-900">
                Can&rsquo;t accept invite
              </div>
              <p className="mt-1 text-[13px] text-ink-500">{phase.message}</p>
              <p className="mt-3 text-[12px] text-ink-500">
                Ask the primary carer to send you a new invite link.
              </p>
              <Link
                href="/"
                className="mt-3 inline-block text-[12px] text-ink-500 underline-offset-2 hover:underline"
              >
                Go to dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 pt-5 text-[13px] text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </CardContent>
    </Card>
  );
}
