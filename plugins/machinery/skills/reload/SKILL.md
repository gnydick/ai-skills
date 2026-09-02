---
name: reload
description: Use after a universal rule is filed, or when a rule file changed outside intake, to put the current rule files into this session's context without restarting. `--project` includes the project's own rules.
---
# /machinery:reload

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/reload.mjs"` (add `--project` to include `.claude/rules/`) and read the output: those are the rule files as they stand now. Other sessions pick them up at their next start.
