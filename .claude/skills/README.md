# Skills

Claude Skills: deterministic, named procedures Claude Code loads on
demand. One folder per skill at `.claude/skills/<name>/SKILL.md`.

## Frontmatter contract

```yaml
---
name: pdac-trial-eligibility-parse
description: When parsing a shortlisted trial's eligibility criteria
  into the structured shape that src/eligibility/ consumes.
---

Body documents the procedure: trigger conditions, inputs, output JSON
shape, and failure modes.
```

## Coexistence with `.claude/commands/`

`.claude/commands/*.md` are slash commands (user types `/build-module`).
`.claude/skills/<name>/SKILL.md` is the new Skills format (Claude
auto-invokes when the trigger condition matches). Both work; use a skill
when Claude should pick it up automatically, a command when the
operator explicitly invokes it.

## Phase 1 inhabitants

- `pdac-trial-eligibility-parse/` — emits the JSON shape consumed by
  `src/eligibility/parseEligibility.ts`.
