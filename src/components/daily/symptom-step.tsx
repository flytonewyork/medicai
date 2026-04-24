"use client";

import { useSettings } from "~/hooks/use-settings";
import { pickL } from "~/hooks/use-bilingual";
import type { DailyEntry } from "~/types/clinical";
import {
  SYMPTOM_CATALOG,
  defaultTrackedSymptomIds,
  rankTrackedSymptoms,
  type SymptomDefinition,
  type SymptomTag,
} from "~/lib/daily/symptom-catalog";
import { Field, TextInput } from "~/components/ui/field";
import { ScaleInput } from "./scale-input";
import { Toggle } from "./toggle";
import { cn } from "~/lib/utils/cn";

// The daily-wizard's "Symptoms" step, driven by the curated catalog
// (`src/lib/daily/symptom-catalog.ts`) plus the user's
// `settings.tracked_symptoms` list. Users only see the symptoms they've
// opted into — no more blanket toggle grid.

const TAG_STYLE: Record<SymptomTag, string> = {
  pdac: "bg-[var(--tide-soft)] text-[var(--tide-2)]",
  chemo: "bg-ink-100 text-ink-700",
  gnp: "bg-[var(--sand)] text-ink-900",
  pert: "bg-[var(--ok-soft)] text-[var(--ok)]",
  safety: "bg-[var(--warn-soft)] text-[var(--warn)]",
};

export function SymptomStep({
  draft,
  patch,
  locale,
  inChemoWindow,
}: {
  draft: Partial<DailyEntry>;
  patch: <K extends keyof DailyEntry>(
    k: K,
    v: DailyEntry[K] | undefined,
  ) => void;
  locale: "en" | "zh";
  inChemoWindow: boolean;
}) {
  const trackedIds =
    useSettings()?.tracked_symptoms ?? defaultTrackedSymptomIds();
  const rows = rankTrackedSymptoms(trackedIds, { inChemoWindow });

  const L = (en: string, zh: string) => pickL(locale, en, zh);

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--r-md)] border border-dashed border-ink-200 bg-paper-2 p-4 text-[12.5px] text-ink-500">
        {L(
          "No symptoms tracked yet. Go to Settings → Care tracking to pick which ones to watch.",
          "尚未启用任何症状跟踪。请到设置 → 症状跟踪 中选择。",
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inChemoWindow && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tide-soft)] px-2.5 py-1 text-[11px] text-[var(--tide-2)]">
          <span className="mono font-medium uppercase tracking-[0.12em]">
            {L("Chemo window", "化疗窗口")}
          </span>
          <span className="text-ink-500">
            {L(
              "· GnP-specific items surfaced first",
              "· 已优先显示 GnP 相关项目",
            )}
          </span>
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((s) => (
          <li key={s.id}>
            <SymptomRow
              def={s}
              draft={draft}
              patch={patch}
              locale={locale}
            />
            {s.id === "fever" && draft.fever && (
              <div className="mt-2">
                <Field label={L("Temperature (°C)", "体温（°C）")}>
                  <TextInput
                    type="number"
                    inputMode="decimal"
                    value={draft.fever_temp ?? ""}
                    onChange={(e) =>
                      patch(
                        "fever_temp",
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                  />
                </Field>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between pt-2 text-[11px] text-ink-400">
        <span>
          {L(
            `Tracking ${rows.length} of ${SYMPTOM_CATALOG.length}`,
            `跟踪 ${rows.length} / ${SYMPTOM_CATALOG.length}`,
          )}
        </span>
        <a
          href="/settings#care-tracking"
          className="underline-offset-2 hover:text-ink-700 hover:underline"
        >
          {L("Customise", "自定义")}
        </a>
      </div>
    </div>
  );
}

function SymptomRow({
  def,
  draft,
  patch,
  locale,
}: {
  def: SymptomDefinition;
  draft: Partial<DailyEntry>;
  patch: <K extends keyof DailyEntry>(
    k: K,
    v: DailyEntry[K] | undefined,
  ) => void;
  locale: "en" | "zh";
}) {
  const field = def.dailyEntryField;
  const labelText = def.label[locale];
  const hintText = def.hint?.[locale];
  const primaryTag = def.tags[0];

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-[13px] font-medium text-ink-800">{labelText}</div>
        {hintText && (
          <div className="mt-0.5 text-[11px] text-ink-500">{hintText}</div>
        )}
      </div>
      {primaryTag && (
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em]",
            TAG_STYLE[primaryTag],
          )}
        >
          {primaryTag}
        </span>
      )}
    </div>
  );

  switch (def.scale) {
    case "boolean": {
      const current = Boolean(draft[field]);
      return (
        <div className="space-y-1.5">
          {header}
          <Toggle
            label={locale === "zh" ? "今天有" : "Present today"}
            checked={current}
            onChange={(v) => patch(field, (v ? true : undefined) as never)}
          />
        </div>
      );
    }
    case "count": {
      const raw = draft[field];
      return (
        <div className="space-y-1.5">
          {header}
          <TextInput
            type="number"
            inputMode="numeric"
            value={typeof raw === "number" ? raw : ""}
            onChange={(e) =>
              patch(
                field,
                (e.target.value === ""
                  ? undefined
                  : Number(e.target.value)) as never,
              )
            }
          />
        </div>
      );
    }
    case "0_to_10":
    case "0_to_5": {
      const max = def.scale === "0_to_10" ? 10 : 5;
      const raw = draft[field];
      const value = typeof raw === "number" ? raw : 0;
      return (
        <div className="space-y-1.5">
          {header}
          <ScaleInput
            label=""
            value={value}
            onChange={(n) => patch(field, n as never)}
            min={0}
            max={max}
          />
        </div>
      );
    }
    case "ctcae_0_4": {
      const raw = draft[field];
      const value =
        typeof raw === "number" ? raw : raw === true ? 1 : 0;
      return (
        <div className="space-y-1.5">
          {header}
          <ScaleInput
            label=""
            value={value}
            onChange={(n) => patch(field, n as never)}
            min={0}
            max={4}
          />
        </div>
      );
    }
  }
}
