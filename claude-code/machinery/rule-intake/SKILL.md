---
name: rule-intake
description: Use the moment a PRULE: or URULE: prompt is captured (the capture hook says "run the intake sequence now"), when a prompt starts with "N rules pending — running intake", or when the commit gate reports a PENDING entry. Files each pending rule into its home, regenerates the index, dispositions the entry, commits. Never self-files a rule nobody dictated.
---
# /machinery:rule-intake

The rules live in `rules/rule-governance.md`; this is the sequence. Where this and a rule file disagree, the rule file wins.

1. **List** what is pending: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" list` — one line per entry: `stamp  marker  inbox  first-line`. PRULE entries appear only in a root session; if you are in an isolated working copy, say so and stop — they will be filed from a root session.
2. **For each entry**, read the verbatim text from the inbox. Decide the final wording (one plain statement of what to do and when), the rule file it joins, and the section — for a project rule under `.claude/rules/`, for a universal rule under the rules source's `rules/`. Before folding it into a group that looks like its home, ask whether that group's own remedy would have produced this rule's fix; if not, it is a different rule — new section.
3. **Supersession:** if the rule replaces an existing section, add a `supersedes` entry to the new home's frontmatter (`section`, `by`, `date`); the index derives the reverse link.
4. **Write the home** with the only bullet writer: `node "${CLAUDE_PLUGIN_ROOT}/scripts/place.mjs" --file <rule file> --section "<Heading>" --text "<wording>"`.
5. **Commit the filing** (index regenerated, entry dispositioned, one commit in one repository; universal also bumps the plugin version):
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind project|universal --stamp <stamp> --home "<file> § <Heading>"`
6. **Dismiss** instead of file when the dictated text is not a rule (a question, a duplicate): `node "${CLAUDE_PLUGIN_ROOT}/scripts/disposition.mjs" --inbox <inbox> --stamp <stamp> --dismissed "<reason>"`, then commit the inbox.
7. **Universal only:** `/machinery:reload` so this session sees the rule now.
8. Report what was filed where, verbatim `file § Section`, and what was dismissed with its reason.
