#!/usr/bin/env bash
# The merge gate: what GitHub Actions used to run, run locally instead.
#
# Ruled by Gabe 2026-08-24: "I'm not paying for CI, we should do it on merge
# worktree to main." GitHub Actions had in fact stopped executing on 2026-08-22
# — 100 of the last 100 runs failed in ~2 seconds with zero steps and no runner
# assigned — so the five gates had been enforcing nothing for two days while
# nine merges landed. This script is where they live now.
#
# RUN IT ON THE MERGE RESULT, NOT ON THE BRANCH. That distinction is the whole
# point. On 2026-08-24 GIT_522 compiled perfectly on its own branch and broke
# `main` on merge (E0599: a method the other side had deleted), and GIT_518's
# docs merged cleanly into a format GIT_520 had outlawed thirty minutes earlier.
# A branch that passes tells you nothing about the tree you are about to push.
#
#   usage:  scripts/merge-gate.sh [--base <ref>] [--update-baseline] [--quick]
#
#   --base <ref>        what to diff for the changed-file rustfmt gate.
#                       Default: HEAD^1 when HEAD is a merge commit (i.e. the
#                       pre-merge main), else the merge-base with origin/main.
#   --update-baseline   record the CURRENT failing set as the accepted baseline
#                       instead of judging against it. Use only when you have
#                       decided a change to the red set is correct.
#   --quick             skip the full test sweep (gates 1,2,4,5,6,7,8,9,10 only).
#                       For iterating; never for a merge.
#
# WHY A BASELINE AND NOT AN EXIT CODE. `cargo test --workspace` exits 101 on a
# clean tree here: there is a standing red set (35 tests at time of writing,
# mostly arachne/walls plus fs-slice-server suites that fail to BUILD). Judging
# by exit code would mean either ignoring the gate or never passing it. So the
# gate diffs the failing SET against scripts/merge-gate-baseline.txt and fails
# only on NEW failures. Newly-GREEN tests are reported too, loudly, because a
# test that starts passing is either good news or a test that stopped testing.
#
# TARGET DIRECTORY. Uses its own (target-gate/) by default. Concurrent builds
# from several worktrees into one target dir poison Cargo's cache and produce
# errors that contradict the source — measured 2026-08-24: the same tree gave
# exit 101 with "cannot find `ring_area` in `fs_geometry`" (a symbol that
# plainly exists) in the shared dir and exit 0 in an isolated one. Override with
# FS_GATE_TARGET if you want to share a warm cache and know what you are doing.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

# scripts/testq_verdict.py is now the SOLE parser and renderer of testq.sh's
# --porcelain output (see that module's docstring) -- scripts/merge-gate-render.sh
# (the old bash render_battery()) and its self-test scripts/merge_gate_test.sh
# are DELETED; testq_verdict_test.py ports all 24 of that self-test's
# assertions. Gate 10 below calls the python module's `render` subcommand.
#
# Resolved ONCE, here, before any gate runs: gates 7-9 (governance) already
# require python unconditionally, and gate 10 needs it to render the battery
# verdict. NO SILENT SKIP -- a gate that cannot even run its own parser must
# never be allowed to read as a pass, so an unresolvable interpreter aborts
# this whole script right here, loudly, naming exactly what was checked,
# rather than letting a downstream call fail quietly (e.g. leaving a stale
# --label-out file that gate 10 could misread as a real verdict).
resolve_python() {
  local candidates=(python py python3) c
  for c in "${candidates[@]}"; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys' >/dev/null 2>&1; then
      printf '%s' "$c"
      return 0
    fi
  done
  return 1
}
PYTHON_BIN="$(resolve_python)" || {
  echo "FATAL: no usable Python interpreter found on PATH (checked, in order: python, py, python3)." >&2
  echo "  scripts/testq_verdict.py (gate 10's renderer) and the governance gates (7-9)" >&2
  echo "  both require Python. Refusing to run the merge gate rather than silently" >&2
  echo "  skipping a gate and letting the run read as a pass." >&2
  exit 2
}

# The baseline file (scripts/merge-gate-baseline.txt) is now owned and read
# by scripts/testq.sh -- gate 10 below only renders testq's verdict.
TARGET="${FS_GATE_TARGET:-$REPO_ROOT/target-gate}"
LOGDIR="${FS_GATE_LOGS:-$REPO_ROOT/target-gate/gate-logs}"
BASE_REF=""
UPDATE_BASELINE=0
QUICK=0

while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE_REF="${2:-}"; shift 2 ;;
    --update-baseline) UPDATE_BASELINE=1; shift ;;
    --quick) QUICK=1; shift ;;
    -h|--help) sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

mkdir -p "$LOGDIR"
export CARGO_TARGET_DIR="$TARGET"

# Default base for the rustfmt gate: if HEAD is a merge, the first parent IS
# pre-merge main, which is exactly what CI's `github.event.before` meant.
if [ -z "$BASE_REF" ]; then
  if [ -n "$(git rev-parse -q --verify HEAD^2 2>/dev/null)" ]; then
    BASE_REF="$(git rev-parse HEAD^1)"
  else
    BASE_REF="$(git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD~1)"
  fi
fi

PASS=(); FAIL=(); SKIP=()
RED='\033[31m'; GRN='\033[32m'; YEL='\033[33m'; DIM='\033[2m'; OFF='\033[0m'

# Run one gate. Captures the COMMAND's own exit status -- never a pipe's.
# A trailing `| tail` or `| grep` reports the LAST command's status, which has
# silently turned a red battery green more than once in this repo.
gate() {
  local name="$1"; shift
  local log="$LOGDIR/${name// /_}.log"
  printf "  %-46s" "$name"
  "$@" >"$log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then
    printf "${GRN}pass${OFF}\n"; PASS+=("$name")
  else
    printf "${RED}FAIL${OFF} ${DIM}(exit %d, %s)${OFF}\n" "$rc" "$log"; FAIL+=("$name")
  fi
  return $rc
}

echo
echo "merge gate  —  tree $(git rev-parse --short HEAD)  base $(git rev-parse --short "$BASE_REF")"
echo "  target dir: $TARGET"
echo

# ── Gate 1: everything compiles, including feature-gated targets ──────────────
# Catches the fs-repl class of rot, and the double-global-allocator class: with
# --all-features both mimalloc and hotpath install one. That conflict was fixed
# once, regressed, and a dead CI meant nobody heard.
gate "compile: all features, all targets" \
  cargo check --workspace --all-features --all-targets --locked

# ── Gate 2: the feature-OFF build (GIT_429) ───────────────────────────────────
# --all-features cannot see a crate that BREAKS with a feature off. fs-engine's
# `parallel` is optional and an ungated rayon:: call was invisible to gate 1.
gate "compile: fs-engine, no default features" \
  cargo check -p fs-engine --no-default-features --locked

# ── Gate 3: clippy, correctness + suspicious only ─────────────────────────────
gate "clippy: correctness + suspicious" \
  cargo clippy --workspace --all-targets --locked -- \
    -D clippy::correctness -D clippy::suspicious

# ── Gate 4: rustfmt, CHANGED FILES ONLY, skip_children ────────────────────────
# Whole-tree fmt sweeps ~50 unrelated files; every agent that tried it had to
# revert. skip_children checks THIS file, never the module tree below it.
fmt_gate() {
  # `|| true` on the git diff itself would swallow a REAL git failure (bad
  # BASE_REF, corrupt repo) as an empty file list, which reads identically to
  # "no Rust files changed" -- a crash wearing a pass, the same shape gate 10
  # had. Capture git's own exit status and require it be zero before trusting
  # an empty list.
  local diff_out diff_rc
  diff_out="$(git diff --name-only --diff-filter=ACMR "$BASE_REF" HEAD -- '*.rs' 2>&1)"
  diff_rc=$?
  if [ $diff_rc -ne 0 ]; then
    echo "git diff against base $BASE_REF failed (exit $diff_rc):"
    printf '%s\n' "$diff_out"
    return 1
  fi
  local files=()
  [ -n "$diff_out" ] && mapfile -t files <<< "$diff_out"
  [ "${#files[@]}" -eq 0 ] && { echo "no Rust files changed"; return 0; }
  local fail=0
  for f in "${files[@]}"; do
    [ -f "$f" ] || continue
    case "$f" in */generated/*) continue ;; esac
    rustfmt --edition 2024 --config skip_children=true --check "$f" || fail=1
  done
  return $fail
}
gate "rustfmt: changed files (skip_children)" fmt_gate

# ── Gate 5: config wiring invariant ───────────────────────────────────────────
# The libtest name filter is doing load-bearing work: if `diagnostics::tests`
# is ever renamed or moved, cargo test still exits 0 having matched and run
# ZERO tests ("0 passed; 0 failed" reads identical to a healthy run at the
# exit-code level) -- the exact "ran but proved nothing" shape as gate 10's
# defect, confirmed empirically 2026-08-24. Require the summary line show at
# least one test actually passed before this gate is allowed to pass.
config_wiring_gate() {
  local out rc
  out="$(cargo test -p fs-hub --lib --locked -- diagnostics::tests 2>&1)"
  rc=$?
  printf '%s\n' "$out"
  [ $rc -ne 0 ] && return $rc
  if ! printf '%s\n' "$out" | grep -qE '^test result: ok\. [1-9][0-9]* passed'; then
    echo "GATE: 0 tests matched the diagnostics::tests filter -- no evidence the config wiring invariant actually ran"
    return 1
  fi
  return 0
}
gate "config wiring invariant" config_wiring_gate

# ── Gate 6: invariant scan ratchet ────────────────────────────────────────────
# The scanner's OWN tests run here, before the ratchet reads its numbers.
# fs-invariant-scan is workspace-excluded (span-locations would infect every proc
# macro the engine builds), so `cargo test --workspace` never sees them -- and a
# check nothing runs is not enforcement, which is a detector this very tool
# ships. tests/scan_scope.rs is what pins the scan's SCOPE in both directions:
# a #[test] fn under tests/ is not counted, the same file under src/ is. GIT_CI.
invariant_scan_gate() {
  cargo test --release --manifest-path crates/fs-invariant-scan/Cargo.toml || return 1
  python scripts/invariant_scan_gate.py
}
gate "invariant scan ratchet" invariant_scan_gate

# ── Gates 7-9: governance ─────────────────────────────────────────────────────
gate "governance: register check" python scripts/register_check.py
gate "governance: register self-test"  python scripts/register_check_test.py
gate "governance: pipeline model check" python scripts/pipeline_model_check.py
gate "governance: citation sources" python scripts/citation_source_gate.py
# GIT_708: docs/INVARIANTS.md's own table structure -- not subsumed by any
# other gate here (register_check.py checks citations resolve, not that a
# table row has the right cell count). Backstop for .githooks/pre-commit's
# run of the same script, same rationale as citation_creation_gate.py above:
# core.hooksPath is a local, per-clone git setting nothing enforces, so a
# commit made without it set would otherwise reach main unchecked.
gate "governance: ledger table check" python scripts/check_ledger_tables.py
grep -hE '^check_ledger_tables: ' "$LOGDIR/governance:_ledger_table_check.log" 2>/dev/null \
  | sed 's/^/    /'
# GIT_710: backstop for .githooks/pre-commit's own run of quiet_hook_test.py
# -- same rationale as check_ledger_tables.py just above: core.hooksPath is a
# local, per-clone git setting nothing enforces, so a commit made without it
# would otherwise reach main with this suite never having run. quiet_hook.py
# and quiet_run.py are the live PreToolUse filter (.claude/settings.json);
# this is its only automated coverage.
gate "governance: quiet-hook self-test" python .claude/hooks/quiet_hook_test.py
grep -hE '^quiet_hook_test: ' "$LOGDIR/governance:_quiet-hook_self-test.log" 2>/dev/null \
  | sed 's/^/    /'
gate "governance: fs_config_codegen self-test" python scripts/fs_config_codegen_test.py
gate "governance: config key map ratchet" python scripts/config_key_map.py --check
gate "governance: config key map self-test" python scripts/config_key_map_test.py
gate "governance: ADR 0008 provenance-state gate" python scripts/adr_provenance_gate.py
gate "governance: ADR 0008 provenance-state gate self-test" python scripts/adr_provenance_gate_test.py

# ── Gate: citation creation check (GIT_624/GIT_625) ───────────────────────────
# Backstop for .githooks/pre-commit's own run of this same script: that hook
# only fires for a clone that has `git config core.hooksPath .githooks` set
# (a local, per-clone setting git never enforces), so a commit made without it
# would otherwise reach `main` unchecked. Scoped to BASE_REF..HEAD, two-dot,
# same convention as fmt_gate above -- every citation any commit in this merge
# ADDED, never the register's ~410 pre-existing ones (Gabe's ruling:
# creation-time only, never re-audited).
#
# The rule in CLAUDE.md "A gate script echoes its sub-check's denominator"
# (2026-08-28) exists because `gate()`'s log redirect above swallows every
# line a sub-check prints except pass/FAIL -- measured on fmt_gate's own "no
# Rust files changed" line, invisible outside its log. Comply here without
# touching the shared `gate()` helper (a 16-gate-wide behaviour change is out
# of scope for this ticket): re-read the log this gate() call just wrote and
# echo its one denominator line to this script's own stdout, pass or fail.
gate "governance: citation creation check" python scripts/citation_creation_gate.py --base "$BASE_REF"
grep -h '^citation_creation_gate:' "$LOGDIR/governance:_citation_creation_check.log" 2>/dev/null \
  | sed 's/^/    /'
gate "governance: citation creation gate self-test" python scripts/citation_creation_gate_test.py

# ── Gate 10: the battery, judged by DIFFING the red set ───────────────────────
# The failing-set extraction and the baseline diff both live in ONE place now:
# scripts/testq.sh. This gate used to run its own greps in parallel with
# testq.sh's -- two private opinions of the same libtest output, which is
# exactly the "never re-derive" failure mode (CLAUDE.md): they would have
# disagreed eventually. This gate now only RENDERS testq's verdict in the
# gate's own pass/fail/skip vocabulary; testq.sh owns the parsing, the
# evidence check, and the baseline file.
if [ "$QUICK" -eq 1 ]; then
  printf "  %-46s${YEL}skipped${OFF} (--quick)\n" "battery: workspace tests"
  SKIP+=("battery: workspace tests")
else
  BATLOG="$LOGDIR/battery.log"
  LABEL_OUT="$LOGDIR/battery-label.txt"
  printf "  %-46s" "battery: workspace tests"

  TESTQ_ARGS=(--workspace --porcelain --log "$BATLOG")
  [ "$UPDATE_BASELINE" -eq 1 ] && TESTQ_ARGS+=(--update-baseline)
  TQ_OUT="$(scripts/testq.sh "${TESTQ_ARGS[@]}")"
  TQ_RC=$?

  # scripts/testq_verdict.py's `render` subcommand reads the porcelain text
  # from stdin, writes its display text straight to this process's own
  # stdout (so it streams live exactly as the old inline printfs did), and
  # writes "<category>:<label>" to --label-out so this gate can bucket
  # PASS/FAIL/SKIP without scraping ANSI-coloured text. Its own process exit
  # code mirrors that category (0 pass/skip, 1 fail) but this gate does not
  # rely on that exit code alone -- see the missing-label-file check below.
  rm -f "$LABEL_OUT"
  printf '%s' "$TQ_OUT" | "$PYTHON_BIN" scripts/testq_verdict.py render \
    --testq-rc "$TQ_RC" --log "$BATLOG" --label-out "$LABEL_OUT"

  if [ ! -f "$LABEL_OUT" ]; then
    # NO SILENT SKIP: the renderer did not even write its label file (crashed
    # before finishing, killed, etc). Absence of a verdict must never be
    # readable as a pass -- the same I2 invariant testq_verdict.py itself
    # enforces for the porcelain parse -- so this is a hard FAIL, never a
    # fall-through to an unset or stale bucket.
    echo "GATE: testq_verdict.py render produced no --label-out file -- treating as a hard failure"
    FAIL+=("battery: testq_verdict.py render produced no verdict")
  else
    LABEL_LINE="$(cat "$LABEL_OUT")"
    CATEGORY="${LABEL_LINE%%:*}"
    LABEL="${LABEL_LINE#*:}"
    case "$CATEGORY" in
      pass) PASS+=("$LABEL") ;;
      fail) FAIL+=("$LABEL") ;;
      skip) SKIP+=("$LABEL") ;;
      *)
        echo "GATE: testq_verdict.py render wrote an unrecognised category '$CATEGORY' -- treating as a hard failure"
        FAIL+=("battery: testq_verdict.py render produced an unrecognised category")
        ;;
    esac
  fi
fi

echo
if [ "${#FAIL[@]}" -eq 0 ]; then
  printf "${GRN}MERGE GATE PASSED${OFF}  %d gates, %d skipped\n" "${#PASS[@]}" "${#SKIP[@]}"
  echo
  exit 0
fi
printf "${RED}MERGE GATE FAILED${OFF}  %d of %d gates\n" "${#FAIL[@]}" "$(( ${#PASS[@]} + ${#FAIL[@]} ))"
printf '  %s\n' "${FAIL[@]}"
echo "  logs: $LOGDIR"
echo
exit 1
