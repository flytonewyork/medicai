# Changelog

Auto-generated weekly summary of merged PRs, produced by
`scripts/release-notes.mjs` on a Sunday-night cron. Maintainer-facing —
patient and carer surfaces are intentionally untouched.

## 2026-05-03

### Changes

- chore(workflow): use `in progress` label as Claude trigger (#197)
- fix(nutrition): direct rear-camera capture for meal photo ingest (#196)
- refactor(utils/date): consolidate duplicated date/time helpers (#150)
- Weekly maintainer release-notes cron (#163)
- APK workflow: validate host shape + manifest URLs before Bubblewrap (#131)
- ci: document Workflow Permissions repo setting + explicit token wiring (#191)
- ci: switch board trigger to issues.labeled (projects_v2_item not a valid repo workflow trigger) (#190)
- ci: fix board-trigger workflow YAML validation (#189)
- AI Physio coverage support + light patient 'Why?' affordance (#162)
- analytical: Sprint 2 Phases 1, 2, 3a, 3b — helpers + shadow plumbing + V2 grip/steps rules (#184)
- Dashboard polish: stop silently dropping content (#160)
- sync: heal bootstrap pipe + persist queue to Dexie (#164)
- Coverage-aware agents: feed gap snapshot into agent referrals (PR-D2) (#158)
- Coverage engine: calm gap detector for daily logging (#156)
- Reflexive GI tile nudges (PR-A: PERT, Bristol, oil, loose-streak → feed) (#155)
- Analytical layer v1: cycle-detrending foundation + literature priors (#152)
- GI trends section on /nutrition (Bristol 28d, BMs/day, PERT coverage) (#154)
- Digestive tracking + multi-day AI nudge cadence (Option B) (#153)
- Restore /assessment to patient sidebar nav (#148)
- Dashboard: fix lingering save banner + empty pillar-tile column (#147)
- Memo parse: tolerant enum coercion (no more 502 on synonym mismatch) (#146)
- Food photo 401: show sign-in prompt instead of raw HttpError (#151)
- Memos: chemo recognised, AI nurse asks for ratings, dashboard surface (#145)
- Memos: capture imaging + labs, add follow-up dialogue, simpler labels (#144)
- Memos: fix /memos/[id] crash + auto-apply on high confidence + Undo (#143)
- Trim dead dashboard UI + anchor labs in time (#139)
- Voice routes honour local-first: drop session gate on transcribe + parse (#142)
- Slice 3: Memos tab + preview-form review + clinic visits + scrubbed personal content (#141)
- Slice 2: AI parses voice memos into daily-form fields automatically (#138)
- Voice memos foundation: Whisper transcription + /diary timeline (#136)
- Fix /carers misclassifying signed-in users + login bouncing past next= (#134)
- Fix voice-memo duplication and switch /log to click-to-record (#135)
- Repair family-onboarding flow across settings, /family, caregiver onboarding (#133)
- Patient-led carer invitations — repair the sign-in dead-end (#132)
- APK workflow: pre-write Bubblewrap config so init is non-interactive (#130)
- Voice-first /log, library/file photo uploads, Melbourne oncologist picker (#129)
- Capture weight + height in onboarding, share store with /log + graphs (#127)
- APK workflow: surface all missing secrets in one pre-flight step (#128)
- Add /apk install page + signed-APK publish pipeline (#126)
- Fix silent save failures and placeholder pollution in capture flows (#125)
- Polish design consistency across pages and lists (#123)
- Records import step 2: pdf_blobs table + row-level provenance (#86)
- Refactor — consolidate duplicate hooks and validators (#91)
- nav: anchor pill flush with viewport bottom (final fix for iOS PWA padding) (#122)
- safety: chemo-at-home + neutropenia patient guides (Cancer Institute NSW / JPCC) (#121)
- Carers: don't bounce signed-in carers to patient onboarding (#119)
- nav: stop double-counting safe-area inset on iOS PWA (#120)
- Nav: shrink bottom-nav clearance + fix nested-route active state (#118)
- A+ tightening: auth, identity, a11y (#116)
- Carers: fix permanent "Loading…" stuck state on /carers (#117)
- UX audit: fix 7 new-user clarity issues (#112)
- nutrition: scale macros with grams + serving-size shortcuts (#109)
- Tighten patient surface: remove dead UI, orphan routes, label bugs (#114)
- design: collapse hand-rolled alerts/chips/section heads onto primitives (#113)
- Carers: collapse /care-team and /household into one module with Add carer CTA (#111)
- Carer invite flow: preview-before-auth, /household page, role-aware welcome (#110)
- Nutrition: JPCC operationalisation — foundations, PERT engine, playbooks, UI wiring (#108)
- Nutrition: first-class slot in mobile nav and FAB (#107)
- FAB clearance over bottom nav (5rem → 6.5rem + inset) (#101)
- DRY refactor: API route helpers, useSettings hook, zone-rules cleanup (#106)
- Design polish: align tokens, primitives, remove emoji from patient UI (#105)
- Dashboard UX pass: rank by priority, hide empty cards, tighten capture FAB (#104)
- UX audit: 7 new-user experience fixes + E2E test suite (#103)

### Refactor

- refactor: dedupe time, household, and streak helpers (#159)
- refactor: unify LocalizedText type + adopt postJson for remaining inline POSTs (#124)
- Refactor: extract shared utilities (date, http, upcoming, bilingual) (#115)

### Docs

- docs: operational handbook + issue template + honest trigger model (#194)

