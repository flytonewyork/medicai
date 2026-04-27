"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import {
  acceptInvite,
  daysUntilExpiry,
  friendlyInviteError,
  getCurrentProfile,
  getInvitePreview,
  isProfileComplete,
} from "~/lib/supabase/households";
import { ROLE_LABEL, ROLE_DESCRIPTION } from "~/lib/auth/permissions";
import type { InvitePreview } from "~/types/household";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Loader2,
  Users,
  Check,
  AlertCircle,
  Clock,
  UserCircle2,
  Heart,
} from "lucide-react";

// Landing page for someone following a household invite link.
//
// Three-stage UX:
//   1. fetch the PUBLIC preview ─ before forcing sign-in we tell the
//      visitor exactly who invited them, to whose care plan, as what
//      role, and how long the link is valid. Without this step a
//      relative who got a bare URL has to take it on faith and sign
//      in to an unknown app.
//   2. if signed in ─ accept the invite immediately and route to the
//      welcome wizard (or /family if the profile is already complete).
//   3. if signed out ─ show "Sign in" / "Create account" with the
//      `?next` param wired so the user comes back here after auth.
//
// Errors (expired / revoked / already-accepted / not-found) are
// surfaced from the preview itself so we don't make the user sign in
// just to learn the link is dead.

type Phase =
  | { kind: "loading_preview" }
  | { kind: "needs_signin"; preview: InvitePreview }
  | { kind: "accepting"; preview: InvitePreview }
  | { kind: "accepted"; preview: InvitePreview }
  | { kind: "preview_error"; preview: InvitePreview }
  | { kind: "accept_error"; message: string; preview: InvitePreview }
  | { kind: "no_token" };

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const [phase, setPhase] = useState<Phase>(
    token ? { kind: "loading_preview" } : { kind: "no_token" },
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    void (async () => {
      let preview: InvitePreview;
      try {
        preview = await getInvitePreview(token);
      } catch {
        if (cancelled) return;
        // Preview RPC is best-effort — if it errors out (e.g. cache miss
        // or migration not yet applied), fall back to attempting the
        // accept flow with auth, which has its own error handling.
        preview = {
          status: "active",
          household_name: null,
          patient_display_name: null,
          role: null,
          invited_by_name: null,
          expires_at: null,
          accepted_at: null,
          revoked_at: null,
        };
      }
      if (cancelled) return;

      if (preview.status !== "active") {
        setPhase({ kind: "preview_error", preview });
        return;
      }

      const sb = getSupabaseBrowser();
      if (!sb) {
        setPhase({
          kind: "accept_error",
          preview,
          message: L(
            "Supabase is not configured on this build.",
            "本版本未配置 Supabase。",
          ),
        });
        return;
      }
      // getSession() reads from local storage — no network call. The
      // accept RPC below verifies auth server-side anyway, so we don't
      // need the network round-trip from getUser() here, and skipping
      // it prevents the page from hanging on flaky / Capacitor networks.
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) {
        setPhase({ kind: "needs_signin", preview });
        return;
      }
      setPhase({ kind: "accepting", preview });
      try {
        await acceptInvite(token);
        if (cancelled) return;
        setPhase({ kind: "accepted", preview });
        const profile = await getCurrentProfile().catch(() => null);
        const next = isProfileComplete(profile) ? "/family" : "/invite/welcome";
        setTimeout(() => router.replace(next), 1200);
      } catch (err) {
        if (!cancelled)
          setPhase({
            kind: "accept_error",
            preview,
            message: friendlyInviteError(err),
          });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md space-y-5 p-6 pt-12">
      <PageHeader
        eyebrow={L("CARE TEAM", "护理团队")}
        title={L("You've been invited", "您收到了一份邀请")}
      />

      {phase.kind === "no_token" && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--warn)]" />
            <div className="text-[13px] text-ink-500">
              {L(
                "This invite link is missing its token.",
                "此邀请链接缺少令牌。",
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {phase.kind === "loading_preview" && (
        <Card>
          <CardContent className="flex items-center gap-2 pt-5 text-[13px] text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {L("Checking invite…", "正在检查邀请…")}
          </CardContent>
        </Card>
      )}

      {phase.kind === "needs_signin" && (
        <>
          <PreviewCard preview={phase.preview} locale={locale} />
          <SignInActions token={token!} locale={locale} />
        </>
      )}

      {phase.kind === "accepting" && (
        <>
          <PreviewCard preview={phase.preview} locale={locale} />
          <Card>
            <CardContent className="flex items-center gap-2 pt-5 text-[13px] text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {L("Accepting invite…", "正在加入…")}
            </CardContent>
          </Card>
        </>
      )}

      {phase.kind === "accepted" && (
        <>
          <PreviewCard preview={phase.preview} locale={locale} />
          <Card>
            <CardContent className="flex items-start gap-3 pt-5">
              <Check className="mt-0.5 h-5 w-5 text-[var(--ok)]" />
              <div>
                <div className="text-[14px] font-semibold text-ink-900">
                  {L("Welcome to the team", "欢迎加入")}
                </div>
                <p className="mt-1 text-[13px] text-ink-500">
                  {L(
                    "Setting things up for you…",
                    "正在为您准备…",
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {phase.kind === "preview_error" && (
        <PreviewErrorCard preview={phase.preview} locale={locale} />
      )}

      {phase.kind === "accept_error" && (
        <>
          <PreviewCard preview={phase.preview} locale={locale} />
          <Card>
            <CardContent className="flex items-start gap-3 pt-5">
              <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--warn)]" />
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink-900">
                  {L("Couldn't accept the invite", "无法接受邀请")}
                </div>
                <p className="mt-1 text-[13px] text-ink-500">
                  {phase.message}
                </p>
                <p className="mt-3 text-[12px] text-ink-500">
                  {L(
                    "Ask the primary carer to send a fresh invite link.",
                    "请联系主要照护者重新发送邀请链接。",
                  )}
                </p>
                <Link
                  href="/"
                  className="mt-3 inline-block text-[12px] text-ink-500 underline-offset-2 hover:underline"
                >
                  {L("Go to dashboard", "返回主页")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// Trust-building card. Shown for every active invite — pre- and post-
// auth. The hierarchy is: WHO is being cared for (most personal) →
// WHO invited you (consent / familiarity) → WHAT role you'll have
// (sets expectations) → HOW LONG the link is valid (creates a soft
// deadline without alarm).
function PreviewCard({
  preview,
  locale,
}: {
  preview: InvitePreview;
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const patientName =
    preview.patient_display_name?.trim() ||
    preview.household_name?.trim() ||
    L("the family", "家庭");
  const inviterName =
    preview.invited_by_name?.trim() || L("the primary carer", "主要照护者");
  const role = preview.role;
  const days = preview.expires_at ? daysUntilExpiry(preview.expires_at) : null;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tide-2)]/15 text-[var(--tide-2)]">
            <Heart className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
              {L("Joining", "加入")}
            </div>
            <div className="serif text-[20px] leading-tight text-ink-900">
              {L(`${patientName}'s care team`, `${patientName} 的护理团队`)}
            </div>
          </div>
        </div>

        <ul className="space-y-2.5 border-t border-ink-100 pt-3 text-[13px]">
          <li className="flex items-start gap-2.5">
            <UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
                {L("Invited by", "邀请人")}
              </div>
              <div className="text-ink-900">{inviterName}</div>
            </div>
          </li>
          {role && (
            <li className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
                  {L("Your role", "您的角色")}
                </div>
                <div className="font-medium text-ink-900">
                  {ROLE_LABEL[role][locale]}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
                  {ROLE_DESCRIPTION[role][locale]}
                </div>
              </div>
            </li>
          )}
          {days !== null && (
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <div className="text-ink-700">
                {days <= 0
                  ? L("This link expires today.", "此链接今日到期。")
                  : days === 1
                    ? L("This link expires tomorrow.", "此链接明日到期。")
                    : L(
                        `This link is valid for another ${days} days.`,
                        `此链接在 ${days} 天内有效。`,
                      )}
              </div>
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function SignInActions({
  token,
  locale,
}: {
  token: string;
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const next = `/invite/${token}`;
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <p className="text-[13px] text-ink-500">
          {L(
            "Sign in or create your Anchor account to accept. Your account is yours — you can use it across devices.",
            "请登录或创建 Anchor 账号以接受邀请。账号属于您本人，可在多设备使用。",
          )}
        </p>
        <Link href={`/login?next=${encodeURIComponent(next)}`}>
          <Button size="lg" className="w-full">
            {L("Sign in to accept", "登录以接受邀请")}
          </Button>
        </Link>
        <p className="text-center text-[11.5px] text-ink-400">
          {L(
            "New here? The same screen lets you create an account.",
            "首次使用？同一页面可创建账号。",
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function PreviewErrorCard({
  preview,
  locale,
}: {
  preview: InvitePreview;
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const message = (() => {
    switch (preview.status) {
      case "expired":
        return L(
          "This invite link has expired. Ask the primary carer to extend it or send a fresh one.",
          "此邀请链接已过期。请联系主要照护者延长有效期或重新发送。",
        );
      case "revoked":
        return L(
          "This invite has been revoked. Ask the primary carer to send a fresh link.",
          "此邀请已被撤销。请联系主要照护者重新发送链接。",
        );
      case "accepted":
        return L(
          "This invite has already been accepted. If that wasn't you, ask the primary carer for a new link.",
          "此邀请已被接受。如非您本人接受，请联系主要照护者重新生成链接。",
        );
      case "not_found":
      default:
        return L(
          "This invite link doesn't match anything in our records.",
          "未在系统中找到匹配的邀请链接。",
        );
    }
  })();
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-5">
        <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--warn)]" />
        <div className="flex-1 space-y-2">
          <div className="text-[14px] font-semibold text-ink-900">
            {L("Can't accept this invite", "无法接受此邀请")}
          </div>
          <p className="text-[13px] text-ink-500">{message}</p>
          <Link
            href="/"
            className="inline-block text-[12px] text-ink-500 underline-offset-2 hover:underline"
          >
            {L("Go to dashboard", "返回主页")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
