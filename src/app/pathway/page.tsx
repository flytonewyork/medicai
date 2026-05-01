"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  ClipboardList,
  FlaskConical,
  Image as ImageIcon,
  Pill,
  Stethoscope,
  Mic,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useLocale } from "~/hooks/use-translate";
import { db } from "~/lib/db/dexie";
import {
  buildPathway,
  type PathwayBuckets,
  type PathwayCategory,
  type PathwayItem,
} from "~/lib/pathway/build";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/ui/page-header";
import { EmptyState } from "~/components/ui/empty-state";
import { cn } from "~/lib/utils/cn";

// /pathway — chronological projection over the clinical schema:
// appointments (past & future), life_events (medical), labs, imaging,
// treatment cycles, medication start/stop, voice-memo clinic_visits.
// Three buckets — Coming up · Recent · Earlier — so the patient can
// see what's next, what just happened, and the longer arc.

export default function PathwayPage() {
  const locale = useLocale();

  // useLiveQuery on row counts so the page refreshes when an ingest /
  // memo / lab / appointment lands.
  const apptCount = useLiveQuery(() => db.appointments.count(), [], 0);
  const lifeCount = useLiveQuery(() => db.life_events.count(), [], 0);
  const labCount = useLiveQuery(() => db.labs.count(), [], 0);
  const imagingCount = useLiveQuery(() => db.imaging.count(), [], 0);
  const cycleCount = useLiveQuery(() => db.treatment_cycles.count(), [], 0);
  const medCount = useLiveQuery(() => db.medications.count(), [], 0);
  const memoCount = useLiveQuery(() => db.voice_memos.count(), [], 0);

  const [buckets, setBuckets] = useState<PathwayBuckets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void buildPathway().then((b) => {
      if (cancelled) return;
      setBuckets(b);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    apptCount,
    lifeCount,
    labCount,
    imagingCount,
    cycleCount,
    medCount,
    memoCount,
  ]);

  const allEmpty =
    !!buckets &&
    buckets.upcoming.length === 0 &&
    buckets.recent.length === 0 &&
    buckets.earlier.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "临床轨迹" : "Clinical pathway"}
        subtitle={
          locale === "zh"
            ? "预约、化验、影像、治疗、用药、就诊记录 — 全部按时间排好。"
            : "Appointments, labs, imaging, treatment, medications, visits — strung in chronological order."
        }
      />

      {loading && !buckets ? (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {locale === "zh" ? "正在整理…" : "Building pathway…"}
          </div>
        </Card>
      ) : allEmpty ? (
        <EmptyState
          icon={CalendarDays}
          title={locale === "zh" ? "还没有任何记录" : "Nothing to chart yet"}
          description={
            locale === "zh"
              ? "去「导入」上传报告或预约信，或者「日志」录一段语音。"
              : "Open Ingest to upload a report or appointment letter, or Log a voice memo to start."
          }
        />
      ) : (
        buckets && (
          <>
            {buckets.upcoming.length > 0 && (
              <Section
                title={locale === "zh" ? "即将到来" : "Coming up"}
                items={buckets.upcoming}
                locale={locale}
              />
            )}
            {buckets.recent.length > 0 && (
              <Section
                title={locale === "zh" ? "最近 14 天" : "Recent (last 14 days)"}
                items={buckets.recent}
                locale={locale}
              />
            )}
            {buckets.earlier.length > 0 && (
              <Section
                title={locale === "zh" ? "更早" : "Earlier"}
                items={buckets.earlier}
                locale={locale}
              />
            )}
          </>
        )
      )}
    </div>
  );
}

function Section({
  title,
  items,
  locale,
}: {
  title: string;
  items: PathwayItem[];
  locale: "en" | "zh";
}) {
  return (
    <section className="space-y-2">
      <h2 className="serif text-[18px] tracking-tight text-ink-900">
        {title}
      </h2>
      <ol className="space-y-2">
        {items.map((it) => (
          <li key={it.key}>
            <PathwayCard item={it} locale={locale} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function PathwayCard({
  item,
  locale,
}: {
  item: PathwayItem;
  locale: "en" | "zh";
}) {
  const Icon = iconForCategory(item.category);
  const colour = colourForCategory(item.category);
  const when = formatWhen(item.at, locale);

  const inner = (
    <Card className="p-3 hover:bg-paper-2/40 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            colour.bg,
            colour.fg,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-[11px] text-ink-500">
            <span className="tabular-nums">{when}</span>
            <span className={cn("font-medium uppercase tracking-wider", colour.label)}>
              {labelForCategory(item.category, locale)}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] font-medium text-ink-900">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              {item.subtitle}
            </p>
          )}
          {item.body && (
            <p className="mt-1.5 line-clamp-3 text-[12.5px] text-ink-700">
              {item.body}
            </p>
          )}
          {item.status && item.category === "appointment" && (
            <span
              className={cn(
                "mt-1.5 inline-flex rounded-full px-1.5 py-0 text-[10px] font-medium",
                statusColour(item.status),
              )}
            >
              {item.status}
            </span>
          )}
        </div>
        {item.href && (
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-ink-300"
            aria-hidden
          />
        )}
      </div>
    </Card>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 rounded-lg">
        {inner}
      </Link>
    );
  }
  return inner;
}

function iconForCategory(c: PathwayCategory) {
  switch (c) {
    case "appointment":
      return CalendarDays;
    case "clinic_visit":
    case "memo_visit":
      return Stethoscope;
    case "lab":
      return FlaskConical;
    case "imaging":
      return ImageIcon;
    case "treatment_cycle":
      return ClipboardList;
    case "medication":
      return Pill;
  }
}

function colourForCategory(c: PathwayCategory): {
  bg: string;
  fg: string;
  label: string;
} {
  switch (c) {
    case "appointment":
      return {
        bg: "bg-[var(--tide-2)]/12",
        fg: "text-[var(--tide-2)]",
        label: "text-[var(--tide-2)]",
      };
    case "clinic_visit":
    case "memo_visit":
      return {
        bg: "bg-emerald-50",
        fg: "text-emerald-700",
        label: "text-emerald-700",
      };
    case "lab":
      return {
        bg: "bg-amber-50",
        fg: "text-amber-700",
        label: "text-amber-700",
      };
    case "imaging":
      return {
        bg: "bg-purple-50",
        fg: "text-purple-700",
        label: "text-purple-700",
      };
    case "treatment_cycle":
      return {
        bg: "bg-rose-50",
        fg: "text-rose-700",
        label: "text-rose-700",
      };
    case "medication":
      return {
        bg: "bg-ink-100",
        fg: "text-ink-700",
        label: "text-ink-500",
      };
  }
}

function labelForCategory(c: PathwayCategory, locale: "en" | "zh"): string {
  if (locale === "zh") {
    switch (c) {
      case "appointment":
        return "预约";
      case "clinic_visit":
        return "门诊记录";
      case "memo_visit":
        return "语音记录";
      case "lab":
        return "化验";
      case "imaging":
        return "影像";
      case "treatment_cycle":
        return "化疗周期";
      case "medication":
        return "用药";
    }
  }
  switch (c) {
    case "appointment":
      return "appointment";
    case "clinic_visit":
      return "visit";
    case "memo_visit":
      return "voice memo";
    case "lab":
      return "lab";
    case "imaging":
      return "imaging";
    case "treatment_cycle":
      return "cycle";
    case "medication":
      return "medication";
  }
}

function statusColour(status: string): string {
  switch (status) {
    case "scheduled":
      return "bg-ink-100 text-ink-700";
    case "attended":
      return "bg-emerald-50 text-emerald-700";
    case "missed":
      return "bg-[var(--warn,#d97706)]/12 text-[var(--warn,#d97706)]";
    case "cancelled":
      return "bg-ink-100 text-ink-500";
    case "rescheduled":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-ink-100 text-ink-500";
  }
}

function formatWhen(iso: string, locale: "en" | "zh"): string {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Render time only when the ISO carries a time; date-only ISO
  // (YYYY-MM-DD) parses as midnight which we never want to surface.
  const hasTime = iso.length > 10 && !iso.endsWith("T00:00:00");
  return format(
    d,
    hasTime
      ? locale === "zh"
        ? "M月d日 HH:mm"
        : "d MMM, HH:mm"
      : locale === "zh"
        ? "M月d日"
        : "d MMM",
  );
}
