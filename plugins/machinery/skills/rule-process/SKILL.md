---
name: rule-process
description: Load the moment a PRULE:, URULE: or SPEC: prompt is captured (the capture hook says so), when a prompt starts with "N rules pending" or "N specifications pending", when a commit is refused for a pending inbox entry, or when the owner rules something in conversation without a marker. Files or dismisses each pending entry and commits. Replaces rule-intake and spec-intake.
---
# Rules and specifications

- File only what was dictated. A rule you think of yourself is a proposal to the owner.
- An owner ruling given in conversation without a marker: append it by hand to the project inbox (a PRULE or SPEC) or to the user's inbox `~/.claude/machinery/inbox.md` (a URULE), with a note saying why capture did not fire, then file it below.
- Never edit or delete an inbox entry except its disposition line. A duplicate is dismissed with a note, not removed.
- A URULE is universal for the user: its one home is `~/.claude/rules/universal.md`. It never edits the plugin's `core.md` or a skill — those change only by editing the machinery repo.

## Steps
1. List pending entries: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" list`. A project rule or a specification is filed only from the root session (intake refuses otherwise: stop); a universal rule is filed from anywhere.
2. Read each entry's verbatim text and choose its one home:
   - PRULE: a section of a file under `.claude/rules/`.
   - URULE: `~/.claude/rules/universal.md`, as one dated bullet (no section).
   - SPEC (a specification to implement, not a rule or proposal): the file under `docs/dictated-specs/` that owns the subsystem, as a new section or an amendment to the owning one, keeping the dictated substance. Find its existing tickets; do not invent any.
   Word a rule as a trigger and an action. Do not repeat it in any other file.
3. Write a project rule: `node "${CLAUDE_PLUGIN_ROOT}/scripts/place.mjs" --file <file> --section "<Heading>" --text "<wording>"`. Write a specification with Edit.
4. Commit a project filing and its disposition: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind project|spec --stamp <stamp> --home "<file> § <Heading>"`.
5. File a universal rule: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" universal --stamp <stamp> --text "<wording>"`. It appends the dated bullet, dispositions the entry and names the file; there is nothing to build, bump or commit.
6. Or dismiss a non-rule (a question, a duplicate): `node "${CLAUDE_PLUGIN_ROOT}/scripts/disposition.mjs" --inbox <inbox> --stamp <stamp> --dismissed "<reason>"`, then commit a project inbox (the user's inbox is not in a repository).
7. After a URULE filing: `node "${CLAUDE_PLUGIN_ROOT}/scripts/reload.mjs" --scratchpad "<this session's scratchpad>"` (`--project` adds `.claude/rules/`, `--all` prints every file; with no scratchpad omit the flag). Read the returned blocks.
8. Report one line per entry: the file (and `§ Heading` for a project rule or specification), or dismissed with the reason. Work dispatched on a specification cites it by that path.
