"use client";

import { useState } from "react";
import {
  daysUntilExpiry,
  extendInviteExpiry,
  friendlyInviteError,
  inviteStatusBucket,
  inviteUrl,
  revokeInvite,
} from "~/lib/supabase/households";
import { ROLE_LABEL } from "~/lib/auth/permissions";
import type { HouseholdInvite } from "~/types/household";
import { useLocale, useL } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import {
  Clock,
  Copy,
  RotateCw,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

interface Props {
  invites: HouseholdInvite[];
  onChanged?: () => void;
}

// Pending-and-recent invites view used on /household. Shows live
// (active), expired, accepted, and revoked invites separately so the
// primary carer can tell at a glance which links are still hot. Only
// renders when there's actually something to show — no empty state,
// because the issuance UI lives directly above this list.
export function PendingInvitesList({ invites, onChanged }: Props) {
  const locale = useLocale();
  const L = useL();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const buckets = {
    active: [] as HouseholdInvite[],
    expired: [] as HouseholdInvite[],
    accepted: [] as HouseholdInvite[],
    revoked: [] as HouseholdInvite[],
  };
  for (const inv of invites) {
    buckets[inviteStatusBucket(inv)].push(inv);
  }

  if (invites.length === 0) return null;

  async function copy(token: string) {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(
        inviteUrl(token, window.location.origin),
      );
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    } catch {
      // ignore — clipboard can fail on insecure origins
    }
  }

  async function revoke(invite: HouseholdInvite) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(L("Revoke this invite link?", "撤销此邀请链接？"))
    )
      return;
    setBusy(invite.id);
    setError(null);
    try {
      await revokeInvite(invite.id);
      await onChanged?.();
    } catch (err) {
      setError(friendlyInviteError(err));
    } finally {
      setBusy(null);
    }
  }

  async function extend(invite: HouseholdInvite) {
    setBusy(invite.id);
    setError(null);
    try {
      await extendInviteExpiry({ invite_id: invite.id, days: 14 });
      await onChanged?.();
    } catch (err) {
      setError(friendlyInviteError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2.5 text-[12px] text-[var(--warn)]"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {buckets.active.length > 0 && (
        <Group title={L("Waiting", "等待接受")} count={buckets.active.length}>
          {buckets.active.map((inv) => (
            <ActiveRow
              key={inv.id}
              invite={inv}
              copied={copiedToken === inv.token}
              busy={busy === inv.id}
              onCopy={() => void copy(inv.token)}
              onRevoke={() => void revoke(inv)}
              onExtend={() => void extend(inv)}
              locale={locale}
            />
          ))}
        </Group>
      )}

      {buckets.expired.length > 0 && (
        <Group title={L("Expired", "已过期")} count={buckets.expired.length}>
          {buckets.expired.map((inv) => (
            <SimpleRow
              key={inv.id}
              invite={inv}
              tone="warn"
              right={
                <button
                  type="button"
                  onClick={() => void extend(inv)}
                  disabled={busy === inv.id}
                  className="text-[11.5px] text-ink-500 hover:text-ink-900 disabled:opacity-50"
                >
                  <RotateCw className="mr-1 inline h-3 w-3" />
                  {L("Extend 14 days", "延长 14 天")}
                </button>
              }
              locale={locale}
            />
          ))}
        </Group>
      )}

      {buckets.accepted.length > 0 && (
        <Group title={L("Accepted", "已接受")} count={buckets.accepted.length}>
          {buckets.accepted.map((inv) => (
            <SimpleRow
              key={inv.id}
              invite={inv}
              tone="ok"
              right={
                <span className="text-[11px] text-ink-500">
                  {inv.accepted_at &&
                    new Date(inv.accepted_at).toLocaleDateString(
                      locale === "zh" ? "zh-CN" : undefined,
                      { day: "numeric", month: "short" },
                    )}
                </span>
              }
              locale={locale}
            />
          ))}
        </Group>
      )}

      {buckets.revoked.length > 0 && (
        <Group title={L("Revoked", "已撤销")} count={buckets.revoked.length}>
          {buckets.revoked.map((inv) => (
            <SimpleRow
              key={inv.id}
              invite={inv}
              tone="muted"
              right={null}
              locale={locale}
            />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
        <span>{title}</span>
        <span className="mono text-ink-500">{count}</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-ink-100">{children}</ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveRow({
  invite,
  copied,
  busy,
  onCopy,
  onRevoke,
  onExtend,
  locale,
}: {
  invite: HouseholdInvite;
  copied: boolean;
  busy: boolean;
  onCopy: () => void;
  onRevoke: () => void;
  onExtend: () => void;
  locale: "en" | "zh";
}) {
  const L = useL();
  const days = daysUntilExpiry(invite.expires_at);
  const nearExpiry = days <= 3;
  return (
    <li className="space-y-2 px-3 py-3 text-[13px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-ink-900">
            {invite.email_hint?.trim() || L("Unnamed invite", "未命名邀请")}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-500">
            <span className="rounded-full bg-paper-2 px-2 py-0.5 font-medium text-ink-700">
              {ROLE_LABEL[invite.role][locale]}
            </span>
            <Clock className="h-3 w-3" />
            <span className={cn(nearExpiry && "text-[var(--warn)]")}>
              {days <= 0
                ? L("Expires today", "今天到期")
                : days === 1
                  ? L("Expires tomorrow", "明天到期")
                  : L(
                      `Expires in ${days} days`,
                      `${days} 天后到期`,
                    )}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-ink-700 hover:bg-ink-100/40"
        >
          {copied ? (
            <Check className="h-3 w-3 text-[var(--ok)]" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? L("Copied", "已复制") : L("Copy link", "复制链接")}
        </button>
        {nearExpiry && (
          <button
            type="button"
            onClick={onExtend}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-ink-700 hover:bg-ink-100/40 disabled:opacity-50"
          >
            <RotateCw className="h-3 w-3" />
            {L("Extend 14 days", "延长 14 天")}
          </button>
        )}
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="inline-flex items-center gap-1 text-ink-500 hover:text-[var(--warn)] disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          {L("Revoke", "撤销")}
        </button>
      </div>
    </li>
  );
}

function SimpleRow({
  invite,
  tone,
  right,
  locale,
}: {
  invite: HouseholdInvite;
  tone: "warn" | "ok" | "muted";
  right: React.ReactNode;
  locale: "en" | "zh";
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-[12.5px]">
      <div className="min-w-0">
        <div
          className={cn(
            "truncate font-medium",
            tone === "warn"
              ? "text-[var(--warn)]"
              : tone === "ok"
                ? "text-ink-900"
                : "text-ink-500 line-through",
          )}
        >
          {invite.email_hint?.trim() ||
            (locale === "zh" ? "未命名邀请" : "Unnamed invite")}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-500">
          {ROLE_LABEL[invite.role][locale]}
        </div>
      </div>
      {right}
    </li>
  );
}
