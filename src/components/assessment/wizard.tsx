"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import {
  TEST_CATALOG,
  testById,
  type TestId,
} from "~/lib/assessment/catalog";
import { todayISO } from "~/lib/utils/date";
import { getErrorMessage } from "~/lib/utils/error";
import { useSettings } from "~/hooks/use-settings";
import type { ComprehensiveAssessment } from "~/types/clinical";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { CoachDrawer } from "~/components/assessment/coach-drawer";
import * as Steps from "~/components/assessment/steps";
import {
  ArrowLeft,
  ArrowRight,
  MinusCircle,
  SkipForward,
  Check,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

type AssessmentDraft = Partial<ComprehensiveAssessment>;

const STEP_RENDERERS: Record<
  TestId,
  (props: Steps.StepProps) => React.ReactElement
> = {
  anthropometrics: Steps.Anthropometrics,
  vitals: Steps.Vitals,
  ecog: Steps.Ecog,
  sarcf: Steps.SarcFStep,
  grip: Steps.GripStep,
  gait: Steps.GaitStep,
  sts30: Steps.Sts30Step,
  sts5x: Steps.Sts5xStep,
  tug: Steps.TugStep,
  single_leg_stance: Steps.SingleLegStanceStep,
  walk6min: Steps.Walk6MinStep,
  pain: Steps.PainStep,
  fatigue: Steps.FatigueStep,
  gi: Steps.GiStep,
  respiratory: Steps.RespiratoryStep,
  constitutional: Steps.ConstitutionalStep,
  neuropathy: Steps.NeuropathyStep,
  mucositis: Steps.MucositisStep,
  cognitive: Steps.CognitiveStep,
  skin: Steps.SkinStep,
  phq9: Steps.Phq9Step,
  gad7: Steps.Gad7Step,
  distress: Steps.DistressStep,
  sleep: Steps.SleepStep,
  facitsp: Steps.FacitSpStep,
  values_practice: Steps.ValuesPracticeStep,
};

// Sort selection in catalog-natural order so UX feels coherent.
function sortTestsInOrder(ids: TestId[]): TestId[] {
  const order = new Map(TEST_CATALOG.map((t, i) => [t.id, i]));
  return ids.slice().sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
}

interface WizardProps {
  assessmentId: number;
}

export function AssessmentWizard({ assessmentId }: WizardProps) {
  const locale = useLocale();
  const router = useRouter();
  const enteredBy = useUIStore((s) => s.enteredBy);

  const existing = useLiveQuery(
    () => db.comprehensive_assessments.get(assessmentId),
    [assessmentId],
  );
  const baseline = useSettings() ?? null;

  const [draft, setDraft] = useState<AssessmentDraft>({});
  const [tests, setTests] = useState<TestId[]>([]);
  const [completed, setCompleted] = useState<Set<TestId>>(new Set());
  const [skipped, setSkipped] = useState<Set<TestId>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<"stepping" | "review">("stepping");

  useEffect(() => {
    if (!existing) return;
    setDraft(existing);
    setTests(sortTestsInOrder((existing.tests_included as TestId[] | undefined) ?? []));
    setCompleted(new Set((existing.tests_completed as TestId[] | undefined) ?? []));
    setSkipped(new Set((existing.tests_skipped as TestId[] | undefined) ?? []));
  }, [existing]);

  const currentId = tests[cursor];
  const currentTest = currentId ? testById(currentId) : undefined;

  const persist = useCallback(
    async (next: AssessmentDraft, extras?: Partial<ComprehensiveAssessment>) => {
      await db.comprehensive_assessments.update(assessmentId, {
        ...next,
        ...extras,
        entered_by: enteredBy,
        updated_at: now(),
      });
    },
    [assessmentId, enteredBy],
  );

  function patch<K extends keyof ComprehensiveAssessment>(
    k: K,
    v: ComprehensiveAssessment[K],
  ) {
    setDraft((d) => {
      const next = { ...d, [k]: v };
      void persist(next);
      return next;
    });
  }

  async function markCompleteAndAdvance() {
    if (!currentId) return;
    const nextDone = new Set(completed);
    nextDone.add(currentId);
    const nextSkipped = new Set(skipped);
    nextSkipped.delete(currentId);
    setCompleted(nextDone);
    setSkipped(nextSkipped);
    await persist(draft, {
      tests_completed: Array.from(nextDone),
      tests_skipped: Array.from(nextSkipped),
    });
    advance();
  }

  function skipCurrent() {
    if (!currentId) return;
    const nextSkipped = new Set(skipped);
    nextSkipped.add(currentId);
    setSkipped(nextSkipped);
    void persist(draft, { tests_skipped: Array.from(nextSkipped) });
    advance();
  }

  async function removeCurrent() {
    if (!currentId) return;
    const nextTests = tests.filter((t) => t !== currentId);
    const nextCompleted = new Set(completed);
    nextCompleted.delete(currentId);
    const nextSkipped = new Set(skipped);
    nextSkipped.delete(currentId);
    setTests(nextTests);
    setCompleted(nextCompleted);
    setSkipped(nextSkipped);
    await persist(draft, {
      tests_included: nextTests,
      tests_completed: Array.from(nextCompleted),
      tests_skipped: Array.from(nextSkipped),
    });
    if (cursor >= nextTests.length) {
      setPhase("review");
    }
  }

  function advance() {
    if (cursor + 1 >= tests.length) {
      setPhase("review");
    } else {
      setCursor(cursor + 1);
    }
  }

  function back() {
    if (cursor > 0) setCursor(cursor - 1);
  }

  const progressPct = useMemo(() => {
    if (tests.length === 0) return 100;
    const done = completed.size + skipped.size;
    return Math.min(100, Math.round((done / tests.length) * 100));
  }, [completed, skipped, tests.length]);

  if (!existing) {
    return (
      <div className="p-6 text-sm text-slate-500">
        {locale === "zh" ? "载入评估中…" : "Loading assessment…"}
      </div>
    );
  }

  if (phase === "review" || tests.length === 0) {
    return (
      <ReviewView
        assessment={{ ...existing, ...draft }}
        settings={baseline}
        tests={tests}
        completed={completed}
        skipped={skipped}
        onResume={(id) => {
          const idx = tests.findIndex((t) => t === id);
          if (idx >= 0) {
            setCursor(idx);
            setPhase("stepping");
          }
        }}
        onAddTests={(ids) => {
          const next = sortTestsInOrder(
            Array.from(new Set([...tests, ...ids])),
          );
          setTests(next);
          void persist(draft, { tests_included: next });
          const firstNew = next.findIndex(
            (t) => !completed.has(t) && !skipped.has(t),
          );
          if (firstNew >= 0) {
            setCursor(firstNew);
            setPhase("stepping");
          }
        }}
        onSaved={() => router.push("/assessment")}
        assessmentId={assessmentId}
      />
    );
  }

  if (!currentTest || !currentId) {
    return null;
  }

  const Step = STEP_RENDERERS[currentId];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {cursor + 1} / {tests.length} · {currentTest.category}
          </span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-slate-900 transition-all duration-300 dark:bg-slate-100"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold">{currentTest.title[locale]}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {currentTest.description[locale]}
        </p>
        {currentTest.equipment && (
          <p className="mt-1 text-xs text-slate-400">
            {locale === "zh" ? "器材：" : "Equipment: "}
            {currentTest.equipment[locale]}
          </p>
        )}
        <div className="mt-3">
          <CoachDrawer
            context={{
              stepKey: currentTest.id,
              stepTitle: currentTest.title.en,
              stepInstructions: currentTest.description.en,
            }}
          />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <Step assessment={draft} settings={baseline} patch={patch} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={back} disabled={cursor === 0}>
            <ArrowLeft className="h-4 w-4" />
            {locale === "zh" ? "上一步" : "Back"}
          </Button>
          <Button variant="ghost" onClick={skipCurrent}>
            <SkipForward className="h-4 w-4" />
            {locale === "zh" ? "跳过" : "Skip"}
          </Button>
          <Button variant="ghost" onClick={removeCurrent}>
            <MinusCircle className="h-4 w-4" />
            {locale === "zh" ? "从列表删除" : "Remove from list"}
          </Button>
        </div>
        <Button onClick={markCompleteAndAdvance} size="lg">
          {cursor + 1 >= tests.length ? (
            <>
              <Check className="h-4 w-4" />
              {locale === "zh" ? "完成并复核" : "Finish and review"}
            </>
          ) : (
            <>
              {locale === "zh" ? "下一步" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface ReviewProps {
  assessment: ComprehensiveAssessment;
  settings: ComprehensiveAssessment extends never ? never : Awaited<ReturnType<typeof db.settings.get>> | null;
  tests: TestId[];
  completed: Set<TestId>;
  skipped: Set<TestId>;
  onResume: (id: TestId) => void;
  onAddTests: (ids: TestId[]) => void;
  onSaved: () => void;
  assessmentId: number;
}

function ReviewView({
  assessment,
  tests,
  completed,
  skipped,
  onResume,
  onAddTests,
  onSaved,
  assessmentId,
}: ReviewProps) {
  const locale = useLocale();
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const available = TEST_CATALOG.filter(
    (t) => !tests.includes(t.id),
  );

  async function finalise() {
    setSaving(true);
    try {
      const { computePillars } = await import("~/lib/calculations/pillars");
      const settings = await db.settings.toArray();
      const baselineWeight = settings[0]?.baseline_weight_kg;
      const scores = computePillars(assessment, baselineWeight);
      await db.comprehensive_assessments.update(assessmentId, {
        ...scores,
        status: "complete",
        completed_at: now(),
        updated_at: now(),
      });
      // Populate baselines on first comprehensive assessment
      const existingSettings = settings[0];
      if (existingSettings && existingSettings.id) {
        const patches: Record<string, number | undefined> = {};
        if (!existingSettings.baseline_weight_kg && assessment.weight_kg) {
          patches.baseline_weight_kg = assessment.weight_kg;
        }
        if (!existingSettings.height_cm && assessment.height_cm) {
          patches.height_cm = assessment.height_cm;
        }
        if (
          !existingSettings.baseline_grip_dominant_kg &&
          assessment.grip_dominant_kg
        ) {
          patches.baseline_grip_dominant_kg = assessment.grip_dominant_kg;
        }
        if (
          !existingSettings.baseline_grip_nondominant_kg &&
          assessment.grip_nondominant_kg
        ) {
          patches.baseline_grip_nondominant_kg = assessment.grip_nondominant_kg;
        }
        if (
          !existingSettings.baseline_gait_speed_ms &&
          assessment.gait_speed_ms
        ) {
          patches.baseline_gait_speed_ms = assessment.gait_speed_ms;
        }
        if (
          !existingSettings.baseline_sit_to_stand &&
          assessment.sit_to_stand_30s
        ) {
          patches.baseline_sit_to_stand = assessment.sit_to_stand_30s;
        }
        if (!existingSettings.baseline_muac_cm && assessment.muac_cm) {
          patches.baseline_muac_cm = assessment.muac_cm;
        }
        if (!existingSettings.baseline_calf_cm && assessment.calf_cm) {
          patches.baseline_calf_cm = assessment.calf_cm;
        }
        if (Object.keys(patches).length > 0) {
          await db.settings.update(existingSettings.id, {
            ...patches,
            baseline_date: existingSettings.baseline_date ?? todayISO(),
            updated_at: now(),
          });
        }
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function generateAiSummary() {
    const settings = await db.settings.toArray();
    const apiKey = settings[0]?.anthropic_api_key;
    if (!apiKey) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const [{ summariseAssessment }, { computePillars }] = await Promise.all([
        import("~/lib/ai/coach"),
        import("~/lib/calculations/pillars"),
      ]);
      const scores = computePillars(
        assessment,
        settings[0]?.baseline_weight_kg,
      );
      const filled: ComprehensiveAssessment = { ...assessment, ...scores };
      const model =
        settings[0]?.default_ai_model ?? "claude-opus-4-7";
      const summary = await summariseAssessment({
        apiKey,
        model,
        assessment: filled,
      });
      await db.comprehensive_assessments.update(assessmentId, {
        ai_summary_patient: summary.patient,
        ai_summary_clinician: summary.clinician,
        ai_summary_model: model,
        updated_at: now(),
      });
    } catch (e) {
      setAiError(getErrorMessage(e));
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">
          {locale === "zh" ? "复核" : "Review"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {locale === "zh"
            ? "检查已完成的项目，跳过的可以回头补，完成后保存。"
            : "Check what's done, revisit anything you skipped, then save."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <ReviewList
            tests={tests}
            completed={completed}
            skipped={skipped}
            onResume={onResume}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={finalise} disabled={saving} size="lg">
              <Check className="h-4 w-4" />
              {saving
                ? locale === "zh"
                  ? "保存中…"
                  : "Saving…"
                : locale === "zh"
                  ? "完成并保存"
                  : "Finalise and save"}
            </Button>
            <Button variant="secondary" onClick={generateAiSummary} disabled={aiBusy}>
              {aiBusy
                ? locale === "zh"
                  ? "AI 概要中…"
                  : "Summarising…"
                : locale === "zh"
                  ? "生成 AI 概要（需 API Key）"
                  : "Generate AI summary (needs API key)"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowAdd((v) => !v)}
              disabled={available.length === 0}
            >
              {showAdd
                ? locale === "zh"
                  ? "隐藏"
                  : "Hide"
                : locale === "zh"
                  ? "添加更多测试"
                  : "Add more tests"}
            </Button>
          </div>
          {aiError && (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/40">
              {aiError}
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && available.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {locale === "zh" ? "可添加的测试" : "Available tests"}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {available.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onAddTests([t.id])}
                  className="rounded-xl border border-dashed border-slate-300 p-3 text-left hover:border-slate-500 dark:border-slate-700 dark:hover:border-slate-500"
                >
                  <div className="text-sm font-semibold">{t.title[locale]}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {t.description[locale]}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReviewList({
  tests,
  completed,
  skipped,
  onResume,
}: {
  tests: TestId[];
  completed: Set<TestId>;
  skipped: Set<TestId>;
  onResume: (id: TestId) => void;
}) {
  const locale = useLocale();
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {tests.map((id) => {
        const t = testById(id);
        if (!t) return null;
        const isDone = completed.has(id);
        const isSkipped = skipped.has(id);
        return (
          <li key={id} className="flex items-center justify-between py-2.5">
            <div>
              <div className="text-sm font-medium">{t.title[locale]}</div>
              <div
                className={cn(
                  "text-xs",
                  isDone
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isSkipped
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-500",
                )}
              >
                {isDone
                  ? locale === "zh"
                    ? "已完成"
                    : "Complete"
                  : isSkipped
                    ? locale === "zh"
                      ? "已跳过"
                      : "Skipped"
                    : locale === "zh"
                      ? "未填"
                      : "Not started"}
              </div>
            </div>
            {!isDone && (
              <Button variant="ghost" size="sm" onClick={() => onResume(id)}>
                {locale === "zh" ? "补上" : "Complete"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
