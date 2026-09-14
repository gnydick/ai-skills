# Machinery rewrite draft — summary
All 518 machinery items appear exactly once in `disposition.csv`. "Item words" counts the source items each file replaces; merged, dropped, mechanism and open items count toward the file where they would have lived. Core is 13 lines. rule-intake, spec-intake and reload are merged into `rule-process`, effort-lifecycle into `worktree`, and reindex is dropped (10). The auditor, the invariant-audit skill and the ledger rules are parked (19).

| Destination | Lines | Words | Item words | Kept | Merged | Dropped | Mech | Parked | Open |
|---|---|---|---|---|---|---|---|---|---|
| core.md | 13 | 399 | 1121 | 11 | 20 | 2 | 0 | 0 | 0 |
| testing | 40 | 776 | 1541 | 19 | 17 | 11 | 4 | 0 | 0 |
| worktree | 33 | 556 | 2317 | 22 | 22 | 7 | 6 | 0 | 2 |
| tickets | 28 | 417 | 690 | 18 | 2 | 0 | 0 | 0 | 0 |
| agents | 34 | 565 | 1362 | 20 | 17 | 3 | 0 | 0 | 0 |
| rule-process | 22 | 385 | 2751 | 14 | 18 | 37 | 22 | 0 | 0 |
| instrumentation | 23 | 373 | 997 | 15 | 5 | 5 | 0 | 0 | 0 |
| tooling | 28 | 439 | 827 | 13 | 9 | 0 | 5 | 0 | 0 |
| design (pending) | 46 | 641 | 1904 | 25 | 21 | 0 | 0 | 0 | 0 |
| install | 10 | 132 | 311 | 4 | 3 | 0 | 6 | 0 | 0 |
| postmortem | 11 | 152 | 97 | 1 | 1 | 1 | 0 | 0 | 0 |
| train-tool | 14 | 231 | 473 | 10 | 1 | 0 | 1 | 0 | 0 |
| refresh-diverged-branch | 30 | 329 | 775 | 12 | 10 | 0 | 0 | 0 | 0 |
| comparison-agent | 27 | 275 | 538 | 17 | 5 | 0 | 0 | 0 | 0 |
| parked → unbreakable (19) | — | — | 1809 | 0 | 0 | 0 | 0 | 54 | 0 |
| **Total** | 359 | 5670 | 17513 | 201 | 151 | 66 | 44 | 54 | 2 |

| Skill | Kept (new wording ← source) | Dropped (decision) |
|---|---|---|
| core | "Before doing anything that differs from what was agreed, stop and say so." ← M175 | M271 learnings versioned with the change (7) |
| testing | "TDD red: write one new test… Run only that test… It must fail" ← M217 | M194 predict what is left alone (6) |
| worktree | "Commit only the named paths… message and flags before `--`" ← M300 | M19 all work in a worktree however small (9) |
| tickets | "Create a companion only for an effort that will span more than one session" ← M252 | none (M265 merged into core, 7) |
| agents | "Reuse a kind's agent for every task of that kind, one task at a time" ← M18 | M2 size never decides dispatch (12) |
| rule-process | "URULE: core.md if it holds for every kind of work…; otherwise skills/<kind>" ← M388 | M156 stamp supersession both ways (10) |
| instrumentation | "A timer wraps only the work, never the condition…" ← M239 | M112 profiling annotation on every touched function (5) |
| tooling | "Every refusal message names the cause and the command that fixes it" ← M126 | none |
| design | "Compute each fact or classification once, where it is owned" ← M62 | none |
| install | "Tell the user that transcripts older than that are deleted…" ← M339 | none (M341 `--hosted` → wizard, 14) |
| postmortem | "The agent answers, citing transcript lines or commits…" ← M164 | M162 automatic post-mortem (17) |
| train-tool | "Never write the matcher or a regex yourself" ← M412 | none |
| refresh-diverged-branch | "List each side's changes against the common ancestor, never tip against tip" ← M354 | none |
| comparison-agent | "Save the complete output to a file and read every row" ← M425 | none (M431 full table → output path) |

## Mechanisms needed
1. `capture.mjs` (3, 10): messages stop mentioning index regeneration and name the new skill. "PRULE captured verbatim to <inbox> (PENDING). Commits are refused until it is filed: run /machinery:rule-process."
2. Pre-commit inbox check (3, 10): `register-check.mjs` cut down to pending entries only; `spec-check.mjs` keeps pending and path checks. "commit refused: 2 pending entries in .claude/machinery/inbox.md — run /machinery:rule-process" / "commit refused: <stamp> filed to <path>, outside docs/dictated-specs/ — refile with /machinery:rule-process"
3. Removals (10), no message: `reindex.mjs`, `nudge.mjs` and its PostToolUse hook, the index and citation checks, RULES_INDEX.md, SPEC_INDEX.md, `supersedes` frontmatter.
4. `place.mjs` / `intake.mjs` (1, 2, 10): write to `core.md` or `skills/<kind>/SKILL.md`, no index step.
5. Pre-commit hook (13, 15, tiers): build/format checks plus fast-tier tests of the components the commit touches. "commit refused: fast tests failed in <crate> — run `cargo test -p <crate>`, fix, commit again"
6. Pre-push hook (13 amended): only when pushing to main, whole workspace in place. "push refused: working tree not clean or HEAD <a> is not pushed <b> — commit, check out <b>, push again" / "push refused: workspace tests failed (<cmd>) — fix, commit, push again"
7. Tier selection (tiers): hooks pick tests by declared tier. "test <name> declares no tier — add a fast, merge or heavy declaration"
8. `gate.mjs` (3, 13): final line no longer offers the `--no-verify` bypass. "commit refused: <check> failed — run the fix command printed above"
9. `intake.mjs` (3): root-session refusals name the fix. "isolated worktree: run /machinery:rule-process from the project root session"
10. `install.mjs` retention (18): prints `cleanupPeriodDays` and asks. "transcript retention: cleanupPeriodDays=<n> (default 30); older transcripts are deleted and /postmortem cannot see that work. Keep <n>?"
11. `install.mjs --hosted-ci` wizard (14): turns hook commands into GitHub Actions workflows, replacing `templates/hosted-check.yml` and `--hosted`. "hosted-ci: no pre-commit or pre-push commands found — run /machinery:install first"
12. Project worktree setting (9): read by the worktree skill. `worktree-create.mjs` already strips prefixes, refuses empty names, reads `worktree.baseRef`.
13. Background compile check (15): bacon `check` → `grep --line-buffered` → `uniq` → Monitor.
14. `banner.mjs` (13): hosted-check line still says "local merge gate"; reword to the pre-push hook.

## Open questions
1. How does `core.md` get loaded every session (rules junction or plugin), and does `reload.mjs` still apply to skills? M342, M380, M475, M485.
2. Name, values and default of the project worktree setting? M19, M20, M241, M258.
3. Syntax that declares a test's tier in each language? M222, M223, M275.
4. Does the sweep-guard advisory stay in the slimmed pre-commit? M304, M507.
5. Is the comparison agent a merge-tier step (pre-push) or heavy-tier (on request)? M417, M418.
6. Is a person plus an adversarial review still required before generated content reaches main? M36.
7. Should a PreToolUse hook refuse `--no-verify` instead of relying on a prose line? M497.
8. Design skill: stays in machinery or parked with unbreakable? Design rows in M51–M122.
9. M270 (never edit the owner's problem description) went into tickets though records placement waits for developer-friendliness. Confirm.
