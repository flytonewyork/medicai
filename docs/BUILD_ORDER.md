# Sequenced Build Plan

Build in vertical slices. Each phase delivers working, testable functionality.

## Phase 0: Scaffolding

- Next.js + TypeScript + Tailwind initialised
- Directory structure per spec
- All docs files present
- Git initialised, first commit

## Phase 1: Foundations

- Dexie schema for all tables
- Base layout with bottom nav (mobile) / sidebar (desktop)
- Routing for all pages (even if stub)
- i18n foundation (next-intl)
- Settings page (profile, DOB, baseline weight / grip / gait, diagnosis date)
- Zustand UI store

## Phase 2: Daily tracking

- Multi-step daily check-in wizard
- Zod validation
- Save to IndexedDB
- Daily list view showing past entries
- Edit existing entry capability

## Phase 3: Dashboard and trends

- Current zone status card
- 7-day and 28-day moving average calculations
- Trend charts for weight, energy, practice completion
- Zone engine skeleton
- Alert list for active zone flags

## Phase 4: Weekly assessment

- Weekly assessment form
- Auto-populate from daily entries where possible
- Zone rules evaluated against weekly data
- Weekly trend view

## Phase 5: Fortnightly clinical assessment

- ECOG self-report with tooltips
- PRO-CTCAE subset
- PHQ-9, GAD-7 scoring
- TNS neuropathy
- Functional tests (grip, gait, sit-to-stand)
- Nutritional entry
- All zone rules for these metrics

## Phase 6: Quarterly review

- 12-week trend dashboards
- Imaging entry and display
- CA19-9 trend + rising-3-consecutive detection
- ctDNA entry
- CGA checklist

## Phase 7: Bridge module

- Trial tracker cards (RASolute 303, 302, expanded access)
- Molecular profile entry and display
- Regulatory watch
- Bridge composite scoring
- Eligibility checker

## Phase 8: Life events

- Event calendar
- Event checklist templates
- Treatment cycle integration
- Pre-event prophylaxis reminders
- Post-event buffer calculation

## Phase 9: Decision log

- Decision entry (decision, rationale, alternatives, who)
- List view, search / filter
- Link to triggering zone alerts

## Phase 10: Reports

- Pre-clinic summary PDF
- Quarterly review PDF
- Export all data as JSON / CSV

## Phase 11: Polish and testing

- Full bilingual pass
- All zone rules tested
- E2E tests
- Responsive on iPhone and desktop
- PWA offline support
- Backup / restore

## Phase 12: Deployment

- Vercel with password protection
- Custom domain if desired
- GitHub private backup
