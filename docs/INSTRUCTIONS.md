# Build Instructions

## Prerequisites

- Node.js 20+
- pnpm 8+ (`npm install -g pnpm`)
- Git

## Setup

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. All data lives in the browser's IndexedDB; clearing
site data wipes the app.

## Useful commands

```bash
pnpm dev         # development server
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm test        # vitest run
pnpm test:watch  # vitest watch mode
pnpm test:e2e    # Playwright (requires dev server)
pnpm build       # production build
```

## Editing zone thresholds

Zone thresholds live in `src/config/thresholds.json` and can be edited without
touching code. Rules that use these values import from the config.

## Editing treatment levers

Levers live in `src/config/treatment-levers.json`.

## Backup / restore

Use the Settings page: **Export data** writes a JSON file; **Import data**
restores from that file. Back up before a major browser update.
