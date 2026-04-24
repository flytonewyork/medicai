import type { FeedItem } from "~/types/feed";
import type { LifeEvent } from "~/types/clinical";

// Anniversary resurfacing — turns year-anniversary memories into low-
// priority positive feed items. "One year ago today: Phillip Island
// with Catherine and Thomas."
//
// Deliberately simple rules:
// - Only memory-flagged life events (is_memory === true)
// - Only anniversaries of 1y, 2y, 3y, 5y, 10y
// - Priority 95 (below every clinical item; below tasks; above nothing)
// - Tone "positive" — warm on days that need warm
// - Opt-out via settings.memory_resurface_enabled (handled at the
//   composer layer, not here)

const ANNIVERSARY_YEARS = [1, 2, 3, 5, 10] as const;

export interface MemoryResurfaceInputs {
  todayISO: string;
  life_events: LifeEvent[];
}

export function computeMemoryResurfaceFeedItems(
  inputs: MemoryResurfaceInputs,
): FeedItem[] {
  const today = parseISODate(inputs.todayISO);
  if (!today) return [];
  const items: FeedItem[] = [];

  for (const event of inputs.life_events) {
    if (event.is_memory !== true) continue;
    const eventDate = parseISODate(event.event_date);
    if (!eventDate) continue;
    // Same month & day; year-delta in the allowed set.
    if (eventDate.month !== today.month || eventDate.day !== today.day) {
      continue;
    }
    const delta = today.year - eventDate.year;
    if (!(ANNIVERSARY_YEARS as readonly number[]).includes(delta)) continue;

    items.push({
      id: `memory-resurface:${event.id ?? event.event_date}:${delta}y`,
      priority: 95,
      category: "memory",
      tone: "positive",
      title: {
        en: `${delta} ${delta === 1 ? "year" : "years"} ago today`,
        zh: `${delta} 年前的今天`,
      },
      body: {
        en: event.title,
        zh: event.title,
      },
      cta: {
        href: `/family/timeline#event-${event.id}`,
        label: {
          en: "Open timeline",
          zh: "查看时间线",
        },
      },
      icon: "heart",
      source: "memory_resurface",
    });
  }

  return items;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseISODate(iso: string): DateParts | null {
  if (iso.length < 10) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
}
