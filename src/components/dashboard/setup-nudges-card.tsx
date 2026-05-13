"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronRight,
  Clock,
  CloudOff,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { db, now } from "~/lib/db/dexie";
import {
  getSupabaseBrowser,
  isSupabaseConfigured,
} from "~/lib/supabase/client";
import { useCan } from "~/hooks/use-can";
import { useHousehold } from "~/hooks/use-household";
import { listInvites } from "~/lib/supabase/households";
import { useLocale, pickL, useT } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";

// Single consolidated "Set up Anchor" card that absorbs the four
// stand-alone housekeeping nudges (baseline assessment, family invite,
// pending invites awaiting acceptance, sign-in-to-sync). Rationale:
// each nudge previously rendered as its own full-width card stacked
// at the bottom of the dashboard. With 2–4 active at once, that's
// 2–4 near-identical cards of housekeeping pushing real content out
// of view. CLAUDE.md's "single channel out" doctrine wants the
// dashboard to read as one ranked feed; a Setup section with compact
// rows preserves the same affordances at a fraction of the visual
// weight.
//
// Renders nothing when no nudge is active. Each row is a one-tap
// link to the relevant surface; the SyncPrompt row keeps its
// dismiss affordance because that nudge can be silenced.

const SYNC_DISMISS_KEY = "anchor.syncPromptDismissedAt";

type Nudge = {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "tide" | "sand" | "ink";
  title: string;
  subtitle: string;
  cta: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

export function SetupNudgesCard() {
  const locale = useLocale();
  const t = useT();
  const L = pickL(locale);
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const entryCount = useLiveQuery(() => db.daily_entries.count(), [], 0);
  const hasComplete = useLiveQuery(async () => {
    const rows = await db.comprehensive_assessments
      .orderBy("assessment_date")
      .reverse()
      .limit(5)
      .toArray();
    return rows.some((r) => r.status === "complete");
  });
  const canSeePending = useCan("see_pending_invites");
  const { membership, loading: householdLoading } = useHousehold();

  // Auth state — drives the sync nudge + the invite-family nudge.
  // `null` (not undefined) means "resolved and signed out". `undefined`
  // means "still resolving" so we hold off rendering decisions.
  const [signedIn, setSignedIn] = useState<boolean | null | undefined>(
    undefined,
  );
  const [syncDismissed, setSyncDismissed] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      setSyncDismissed(Boolean(localStorage.getItem(SYNC_DISMISS_KEY)));
    } catch {
      // private mode — fine, treat as not dismissed
    }
    if (!isSupabaseConfigured()) {
      // No cloud option configured. Treat as "signed in" so we don't
      // surface the sync nudge in offline-only deployments.
      setSignedIn(true);
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setSignedIn(true);
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const next = Boolean(session?.user);
      setSignedIn(next);
      if (next) {
        try {
          localStorage.removeItem(SYNC_DISMISS_KEY);
        } catch {
          // ignore
        }
        setSyncDismissed(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Pending-invites count (primary_carer only). Lives in Supabase, so
  // we lift the same query the standalone PendingInvitesCard ran.
  useEffect(() => {
    if (!canSeePending || !membership) {
      setPendingCount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const rows = await listInvites(membership.household_id);
      if (cancelled) return;
      const cutoff = Date.now();
      setPendingCount(
        rows.filter(
          (i) =>
            !i.accepted_at &&
            !i.revoked_at &&
            new Date(i.expires_at).getTime() > cutoff,
        ).length,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [canSeePending, membership]);

  function dismissSync() {
    try {
      localStorage.setItem(SYNC_DISMISS_KEY, now());
    } catch {
      // ignore
    }
    setSyncDismissed(true);
  }

  const nudges: Nudge[] = [];

  // 1. Baseline capture — clinical priority. Surfaces while no
  // baseline weight is recorded and no comprehensive assessment is
  // complete.
  if (
    settings &&
    settings.onboarded_at &&
    !settings.baseline_weight_kg &&
    !hasComplete
  ) {
    nudges.push({
      key: "baseline",
      href: "/assessment",
      icon: Stethoscope,
      tone: "tide",
      title: L("Capture your baselines", "记录您的基线数据"),
      subtitle: L(
        "Weight, grip, gait — so we can spot any drift early.",
        "体重、握力、步速 — 便于及早发现变化。",
      ),
      cta: L("Open", "开始"),
    });
  }

  // 2. Pending invites — visible only to primary_carer.
  if (canSeePending && pendingCount && pendingCount > 0) {
    nudges.push({
      key: "pending",
      href: "/carers",
      icon: Clock,
      tone: "sand",
      title: L(
        `${pendingCount} invite${pendingCount === 1 ? "" : "s"} waiting`,
        `有 ${pendingCount} 份邀请等待接受`,
      ),
      subtitle: L(
        "They haven't signed up yet. Nudge them or revoke the link.",
        "对方尚未接受。可以提醒或撤销链接。",
      ),
      cta: L("Manage", "管理"),
    });
  }

  // 3. Invite family — only when signed in but no household exists.
  if (
    isSupabaseConfigured() &&
    signedIn === true &&
    !householdLoading &&
    !membership
  ) {
    nudges.push({
      key: "invite",
      href: "/carers?action=add-carer",
      icon: Users,
      tone: "tide",
      title: L("Invite family to your care plan", "邀请家人加入护理计划"),
      subtitle: L(
        "Share this dashboard with someone who helps with care.",
        "把这个面板分享给参与护理的家人。",
      ),
      cta: L("Set up", "开始"),
    });
  }

  // 4. Sign in to sync — only meaningful once the patient has data
  // worth syncing, and only when Supabase is configured.
  if (
    isSupabaseConfigured() &&
    signedIn === false &&
    !syncDismissed &&
    (entryCount ?? 0) >= 1
  ) {
    nudges.push({
      key: "sync",
      href: "/login",
      icon: CloudOff,
      tone: "ink",
      title: t("syncPrompt.title"),
      subtitle: t("syncPrompt.body"),
      cta: t("syncPrompt.cta"),
      onDismiss: dismissSync,
    });
  }

  if (nudges.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <div className="eyebrow px-1">
          {locale === "zh" ? "待设置" : "Set up Anchor"}
        </div>
        <ul className="space-y-1">
          {nudges.map((n) => (
            <NudgeRow key={n.key} nudge={n} dismissLabel={L("Dismiss", "忽略")} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function NudgeRow({
  nudge,
  dismissLabel,
}: {
  nudge: Nudge;
  dismissLabel: string;
}) {
  const Icon = nudge.icon;
  const toneCls =
    nudge.tone === "tide"
      ? "bg-[var(--tide-2)]/15 text-[var(--tide-2)]"
      : nudge.tone === "sand"
        ? "bg-[var(--sand)] text-ink-900"
        : "bg-ink-100 text-ink-500";
  return (
    <li className="flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-ink-100/30">
      <Link href={nudge.href} className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md " +
            toneCls
          }
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink-900">
            {nudge.title}
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
            {nudge.subtitle}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[12px] text-ink-500">
          {nudge.cta}
          <ChevronRight className="h-3 w-3" />
        </span>
      </Link>
      {nudge.onDismiss && (
        <button
          type="button"
          onClick={nudge.onDismiss}
          aria-label={dismissLabel}
          className="-mr-1 shrink-0 rounded p-1 text-ink-400 hover:text-ink-700"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </li>
  );
}
