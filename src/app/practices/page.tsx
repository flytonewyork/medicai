"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  deactivateCustomPractice,
  deleteCustomPractice,
  isCustomPractice,
  scheduleSummary,
} from "~/lib/medication/practices";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import type { Medication } from "~/types/medication";
import { Plus, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PracticesPage() {
  const locale = useLocale();
  const rows = useLiveQuery(
    () => db.medications.where("category").equals("behavioural").toArray(),
    [],
  );

  const [active, archived] = useMemo(() => {
    const a: Medication[] = [];
    const x: Medication[] = [];
    for (const m of rows ?? []) (m.active ? a : x).push(m);
    return [a, x];
  }, [rows]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <PageHeader
        eyebrow={locale === "zh" ? "行为干预" : "Behavioural"}
        title={locale === "zh" ? "修习" : "Practices"}
      />

      <Card className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="serif text-[18px] text-ink-900">
              {locale === "zh"
                ? "每日修习与身心干预"
                : "Daily practices and mind-body interventions"}
            </div>
            <p className="mt-1 text-[13px] text-ink-600">
              {locale === "zh"
                ? "添加呼吸练习、冥想、走路、阻力训练 —— 每日记录形成节奏。"
                : "Add breathing exercises, meditation, walking, resistance training. Logging daily builds the rhythm."}
            </p>
          </div>
          <Link href="/practices/new">
            <Button variant="primary" size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              {locale === "zh" ? "新建" : "Add"}
            </Button>
          </Link>
        </div>
      </Card>

      {active.length === 0 ? (
        <Card className="p-5 text-sm text-ink-500">
          {locale === "zh"
            ? "暂无修习。点击右上角新建第一项。"
            : "No practices yet. Add your first above."}
        </Card>
      ) : (
        <ul className="space-y-2">
          {active.map((m) => (
            <PracticeRow key={m.id} med={m} locale={locale} />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <div className="eyebrow px-1">
            {locale === "zh" ? "已存档" : "Archived"}
          </div>
          <ul className="space-y-2 opacity-70">
            {archived.map((m) => (
              <PracticeRow key={m.id} med={m} locale={locale} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PracticeRow({
  med,
  locale,
}: {
  med: Medication;
  locale: "en" | "zh";
}) {
  const catalogue = DRUGS_BY_ID[med.drug_id];
  const name =
    (locale === "zh" ? catalogue?.name.zh : catalogue?.name.en) ??
    med.display_name ??
    med.drug_id;
  const custom = isCustomPractice(med);
  const started = med.started_on
    ? format(parseISO(med.started_on), "d MMM yyyy")
    : "";

  return (
    <li>
      <Card className="flex items-start gap-3 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-700">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-ink-900">
              {name}
            </span>
            {custom && (
              <span className="mono rounded-full bg-[var(--tide-soft)] px-2 py-0.5 text-[9.5px] uppercase tracking-[0.12em] text-[var(--tide-2)]">
                {locale === "zh" ? "自定义" : "custom"}
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-ink-600">
            {med.dose} · {scheduleSummary(med.schedule, locale)}
          </div>
          {started && (
            <div className="mt-0.5 text-[11px] text-ink-400">
              {locale === "zh" ? "开始：" : "Since "}
              {started}
            </div>
          )}
          {med.notes && (
            <p className="mt-1 text-[12px] text-ink-700">{med.notes}</p>
          )}
          {custom && med.active && med.id !== undefined && (
            <div className="mt-2 flex gap-2">
              <Link
                href={`/practices/${med.id}`}
                className="text-[11px] text-ink-500 hover:text-ink-900"
              >
                {locale === "zh" ? "编辑" : "Edit"}
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (med.id) void deactivateCustomPractice(med.id);
                }}
                className="text-[11px] text-ink-500 hover:text-ink-900"
              >
                {locale === "zh" ? "存档" : "Archive"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    med.id &&
                    confirm(
                      locale === "zh"
                        ? "删除此修习及其全部记录？"
                        : "Delete this practice and its logs?",
                    )
                  )
                    void deleteCustomPractice(med.id);
                }}
                className="text-[11px] text-ink-400 hover:text-[var(--warn)]"
              >
                {locale === "zh" ? "删除" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </Card>
    </li>
  );
}
