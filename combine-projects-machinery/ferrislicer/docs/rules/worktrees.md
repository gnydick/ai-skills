# CLAUDE.md § Worktrees — full rule

One per campaign. A campaign is any multi-commit engine or feature effort
(fill-level merge, overhang-cliff fix, Benchy hull line); one-commit fixes and
docs/preset tweaks run on `main`.

- Branch name is the worktree name verbatim — no `worktree-`/`claude/` prefix.
  Create with `git worktree add .claude/worktrees/<name> -b <name>`. The
  WorktreeCreate hook in `.claude/settings.json` enforces this for tool-created
  worktrees (EnterWorktree, agent isolation).
- Lifecycle: `git worktree add .claude/worktrees/<name>` (or EnterWorktree), commit
  there, merge to `main` once green on the full battery (workspace tests, goldens,
  oracle), then delete worktree and branch immediately. Stale ones have reached
  ~230 GB, each with its own `target/`.
- Commit with explicit pathspecs (`git commit -- <paths>`). The shared index has
  swept unrelated files before. Mechanical backstop added 2026-08-30 (GIT_700,
  from the 5465f460 incident post-mortem on #698): the pre-commit hook runs
  `scripts/sweep_guard.sh`, an advisory-only guard that warns, with its
  denominators, when an otherwise docs-shaped staged set includes a
  newly-tracked file outside CLAUDE.md/docs/ - the wildcard-add sweep
  signature. It never blocks; the pathspec discipline above remains the rule,
  the guard is its backstop for the commit that forgets it.
- Agent/isolation worktrees branch from `origin/<default>`, not local HEAD. If `main`
  leads origin, reset onto local `main` first.
- Inside a worktree, anything above the repo root is off limits unless asked for.
- A shared worktree is SHARED STATE. A session that writes TEMPORARY
  instrumentation into one announces the file and a unique marker string
  BEFORE writing, and removes both when the measurement ends. Unannounced, a
  live probe is indistinguishable from unexplained drift in `git status` --
  and the honest response to unexplained drift is to revert it, which
  destroys the measurement mid-run. Announcing costs one sentence; the
  ambiguity recurs every time anyone instruments a worktree someone else can
  see. (Proposed by the `Rounding` session 2026-08-26 after its GIT_542
  provenance probe -- +153 lines in `crates/fs-engine/src/lib.rs` -- surfaced
  to a concurrent session as an unexplained ` M ` and was nearly reverted
  while the measurement was still running; ruled by Gabe the same day.)
