# Anchor — Claude Code Context

## Project purpose

Anchor is a personal medical function-tracking platform for Hu Lin, a patient with
metastatic pancreatic ductal adenocarcinoma (mPDAC). It operationalises a specific
clinical strategy called the "bridge strategy": preserving functional reserve and
ECOG performance status during first-line chemotherapy (gemcitabine + nab-paclitaxel)
in order to maintain eligibility for daraxonrasib (RMC-6236), a novel RAS(ON)
inhibitor that has just shown a hazard ratio of 0.40 for mortality in the Phase 3
RASolute 302 trial (readout April 2026).

## Clinical context you must know

- **Patient:** Hu Lin, father of the primary user (Thomas Hu, MBBS, the project owner)
- **Diagnosis:** confirmed metastatic PDAC
- **Managing oncologist:** Dr Michael Lee (Melbourne)
- **HPB surgeon:** Mark Cullinan (Epworth Richmond)
- **First-line treatment:** gemcitabine + nab-paclitaxel (GnP), optimised for
  function preservation over maximum response
- **Patient values:** continued spiritual practice (Qigong, meditation, Chinese
  spiritual traditions), independence, mental stillness, family connection
- **Strategic goal:** bridge to daraxonrasib via RASolute 303 (1L trial, now
  enrolling) or RASolute 302 (2L, enrollment closing June 2026) or expanded access

## The three-axis framework (CRITICAL conceptual foundation)

ECOG PS is the sum of three independent axes:
1. Tumour burden (scan-measurable)
2. Cancer-driven symptoms (can reverse with response)
3. Treatment-driven toxicity (often irreversible — neuropathy, sarcopenia)

The platform's core job is detecting **axis 3 drift** before it causes permanent PS
decline that breaks trial eligibility. Standard oncology monitors axis 1 (imaging)
and partially axis 2 (symptoms). This platform fills the axis 3 gap.

## Zone logic

Green → Yellow → Orange → Red. Every input triggers zone evaluation. Crossing a
threshold does not automatically change treatment — it triggers a **mandatory
review conversation**. The rule: the conversation is mandatory, the decision is
not predetermined.

## Design principles

1. Local-first always. IndexedDB via Dexie. No cloud, no server, no PHI leaves
   the device for MVP. Phase 2 may add encrypted sync.
2. Bilingual (English + Simplified Chinese). All patient-facing copy. Clinical
   terminology may remain English in reports.
3. Mobile-first for daily tracking. Desktop-first for analytical dashboards.
4. Minimise cognitive load on tired days. Daily check-in must complete in
   under 2 minutes with large tap targets.
5. Trends over points. Single values are noise. 7-day and 28-day moving
   averages are signal.
6. Function is the endpoint, not response. The platform is biased toward
   surfacing function decline, not celebrating scan response.
7. Respect the patient's values in UX tone. No cheerful language. Measured,
   respectful, honest.

## What NOT to build (scope discipline)

- No AI chat in MVP (phase 2)
- No patient-to-patient social features
- No general-purpose health tracking beyond PDAC-relevant
- No prescription/medication dosing calculations
- No diagnostic features
- No integration with hospital EMR (out of scope)
- No multi-patient support (single-patient focus)

## Build philosophy

Build vertical slices. Each module should be fully functional (daily tracking
entry + view + trend) before moving to the next. Test the rule engine
obsessively — it's the most important piece of code in the project.

## Commands

- `pnpm dev` — local development
- `pnpm test` — unit tests
- `pnpm test:e2e` — Playwright E2E
- `pnpm build` — production build
- `pnpm lint` — linting
- `pnpm typecheck` — TypeScript checking

## Before you write code

Read, in order:
1. `docs/CLINICAL_FRAMEWORK.md`
2. `docs/BRIDGE_STRATEGY.md`
3. `docs/DATA_SCHEMA.md`
4. `docs/ZONE_RULES.md`
5. `docs/BUILD_ORDER.md`

Always prefer to ask a clarifying question if clinical logic is ambiguous. Do not
invent thresholds or rules not specified in the framework docs.
