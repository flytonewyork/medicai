"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale, useL } from "~/hooks/use-translate";
import {
  SYMPTOM_CATALOG,
  defaultTrackedSymptomIds,
  type SymptomTag,
} from "~/lib/daily/symptom-catalog";
import { cn } from "~/lib/utils/cn";
import { localeTag } from "~/lib/utils/date";
import { Card, CardContent } from "~/components/ui/card";
import { Stethoscope, RotateCcw } from "lucide-react";

const TAG_STYLE: Record<SymptomTag, string> = {
  pdac: "bg-[var(--tide-soft)] text-[var(--tide-2)]",
  chemo: "bg-ink-100 text-ink-700",
  gnp: "bg-[var(--sand)] text-ink-900",
  pert: "bg-[var(--ok-soft)] text-[var(--ok)]",
  safety: "bg-[var(--warn-soft)] text-[var(--warn)]",
};

const TAG_LABEL: Record<SymptomTag, { en: string; zh: string }> = {
  pdac: { en: "PDAC", zh: "胰腺癌" },
  chemo: { en: "Chemo", zh: "化疗" },
  gnp: { en: "GnP", zh: "GnP" },
  pert: { en: "PERT", zh: "胰酶" },
  safety: { en: "Safety", zh: "警示" },
};

export function TrackedSymptomsSection() {
  const locale = useLocale();
  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const s = settings?.[0];
  const tracked = new Set(s?.tracked_symptoms ?? defaultTrackedSymptomIds());

  const L = useL();

  async function toggle(id: string) {
    if (!s?.id) return;
    const next = new Set(tracked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    await db.settings.update(s.id, {
      tracked_symptoms: Array.from(next),
      updated_at: now(),
    });
  }

  async function resetToDefaults() {
    if (!s?.id) return;
    await db.settings.update(s.id, {
      tracked_symptoms: defaultTrackedSymptomIds(),
      updated_at: now(),
    });
  }

  return (
    <section id="care-tracking" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="eyebrow">
            <Stethoscope className="mr-1.5 inline h-3.5 w-3.5" />
            {L("Care tracking", "症状跟踪")}
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {L(
              "Pick the mPDAC- and GnP-specific symptoms the daily check-in should ask about. Your first full entry becomes the baseline for trend detection.",
              "选择每日记录要询问的 mPDAC、GnP 相关症状。首次完整记录将作为趋势对比的基线。",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={resetToDefaults}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] text-ink-700 hover:bg-ink-100/40"
        >
          <RotateCcw className="h-3 w-3" />
          {L("Reset", "恢复默认")}
        </button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <ul className="space-y-2">
            {SYMPTOM_CATALOG.map((def) => {
              const active = tracked.has(def.id);
              const primary = def.tags[0];
              return (
                <li key={def.id}>
                  <button
                    type="button"
                    onClick={() => void toggle(def.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md border p-2.5 text-left transition-colors",
                      active
                        ? "border-ink-900 bg-ink-900/5"
                        : "border-ink-100 bg-paper hover:border-ink-300",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 rounded-sm border",
                        active
                          ? "border-ink-900 bg-ink-900"
                          : "border-ink-300 bg-paper",
                      )}
                      aria-hidden
                    >
                      {active && (
                        <svg
                          viewBox="0 0 12 12"
                          className="h-full w-full fill-paper"
                        >
                          <path
                            d="M2.5 6.2l2.2 2.2 4.8-5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-ink-900">
                          {def.label[locale]}
                        </span>
                        {def.tags.map((t) => (
                          <span
                            key={t}
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em]",
                              TAG_STYLE[t],
                            )}
                          >
                            {TAG_LABEL[t][locale]}
                          </span>
                        ))}
                      </div>
                      {def.hint && (
                        <div className="mt-0.5 text-[11px] text-ink-500">
                          {def.hint[locale]}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {s?.symptoms_baseline_set_at && (
        <p className="text-[11px] text-ink-400">
          {L("Baseline set on ", "基线记录于 ")}
          {new Date(s.symptoms_baseline_set_at).toLocaleDateString(
            localeTag(locale),
            { dateStyle: "medium" },
          )}
        </p>
      )}
    </section>
  );
}
