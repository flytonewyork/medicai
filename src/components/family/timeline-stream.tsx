"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import {
  buildTimelineStream,
  groupByMonth,
  type TimelineItem,
} from "~/lib/timeline/stream";
import type { LifeEvent } from "~/types/clinical";
import type { Appointment } from "~/types/appointment";
import type { TreatmentCycle } from "~/types/treatment";
import {
  BookOpen,
  Stethoscope,
  Syringe,
  ScanLine,
  Droplet,
  ClipboardList,
  Sparkles,
  Heart,
  MapPin,
  Music,
  Flag,
  ImageIcon,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import { localeTag } from "~/lib/utils/date";

// Chronological, date-grouped, reverse-chrono timeline.
//
// Two rendering tiers:
// - Warm anchors (life events, memories, diary pages) — photo-forward
//   cards with the family-diary voice
// - Clinical spine (completed appointments, cycle start/end) — small
//   date-stamped pills, visually subordinate
//
// This is not a priority feed. The mix is by design: memories land on a
// living timeline next to the clinical reality they happened alongside.
// See docs/LEGACY_MODULE.md §"Render" for framing.

type FilterMode = "all" | "memories";

export function TimelineStream() {
  const locale = useLocale();
  const [filter, setFilter] = useState<FilterMode>("all");

  const lifeEvents = useLiveQuery(() => db.life_events.toArray(), []);
  const appointments = useLiveQuery(() => db.appointments.toArray(), []);
  const cycles = useLiveQuery(() => db.treatment_cycles.toArray(), []);

  const stream = useMemo(() => {
    if (!lifeEvents || !appointments || !cycles) return null;
    return buildTimelineStream({
      life_events: lifeEvents,
      appointments,
      cycles,
      memories_only: filter === "memories",
    });
  }, [lifeEvents, appointments, cycles, filter]);

  const grouped = useMemo(
    () => (stream ? groupByMonth(stream) : null),
    [stream],
  );

  if (!grouped) {
    return (
      <div className="py-8 text-center text-[13px] text-ink-400">
        {locale === "zh" ? "正在加载…" : "Loading…"}
      </div>
    );
  }

  if (grouped.size === 0) {
    return (
      <div className="rounded-[var(--r-md)] border border-dashed border-ink-200 bg-paper-2 p-6 text-center text-[13px] text-ink-500">
        {locale === "zh"
          ? "这里还没有内容。上传一张照片、一段话、一则日记，时间线就会开始展开。"
          : "Nothing here yet. Post a photo, a note, or a diary page and the timeline will begin."}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-[12px]">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={locale === "zh" ? "全部" : "Everything"}
        />
        <FilterChip
          active={filter === "memories"}
          onClick={() => setFilter("memories")}
          label={locale === "zh" ? "只看记忆" : "Memories only"}
        />
      </div>
      {Array.from(grouped.entries()).map(([month, items]) => (
        <section key={month}>
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
            {formatMonth(month, locale)}
          </h3>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={itemKey(item)}>
                {item.kind === "life_event" ? (
                  <LifeEventCard event={item.event} locale={locale} />
                ) : item.kind === "appointment" ? (
                  <ClinicalSpinePill
                    appointment={item.appointment}
                    locale={locale}
                  />
                ) : (
                  <CycleMarker
                    kind={item.kind}
                    cycle={item.cycle}
                    locale={locale}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function itemKey(item: TimelineItem): string {
  return `${item.kind}:${item.id}:${item.at}`;
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
        "rounded-full border px-3 py-1 transition-colors",
        active
          ? "border-ink-900 bg-ink-900 text-paper"
          : "border-ink-200 bg-paper-2 text-ink-600 hover:border-ink-400",
      )}
    >
      {label}
    </button>
  );
}

const CATEGORY_ICON: Record<
  LifeEvent["category"],
  React.ComponentType<{ className?: string }>
> = {
  family: Heart,
  cultural: Flag,
  travel: MapPin,
  practice: Music,
  medical: Stethoscope,
  diary: BookOpen,
  other: Sparkles,
};

function LifeEventCard({
  event,
  locale,
}: {
  event: LifeEvent;
  locale: "en" | "zh";
}) {
  const Icon = CATEGORY_ICON[event.category] ?? Sparkles;
  const mediaCount = useLiveQuery(
    async () =>
      event.id == null
        ? 0
        : db.timeline_media
            .where("[owner_type+owner_id]")
            .equals(["life_event", event.id])
            .count(),
    [event.id],
  );
  return (
    <article className="rounded-[var(--r-md)] border border-ink-100 bg-paper-2 p-4">
      <header className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-ink-500">
        <Icon className="h-3 w-3" />
        <span>{event.category}</span>
        <span className="text-ink-300">·</span>
        <span>{formatDay(event.event_date, locale)}</span>
        {mediaCount && mediaCount > 0 ? (
          <>
            <span className="text-ink-300">·</span>
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {mediaCount}
            </span>
          </>
        ) : null}
      </header>
      <h4 className="text-[15px] font-semibold text-ink-900">{event.title}</h4>
      {event.notes ? (
        <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-700">
          {event.notes}
        </p>
      ) : null}
      {event.author ? (
        <div className="mt-2 text-[11px] text-ink-400">
          {locale === "zh" ? "由 " : "by "}
          <span className="text-ink-600">{event.author}</span>
        </div>
      ) : null}
    </article>
  );
}

const APPT_ICON: Record<
  Appointment["kind"],
  React.ComponentType<{ className?: string }>
> = {
  clinic: Stethoscope,
  chemo: Syringe,
  scan: ScanLine,
  blood_test: Droplet,
  procedure: ClipboardList,
  other: Sparkles,
};

function ClinicalSpinePill({
  appointment,
  locale,
}: {
  appointment: Appointment;
  locale: "en" | "zh";
}) {
  const Icon = APPT_ICON[appointment.kind] ?? Sparkles;
  return (
    <div className="flex items-center gap-2 pl-2 text-[12px] text-ink-500">
      <Icon className="h-3.5 w-3.5 text-ink-400" />
      <span className="font-medium text-ink-600">{appointment.title}</span>
      <span className="text-ink-300">·</span>
      <span>{formatDay(appointment.starts_at, locale)}</span>
    </div>
  );
}

function CycleMarker({
  kind,
  cycle,
  locale,
}: {
  kind: "cycle_start" | "cycle_end";
  cycle: TreatmentCycle;
  locale: "en" | "zh";
}) {
  const label =
    kind === "cycle_start"
      ? locale === "zh"
        ? `周期 ${cycle.cycle_number} 开始`
        : `Cycle ${cycle.cycle_number} started`
      : locale === "zh"
        ? `周期 ${cycle.cycle_number} 结束`
        : `Cycle ${cycle.cycle_number} ended`;
  const date =
    kind === "cycle_start"
      ? cycle.start_date
      : (cycle.actual_end_date ?? cycle.planned_end_date ?? cycle.start_date);
  return (
    <div className="flex items-center gap-2 pl-2 text-[12px] text-ink-500">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-400" />
      <span className="font-medium text-ink-600">{label}</span>
      <span className="text-ink-300">·</span>
      <span>{formatDay(date, locale)}</span>
    </div>
  );
}

function formatMonth(yyyymm: string, locale: "en" | "zh"): string {
  const [y, m] = yyyymm.split("-");
  if (!y || !m) return yyyymm;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(localeTag(locale), {
    month: "long",
    year: "numeric",
  });
}

function formatDay(iso: string, locale: "en" | "zh"): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(localeTag(locale), {
    day: "numeric",
    month: "short",
  });
}
