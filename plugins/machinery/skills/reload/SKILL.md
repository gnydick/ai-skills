---
name: reload
description: Use after a universal rule is filed, or when a rule file changed outside intake, to put the current rule files into this session's context without restarting. `--project` includes the project's own rules.
---
# /machinery:reload

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/reload.mjs" --scratchpad "<this session's scratchpad directory>"` — substitute the scratchpad path your own system prompt names. Add `--project` to include `.claude/rules/`, which joins the same comparison. Add `--all` to print every file whatever has been shown before. If this session has no scratchpad directory, leave the flag off; the run then prints everything and says on its output that it remembered nothing.

Read the delimited blocks that come back: those are the rule files as they stand now, and only the ones whose text differs from what this session has already been handed. The scratchpad holds that record, so it is per session by construction — the first run after a session starts prints all of them, which is right, because a fresh session has been shown none of them.

The last line is always `machinery_reload: N files, M changed`. `M` at zero is an answer, not a missing one: every file was read and compared, and nothing had moved. Other sessions pick the files up at their next start.
