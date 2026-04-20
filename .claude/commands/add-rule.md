Command: add a new zone rule.

Steps:
1. Identify the rule's category (`function`, `toxicity`, `disease`,
   `psychological`, `nutrition`).
2. Decide the zone level (`yellow`, `orange`, `red`).
3. Confirm the threshold value belongs in `src/config/thresholds.json` or is
   inherent to the rule (e.g. grade thresholds).
4. Add the rule to `src/lib/rules/zone-rules.ts` with:
   - `id`, `name`, `zone`, `category`
   - `evaluator(snapshot)` — returns boolean
   - `recommendation`, `recommendationZh`
   - `suggestedLevers` — ids from `src/config/treatment-levers.json`
5. Add unit tests covering positive and negative cases.
6. Update `docs/ZONE_RULES.md` with the new rule name.
