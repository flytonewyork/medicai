"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card } from "~/components/ui/card";
import { computeLoopSummary } from "~/lib/state/detectors";
import { ChevronRight, Activity } from "lucide-react";

// Lightweight rollup of signal-loop activity over the last 30 days. Shows up
// on the dashboard as feedback that the detection → action → resolution
// loop is actually running. Hidden until at least one signal has ever fired.
export function SignalLoopSummaryCard() {
  const locale = useLocale();
  const signals = useLiveQuery(() => db.change_signals.toArray(), []);
  const events = useLiveQuery(() => db.signal_events.toArray(), []);

  const summary = useMemo(() => {
    if (!signals || !events) return null;
    const asOf = new Date().toISOString();
    return computeLoopSummary(signals, events, asOf, 30);
  }, [signals, events]);

  if (!signals || signals.length === 0) return null;
  if (!summary) return null;
  if (
    summary.signals_emitted === 0 &&
    summary.signals_open === 0 &&
    summary.signals_resolved === 0
  ) {
    return null;
  }

  const resolutionLabel = (() => {
    if (summary.median_resolution_days == null) {
      return locale === "zh" ? "暂无解决数据" : "no resolutions yet";
    }
    const d = summary.median_resolution_days;
    return locale === "zh"
      ? `中位 ${d.toFixed(1)} 天`
      : `median ${d.toFixed(1)} days`;
  })();

  const actionFractionLabel = (() => {
    if (summary.fraction_with_action == null) return null;
    const pct = Math.round(summary.fraction_with_action * 100);
    return locale === "zh"
      ? `${pct}% 有记录行动`
      : `${pct}% with a logged action`;
  })();

  return (
    <Link href="/signals" className="block">
      <Card className="px-4 py-3 transition-colors hover:border-ink-300">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-700">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-semibold text-ink-900">
                {locale === "zh"
                  ? "信号环路（30 天）"
                  : "Signal loop · 30 days"}
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-600">
              <Stat
                label={locale === "zh" ? "触发" : "emitted"}
                value={summary.signals_emitted}
              />
              <Stat
                label={locale === "zh" ? "解决" : "resolved"}
                value={summary.signals_resolved}
              />
              <Stat
                label={locale === "zh" ? "未结" : "open"}
                value={summary.signals_open}
              />
              <Stat
                label={locale === "zh" ? "行动" : "actions"}
                value={summary.actions_taken}
              />
              <span className="text-ink-400">· {resolutionLabel}</span>
              {actionFractionLabel && (
                <span className="text-ink-400">· {actionFractionLabel}</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="mono num text-[13px] font-semibold text-ink-900">
        {value}
      </span>
      <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-ink-400">
        {label}
      </span>
    </span>
  );
}
