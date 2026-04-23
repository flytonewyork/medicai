"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db, now } from "~/lib/db/dexie";
import { useLocale, useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { runEngineAndPersist } from "~/lib/rules/engine";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Field, TextInput, Textarea } from "~/components/ui/field";
import { ScaleInput } from "./scale-input";
import { Toggle } from "./toggle";
import { SymptomStep } from "./symptom-step";
import { isInChemoWindow } from "~/lib/daily/symptom-catalog";
import type { DailyEntry } from "~/types/clinical";
import {
  Activity,
  Bed,
  Scale,
  Sparkles,
  Utensils,
  Footprints,
  AlertTriangle,
  PenLine,
  Pill,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Check,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

type Draft = Partial<DailyEntry>;
type Bilingual = { en: string; zh: string };

const CATS = [
  {
    id: "feelings",
    icon: Activity,
    title: { en: "How you feel", zh: "整体感受" } as Bilingual,
    hint: {
      en: "Energy, pain, mood, appetite",
      zh: "精力、疼痛、情绪、食欲",
    } as Bilingual,
    fields: [
      "energy",
      "pain_current",
      "pain_worst",
      "mood_clarity",
      "appetite",
    ],
  },
  {
    id: "sleep",
    icon: Bed,
    title: { en: "Sleep", zh: "睡眠" } as Bilingual,
    hint: { en: "Last night's sleep", zh: "昨晚的睡眠" } as Bilingual,
    fields: ["sleep_quality"],
  },
  {
    id: "weight",
    icon: Scale,
    title: { en: "Weight", zh: "体重" } as Bilingual,
    hint: { en: "Only if you weighed in", zh: "若今天称重了再填" } as Bilingual,
    fields: ["weight_kg"],
  },
  {
    id: "practice",
    icon: Sparkles,
    title: { en: "Practice", zh: "修习" } as Bilingual,
    hint: { en: "Qigong, meditation", zh: "气功、冥想" } as Bilingual,
    fields: [
      "practice_morning_completed",
      "practice_morning_quality",
      "practice_evening_completed",
      "practice_evening_quality",
    ],
  },
  {
    id: "food",
    icon: Utensils,
    title: { en: "Food", zh: "饮食" } as Bilingual,
    hint: { en: "Protein, meals, fluids", zh: "蛋白质、正餐、饮水" } as Bilingual,
    fields: ["protein_grams", "meals_count", "snacks_count", "fluids_ml"],
  },
  {
    id: "movement",
    icon: Footprints,
    title: { en: "Movement", zh: "活动" } as Bilingual,
    hint: {
      en: "Walking, resistance, steps",
      zh: "步行、阻力训练、步数",
    } as Bilingual,
    fields: [
      "walking_minutes",
      "resistance_training",
      "other_exercise_minutes",
      "steps",
    ],
  },
  {
    id: "symptoms",
    icon: AlertTriangle,
    title: { en: "Symptoms", zh: "症状" } as Bilingual,
    hint: {
      en: "Only record what's actually present",
      zh: "只记今日出现的",
    } as Bilingual,
    fields: [
      "nausea",
      "fever",
      "fever_temp",
      "cold_dysaesthesia",
      "neuropathy_hands",
      "neuropathy_feet",
      "mouth_sores",
      "diarrhoea_count",
      "new_bruising",
      "dyspnoea",
    ],
  },
  {
    id: "reflection",
    icon: PenLine,
    title: { en: "Reflection", zh: "反思" } as Bilingual,
    hint: { en: "Anything worth noting", zh: "想记下的一点" } as Bilingual,
    fields: ["reflection"],
  },
] as const;

type CatId = (typeof CATS)[number]["id"];

function catDef(id: CatId) {
  return CATS.find((c) => c.id === id)!;
}

function catTouched(id: CatId, draft: Draft): boolean {
  const def = catDef(id);
  return def.fields.some((f) => {
    const v = (draft as Record<string, unknown>)[f];
    return v !== undefined && v !== "";
  });
}

interface Props {
  entryId?: number;
  date: string;
}

export function DailyWizard({ entryId, date }: Props) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const enteredBy = useUIStore((s) => s.enteredBy);

  const existing = useLiveQuery(
    async () => (entryId ? await db.daily_entries.get(entryId) : undefined),
    [entryId],
  );

  // Find the nearest chemo appointment (past or future) so we can
  // highlight the symptoms step and pre-select it when the patient is
  // inside a ±3-day chemo window.
  const nearestChemoAt = useLiveQuery(async () => {
    const rows = await db.appointments
      .where("[kind+starts_at]")
      .between(["chemo", ""], ["chemo", "￿"])
      .toArray();
    if (rows.length === 0) return null;
    const nowMs = Date.now();
    let best: string | null = null;
    let bestDelta = Infinity;
    for (const a of rows) {
      if (a.status === "cancelled") continue;
      const t = new Date(a.starts_at).getTime();
      if (!Number.isFinite(t)) continue;
      const delta = Math.abs(t - nowMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = a.starts_at;
      }
    }
    return best;
  }, []);
  const inChemoWindow = isInChemoWindow(nearestChemoAt ?? null);

  const [draft, setDraft] = useState<Draft>({});
  const [picked, setPicked] = useState<CatId[]>([]);
  const [phase, setPhase] = useState<"picking" | "stepping" | "review">(
    "picking",
  );
  const [cursor, setCursor] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setDraft(existing);
      const alreadyFilled = CATS.filter((c) =>
        catTouched(c.id, existing),
      ).map((c) => c.id);
      if (alreadyFilled.length > 0) {
        setPicked(alreadyFilled as CatId[]);
      }
    }
  }, [existing]);

  // When a fresh check-in starts inside a chemo window, auto-pick the
  // Symptoms step so the GnP-specific items are one tap away.
  useEffect(() => {
    if (!inChemoWindow || existing) return;
    setPicked((p) => (p.includes("symptoms") ? p : [...p, "symptoms"]));
  }, [inChemoWindow, existing]);

  function patch<K extends keyof DailyEntry>(k: K, v: DailyEntry[K] | undefined) {
    setDraft((d) => {
      const next = { ...d };
      if (v === undefined) {
        delete (next as Record<string, unknown>)[k as string];
      } else {
        (next as Record<string, unknown>)[k as string] = v;
      }
      return next;
    });
  }

  function toggleCat(id: CatId) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function start() {
    if (picked.length === 0) return;
    setCursor(0);
    setPhase("stepping");
  }

  function advance() {
    if (cursor + 1 >= picked.length) {
      setPhase("review");
    } else {
      setCursor(cursor + 1);
    }
  }

  function back() {
    if (cursor > 0) setCursor(cursor - 1);
    else setPhase("picking");
  }

  function skip() {
    const cat = picked[cursor];
    if (cat) {
      const def = catDef(cat);
      def.fields.forEach((f) => patch(f as keyof DailyEntry, undefined));
    }
    advance();
  }

  async function save() {
    setSaving(true);
    try {
      const { getCachedUserId } = await import("~/lib/supabase/current-user");
      const uid = getCachedUserId();
      const base: Partial<DailyEntry> = {
        ...draft,
        date,
        entered_by: enteredBy,
        entered_by_user_id: uid ?? existing?.entered_by_user_id,
        entered_at: existing?.entered_at ?? now(),
        updated_at: now(),
      };
      if (entryId) {
        await db.daily_entries.update(entryId, base);
      } else {
        await db.daily_entries.add({
          ...(base as DailyEntry),
          created_at: now(),
        });
      }

      // Stamp the symptom baseline the first time a check-in writes to
      // any tracked symptom field. Read existing settings to avoid
      // clobbering a pre-existing baseline date.
      const { SYMPTOM_CATALOG, defaultTrackedSymptomIds } = await import(
        "~/lib/daily/symptom-catalog"
      );
      const settingsRow = (await db.settings.toArray())[0];
      if (settingsRow?.id && !settingsRow.symptoms_baseline_set_at) {
        const trackedIds =
          settingsRow.tracked_symptoms ?? defaultTrackedSymptomIds();
        const wroteASymptom = SYMPTOM_CATALOG.some((d) => {
          if (!trackedIds.includes(d.id)) return false;
          const v = (base as Record<string, unknown>)[d.dailyEntryField];
          return v !== undefined && v !== null && v !== "";
        });
        if (wroteASymptom) {
          await db.settings.update(settingsRow.id, {
            symptoms_baseline_set_at: now(),
            updated_at: now(),
          });
        }
      }

      await runEngineAndPersist();
      router.push("/daily");
    } finally {
      setSaving(false);
    }
  }

  if (phase === "picking") {
    return (
      <PickScreen
        picked={picked}
        onToggle={toggleCat}
        onStart={start}
        locale={locale}
        t={t}
        inChemoWindow={inChemoWindow}
      />
    );
  }

  if (phase === "stepping") {
    const catId = picked[cursor];
    if (!catId) return null;
    return (
      <StepScreen
        catId={catId}
        index={cursor}
        total={picked.length}
        draft={draft}
        patch={patch}
        inChemoWindow={inChemoWindow}
        onBack={back}
        onSkip={skip}
        onNext={advance}
        locale={locale}
      />
    );
  }

  return (
    <ReviewScreen
      picked={picked}
      draft={draft}
      saving={saving}
      onResume={(id) => {
        const idx = picked.indexOf(id);
        if (idx >= 0) {
          setCursor(idx);
          setPhase("stepping");
        }
      }}
      onAddMore={() => setPhase("picking")}
      onSave={save}
      locale={locale}
    />
  );
}

function PickScreen({
  picked,
  onToggle,
  onStart,
  locale,
  t,
  inChemoWindow,
}: {
  picked: CatId[];
  onToggle: (id: CatId) => void;
  onStart: () => void;
  locale: "en" | "zh";
  t: (key: string) => string;
  inChemoWindow: boolean;
}) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="serif text-[22px] text-ink-900">
          {locale === "zh" ? "今天想记什么？" : "What would you like to note?"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {locale === "zh"
            ? "只选今天真正相关的。没有的项目就不用填。"
            : "Pick only what actually applies today. Anything you don't tap stays unrecorded."}
        </p>
        {inChemoWindow && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--tide-soft)] px-2.5 py-1 text-[11px] text-[var(--tide-2)]">
            <span className="mono font-medium uppercase tracking-[0.12em]">
              {locale === "zh" ? "化疗窗口" : "Chemo window"}
            </span>
            <span className="text-ink-500">
              {locale === "zh"
                ? "· Symptoms 已为你勾选"
                : "· Symptoms pre-selected for you"}
            </span>
          </div>
        )}
      </header>

      <ul className="grid gap-2 sm:grid-cols-2">
        {CATS.map((c) => {
          const Icon = c.icon;
          const active = picked.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onToggle(c.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-100 bg-paper-2 hover:border-ink-300",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                    active
                      ? "bg-paper/10 text-paper"
                      : "bg-[var(--tide-soft)] text-[var(--tide-2)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">
                    {c.title[locale]}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-[11.5px]",
                      active ? "text-paper/70" : "text-ink-500",
                    )}
                  >
                    {c.hint[locale]}
                  </div>
                </div>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>

      <Card>
        <CardContent className="flex items-start gap-3 py-3">
          <Pill className="mt-0.5 h-4 w-4 text-ink-400" />
          <div className="flex-1 text-[12.5px] text-ink-500">
            {locale === "zh"
              ? "服药请用“记录服药”。"
              : "For medications, use the dedicated Log medication screen."}
          </div>
          <Link
            href="/medications/log"
            className="rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] text-ink-700 hover:bg-ink-100/40"
          >
            {locale === "zh" ? "去记录" : "Log now"}
          </Link>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Link
          href="/daily"
          className="text-[12px] text-ink-500 hover:text-ink-800"
        >
          {locale === "zh" ? "取消" : t("common.cancel")}
        </Link>
        <Button onClick={onStart} disabled={picked.length === 0} size="lg">
          {locale === "zh"
            ? `开始（${picked.length}）`
            : `Start (${picked.length})`}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepScreen({
  catId,
  index,
  total,
  draft,
  patch,
  onBack,
  onSkip,
  onNext,
  locale,
  inChemoWindow,
}: {
  catId: CatId;
  index: number;
  total: number;
  draft: Draft;
  patch: <K extends keyof DailyEntry>(k: K, v: DailyEntry[K] | undefined) => void;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  locale: "en" | "zh";
  inChemoWindow: boolean;
}) {
  const def = catDef(catId);
  const pct = Math.round(((index + 1) / total) * 100);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span>
            {index + 1} / {total}
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-ink-900 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <header>
        <h2 className="serif text-xl text-ink-900">{def.title[locale]}</h2>
        <p className="mt-1 text-sm text-ink-500">{def.hint[locale]}</p>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <CategoryFields
            catId={catId}
            draft={draft}
            patch={patch}
            locale={locale}
            inChemoWindow={inChemoWindow}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            {locale === "zh" ? "上一步" : "Back"}
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            <SkipForward className="h-4 w-4" />
            {locale === "zh" ? "不记这项" : "Skip"}
          </Button>
        </div>
        <Button onClick={onNext} size="lg">
          {index + 1 >= total
            ? locale === "zh"
              ? "完成"
              : "Review"
            : locale === "zh"
              ? "下一步"
              : "Next"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CategoryFields({
  catId,
  draft,
  patch,
  locale,
  inChemoWindow,
}: {
  catId: CatId;
  draft: Draft;
  patch: <K extends keyof DailyEntry>(k: K, v: DailyEntry[K] | undefined) => void;
  locale: "en" | "zh";
  inChemoWindow: boolean;
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  if (catId === "feelings") {
    return (
      <>
        <ScaleInput
          label={L("Energy", "精力")}
          value={draft.energy ?? 5}
          onChange={(n) => patch("energy", n)}
        />
        <ScaleInput
          label={L("Pain right now", "目前疼痛")}
          value={draft.pain_current ?? 0}
          onChange={(n) => patch("pain_current", n)}
        />
        <ScaleInput
          label={L("Worst pain (24h)", "过去 24 小时最痛")}
          value={draft.pain_worst ?? 0}
          onChange={(n) => patch("pain_worst", n)}
        />
        <ScaleInput
          label={L("Mental clarity", "头脑清明")}
          value={draft.mood_clarity ?? 5}
          onChange={(n) => patch("mood_clarity", n)}
        />
        <ScaleInput
          label={L("Appetite", "食欲")}
          value={draft.appetite ?? 5}
          onChange={(n) => patch("appetite", n)}
        />
      </>
    );
  }

  if (catId === "sleep") {
    return (
      <ScaleInput
        label={L("Sleep quality", "睡眠质量")}
        value={draft.sleep_quality ?? 5}
        onChange={(n) => patch("sleep_quality", n)}
      />
    );
  }

  if (catId === "weight") {
    return (
      <Field label={L("Weight (kg)", "体重（公斤）")}>
        <TextInput
          type="number"
          inputMode="decimal"
          value={draft.weight_kg ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            patch("weight_kg", v === "" ? undefined : Number(v));
          }}
          placeholder={L("e.g. 68.5", "例如 68.5")}
        />
      </Field>
    );
  }

  if (catId === "practice") {
    return (
      <PracticeFields draft={draft} patch={patch} locale={locale} />
    );
  }

  if (catId === "food") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={L("Protein (grams)", "蛋白质（克）")}
          hint={L(
            "≈ 20 g per palm, 8 g per egg, 25 g per whey scoop",
            "一掌肉约 20 g，一个鸡蛋约 8 g，一勺乳清约 25 g",
          )}
        >
          <TextInput
            type="number"
            inputMode="numeric"
            value={draft.protein_grams ?? ""}
            onChange={(e) =>
              patch(
                "protein_grams",
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
          />
        </Field>
        <Field label={L("Fluids (ml)", "饮水（毫升）")}>
          <TextInput
            type="number"
            inputMode="numeric"
            value={draft.fluids_ml ?? ""}
            onChange={(e) =>
              patch(
                "fluids_ml",
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
          />
        </Field>
        <Field label={L("Meals", "正餐")}>
          <TextInput
            type="number"
            inputMode="numeric"
            value={draft.meals_count ?? ""}
            onChange={(e) =>
              patch(
                "meals_count",
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
          />
        </Field>
        <Field label={L("Snacks", "加餐")}>
          <TextInput
            type="number"
            inputMode="numeric"
            value={draft.snacks_count ?? ""}
            onChange={(e) =>
              patch(
                "snacks_count",
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
          />
        </Field>
      </div>
    );
  }

  if (catId === "movement") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={L("Walking (minutes)", "步行（分钟）")}>
            <TextInput
              type="number"
              inputMode="numeric"
              value={draft.walking_minutes ?? ""}
              onChange={(e) =>
                patch(
                  "walking_minutes",
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label={L("Other exercise (min)", "其他运动（分钟）")}>
            <TextInput
              type="number"
              inputMode="numeric"
              value={draft.other_exercise_minutes ?? ""}
              onChange={(e) =>
                patch(
                  "other_exercise_minutes",
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label={L("Steps", "步数")}>
            <TextInput
              type="number"
              inputMode="numeric"
              value={draft.steps ?? ""}
              onChange={(e) =>
                patch(
                  "steps",
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          </Field>
        </div>
        <Toggle
          label={L(
            "Any resistance training today",
            "今天做过任何阻力训练",
          )}
          checked={draft.resistance_training ?? false}
          onChange={(v) => patch("resistance_training", v ? true : undefined)}
        />
      </div>
    );
  }

  if (catId === "symptoms") {
    return (
      <SymptomStep
        draft={draft}
        patch={patch}
        locale={locale}
        inChemoWindow={inChemoWindow}
      />
    );
  }

  if (catId === "reflection") {
    return (
      <Field label={L("Reflection", "反思")}>
        <Textarea
          rows={5}
          value={draft.reflection ?? ""}
          onChange={(e) =>
            patch(
              "reflection",
              e.target.value === "" ? undefined : e.target.value,
            )
          }
          placeholder={L(
            "Anything worth noting, in English or 中文",
            "任何想记下的，English 或中文都行",
          )}
        />
      </Field>
    );
  }

  return null;
}

function PracticeFields({
  draft,
  patch,
  locale,
}: {
  draft: Draft;
  patch: <K extends keyof DailyEntry>(k: K, v: DailyEntry[K] | undefined) => void;
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const practices = useLiveQuery(
    () =>
      db.medications
        .where("category")
        .equals("behavioural")
        .filter((m) => m.active)
        .toArray(),
    [],
  );

  // Fallback controls on first use, before any practices have been set up.
  if (practices === undefined) return null;
  if (practices.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-[var(--r-md)] border border-dashed border-ink-200 bg-paper p-3 text-[12.5px] text-ink-500">
          {L(
            "No practices configured yet — add Qigong, breathing, or your own under Practices so they appear here each day.",
            "还未配置任何修习 —— 在「修习」中加入气功、呼吸法或自定义项目，之后就会每天出现在这里。",
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/practices/new"
            className="rounded-md border border-ink-200 px-2.5 py-1.5 text-[12px] text-ink-700 hover:bg-ink-100/40"
          >
            {L("Add a practice", "添加修习")}
          </Link>
        </div>
        <Toggle
          label={L(
            "Did any practice today (morning)",
            "今天上午有做修习",
          )}
          checked={draft.practice_morning_completed ?? false}
          onChange={(v) =>
            patch("practice_morning_completed", v ? true : undefined)
          }
        />
        <Toggle
          label={L(
            "Did any practice today (evening)",
            "今天晚上有做修习",
          )}
          checked={draft.practice_evening_completed ?? false}
          onChange={(v) =>
            patch("practice_evening_completed", v ? true : undefined)
          }
        />
      </div>
    );
  }

  const morning = practices.filter((m) => isMorningScheduled(m.schedule));
  const evening = practices.filter((m) => isEveningScheduled(m.schedule));
  const other = practices.filter(
    (m) => !isMorningScheduled(m.schedule) && !isEveningScheduled(m.schedule),
  );

  return (
    <div className="space-y-4">
      {morning.length > 0 && (
        <PracticeGroup
          title={L("Morning", "上午")}
          practices={morning}
          locale={locale}
          groupCompleted={draft.practice_morning_completed ?? false}
          onGroupCompleted={(v) =>
            patch("practice_morning_completed", v ? true : undefined)
          }
          quality={draft.practice_morning_quality}
          onQuality={(n) => patch("practice_morning_quality", n)}
        />
      )}
      {evening.length > 0 && (
        <PracticeGroup
          title={L("Evening", "晚上")}
          practices={evening}
          locale={locale}
          groupCompleted={draft.practice_evening_completed ?? false}
          onGroupCompleted={(v) =>
            patch("practice_evening_completed", v ? true : undefined)
          }
          quality={draft.practice_evening_quality}
          onQuality={(n) => patch("practice_evening_quality", n)}
        />
      )}
      {other.length > 0 && (
        <PracticeGroup
          title={L("Other", "其他")}
          practices={other}
          locale={locale}
        />
      )}
    </div>
  );
}

function PracticeGroup({
  title,
  practices,
  locale,
  groupCompleted,
  onGroupCompleted,
  quality,
  onQuality,
}: {
  title: string;
  practices: Array<{
    id?: number;
    drug_id: string;
    display_name?: string;
    dose?: string;
  }>;
  locale: "en" | "zh";
  groupCompleted?: boolean;
  onGroupCompleted?: (v: boolean) => void;
  quality?: number;
  onQuality?: (n: number) => void;
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  return (
    <div className="space-y-2">
      <div className="eyebrow text-ink-500">{title}</div>
      <ul className="space-y-1.5">
        {practices.map((m) => {
          const name = m.display_name ?? m.drug_id;
          return (
            <li
              key={m.id ?? m.drug_id}
              className="flex items-center justify-between rounded-[var(--r-md)] bg-paper-2 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] text-ink-900">{name}</div>
                {m.dose && (
                  <div className="text-[11px] text-ink-500">{m.dose}</div>
                )}
              </div>
              <Link
                href="/practices"
                className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-ink-400 hover:text-ink-700"
              >
                {L("Manage", "管理")}
              </Link>
            </li>
          );
        })}
      </ul>
      {onGroupCompleted && (
        <Toggle
          label={L(
            `Completed this ${title.toLowerCase()} session`,
            `本时段已完成`,
          )}
          checked={groupCompleted ?? false}
          onChange={onGroupCompleted}
        />
      )}
      {groupCompleted && onQuality && (
        <ScaleInput
          label={L("Quality (0–5)", "质量（0–5）")}
          value={quality ?? 3}
          onChange={onQuality}
          min={0}
          max={5}
        />
      )}
    </div>
  );
}

function isMorningScheduled(schedule: unknown): boolean {
  const s = schedule as { clock_times?: string[] } | null | undefined;
  if (!s?.clock_times?.length) return false;
  return s.clock_times.some((t) => {
    const hour = Number(t.split(":")[0]);
    return Number.isFinite(hour) && hour < 12;
  });
}

function isEveningScheduled(schedule: unknown): boolean {
  const s = schedule as { clock_times?: string[] } | null | undefined;
  if (!s?.clock_times?.length) return false;
  return s.clock_times.some((t) => {
    const hour = Number(t.split(":")[0]);
    return Number.isFinite(hour) && hour >= 12;
  });
}

function ReviewScreen({
  picked,
  draft,
  saving,
  onResume,
  onAddMore,
  onSave,
  locale,
}: {
  picked: CatId[];
  draft: Draft;
  saving: boolean;
  onResume: (id: CatId) => void;
  onAddMore: () => void;
  onSave: () => void;
  locale: "en" | "zh";
}) {
  const filled = useMemo(
    () => picked.filter((id) => catTouched(id, draft)),
    [picked, draft],
  );
  const empty = picked.filter((id) => !catTouched(id, draft));

  return (
    <div className="space-y-4">
      <header>
        <h2 className="serif text-xl text-ink-900">
          {locale === "zh" ? "复核" : "Review"}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {locale === "zh"
            ? "只保存下面已填的项。"
            : "Only the categories below will be saved."}
        </p>
      </header>

      <Card>
        <CardContent className="pt-4">
          {filled.length === 0 ? (
            <div className="text-sm text-ink-500">
              {locale === "zh"
                ? "还没有填任何项。"
                : "Nothing recorded yet."}
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {filled.map((id) => {
                const def = catDef(id);
                const Icon = def.icon;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm text-ink-900">
                        {def.title[locale]}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onResume(id)}
                      className="text-[12px] text-ink-500 hover:text-ink-900"
                    >
                      {locale === "zh" ? "改" : "Edit"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {empty.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-400">
              <X className="h-3.5 w-3.5" />
              {locale === "zh"
                ? `未记录：${empty.map((id) => catDef(id).title.zh).join("、")}`
                : `Not recorded: ${empty
                    .map((id) => catDef(id).title.en)
                    .join(", ")}`}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onAddMore}>
          {locale === "zh" ? "再加一项" : "Add another"}
        </Button>
        <Button onClick={onSave} disabled={saving || filled.length === 0} size="lg">
          <Check className="h-4 w-4" />
          {saving
            ? locale === "zh"
              ? "保存中…"
              : "Saving…"
            : locale === "zh"
              ? "保存"
              : "Save"}
        </Button>
      </div>
    </div>
  );
}
