# Subagents

Fresh-context subagents Claude Code can spawn from the parent session.
One file per agent. Format: Markdown with YAML frontmatter.

## Frontmatter contract

```yaml
---
name: trial-monitor              # invoked as @trial-monitor
description: One sentence on when to use this agent.
tools:                           # explicit allow-list — anything not listed
  - Read                         # is denied. Never include Write/Edit/Bash
  - mcp__clinicaltrials__*       # in any agent that touches external data.
  - mcp__biomcp__*
model: sonnet                    # optional override
---

Body is the system prompt the subagent runs with.
```

## Cold-start rule

A subagent is a cold session — it sees its own frontmatter + the prompt
the parent passes, and **nothing else** from the parent's context.
Brief it like a colleague who just walked into the room: state the
goal, the inputs to read, the output shape, and the constraints.

## Phase 1 inhabitants

- `trial-monitor.md` — runs the shortlist daily, returns a delta vs the
  prior run snapshot. Read-only allow-list, no write/edit/bash.

## Outbound-comms invariant

No subagent in this repo wires a tool whose name implies outbound
communication (`*send*`, `*post*`, `*publish*`, `*draft_send*`,
`gmail_send`, `twilio*`, `mcp__*__send_*`). The PreToolUse hook in
`.claude/hooks/block-outbound-comms.sh` is the second-line failsafe; the
first line is **not listing those tools in `tools:` at all**.
