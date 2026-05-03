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
- **Managing oncologist:** A/Prof Sumitra Ananda (Melbourne)
- **HPB surgeon:** Mark Cullinan (Epworth Richmond)
- **First-line treatment:** gemcitabine + nab-paclitaxel (GnP), optimised for
  function preservation over maximum response
- **Patient values:** continued spiritual practice (Qigong, meditation, Chinese
  spiritual traditions), independence, mental stillness, family connection
- **Strategic goal:** bridge to daraxonrasib via FDA Approval or RASolute 302 (2L, enrollment closing June 2026) or expanded access

## The three-axis framework (CRITICAL conceptual foundation)

ECOG PS is the sum of three independent axes:
1. Tumour burden (scan-measurable)
2. Cancer-driven symptoms (can reverse with response)
3. Treatment-driven toxicity (often irreversible — neuropathy, sarcopenia)

The platform's core job is detecting **axis 3 drift** before it causes permanent PS
decline that breaks trial eligibility. Standard oncology monitors axis 1 (imaging)
and partially axis 2 (symptoms). This platform fills the axis 3 gap.

## Interaction model — single channel in, single channel out

**Scope:** this section governs **the patient's surface only** — what
Hu Lin sees and touches. Carer (Thomas, Catherine), family
(relatives), and clinician surfaces have a different cognitive-load
model and may use direct routes, multiple tabs, dashboards, and
discipline-specific tooling. The single-channel doctrine does not
apply to them and they should not be folded into the patient feed.

The patient sees ONE input and ONE feed. Everything else is hidden.

**Single channel in.** The patient says what's happening — free text, voice,
photo, or quick numeric tap. AI parses, classifies, attributes, and fans
the input out across the multidisciplinary super-brain (function /
toxicity / disease / psychology axes; daily / weekly / fortnightly /
quarterly cadences; nutrition / PT / onc / psych disciplines). The
patient never picks a form, a tab, or a category.

**Hidden super-brain.** Zone engine, change detectors, signal attribution,
medication prompts, treatment engine, axis-state machine, future
discipline plug-ins all run off the same Dexie state. They are
extensions on a typed event bus — adding a new discipline is a new
plug-in, not a new screen. The patient never sees this layer.

**Single channel out.** One feed. Every nudge, alert, trend, prompt,
medication reminder, prep-for-clinic note, and zone change becomes a
ranked feed item. The dashboard is the feed; the feed is the dashboard.
A Red zone alert is a high-priority item in the same channel as a
gentle "you're due for a weekly grip reading" — stack-ranked, not
stashed in a separate card.

**Loop closes through the same channel.** The patient's reaction to a
nudge ("did the gait test, felt fine") is logged through the same
single input. The system updates state and re-ranks the feed.

This collapses the cognitive surface to: tell, see, repeat. The
multidisciplinary depth lives behind it. Any feature that adds a new
top-level form, tab, or screen **for Hu Lin** is going the wrong way
— it should become an input modality on the unified channel and a
ranked item on the unified feed.

**For non-patient surfaces** (Thomas's `/family`, `/care-team`,
`/carers`, `/reports`; clinicians' future export views): the
single-channel rule does NOT apply. Those audiences benefit from
direct routes to specific data, sortable tables, and discipline-
scoped views. Adding a new top-level page for *them* is fine; adding
one for Hu Lin is not.

## Zone logic

Green → Yellow → Orange → Red. Every input triggers zone evaluation. Crossing a
threshold does not automatically change treatment — it triggers a **mandatory
review conversation**. The rule: the conversation is mandatory, the decision is
not predetermined.

## Design principles

1. Local-first then sync to cloud DB. IndexedDB via Dexie.
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

- No general-purpose AI chat ("ask me anything"). AI parses input and
  surfaces context; it does not act as a clinical advisor or chatbot
- No patient-to-patient social features
- No general-purpose health tracking beyond PDAC-relevant
- No prescription/medication dosing calculations
- No diagnostic features
- No integration with hospital EMR (out of scope)
- No multi-patient support (single-patient focus)
- No new top-level screens for the patient. New capability becomes an
  input modality + a feed-item type, not a tab

## Build philosophy

Build vertical slices. Each module should be fully functional (daily tracking
entry + view + trend) before moving to the next. Test the rule engine
obsessively — it's the most important piece of code in the project.

## Project board

All sprint planning, prioritisation, and status tracking lives in the
GitHub Project **"save dads life"** (under `flytonewyork`). Issues
land there automatically via the project's auto-add workflow — the
Issues tab is the data store, the project board is the lens.

When opening a new kanban item, create a regular issue on
`flytonewyork/medicai` using the **Sprint task** template
(`.github/ISSUE_TEMPLATE/sprint-task.yml`). Title format:
`[P0|P1|P2|P3] Sprint N · type · description`. The auto-add
workflow pulls it into the project automatically.

Don't try to manipulate the project directly — the GitHub MCP server
only exposes classic Issues, not the Projects v2 GraphQL surface.

### Trigger model: the LABEL wakes Claude, not the drag

Applying the **`status:in-progress`** label to an issue posts an
`@claude` mention via the workflow at
`.github/workflows/project-board-claude-trigger.yml`. The Claude
Code GitHub App picks up the mention and starts a fresh session
scoped to that issue.

**Important:** dragging a card to the "In Progress" column on the
project board does **NOT** apply the label automatically. GitHub
Projects v2 doesn't natively sync the Status field to a label. To
wake Claude on a card, either:

- **Recommended:** apply the `status:in-progress` label directly on
  the issue (one click in the Issues tab). The board's Status field
  is for visualisation; the label is for automation.
- **Alternative:** run the "Trigger Claude on issue label" workflow
  manually from the Actions tab with an issue number.
- **For drag-on-board UX:** a separate cron workflow could poll the
  project's GraphQL API every 5 min and apply the label when status
  changes. Requires a fine-grained PAT with `read:project`. Not
  configured today; ship it if labelling friction becomes annoying.

### Issue authoring rubric

Cold-start sessions have **zero memory** of any prior chat. Issue
bodies MUST be self-contained. The Sprint task template enforces:

- **Goal** in the first sentence
- **Why this matters** (clinical / strategic — tie to bridge
  strategy, axis-3 detection, or RASolute deadline if relevant)
- **Done when** — concrete checkable criteria
- **Files / modules to touch** if known
- **Links** to docs, related issues, prior PRs, CLAUDE.md sections
- **Decisions needing Thomas / Hu Lin input** — anything the agent
  must NOT decide unilaterally; comment on the issue, don't guess

Avoid "as discussed" / "see chat" / "Thomas mentioned" — the
cold-start session can't see any of that. Phase 0 / 1 / 3a issues
already on the board (#170, #171, #173) are good templates.

## Workflow norms

### Branch + PR conventions

- Develop on a topic branch named `claude/<short-slug>` (the
  trigger workflow + Claude code-review action expect this prefix).
- Open PRs as **draft** by default; promote to ready when CI is
  green and you've self-reviewed.
- PR body: short summary, test plan checklist, `Closes #<n>` or
  `Refs #<n>` linking issues. Auto-close fires on merge when the
  keyword is present.
- Commit messages: rich subject lines + multi-paragraph body
  explaining "why" (existing repo style).

### Chat vs. kanban

- **Chat is for planning, audits, and strategy** — the deliverable
  is *issues created* or *doctrine updated in CLAUDE.md*, never
  code shipped.
- **Kanban is for execution** — the deliverable is a merged PR.
- If a chat session ships code, treat it as a smell. Code via chat
  bypasses the audit trail and parallelism the kanban gives.

### Sub-agents within a session

- Use the **Task** tool to spawn focused sub-agents for parallel
  research (Explore, Plan, code-reviewer, security-review) inside a
  bounded session. Keeps the main agent's context clean.
- Sub-agents are stateless from the caller's perspective; brief
  them like a colleague who just walked into the room.

### Known traps (don't re-introduce)

- **Self-recursive RLS policies** cause "infinite recursion detected
  in policy" 500s. Patterns like `USING (X IN (SELECT X FROM
  same_table WHERE auth.uid() = ...))` are forbidden. Use a
  `SECURITY DEFINER` helper instead — see `is_household_member` /
  `is_household_admin` (defined in
  `2026_05_02_fix_rls_recursion`).
- **Storage buckets are created via SQL migration**, not config. A
  missing bucket silently 400s every upload — the `voice-memos`
  bucket was undefined for months until
  `2026_05_02_voice_memos_bucket`.
- **`projects_v2_item` is NOT a valid `on:` trigger** for repo
  workflows. Only org-level workflows in the org's `.github` repo
  accept it. Bridge user-owned projects via labels or a cron sync.
- **Workflow `permissions` must include `pull-requests: write`**
  when posting comments — the issues comments endpoint is shared
  with PRs and rejects PR-numbered targets without it. Header
  proof: `x-accepted-github-permissions: issues=write;
  pull_requests=write`.
- **The repo Workflow Permissions setting** (Settings → Actions →
  General) must be "Read and write permissions" — the
  `permissions:` block can't grant above the repo cap.
- **Sync queue must persist to Dexie** (`sync_queue` table, v26),
  not just in memory — the original in-memory queue dropped writes
  on every tab close (PR #164).
- **Bootstrap auto-create profile + household** for offline-
  onboarded users. If `settings.onboarded_at` is set but no
  household exists, the patient logs into a void
  (`bootstrapHouseholdAndProfile()` in `src/lib/sync/bootstrap.ts`).

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
3. `docs/DATA_SCHEMA.md` — includes the "Sync semantics" section
   (last-write-wins, single-active-editor assumption).
4. `docs/ZONE_RULES.md`
5. `docs/BUILD_ORDER.md`
6. `docs/LEGACY_MODULE.md` — required only when touching family timeline,
   profile entries, the biographer or orchestrator agents, or any capture
   modality described in that doc's feature set.
7. `docs/AI_SURFACES.md` — required only when touching any
   `src/agents/`, `src/lib/ai/`, `src/lib/ingest/`, `src/lib/nudges/`,
   or `src/app/api/ai/*` / `src/app/api/agent/*` route.

Always prefer to ask a clarifying question if clinical logic is ambiguous. Do not
invent thresholds or rules not specified in the framework docs.
