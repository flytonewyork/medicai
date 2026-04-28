# Family collaboration — roles, permissions, user stories

Anchor is a household app with one patient, one primary carer, and
usually a handful of additional family and clinical contacts. Every
user belongs to exactly one household and holds exactly one role
inside it. The role governs what they can see, do, and change.

## Roles

| id | who | granted by |
|---|---|---|
| `primary_carer` | the lead person running this thing (Thomas) | implicit: whoever created the household |
| `patient` | the patient themselves (Hu Lin) | invite |
| `family` | extended family helping with logistics (Catherine, Wendy) | invite |
| `clinician` | external clinical professional with view-into-chart access | invite |
| `observer` | read-only third party (social worker, lawyer, trial nurse, researcher) | invite |

**One role per membership**; a clinician who's also a family member
picks the more permissive of the two. We don't model multiple roles
in this iteration — simpler to reason about.

## Permission matrix

| action | primary | patient | family | clinician | observer |
|---|---|---|---|---|---|
| invite / remove members | ✓ | ✓ | · | · | · |
| edit household settings | ✓ | · | · | · | · |
| edit treatment plan / cycles | ✓ | · | · | ✓ | · |
| edit medications | ✓ | ✓ | · | ✓ | · |
| edit appointments | ✓ | ✓ | ✓ | · | · |
| log daily check-in | ✓ | ✓ | ✓ | · | · |
| log clinical note | ✓ | · | · | ✓ | · |
| quick note (/family) | ✓ | ✓ | ✓ | · | · |
| confirm attendance (self) | ✓ | ✓ | ✓ | ✓ | · |
| see clinical data (labs / scans) | ✓ | ✓ | ✓ | ✓ | ✓ |
| see family notes | ✓ | ✓ | ✓ | · | · |
| see member list | ✓ | ✓ | ✓ | ✓ | ✓ |
| see pending invites | ✓ | ✓ | · | · | · |

Legend: ✓ allowed, · not allowed.

Clinician intentionally **cannot** see family notes by default —
those are emotional / logistical and not for the chart. Observers
see everything but can't write anything.

The patient can invite and remove carers themselves — they're
captain of their own care team. This matters most when a patient
self-onboards before anyone else exists in the household: they
shouldn't have to wait for a primary_carer to be created in order
to bring family in. Editing structural settings (household name,
patient display, lead carer) and changing other members' roles
stays primary_carer-only so a patient can't accidentally invert
the chain of authority.

## User stories

### Primary carer (Thomas)

- I invite family members by email, assigning each an appropriate role, so people only see what's relevant to them.
- I see pending invites on my dashboard so no one is forgotten.
- I revoke an invite or remove a member when their involvement ends.
- I edit dad's treatment plan knowing family / patient / observer can't accidentally change it.
- I see what every family member has logged, so I know what's current before a phone call.

### Patient (Hu Lin)

- I log my own symptoms quickly without a clinical-looking form.
- I see my upcoming appointments with who's going with me.
- I can't accidentally break the plan — the edit affordances I care about (meds if I self-titrate) are visible, the rest aren't.

### Family (Catherine, Wendy, visiting relatives)

- I accept an invite link, create my account, and land on `/family`.
- I see today's and tomorrow's appointments and can confirm "I'll take him".
- I quick-log what I noticed ("he ate well today") without hunting for a form.
- I tap-to-call the oncologist from the directory.
- I don't see clinical decision-making UI — that's not for me.

### Clinician (external oncology nurse / trial coordinator)

- I read the clinical course + labs + imaging + current zone.
- I don't see the family logs (that's not what I'm here for).
- I can attach a note to the chart so my contribution is part of the record.

### Observer (social worker, lawyer, researcher with consent)

- I read everything the primary carer allows.
- I can't write anything — no ambiguity, no accidental nudges.

## Enforcement

Enforcement lives in two places:

1. **Client-side guards** via `can(role, action)` in `src/lib/auth/permissions.ts`. Edit buttons render disabled or hidden based on the current user's role. This is the UX layer — not trust-worthy on its own.

2. **Server-side RLS** on Supabase tables. The `cloud_rows` table gets role-aware `UPDATE` / `INSERT` policies that call `auth_role_has(action)` — a SQL helper that looks up the caller's role in the household and checks the matrix. This is the authoritative layer.

Both layers use the same matrix (kept as JSON in `src/lib/auth/permissions.ts` so the SQL and TS stay in sync — regenerate the SQL helper from the JSON when the matrix changes).

## Non-goals (this iteration)

- Multi-role memberships (a user holding both `clinician` and `family` at once).
- Per-record permissions ("hide this lab result from observers" — too fiddly).
- Time-boxed invites beyond the existing 14-day expiry.
- Audit log of who changed what when (comes in a later slice once ingest lands its full audit trail).
