"use client";

import { useMemo, useState } from "react";
import { applyIngestOps } from "~/lib/ingest/operations";
import type {
  IngestApplyResult,
  IngestDraft,
  IngestOp,
  IngestOpKind,
} from "~/types/ingest";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  CalendarPlus,
  CalendarClock,
  TestTube2,
  Pill,
  Users,
  ListChecks,
  BookOpenText,
  Check,
  X,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

const OP_ICON: Record<IngestOpKind, React.ComponentType<{ className?: string }>> = {
  add_appointment: CalendarPlus,
  update_appointment: CalendarClock,
  add_lab_result: TestTube2,
  add_medication: Pill,
  add_care_team_member: Users,
  add_task: ListChecks,
  add_life_event: BookOpenText,
};

const OP_LABEL: Record<IngestOpKind, { en: string; zh: string }> = {
  add_appointment: { en: "New appointment", zh: "新增预约" },
  update_appointment: { en: "Update appointment", zh: "更新预约" },
  add_lab_result: { en: "New lab result", zh: "新增化验结果" },
  add_medication: { en: "New medication", zh: "新增用药" },
  add_care_team_member: { en: "New care-team contact", zh: "新增团队联系人" },
  add_task: { en: "New task", zh: "新增任务" },
  add_life_event: { en: "Note this event", zh: "记录事件" },
};

interface Props {
  draft: IngestDraft;
  onApplied: (results: IngestApplyResult[]) => void;
  onDiscard: () => void;
}

export function PreviewDiff({ draft, onApplied, onDiscard }: Props) {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  // Per-op include toggle. Defaults: every op selected, except low-
  // confidence drafts where we let the user opt in deliberately.
  const initialSelected = useMemo(() => {
    const set = new Set<number>();
    if (draft.confidence !== "low") {
      draft.ops.forEach((_, i) => set.add(i));
    }
    return set;
  }, [draft]);
  const [selected, setSelected] = useState<Set<number>>(initialSelected);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<IngestApplyResult[] | null>(null);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function applySelected() {
    const ops = draft.ops.filter((_, i) => selected.has(i));
    if (ops.length === 0) return;
    setApplying(true);
    try {
      const r = await applyIngestOps(ops);
      setResults(r);
      onApplied(r);
    } finally {
      setApplying(false);
    }
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = (results?.length ?? 0) - okCount;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tide-2)]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-semibold text-ink-900">
                {L(
                  "Proposed changes",
                  "建议的变更",
                )}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
                  draft.confidence === "high"
                    ? "bg-[var(--ok-soft)] text-[var(--ok)]"
                    : draft.confidence === "medium"
                      ? "bg-ink-100 text-ink-700"
                      : "bg-[var(--warn-soft)] text-[var(--warn)]",
                )}
              >
                {draft.confidence}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-ink-500">{draft.summary}</p>
          </div>
        </div>

        {draft.ambiguities.length > 0 && (
          <div className="rounded-md border border-[var(--sand-2)]/40 bg-[var(--sand)]/40 p-2.5 text-[11.5px] text-ink-700">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3 w-3" />
              {L("Things I guessed", "我做了这些假设")}
            </div>
            <ul className="list-disc space-y-0.5 pl-4">
              {draft.ambiguities.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <ul className="space-y-2">
          {draft.ops.map((op, i) => (
            <li key={i}>
              <OpCard
                op={op}
                index={i}
                selected={selected.has(i)}
                result={results?.[results.findIndex((r) => r.op === op)] ?? null}
                onToggle={() => toggle(i)}
                locale={locale}
              />
            </li>
          ))}
        </ul>

        {results ? (
          <div className="flex items-center justify-between rounded-md border border-ink-200 bg-paper-2 p-3 text-[13px]">
            <div>
              <span className="font-semibold text-[var(--ok)]">
                {okCount} {L("applied", "已应用")}
              </span>
              {failCount > 0 && (
                <span className="ml-2 text-[var(--warn)]">
                  {failCount} {L("failed", "失败")}
                </span>
              )}
            </div>
            <Button onClick={onDiscard} variant="ghost">
              {L("Done", "完成")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={onDiscard}>
              <X className="h-4 w-4" />
              {L("Discard", "放弃")}
            </Button>
            <Button
              onClick={applySelected}
              disabled={applying || selected.size === 0}
              size="lg"
            >
              <Check className="h-4 w-4" />
              {applying
                ? L("Applying…", "应用中…")
                : L(
                    `Apply ${selected.size} change${selected.size === 1 ? "" : "s"}`,
                    `应用 ${selected.size} 项变更`,
                  )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OpCard({
  op,
  index,
  selected,
  result,
  onToggle,
  locale,
}: {
  op: IngestOp;
  index: number;
  selected: boolean;
  result: IngestApplyResult | null;
  onToggle: () => void;
  locale: "en" | "zh";
}) {
  const Icon = OP_ICON[op.kind];
  const label = OP_LABEL[op.kind][locale];
  const lines = describeOp(op, locale);
  const reason = "reason" in op && op.reason ? op.reason : null;

  return (
    <div
      className={cn(
        "rounded-[var(--r-md)] border p-3",
        result?.ok
          ? "border-[var(--ok)]/40 bg-[var(--ok-soft)]/40"
          : result && !result.ok
            ? "border-[var(--warn)]/40 bg-[var(--warn-soft)]/40"
            : selected
              ? "border-ink-900 bg-ink-900/[0.03]"
              : "border-ink-100 bg-paper-2",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={Boolean(result)}
          className="mt-1 h-4 w-4 shrink-0 accent-ink-900"
        />
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-paper-2 text-[var(--tide-2)]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink-900">
              {label}
            </span>
            <span className="mono text-[10px] text-ink-400">#{index + 1}</span>
          </div>
          {reason && (
            <p className="mt-0.5 text-[11.5px] italic text-ink-500">
              {reason}
            </p>
          )}
          {lines.length > 0 && (
            <dl className="mt-1.5 space-y-0.5 text-[12px]">
              {lines.map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <dt className="mono text-[10.5px] uppercase tracking-[0.08em] text-ink-400">
                    {k}
                  </dt>
                  <dd className="text-ink-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {result && !result.ok && (
            <p className="mt-1.5 text-[11px] text-[var(--warn)]">
              {result.error}
            </p>
          )}
          {result?.ok && (
            <p className="mt-1.5 text-[11px] text-[var(--ok)]">
              {locale === "zh" ? `已保存 #${result.id}` : `Saved as #${result.id}`}
            </p>
          )}
        </div>
      </label>
    </div>
  );
}

function describeOp(op: IngestOp, locale: "en" | "zh"): Array<[string, string]> {
  const data = "data" in op ? op.data : "changes" in op ? op.changes : {};
  const out: Array<[string, string]> = [];
  function push(key: string, value: unknown) {
    if (value === null || value === undefined || value === "") return;
    if (Array.isArray(value)) value = value.join(", ");
    out.push([key, String(value)]);
  }

  // Order is curated for readability per op kind; everything else
  // gets dumped at the end so the user can audit.
  const showFirst: Record<string, string[]> = {
    add_appointment: ["title", "kind", "starts_at", "location", "doctor", "phone", "notes"],
    update_appointment: ["title", "starts_at", "location", "doctor", "status", "notes"],
    add_lab_result: ["date", "ca199", "albumin", "hemoglobin", "neutrophils", "platelets", "creatinine"],
    add_medication: ["drug_id", "category", "dose", "schedule", "started_on", "notes"],
    add_care_team_member: ["name", "role", "specialty", "organisation", "phone", "email"],
    add_task: ["title", "due_date", "priority", "category", "notes"],
    add_life_event: ["title", "event_date", "category", "notes"],
  };
  const order = showFirst[op.kind] ?? [];
  for (const k of order) push(k, (data as Record<string, unknown>)[k]);
  for (const [k, v] of Object.entries(data)) {
    if (order.includes(k)) continue;
    push(k, v);
  }

  // Match info for updates
  if (op.kind === "update_appointment" && op.match) {
    if (typeof op.match.id === "number") push("matches id", op.match.id);
    if (op.match.title_contains)
      push(locale === "zh" ? "匹配标题" : "matches title", op.match.title_contains);
    if (op.match.on_date)
      push(locale === "zh" ? "于日期" : "on date", op.match.on_date);
  }
  return out;
}
