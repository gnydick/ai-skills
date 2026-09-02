---
name: reindex
description: Use when the index is reported stale (the post-edit nudge, or the commit gate) after a rule file was edited by hand. Regenerates the generated index; never edit it directly.
---
# /machinery:reindex

- Project: `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --rules .claude/rules --out .claude/machinery/INDEX.md`
- Universal (in the rules-source checkout): `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --rules rules --out register/INDEX.md`

Commit the regenerated index together with the rule change that made it stale.
