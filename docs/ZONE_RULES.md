# Zone Rules Specification

All rules are declarative and evaluated on every data save. Rules are defined in
`src/lib/rules/zone-rules.ts` and tuned via `src/config/thresholds.json`.

## Rule structure

```ts
interface ZoneRule {
  id: string;
  name: string;
  zone: "yellow" | "orange" | "red";
  category: "function" | "toxicity" | "disease" | "psychological" | "nutrition";
  evaluator: (data: ClinicalSnapshot) => boolean;
  recommendation: string;
  recommendationZh: string;
  triggersReview: boolean;
  suggestedLevers: string[];
}
```

## MVP rule catalogue

### Function

- `weight_loss_5_10_yellow` — 5–10% weight loss from baseline
- `weight_loss_10_plus_orange` — >10% weight loss
- `grip_decline_10_20_yellow` — 10–20% grip decline
- `grip_decline_20_plus_orange` — >20% grip decline
- `gait_0_8_1_0_yellow` — gait speed 0.8–1.0 m/s
- `gait_lt_0_8_orange` — gait speed <0.8 m/s
- `practice_3_4_yellow` — practice completion 3–4/7 days for 2 consecutive weeks
- `practice_le_2_orange` — practice completion ≤2/7 for 2 weeks

### Toxicity

- `neuropathy_grade_2_yellow`
- `neuropathy_grade_3_orange`
- `febrile_neutropenia_red`

### Disease

- `ca199_rising_3_consecutive_yellow`
- `imaging_progression_orange`

### Psychological

- `phq9_moderate_yellow` (≥10)
- `phq9_severe_orange` (≥15)
- `gad7_moderate_yellow` (≥10)
- `gad7_severe_orange` (≥15)
- `stillness_decline_yellow`

### Nutrition

- `albumin_lt_30_yellow`
- `albumin_lt_25_orange`

## Evaluation lifecycle

1. User saves any entry (daily / weekly / fortnightly / quarterly / lab / imaging).
2. The engine assembles a `ClinicalSnapshot` from the latest data.
3. Every rule's `evaluator` runs against the snapshot.
4. Triggered rules become `zone_alerts` entries. Existing matching alerts
   remain open (deduped by rule id + open status).
5. Dashboard surfaces the highest active zone with counts.

## Zone precedence

`red > orange > yellow > green`. Dashboard shows the highest active zone.
