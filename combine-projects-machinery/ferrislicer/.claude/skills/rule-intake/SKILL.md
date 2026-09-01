---
name: rule-intake
description: File a dictated or discovered rule into the design-decision register (docs/RULES-GROUPED.md) — finds the group it joins or the entry it supersedes, writes the durable home first, and dispositions the rule-inbox entry. Use immediately when a RULE:-marked prompt is captured, when the pre-commit gate reports a PENDING inbox entry, or when any change adds/changes/supersedes a standing rule.
---

# Rule intake

**Trust property, stated first: this skill is NOT load-bearing.** Capture and
enforcement are hooks and scripts (`.claude/hooks/rule_capture.py`,
`.githooks/pre-commit`, `scripts/register_check.py`, CI). If this skill never
runs, no rule can be silently lost — commits stay blocked until the inbox is
drained. This skill is the procedure for doing the drain WELL. The judgement
steps (which group, what it supersedes) are structured here and confirmed by
Gabe; no hook can force them to be right, only force them to happen.

## The steps — in order, none skipped

1. **Write it down first (durable home).** The register CITES, it never
   ORIGINATES. Land the rule where it lives:
   - process / working-agreement hard rules → `CLAUDE.md`
   - engine/design rules → the active campaign spec (or the doc that owns the
     subsystem's design)
   - enforcement-strength claims (rungs) → `docs/INVARIANTS.md`
   The register row will cite this `file:line`.

2. **Candidate search (token-cheap).** Read only the register's Contents list
   and the summaries of plausible groups; grep the register body for the rule's
   key nouns. Shortlist at most 2–3 candidate groups. Present the shortlist to
   Gabe with a one-line reason each.

3. **Conflict check.** For each candidate: does the new rule AGREE, REFINE, or
   CONTRADICT the group's standing? A contradiction IS a wobble — and a rule
   Gabe dictated is an adjudication: update "The wobble / Where it ended" with
   the new verdict, flip the circle (🟢 unless Gabe marks it tentative), and
   stamp any doc carrying the losing rule per the supersession protocol in the
   register's maintenance-contract header.

4. **Placement.**
   - Fits an existing group → append a row: `| <today> | <rule, one sentence> |
     \`<durable-home file:line>\` |`.
   - No fitting group, but related Solo rules exist → promote them together
     into a NEW group with a summary and status circle.
   - No siblings → row in the matching Solo area; no fitting area → new area.

5. **Disposition + same commit.** Replace the inbox entry's
   `Disposition: PENDING` with `Disposition: filed — <group> (<file:line>)`
   (or `not a rule — <reason>` if Gabe dismisses it). Commit the durable home,
   the register, and the inbox TOGETHER (pathspec commit, GIT_n marker).
   `git commit` will refuse until `register_check.py --fast` is green.

## Red flags

- "I'll note it in the register only" — no: durable home first, register cites.
- "This obviously supersedes X" — supersession is Gabe's call when the losing
  rule was ever his; propose, don't presume.
- "The inbox entry can wait" — it can't; it blocks every commit by design.
