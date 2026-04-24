# Legacy Module — Family Timeline + AI Biographer

Canonical spec for the family timeline and Legacy biographer module.
Required reading before writing code that touches family-facing surfaces,
profile entries, the biographer or orchestrator agents, or any of the
capture modalities described in the feature set below.

## Purpose

A family-facing timeline and AI biographer that turns the illness period
into a healing arc of mutual discovery for Hu Lin and his family, and that
assembles the richest possible record of his life and voice while recall
is strong. The module captures and organises; it does not produce a
companion in this app.

## Framing

This is **relational healing, not archival**. Three tracks run in parallel:

- **About Dad** — biography, voice, stories, values
- **About our relationship with Dad** — per-dyad thread for each family
  member
- **About ourselves** — each family member's own reflection on what this
  journey is teaching them

The module is a drawn-out, evidence-grounded life-review practice
disguised as a warm family diary. Positivity is prioritised; obligation
language is absent; every surface is skippable. The tone rules below are
non-negotiable.

## Evidence base

Each confirmed prompt in the library carries a source tag mapping back to
one of these frameworks:

- **Dignity Therapy** (Chochinov, 2005) — structured generativity
  interview validated for advanced cancer; produces a generativity
  document for family
- **Meaning-Centered Psychotherapy** (Breitbart) — meaning-making in
  advanced cancer; for Dad and for family members
- **Family Focused Grief Therapy** (Kissane) — family unit as the
  subject of intervention
- **Butler's Life Review Therapy** (1963) — systematic chapter-by-chapter
  life recall as therapeutic modality; reduces depression and increases
  sense of meaning in late life
- **Narrative Medicine** (Charon) — witnessing and being witnessed
- **Pennebaker expressive writing** — validated 15–20 min reflective
  writing protocol; mental health benefits for grief and stress
- **Boss's Ambiguous Loss framework** — the grief of living with
  someone dying; grounds the caregiver-reflection side
- **Chinese 回忆录** (memoir) and **家谱** (family genealogy) traditions
  — cultural antecedents; honoured throughout in bilingual EN / ZH copy

## Design principles

- **Single channel in, one feed** still holds for the patient. Family has
  its own surfaces (`/family/timeline`, `/family/legacy`) and its own
  feed items.
- **Visibility default: family.** Opt-in to Dad-only. Tap to private.
  The module is relationally open by default; private is first-class,
  never apologetic.
- **Propagation on by default** for family-visible memories.
  Cross-perspective prompts fire when a memory involves other household
  members.
- **Tone rules**
  - No streaks, counters, progress bars, or "you haven't reflected in N
    days" nudges
  - "Something small — when you have a moment" language
  - Always skippable; always "another one" available; always
    "save for later"
  - No cheerful language; no emoji; no celebratory tone
- **Pace** — months-long life-review arc, not daily interview pressure.
  Chapters sequenced Butler-style with lightness interleaved.
- **Zone-aware cadence** — heavy prompts pause when zone is Orange or Red;
  lightness category weight increases under stress.
- **Historic visibility** — evaluated against the household roster at the
  time of authoring. Newly added family members see only memories
  authored after they joined unless explicitly re-shared.
- **Private-to-author flag per entry** — zero propagation, visible only
  to the author.
- **Consent to be propagated-to** — each family member can opt out of
  being auto-prompted about other people's memories.

## Architecture

### Agents

- **`biographer`** (renamed from earlier `archivist`): curator,
  cluster detector, cross-perspective propagator, biographical-outline
  maintainer. On every new entry, evaluates cluster candidacy, attaches
  or seeds a cluster, and emits cross-perspective feed items to
  involved household members.
- **`orchestrator`**: event / activity / gathering suggestions; couples
  to treatment cycle, zone, weather, outline gaps, and calendar.
  Produces `invitation` feed items with one-tap scheduling.
- **`psychology`** coupling: full (option A, locked). Reflections feed
  the psychology agent via normal routing for distress detection.
  Private entries are excluded.

### Event bus

New log tags route without clinical fan-out:

| Tag | Agent routing |
|---|---|
| `memory` | biographer |
| `social` | orchestrator |
| `legacy_voice` | biographer |
| `legacy_session` | biographer |
| `cooking` | biographer |
| `practice` | biographer |

### Rendering surfaces

- **`/family/timeline`** — chronological scroll, date-grouped, reverse-chrono.
  Merges `life_events` (is_memory=true), completed `appointments`
  (non-clinical spine), `treatment_cycles` start/end, and
  `family_notes` threaded under their anchors.
- **`/family/legacy`** — thematic view, per-dyad threads, per-chapter
  coverage, biographer digest.

## Data model

### v16 — shipped (PR #87)

- `timeline_media` — single local blob store for photos, short video,
  and voice memos. Indexed `[owner_type+owner_id]` and `taken_at`.
- `life_events` extensions — `author`, `created_via`, `is_memory`,
  `source_appointment_id`.
- `family_notes` extensions — `life_event_id`, `appointment_id`.

### v17 — planned

```
profile_entries {
  id
  kind: "voice_memo" | "video" | "photo" | "story" | "value" |
        "relationship" | "opinion" | "preference" | "mannerism" | "quote"
  prompt_id?
  title, transcript?, summary?
  language: "en" | "zh" | "mixed"
  recorded_at, duration_ms?
  author: EnteredBy
  entry_mode: "first_person_subject" | "first_person_family" |
              "observational" | "shared"
  visibility: "family" | "author_and_hulin" | "private"   // default "family"
  propagate: boolean                                       // default true
                                                           // unless private
  relationship_dyad?: "hulin-catherine" | "hulin-thomas" |
                      "hulin-self" | "family-whole"
  tags[]
  memory_cluster_id?
  people_mentioned?: string[]
  household_members_mentioned?: EnteredBy[]
  private_to_author?: boolean
  timeline_entry_id?
  created_at, updated_at
}

profile_prompts {
  id
  category
  depth: "icebreaker" | "biographical" | "value" | "reflective" |
         "dignity" | "lightness"
  audience: "hulin" | "catherine" | "thomas" | "any_family" | "shared_family"
  question: LocalizedString
  source: "dignity_therapy" | "mcp" | "fgft" | "narrative_med" |
          "pennebaker" | "butler_life_review" | "ambiguous_loss" | "custom"
  sensitivity: "low" | "medium" | "high"
  cadence_weight: number
  pair_id?                    // linked cross-audience prompts
  asked_at?, answered_entry_id?
}

profile_aspects {
  id
  aspect: "value" | "catchphrase" | "story" | "relationship" |
          "opinion" | "mannerism"
  label, description
  evidence_ids: number[]
  confidence: number
  chapter?
  coverage_contribution?
  last_updated
}

biographical_outline {
  id
  chapter, sub_chapter
  arc_position: number        // Butler sequence index
  target_depth: "essential" | "rich" | "optional"
  coverage: number            // 0..1 overall
  family_coverage: {          // per-member coverage
    hulin: number
    catherine: number
    thomas: number
  }
  linked_entries: number[]
  open_prompts: number[]
}

memory_clusters {
  id
  title
  approximate_date?
  approximate_date_start?
  approximate_date_end?
  people_mentioned: string[]
  household_members_involved: EnteredBy[]
  propagate: boolean
  seed_entry_id: number
  created_by: EnteredBy
  created_at, updated_at
}

profile_consent {              // singleton row
  id
  reminiscence_mode: boolean
  letter_mode: boolean
  advisor_mode: boolean
  free_form_chat: boolean      // default false
  voice_cloning_for_tts: boolean
  last_updated_by: EnteredBy
  updated_at
}
```

`timeline_media.owner_type` extends with `"profile_entry"` at v17.

## Capture tiers

| Tier | Caps | Use |
|---|---|---|
| **Moment** | ≤10s video, ≤60s voice, photo | Casual timeline posts |
| **Legacy** | ≤10min video, ≤30min voice | Intentional captures |
| **Ambient** | 30–90min audio | Dinners, car rides, phone calls |
| **Physical ingestion** | Photo / scan | Diary pages, letters, albums, yearbooks — OCR via existing Tesseract.js |

Caps enforced at the capture-layer UI, not the schema. Video above the
moment cap requires an explicit "legacy" capture flow so the user knows
the tier they are in.

## Feature set

### Tier 1 — build ASAP

- **Diary page ingestion** — Hu Lin is writing a paper diary now; every
  page not captured is lost. Photograph page, OCR, create timeline entry,
  biographer outline tag. Highest urgency in the build order.
- **Voice-of-Dad samples** — rich voice recordings across emotional
  registers (telling stories, laughing, reading aloud, singing).
  Irreplaceable.
- **Cooking with technique video** — Dad cooks a dish he's known for;
  captured on video with recipe + technique + story. Hands-knowledge does
  not survive in text.
- **Ambient dinner capture** — one-tap long-form audio at family meals;
  biographer transcribes, diarizes, extracts memory-shaped moments as
  draft entries for review.
- **Legacy letters** — guided composition of letters sealed for future
  occasions (Thomas's 50th, first grandchild's 18th, a partner's wedding
  day). Dad approves every word.
- **Family digest** — weekly warm summary from the biographer. What
  landed this week; what's open; one gentle prompt.
- **Ethical will** — guided composition of Dad's values, hopes,
  blessings, apologies; traditional Jewish / Chinese form. Dad authors.
- **Companion consent framework** — bounded presence modes, per-mode
  authorisation captured while Dad is well.
- **Qigong sequence recording** — Dad demonstrates his practice.
  Elevates him as teacher, not patient.
- **Reading aloud** — Dad reads poems, scripture, children's books;
  future grandchildren hear his voice reading to them.
- **Life map / travel reconstruction** — place pins; every family trip
  pieced together; family-retreat session mode for collaborative recall.
- **Advent-calendar timed release** — sealed entries per recipient with
  unlock dates; a slow drip of Dad's voice into family members' and
  grandchildren's future lives.

### Tier 2 — planned

- Photo reverse-prompting ("tell me the story of this print")
- Object memories ("my grandfather's watch")
- Place narration (video walk-through of meaningful places)
- Song-triggered recall
- Pre-visit brief (biographer prepares a conversation card before
  family sees Dad)
- Two-truths framing for contradictory memories
- Unsent conversations (recorded for an absent recipient, held private)
- Age-of-son thread (Dad's memory of Thomas at each age)
- Generational parallels (Dad at 30 vs Thomas at 30)
- Laughter corpus
- Catchphrase dictionary (bilingual, with contexts)
- Relationship portraits (one essay per dyad)

### Tier 3 — parked ideas

- Social network for Dad / deceased — shared-read legacy archive
  extended to friends, extended family, community. Revisit after
  Tier 1 ships. Preserves author-time visibility semantics.
- Draft prose chapters — biographer drafts a running prose biography
  from the corpus; Dad edits and approves.
- Handwriting preservation beyond scans (generative handwritten output
  for future letters; ethically heavy, design later).

## Companion consent framework

The corpus will eventually feed an AI companion built in a separate
tool, outside this app. Captured now while Dad can authorise each mode
himself:

- **Reminiscence mode** — playback of his actual voice and stories on
  occasions. No generation.
- **Letter mode** — generated letter in his voice for a future occasion;
  opt-in per occasion; always flagged as biographer-composed, never
  Dad-authored.
- **Advisor mode** — "what would Dad have said about X"; draws only
  from his recorded opinions with citations; framed as interpretation.
- **Free-form chat** — off by default. Dad explicitly opts in if he
  wishes. Refusal is honoured permanently.
- **Voice cloning for TTS** — separate opt-in. Off by default.

All four flags land as a `profile_consent` singleton row in v17.
Irreversible-if-refused is enforced at export time: the export bundle
omits material for refused modes.

## Build order

| Slice | Scope | Status |
|---|---|---|
| 1 | v16 schema — timeline_media, life_events + family_notes extensions | ✅ merged (PR #87) |
| 2 | This doc + CLAUDE.md required-reading update | in progress |
| 3 | Tiered media capture primitives (moment + legacy tiers) | — |
| 4 | **Diary page ingestion** (urgent — Dad writing now) | — |
| 5 | `memory` log tag + ingest-modal classification | — |
| 6 | `/family/timeline` chronological view | — |
| 7 | Auto-synthesise timeline from completed appointments | — |
| 8 | Note threading under timeline anchors | — |
| 9 | Anniversary resurfacing (low-priority positive feed items) | — |
| 10 | v17 schema — profile tables + memory_clusters + consent | — |
| 11 | Seeded bilingual prompt library (~120 prompts) | — |
| 12 | Cadence engine + `dignity_prompt` feed items | — |
| 13 | `biographer` agent + state + outline + cluster + propagation | — |
| 14 | Observational + first-person-family entry affordances | — |
| 15 | `orchestrator` agent — `invitation` feed items | — |
| 16 | Calendar integration — one-tap scheduling | — |
| 17 | Legacy letters composition flow | — |
| 18 | Ethical will guided composition | — |
| 19 | Advent-calendar timed release (sealed + unlock) | — |
| 20 | Ambient dinner capture (long-form + diarization + extraction) | — |
| 21 | Cooking technique session flow | — |
| 22 | Qigong / reading aloud capture flows | — |
| 23 | Life map + trip reconstruction + family retreat session mode | — |
| 24 | Encrypted export bundle (AES-GCM + Argon2 passphrase) | — |
| 25 | Review / delete / consent screens + `/family/legacy` | — |
| 26 | Psychology agent coupling verification | — |

## Open questions

- **Audio transcription source** — on-device Whisper WASM (~40MB bundle
  cost) vs deferred cloud call with user consent. Currently: store raw
  Blobs; transcribe later.
- **Video storage ceiling for legacy tier** — 10min clips are large in
  IndexedDB. Per-clip size cap + user-facing size warning; no transcode
  in v1.
- **Extended-family access** — out of scope until household model is
  extended beyond `hulin | catherine | thomas | clinician | jonalyn`.

## Related docs

- `docs/CLINICAL_FRAMEWORK.md` — three-axis framework, zone logic
- `docs/BRIDGE_STRATEGY.md` — clinical context this module runs inside
- `docs/DATA_SCHEMA.md` — base Dexie schema
- `docs/UX_PRINCIPLES.md` — tone rules this doc inherits
- `docs/BUILD_ORDER.md` — project-wide build order (this module is a
  parallel track)
- `docs/PRIVACY_MODEL.md` — local-first boundaries this module respects
