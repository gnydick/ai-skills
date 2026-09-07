---
name: reindex
description: Use when a generated index is reported stale (the post-edit nudge, or the commit gate) after a rule file or a dictated specification was edited by hand. Regenerates either index — the rules index (RULES_INDEX.md) or the spec index (SPEC_INDEX.md); never edit one directly.
---
# /machinery:reindex

- Project: `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --rules .claude/rules --out .claude/machinery/RULES_INDEX.md`
- Universal (in the rules-source checkout): `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --rules rules --out register/RULES_INDEX.md`
- Specs, project (the index sits with the other generated index, not with the specifications it indexes): `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --kind specs --rules docs/dictated-specs --out .claude/machinery/SPEC_INDEX.md`
- Specs, universal (in the rules-source checkout): `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --kind specs --rules docs/dictated-specs --out register/SPEC_INDEX.md`

Commit the regenerated index together with the rule change that made it stale.
