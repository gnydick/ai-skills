---
name: refresh-diverged-branch
description: Use when a long-lived parallel branch (e.g. the Android edition `maindroid` chasing PC `main`) has diverged so far that a straight merge is a painful multi-conflict fight. Rebuilds the downstream edition on a FRESH copy of upstream and re-applies only the genuine delta, turning an N-way merge into a few small reviewable grafts.
---

# Refresh a diverged branch onto fresh upstream (instead of merging)

## When to use

Two branches are **parallel editions of the same app** that diverge in shared files
*by design* and must periodically re-sync (here: `main` = PC edition, `maindroid` =
Android edition — see `docs/ANDROID-MAIN-SYNC.md`). Reach for this skill when:

- The downstream branch is far behind (hundreds of commits) and a `merge` throws a
  wall of conflicts, **or**
- The two lines independently rewrote the *same* shared subsystems (add/add
  conflicts on files both sides created), **or**
- You just want a clean base rather than carrying a tangled merge history forward.

The standard cheap-sync path is still `scripts/sync-main.sh` + rerere (merge, never
rebase). Use THIS skill when that path has become too expensive to be worth it.

## The core insight

**Most "conflicts" in a long-diverged branch aren't real conflicts — the downstream
branch is just *behind*.** A file that upstream rewrote (+884/−4470) and downstream
never meaningfully touched is not a merge decision; it's "take upstream." The genuine
work is the handful of files where downstream added platform-specific hooks upstream
lacks. This skill separates the two so you only hand-reconcile the real delta.

## Procedure

### 1. Establish the base and both change-sets

```sh
MB=$(git merge-base <upstream> <downstream>)          # e.g. main / maindroid
git diff --name-only "$MB" <upstream>   | sort > /tmp/up.txt
git diff --name-only "$MB" <downstream> | sort > /tmp/down.txt
```

### 2. Split into three groups (this is the whole trick)

```sh
# [A] ONLY downstream changed → main untouched → re-apply VERBATIM, zero conflict.
comm -13 /tmp/up.txt /tmp/down.txt

# [B] BOTH changed → the true reconciliation set (== the conflicts a merge shows).
comm -12 /tmp/up.txt /tmp/down.txt
```

For **[A]**, upstream == base, so a 3-way merge result is exactly downstream's
version → `git checkout <downstream> -- <file>` is the correct, safe re-apply.

### 3. Triage [B] by churn DIRECTION, not just presence

```sh
# main→downstream numstat: big -deletions mean downstream is just BEHIND upstream.
while read f; do
  git diff --numstat <upstream> <downstream> -- "$f" | awk -v F="$f" '{printf "%-52s +%s -%s\n", F, $1, $2}'
done < /tmp/both.txt
```

Read the numbers:
- **Identical at tips** (no numstat) → nothing to do.
- **Upstream is a superset** (`-N` huge, `+` tiny — downstream trails by thousands of
  lines) → **keep upstream's version**, then cherry-graft only the small platform hook
  (often one `pub` export or a `mod` line). Don't hand-merge thousands of stale lines.
- **Balanced churn** (`+` and `-` comparable) → genuine divergence; upstream base +
  re-apply the platform delta by hand.
- **Docs** (CLAUDE.md, ADRs) → merge both sides' additions.
- **Lockfiles** (Cargo.lock) → regenerate, don't hand-merge.

### 4. Build the refresh branch

```sh
git switch -c <downstream>-refresh <upstream>          # fresh copy of upstream
git checkout <downstream> -- $(cat /tmp/only_downstream_files.txt)   # [A] verbatim
```

Because the branch **already is upstream**, every [B] "keep upstream" file is already
correct — you do nothing to it. The only remaining work is grafting the few platform
hooks from step 3.

### 5. Graft the genuine platform hooks

For each real [B] hook, the platform *intent* is `git diff "$MB"..<downstream> -- <file>`.
Apply only the small identifiable blocks onto upstream's current version (upstream may
have refactored around them). Typical hooks: a `pub` on a previously-private const,
per-platform `[target.'cfg(...)']` deps, an injection point for a per-platform trait
impl, a platform-specific layout constant.

### 6. Platform-specific code goes in platform-specific CRATES

Non-negotiable architecture rule (see `CLAUDE.md` "Per-Platform Crate Splits"): when
re-homing a file that exists only on the downstream line, do **not** restore it into a
shared crate behind `#[cfg]`. Move it into that platform's own crate (the `FileAccess`
/ nav pattern: trait in the shared crate, concrete impl injected from the platform
crate). Update its consumers' imports `shared_crate::x` → `crate::x`. This is what
keeps the *next* refresh cheap — the file stops being a shared-file conflict forever.

### 7. Verify, then promote

- Host: `cargo test --workspace && cargo clippy --all-targets` (format only touched
  files — never a workspace-wide `cargo fmt`).
- Platform build: e.g. `cargo ndk -t arm64-v8a -o android/app/src/main/jniLibs build --release -p fs-ui-app-android`.
- Smoke-test on device/emulator when shared GUI/engine code moved — a clean graft can
  still change rendered behavior no host test catches.
- Per `CLAUDE.md`: anything new (fn/method/feature/fix) needs its unit test + fixture +
  integration coverage. Verify upstream's added features kept theirs.
- Promote to the real downstream branch as a **separate, deliberate** step, only when
  the refresh branch is production-worthy. Never auto-merge.

## Gotchas learned the hard way

- **Direct-tip diff over-counts vs merge-base diff.** `git diff <up> <down>` marks a
  file `A` (add) even when *both* sides added it independently since the base — that's
  an add/add conflict, not an upstream-only file. Always categorize from the
  merge-base (step 2), not the tips.
- **No remote? Chase a *local* upstream.** If `git fetch` has no access, you cannot use
  the fetch-guarded sync script. Trust a local `upstream` you just built and re-apply
  by hand — the method above needs no remote.
- **rerere still helps** if you later fall back to merging: resolutions recorded on one
  chase replay on the next. But a refresh sidesteps the conflicts entirely.
- **Delete stale build caches first, not branches.** A diverged worktree's disk is
  almost all rebuildable `target/`; `rm -rf <worktree>/target` reclaims it without
  touching any branch or source.
