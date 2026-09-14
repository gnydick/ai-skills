---
name: reload
description: Load when the user runs /machinery:reload, or after a filing changed core.md mid-session. Prints the current core.md (and with --project the project's .claude/rules) into this session without restarting.
---
# /machinery:reload

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/reload.mjs" --scratchpad "<this session's scratchpad>"` (`--project` adds `.claude/rules/`, `--all` prints every file; with no scratchpad omit the flag).
2. Read the returned blocks.
