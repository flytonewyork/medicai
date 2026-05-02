"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import {
  Stethoscope,
  FlaskConical,
  Image as ImageIcon,
  ClipboardList,
  Pill,
  ChevronRight,
  Activity,
} from "lucide-react";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import {
  buildPathway,
  type PathwayCategory,
  type PathwayItem,
} from "~/lib/pathway/build";
import { cn } from "~/lib/utils/cn";

// Recent clinical activity, surfaced inline on the dashboard so it
// shares the single feed instead of living behind a sibling tab. Pulls
// from buildPathway()'s "recent" bucket and excludes appointments
// (already covered by NextClinicCard / ScheduleCard) so the card adds
// new information rather than duplicating other cards.

const MAX_ROWS = 5;

export function ClinicalJourneyCard() {
  const locale = useLocale();

  // Re-derive when any underlying clinical row count changes.
  const labCount = useLiveQuery(() => db.labs.count(), [], 0);
  const imagingCount = useLiveQuery(() => db.imaging.count(), [], 0);
  const cycleCount = useLiveQuery(() => db.treatment_cycles.count(), [], 0);
  const medCount = useLiveQuery(() => db.medications.count(), [], 0);
  const memoCount = useLiveQuery(() => db.voice_memos.count(), [], 0);
  const lifeCount = useLiveQuery(() => db.life_events.count(), [], 0);

  const [rows, setRows] = useState<PathwayItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void buildPathway().then((b) => {
      if (cancelled) return;
      const filtered = b.recent.filter((it) => it.category !== "appointment");
      setRows(filtered.slice(0, MAX_ROWS));
    });
    return () => {
      cancelled = true;
    };
  }, [labCount, imagingCount, cycleCount, medCount, memoCount, lifeCount]);

  if (!rows || rows.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--tide-2)]" />
          <div className="text-[13px] font-semibold text-ink-900">
            {locale === "zh" ? "近期临床动态" : "Recent clinical activity"}
          </div>
          <span className="ml-auto text-[10.5px] text-ink-400">
            {locale === "zh" ? "最近 14 天" : "Last 14 days"}
          </span>
        </div>
        <ul className="space-y-1.5">
          {rows.map((it) => (
            <li key={it.key}>
              <JourneyRow item={it} locale={locale} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function JourneyRow({
  item,
  locale,
}: {
  item: PathwayItem;
  locale: "en" | "zh";
}) {
  const Icon = iconFor(item.category);
  const colour = colourFor(item.category);
  const when = formatWhen(item.at, locale);

  const inner = (
    <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-ink-100/40">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          colour.bg,
          colour.fg,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink-900">
          {item.title}
        </div>
        <div className="truncate text-[11.5px] text-ink-500">
          {when}
          {item.subtitle && ` · ${item.subtitle}`}
        </div>
      </div>
      {item.href && (
        <ChevronRight className="h-3.5 w-3.5 text-ink-400" aria-hidden />
      )}
    </div>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 rounded-md"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function iconFor(c: PathwayCategory) {
  switch (c) {
    case "appointment":
      return Stethoscope;
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

function colourFor(c: PathwayCategory): { bg: string; fg: string } {
  switch (c) {
    case "appointment":
      return { bg: "bg-[var(--tide-2)]/12", fg: "text-[var(--tide-2)]" };
    case "clinic_visit":
    case "memo_visit":
      return { bg: "bg-emerald-50", fg: "text-emerald-700" };
    case "lab":
      return { bg: "bg-amber-50", fg: "text-amber-700" };
    case "imaging":
      return { bg: "bg-purple-50", fg: "text-purple-700" };
    case "treatment_cycle":
      return { bg: "bg-rose-50", fg: "text-rose-700" };
    case "medication":
      return { bg: "bg-ink-100", fg: "text-ink-700" };
  }
}

function formatWhen(iso: string, locale: "en" | "zh"): string {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
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
