"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Droplets, Plus, X } from "lucide-react";
import {
  DEFAULT_FLUID_TARGET_ML,
  FLUID_KIND_LABEL,
  FLUID_QUICK_ADD,
  deleteFluid,
  listFluidsForDate,
  logFluid,
  sumFluids,
} from "~/lib/nutrition/hydration";
import { Card, CardContent } from "~/components/ui/card";
import { TargetBar } from "./macro-bar";
import { useLocale, useL } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { cn } from "~/lib/utils/cn";
import type { FluidKind } from "~/types/nutrition";

// Daily hydration card. Sits on the nutrition page next to DailyTotals.
// One row of one-tap quick-adds, the daily total versus a soft 2L
// target, and a collapsible list of today's swallow events.
export function HydrationCard({ date }: { date: string }) {
  const locale = useLocale();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const fluidsRaw = useLiveQuery(
    async () => listFluidsForDate(date),
    [date],
  );
  const fluids = useMemo(() => fluidsRaw ?? [], [fluidsRaw]);
  const totals = useMemo(() => sumFluids(fluids), [fluids]);
  const [open, setOpen] = useState(false);
  const [customMl, setCustomMl] = useState(250);
  const [customKind, setCustomKind] = useState<FluidKind>("water");

  const pct = (totals.total_ml / DEFAULT_FLUID_TARGET_ML) * 100;
  const L = useL();

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-[var(--tide-2)]" />
            {L("Hydration", "饮水")}
          </h2>
          <div className="text-right">
            <div className="serif text-lg leading-none text-ink-900">
              {(totals.total_ml / 1000).toFixed(1)}
              <span className="ml-0.5 text-xs font-normal text-ink-500">L</span>
            </div>
            <div className="mono mt-0.5 text-[10px] text-ink-400">
              / {(DEFAULT_FLUID_TARGET_ML / 1000).toFixed(1)} L
            </div>
          </div>
        </div>

        <TargetBar value={pct} target={100} />

        <div className="flex flex-wrap gap-1.5">
          {FLUID_QUICK_ADD.map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                logFluid({
                  date,
                  kind: preset.kind,
                  volume_ml: preset.volume_ml,
                  entered_by: enteredBy,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-paper px-2.5 py-1 text-[11px] text-ink-700 hover:border-ink-300 hover:bg-paper-2/60"
            >
              <span>{FLUID_KIND_LABEL[preset.kind].emoji}</span>
              <span>{locale === "zh" ? preset.label_zh : preset.label_en}</span>
              <span className="mono text-[10px] text-ink-400">
                +{preset.volume_ml} ml
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-paper px-2.5 py-1 text-[11px] text-ink-700 hover:border-ink-300"
          >
            <Plus className="h-3 w-3" />
            {L("Custom", "自定义")}
          </button>
        </div>

        {open && (
          <div className="flex items-center gap-2 rounded-md bg-paper-2/60 p-2">
            <select
              value={customKind}
              onChange={(e) => setCustomKind(e.target.value as FluidKind)}
              className="h-9 rounded-md border border-ink-200 bg-paper px-2 text-xs text-ink-900"
            >
              {(Object.keys(FLUID_KIND_LABEL) as FluidKind[]).map((k) => (
                <option key={k} value={k}>
                  {FLUID_KIND_LABEL[k].emoji}{" "}
                  {locale === "zh"
                    ? FLUID_KIND_LABEL[k].zh
                    : FLUID_KIND_LABEL[k].en}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={customMl}
              min={10}
              step={10}
              onChange={(e) =>
                setCustomMl(Math.max(0, Number(e.target.value) || 0))
              }
              className="h-9 w-20 rounded-md border border-ink-200 bg-paper px-2 text-xs text-ink-900"
            />
            <span className="text-[11px] text-ink-500">ml</span>
            <button
              type="button"
              onClick={() => {
                if (customMl <= 0) return;
                void logFluid({
                  date,
                  kind: customKind,
                  volume_ml: customMl,
                  entered_by: enteredBy,
                });
                setOpen(false);
              }}
              className="ml-auto rounded-md bg-ink-900 px-3 py-1.5 text-[11px] text-paper hover:bg-ink-700"
            >
              {L("Log", "记录")}
            </button>
          </div>
        )}

        {fluids.length > 0 && (
          <details className="group rounded-md bg-paper-2/40 px-3 py-2">
            <summary className="cursor-pointer list-none text-[11px] text-ink-500">
              {L(
                `${fluids.length} entries today — show details`,
                `今日 ${fluids.length} 条记录 — 查看`,
              )}
            </summary>
            <ul className="mt-2 space-y-1">
              {fluids.map((f) => (
                <li
                  key={f.id}
                  className="flex items-baseline justify-between gap-2 text-[11px] text-ink-600"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{FLUID_KIND_LABEL[f.kind].emoji}</span>
                    <span>
                      {locale === "zh"
                        ? FLUID_KIND_LABEL[f.kind].zh
                        : FLUID_KIND_LABEL[f.kind].en}
                    </span>
                    <span className="mono text-ink-400">
                      {new Date(f.logged_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="mono text-ink-700">{f.volume_ml} ml</span>
                    <button
                      type="button"
                      onClick={() => deleteFluid(f.id!)}
                      className={cn(
                        "rounded p-0.5 text-ink-400",
                        "hover:bg-ink-100 hover:text-[var(--warn,#d97706)]",
                      )}
                      aria-label="Delete"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
