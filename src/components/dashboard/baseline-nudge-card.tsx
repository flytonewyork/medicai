"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Stethoscope, ChevronRight } from "lucide-react";
import { db } from "~/lib/db/dexie";
import { Card, CardContent } from "~/components/ui/card";
import { useLocale, pickL } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";

// Surfaced when the patient has finished onboarding but hasn't done a
// first comprehensive assessment yet. Baselines (weight, grip, gait,
// MUAC, calf) are required for the rule engine to detect drift, but
// they're collected at /assessment, not at onboarding — this card is
// the bridge that nudges the patient to take that step when it makes
// sense.
//
// Hides itself when:
//   - the user is still onboarding (no settings row yet)
//   - a baseline weight is already on file (good-enough proxy for
//     "first assessment done")
//   - any complete comprehensive_assessment exists in history
export function BaselineNudgeCard() {
  const locale = useLocale();
  const s = useSettings();
  const hasComplete = useLiveQuery(async () => {
    const rows = await db.comprehensive_assessments
      .orderBy("assessment_date")
      .reverse()
      .limit(5)
      .toArray();
    return rows.some((r) => r.status === "complete");
  });

  if (!s) return null;
  if (!s.onboarded_at) return null;
  if (s.baseline_weight_kg) return null;
  if (hasComplete) return null;

  const L = pickL(locale);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--tide-2)]/15 text-[var(--tide-2)]">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-ink-900">
              {L("Capture your baselines", "记录您的基线数据")}
            </div>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              {L(
                "Weight, grip, gait speed — so we can spot any changes early.",
                "体重、握力、步速 — 便于及早发现变化。",
              )}
            </p>
          </div>
        </div>
        <Link
          href="/assessment"
          className="inline-flex items-center gap-0.5 text-[12px] text-ink-500 hover:text-ink-900"
        >
          {L("Open", "开始")}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
