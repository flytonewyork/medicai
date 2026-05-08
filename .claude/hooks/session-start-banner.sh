#!/usr/bin/env bash
# Anchor — SessionStart banner.
#
# Cheap psychic insurance for tired-at-11pm sessions. Prints the n=1
# guardrails + most recent eval pass rate at the top of every Claude
# Code session that loads this project.
#
# Contract: write to stdout. The harness surfaces stdout as session
# context. Exit 0 always — banner is informational, never blocking.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
EVAL_DIR="$REPO/eval-runs"

# Latest eval summary (if any).
latest_eval=""
if compgen -G "$EVAL_DIR/*.json" >/dev/null; then
  latest_file="$(ls -1t "$EVAL_DIR"/*.json | head -n 1)"
  if [[ -f "$latest_file" ]]; then
    latest_eval="$(grep -oE '"pass":[0-9]+,[[:space:]]*"fail":[0-9]+,[[:space:]]*"error":[0-9]+,[[:space:]]*"total":[0-9]+' "$latest_file" 2>/dev/null | head -n 1)"
  fi
fi

# Block-comms log size (proof the hook has been firing).
blocks=0
if [[ -f "$REPO/.claude/local/blocked-comms.log" ]]; then
  blocks="$(wc -l < "$REPO/.claude/local/blocked-comms.log" | tr -d ' ')"
fi

cat <<EOF
╭─ Anchor session — bridge-strategy doctrine
│
│  • n=1, single patient (HL). No patient_id abstractions.
│  • Layer 1 (zone engine) is read-only — types-only seam from Layer 2.
│  • Never autonomous: every threshold crossing → mandatory conversation.
│  • Outbound comms: blocked at the hook layer + tools allow-list.
│  • Cite or [VERIFY]: no clinical claim ships uncited.
│  • Phase 1 is local-only — no push to main, no Vercel changes.
│
│  Latest eval run: ${latest_eval:-no eval runs yet — \`pnpm evals:run\`}
│  Outbound-comms blocks logged this lifetime: ${blocks}
│
│  See CLAUDE.md (root) for bridge-strategy doctrine.
│  See .claude/CLAUDE.md for app-internal doctrine.
╰─
EOF
