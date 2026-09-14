---
name: worktree
description: Load before the first commit of any piece of work, before any git commit, merge or push, and when creating, listing or deleting a worktree. Holds the project's worktree setting, the steps of an effort from start to teardown, how to commit, and what may be merged to main. Replaces effort-lifecycle.
---
# Worktrees and commits

## Before starting
- Read the project's worktree setting. If it does not require a worktree for this work, work in the current checkout and skip steps 2, 3 and 7.
- At most one agent works in a worktree unless the owner says otherwise.
- A hands-on run, stand-in service or reviewer exercising in-progress work runs from its own worktree of that branch, never the one being edited. Deleting a worktree does not stop a process started from it: stop the process first.
- If a build error contradicts what the source plainly says, clear the incremental build cache and rebuild before treating it as real.

## Effort steps
1. A multi-commit effort starts only on the owner's explicit go, given directly to whoever runs it. Relayed approval does not count.
2. Create the worktree with the worktree tool (EnterWorktree), never a hand `git worktree add`. Name it for the work, not a date or ticket number. Use the path it prints.
3. First act inside it: reset onto the exact branch the work targets, using whichever of your local and the remote copy of that branch is newer.
4. Work and commit (below). Touch nothing above the project root unless asked.
5. Before landing a structural change that other open branches depend on, get sign-off from whoever owns those branches.
6. From the project root, merge locally, then `git push`. If the pre-push hook refuses, fix or discard the local merge. Merge an exploration branch only on the owner's explicit decision.
7. Right after the push, from the project root, in the same session: delete the worktree and its branch. To reclaim disk from a stale worktree you keep, delete its build output.
8. Before finishing: `git worktree list` from the project root; report any worktree that is not active work. Never delete someone else's; never delete one with uncommitted changes without asking; release one a tool holds a lock on through that tool.

## Committing
- Commit only the named paths the change touches: `git commit -m "<message>" -- <path>...`, message and flags before `--`. Never `git add -A` or `git add .`.
- Never stage the owner's own protected working records.
- The message says why, names the ticket, credits by name any person whose idea, diagnosis, algorithm or fix it uses (also in the code comment), and ends with the assistant trailer.
- A correctness fix never rides in a performance commit; it gets its own commit and test.
- Never pass `--no-verify` to `git commit` or `git push`.

## What may be merged to main
- Only code with nothing broken that a user can reach. Passing hooks are required, not sufficient.
- Incomplete code merges only when nothing in production can call it. A reachable control that does nothing, a default that warns on every run, a path that answers wrongly: finish it or make it unreachable first.
- An effort may land in pieces, each clearing this bar.
