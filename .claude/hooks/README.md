# Hooks

Shell scripts the Claude Code harness runs at lifecycle points
(`PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, etc.).

## Registration

A script in this folder is **inert** until registered in
`.claude/settings.json` (or `settings.local.json`). Registration ties a
script to a hook event + an optional matcher pattern.

## Contract

Hook scripts read a JSON event from stdin and signal the harness via
exit code:

- **Exit 0** → allow.
- **Exit non-zero** → deny. The script's stderr is surfaced to the
  user as the deny reason.

A `PreToolUse` event payload looks like:

```json
{
  "tool_name": "mcp__github__add_issue_comment",
  "tool_input": { "...": "..." },
  "session_id": "...",
  "transcript_path": "..."
}
```

## Phase 1 inhabitants

- `block-outbound-comms.sh` — codifies the "never autonomous" guardrail.
  Denies any tool whose name matches `*send*`, `*post*`, `*publish*`,
  `*draft_send*`, `gmail_send`, `twilio*`, `mcp__*__send_*`. Carves out
  `mcp__github__*` (Thomas uses these for normal dev — PRs, issues,
  comments). Blocks are logged to `.claude/local/blocked-comms.log`
  (gitignored).

The hook is the **second-line failsafe**. The first line is not listing
outbound-comms tools in any subagent's `tools:` allow-list at all.
