# Records Import (My Health Record + Epworth)

Design note for patient-owned medical record import from My Health Record
(Australian Digital Health Agency) and the Epworth patient portal.

This is a **design-only** document. No code yet. It sets the boundaries so
implementation lands on the existing ingest pipeline rather than growing a new
top-level feature.

## Scope decision

**In scope:** assisted import of documents the patient already has legitimate
personal access to — MHR PDFs (downloaded via myGov), Epworth letters / reports
(emailed, portal-downloaded, or photographed). The patient is copying their own
records into their own local-first store.

**Out of scope and will not be attempted:**

- Live API integration with MHR, Epworth, or any hospital EMR.
- Third-party B2B vendor registration with the Australian Digital Health
  Agency.
- Any flow where a record appears in Anchor without the patient having first
  obtained it themselves.
- Multi-patient support or records belonging to anyone other than Hu Lin.

This is consistent with the "no EMR integration" rule in `CLAUDE.md`: Anchor is
not reading from a hospital system. Anchor accepts documents the patient drops
in, the same way `src/lib/ingest/` already accepts any other document.

## Why no live API

- **My Health Record.** No consumer-grade third-party API. The B2B FHIR / CDA
  Gateway requires vendor registration, conformance testing, and ADHA approval
  as registered clinical software. A single-patient PWA cannot and should not
  qualify.
- **Epworth.** No public patient-facing API. Patient surface is the portal plus
  emailed PDFs. No FHIR endpoint.
- **Local-first principle.** A live pull would need credential storage and
  ongoing network traffic carrying PHI — a material step away from the
  `PRIVACY_MODEL.md` posture, for no workflow the patient can't accomplish
  manually in under a minute.

## Privacy decision (confirmed)

Imported PDFs are parsed via the existing Anthropic path in
`src/lib/ingest/claude-parser.ts`. PHI leaves the device for parsing only,
same as every other document ingested today. Original PDFs are stored as
Blobs in Dexie; structured output lands in the existing tables. No record
bytes are retained server-side beyond the parse request.

If the user ever wants an on-device-only mode for records, that becomes a
setting that forces the heuristic parser + OCR path. Not part of this design.

## Where it lives in the codebase

The ingest pipeline already exists and already knows most of the document
kinds that matter:

```
src/lib/ingest/
  claude-parser.ts       ← already handles lab_report, imaging_report,
                           ctdna_report, clinic_letter
  heuristic-parser.ts
  operations.ts
  save.ts
  draft-schema.ts
  ...
src/types/ingest.ts      ← IngestDraft, IngestOp discriminated union
```

`IngestDocumentKind` in `src/types/ingest.ts:27` already covers
`clinic_letter`, `lab_report`, `imaging_report`, `ctdna_report`,
`discharge_summary`, `prescription`. This design adds **provenance**, two new
document kinds, and lightweight source-specific parser hints. It does not add a
screen or a tab.

## Extensions required

### 1. Provenance tagging

Add a `source_system` field to `IngestDraft` and to the rows it produces when
relevant:

```
source_system?: "mhr" | "epworth" | "email" | "photo" | "other"
```

Rationale: when two reports conflict (a CA 19-9 on the same day from two
sources), the feed item needs to say where each came from. Also lets us fix a
bad parser prompt later by re-running only `source_system === "mhr"` imports.

### 2. Two new document kinds

Extend `IngestDocumentKind`:

- `pbs_dispensing_history` — MHR exports a Prescription and Dispense View
  that is the ground truth for what chemo and supportive meds were actually
  dispensed. Feeds the medication store and the treatment-cycle reality check.
- `immunisation_history` — MHR Australian Immunisation Register view. Small
  but pre-trial eligibility hygiene matters (COVID, influenza, pneumococcal
  timing around chemo).

Existing kinds already cover pathology, imaging, clinic letters, discharge
summaries, ctDNA.

### 3. Source detectors

New module `src/lib/ingest/sources/`:

- `mhr.ts` — detects MHR provenance from PDF metadata and headers
  ("My Health Record", ADHA / IHI block, standard CDA-rendered layout).
- `epworth.ts` — detects Epworth letterhead, report templates, and the
  typical pathology / imaging footer blocks.

Detection returns a `source_system` plus a **prompt hint** the Claude parser
uses to anchor on known layouts. No new model, no new route — the existing
`claude-parser.ts` gets an optional prompt-hint parameter.

Fallback: if detection fails, the document is parsed as a generic document
exactly as it is today. Source detection is a speed / accuracy optimisation,
not a gate.

### 4. New ingest ops

Add to the `IngestOp` union in `src/types/ingest.ts:60`:

- `add_dispense_record` — one dispensing event (drug, date, pack size,
  prescriber). Updates the existing `medications` store plus a new
  dispensing log (see below).
- `add_immunisation` — optional; may be stored as a `LifeEvent` subtype
  rather than a new table. Decide at implementation time.

### 5. Storage additions

- New Dexie table: `dispensing_events` — one row per PBS dispense event.
  Keeps provenance and date, joins to `medications` by `drug_id`. This is
  additive; existing `medications` rows are unchanged.
- `pdf_blobs` — a single keyed store for original PDFs referenced by any
  imported row, so the "view original" affordance on feed items always works
  offline. Rows in structured tables gain a nullable `source_pdf_id`.

No changes to existing tables beyond the nullable `source_pdf_id` and
`source_system` columns.

### 6. Feed items

Existing feed item types (see `src/types/feed.ts`) cover most of this. Gaps:

- `lab-result-import` — imported lab with delta vs prior result, provenance,
  one-tap open-original.
- `imaging-report-import` — imaged lesion size deltas where the report gives
  them, RECIST status if stated, new-site flag.
- `clinic-letter-import` — ECOG if recorded, dose changes, treatment holds,
  AE grading, pending actions.
- `dispensing-mismatch` — raised when PBS history shows a chemo cycle the
  internal treatment store does not, or vice versa. Ranked high; this is an
  axis-3 signal (missed or held cycle).

All four are ranked items on the single existing feed. No new screen.

## Capture ergonomics

- **iOS / Android:** PWA share target. "Share to Anchor" from the myGov PDF
  viewer, Mail, Files, or the Epworth portal's download prompt routes to the
  existing ingest drop handler.
- **Desktop:** existing drag-drop zone already works. No change needed.
- **Manual email forward:** out of scope for this doc (no server to receive
  mail in local-first MVP). Patient downloads the PDF from their mail client
  and shares it in.

## Document type priorities (confirmed)

In descending order of clinical value for the bridge strategy:

1. **Pathology reports** — CA 19-9 trend, LFTs, albumin, CRP, neutrophils,
   platelets. Drives axis 3 toxicity detection and axis 1 response signal.
2. **Imaging reports** — lesion sizes, RECIST-ish deltas, new sites. Axis 1.
3. **Discharge / clinic letters** — recorded ECOG, dose reductions, treatment
   holds, AE grading. Axis 3 and treatment reality.
4. **PBS dispensing history** — actual cycles delivered, antiemetic and
   neuropathy-agent use. Reality-check against the internal treatment store.
5. **Immunisations** — pre-trial eligibility hygiene.
6. **MBS claims** — appointment reality-check vs self-reported attendance.

Build order follows this list. Pathology and imaging first because they hit
the zone engine immediately and the value-per-unit-of-work is highest.

## Zone engine integration

Imported labs and imaging flow through the same zone evaluator as any other
input. No new rules are required for the import itself — the existing rules
in `src/lib/rules/` read from the lab and imaging tables and do not care about
provenance.

One new cross-cutting rule worth flagging for a later doc, not this one:
"Dispensing history missing a cycle the treatment store says was given" is a
legitimate axis-3 alert (held or missed cycle) and deserves its own zone
rule. Leave that for `ZONE_RULES.md` when the dispensing feature lands.

## What we will not build

- Auto-reconciliation of MHR medication list against the internal medication
  store. Too easy to get wrong silently. Show a diff as a feed item, let the
  patient or Thomas accept each delta.
- A FHIR normalisation layer. One patient, two document sources, local-first.
  Parse directly to the existing Dexie schema.
- A "connect my MHR account" OAuth flow. No such thing exists for consumers
  and we would not build around it even if it did, for privacy-model reasons.
- A dedicated "records" tab. Imports are an input modality; imported rows
  show up on the existing feed. Consistent with the single-channel model in
  `CLAUDE.md`.

## Open questions for implementation

- Exact sample MHR PDF layout (we have a conceptual model; real samples will
  shake out the prompt hints). First implementation pass should be tested
  against at least three real MHR pathology PDFs and three real Epworth
  letters before the Claude prompt is locked.
- Whether `immunisation_history` becomes its own table or is folded into
  `life_events` with a subtype. Defer to the first real document.
- Whether `source_pdf_id` is stored in Dexie as a Blob key or written to
  OPFS. Blob in Dexie is simplest; OPFS is cleaner for very large PDFs.
  Default to Dexie Blob, migrate only if size becomes a problem.

## Build order

1. This design note (done).
2. Provenance field on `IngestDraft` + `pdf_blobs` table + `source_pdf_id`
   columns.
3. `sources/mhr.ts` + `sources/epworth.ts` detectors, wired to existing
   `claude-parser.ts` as optional prompt hints.
4. Pathology + imaging import path end-to-end, with a real MHR PDF as the
   test fixture.
5. Clinic-letter and discharge-summary path.
6. PBS dispensing history + `dispensing_events` table + mismatch feed item.
7. Immunisation + MBS (optional, low priority).

Each step is a vertical slice in the sense of `BUILD_ORDER.md`: import, parse,
store, feed item, zone evaluation, tests.
