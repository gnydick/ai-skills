---
name: refresh-diverged-branch
description: Use when a long-lived parallel edition branch has drifted so far from the line it follows that merging it throws a wall of conflicts, or when both branches have independently rewritten the same shared parts — rebuilds the edition on a fresh copy of the primary line and re-applies only its genuine delta, turning one enormous merge into a few small reviewable grafts.
---

# Refresh a diverged branch

This is one procedure, read or skipped as a unit. Read the premise first: every
step below assumes it, and each step names what it takes from the step before.

## The premise

There are two branches that are parallel editions of the same product, and
they diverge in shared files by design. One is the **primary line**; the other
is the **edition branch**, which follows the primary line and never the
reverse. They share a common ancestor.

Reach for this procedure when either of two things is true:

- merging the primary line into the edition branch throws a wall of conflicts,
  or
- both branches have independently rewritten the same shared parts, so files
  each side created separately now collide.

Ordinary syncing stays the default until it costs more than this rebuild.

What makes the rebuild cheap is that most of those conflicts are not conflicts
at all: the edition branch is simply behind. A file the primary line rewrote
and the edition never meaningfully touched is not a decision to make, it is a
file to take. The genuine work is the handful of files where the edition added
something the primary line does not have. Steps 1 to 3 separate the two so
that only the genuine part is reconciled by hand.

## The steps

1. **Find the common ancestor of the two branches, and list what each side
   changed against it — never one tip against the other.** A tip-to-tip
   comparison reports a file as newly added when both sides added it
   independently, which hides a real collision as a one-sided change. You end
   this step holding two lists: the files the primary line changed since the
   ancestor, and the files the edition branch changed since the ancestor.

   ```sh
   base=$(git merge-base <primary> <edition>)
   git diff --name-only "$base" <primary> | sort > primary-changed.txt
   git diff --name-only "$base" <edition> | sort > edition-changed.txt
   ```

2. **From the two lists made in step 1, form two bins.** The *one-sided* bin
   is every file only the edition branch changed. The *both-changed* bin is
   every file that appears on both lists.

   ```sh
   comm -13 primary-changed.txt edition-changed.txt > one-sided.txt
   comm -12 primary-changed.txt edition-changed.txt > both-changed.txt
   ```

   The one-sided bin needs no decision at all: the primary line never moved
   from the common ancestor for those files, so a three-way merge would return
   the edition's version anyway. They re-apply word for word in step 4. The
   both-changed bin is the only work that needs a judgement, and step 3 makes
   it.

3. **Triage the both-changed bin from step 2 by which way the change ran, not
   by the fact that both sides touched the file.** For each file, compare the
   two branches and read the size and direction of the difference.

   ```sh
   while read -r f; do
     git diff --numstat <primary> <edition> -- "$f"
   done < both-changed.txt
   ```

   - Identical at both tips: nothing to do.
   - The primary line is simply far ahead — it added a great deal and the
     edition trails by thousands of lines: keep the primary line's version and
     graft back only the small hook the edition added. Do not hand-merge
     thousands of stale lines.
   - Both sides changed comparably: this is real divergence, and it is
     reconciled by hand in step 5.

   Two kinds of file skip that judgement entirely. Documentation takes both
   sides' additions. A generated lock file is regenerated, never hand-merged.

   You end this step with the both-changed bin split into *keep the primary
   line's version* and *real divergence*.

4. **Start the rebuilt branch as a fresh copy of the primary line, then
   re-apply the one-sided bin from step 2 word for word.**

   ```sh
   git switch -c <edition>-refresh <primary>
   git checkout <edition> -- $(cat one-sided.txt)
   ```

   Because the branch already *is* the primary line, every file step 3 marked
   *keep the primary line's version* is already correct and needs no action at
   all. What remains is only the *real divergence* set.

5. **Graft the edition's intent onto the real-divergence set from step 3.**
   For each of those files, the edition's intent is what it changed relative
   to the common ancestor found in step 1:

   ```sh
   git diff "$base"..<edition> -- <file>
   ```

   Apply only the small identifiable blocks that carry that intent onto the
   primary line's current version, which may have been reorganized around
   them. Do not replay the whole file.

6. **Re-home any file that exists on the edition line alone.** It goes into
   that edition's own module — never back into shared code behind a
   conditional-compilation switch. The shared side keeps the interface; the
   edition supplies the implementation, and consumers' imports are updated to
   match. This is what stops that file from being a shared-file conflict at
   every future refresh, so it is not optional tidying.

7. **Verify the branch you built in steps 4 to 6, before promoting it.** Run
   the ordinary tests and checks, plus a build for the edition's own target.
   Where shared interface or engine code moved, exercise it by hand on real
   hardware: a clean graft can still change what a person sees, and no test
   that runs on your own machine catches that. Then confirm that the features
   the primary line added still carry their own tests — a rebuild can quietly
   drop the coverage that came with them.

8. **Switch over as a separate, deliberate step.** Promote the verified branch
   from step 7 onto the real edition branch only when it is production-worthy.
   Never automatically.

## Conditions you may hit

- **No access to the remote.** This method needs none: it works against a
  local copy of the primary line that you build yourself. A guarded sync
  script that fetches first does not work without that access, so do not reach
  for it.
- **You may fall back to merging later.** Keep conflict-resolution recording
  switched on: resolutions recorded on one chase replay on the next. The
  rebuild simply avoids those conflicts instead of resolving them.
- **You need the disk back from a stale working copy.** Delete its rebuildable
  build output first, not a branch. That is nearly all of the space, and it
  costs no branch and no source.

<!-- rows: 5.24-5.38 -->
