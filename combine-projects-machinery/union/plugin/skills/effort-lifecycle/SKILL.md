---
name: effort-lifecycle
description: Use at the START of any effort that will take more than one commit — before the first commit lands — to create its own isolated working copy, and again at the END to merge, push and tear that copy down. Covers naming it, resetting it onto the branch the work actually targets, committing from it, the green bar before a merge, and the teardown that is not optional.
---

# Effort lifecycle

The rules live in `rules/worktree-discipline.md`, and the rules about which
agent works where live in `rules/agent-topology.md`. This skill is the
sequence, not a restatement of either. Where this skill and a rule file
disagree, the rule file wins.

## Does this apply?

Yes, for any effort at all. All work happens in an isolated working copy of
its own, however small the work is; there is no size exception, and no
threshold of commits below which the shared copy is acceptable.

The shared copy is reserved for a short, named list of operations that run
there by convention:

- filing a dictated rule — both the capture and the filing commit — so that
  every active working copy sees the new rule at its next session start;
- merging a finished effort's branch into the shared line once every
  verification leg is green, and pushing it;
- creating, listing and tearing down the working copies themselves.

Steps 8 and 9 below are on that list, which is why they run from the project
root rather than from the copy. Everything else in this sequence runs inside
the copy.

If you find yourself about to make a second commit on the shared copy for one
continuous piece of work, you already needed a copy of your own: stop and make
one. That is a backstop, not a licence for the first commit, which did not
belong there either.

## Start

1. **Confirm the go-ahead.** A multi-commit effort starts only on the owner's
   explicit go, given directly to whoever will run it. An authorization passed
   along by somebody else does not count.

2. **Name the copy for the effort itself** — not for a date, not for a ticket
   number. The name is how anyone else tells what is running in it, and the
   branch takes exactly that name with no added prefix.

3. **Create the copy with the creation tool** (`hooks/worktree-create.md`),
   not by hand, so the branch cannot end up named something other than the
   copy. The tool prints one thing on success: the new copy's full path. Use
   that path.

4. **First act inside the new copy, before any work: reset it onto the exact
   branch the work targets.** A fresh copy is not there — it opens on the
   project's default branch, and your own copy of that branch may be newer
   than the shared one, so reset onto whichever is newer. Everything after
   this step builds on that tree, so getting it wrong means the whole effort
   is built on a stale base.

## During

5. **Commit by naming the exact paths you are committing.** A commit that just
   takes whatever is staged sweeps in whatever else was lying around, and that
   has put unrelated files into commits before. Stage the named files a change
   touches, never a blanket add-everything. Never stage the owner's own
   protected working records, whatever else the change touched. Put the
   message and its flags before the path separator: everything after that
   separator is read as a path, including a flag that strays there.

6. **Keep the effort's ledger as you go** — what you did, what changed, what
   got better, what regressed, whether it worked, and what smells new. Its
   contract is in `rules/work-tracking.md`, under the learnings record. The
   ledger ships with the effort, not after it.

7. **Announce anything temporary you write into the copy before you write
   it.** A working copy someone else can see is shared state: name the file
   and a unique marker to find it by, and remove both when the measurement
   ends. Unannounced live instrumentation is indistinguishable from
   unexplained drift, and the honest response to unexplained drift is to
   revert it, which destroys the measurement mid-run.

## End

8. **Get green on the merge gate, run on the merge result.** The battery and
   how it judges are in `gates/merge-gate.md`. Two things this sequence owes
   it: the gate runs against the merged tree and never against the branch
   alone, because the other side may have deleted what you call or outlawed
   the form you wrote since you branched; and every required leg passes before
   the merge starts, because passing one leg is not passing.

   Before merging, consider dispatching the enforcement auditor
   (`agents/invariant-auditor.md`) with the effort's diff. It cannot run
   commands, so hand it the diff text or the list of changed files.

   If a build error contradicts what the source plainly says, working copies
   have poisoned the shared incremental cache: clear it and rebuild before
   treating the error as a real breakage.

9. **Merge from the project root, then push.** Branches kept for exploration
   are never merged automatically; merging one is always a deliberate
   decision.

10. **Tear the copy down immediately, in the same session: delete the working
    copy and delete its branch.** This step is not optional and it is not a
    follow-up. Each copy carries its own build output, and stale ones have run
    to hundreds of gigabytes. The merge is not the end of the effort; the
    teardown is.

11. **Before you finish, list the working copies that still exist.** Anything
    left that is not active work is debt: report it, and never quietly delete
    someone else's. Never delete a copy with uncommitted changes without
    asking first, and release a copy some tool holds a lock on through that
    tool rather than removing it by hand.

<!-- rows: 5.1-5.23, 5.39-5.40 as the sequence; 4.20 for which work needs its own copy and for the by-convention list. The rules themselves stay in rules/worktree-discipline.md: 5.2-5.5 sit in hooks/worktree-create.md, and 5.12-5.14 and 5.22 are referenced from step 5 rather than restated. -->
