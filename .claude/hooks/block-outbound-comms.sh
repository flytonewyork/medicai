#!/usr/bin/env bash
# Anchor — never-autonomous guardrail (Phase 1).
#
# This is the second-line failsafe: codified denial of any tool
# invocation whose name implies outbound communication. The first
# line is not wiring such tools into any subagent's `tools:` allow-list
# at all (see .claude/agents/README.md).
#
# Contract: read a Claude Code PreToolUse JSON event from stdin.
#   exit 0           — allow.
#   exit non-zero    — deny. stderr is surfaced to the operator as
#                      the deny reason.
#
# Blocks logged (tab-separated) to .claude/local/blocked-comms.log
# (gitignored under .claude/local/).

set -euo pipefail

EVENT="$(cat)"

# Extract tool_name from the JSON event. We use sed rather than jq so
# this script has zero install-time dependencies. The event is
# well-formed JSON from the harness, so a single regex extraction is
# safe enough for a deny-list check.
TOOL_NAME="$(printf '%s' "$EVENT" \
  | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  | head -n 1)"

# No tool_name in the event → not actionable, allow.
if [[ -z "$TOOL_NAME" ]]; then
  exit 0
fi

# Carve-out: GitHub MCP tools used by the operator for ordinary dev
# (PRs, issues, comments). Defense-in-depth — none of the github
# tool names match the deny patterns below today, but the carve-out
# documents intent and survives future renames.
if [[ "$TOOL_NAME" == mcp__github__* ]]; then
  exit 0
fi

deny_reason=""
case "$TOOL_NAME" in
  gmail_send|send_email|send_sms|message_compose)
    deny_reason="literal-match outbound-comms tool name"
    ;;
  twilio*)
    deny_reason="twilio family — outbound SMS/voice"
    ;;
  mcp__*__send_*)
    deny_reason="MCP tool in send_* family"
    ;;
  *send*|*post*|*publish*|*draft_send*)
    deny_reason="substring match (send|post|publish|draft_send) in tool name"
    ;;
esac

if [[ -n "$deny_reason" ]]; then
  LOG_DIR="$(cd "$(dirname "$0")/.." && pwd)/local"
  mkdir -p "$LOG_DIR"
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '%s\t%s\t%s\n' "$TS" "$TOOL_NAME" "$deny_reason" >> "$LOG_DIR/blocked-comms.log"
  echo "Anchor guardrail: blocked tool '$TOOL_NAME' — $deny_reason." >&2
  echo "Phase 1 doctrine: never autonomous. See CLAUDE.md §7." >&2
  exit 1
fi

exit 0
