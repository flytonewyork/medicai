"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { buildCycleContext } from "~/lib/treatment/engine";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CycleCalendar } from "~/components/treatment/cycle-calendar";
import { NudgeCard } from "~/components/treatment/nudge-card";
import { formatDate } from "~/lib/utils/date";
import { addDays, parseISO } from "date-fns";
import type { NudgeCategory } from "~/types/treatment";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react";

const CATEGORY_ORDER: NudgeCategory[] = [
  "safety",
  "hygiene",
  "diet",
  "meds",
  "exercise",
  "sleep",
  "mental",
  "activity",
  "intimacy",
];

export default function CycleDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const cycle = useLiveQuery(
    () => (Number.isFinite(id) ? db.treatment_cycles.get(id) : undefined),
    [id],
  );
  const latestDaily = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(1).toArray(),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ctx = useMemo(() => {
    if (!cycle) return null;
    const d = latestDaily?.[0];
    const flags: string[] = [];
    if (d?.fever) flags.push("fever");
    if ((d?.nausea ?? 0) >= 5) flags.push("nausea");
    if ((d?.diarrhoea_count ?? 0) >= 3) flags.push("diarrhoea");
    if (d?.neuropathy_feet || d?.neuropathy_hands) flags.push("neuropathy");
    if ((d?.appetite ?? 10) <= 3) flags.push("low_appetite");
    return buildCycleContext(cycle, new Date(), flags);
  }, [cycle, latestDaily]);

  if (!cycle || !ctx) {
    return <div className="p-6 text-sm text-ink-500">Loading…</div>;
  }

  const { protocol } = ctx;
  const endDate = addDays(
    parseISO(cycle.start_date),
    protocol.cycle_length_days - 1,
  );

  async function markCompleted() {
    if (!cycle?.id) return;
    await db.treatment_cycles.update(cycle.id, {
      status: "completed",
      actual_end_date: new Date().toISOString().slice(0, 10),
      updated_at: now(),
    });
  }

  async function restoreNudge(nudgeId: string) {
    if (!cycle?.id) return;
    const snoozed = (cycle.snoozed_nudge_ids ?? []).filter(
      (x) => x !== nudgeId,
    );
    const dismissed = (cycle.dismissed_nudge_ids ?? []).filter(
      (x) => x !== nudgeId,
    );
    await db.treatment_cycles.update(cycle.id, {
      snoozed_nudge_ids: snoozed,
      dismissed_nudge_ids: dismissed,
      updated_at: now(),
    });
  }

  async function snooze(nudgeId: string) {
    if (!cycle?.id) return;
    const next = [...(cycle.snoozed_nudge_ids ?? []), nudgeId];
    await db.treatment_cycles.update(cycle.id, {
      snoozed_nudge_ids: next,
      updated_at: now(),
    });
  }

  async function deleteCycle() {
    if (!cycle?.id) return;
    setDeleting(true);
    try {
      await db.treatment_cycles.delete(cycle.id);
      router.push("/treatment");
    } finally {
      setDeleting(false);
    }
  }

  const byCategory = new Map<NudgeCategory, typeof ctx.applicable_nudges>();
  for (const n of ctx.applicable_nudges) {
    const arr = byCategory.get(n.category) ?? [];
    arr.push(n);
    byCategory.set(n.category, arr);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={`${protocol.short_name} · ${locale === "zh" ? "周期" : "Cycle"} ${cycle.cycle_number}`}
        subtitle={`${formatDate(cycle.start_date, locale)} → ${formatDate(endDate.toISOString().slice(0, 10), locale)}`}
        action={
          <Link href="/treatment">
            <Button variant="secondary">
              {locale === "zh" ? "返回" : "Back"}
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "今天在周期中" : "Where you are in the cycle"}
          </CardTitle>
          <div className="mt-1 text-sm text-ink-500">
            {locale === "zh" ? "第 " : "Day "}
            {ctx.cycle_day}
            {locale === "zh" ? " 天 · " : " · "}
            {ctx.phase?.label[locale] ?? ""}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CycleCalendar cycle={cycle} protocol={protocol} />
          {ctx.phase?.description[locale] && (
            <div className="text-xs text-ink-600">
              {ctx.phase.description[locale]}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "方案细节" : "Protocol details"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-ink-600">
            {protocol.description[locale]}
          </p>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {locale === "zh" ? "药物" : "Agents"}
            </div>
            <ul className="space-y-1">
              {protocol.agents.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.display[locale]}</span>
                  <span className="ml-2 text-xs text-ink-500">
                    {a.typical_dose} · D{a.dose_days.join(", D")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {locale === "zh" ? "预用药" : "Premeds"}
            </div>
            <p className="text-xs text-ink-600">
              {protocol.premeds?.[locale] ?? "—"}
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {locale === "zh" ? "典型副作用谱" : "Side effect profile"}
            </div>
            <p className="text-xs text-ink-600">
              {protocol.side_effect_profile[locale]}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "今日提示" : "Today's nudges"}
          </CardTitle>
          <div className="mt-1 text-xs text-ink-500">
            {ctx.applicable_nudges.length}{" "}
            {locale === "zh" ? "条" : "items"}
            {(cycle.snoozed_nudge_ids?.length ?? 0) > 0 &&
              ` · ${cycle.snoozed_nudge_ids!.length} ${locale === "zh" ? "已暂隐" : "snoozed"}`}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const items = byCategory.get(cat);
            if (!items || items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                  {cat}
                </div>
                <div className="space-y-1.5">
                  {items.map((n) => (
                    <NudgeCard key={n.id} nudge={n} onSnooze={snooze} />
                  ))}
                </div>
              </div>
            );
          })}
          {ctx.applicable_nudges.length === 0 && (
            <div className="text-xs text-ink-500">
              {locale === "zh"
                ? "今天没有特别提示。"
                : "No contextual nudges for today."}
            </div>
          )}
          {(cycle.snoozed_nudge_ids?.length ?? 0) > 0 && (
            <div className="pt-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                {locale === "zh" ? "已暂隐" : "Snoozed"}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {cycle.snoozed_nudge_ids!.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => restoreNudge(id)}
                    className="rounded-full border border-ink-200 bg-paper-2 px-2.5 py-1 text-ink-600 hover:border-ink-400"
                  >
                    ↺ {id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Link href={`/treatment/${cycle.id}/edit`}>
          <Button variant="secondary">
            <Pencil className="h-4 w-4" />
            {locale === "zh" ? "编辑" : "Edit cycle"}
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {cycle.status !== "completed" && (
            <Button variant="secondary" onClick={markCompleted}>
              <CheckCircle2 className="h-4 w-4" />
              {locale === "zh" ? "标记为完成" : "Mark cycle complete"}
            </Button>
          )}
          {!confirmDelete ? (
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(true)}
              className="text-[var(--warn)]"
            >
              <Trash2 className="h-4 w-4" />
              {locale === "zh" ? "删除" : "Delete"}
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn-soft)] px-3 py-2 text-xs">
              <span className="text-ink-900">
                {locale === "zh" ? "确认删除此周期？" : "Delete this cycle?"}
              </span>
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                {locale === "zh" ? "取消" : "Cancel"}
              </Button>
              <button
                type="button"
                onClick={deleteCycle}
                disabled={deleting}
                className="rounded-md bg-[var(--warn)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
              >
                {deleting
                  ? locale === "zh"
                    ? "删除中…"
                    : "Deleting…"
                  : locale === "zh"
                    ? "确认删除"
                    : "Confirm delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
