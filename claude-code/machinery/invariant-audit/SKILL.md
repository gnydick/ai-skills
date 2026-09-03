---
name: invariant-audit
description: Use when asked to run the invariant audit, audit the invariants, audit this diff or branch, or before merging an effort. Exports the current branch diff with audit-diff.mjs, dispatches the read-only machinery:invariant-auditor agent on it, relays findings unchanged, and requires each dispositioned before merge.
---
# /machinery:invariant-audit

The mechanical form of `effort-lifecycle/SKILL.md` step 8's "hand it the diff
text or the list of changed files" — this skill produces both and dispatches
the auditor with them.

1. **Run the export**, from inside the working copy being audited:

   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-diff.mjs" [--out <path>]
   ```

   Line 1 of stdout is the diff file's path; every following line is a
   changed file. The script fails closed — no repo, no real base, or an empty
   diff each exit non-zero and write nothing — and that failure is the whole
   answer: there is nothing to audit yet.

2. **Dispatch the `machinery:invariant-auditor` agent** with the Agent tool.
   It is a review kind of task: one at a time, never alongside another
   reviewer (`rules/agent-topology.md` § How many at once). Hand it exactly:
   the diff file's path, the changed-file list from step 1, the working
   copy's path, and where the enforcement ledger lives — a project states its
   own location; for this plugin it is
   `docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md` §
   Invariant ledger. The agent cannot run commands, edit, or write
   (`agents/invariant-auditor.md`), so never ask it to.

3. **Relay its findings in the fixed shape it returns them in, unchanged.**
   Claim, implied strength, delivered strength, and what to do — copied, not
   summarized down to a verdict.

4. **Disposition every finding by name before any merge**: fixed now,
   declined with the owner's stated reason, or filed as its own follow-up
   ticket pair. A "not clean" verdict with even one undispositioned finding
   blocks the merge outright.

5. The rules behind this are `rules/design-invariants.md` § Weak claims and the enforcement ledger, and `rules/verification-and-evidence.md` § What the check could actually see. Read them there; this skill does not restate them.
