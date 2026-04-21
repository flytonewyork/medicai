"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";

export default function BridgePage() {
  const t = useT();
  const locale = useLocale();
  const trials = useLiveQuery(() =>
    db.trials.orderBy("priority").toArray(),
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <PageHeader
        title={t("nav.bridge")}
        subtitle={
          locale === "zh"
            ? "daraxonrasib 的桥接策略 —— 维持功能，等待机会。"
            : "Bridge strategy to daraxonrasib — preserve function while the window opens."
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {(trials ?? []).map((trial) => (
          <div
            key={trial.trial_id}
            className="rounded-[var(--r-md)] border border-ink-100/70 bg-paper-2 p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold text-ink-900">{trial.name}</h2>
              <span className="mono text-[10px] uppercase tracking-wider text-ink-400">
                {trial.phase}
              </span>
            </div>
            <div className="mono mt-1 text-[10px] uppercase tracking-wider text-ink-500">
              {trial.trial_id}
            </div>
            <div className="mt-3 text-sm text-ink-700">
              {trial.eligibility_summary}
            </div>
            <div className="mt-3 inline-flex items-center rounded-full border border-ink-200 px-2 py-0.5 text-xs capitalize text-ink-600">
              {trial.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
