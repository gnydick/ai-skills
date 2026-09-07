---
name: spec-intake
description: Use the moment a SPEC: prompt is captured (the capture hook says "run the spec intake now"), when a prompt starts with "N specifications pending in the spec inbox", or when the commit gate reports a pending spec entry. Files the specification into the document under docs/dictated-specs/ that owns the subsystem, regenerates SPEC_INDEX.md, dispositions the entry, commits. Never invents a specification nobody dictated.
---
# /machinery:spec-intake

A `SPEC:` prompt is a specification handed down, not a rule and not a proposal. The rules live in `rules/work-tracking.md` § A specification handed down; this is the sequence. Where this and a rule file disagree, the rule file wins.

1. **List** what is pending: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" list` — one line per entry: `stamp  marker  inbox  first-line`. SPEC entries appear only in a root session; if you are in an isolated working copy, say so and stop — they will be filed from a root session.
2. **Read the verbatim text** from the spec inbox. Decide which specification under `docs/dictated-specs/` owns the subsystem it describes. That judgement is yours and no mechanism makes it — but the destination is not negotiable: it is a file under `docs/dictated-specs/`, and the intake refuses anything else.
3. **The location is fixed**, not per-project: `docs/dictated-specs/` at the project root, with nothing to declare or resolve, and the generated `SPEC_INDEX.md` sits in there with the specifications it indexes. If the directory does not exist yet, the intake creates it — that is a project with no specifications filed, not a misconfiguration. Never file one anywhere else; the gate refuses it.
4. **Write the specification** into that file — a new section, or an amendment to the section that owns it. Keep the dictated wording's substance; a specification is the authoritative design, not a summary of one.
5. **Commit the filing** (spec index regenerated, entry dispositioned, one commit in the project's root checkout):
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind spec --stamp <stamp> --home "<docs/dictated-specs/file.md> § <Heading>"`
6. **Dismiss** instead of file when the dictated text is not a specification (a question, a duplicate): `node "${CLAUDE_PLUGIN_ROOT}/scripts/disposition.mjs" --inbox .claude/machinery/spec-inbox.md --stamp <stamp> --dismissed "<reason>"`, then commit the inbox.
7. Report what was filed where, verbatim `file § Section`, and what was dismissed with its reason. Any work dispatched on the specification cites it by that path rather than restating it.
