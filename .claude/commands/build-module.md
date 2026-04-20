Command: build a new vertical module (daily / weekly / fortnightly / quarterly / bridge / events).

Steps:
1. Re-read `docs/BUILD_ORDER.md` and the relevant section of
   `docs/CLINICAL_FRAMEWORK.md`.
2. Confirm the data schema entries needed. Update `src/lib/db/dexie.ts` and
   `src/types/` if new tables or fields are required.
3. Add Zod validators in `src/lib/validators/schemas.ts`.
4. Build the form UI under `src/components/<module>/`.
5. Wire the route under `src/app/<module>/page.tsx`.
6. Ensure the zone engine evaluates on save.
7. Add unit tests for any new calculations or rules.
8. Update `public/locales/*/common.json` with new keys.
9. Smoke-test the flow: enter → save → reload → view trend.
