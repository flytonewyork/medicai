"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookmarkPlus, Star, Trash2, Repeat } from "lucide-react";
import {
  deleteTemplate,
  listTemplates,
  logTemplate,
} from "~/lib/nutrition/templates";
import { useLocale, pickL } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";
import type { MealTemplate, MealType } from "~/types/nutrition";

// Saved-meals shortcut. Lets the patient one-tap re-log "my usual
// breakfast" without going through the food picker. The component is
// hidden when no templates exist so the new-user flow stays clean.
export function TemplatesPicker({
  date,
  meal_type,
  onLogged,
}: {
  date: string;
  meal_type?: MealType;
  onLogged: (meal_id: number) => void;
}) {
  const locale = useLocale();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const [order, setOrder] = useState<"recent" | "favourites">("recent");
  const templates =
    useLiveQuery(
      async () => listTemplates({ orderBy: order, limit: 12 }),
      [order],
    ) ?? [];

  if (templates.length === 0) return null;

  const L = pickL(locale);
  return (
    <Card className="space-y-3 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h3 className="eyebrow flex items-center gap-1.5">
          <BookmarkPlus className="h-3.5 w-3.5 text-[var(--tide-2)]" />
          {L("Saved meals", "常吃")}
        </h3>
        <div className="flex gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => setOrder("recent")}
            className={cn(
              "rounded-full px-2 py-0.5",
              order === "recent"
                ? "bg-ink-900 text-paper"
                : "bg-paper text-ink-500 hover:text-ink-900",
            )}
          >
            {L("Recent", "最近")}
          </button>
          <button
            type="button"
            onClick={() => setOrder("favourites")}
            className={cn(
              "rounded-full px-2 py-0.5",
              order === "favourites"
                ? "bg-ink-900 text-paper"
                : "bg-paper text-ink-500 hover:text-ink-900",
            )}
          >
            {L("Favourites", "常用")}
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {templates.map((t) => (
          <li key={t.id}>
            <TemplateRow
              tpl={t}
              onLog={async () => {
                const id = await logTemplate({
                  template_id: t.id!,
                  date,
                  meal_type,
                  entered_by: enteredBy,
                });
                onLogged(id);
              }}
              onDelete={() => deleteTemplate(t.id!)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TemplateRow({
  tpl,
  onLog,
  onDelete,
}: {
  tpl: MealTemplate;
  onLog: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const locale = useLocale();
  const totals = tpl.items.reduce(
    (acc, it) => ({
      cal: acc.cal + it.calories,
      p: acc.p + it.protein_g,
      nc: acc.nc + it.net_carbs_g,
    }),
    { cal: 0, p: 0, nc: 0 },
  );
  const L = pickL(locale);

  return (
    <div className="flex items-center gap-3 rounded-md border border-ink-100 bg-paper-2/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink-900">
            {locale === "zh" && tpl.name_zh ? tpl.name_zh : tpl.name}
          </span>
          {tpl.use_count > 1 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--sand)]/40 px-1.5 py-0 text-[10px] text-ink-700">
              <Star className="h-2.5 w-2.5" />
              {tpl.use_count}×
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-500">
          {tpl.items.length} {L("items", "项")} ·{" "}
          {Math.round(totals.cal)} kcal · {Math.round(totals.p)}g P ·{" "}
          {Math.round(totals.nc)}g NC
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={onLog}>
        <Repeat className="h-3.5 w-3.5" />
        {L("Log", "记一次")}
      </Button>
      <button
        type="button"
        onClick={() => {
          if (
            confirm(
              L("Delete this saved meal?", "删除这个常吃记录？"),
            )
          ) {
            void onDelete();
          }
        }}
        className="text-ink-300 hover:text-[var(--warn,#d97706)]"
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
