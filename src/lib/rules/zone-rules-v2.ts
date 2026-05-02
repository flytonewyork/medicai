// V2 rule set. During the analytical-layer rollout (Sprint 2 Phase 2-5)
// this evaluates in shadow alongside V1 — its alerts go to
// `zone_alerts_shadow`, not `zone_alerts`, so the patient feed is
// unaffected while we tune V2 against Hu Lin's actual history.
//
// Phase 2 (now): export V1 verbatim so we can prove the dual-write
// plumbing produces zero divergence in the diff view.
//
// Phase 3 (next): replace individual axis-3 rules with versions that
// consume `analytical-helpers.ts` for cycle-aware drift detection.
//
// Phase 5 (after Thomas signs off): `ZONE_RULES_V2` becomes the live
// `ZONE_RULES`; this file becomes the source of truth and the legacy
// V1 rule list is retained briefly as `zone-rules.legacy.ts` for one
// cycle of sanity comparison, then removed.
import type { ZoneRule } from "./types";
import { ZONE_RULES } from "./zone-rules";

// Verbatim re-export at Phase 2. Diverges in Phase 3 as individual
// rules migrate to chronicSlope / residualBelowExpected /
// chronicMeanResidual.
export const ZONE_RULES_V2: readonly ZoneRule[] = ZONE_RULES;
