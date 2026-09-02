#!/bin/sh
# sweep_guard.sh (GIT_700) - ADVISORY-ONLY pre-commit sweep guard.
#
# Fires when the staged set is docs-shaped EXCEPT for at least one
# NEWLY-TRACKED (git-added) file outside CLAUDE.md/docs/** - the signature
# of a wildcard `git add <dir>` sweeping a stray untracked file into a docs
# commit (incident 5465f460; post-mortem on GIT_698, issue #698). Modified
# (not added) files under scripts/ are tolerated as governance plumbing
# (gate baselines legitimately move with docs commits); any OTHER staged
# modified/deleted non-doc file means a deliberate mixed commit and the
# guard stays silent - an advisory that fires on every feature commit
# trains everyone to ignore it (see CI - gate integrity, red-gate rule).
#
# Prints its denominators when it fires (N staged / M newly-tracked /
# K suspects) per CLAUDE.md "A gate script echoes its sub-check's
# denominator"; silent runs print nothing, matching the pre-commit hook's
# existing advisory convention. NEVER affects commit outcome: always exit 0.

staged=$(git diff --cached --name-only 2>/dev/null) || exit 0
added=$(git diff --cached --diff-filter=A --name-only 2>/dev/null) || exit 0

# Suspects: newly-tracked files outside CLAUDE.md and docs/**.
suspects=$(printf '%s\n' "$added" | grep -E . | grep -Ev '^(CLAUDE\.md$|docs/)')
[ -n "$suspects" ] || exit 0

# Docs-shaped requires at least one staged docs path.
docs_n=$(printf '%s\n' "$staged" | grep -Ec '^(CLAUDE\.md$|docs/)')
[ "$docs_n" -gt 0 ] || exit 0

# Staged-but-not-added paths (modifies/deletes/renames) outside docs and
# scripts/ disqualify docs-shape: that is a deliberate mixed commit.
# staged + added + added, then uniq -u keeps only staged-not-added lines.
others=$(printf '%s\n%s\n%s\n' "$staged" "$added" "$added" | grep -E . | sort | uniq -u | grep -Ev '^(CLAUDE\.md$|docs/|scripts/)')
[ -z "$others" ] || exit 0

staged_n=$(printf '%s\n' "$staged" | grep -c .)
added_n=$(printf '%s\n' "$added" | grep -c .)
suspect_n=$(printf '%s\n' "$suspects" | grep -c .)
echo "ADVISORY: sweep-guard denominator: $staged_n staged, $added_n newly-tracked, $suspect_n non-doc suspect(s)."
printf '%s\n' "$suspects" | while IFS= read -r f; do
  echo "ADVISORY: docs commit stages a newly-tracked non-doc file: $f - confirm not swept by a wildcard git add."
done
exit 0
