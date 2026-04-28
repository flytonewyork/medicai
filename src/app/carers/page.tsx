"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "~/hooks/use-auth-session";
import { useHousehold } from "~/hooks/use-household";
import {
  ensureHouseholdForCurrentUser,
  ensureProfileForCurrentUser,
  friendlyInviteError,
  getHousehold,
  listHouseholdMembers,
  listInvites,
} from "~/lib/supabase/households";
import type {
  Household,
  HouseholdInvite,
  HouseholdMemberWithProfile,
} from "~/types/household";
import { useLocale, useL } from "~/hooks/use-translate";
import { isSupabaseConfigured } from "~/lib/supabase/client";
import { useSettings } from "~/hooks/use-settings";
import { PageHeader, SectionHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Alert } from "~/components/ui/alert";
import { InviteCarerFlow } from "~/components/invite/invite-carer-flow";
import { MembersList } from "~/components/invite/members-list";
import { PendingInvitesList } from "~/components/invite/pending-invites-list";
import { LocalContactsSection } from "~/components/invite/local-contacts-section";
import {
  UserPlus,
  Loader2,
  Lock,
  ChevronRight,
  CalendarClock,
} from "lucide-react";

// /carers — single source of truth for everyone involved in the
// patient's care. See the README at the bottom of this file for the
// design rationale.
//
// Page layout (top → bottom):
//   1. Top section — depends on auth/household state. Renders the
//      "Add carer" CTA + Anchor membership list when signed in with
//      a household; falls back to a "Sign in" or "Set up household"
//      prompt otherwise. NEVER blocks the page on a global loading
//      spinner — useHousehold has its own 4s safety timeout, and
//      this page renders the local-contacts directory regardless.
//   2. Local contacts — always rendered. It's pure Dexie / offline
//      and has no dependency on Supabase, so if the cloud is
//      unreachable the user can still read the oncologist's phone
//      number and call.
//   3. Footer link → /care-team (visit log).

export default function CarersPage() {
  const locale = useLocale();
  const L = useL();
  const searchParams = useSearchParams();
  const settings = useSettings();
  // Auth check goes through useAuthSession (session-direct) rather
  // than `profile != null` on useHousehold. A signed-in user CAN
  // legitimately have profile=null (the handle_new_user trigger never
  // fired, the row was wiped in dev, or the 4-second useHousehold
  // timeout flipped it from undefined to null). We were mis-classifying
  // those users as signed-out and showing them the "Sign in to invite"
  // CTA — which then bounced through middleware that wiped the next=
  // param, dropping them on the dashboard.
  const session = useAuthSession();
  const { membership, profile, loading: householdLoading, refresh } =
    useHousehold();
  const householdId = membership?.household_id ?? null;
  const canInvite =
    membership?.role === "primary_carer" || membership?.role === "patient";
  const isPrimary = membership?.role === "primary_carer";

  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [showInviteFlow, setShowInviteFlow] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [healingProfile, setHealingProfile] = useState(false);
  // Bootstrap state for the "I signed in but have no household" branch.
  // The /carers page is the natural home for this: a user who lands
  // here is asking to grow their team, so creating their household is
  // the implicit ask. We never bounce to /onboarding (that path is
  // gated by `onboarded_at` and dead-ends).
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [autoOpenedFromQuery, setAutoOpenedFromQuery] = useState(false);

  const patientName =
    settings?.profile_name?.trim() || profile?.display_name?.trim() || "";

  // Auto-heal a missing profile. If we have a session but the profiles
  // row is null (trigger didn't fire, dev DB reset, etc.), upsert one
  // using the local Dexie display name so subsequent lookups work and
  // the rest of the app's profile-gated UI starts rendering correctly.
  // Idempotent — fires once per mount and only when the gap exists.
  useEffect(() => {
    if (!session?.signedIn) return;
    if (householdLoading) return;
    if (profile) return;
    if (healingProfile) return;
    setHealingProfile(true);
    void (async () => {
      try {
        await ensureProfileForCurrentUser({
          displayName: patientName || undefined,
          locale,
        });
        await refresh();
      } catch {
        // Best-effort. The page still renders the signed-in branches
        // because the gate is session-based now, not profile-based.
      } finally {
        setHealingProfile(false);
      }
    })();
  }, [
    healingProfile,
    householdLoading,
    locale,
    patientName,
    profile,
    refresh,
    session?.signedIn,
  ]);

  const reload = useCallback(async () => {
    if (!householdId) {
      setHousehold(null);
      setMembers([]);
      setInvites([]);
      return;
    }
    setLoadingData(true);
    try {
      const [h, m, inv] = await Promise.all([
        getHousehold(householdId),
        listHouseholdMembers(householdId),
        listInvites(householdId),
      ]);
      setHousehold(h);
      setMembers(m);
      setInvites(inv);
    } finally {
      setLoadingData(false);
    }
  }, [householdId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const bootstrapHousehold = useCallback(async () => {
    if (!patientName) {
      setBootstrapError(
        L(
          "Add your name in Settings before setting up your care team.",
          "请先在「设置」中填写姓名，再创建护理团队。",
        ),
      );
      return null;
    }
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      const id = await ensureHouseholdForCurrentUser({ patientName });
      await refresh();
      return id;
    } catch (err) {
      setBootstrapError(friendlyInviteError(err));
      return null;
    } finally {
      setBootstrapping(false);
    }
  }, [L, patientName, refresh]);

  // Deep-link handler. After a sign-in detour the patient lands here
  // with `?action=add-carer`. We bootstrap the household if needed and
  // auto-open the invite flow so the click that started this journey
  // ("Add carer") doesn't have to be repeated. Runs once per mount.
  // The gate is session-based (not profile-based) so a signed-in user
  // with a missing profiles row still flows through.
  useEffect(() => {
    if (autoOpenedFromQuery) return;
    if (householdLoading) return;
    if (session === undefined) return;
    if (searchParams?.get("action") !== "add-carer") return;
    if (!session.signedIn) return;
    void (async () => {
      if (!membership) {
        const id = await bootstrapHousehold();
        if (!id) return;
      }
      setShowInviteFlow(true);
      setAutoOpenedFromQuery(true);
    })();
  }, [
    autoOpenedFromQuery,
    bootstrapHousehold,
    householdLoading,
    membership,
    searchParams,
    session,
  ]);

  const activeInvites = invites.filter(
    (i) => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date(),
  );

  const supabaseConfigured = isSupabaseConfigured();

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={L("CARERS", "护理人员")}
        title={
          household
            ? L(
                `${household.patient_display_name}'s care team`,
                `${household.patient_display_name} 的护理团队`,
              )
            : L("Carers", "护理人员")
        }
        subtitle={
          household && members.length > 0 ? (
            <span className="text-[12px] text-ink-500">
              {L(
                `${members.length} ${members.length === 1 ? "carer" : "carers"} on Anchor`,
                `${members.length} 位 Anchor 账号成员`,
              )}
              {activeInvites.length > 0 && (
                <>
                  {" · "}
                  {L(
                    `${activeInvites.length} pending`,
                    `${activeInvites.length} 份待接受`,
                  )}
                </>
              )}
            </span>
          ) : undefined
        }
      />

      {/* TOP: Anchor-account section. Renders one of:
          - "Add carer" CTA + members list (signed in + has household)
          - read-only members hint (signed in but lacks invite permission)
          - "Sign in" prompt (signed out) — deep-links back here with
            ?action=add-carer so the click that started this journey
            opens the invite flow on return
          - "Set up your care team" inline auto-create (signed in,
            onboarded locally but no household yet — the gap that used
            to dead-end at /onboarding)
          - "Sync isn't configured" notice (offline-only build)
          - Inline loading hint (still resolving)
          The local contacts section below is unaffected by any of
          these states. */}
      {!supabaseConfigured ? (
        <Card>
          <CardContent className="space-y-2 pt-5 text-[13px] text-ink-500">
            <div className="flex items-center gap-2 text-ink-700">
              <Lock className="h-4 w-4" />
              <span className="font-medium">
                {L("Sync isn't configured", "尚未配置同步")}
              </span>
            </div>
            <p>
              {L(
                "Anchor account invites need cloud sync. The local contact directory below still works fully offline.",
                "邀请 Anchor 账号需启用云同步。下方本地通讯录可在离线状态下使用。",
              )}
            </p>
          </CardContent>
        </Card>
      ) : session === undefined || householdLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 pt-5 text-[12.5px] text-ink-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {L("Checking your account…", "正在检查账号…")}
          </CardContent>
        </Card>
      ) : !session.signedIn ? (
        <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)]">
          <CardContent className="space-y-3 pt-5 text-[13px]">
            <div className="flex items-center gap-2 text-ink-900">
              <UserPlus className="h-4 w-4 text-[var(--tide-2)]" />
              <span className="font-semibold">
                {L("Add someone to your care team", "邀请家人加入护理团队")}
              </span>
            </div>
            <p className="text-ink-700">
              {L(
                "Sign in once so the invite link can carry your details. We'll bring you straight back here to share it.",
                "请先登录，以便邀请链接附带您的信息。登录后会直接回到此页继续分享。",
              )}
            </p>
            <Link href="/login?next=%2Fcarers%3Faction%3Dadd-carer">
              <Button size="md">
                {L("Sign in to invite", "登录后邀请")}
              </Button>
            </Link>
            {/* Diagnostic block. The page is gated on session.signedIn,
                which reads the Supabase session straight from local
                storage / cookies. If the user is convinced they're
                signed in but the gate disagrees, the actual values
                here tell us exactly which signal is wrong. Toggle off
                once we trust the surface. */}
            <SessionDiag />
          </CardContent>
        </Card>
      ) : !membership || !householdId ? (
        <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)]">
          <CardContent className="space-y-3 pt-5 text-[13px]">
            <div className="flex items-center gap-2 text-ink-900">
              <UserPlus className="h-4 w-4 text-[var(--tide-2)]" />
              <span className="font-semibold">
                {L("Set up your care team", "创建您的护理团队")}
              </span>
            </div>
            <p className="text-ink-700">
              {patientName
                ? L(
                    `One tap creates ${patientName}'s care team and lets you start sharing it with carers.`,
                    `轻触一下即可创建 ${patientName} 的护理团队，并开始邀请家人。`,
                  )
                : L(
                    "One tap creates your care team and lets you start sharing it with carers.",
                    "轻触一下即可创建您的护理团队，并开始邀请家人。",
                  )}
            </p>
            {bootstrapError && (
              <Alert variant="warn" dense>
                {bootstrapError}
              </Alert>
            )}
            <Button
              size="md"
              onClick={() =>
                void (async () => {
                  const id = await bootstrapHousehold();
                  if (id) setShowInviteFlow(true);
                })()
              }
              disabled={bootstrapping}
            >
              {bootstrapping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {bootstrapping
                ? L("Setting up…", "创建中…")
                : L("Set up & invite a carer", "创建并邀请护理人员")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Primary CTA — the answer to "no obvious way to add carers".
              Visible to anyone the matrix lets invite (primary_carer +
              patient). Other roles see the read-only hint below. */}
          {canInvite && !showInviteFlow && (
            <Card className="border-[var(--tide-2)]/40 bg-[var(--tide-soft)]">
              <CardContent className="flex items-center justify-between gap-3 pt-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tide-2)]/15 text-[var(--tide-2)]">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink-900">
                      {L("Add a carer", "添加护理人员")}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-ink-500">
                      {L(
                        "Send an invite link — family member, clinician, or observer.",
                        "发送邀请链接 —— 家人、医师或观察者均可。",
                      )}
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowInviteFlow(true)} size="md">
                  {L("Add carer", "添加")}
                </Button>
              </CardContent>
            </Card>
          )}

          {!canInvite && (
            <Card>
              <CardContent className="flex items-start gap-2 pt-4 text-[12.5px] text-ink-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {L(
                    "Only the patient or primary carer can add new carers. Ask one of them if you'd like to bring someone in.",
                    "仅患者或主要照护者可添加新成员。如需新增，请与他们沟通。",
                  )}
                </span>
              </CardContent>
            </Card>
          )}

          {canInvite && showInviteFlow && (
            <InviteCarerFlow
              householdId={householdId}
              onClose={() => setShowInviteFlow(false)}
              onIssued={() => void reload()}
            />
          )}

          <section className="space-y-2">
            <SectionHeader title={L("On Anchor", "Anchor 账号")} />
            {loadingData && members.length === 0 ? (
              <Card>
                <CardContent className="flex items-center gap-2 pt-5 text-[13px] text-ink-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {L("Loading members…", "加载成员中…")}
                </CardContent>
              </Card>
            ) : (
              <MembersList
                members={members}
                currentUserId={profile?.id ?? session?.userId ?? null}
                isPrimary={Boolean(isPrimary)}
                householdId={householdId}
                onChanged={reload}
              />
            )}
          </section>

          {canInvite && invites.length > 0 && (
            <section className="space-y-2">
              <SectionHeader title={L("Invites", "邀请")} />
              <PendingInvitesList invites={invites} onChanged={reload} />
            </section>
          )}
        </>
      )}

      {/* Local contacts ALWAYS renders — pure offline / Dexie. The
          phone book is the most important fallback when sync is
          flaky: tired carer needs to call the oncologist, opens
          /carers, gets the number. Don't gate it behind anything. */}
      <section className="space-y-2">
        <SectionHeader title={L("Local contacts", "本地通讯录")} />
        <LocalContactsSection />
      </section>

      <section className="pt-2">
        <Link
          href="/care-team"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {L("View clinical contact log", "查看就诊 / 通话记录")}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </section>
    </div>
  );
}

// Inline diagnostic for the "Sign in to invite" branch on /carers.
// Reads the Supabase session directly (separate from useAuthSession's
// state to avoid a chicken-and-egg with the gate it controls) and
// dumps a plain-text summary the user can read or screenshot.
//
// The bug we keep chasing: a user is convinced they're signed in but
// the gate disagrees. The only way to distinguish the real cause
// (cookies cleared / cross-origin session / expired token / browser
// extension blocking storage) is to see what getSession actually
// returns in their browser. Self-contained — no props.
function SessionDiag() {
  const [info, setInfo] = useState<string[]>(["resolving…"]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lines: string[] = [];
      try {
        const { isSupabaseConfigured: isCfg, getSupabaseBrowser: getSb } =
          await import("~/lib/supabase/client");
        lines.push(`supabase configured: ${isCfg() ? "yes" : "no"}`);
        // Local storage probe — surfaces "blocked by browser /
        // private mode" cases that silently break Supabase JS auth.
        try {
          const probeKey = "__anchor_diag_probe";
          window.localStorage.setItem(probeKey, "1");
          window.localStorage.removeItem(probeKey);
          lines.push("localStorage: writable");
        } catch {
          lines.push("localStorage: BLOCKED (private mode / disabled)");
        }
        lines.push(`cookies enabled: ${navigator.cookieEnabled ? "yes" : "no"}`);
        const sb = getSb();
        if (!sb) {
          lines.push("client: not constructed");
          if (!cancelled) setInfo(lines);
          return;
        }
        const sess = await sb.auth.getSession();
        if (sess.error) {
          lines.push(`getSession error: ${sess.error.message}`);
        }
        const session = sess.data.session;
        lines.push(`session present: ${session ? "yes" : "no"}`);
        if (session) {
          lines.push(`user id: ${session.user.id.slice(0, 8)}…`);
          if (session.expires_at) {
            const exp = new Date(session.expires_at * 1000).toISOString();
            lines.push(`expires at: ${exp}`);
            lines.push(
              `expired: ${session.expires_at * 1000 < Date.now() ? "YES" : "no"}`,
            );
          }
        }
        const userResp = await sb.auth.getUser();
        if (userResp.error) {
          lines.push(`getUser error: ${userResp.error.message}`);
        } else {
          lines.push(
            `getUser id: ${userResp.data.user?.id?.slice(0, 8) ?? "(null)"}…`,
          );
        }
      } catch (err) {
        lines.push(
          `diag exception: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        if (!cancelled) setInfo(lines);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <details className="rounded-md border border-ink-200 bg-paper-2 p-2 text-[11px] text-ink-600">
      <summary className="cursor-pointer select-none font-medium text-ink-700">
        Why does this say sign in?
      </summary>
      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[10.5px] leading-snug">
        {info.join("\n")}
      </pre>
    </details>
  );
}
