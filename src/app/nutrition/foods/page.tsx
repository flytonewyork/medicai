"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Camera, Filter, Plus, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FoodThumb } from "~/components/nutrition/food-thumb";
import { prepareImageForVision } from "~/lib/ingest/image";
import { db } from "~/lib/db/dexie";
import { deleteFood, upsertFood } from "~/lib/nutrition/queries";
import { foodHint, recalcNetCarbs } from "~/lib/nutrition/calculator";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { TextInput, Field, Textarea } from "~/components/ui/field";
import { cn } from "~/lib/utils/cn";
import type { FoodCategory, FoodItem } from "~/types/nutrition";

const CATEGORY_LABEL: Record<FoodCategory, { en: string; zh: string }> = {
  protein: { en: "Protein", zh: "蛋白" },
  dairy: { en: "Dairy", zh: "奶制品" },
  fat_oil: { en: "Fats & oils", zh: "脂肪/油" },
  vegetable: { en: "Vegetables", zh: "蔬菜" },
  fruit: { en: "Fruits", zh: "水果" },
  grain_starch: { en: "Grains/starches", zh: "主食" },
  legume: { en: "Legumes", zh: "豆类" },
  nut_seed: { en: "Nuts & seeds", zh: "坚果/种子" },
  beverage: { en: "Beverages", zh: "饮品" },
  supplement: { en: "Supplements", zh: "营养品" },
  prepared_meal: { en: "Prepared", zh: "现成菜品" },
  condiment: { en: "Condiments", zh: "调料" },
  sweet: { en: "Sweets", zh: "甜品" },
  other: { en: "Other", zh: "其他" },
};

const HINT_TONE_CLS: Record<string, string> = {
  good: "bg-[var(--tide-2)]/15 text-[var(--tide-2)]",
  ok: "bg-ink-100 text-ink-700",
  watch: "bg-[var(--warn,#d97706)]/15 text-[var(--warn,#d97706)]",
  avoid: "bg-ink-200 text-ink-700",
};

export default function FoodsPage() {
  const router = useRouter();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FoodCategory | "all">("all");
  const [ketoOnly, setKetoOnly] = useState(false);
  const [easyOnly, setEasyOnly] = useState(false);
  const [editing, setEditing] = useState<Partial<FoodItem> | null>(null);

  const foods = useLiveQuery(() => db.foods.orderBy("name").toArray(), []);

  const filtered = useMemo(() => {
    if (!foods) return [];
    const q = query.trim().toLowerCase();
    return foods.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (ketoOnly && !f.keto_friendly) return false;
      if (easyOnly && !f.pdac_easy_digest) return false;
      if (!q) return true;
      const hay = `${f.name} ${f.name_zh ?? ""} ${f.brand ?? ""} ${f.tags.join(" ")}`
        .toLowerCase();
      return hay.includes(q);
    });
  }, [foods, query, category, ketoOnly, easyOnly]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {locale === "zh" ? "返回" : "Back"}
      </button>

      <PageHeader
        eyebrow={locale === "zh" ? "食物库" : "FOODS"}
        title={
          locale === "zh"
            ? "食物数据库"
            : "Foods database"
        }
        subtitle={
          locale === "zh"
            ? "按 100g 计算的宏量。挑选时看色块。"
            : "Macros per 100 g. Tap a colour to scan mPDAC-fit."
        }
        action={
          <Button
            onClick={() =>
              setEditing({
                category: "protein",
                source: "custom",
                tags: [],
                keto_friendly: false,
                calories: 0,
                protein_g: 0,
                fat_g: 0,
                carbs_total_g: 0,
                fiber_g: 0,
                name: "",
              })
            }
          >
            <Plus className="h-4 w-4" />
            {locale === "zh" ? "新增" : "Add"}
          </Button>
        }
      />

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === "zh" ? "搜索…" : "Search…"}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={ketoOnly}
            onClick={() => setKetoOnly((v) => !v)}
            label={locale === "zh" ? "低碳" : "Low carb"}
          />
          <FilterChip
            active={easyOnly}
            onClick={() => setEasyOnly((v) => !v)}
            label={locale === "zh" ? "易消化" : "Easy digest"}
          />
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as FoodCategory | "all")
            }
            className="h-7 rounded-md border border-ink-200 bg-paper px-2 text-[11px] text-ink-700"
          >
            <option value="all">
              {locale === "zh" ? "所有类别" : "All categories"}
            </option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {locale === "zh" ? v.zh : v.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="space-y-1.5">
        {filtered.map((f) => {
          const hint = foodHint(f);
          return (
            <li key={f.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <FoodThumb food={f} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-ink-900">
                        {locale === "zh" && f.name_zh ? f.name_zh : f.name}
                      </span>
                      <span className="mono text-[10px] uppercase tracking-wider text-ink-400">
                        {locale === "zh"
                          ? CATEGORY_LABEL[f.category].zh
                          : CATEGORY_LABEL[f.category].en}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          HINT_TONE_CLS[hint.tone],
                        )}
                      >
                        {locale === "zh"
                          ? hint.label.zh ?? hint.label.en
                          : hint.label.en}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-500">
                      {f.calories} kcal · {f.protein_g}g P · {f.fat_g}g F ·{" "}
                      {f.net_carbs_g}g net C · {f.fiber_g}g fibre /100g
                    </div>
                    {f.pdac_notes && (
                      <p className="mt-1 text-[12px] text-ink-600">
                        {locale === "zh" && f.pdac_notes_zh
                          ? f.pdac_notes_zh
                          : f.pdac_notes}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {f.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(f)}
                    className="text-[11px] text-ink-500 hover:text-ink-900"
                  >
                    {locale === "zh" ? "编辑" : "Edit"}
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <Card className="px-5 py-10 text-center text-sm text-ink-500">
            {locale === "zh" ? "没有匹配项" : "No matches"}
          </Card>
        )}
      </ul>

      {editing && (
        <FoodEditor
          value={editing}
          onCancel={() => setEditing(null)}
          onSave={async (food) => {
            await upsertFood(food);
            setEditing(null);
          }}
          onDelete={
            editing.id
              ? async () => {
                  if (
                    confirm(
                      locale === "zh"
                        ? "删除这条食物？"
                        : "Delete this food?",
                    )
                  ) {
                    await deleteFood(editing.id!);
                    setEditing(null);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px]",
        active
          ? "border-ink-900 bg-ink-900 text-paper"
          : "border-ink-200 bg-paper text-ink-700 hover:border-ink-300",
      )}
    >
      {label}
    </button>
  );
}

function FoodEditor({
  value,
  onCancel,
  onSave,
  onDelete,
}: {
  value: Partial<FoodItem>;
  onCancel: () => void;
  onSave: (
    food: Omit<FoodItem, "net_carbs_g" | "created_at" | "updated_at">,
  ) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const locale = useLocale();
  const [draft, setDraft] = useState<Partial<FoodItem>>(value);

  function set<K extends keyof FoodItem>(k: K, v: FoodItem[K]) {
    setDraft((cur) => ({ ...cur, [k]: v }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/30 sm:items-center"
      onClick={onCancel}
    >
      <Card
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="serif text-lg text-ink-900">
            {value.id
              ? locale === "zh"
                ? "编辑食物"
                : "Edit food"
              : locale === "zh"
              ? "新增食物"
              : "New food"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-ink-500"
          >
            {locale === "zh" ? "取消" : "Cancel"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <PhotoField
            value={draft.image_url}
            onChange={(v) => set("image_url", v)}
          />
          <Field label={locale === "zh" ? "名称 (英文)" : "Name (English)"}>
            <TextInput
              value={draft.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label={locale === "zh" ? "中文名 (可选)" : "Chinese name (optional)"}>
            <TextInput
              value={draft.name_zh ?? ""}
              onChange={(e) => set("name_zh", e.target.value)}
            />
          </Field>
          <Field label={locale === "zh" ? "类别" : "Category"}>
            <select
              value={draft.category ?? "protein"}
              onChange={(e) => set("category", e.target.value as FoodCategory)}
              className="h-11 w-full rounded-md border border-ink-200 bg-paper px-3 text-sm text-ink-900"
            >
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {locale === "zh" ? v.zh : v.en}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <NumField label="kcal /100g" value={draft.calories} onChange={(v) => set("calories", v)} />
            <NumField label="Protein g" value={draft.protein_g} onChange={(v) => set("protein_g", v)} />
            <NumField label="Fat g" value={draft.fat_g} onChange={(v) => set("fat_g", v)} />
            <NumField label="Carbs g" value={draft.carbs_total_g} onChange={(v) => set("carbs_total_g", v)} />
            <NumField label="Fibre g" value={draft.fiber_g} onChange={(v) => set("fiber_g", v)} />
            <NumField
              label="Sugar alc g"
              value={draft.sugar_alcohols_g}
              onChange={(v) => set("sugar_alcohols_g", v)}
            />
          </div>

          <Field label={locale === "zh" ? "标签 (逗号分隔)" : "Tags (comma-separated)"}>
            <TextInput
              value={(draft.tags ?? []).join(", ")}
              onChange={(e) =>
                set(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </Field>

          <Field label="mPDAC-notes (en)">
            <Textarea
              rows={2}
              value={draft.pdac_notes ?? ""}
              onChange={(e) => set("pdac_notes", e.target.value)}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Toggle
              label={locale === "zh" ? "低碳水" : "Keto-friendly"}
              active={!!draft.keto_friendly}
              onClick={() => set("keto_friendly", !draft.keto_friendly)}
            />
            <Toggle
              label={locale === "zh" ? "易消化" : "Easy digest"}
              active={!!draft.pdac_easy_digest}
              onClick={() => set("pdac_easy_digest", !draft.pdac_easy_digest)}
            />
            <Toggle
              label={locale === "zh" ? "需胰酶" : "Needs PERT"}
              active={!!draft.pdac_high_fat_pert}
              onClick={() =>
                set("pdac_high_fat_pert", !draft.pdac_high_fat_pert)
              }
            />
          </div>

          <div className="text-[11px] text-ink-500">
            {locale === "zh" ? "净碳水预览" : "Net carbs preview"} :{" "}
            <span className="mono text-ink-700">
              {recalcNetCarbs({
                calories: 0,
                protein_g: 0,
                fat_g: 0,
                carbs_total_g: draft.carbs_total_g ?? 0,
                fiber_g: draft.fiber_g ?? 0,
                sugar_alcohols_g: draft.sugar_alcohols_g,
              })}
              g
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-[var(--warn,#d97706)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {locale === "zh" ? "删除" : "Delete"}
            </button>
          ) : (
            <span />
          )}
          <Button
            onClick={() =>
              draft.name && draft.category
                ? onSave({
                    id: draft.id,
                    name: draft.name,
                    name_zh: draft.name_zh,
                    brand: draft.brand,
                    category: draft.category,
                    default_serving_g: draft.default_serving_g,
                    default_serving_label: draft.default_serving_label,
                    calories: draft.calories ?? 0,
                    protein_g: draft.protein_g ?? 0,
                    fat_g: draft.fat_g ?? 0,
                    carbs_total_g: draft.carbs_total_g ?? 0,
                    fiber_g: draft.fiber_g ?? 0,
                    sugar_alcohols_g: draft.sugar_alcohols_g,
                    sugar_g: draft.sugar_g,
                    keto_friendly: !!draft.keto_friendly,
                    pdac_easy_digest: draft.pdac_easy_digest,
                    pdac_high_fat_pert: draft.pdac_high_fat_pert,
                    pdac_notes: draft.pdac_notes,
                    pdac_notes_zh: draft.pdac_notes_zh,
                    tags: draft.tags ?? [],
                    image_url: draft.image_url,
                    emoji: draft.emoji,
                    source: draft.source ?? "custom",
                  } as Parameters<typeof onSave>[0])
                : undefined
            }
          >
            {locale === "zh" ? "保存" : "Save"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <TextInput
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </Field>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px]",
        active
          ? "border-ink-900 bg-ink-900 text-paper"
          : "border-ink-200 bg-paper text-ink-700 hover:border-ink-300",
      )}
    >
      {label}
    </button>
  );
}

// Photo upload for a food row. Stored as a resized data URL so it
// roundtrips through Dexie / Supabase without a separate blob store.
// The resize caps the long edge at 480 px, which is sufficient for
// thumbnails in the picker without bloating IndexedDB.
function PhotoField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const prepared = await prepareImageForVision(file, {
        maxEdge: 480,
        quality: 0.78,
      });
      onChange(`data:${prepared.mediaType};base64,${prepared.base64}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-16 w-16 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-ink-200 bg-paper-2/40 text-ink-400">
          <Camera className="h-5 w-5" />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => ref.current?.click()}
        >
          <Camera className="h-3.5 w-3.5" />
          {value ? "Replace photo" : "Add photo"}
        </Button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex items-center gap-1 text-[11px] text-ink-400 hover:text-[var(--warn,#d97706)]"
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
