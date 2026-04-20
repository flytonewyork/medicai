# Testing Strategy

## Priority order

1. Rule engine — any bug is clinically dangerous
2. Calculations — trends, moving averages, instrument scores
3. Data persistence — never lose user data
4. UI flows — daily check-in, weekly, fortnightly
5. PDF generation — clinical reports

## Unit tests (Vitest)

- Every calculation function
- Every zone rule (both positive and negative cases)
- Every validated instrument scoring (PHQ-9, GAD-7, TNS)
- Every date / format utility

## Integration tests

- Dexie CRUD operations
- Rule engine against realistic data snapshots
- PDF generation against fixture data

## E2E tests (Playwright)

1. New user setup → first daily entry → view dashboard
2. Complete fortnightly assessment → zone alert triggered → view → acknowledge
3. Generate pre-clinic PDF → verify content

## Coverage targets

- Rule engine: 100%
- Calculations: 100%
- Data layer: 95%+
- UI components: 70%+
- Overall: 80%+
