"use client";

import { useMemo, useState } from "react";
import { useLocale } from "~/hooks/use-translate";
import {
  PRESETS,
  TEST_CATALOG,
  totalMinutes,
  type PresetId,
  type TestCategory,
  type TestDef,
  type TestId,
} from "~/lib/assessment/catalog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils/cn";
import {
  Activity,
  AlertCircle,
  Brain,
  Flower,
  HeartPulse,
  Plus,
  Minus,
  Clock,
} from "lucide-react";

const CATEGORY_META: Record<
  TestCategory,
  { icon: React.ComponentType<{ className?: string }>; label: { en: string; zh: string } }
> = {
  physical: { icon: HeartPulse, label: { en: "Physical", zh: "身体" } },
  symptoms: { icon: AlertCircle, label: { en: "Symptoms", zh: "症状" } },
  toxicity: { icon: Activity, label: { en: "Toxicity", zh: "毒性" } },
  mental: { icon: Brain, label: { en: "Mental", zh: "心理" } },
  spiritual: { icon: Flower, label: { en: "Spiritual", zh: "灵性" } },
};

export function TestListBuilder({
  onStart,
}: {
  onStart: (testIds: TestId[], preset: PresetId) => void;
}) {
  const locale = useLocale();
  const [preset, setPreset] = useState<PresetId>("comprehensive");
  const [selected, setSelected] = useState<Set<TestId>>(
    () => new Set(PRESETS.comprehensive.tests),
  );

  function applyPreset(p: PresetId) {
    setPreset(p);
    setSelected(new Set(PRESETS[p].tests));
  }

  function toggle(id: TestId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreset("custom");
  }

  const selectedList = useMemo(
    () => TEST_CATALOG.filter((t) => selected.has(t.id)),
    [selected],
  );
  const minutes = totalMinutes(selectedList.map((t) => t.id));

  const grouped = useMemo(() => {
    const groups: Record<TestCategory, TestDef[]> = {
      physical: [],
      symptoms: [],
      toxicity: [],
      mental: [],
      spiritual: [],
    };
    for (const t of TEST_CATALOG) groups[t.category].push(t);
    return groups;
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "选择一个起点" : "Start with a preset"}
          </CardTitle>
          <div className="mt-1 text-sm text-ink-500">
            {locale === "zh"
              ? "之后可以随时增删。"
              : "You can add or remove individual tests afterwards."}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(PRESETS) as PresetId[]).map((p) => {
            const active = preset === p;
            const info = PRESETS[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  active
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper-2 hover:border-ink-300",
                )}
                aria-pressed={active}
              >
                <div className="serif text-sm">{info.title[locale]}</div>
                <div
                  className={cn(
                    "mt-1 text-xs",
                    active ? "text-paper/80" : "text-ink-500",
                  )}
                >
                  {info.description[locale]}
                </div>
                <div
                  className={cn(
                    "mono mt-2 text-[10.5px] uppercase tracking-[0.1em]",
                    active ? "text-paper/70" : "text-ink-400",
                  )}
                >
                  {info.tests.length} {locale === "zh" ? "项" : "tests"}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="a-card px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="serif text-sm text-ink-900">
              {selectedList.length}{" "}
              {locale === "zh" ? "项已选" : "tests selected"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
              <Clock className="h-3 w-3" />
              {locale === "zh"
                ? `估计约 ${minutes} 分钟`
                : `About ${minutes} minutes`}
            </div>
          </div>
          <Button
            onClick={() => onStart(selectedList.map((t) => t.id), preset)}
            disabled={selectedList.length === 0}
            size="lg"
          >
            {locale === "zh" ? "开始评估" : "Start assessment"}
          </Button>
        </div>
      </div>

      {(Object.keys(grouped) as TestCategory[]).map((cat) => {
        const items = grouped[cat];
        const Icon = CATEGORY_META[cat].icon;
        const label = CATEGORY_META[cat].label[locale];
        return (
          <section key={cat} className="space-y-2">
            <h2 className="eyebrow flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((t) => {
                const on = selected.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      on
                        ? "border-ink-300 bg-paper-2"
                        : "border-dashed border-ink-200 bg-paper/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="serif text-sm text-ink-900">
                          {t.title[locale]}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-500">
                          {t.description[locale]}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-ink-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t.est_minutes} min
                          </span>
                          {t.equipment && (
                            <span>· {t.equipment[locale]}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(t.id)}
                        aria-pressed={on}
                        aria-label={on ? "Remove" : "Add"}
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                          on
                            ? "border-ink-900 bg-ink-900 text-paper"
                            : "border-ink-200 bg-paper text-ink-500 hover:border-ink-300",
                        )}
                      >
                        {on ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
