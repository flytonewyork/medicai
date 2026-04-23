"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import { scheduleSummary } from "~/lib/medication/practices";
import type { Medication } from "~/types/medication";
import { ChevronRight, Pencil, Pill, Plus, Zap } from "lucide-react";

// Summary of the active prescriptions attached to this cycle. Split into
// regular (scheduled) and PRN so the patient can see at a glance what's
// running as a daily / cyclical baseline vs. what's available to take as
// needed. Full edit lives on `/prescriptions?cycle=<id>`; this card is a
// tight preview with a per-row Edit link.

export function CycleMedicationsCard({ cycleId }: { cycleId?: number }) {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const meds = useLiveQuery(async () => {
    const all = await db.medications.toArray();
    return all.filter(
      (m) =>
        m.active &&
        m.category !== "behavioural" &&
        (m.cycle_id === cycleId || m.cycle_id == null),
    );
  }, [cycleId]);

  const { regular, prn } = useMemo(() => {
    const regular: Medication[] = [];
    const prn: Medication[] = [];
    for (const m of meds ?? []) {
      if (m.schedule?.kind === "prn") prn.push(m);
      else regular.push(m);
    }
    return { regular, prn };
  }, [meds]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle>{L("Current prescriptions", "当前处方")}</CardTitle>
          <Link
            href={`/prescriptions?cycle=${cycleId ?? ""}`}
            className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
          >
            {L("Manage", "管理")}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-1 text-[11.5px] text-ink-500">
          {L(
            "Protocol-derived + user-added meds active for this cycle. Tap Edit to change dose, schedule, or stop.",
            "本周期有效的方案用药 + 自行添加用药。轻点「编辑」可改剂量、用法或停药。",
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MedSection
          title={L("Scheduled", "按时服用")}
          icon={Pill}
          meds={regular}
          locale={locale}
          emptyLabel={L(
            "No scheduled medications yet.",
            "暂无按时用药。",
          )}
          cycleId={cycleId}
        />
        <MedSection
          title={L("As needed (PRN)", "按需服用（PRN）")}
          icon={Zap}
          meds={prn}
          locale={locale}
          emptyLabel={L("No PRN medications yet.", "暂无按需用药。")}
          cycleId={cycleId}
        />
        <div className="pt-1">
          <Link
            href={`/prescriptions?cycle=${cycleId ?? ""}&new=1`}
            className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-3 py-1.5 text-[12px] text-ink-700 hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]"
          >
            <Plus className="h-3.5 w-3.5" />
            {L("Add medication", "新增用药")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function MedSection({
  title,
  icon: Icon,
  meds,
  locale,
  emptyLabel,
  cycleId,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  meds: Medication[];
  locale: "en" | "zh";
  emptyLabel: string;
  cycleId?: number;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
        <Icon className="h-3 w-3" />
        {title}
        <span className="mono text-[10px] text-ink-400">· {meds.length}</span>
      </div>
      {meds.length === 0 ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-ink-200 bg-paper px-3 py-2 text-[11.5px] text-ink-500">
          {emptyLabel}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {meds.map((m) => {
            const catalogue = DRUGS_BY_ID[m.drug_id];
            const name =
              (locale === "zh" ? catalogue?.name.zh : catalogue?.name.en) ??
              m.display_name ??
              m.drug_id;
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-[var(--r-md)] bg-paper-2 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink-900">
                    {name}
                  </div>
                  <div className="text-[11px] text-ink-500">
                    {[m.dose, m.schedule ? scheduleSummary(m.schedule, locale) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <Link
                  href={`/prescriptions?cycle=${cycleId ?? ""}&edit=${m.id ?? ""}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-700 hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]"
                >
                  <Pencil className="h-3 w-3" />
                  {locale === "zh" ? "编辑" : "Edit"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
