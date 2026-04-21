# Build, CI/CD, and Deployment Instructions

## Prerequisites

- **Node.js 24.x** (pinned — Vercel and CI use the same version via
  `package.json#engines` and `.nvmrc`)
- **pnpm 8+** (`npm install -g pnpm`)
- **Git** and a working GitHub SSH / token to push to
  `flytonewyork/medicai`

## Local setup

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. All patient data lives in the browser's
IndexedDB; clearing site data wipes the app.

## Useful commands

```bash
pnpm dev         # development server
pnpm typecheck   # tsc --noEmit
pnpm lint        # next lint
pnpm test        # vitest run
pnpm test:watch  # vitest watch mode
pnpm test:e2e    # Playwright (requires dev server)
pnpm build       # production build — mirrors what Vercel runs
```

Before every commit to a feature branch, `pnpm typecheck && pnpm test
&& pnpm build` should all be green locally. If any of them fail the
Vercel build will fail the same way.

---

## CI / CD flow (feature branch → PR → main → Vercel)

**Rule: never push directly to `main`.** `main` is the production
branch Vercel auto-deploys. All feature work lives on its own branch
and lands on main via a pull request.

### 1. Start each feature on its own branch

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/<short-kebab-description>
```

Branch naming conventions used in this repo:

- `feat/...` — new functionality
- `fix/...` — bug fixes
- `chore/...` — tooling, deps, docs-only
- `claude/...` — agent-authored work (created by Claude Code sessions)

### 2. Build, verify, commit

Make the change, then:

```bash
pnpm typecheck
pnpm test
pnpm build
```

All three must pass. Only then commit:

```bash
git add -A
git commit -m "<imperative summary line>"
```

Multi-line commit messages are encouraged — describe the why, list
breaking changes, and reference the relevant clinical framework
section when behaviour changes.

### 3. Push the feature branch

```bash
git push -u origin feat/<short-kebab-description>
```

The first push of any branch triggers a **Vercel preview deployment**.
The preview URL is posted as a bot comment on the PR once you open it.

### 4. Open a pull request against `main`

Via GitHub UI, or:

```bash
gh pr create --base main --title "<title>" --body "<body>"
```

In this repo the MCP GitHub integration opens PRs via
`mcp__github__create_pull_request`.

The PR description should include:

- Summary of what changed
- Test plan checklist (what to manually verify on the Vercel preview)
- Any schema migrations, breaking changes, or Dexie version bumps
- Links to relevant `docs/*.md` sections

### 5. Watch CI, review, iterate

Every push to the feature branch redeploys the preview. The Vercel
status check must be green before merge. Any TypeScript / lint /
build failure appears as a failed status. Fix on the same branch and
push — do not rebase-squash force-push main.

If you need to react to review comments or CI failures, subscribe the
Claude Code session to PR activity:

```
mcp__github__subscribe_pr_activity(pullNumber: N)
```

### 6. Merge to main

Once the preview looks right and reviewers are happy:

- Merge the PR via the GitHub UI (or `mcp__github__merge_pull_request`)
- **Prefer a merge commit.** It preserves the feature-branch history
  on main and makes reverts easy.
- Delete the feature branch after merge.

### 7. Production deploy

The merge commit on `main` triggers a **Vercel production deploy**
automatically. Watch the deployment in Vercel (or via the GitHub
status on the merge commit). If the deploy fails, fix on a new feature
branch — never hotfix on main.

---

## What Vercel needs (one-time setup)

Already configured on `flytonewyork/medicai`, documented here so it
stays reproducible.

- **Project:** `pocket-therapist` on the `flytonewyorks-projects` team
- **Framework preset:** Next.js (auto-detected)
- **Build command:** `pnpm build`
- **Install command:** `pnpm install --frozen-lockfile`
- **Node.js version:** `24.x` (read from `package.json#engines` and
  `.nvmrc`)
- **Production branch:** `main`
- **Preview deployments:** enabled for all branches
- **Environment variables:** none required for MVP (local-first app)

If the Vercel build ever errors with "invalid or discontinued Node.js
version", check that `package.json#engines.node` and `.nvmrc` both
still say `24.x`.

---

## Anti-patterns we have hit — don't repeat

1. **Direct push to `main`.** Bypasses preview deploy, skips review,
   and breaks the PR-flow expectation. Always PR. If a direct push
   did land on main, revert cleanly (`git push --force-with-lease
   origin <prior-sha>:main`) and reopen a PR.
2. **Node version drift.** Remove `engines.node` and Vercel will
   default to the last-cached version, which may no longer be
   supported. Keep 24.x pinned.
3. **`pdfjs-dist` worker bundled by Next.** `new URL("pdfjs-dist/
   build/pdf.worker.min.mjs", import.meta.url)` pulls the worker
   through Terser and fails on `import.meta`. The fix: copy the
   worker to `public/pdfjs/` and set `workerSrc =
   "/pdfjs/pdf.worker.min.mjs"`. The copied file is committed.
4. **Dexie schema edits without a version bump.** If you change the
   indexes of an existing store, add a `this.version(N).stores({...})`
   block — never mutate a prior version. New optional fields on the
   interface don't need a bump.
5. **Force-push to main.** Destructive and visible to the Vercel
   deployment graph. Only ever used to revert a mistaken direct push,
   and only with `--force-with-lease` scoped to the specific sha.

---

## Emergency rollback

If a merged commit breaks production:

```bash
git checkout main
git pull --ff-only
git revert <bad-commit-sha>
git push origin main
```

That pushes a new revert commit; Vercel redeploys the previous-good
state within a few minutes. Don't force-push main to achieve rollback.

---

## Dexie migrations

Editing zone thresholds lives in `src/config/thresholds.json`; no code
change required. Editing treatment levers lives in
`src/config/treatment-levers.json`.

Schema changes to IndexedDB stores must bump the Dexie version. See
`src/lib/db/dexie.ts` — existing `version(N).stores(...)` blocks
remain intact; add a new block for the next version. Optional new
fields on a record interface don't require a bump.

## Backup / restore

Use the Reports page: **Export JSON backup** writes a JSON file with
every local table. **Import** restores from that file after Zod
validation. Back up before clearing site data, changing browser, or
major Dexie-version bumps.
