"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "~/lib/db/dexie";
import { latestDailyEntries } from "~/lib/db/queries";
import { buildCycleContext } from "~/lib/treatment/engine";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { CycleCalendar } from "~/components/treatment/cycle-calendar";
import { CycleDayDetail } from "~/components/treatment/cycle-day-detail";
import { CycleMedicationsCard } from "~/components/treatment/cycle-medications-card";
import { NudgeCard } from "~/components/treatment/nudge-card";
import { formatDate } from "~/lib/utils/date";
import { addDays, format, parseISO } from "date-fns";
import type { NudgeCategory } from "~/types/treatment";
import type { LabResult } from "~/types/clinical";
import {
  CalendarPlus,
  CheckCircle2,
  Pencil,
  ScanLine,
  Stethoscope,
  TimerOff,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import {
  ANALYTES,
  flagStatus,
  formatAnalyte,
  type AnalyteKey,
} from "~/config/lab-reference-ranges";

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
  const latestDaily = useLiveQuery(() => latestDailyEntries(1));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  const cycleStartStr = cycle?.start_date;
  const cycleEndStr = useMemo(() => {
    if (!cycle || !ctx) return undefined;
    return addDays(
      parseISO(cycle.start_date),
      ctx.protocol.cycle_length_days - 1,
    )
      .toISOString()
      .slice(0, 10);
  }, [cycle, ctx]);
  const cycleLabs = useLiveQuery(
    () => {
      if (!cycleStartStr || !cycleEndStr) return [];
      return db.labs
        .where("date")
        .between(cycleStartStr, cycleEndStr, true, true)
        .toArray();
    },
    [cycleStartStr, cycleEndStr],
  );

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
          <CycleCalendar
            cycle={cycle}
            protocol={protocol}
            selectedDay={selectedDay ?? undefined}
            onSelectDay={(d) =>
              setSelectedDay((prev) => (prev === d ? null : d))
            }
          />
          {!selectedDay && ctx.phase?.description[locale] && (
            <div className="text-xs text-ink-600">
              {ctx.phase.description[locale]}
            </div>
          )}
          {!selectedDay && (
            <div className="text-[11px] text-ink-400">
              {locale === "zh"
                ? "点一下任意一天查看该日详情与日程。"
                : "Tap any day to see that day's detail and schedule."}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDay !== null && (
        <CycleDayDetail
          cycle={cycle}
          protocol={protocol}
          dayNumber={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}

      <CycleMedicationsCard cycleId={cycle.id} />

      <CycleQuickActions cycle={cycle} protocol={protocol} locale={locale} />

      <CycleLabsCard labs={cycleLabs ?? []} locale={locale} />

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

function CycleQuickActions({
  cycle,
  protocol,
  locale,
}: {
  cycle: { id?: number; start_date: string; rest_days_added?: number };
  protocol: { dose_days: number[]; cycle_length_days: number };
  locale: "en" | "zh";
}) {
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const today = new Date();
  const startMs = parseISO(cycle.start_date).getTime();

  // Pre-chemo consult date: one calendar day before the next upcoming
  // dose day. If all dose days in this cycle have passed, fall back to
  // the first dose day of a presumptive next cycle (start + cycle_length
  // + rest_days_added + 1 + protocol.dose_days[0] - 1 ...). Keep it
  // simple for now — show an inline note if no upcoming dose.
  const nextDoseDay = useMemo(() => {
    const dayOffsets = protocol.dose_days.map((d) => d - 1);
    for (const o of dayOffsets) {
      const ms = startMs + o * 86_400_000;
      if (ms >= today.getTime()) return ms;
    }
    return null;
  }, [protocol.dose_days, startMs, today]);

  const preChemoDate = nextDoseDay
    ? format(addDays(new Date(nextDoseDay), -1), "yyyy-MM-dd")
    : null;

  // Default re-staging scan at cycle end (day N of protocol).
  const restageDate = format(
    addDays(parseISO(cycle.start_date), protocol.cycle_length_days - 1),
    "yyyy-MM-dd",
  );

  async function addRestWeek() {
    if (!cycle.id) return;
    const { db, now } = await import("~/lib/db/dexie");
    await db.treatment_cycles.update(cycle.id, {
      rest_days_added: (cycle.rest_days_added ?? 0) + 7,
      updated_at: now(),
    });
  }

  async function clearRestDays() {
    if (!cycle.id) return;
    const { db, now } = await import("~/lib/db/dexie");
    await db.treatment_cycles.update(cycle.id, {
      rest_days_added: 0,
      updated_at: now(),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {L("Schedule shortcuts", "日程快捷操作")}
        </CardTitle>
        <div className="mt-1 text-xs text-ink-500">
          {L(
            "One-tap additions that pre-fill the appointment form for this cycle.",
            "一键预填适用于本周期的预约表单。",
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {preChemoDate ? (
          <Link
            href={`/schedule/new?date=${preChemoDate}&time=10:00&kind=clinic&title=${encodeURIComponent(
              "Pre-chemo consult",
            )}&cycle=${cycle.id ?? ""}`}
          >
            <Button variant="secondary" size="sm">
              <Stethoscope className="h-3.5 w-3.5" />
              {L("Add pre-chemo consult", "新增化疗前复诊")}
            </Button>
          </Link>
        ) : (
          <span className="text-[11px] text-ink-400">
            {L(
              "No upcoming dose day — start a new cycle to schedule a pre-chemo consult.",
              "本周期无后续用药日 —— 新建周期后可安排化疗前复诊。",
            )}
          </span>
        )}
        <Link
          href={`/schedule/new?date=${restageDate}&kind=scan&title=${encodeURIComponent(
            "Re-staging scan",
          )}&cycle=${cycle.id ?? ""}`}
        >
          <Button variant="secondary" size="sm">
            <ScanLine className="h-3.5 w-3.5" />
            {L("Add re-staging scan", "新增再分期检查")}
          </Button>
        </Link>
        <Link
          href={`/schedule/new?date=${restageDate}&cycle=${cycle.id ?? ""}`}
        >
          <Button variant="secondary" size="sm">
            <CalendarPlus className="h-3.5 w-3.5" />
            {L("Add other test / visit", "新增其他检查 / 就诊")}
          </Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={() => void addRestWeek()}>
          <TimerOff className="h-3.5 w-3.5" />
          {L("+1 rest week", "加一周休息")}
          {(cycle.rest_days_added ?? 0) > 0 && (
            <span className="mono ml-1 text-[10px] text-ink-400">
              ({cycle.rest_days_added}d)
            </span>
          )}
        </Button>
        {(cycle.rest_days_added ?? 0) > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void clearRestDays()}>
            {L("Reset rest days", "重置休息天数")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CycleLabsCard({
  labs,
  locale,
}: {
  labs: LabResult[];
  locale: "en" | "zh";
}) {
  if (labs.length === 0) return null;
  // Collect distinct analytes actually populated in this cycle's draws
  const keys = new Set<AnalyteKey>();
  for (const l of labs) {
    for (const a of ANALYTES) {
      if (typeof l[a.key] === "number") keys.add(a.key);
    }
  }
  if (keys.size === 0) return null;

  const ordered = labs
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {locale === "zh" ? "本周期化验" : "Labs drawn this cycle"}
        </CardTitle>
        <div className="mt-1 text-xs text-ink-500">
          {ordered.length}{" "}
          {locale === "zh"
            ? ordered.length === 1
              ? "次采样"
              : "次采样"
            : ordered.length === 1
              ? "draw"
              : "draws"}{" "}
          ·{" "}
          {keys.size}{" "}
          {locale === "zh" ? "项" : "analytes"}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {ordered.map((row) => (
          <div
            key={row.id ?? row.date}
            className="rounded-[var(--r-md)] border border-ink-100/70 bg-paper-2 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold text-ink-900">
                {format(parseISO(row.date), "EEE · d MMM")}
              </div>
              <span className="mono text-[10px] uppercase tracking-wider text-ink-400">
                {row.source}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ANALYTES.filter((a) => typeof row[a.key] === "number").map((a) => {
                const v = row[a.key] as number;
                const status = flagStatus(a.key, v);
                return (
                  <Link
                    key={a.key}
                    href={`/labs/${a.key}`}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] hover:opacity-80 transition-opacity",
                      status === "normal"
                        ? "bg-ink-100 text-ink-700"
                        : "",
                    )}
                    style={
                      status !== "normal"
                        ? {
                            background: "var(--warn-soft)",
                            color: "var(--warn)",
                          }
                        : undefined
                    }
                    title={`${a.label[locale]} ${formatAnalyte(a.key, v)} ${a.unit}`}
                  >
                    <span className="mono text-[9px] uppercase tracking-wider mr-1">
                      {a.short}
                    </span>
                    <span className="num font-semibold">
                      {formatAnalyte(a.key, v)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
