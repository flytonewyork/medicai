"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { generateFollowUps, type FollowUpItem } from "~/lib/log/follow-ups";
import { addDiscussionItem } from "~/lib/appointments/discussion-items";
import type { DirectFileResult } from "~/lib/log/direct-file";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Check,
  MessageCircle,
  Phone,
  Mail,
  Sparkles,
  CalendarPlus,
  AlertTriangle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { Appointment } from "~/types/appointment";
import { cn } from "~/lib/utils/cn";

// Renders ranked next-step suggestions for a direct-filed data point.
// Actions are one-tap: add to the next clinic's discussion items, open
// the default SMS / email app for the right care-team member, or kick
// off a specialist agent. Care-team + next-clinic lookups live on the
// same card so the caller just passes the DirectFileResult.

const SEVERITY_STYLES: Record<
  FollowUpItem["severity"],
  { bg: string; border: string; dot: string; accent: string; iconColor: string }
> = {
  urgent: {
    bg: "bg-[var(--warn-soft)]",
    border: "border-[var(--warn)]/40",
    dot: "bg-[var(--warn)]",
    accent: "text-[var(--warn)]",
    iconColor: "text-[var(--warn)]",
  },
  watch: {
    bg: "bg-[var(--sand)]/40",
    border: "border-[var(--sand-2)]/40",
    dot: "bg-[oklch(55%_0.08_70)]",
    accent: "text-[oklch(35%_0.04_70)]",
    iconColor: "text-[oklch(35%_0.04_70)]",
  },
  routine: {
    bg: "bg-[var(--tide-soft)]/60",
    border: "border-[var(--tide-2)]/30",
    dot: "bg-[var(--tide-2)]",
    accent: "text-[var(--tide-2)]",
    iconColor: "text-[var(--tide-2)]",
  },
};

export function FollowUpsCard({ filed }: { filed: DirectFileResult }) {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const team = useLiveQuery(() => db.care_team.toArray(), []);
  const nextClinic = useLiveQuery(async () => {
    const rows = await db.appointments
      .where("[kind+starts_at]")
      .between(["clinic", ""], ["clinic", "￿"])
      .toArray();
    const now = Date.now();
    return rows
      .filter((a) => a.status !== "cancelled" && a.status !== "missed")
      .map((a) => ({ a, t: new Date(a.starts_at).getTime() }))
      .filter(({ t }) => Number.isFinite(t) && t >= now)
      .sort((x, y) => x.t - y.t)[0]?.a as Appointment | undefined;
  }, []);

  const items = useMemo(() => {
    if (!team) return [];
    return generateFollowUps({
      filed,
      team,
      nextClinic,
      locale,
    });
  }, [filed, team, nextClinic, locale]);

  if (team === undefined) return null;
  if (items.length === 0) return null;

  return (
    <Card className="border-ink-200/60">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
          <Sparkles className="h-3.5 w-3.5 text-[var(--tide-2)]" />
          {L("Next steps", "后续处理")}
        </div>
        <p className="text-[12px] text-ink-500">
          {L(
            "Anchor watched what you filed and suggested what to do next. One tap.",
            "系统根据你刚记录的内容自动建议下一步。一键完成。",
          )}
        </p>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <FollowUpRow item={item} locale={locale} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FollowUpRow({
  item,
  locale,
}: {
  item: FollowUpItem;
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const style = SEVERITY_STYLES[item.severity];
  return (
    <div
      className={cn(
        "rounded-[var(--r-md)] border p-3",
        style.bg,
        style.border,
      )}
    >
      <div className="flex items-start gap-2.5">
        {item.severity === "urgent" ? (
          <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", style.iconColor)} />
        ) : (
          <span
            className={cn(
              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
              style.dot,
            )}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink-900">
            {item.title[locale]}
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-700">
            {item.body[locale]}
          </p>
          {item.actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.actions.map((a, i) => (
                <ActionChip key={i} action={a} locale={locale} />
              ))}
            </div>
          )}
        </div>
        <span
          className={cn(
            "mono shrink-0 text-[9.5px] uppercase tracking-[0.12em]",
            style.accent,
          )}
        >
          {L(
            item.severity === "urgent"
              ? "Urgent"
              : item.severity === "watch"
                ? "Watch"
                : "Routine",
            item.severity === "urgent"
              ? "紧急"
              : item.severity === "watch"
                ? "留意"
                : "常规",
          )}
        </span>
      </div>
    </div>
  );
}

function ActionChip({
  action,
  locale,
}: {
  action: FollowUpItem["actions"][number];
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const [status, setStatus] =
    useState<"idle" | "working" | "done" | "error">("idle");

  async function run() {
    if (status === "working" || status === "done") return;
    setStatus("working");
    try {
      if (action.kind === "add_to_clinic") {
        await addDiscussionItem(action.appointment_id, {
          text: action.text,
          source: "direct_file",
        });
        setStatus("done");
      } else if (action.kind === "message_care_team") {
        // Open the default handler for tel:/sms:/mailto:. Not async in the
        // usual sense — set done immediately after navigating.
        window.location.href = action.target;
        setStatus("done");
      } else if (action.kind === "engage_agent") {
        const res = await fetch(`/api/agent/${action.agent_id}/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            date: new Date().toISOString().slice(0, 10),
            locale,
            trigger: "on_demand",
            referrals: [{ kind: "text", text: action.prompt }],
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        setStatus("done");
      }
    } catch {
      setStatus("error");
    }
  }

  const Icon = iconFor(action);
  const busyLabel = L("…", "…");
  const doneLabel = L("Done", "已完成");

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={status === "working" || status === "done"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
        status === "done"
          ? "border-[var(--ok)]/40 bg-[var(--ok-soft)] text-[var(--ok)]"
          : status === "error"
            ? "border-[var(--warn)]/40 bg-[var(--warn-soft)] text-[var(--warn)]"
            : "border-ink-200 bg-paper text-ink-700 hover:border-ink-400",
      )}
    >
      {status === "working" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : status === "done" ? (
        <Check className="h-3 w-3" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {status === "working"
        ? busyLabel
        : status === "done"
          ? doneLabel
          : action.label[locale]}
      {status === "idle" && <ChevronRight className="h-3 w-3 opacity-60" />}
    </button>
  );
}

function iconFor(action: FollowUpItem["actions"][number]) {
  if (action.kind === "add_to_clinic") return CalendarPlus;
  if (action.kind === "engage_agent") return Sparkles;
  if (action.kind === "message_care_team") {
    if (action.channel === "email") return Mail;
    if (action.channel === "phone") return Phone;
    return MessageCircle;
  }
  return Sparkles;
}
