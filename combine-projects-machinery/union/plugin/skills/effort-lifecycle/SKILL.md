---
name: effort-lifecycle
description: Use at the START of any effort, before the first commit lands, to create its own isolated working copy, and again at the END to merge, push and tear that copy down. Covers naming it, resetting it onto the branch the work actually targets, committing from it, the green bar before a merge, and the teardown that is not optional.
---

# Effort lifecycle

The rules live in `rules/worktree-discipline.md`, and the rules about which
agent works where live in `rules/agent-topology.md`. This skill is the
sequence; those files are authoritative. Where a step here repeats a rule's
instruction, the rule file wins — and the reason behind a step lives in the
rule file section the step names, not here.

## Does this apply?

Yes, to any effort at all. All work happens in an isolated working copy of its
own, however small the work is. There is no size exception and no threshold of
commits below which the shared copy is acceptable
(`rules/agent-topology.md` § Where an agent works).

The shared copy is reserved for a short, named list of operations that run
there by convention:

- filing a dictated rule — the filing commit is the reserved operation, capture
  being location-independent by mechanism (`hooks/rule-capture.md`); the
  sequence is `skills/rule-intake/SKILL.md`;
- merging a finished effort's branch into the shared line locally, running the
  merge gate on that result, and pushing it once every verification leg on it
  is green;
- creating, listing and tearing down the working copies themselves.

That maps onto this sequence as follows. **Step 3 (create), step 8 (merge and
gate), step 9 (push), step 10 (tear down) and step 11 (list) run from the
project root** — none of them can run from inside the copy they act on, and
step 8's gate judges the merge result, so it runs where that merge is made.
**Steps 4 to 7 run inside the copy.**

If you find yourself about to make a second commit on the shared copy for one
continuous piece of work, you already needed a copy of your own: stop and make
one. That is a backstop, not a licence for the first commit, which did not
belong there either.

## Start

1. **Confirm the go-ahead.** An effort starts only on the owner's explicit go,
   given directly to whoever will run it. An authorization passed along by
   somebody else does not count.

2. **Name the copy for the effort itself** — not for a date, not for a ticket
   number — and give the branch exactly that name, with no added prefix
   (`rules/worktree-discipline.md` § Creating one).

3. **Create the copy with the creation tool** (`hooks/worktree-create.md`),
   not by hand, so the branch cannot end up named something other than the
   copy. The tool prints one thing on success: the new copy's full path. Use
   that path.

4. **First act inside the new copy, before any work: reset it onto the exact
   branch the work targets.** A fresh copy opens on the project's default
   branch, and your own copy of that branch may be newer than the shared one,
   so reset onto whichever is newer. Everything after this step builds on that
   tree (`rules/worktree-discipline.md` § Creating one).

## During

5. **Commit by naming the exact paths you are committing.** Stage the named
   files a change touches, never a blanket add-everything. Never stage the
   owner's own protected working records, whatever else the change touched.
   Put the message and its flags before the path separator: everything after
   that separator is read as a path, including a flag that strays there. What
   else a commit message owes — the trailer, and crediting by name whoever the
   idea came from — is in `rules/worktree-discipline.md` § Committing from it.

6. **Keep the effort's ledger as you go** — what you did, what changed, what
   got better, what regressed, whether it worked, and what smells new. Its
   contract is in `rules/work-tracking.md` § The learnings record. The ledger
   ships with the effort, not after it.

7. **Announce anything temporary you write into the copy before you write
   it.** Name the file and a unique marker to find it by, and remove both when
   the measurement ends. A copy someone else can see is shared state
   (`rules/worktree-discipline.md` § Working in it).

## End

8. **Make the merge locally in the project root, into a private merge result,
   then run the merge gate on that result.** The gate judges the merge result
   and never the branch alone, so the merge has to exist to be judged; making
   it locally is what produces it without publishing it. The battery and how it
   judges are in `gates/merge-gate.md`; the bar it enforces is
   `rules/worktree-discipline.md` § Merging and tearing down. A red result is
   discarded, never pushed — which is cheap precisely because nobody else can
   see it yet.

   Before merging, consider dispatching the enforcement auditor
   (`agents/invariant-auditor.md`) with the effort's diff. It cannot run
   commands, so hand it the diff text or the list of changed files.

   If a build error contradicts what the source plainly says, clear the shared
   incremental cache and rebuild before treating the error as a real breakage
   (`rules/worktree-discipline.md` § Working in it).

9. **Publish step 8's merge result by pushing it, from the project root, once
   every leg on it is green.** Publishing is the deliberate act, and it is the
   only step that makes the merge something other people have to live with.
   Branches kept for exploration are never merged at all without a deliberate
   decision to do so.

10. **From the project root, tear the copy down immediately, in the same
    session: delete the working copy and delete its branch.** This step is not
    optional and it is not a follow-up. The merge is not the end of the
    effort; the teardown is (`rules/worktree-discipline.md` § Merging and
    tearing down).

11. **Before you finish, list from the project root the working copies that
    still exist.** Anything left that is not active work is debt: report it,
    and never quietly delete someone else's. Never delete a copy with
    uncommitted changes without asking first, and release a copy some tool
    holds a lock on through that tool rather than removing it by hand.

<!-- rows: 5.1-5.23, 5.39-5.40 as the sequence; 4.20 for which work needs its own copy and for the by-convention list. The rules themselves stay in rules/worktree-discipline.md: 5.2-5.5 sit in hooks/worktree-create.md, and 5.12-5.14 and 5.22 are pointed at from step 5 rather than restated. -->
