---
name: campaign
description: Use at the START of any multi-commit engine or feature effort — before the first commit lands — to create the campaign worktree, and again at the END to merge and REMOVE it. Covers the base-ref gotcha, pathspec commits, the green battery required before merge, and the mandatory worktree teardown that keeps `.claude/worktrees` from growing without bound.
---

# Campaign lifecycle

The rules live in `CLAUDE.md` and load into every request already. This skill is the
**sequence**, not a restatement of them. Where the two disagree, `CLAUDE.md` wins.

## Does this apply?

| Work | Where it runs |
|---|---|
| Multi-commit engine or feature effort (fill-level merge, overhang-cliff fix, Benchy hull line) | **campaign — own worktree** |
| One-commit fix | `main` directly |
| Docs or preset tweak | `main` directly |

If you are about to make the *second* commit on `main` for one continuous piece of work,
you already needed a worktree. Stop and create one before going further.

## 1. Create

Prefer the `EnterWorktree` tool. This project's `.claude/settings.json` sets
`worktree.baseRef: "head"`, so it branches from **local** `HEAD` — which is what you want
when `main` is ahead of `origin`.

That setting does **not** cover `Agent`/`Workflow` `isolation: "worktree"`, which branches
from `origin/<default>` regardless. If a campaign runs through an isolation worktree while
local `main` is ahead, reset the worktree onto local `main` before doing any work, or the
campaign is built on a stale base.

By hand:

```bash
git worktree add .claude/worktrees/<name>
```

Name it for the campaign, not for a date or a ticket.

## 2. Commit

Always with an explicit pathspec:

```bash
git commit -m "feat(engine): …" -- crates/fs-slice/src/chain.rs crates/fs-clipper/src/lib.rs
```

`-m` goes **before** `--`. Everything after `--` is a pathspec, including a `-m` that
strays there. A bare `git commit` commits the whole index, and worktrees share index
semantics that have swept unrelated files into a commit before — the repo root routinely
carries untracked STL, G-code, and PNG scratch files that must never land.

Credit the user by name for any idea, diagnosis, algorithm, or fix that originated with
them, in the commit message and in the code comment.

## 3. Prove it green — all three legs

Do not start the merge until every leg passes. Green on one leg is not green.

| Leg | Command | The trap |
|---|---|---|
| Workspace tests | `cargo test --workspace --no-fail-fast` | **Never** truncate the output — no `head`, no `Select-Object -First`. Without `--no-fail-fast` a later failure hides behind an earlier one. |
| Goldens | the golden suites in `fs-integration` | Never rebake a golden to make it pass. A rebaked golden proves the engine agrees with its own last output and nothing else. |
| Oracle | dispatch the `parity-verifier` agent | Judge by **diffing the mismatch set against baseline**, never by exit code — one mismatch is pre-existing. |

If build errors contradict the source — a `pub` symbol "not found", a signature mismatch
whose reported line doesn't match the real `fn` — the shared worktrees have poisoned
Cargo's incremental cache. `cargo clean`, rebuild, and only then call it a real breakage.

Before merging, consider dispatching `invariant-auditor` with the campaign diff. It has no
shell, so hand it the diff or the file list.

## 4. Merge

Merge the campaign branch to `main` only after step 3 is fully green.

Research branches (`performance_research`, `total_research`) are **never** auto-merged.

## 5. Remove — this step is not optional

Immediately after the merge, in the same working session:

```bash
git worktree remove .claude/worktrees/<name>
git branch -d <name>
```

Every worktree carries its own `target/`. Skipping this has put ~230 GB on disk. The
merge is not the end of the campaign; the teardown is.

`.perf-worktrees/` slots are separate and managed by `scripts/perf.sh worktree-rm <slot>` —
do not remove those with raw `git worktree remove` while a measurement holds the lock.

## 6. Check the floor before you leave

```bash
git worktree list
```

Anything listed that is not an active campaign is debt from a previous one. Report it —
do not silently remove someone else's worktree, and do not remove any worktree with
uncommitted changes without asking first.
