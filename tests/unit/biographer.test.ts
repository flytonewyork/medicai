import { describe, it, expect } from "vitest";
import {
  detectClusterCandidate,
  emitPropagationPrompts,
  recomputeOutlineCoverage,
} from "~/lib/legacy/biographer";
import type {
  BiographicalOutline,
  MemoryCluster,
  ProfileEntry,
} from "~/types/legacy";

function entry(overrides: Partial<ProfileEntry> = {}): ProfileEntry {
  return {
    id: 1,
    kind: "story",
    language: "en",
    recorded_at: "2026-04-24T09:00:00",
    author: "hulin",
    entry_mode: "first_person_subject",
    visibility: "family",
    propagate: true,
    tags: [],
    created_at: "2026-04-24T09:00:00",
    updated_at: "2026-04-24T09:00:00",
    ...overrides,
  };
}

function cluster(overrides: Partial<MemoryCluster> = {}): MemoryCluster {
  return {
    id: 100,
    title: "Rotorua 1998",
    people_mentioned: ["Catherine", "Thomas"],
    household_members_involved: ["catherine", "thomas"],
    propagate: true,
    seed_entry_id: 1,
    created_by: "hulin",
    created_at: "2026-04-01",
    updated_at: "2026-04-01",
    approximate_date: "2026-04-23",
    ...overrides,
  };
}

describe("detectClusterCandidate", () => {
  it("matches an existing cluster by shared people + date window", () => {
    const result = detectClusterCandidate({
      entry: entry({
        title: "The bright lakes",
        people_mentioned: ["Catherine"],
        recorded_at: "2026-04-24T10:00:00",
      }),
      clusters: [cluster({ approximate_date: "2026-04-23" })],
    });
    expect(result.kind).toBe("existing");
    if (result.kind === "existing") {
      expect(result.cluster_id).toBe(100);
    }
  });

  it("matches by household member even without free-text name", () => {
    const result = detectClusterCandidate({
      entry: entry({
        household_members_mentioned: ["catherine"],
        recorded_at: "2026-04-24T10:00:00",
      }),
      clusters: [cluster({ approximate_date: "2026-04-23" })],
    });
    expect(result.kind).toBe("existing");
  });

  it("proposes a new cluster when no match on people/date", () => {
    const result = detectClusterCandidate({
      entry: entry({
        title: "Dad's first apprenticeship",
        people_mentioned: ["Uncle Wei"],
        recorded_at: "1972-06-01T09:00:00",
      }),
      clusters: [cluster()],
    });
    expect(result.kind).toBe("new_candidate");
    if (result.kind === "new_candidate") {
      expect(result.seed.title).toBe("Dad's first apprenticeship");
      expect(result.seed.approximate_date).toBe("1972-06-01");
    }
  });

  it("rejects entries with no people mentioned", () => {
    const result = detectClusterCandidate({
      entry: entry({ people_mentioned: [], household_members_mentioned: [] }),
      clusters: [cluster()],
    });
    expect(result.kind).toBe("not_memory_shaped");
  });

  it("rejects non-anchor entry kinds like 'value' or 'opinion'", () => {
    const result = detectClusterCandidate({
      entry: entry({
        kind: "value",
        people_mentioned: ["Catherine"],
      }),
      clusters: [],
    });
    expect(result.kind).toBe("not_memory_shaped");
  });

  it("respects day_window override", () => {
    const result = detectClusterCandidate({
      entry: entry({
        people_mentioned: ["Catherine"],
        recorded_at: "2026-04-30T09:00:00", // 7 days from cluster
      }),
      clusters: [cluster({ approximate_date: "2026-04-23" })],
      day_window: 3,
    });
    expect(result.kind).not.toBe("existing");
    const loose = detectClusterCandidate({
      entry: entry({
        people_mentioned: ["Catherine"],
        recorded_at: "2026-04-30T09:00:00",
      }),
      clusters: [cluster({ approximate_date: "2026-04-23" })],
      day_window: 10,
    });
    expect(loose.kind).toBe("existing");
  });
});

describe("emitPropagationPrompts", () => {
  it("emits one prompt per involved household member, excluding author", () => {
    const items = emitPropagationPrompts({
      seed_entry: entry({ author: "hulin" }),
      cluster: cluster({
        household_members_involved: ["catherine", "thomas", "hulin"],
      }),
      household: ["hulin", "catherine", "thomas"],
    });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id).sort()).toEqual([
      "cross_perspective_prompt:100:catherine",
      "cross_perspective_prompt:100:thomas",
    ]);
  });

  it("emits nothing when entry is private_to_author", () => {
    const items = emitPropagationPrompts({
      seed_entry: entry({ private_to_author: true }),
      cluster: cluster(),
      household: ["hulin", "catherine", "thomas"],
    });
    expect(items).toHaveLength(0);
  });

  it("emits nothing when entry visibility is private", () => {
    const items = emitPropagationPrompts({
      seed_entry: entry({ visibility: "private" }),
      cluster: cluster(),
      household: ["hulin", "catherine", "thomas"],
    });
    expect(items).toHaveLength(0);
  });

  it("emits nothing when cluster.propagate=false", () => {
    const items = emitPropagationPrompts({
      seed_entry: entry(),
      cluster: cluster({ propagate: false }),
      household: ["hulin", "catherine", "thomas"],
    });
    expect(items).toHaveLength(0);
  });

  it("filters recipients not present in current household roster", () => {
    const items = emitPropagationPrompts({
      seed_entry: entry({ author: "hulin" }),
      cluster: cluster({
        household_members_involved: ["catherine", "thomas"],
      }),
      household: ["hulin", "catherine"], // thomas left the household view
    });
    expect(items).toHaveLength(1);
  });
});

describe("recomputeOutlineCoverage", () => {
  function outlineRow(
    chapter: string,
    overrides: Partial<BiographicalOutline> = {},
  ): BiographicalOutline {
    return {
      id: 1,
      chapter,
      arc_position: 1,
      target_depth: "rich",
      coverage: 0,
      family_coverage: { hulin: 0, catherine: 0, thomas: 0 },
      linked_entries: [],
      open_prompts: [],
      updated_at: "2026-01-01",
      ...overrides,
    };
  }

  it("fills coverage toward target as matching entries accumulate", () => {
    const out = recomputeOutlineCoverage({
      outline: [outlineRow("origins", { target_depth: "essential" })],
      entries: [
        entry({ id: 1, author: "hulin", tags: ["origins"] }),
        entry({ id: 2, author: "hulin", tags: ["origins"] }),
      ],
    });
    // target_depth essential = 5 required for 1.0; 2/5 = 0.4
    expect(out[0]?.coverage).toBeCloseTo(0.4);
    expect(out[0]?.linked_entries.sort()).toEqual([1, 2]);
  });

  it("computes per-author coverage independently", () => {
    const out = recomputeOutlineCoverage({
      outline: [outlineRow("love", { target_depth: "rich" })],
      entries: [
        entry({ id: 1, author: "hulin", tags: ["love"] }),
        entry({ id: 2, author: "hulin", tags: ["love"] }),
        entry({ id: 3, author: "catherine", tags: ["love"] }),
      ],
    });
    // rich = 10; hulin target half = 5 → hulin 2/5 = 0.4
    expect(out[0]?.family_coverage.hulin).toBeCloseTo(0.4);
    // catherine target third = 3.33 → 1/3.33 ≈ 0.3
    expect(out[0]?.family_coverage.catherine).toBeGreaterThan(0.2);
    expect(out[0]?.family_coverage.thomas).toBe(0);
  });

  it("clamps coverage to 1.0", () => {
    const out = recomputeOutlineCoverage({
      outline: [outlineRow("origins", { target_depth: "optional" })],
      entries: Array.from({ length: 20 }, (_, i) =>
        entry({ id: i + 1, author: "hulin", tags: ["origins"] }),
      ),
    });
    expect(out[0]?.coverage).toBe(1);
    expect(out[0]?.family_coverage.hulin).toBe(1);
  });

  it("ignores entries tagged with other chapters", () => {
    const out = recomputeOutlineCoverage({
      outline: [outlineRow("origins")],
      entries: [
        entry({ id: 1, tags: ["career"] }),
        entry({ id: 2, tags: ["love"] }),
      ],
    });
    expect(out[0]?.coverage).toBe(0);
    expect(out[0]?.linked_entries).toEqual([]);
  });
});
