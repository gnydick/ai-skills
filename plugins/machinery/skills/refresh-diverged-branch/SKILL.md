---
name: refresh-diverged-branch
description: Load when merging the primary line into a long-lived edition branch throws a wall of conflicts, or when both branches have rewritten the same shared files. Rebuilds the edition on a fresh copy of the primary line and re-applies only its own changes.
---
# Refresh a diverged branch

Two branches are editions of one product: the primary line, and the edition branch that follows it. Ordinary merging stays the default until it costs more than these steps. No remote access is needed.

1. List each side's changes against the common ancestor, never tip against tip:
   ```sh
   base=$(git merge-base <primary> <edition>)
   git diff --name-only "$base" <primary> | sort > primary-changed.txt
   git diff --name-only "$base" <edition> | sort > edition-changed.txt
   ```
2. Bin them:
   ```sh
   comm -13 primary-changed.txt edition-changed.txt > one-sided.txt
   comm -12 primary-changed.txt edition-changed.txt > both-changed.txt
   ```
3. Triage each both-changed file by `git diff --numstat <primary> <edition> -- "$f"`:
   - identical at both tips: nothing to do;
   - primary far ahead: keep the primary version, graft back only the edition's small hook;
   - comparable changes on both sides: real divergence.
   Documentation takes both sides' additions. A generated lock file is regenerated.
4. `git switch -c <edition>-refresh <primary>`, then `git checkout <edition> -- $(cat one-sided.txt)`.
5. For each both-changed file, read `git diff "$base"..<edition> -- <file>` and apply only the blocks carrying the edition's intent onto the primary version. Never replay the whole file.
6. Move each edition-only file into the edition's own module behind a shared interface, never into shared code behind a conditional-compilation switch; update imports.
7. Verify: the hooks' tests plus a build for the edition's target; a hands-on run on real hardware where shared interface or engine code moved; confirm the primary line's new features still have their tests.
8. Promote the refresh branch onto the real edition branch only as a separate step, on the owner's decision.
- Keep `git config rerere.enabled true` in case you fall back to merging.
