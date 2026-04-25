"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  buildPatientState,
  extractObservationsByMetric,
  METRICS_BY_ID,
} from "~/lib/state";
import {
  deserializeSignal,
  evaluateAndPersistSignals,
  markActionTaken,
  setSignalStatus,
} from "~/lib/state/detectors/persistence";
import type {
  ChangeSignal,
  SignalSeverity,
  SuggestedAction,
} from "~/lib/state/detectors";
import type {
  ChangeSignalRow,
  Locale,
  SignalEventRow,
} from "~/types/clinical";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

const TONE_BY_SEVERITY: Record<
  SignalSeverity,
  { wrap: string; chip: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  caution: {
    wrap: "bg-[var(--sand)]/40 border-l-[3px] border-l-[oklch(45%_0.06_70)]",
    chip: "bg-[oklch(92%_0.04_70)] text-[oklch(45%_0.06_70)]",
    Icon: Bell,
  },
  warning: {
    wrap: "bg-[var(--warn-soft)] border-l-[3px] border-l-[var(--warn)]",
    chip: "bg-[var(--warn)] text-white",
    Icon: AlertTriangle,
  },
};

export function ChangeSignalsCard() {
  const locale = useLocale();
  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const dailies = useLiveQuery(
    () => db.daily_entries.orderBy("date").toArray(),
    [],
  );
  const fortnightlies = useLiveQuery(
    () => db.fortnightly_assessments.orderBy("assessment_date").toArray(),
    [],
  );
  const labs = useLiveQuery(() => db.labs.orderBy("date").toArray(), []);
  const cycles = useLiveQuery(() => db.treatment_cycles.toArray(), []);
  const careTeamContacts = useLiveQuery(
    () => db.care_team_contacts.toArray(),
    [],
  );
  const openSignalRows = useLiveQuery(
    () => db.change_signals.where("status").equals("open").toArray(),
    [],
  );
  const eventRows = useLiveQuery(() => db.signal_events.toArray(), []);

  // Re-evaluate detectors whenever the underlying data changes. The
  // persistence layer dedupes, so repeated evaluations are safe.
  useEffect(() => {
    if (!dailies || !fortnightlies || !labs || !cycles || !careTeamContacts) {
      return;
    }
    const asOf = new Date().toISOString();
    const inputs = {
      as_of: asOf,
      settings: settings?.[0] ?? null,
      dailies,
      fortnightlies,
      labs,
      cycles,
    };
    const state = buildPatientState(inputs);
    const observations = extractObservationsByMetric(inputs);
    void evaluateAndPersistSignals({
      state,
      observations,
      care_team_contacts: careTeamContacts,
      now: asOf,
    });
  }, [settings, dailies, fortnightlies, labs, cycles, careTeamContacts]);

  const eventsBySignalId = useMemo(() => {
    const out = new Map<number, SignalEventRow[]>();
    for (const e of eventRows ?? []) {
      const arr = out.get(e.signal_id) ?? [];
      arr.push(e);
      out.set(e.signal_id, arr);
    }
    return out;
  }, [eventRows]);

  const signals = useMemo(() => {
    if (!openSignalRows) return [];
    return openSignalRows
      .map((row) => ({ row, signal: safeDeserialize(row) }))
      .filter(
        (x): x is { row: ChangeSignalRow; signal: ChangeSignal } =>
          x.signal !== null,
      )
      .sort(
        (a, b) =>
          severityRank(b.signal.severity) - severityRank(a.signal.severity) ||
          Date.parse(b.row.detected_at) - Date.parse(a.row.detected_at),
      );
  }, [openSignalRows]);

  if (signals.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <div className="eyebrow">
          {locale === "zh" ? "变化信号" : "Change signals"}
        </div>
        <Link
          href="/signals"
          className="inline-flex items-center gap-0.5 text-[11px] text-ink-500 hover:text-ink-900"
        >
          {locale === "zh" ? "历史" : "History"}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {signals.map(({ row, signal }) => (
          <SignalRow
            key={row.id}
            row={row}
            signal={signal}
            locale={locale}
            events={row.id ? (eventsBySignalId.get(row.id) ?? []) : []}
          />
        ))}
      </div>
    </section>
  );
}

function SignalRow({
  row,
  signal,
  locale,
  events,
}: {
  row: ChangeSignalRow;
  signal: ChangeSignal;
  locale: Locale;
  events: SignalEventRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const tone = TONE_BY_SEVERITY[signal.severity];
  const metricDef = METRICS_BY_ID[signal.metric_id];
  const topCause = signal.differential.find(
    (d) => d.confidence !== "unlikely",
  );
  const actionsToShow = signal.actions.slice(0, 2);
  const actionsTaken = new Set(
    events
      .filter((e) => e.kind === "action_taken" && e.action_ref_id)
      .map((e) => e.action_ref_id!),
  );

  return (
    <Card className={cn("px-4 py-4", tone.wrap)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            tone.chip,
          )}
        >
          <tone.Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13.5px] font-semibold text-ink-900">
              {signal.title[locale]}
            </div>
            <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
              {signal.axis}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-700">
            {signal.explanation[locale]}
          </p>

          {topCause && (
            <div className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-700">
              <Sparkles className="h-3 w-3 text-ink-400" />
              <span className="font-medium">
                {topCause.label[locale]}
              </span>
              <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
                {topCause.confidence}
              </span>
            </div>
          )}

          {actionsToShow.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {actionsToShow.map((a) => (
                <ActionRow
                  key={`${a.kind}:${a.ref_id}`}
                  action={a}
                  locale={locale}
                  signalId={row.id}
                  done={actionsTaken.has(a.ref_id)}
                />
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="tide"
              size="sm"
              onClick={() =>
                row.id && void setSignalStatus(row.id, "acknowledged")
              }
            >
              {locale === "zh" ? "收到" : "Got it"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                row.id && void setSignalStatus(row.id, "dismissed")
              }
              className="text-ink-500"
            >
              {locale === "zh" ? "关闭" : "Dismiss"}
            </Button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-900"
            >
              {expanded
                ? locale === "zh"
                  ? "隐藏证据"
                  : "Hide evidence"
                : locale === "zh"
                  ? "查看证据"
                  : "Why this fired"}
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>

          {expanded && (
            <div className="mt-3 border-t border-ink-100/60 pt-3 text-[11.5px] text-ink-700">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-ink-400">
                  {locale === "zh" ? "指标" : "Metric"}
                </dt>
                <dd className="font-medium">
                  {metricDef?.label ?? signal.metric_id}
                  {metricDef?.unit ? ` (${metricDef.unit})` : ""}
                </dd>
                <dt className="text-ink-400">
                  {locale === "zh" ? "当前" : "Current"}
                </dt>
                <dd>{signal.evidence.current_value}</dd>
                <dt className="text-ink-400">
                  {locale === "zh" ? "基线" : "Baseline"}
                </dt>
                <dd>
                  {signal.evidence.baseline_value}
                  <span className="mono ml-2 text-[10px] text-ink-400">
                    {signal.evidence.baseline_kind}
                  </span>
                </dd>
                {signal.evidence.duration_days > 0 && (
                  <>
                    <dt className="text-ink-400">
                      {locale === "zh" ? "持续" : "For"}
                    </dt>
                    <dd>
                      {signal.evidence.duration_days}
                      {locale === "zh" ? " 天" : " days"}
                    </dd>
                  </>
                )}
                {signal.evidence.sd_units !== 0 && (
                  <>
                    <dt className="text-ink-400">
                      {locale === "zh" ? "距基线" : "SD units"}
                    </dt>
                    <dd>{signal.evidence.sd_units.toFixed(1)}</dd>
                  </>
                )}
              </dl>

              {signal.differential.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
                    {locale === "zh" ? "差异诊断" : "Differential"}
                  </div>
                  {signal.differential.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="flex-1">
                        <span className="font-medium text-ink-900">
                          {d.label[locale]}
                        </span>
                        {d.supporting_metric_ids.length > 0 && (
                          <span className="ml-2 text-[10.5px] text-ink-400">
                            ({d.supporting_metric_ids
                              .map((id) => METRICS_BY_ID[id]?.label ?? id)
                              .join(", ")})
                          </span>
                        )}
                      </div>
                      <span className="mono shrink-0 text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
                        {d.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ActionRow({
  action,
  locale,
  signalId,
  done,
}: {
  action: SuggestedAction;
  locale: Locale;
  signalId?: number;
  done: boolean;
}) {
  const onMarkDone = () => {
    if (!signalId || done) return;
    void markActionTaken({
      signal_id: signalId,
      action_ref_id: action.ref_id,
      action_kind: action.kind,
    });
  };
  return (
    <li className="flex items-center gap-2 text-[12px] text-ink-700">
      <button
        type="button"
        onClick={onMarkDone}
        disabled={done || !signalId}
        aria-label={
          done
            ? locale === "zh"
              ? "已完成"
              : "Done"
            : locale === "zh"
              ? "标记为已完成"
              : "Mark as done"
        }
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          done
            ? "border-[var(--ok)] bg-[var(--ok)] text-white"
            : "border-ink-300 bg-paper hover:border-ink-500",
        )}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span
        className={cn(
          "flex-1",
          done && "text-ink-400 line-through decoration-[1px]",
        )}
      >
        {action.label[locale]}
      </span>
      <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
        {action.urgency === "now"
          ? locale === "zh"
            ? "立即"
            : "NOW"
          : action.urgency === "soon"
            ? locale === "zh"
              ? "尽快"
              : "SOON"
            : locale === "zh"
              ? "下次就诊"
              : "NEXT VISIT"}
      </span>
    </li>
  );
}

function safeDeserialize(row: ChangeSignalRow): ChangeSignal | null {
  try {
    return deserializeSignal(row);
  } catch (err) {
    // Schema drift / corrupt persistence would otherwise silently
    // drop a clinically relevant signal from the dashboard. Log it
    // so the issue is visible in dev tooling.
    // eslint-disable-next-line no-console
    console.warn(
      "[change-signals] failed to deserialize signal row",
      { id: row.id, detector: row.detector, err },
    );
    return null;
  }
}

function severityRank(s: SignalSeverity): number {
  return s === "warning" ? 2 : 1;
}
