import type {
  ShortlistDiff,
  ShortlistSnapshot,
  ShortlistSnapshotTrial,
} from "./types";

// Compares two monitor snapshots and returns the operator-facing
// delta. On the first run (`prev` is null), every next-trial counts
// as new. Used by the trial-monitor subagent to report what changed.

export function diffShortlistSnapshots(
  prev: ShortlistSnapshot | null,
  next: ShortlistSnapshot,
): ShortlistDiff {
  if (!prev) {
    return {
      new_trials: next.trials,
      closed_trials: [],
      status_changes: [],
      site_changes: [],
      unchanged_count: 0,
    };
  }

  const prevByNct = new Map<string, ShortlistSnapshotTrial>(
    prev.trials.map((t) => [t.nct_id, t]),
  );
  const nextByNct = new Map<string, ShortlistSnapshotTrial>(
    next.trials.map((t) => [t.nct_id, t]),
  );

  const new_trials = next.trials.filter((t) => !prevByNct.has(t.nct_id));
  const closed_trials = prev.trials.filter((t) => !nextByNct.has(t.nct_id));

  const status_changes: ShortlistDiff["status_changes"] = [];
  const site_changes: ShortlistDiff["site_changes"] = [];
  let unchanged_count = 0;

  for (const t of next.trials) {
    const p = prevByNct.get(t.nct_id);
    if (!p) continue;
    const statusChanged = p.overall_status !== t.overall_status;
    const sitesChanged = p.au_site_count !== t.au_site_count;
    if (statusChanged) {
      status_changes.push({
        nct_id: t.nct_id,
        from: p.overall_status,
        to: t.overall_status,
      });
    }
    if (sitesChanged) {
      site_changes.push({
        nct_id: t.nct_id,
        from: p.au_site_count,
        to: t.au_site_count,
      });
    }
    if (!statusChanged && !sitesChanged) unchanged_count++;
  }

  return {
    new_trials,
    closed_trials,
    status_changes,
    site_changes,
    unchanged_count,
  };
}
