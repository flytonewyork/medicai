import type {
  BiographicalOutline,
  MemoryCluster,
  ProfileEntry,
} from "~/types/legacy";
import type { EnteredBy } from "~/types/clinical";
import type { FeedItem } from "~/types/feed";
import { nowISO } from "~/lib/utils/date";

// Biographer — deterministic layer.
//
// The biographer agent has two layers in this module's design:
//   1. Deterministic curation (this file): cluster detection, outline
//      coverage, cross-perspective propagation. Runs client-side,
//      no LLM call, unit-tested.
//   2. Generative curation (future): a role.md-driven LLM pass that
//      writes a living biographer_state.md — a structured character
//      sketch with citations. Ships in a later slice when the agent
//      runtime is ready to absorb it.
//
// This file is (1). The outputs are stable, testable, and cheap.

// ── Cluster detection ──────────────────────────────────────────────

export interface ClusterMatchInput {
  /** The freshly-created entry we're evaluating. */
  entry: ProfileEntry;
  /** Existing clusters to match against. */
  clusters: MemoryCluster[];
  /**
   * Approximate-date window in days. Two entries within this window and
   * sharing at least one person-name are treated as the same cluster.
   * Default: 3.
   */
  day_window?: number;
}

export type ClusterMatch =
  | { kind: "existing"; cluster_id: number; cluster: MemoryCluster }
  | { kind: "new_candidate"; seed: Pick<MemoryCluster, "title" | "people_mentioned" | "household_members_involved" | "approximate_date"> }
  | { kind: "not_memory_shaped" };

/**
 * Evaluate whether a new entry should join an existing cluster, start a
 * new one, or be left alone. Memory-shape rules: the entry must have at
 * least one person mentioned, and the entry kind must be one that can
 * anchor a cluster (stories, photos, videos, voice memos, quotes).
 */
export function detectClusterCandidate(
  input: ClusterMatchInput,
): ClusterMatch {
  const { entry, clusters } = input;
  const windowDays = input.day_window ?? 3;

  const people = normaliseNames(entry.people_mentioned ?? []);
  const household = entry.household_members_mentioned ?? [];
  const anchorable = new Set([
    "story",
    "photo",
    "video",
    "voice_memo",
    "quote",
  ]);
  if (!anchorable.has(entry.kind)) return { kind: "not_memory_shaped" };
  if (people.length === 0 && household.length === 0) {
    return { kind: "not_memory_shaped" };
  }

  const entryDate = entry.recorded_at.slice(0, 10);

  for (const c of clusters) {
    if (c.id == null) continue;
    const sharedPeople = intersect(normaliseNames(c.people_mentioned), people);
    const sharedHousehold = intersect(c.household_members_involved, household);
    if (sharedPeople.length === 0 && sharedHousehold.length === 0) continue;
    if (!withinDateWindow(c, entryDate, windowDays)) continue;
    return { kind: "existing", cluster_id: c.id, cluster: c };
  }

  // Otherwise propose a fresh cluster seeded by this entry.
  return {
    kind: "new_candidate",
    seed: {
      title: entry.title ?? "Untitled memory",
      people_mentioned: entry.people_mentioned ?? [],
      household_members_involved: entry.household_members_mentioned ?? [],
      approximate_date: entryDate,
    },
  };
}

function intersect<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

function normaliseNames(names: string[]): string[] {
  return names.map((n) => n.trim().toLowerCase()).filter(Boolean);
}

function withinDateWindow(
  cluster: MemoryCluster,
  entryDate: string,
  windowDays: number,
): boolean {
  const targets = [
    cluster.approximate_date,
    cluster.approximate_date_start,
    cluster.approximate_date_end,
  ].filter((x): x is string => typeof x === "string");
  if (targets.length === 0) return true; // cluster has no date — accept
  const entryTime = Date.parse(entryDate);
  if (!Number.isFinite(entryTime)) return false;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return targets.some((t) => {
    const tt = Date.parse(t.length === 10 ? t : t.slice(0, 10));
    if (!Number.isFinite(tt)) return false;
    return Math.abs(entryTime - tt) <= windowMs;
  });
}

// ── Cross-perspective propagation ──────────────────────────────────

export interface PropagationInput {
  seed_entry: ProfileEntry;
  cluster: MemoryCluster;
  /** Household roster. Used to filter who's eligible to receive a prompt. */
  household: EnteredBy[];
}

/**
 * Emit feed items inviting each involved household member (other than
 * the author) to add their perspective. Skipped entirely when the seed
 * entry is `private_to_author` or when `cluster.propagate === false`.
 */
export function emitPropagationPrompts(
  input: PropagationInput,
): FeedItem[] {
  const { seed_entry, cluster, household } = input;
  if (seed_entry.private_to_author) return [];
  if (seed_entry.visibility === "private") return [];
  if (!cluster.propagate) return [];

  const recipients = cluster.household_members_involved.filter(
    (m) => m !== seed_entry.author && household.includes(m),
  );

  return recipients.map<FeedItem>((recipient) => ({
    id: `cross_perspective_prompt:${cluster.id ?? "new"}:${recipient}`,
    priority: 93,
    category: "memory",
    tone: "positive",
    title: {
      en: "Something you might have a piece of",
      zh: "这件事您或许也有一份",
    },
    body: {
      en: `${prettyAuthor(seed_entry.author)} just shared a memory about "${cluster.title}". Would you like to add your side, or any photos?`,
      zh: `${prettyAuthor(seed_entry.author)}刚刚分享了一段关于"${cluster.title}"的记忆。您愿意补充您的角度,或者添一张照片吗?`,
    },
    cta: {
      href: `/family/legacy/cluster/${cluster.id ?? ""}`,
      label: {
        en: "Open the cluster",
        zh: "打开这段记忆",
      },
    },
    icon: "chat",
    source: "cross_perspective_prompt",
  }));
}

function prettyAuthor(author: EnteredBy): string {
  switch (author) {
    case "hulin":
      return "Dad";
    case "catherine":
      return "Catherine";
    case "thomas":
      return "Thomas";
    case "jonalyn":
      return "Jonalyn";
    case "clinician":
      return "The care team";
  }
}

// ── Outline coverage ───────────────────────────────────────────────

export interface CoverageInput {
  outline: BiographicalOutline[];
  entries: ProfileEntry[];
  /** Tag-to-chapter mapping; an entry counts toward every chapter whose
   * name appears in its tags (case-insensitive match). */
  chapter_tags?: Record<string, string[]>;
}

/**
 * Recompute coverage per chapter + per household member, based on the
 * current set of entries. Returns the updated outline rows (new values
 * for coverage + family_coverage, same ids).
 */
export function recomputeOutlineCoverage(
  input: CoverageInput,
): BiographicalOutline[] {
  const tagMap = input.chapter_tags ?? {};

  return input.outline.map((row) => {
    const chapterTags = new Set(
      (tagMap[row.chapter] ?? [row.chapter.toLowerCase()]).map((t) =>
        t.toLowerCase(),
      ),
    );
    const matching = input.entries.filter((e) =>
      e.tags.some((t) => chapterTags.has(t.toLowerCase())),
    );
    const byAuthor = {
      hulin: 0,
      catherine: 0,
      thomas: 0,
    };
    for (const e of matching) {
      if (e.author === "hulin") byAuthor.hulin++;
      else if (e.author === "catherine") byAuthor.catherine++;
      else if (e.author === "thomas") byAuthor.thomas++;
    }
    // Target thresholds per target_depth — these are soft targets used
    // only to compute the 0..1 coverage scalar. Real chapters may fill
    // beyond 1.0 in entry count; the value is clamped.
    const target =
      row.target_depth === "essential"
        ? 5
        : row.target_depth === "rich"
          ? 10
          : 3;
    const coverage = Math.min(1, matching.length / target);
    const family_coverage = {
      hulin: Math.min(1, byAuthor.hulin / Math.max(1, target / 2)),
      catherine: Math.min(1, byAuthor.catherine / Math.max(1, target / 3)),
      thomas: Math.min(1, byAuthor.thomas / Math.max(1, target / 3)),
    };
    return {
      ...row,
      coverage,
      family_coverage,
      linked_entries: matching
        .map((e) => e.id ?? 0)
        .filter((id) => id > 0),
      updated_at: nowISO(),
    };
  });
}
