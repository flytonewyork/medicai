# AI surfaces

A short tour of where Claude is invoked from inside Anchor and what
each surface is responsible for. Cross-referenced from `CLAUDE.md`'s
"Before you write code" list — read this if you're touching anything
under `src/agents/`, `src/lib/ai/`, `src/app/api/ai/*`, or
`src/app/api/agent/*`.

## Three layers, one model

```
    /log surface (single channel in)
           │
           ▼
   ┌──────────────────────────┐
   │  src/lib/ai/             │   stateless prompt helpers
   │  src/lib/ingest/         │   parser + schema modules
   │  src/lib/nudges/         │   feed-narrative composer
   └──────────────────────────┘
           │
           ▼
   ┌──────────────────────────┐
   │  src/app/api/ai/*        │   Edge HTTP — auth gate + Anthropic SDK
   │  src/app/api/agent/[id]  │   per-discipline specialist runner
   └──────────────────────────┘
           │
           ▼
   ┌──────────────────────────┐
   │  src/agents/<id>/        │   stateful per-discipline specialists
   │    role.md (system)      │   (templated against household_profile
   │    schema.ts (output)    │    at request time — no patient
   │                          │    identity baked in)
   └──────────────────────────┘
           │
           ▼
   feed (single channel out)
```

## `src/agents/`

The multidisciplinary "super-brain". Each subdirectory is one
specialist:

  - `clinical/` — labs, tumour markers, imaging, pending results.
  - `nutrition/` — weight, protein, PERT, hydration.
  - `rehabilitation/` — grip, gait, sit-to-stand, axis-3 drift.
  - `psychology/` — mood, sleep, spiritual practice, family connection.
  - `toxicity/` — neuropathy, mucositis, GI, nadir-window watch.
  - `treatment/` — cycle position, dose intensity, infusion logistics.

Each agent owns:

  - `role.md` — the system prompt. Loaded by `src/agents/run.ts` at
    request time and rendered against the per-household identity
    envelope (`{patient_initials}` / `{diagnosis_short}` /
    `{diagnosis_full}` / `{oncologist_name}` / `{surgeon_name}`).
    Don't bake patient names into role.md — they belong on the
    `household_profile` row.
  - `schema.ts` (top-level `src/agents/schema.ts`) — the
    `AgentOutput` shape Claude must return.

Agents are batch-stateful: every run reads `agent_states` (the agent's
current `state.md`), produces a `daily_report` + `state_diff`, and
the runner persists both.

## `src/lib/ai/`, `src/lib/ingest/`, `src/lib/nudges/`

Stateless prompt helpers. Each exports a `buildXxxSystem(profile)`
function that interpolates the household profile into a system prompt
template:

  - `src/lib/ai/coach.ts` — `buildCoachSystem`, `buildSummarySystem`
    (the comprehensive-assessment wizard chat / summariser).
  - `src/lib/ingest/draft-schema.ts` — `buildIngestSystem` (universal
    medical-document ingest).
  - `src/lib/ingest/meal-vision.ts` — `buildMealSystem` (meal-photo
    estimator).
  - `src/lib/ingest/notes-vision.ts` — `buildNotesSystem` (handwritten
    journal-page transcription + structuring).
  - `src/lib/nutrition/parser-schema.ts` — `buildNutritionSystem`
    (meal description parser).
  - `src/lib/nudges/ai-narrative.ts` — `buildNarrativeSystem` (feed
    opener composer).

These modules export the corresponding zod schema for the structured
output too. The route handlers below wire them to the SDK.

## `src/app/api/ai/*`, `src/app/api/agent/[id]/*`

The HTTP edge. Every route follows the same shape:

```ts
export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.error;            // 401 if not signed in

  const gate = getAnthropicClient();
  if (gate.error) return gate.error;          // 503 if no API key

  const body = await readJsonBody(req);
  if (body.error) return body.error;          // 400 on bad JSON

  const profile = await loadHouseholdProfile(auth.session.household_id);
  // ... call gate.client.messages.parse / .create
  // wrapping any user-supplied free text via wrapUserInput / wrapUserInputBlock
}
```

Conventions:

  1. **Auth.** `requireSession()` (in `src/lib/auth/require-session.ts`)
     reads the Supabase session cookie and rejects unauthenticated
     callers with `401 unauthenticated`. Local-only Dexie writes from
     anonymous users still work — the gate is server-side only.
  2. **Identity envelope.** `loadHouseholdProfile()` fetches the
     household_profile row; routes pass it to the `buildXxxSystem`
     helpers. Never inline patient identity into a prompt.
  3. **Prompt-injection mitigation.** Wrap any user-supplied free
     text via `wrapUserInput()` / `wrapUserInputBlock()` from
     `src/lib/anthropic/wrap-user-input.ts`. The `<user_input>`
     delimiter signals to Claude that the content is data, not
     instructions.
  4. **Structured output.** Use `messages.parse({...})` with
     `output_config: { format: jsonOutputFormat(<zod schema>) }` so
     Claude's response lands as a typed `parsed_output` object. See
     `src/lib/anthropic/json-output.ts`.
  5. **Caching.** System prompts use `cache_control: { type:
     "ephemeral" }` so identical prompts (most are identical across
     calls) hit the prompt cache.

## Agent runner

`src/agents/run.ts` is the single code path for every specialist run
— daily-batch and on-demand. It:

  - Loads `role.md` and renders identity tokens.
  - Pulls the agent's current `state.md` from Dexie (caller responsibility).
  - Formats referrals, wrapping each `text` field in `<user_input>`.
  - Calls Claude with the schema in `src/agents/schema.ts`.
  - Returns `AgentOutput`; the caller persists `agent_runs` + the
    next `state.md`.

## Cron / push

`src/app/api/cron/morning-digest/route.ts` and `src/app/api/push/*`
do not invoke Claude. They are auth-gated separately (the cron uses
`x-vercel-cron` + `CRON_SECRET`; push uses the Supabase session) and
sit outside this surface map.
