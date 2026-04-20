# Anchor

A function-preservation and bridge-strategy platform. Tracks daily, weekly, fortnightly, and quarterly metrics for a single patient navigating metastatic PDAC on first-line gemcitabine + nab-paclitaxel, with the explicit goal of preserving ECOG performance status for daraxonrasib eligibility (RASolute 303 / 302).

## Architecture

- Next.js 14 (App Router) + TypeScript + Tailwind
- Local-first: all data in IndexedDB via Dexie. No cloud, no server.
- Bilingual EN / 简体中文 via next-intl
- Zone engine: declarative rules evaluate on every save and surface green/yellow/orange/red status

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
```

## Documentation

See `docs/` for the clinical framework, bridge strategy, zone rules, data schema, and sequenced build plan. `.claude/CLAUDE.md` holds the project context for Claude Code sessions.

## Privacy

Single-patient, personal-use tool. All medical data stays on the device. Not HIPAA/GDPR certified, not a replacement for clinical judgement.
