import type { FeedItem } from "~/types/feed";
import type { CoverageGap } from "~/types/coverage";

// Convert detector gaps to feed items. Stays a thin shim because the
// gap shape is already feed-friendly — keeps the coverage detector
// independent of the FeedItem type so it stays trivially testable.
export function coverageGapsToFeedItems(
  gaps: readonly CoverageGap[],
): FeedItem[] {
  return gaps.map((g) => ({
    id: g.id,
    priority: g.priority,
    category: "coverage",
    tone: "info",
    title: g.title,
    body: g.body,
    cta: { href: g.cta_href, label: { en: "Log", zh: "记录" } },
    icon: g.icon,
    source: `coverage:${g.field_key}`,
    meta: { kind: "coverage", field_key: g.field_key, why: g.why },
  }));
}
