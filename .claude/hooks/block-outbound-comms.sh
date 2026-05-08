#!/usr/bin/env bash
# Anchor — never-autonomous + no-deploy guardrail (Phase 1).
#
# This is the second-line failsafe: codified denial of any tool
# invocation that would either communicate outbound or mutate
# production state. The first line is not wiring such tools into any
# subagent's `tools:` allow-list at all (see .claude/agents/README.md).
#
# Doctrine references:
#   CLAUDE.md §7 — never autonomous (no sends, posts, drafts, publishes).
#   CLAUDE.md §7 #4 — no deploy in Phase 1 (no push to main, no
#                     Vercel changes, no prod DB migrations).
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

# Extract tool_name from the JSON event. Sed (no jq dependency).
TOOL_NAME="$(printf '%s' "$EVENT" \
  | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  | head -n 1)"

# No tool_name in the event → not actionable, allow.
if [[ -z "$TOOL_NAME" ]]; then
  exit 0
fi

# Carve-out: GitHub MCP tools. The operator uses these for ordinary
# dev (PR comments, issue comments, branch + file management). The
# trial-monitor and any future read-only subagents must NOT include
# these in their per-subagent tools allow-list.
#
# Exceptions inside the carve-out — explicitly blocked even via the
# operator's main session, because they violate Phase 1 doctrine:
#   merge_pull_request → "no push to main" implies no merge to main.
case "$TOOL_NAME" in
  mcp__github__merge_pull_request)
    deny_reason="Phase 1 doctrine: no push to main (CLAUDE.md §7 #4)"
    ;;
  mcp__github__*)
    exit 0
    ;;
esac

if [[ -z "${deny_reason:-}" ]]; then
  case "$TOOL_NAME" in
    # ── Outbound comms (CLAUDE.md §7) ──────────────────────────────
    gmail_send|send_email|send_sms|message_compose)
      deny_reason="literal-match outbound-comms tool name"
      ;;
    twilio*)
      deny_reason="twilio family — outbound SMS/voice"
      ;;
    mcp__*__send_*)
      deny_reason="MCP tool in send_* family"
      ;;
    mcp__*__create_draft|mcp__*__update_draft|mcp__*__list_drafts)
      deny_reason="Gmail-style draft surface — drafts are outbound prep (CLAUDE.md §7)"
      ;;
    mcp__*__create_event|mcp__*__delete_event|mcp__*__update_event|mcp__*__respond_to_event)
      deny_reason="calendar mutation — outbound shared-state change (CLAUDE.md §7)"
      ;;
    mcp__*__add_toolbar_reaction|mcp__*__edit_toolbar_message|mcp__*__reply_to_toolbar_thread|mcp__*__change_toolbar_thread_resolve_status)
      deny_reason="toolbar comms surface — outbound (CLAUDE.md §7)"
      ;;
    *send*|*post*|*publish*|*draft_send*)
      deny_reason="substring match (send|post|publish|draft_send) in tool name"
      ;;

    # ── No deploy / no prod mutation (CLAUDE.md §7 #4) ─────────────
    mcp__*__deploy_to_vercel|mcp__*__deploy_edge_function)
      deny_reason="Phase 1 doctrine: no deploy (CLAUDE.md §7 #4)"
      ;;
    mcp__*__apply_migration|mcp__*__execute_sql)
      deny_reason="Phase 1 doctrine: no prod DB mutation (CLAUDE.md §7 #4)"
      ;;
    mcp__*__pause_project|mcp__*__restore_project|mcp__*__create_project|mcp__*__delete_branch|mcp__*__merge_branch|mcp__*__reset_branch|mcp__*__rebase_branch)
      deny_reason="Phase 1 doctrine: no project / branch mutation on shared infra (CLAUDE.md §7 #4)"
      ;;
    mcp__*__confirm_cost)
      deny_reason="Phase 1 doctrine: no cost-incurring confirmation (CLAUDE.md §7 #4)"
      ;;
  esac
fi

if [[ -n "${deny_reason:-}" ]]; then
  LOG_DIR="$(cd "$(dirname "$0")/.." && pwd)/local"
  mkdir -p "$LOG_DIR"
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '%s\t%s\t%s\n' "$TS" "$TOOL_NAME" "$deny_reason" >> "$LOG_DIR/blocked-comms.log"
  echo "Anchor guardrail: blocked tool '$TOOL_NAME' — $deny_reason." >&2
  echo "See CLAUDE.md §7 (never autonomous, no deploy)." >&2
  exit 1
fi

exit 0
