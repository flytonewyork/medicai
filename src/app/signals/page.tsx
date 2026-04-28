"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { METRICS_BY_ID } from "~/lib/state";
import {
  attributeSignal,
  eventsBySignalId,
} from "~/lib/state/detectors";
import { deserializeSignal } from "~/lib/state/detectors/persistence";
import type {
  ChangeSignal,
  SignalSeverity,
} from "~/lib/state/detectors";
import type {
  ChangeSignalRow,
  SignalEventKind,
  SignalEventRow,
} from "~/types/clinical";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  XCircle,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import { format, parseISO } from "date-fns";
import type { LocalizedText } from "~/types/localized";

type Filter = "all" | "open" | "resolved";

export default function SignalsPage() {
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const signals = useLiveQuery(
    () =>
      db.change_signals
        .orderBy("detected_at")
        .reverse()
        .toArray(),
    [],
  );
  const events = useLiveQuery(
    () => db.signal_events.orderBy("created_at").toArray(),
    [],
  );

  const indexed = useMemo(() => {
    if (!events) return new Map<number, SignalEventRow[]>();
    return eventsBySignalId(events);
  }, [events]);

  const rows = useMemo(() => {
    if (!signals) return [];
    return signals.filter((s) => {
      if (filter === "open") return s.status === "open";
      if (filter === "resolved") return s.status === "resolved";
      return true;
    });
  }, [signals, filter]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "信号" : "Signals"}
        title={
          locale === "zh"
            ? "变化信号与行动"
            : "Change signals and actions"
        }
      />

      <div className="flex items-center gap-2">
        <FilterButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
        >
          {locale === "zh" ? "全部" : "All"}
        </FilterButton>
        <FilterButton
          active={filter === "open"}
          onClick={() => setFilter("open")}
        >
          {locale === "zh" ? "未结" : "Open"}
        </FilterButton>
        <FilterButton
          active={filter === "resolved"}
          onClick={() => setFilter("resolved")}
        >
          {locale === "zh" ? "已解决" : "Resolved"}
        </FilterButton>
      </div>

      {rows.length === 0 ? (
        <Card className="p-5 text-sm text-ink-500">
          {locale === "zh"
            ? "目前没有变化信号。"
            : "No change signals yet."}
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <SignalHistoryRow
              key={row.id}
              row={row}
              events={row.id ? (indexed.get(row.id) ?? []) : []}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mono rounded-full border px-3 py-1 text-[10.5px] uppercase tracking-[0.12em] transition-colors",
        active
          ? "border-ink-900 bg-ink-900 text-paper"
          : "border-ink-200 bg-paper text-ink-500 hover:border-ink-400",
      )}
    >
      {children}
    </button>
  );
}

const STATUS_TONE: Record<
  ChangeSignalRow["status"],
  { wrap: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  open: { wrap: "bg-paper-2", Icon: Circle },
  acknowledged: { wrap: "bg-paper-2", Icon: CheckCircle2 },
  dismissed: { wrap: "bg-paper-2 opacity-60", Icon: XCircle },
  resolved: {
    wrap: "bg-[var(--ok-soft)] border-l-[3px] border-l-[var(--ok)]",
    Icon: CheckCircle2,
  },
};

const SEV_ICON: Record<
  SignalSeverity,
  React.ComponentType<{ className?: string }>
> = {
  caution: Bell,
  warning: AlertTriangle,
};

function SignalHistoryRow({
  row,
  events,
}: {
  row: ChangeSignalRow;
  events: SignalEventRow[];
}) {
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const signal = useMemo<ChangeSignal | null>(() => {
    try {
      return deserializeSignal(row);
    } catch {
      return null;
    }
  }, [row]);
  const attribution = useMemo(
    () => attributeSignal(row, events),
    [row, events],
  );
  if (!signal) return null;
  const tone = STATUS_TONE[row.status];
  const SevIcon = SEV_ICON[signal.severity];
  const metricDef = METRICS_BY_ID[signal.metric_id];

  return (
    <li>
      <Card className={cn("px-4 py-3.5", tone.wrap)}>
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-paper text-ink-700 ring-1 ring-ink-200">
            <SevIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-semibold text-ink-900">
                {signal.title[locale]}
              </div>
              <StatusBadge status={row.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-500">
              <span>{format(parseISO(row.detected_at), "d MMM yyyy")}</span>
              <span>·</span>
              <span>{signal.axis}</span>
              <span>·</span>
              <span>
                {metricDef?.label ?? signal.metric_id}
              </span>
              {attribution.duration_days != null && (
                <>
                  <span>·</span>
                  <span>
                    {locale === "zh"
                      ? `${attribution.duration_days} 天解决`
                      : `resolved in ${attribution.duration_days}d`}
                  </span>
                </>
              )}
            </div>

            {attribution.likely_contributors.length > 0 && (
              <div className="mt-2 rounded-md bg-paper-2 px-2.5 py-2 text-[11.5px] text-ink-700">
                <div className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
                  {locale === "zh"
                    ? "可能的促进因素"
                    : "Likely contributors"}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {attribution.likely_contributors.map((a, i) => (
                    <li key={i}>
                      {a.action_ref_id}
                      {typeof a.days_before_resolution === "number" && (
                        <span className="ml-1 text-ink-400">
                          ({a.days_before_resolution}
                          {locale === "zh" ? " 天前" : "d before"})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-1 text-[10.5px] text-ink-400">
                  {locale === "zh"
                    ? "相关性，非因果。"
                    : "Correlational, not causal."}
                </div>
              </div>
            )}

            {attribution.spontaneous && (
              <div className="mt-2 rounded-md bg-paper-2 px-2.5 py-2 text-[11.5px] text-ink-600">
                {locale === "zh"
                  ? "该信号自行解决 —— 未记录任何行动。可能为噪声或自发恢复。"
                  : "Resolved with no logged actions — may be noise or spontaneous recovery."}
              </div>
            )}

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-900"
            >
              {expanded
                ? locale === "zh"
                  ? "收起时间线"
                  : "Hide timeline"
                : locale === "zh"
                  ? `查看时间线 (${events.length})`
                  : `Timeline (${events.length})`}
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {expanded && events.length > 0 && (
              <Timeline events={events} />
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

function StatusBadge({ status }: { status: ChangeSignalRow["status"] }) {
  const locale = useLocale();
  const labels: Record<ChangeSignalRow["status"], LocalizedText> = {
    open: { en: "OPEN", zh: "未结" },
    acknowledged: { en: "ACK", zh: "已知" },
    dismissed: { en: "DISMISSED", zh: "关闭" },
    resolved: { en: "RESOLVED", zh: "已解决" },
  };
  return (
    <span
      className={cn(
        "mono shrink-0 rounded-full px-2 py-0.5 text-[9.5px] uppercase tracking-[0.12em]",
        status === "resolved"
          ? "bg-[var(--ok)] text-white"
          : status === "dismissed"
            ? "bg-ink-200 text-ink-500"
            : status === "open"
              ? "bg-ink-900 text-paper"
              : "bg-paper-2 text-ink-600",
      )}
    >
      {labels[status][locale]}
    </span>
  );
}

const EVENT_KIND_LABEL: Record<
  SignalEventKind,
  LocalizedText
> = {
  emitted: { en: "signal emitted", zh: "信号触发" },
  acknowledged: { en: "acknowledged", zh: "已知" },
  dismissed: { en: "dismissed", zh: "关闭" },
  action_taken: { en: "action taken", zh: "采取行动" },
  resolved_auto: { en: "auto-resolved", zh: "自动解决" },
  resolved_manual: { en: "marked resolved", zh: "手动解决" },
  reopened: { en: "reopened", zh: "重新打开" },
};

function Timeline({ events }: { events: SignalEventRow[] }) {
  const locale = useLocale();
  return (
    <ol className="mt-3 space-y-1.5 border-l-2 border-ink-100 pl-3">
      {events.map((e) => (
        <li key={e.id} className="text-[11.5px] text-ink-700">
          <div className="flex items-baseline gap-2">
            <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
              {format(parseISO(e.created_at), "d MMM HH:mm")}
            </span>
            <span className="font-medium text-ink-900">
              {EVENT_KIND_LABEL[e.kind][locale]}
            </span>
            {e.action_ref_id && (
              <span className="text-ink-500">— {e.action_ref_id}</span>
            )}
          </div>
          {e.note && <div className="mt-0.5 text-ink-500">{e.note}</div>}
        </li>
      ))}
    </ol>
  );
}
