"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useT } from "~/hooks/use-translate";

export default function BridgePage() {
  const t = useT();
  const trials = useLiveQuery(() =>
    db.trials.orderBy("priority").toArray(),
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <h1 className="text-2xl font-semibold">{t("nav.bridge")}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {(trials ?? []).map((trial) => (
          <div
            key={trial.trial_id}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">{trial.name}</h2>
              <span className="text-xs text-slate-500">{trial.phase}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">{trial.trial_id}</div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              {trial.eligibility_summary}
            </div>
            <div className="mt-3 inline-flex items-center rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs">
              {trial.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
