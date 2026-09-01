#!/usr/bin/env bash
# gen_issue_rules_doc.sh (GIT_706) -- renders docs/github-issue-rules.md from
# docs/github-issue-rules.template.md (a placeholder, never rule text) plus
# the tracking-work rules block extracted from its ONE editable home,
# docs/rules/tracking-work.md.
#
# Supersedes issue_rules_drift_gate.sh's (GIT_704) detect-only check -- that
# script was deleted in GIT_706 and is recoverable at 1e0291f5. It could only
# notice a hand-authored copy had drifted; the template
# removes the second home a divergent copy could ever be typed into. Honest
# rung (GIT_706 design constraint): the generated artifact is still a file on
# disk and CAN be hand-edited transiently -- what keeps that out of history
# is this script's --check wired blocking in .githooks/pre-commit, not the
# file format. Do not read this as a stronger rung than that.
#
#   usage:  scripts/gen_issue_rules_doc.sh              regenerate the artifact in place
#           scripts/gen_issue_rules_doc.sh --check       verify artifact == fresh render; on mismatch it REGENERATES
#                                                        the artifact in place and STILL exits nonzero (a hand edit
#                                                        to the artifact is discarded -- the authority is the only
#                                                        place to change the text); re-stage and commit again
#           scripts/gen_issue_rules_doc.sh --self-test   red-check fixture
#
# GREEN (--check) prints its own denominator (lines rendered/compared) per
# CLAUDE.md "A gate script echoes its sub-check's denominator". RED prints a
# unified diff and says to regenerate, never to hand-edit. Missing template,
# missing authority, or a missing marker in either is its own RED path naming
# the gap -- never a silent skip (CLAUDE.md "Warn loudly").
#
# No env-var configuration, no -q flags anywhere (CLAUDE.md "The environment
# is read once" / "No -q flag under the quiet hook" -- -q deletes the proof
# line).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

TEMPLATE_FILE="docs/github-issue-rules.template.md"
AUTHORITY_FILE="docs/rules/tracking-work.md"
ARTIFACT_FILE="docs/github-issue-rules.md"
MARKER_NAME="tracking-work"
PLACEHOLDER="{{TRACKING_WORK_RULES}}"
GEN_COMMAND="bash scripts/gen_issue_rules_doc.sh"

# extract_block FILE MARKER_NAME
# Prints the BEGIN/END marker lines and everything between them, inclusive.
# Exit 2 if BEGIN missing, 3 if END missing.
extract_block() {
  local file="$1" name="$2"
  local begin="<!-- DRIFT-GATE:BEGIN ${name} -->"
  local end="<!-- DRIFT-GATE:END ${name} -->"
  awk -v b="$begin" -v e="$end" '
    $0 == b { seen_begin=1; inblock=1; print; next }
    $0 == e { seen_end=1; inblock=0; print; next }
    inblock { print }
    END {
      if (!seen_begin) exit 2
      if (!seen_end) exit 3
    }
  ' "$file"
}

# render -- writes the rendered artifact to stdout. Returns nonzero (message
# to stderr, nothing useful on stdout) if the template, the authority, either
# marker, or the placeholder is missing.
render() {
  if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "gen_issue_rules_doc: RED -- template missing: $TEMPLATE_FILE" >&2
    return 2
  fi
  if [ ! -f "$AUTHORITY_FILE" ]; then
    echo "gen_issue_rules_doc: RED -- authority missing: $AUTHORITY_FILE" >&2
    return 2
  fi
  if ! grep -qF -- "$PLACEHOLDER" "$TEMPLATE_FILE"; then
    echo "gen_issue_rules_doc: RED -- placeholder '$PLACEHOLDER' not found in $TEMPLATE_FILE" >&2
    return 2
  fi

  local block_file
  block_file="$(mktemp "${TMPDIR:-/tmp}/gen_issue_rules_doc.block.XXXXXX")"
  extract_block "$AUTHORITY_FILE" "$MARKER_NAME" > "$block_file"
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    rm -f "$block_file"
    if [ "$rc" -eq 2 ]; then
      echo "gen_issue_rules_doc: RED -- missing '<!-- DRIFT-GATE:BEGIN ${MARKER_NAME} -->' in $AUTHORITY_FILE" >&2
    else
      echo "gen_issue_rules_doc: RED -- missing '<!-- DRIFT-GATE:END ${MARKER_NAME} -->' in $AUTHORITY_FILE" >&2
    fi
    return 2
  fi

  cat <<HEADER
<!-- GENERATED FILE -- DO NOT EDIT.
     Rendered by ${GEN_COMMAND} from:
       template:  ${TEMPLATE_FILE}
       authority: ${AUTHORITY_FILE} (marker: ${MARKER_NAME})
     Regenerate: ${GEN_COMMAND}
     Hand edits are overwritten by the next regeneration and caught by
     '${GEN_COMMAND} --check', wired blocking in .githooks/pre-commit.
-->

HEADER

  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$line" = "$PLACEHOLDER" ]; then
      cat "$block_file"
    else
      printf '%s\n' "$line"
    fi
  done < "$TEMPLATE_FILE"

  rm -f "$block_file"
  return 0
}

run_generate() {
  local rendered rc
  rendered="$(render)"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    return "$rc"
  fi
  printf '%s\n' "$rendered" > "$ARTIFACT_FILE"
  local n
  n="$(wc -l < "$ARTIFACT_FILE")"
  echo "gen_issue_rules_doc: wrote ${ARTIFACT_FILE} (${n} lines) from ${TEMPLATE_FILE} + ${AUTHORITY_FILE}"
  return 0
}

run_check() {
  local rendered rc
  rendered="$(render)"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    return "$rc"
  fi
  if [ ! -f "$ARTIFACT_FILE" ]; then
    echo "gen_issue_rules_doc --check: RED -- artifact missing: $ARTIFACT_FILE (run: $GEN_COMMAND)" >&2
    return 2
  fi

  local tmp_file
  tmp_file="$(mktemp "${TMPDIR:-/tmp}/gen_issue_rules_doc.check.XXXXXX")"
  printf '%s\n' "$rendered" > "$tmp_file"

  local rendered_lines artifact_lines
  rendered_lines="$(wc -l < "$tmp_file")"
  artifact_lines="$(wc -l < "$ARTIFACT_FILE")"

  if diff -q "$tmp_file" "$ARTIFACT_FILE" >/dev/null 2>&1; then
    echo "gen_issue_rules_doc --check: OK -- ${rendered_lines} lines rendered, byte-identical to ${ARTIFACT_FILE}"
    rm -f "$tmp_file"
    return 0
  fi

  echo "gen_issue_rules_doc --check: RED -- ${ARTIFACT_FILE} has drifted from its fresh render (rendered ${rendered_lines} lines, on-disk ${artifact_lines} lines):"
  diff -u "$tmp_file" "$ARTIFACT_FILE" | sed "1s|.*|--- fresh render (from ${TEMPLATE_FILE} + ${AUTHORITY_FILE})|; 2s|.*|+++ ${ARTIFACT_FILE} (on disk)|"
  # Leave the corrected render in the working tree so the fix is a re-stage,
  # never a hand-edit -- the commit itself is still blocked (nonzero exit).
  cp -- "$tmp_file" "$ARTIFACT_FILE"
  echo "gen_issue_rules_doc --check: regenerated ${ARTIFACT_FILE} in place -- review and re-stage it (never hand-edit); commit still blocked this run."
  rm -f "$tmp_file"
  return 1
}

# run_self_test -- red-check fixture. Perturbs the REAL artifact and REAL
# authority in place (there is no second copy to perturb -- that is the
# point of the by-construction upgrade), restores each byte-for-byte
# immediately after its sub-test, and verifies via `git status --porcelain`
# that the perturb/restore cycle left no net trace on the working tree.
run_self_test() {
  local before_status after_status
  before_status="$(git status --porcelain -- "$ARTIFACT_FILE" "$AUTHORITY_FILE" "$TEMPLATE_FILE" 2>/dev/null)"

  local tmp
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/gen_issue_rules_doc.selftest.XXXXXX")"
  trap 'rm -rf "$tmp"' RETURN

  cp -- "$ARTIFACT_FILE" "$tmp/artifact.orig"
  cp -- "$AUTHORITY_FILE" "$tmp/authority.orig"

  local overall_pass=0
  local results=()

  # 1/4: baseline (unperturbed) must be GREEN.
  local out rc
  out="$(run_check 2>&1)"; rc=$?
  results+=("sub-result 1/4 (baseline, expect GREEN, rc=0): rc=${rc}")
  results+=("$(printf '%s\n' "$out" | sed 's/^/  /')")
  [ "$rc" -eq 0 ] || overall_pass=1

  # 2/4: hand-edit the artifact -> RED.
  { cat "$tmp/artifact.orig"; echo "<!-- synthetic hand-edit injected by --self-test -->"; } > "$ARTIFACT_FILE"
  out="$(run_check 2>&1)"; rc=$?
  results+=("sub-result 2/4 (hand-edited artifact, expect RED, rc!=0): rc=${rc}")
  results+=("$(printf '%s\n' "$out" | sed 's/^/  /')")
  [ "$rc" -ne 0 ] || overall_pass=1
  cp -- "$tmp/artifact.orig" "$ARTIFACT_FILE"

  # 3/4: edit the authority's marked block without regenerating -> RED.
  sed 's/Related bugs share one worktree\./Related bugs share ONE WORKTREE (synthetic drift injected by --self-test)./' \
    "$tmp/authority.orig" > "$AUTHORITY_FILE"
  out="$(run_check 2>&1)"; rc=$?
  results+=("sub-result 3/4 (authority edited, not regenerated, expect RED, rc!=0): rc=${rc}")
  results+=("$(printf '%s\n' "$out" | sed 's/^/  /')")
  [ "$rc" -ne 0 ] || overall_pass=1
  cp -- "$tmp/authority.orig" "$AUTHORITY_FILE"
  # run_check self-heals the artifact to match whatever authority it just
  # saw (including the mutated one) when it goes RED -- restore the artifact
  # too, now that the authority is back, or 4/4 below sees a stale render.
  cp -- "$tmp/artifact.orig" "$ARTIFACT_FILE"

  # 4/4: both restored -> GREEN again.
  out="$(run_check 2>&1)"; rc=$?
  results+=("sub-result 4/4 (restored, expect GREEN, rc=0): rc=${rc}")
  results+=("$(printf '%s\n' "$out" | sed 's/^/  /')")
  [ "$rc" -eq 0 ] || overall_pass=1

  after_status="$(git status --porcelain -- "$ARTIFACT_FILE" "$AUTHORITY_FILE" "$TEMPLATE_FILE" 2>/dev/null)"

  printf '%s\n' "${results[@]}"

  if [ "$before_status" != "$after_status" ]; then
    echo "gen_issue_rules_doc --self-test: RED -- perturb/restore left the working tree different from before self-test ran"
    echo "  before: ${before_status:-<clean>}"
    echo "  after:  ${after_status:-<clean>}"
    overall_pass=1
  else
    echo "gen_issue_rules_doc --self-test: working tree restored byte-for-byte (git status --porcelain unchanged)"
  fi

  if [ "$overall_pass" -eq 0 ]; then
    echo "gen_issue_rules_doc --self-test: PASS -- 4/4 sub-results as expected + working tree restored"
    return 0
  fi
  echo "gen_issue_rules_doc --self-test: FAIL -- see sub-results above"
  return 1
}

case "${1:-}" in
  --check)
    run_check
    exit $?
    ;;
  --self-test)
    run_self_test
    exit $?
    ;;
  "")
    run_generate
    exit $?
    ;;
  *)
    echo "gen_issue_rules_doc: unknown argument '$1' (usage: gen_issue_rules_doc.sh [--check|--self-test])" >&2
    exit 2
    ;;
esac
