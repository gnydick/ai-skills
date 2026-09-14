# Machinery rewrite draft — summary
All 518 machinery items appear exactly once in `disposition.csv` (checked by script against `all-rules.json`: 518 rows, 518 distinct ids, none missing or extra; every dropped, merged, mechanism and parked row has a decision; no open rows). Core is 13 lines. rule-intake, spec-intake and reload are merged into `rule-process`, effort-lifecycle into `worktree`; reindex is dropped (10). Parked with unbreakable: the auditor, invariant-audit and ledger rules (19, 54 rows) and the design rules (24, 46 rows: 25 kept plus the 21 merged into them; draft moved unchanged to `parked-unbreakable/design/`).

| File | Lines | Words | Kept | Merged in |
|---|---|---|---|---|
| core.md | 13 | 399 | 11 | 20 |
| skills/testing | 41 | 819 | 19 | 17 |
| skills/worktree | 36 | 659 | 22 | 22 |
| skills/setup (new, 22–28) | 43 | 765 | 1 | 0 |
| skills/agents | 34 | 565 | 20 | 17 |
| skills/tickets | 29 | 478 | 18 | 2 |
| skills/tooling | 28 | 439 | 13 | 9 |
| skills/rule-process | 22 | 385 | 14 | 18 |
| skills/instrumentation | 23 | 373 | 15 | 5 |
| skills/refresh-diverged-branch | 30 | 329 | 12 | 10 |
| skills/train-tool | 14 | 231 | 10 | 1 |
| skills/postmortem | 11 | 152 | 1 | 1 |
| skills/install | 10 | 101 | 2 | 2 |
| agents/comparison-agent | 27 | 275 | 17 | 5 |
| **Shipped total** | 361 | 5970 | 175 | 129 |

Disposition totals: skill 164, core 11, merged 130, dropped 66, mechanism 47, parked 100, open 0. (One more merged row, M475, points at the M342 mechanism.)

Setup extends #99 rather than starting a second conversation: its `issue-tracking` item runs #99's conversation and commands (`issue-tracking.mjs decide`, `record-project`, `record-global`; build branch `issue-tracking-build`) and #99's files, and every other item uses #99's conversation shape (labelled example, only unknown questions, one at a time, `<placeholders>`, checks never write). #99 defines no setup skill, command or `config.json`; where it conflicts with decisions 21–28, see open questions 3–6. Install now holds only mechanical installation; retention moved to setup.

## Mechanisms needed
1. `capture.mjs` (3, 10): "PRULE captured verbatim to <inbox> (PENDING). Commits are refused until it is filed: run /machinery:rule-process."
2. Pre-commit inbox check (3, 10): `register-check.mjs` cut to pending entries; `spec-check.mjs` keeps pending and path checks. "commit refused: 2 pending entries in .claude/machinery/inbox.md — run /machinery:rule-process"
3. Removals (10), no message: `reindex.mjs`, `nudge.mjs` and its PostToolUse hook, index and citation checks, RULES_INDEX.md, SPEC_INDEX.md, `supersedes` frontmatter.
4. `place.mjs` / `intake.mjs` (1, 2, 10): write to `core.md` or `skills/<kind>/SKILL.md`, no index step; root-session refusal names the fix (3).
5. Pre-commit hook (13, 15, 23, 25): build/format checks, `tiers.fast` for touched components, and the sweep-guard advisory (warns, never blocks). "commit refused: fast tests failed in <component> — run `<tiers.fast>`, fix, commit again"
6. Pre-push hook (13 amended, 23): only when pushing to main; runs `tiers.merge` in place. "push refused: working tree not clean or HEAD <a> is not pushed <b> — commit, check out <b>, push again"
7. Tier selection (23): hooks read `tiers` from `.claude/machinery/config.json`. "commit refused: no tiers recorded in .claude/machinery/config.json — run /machinery:setup tiers"
8. `gate.mjs` (3, 13): final line no longer offers a `--no-verify` bypass.
9. Core loading (21): machinery's `hooks.json` gains a `SessionStart` and a `SubagentStart` hook that inject `core.md` as `additionalContext`; replaces the `~/.claude/rules/machinery` junction `install.mjs --machine` creates. Machinery is enabled per project with `claude plugin install machinery@ai-skills --scope project|local`.
10. `--no-verify` hook (29): PreToolUse on Bash|PowerShell returns `permissionDecision: "ask"` for any command containing `--no-verify`; reason "--no-verify skips the commit/push hooks (<which>). Allow?".
11. Setup wizard (18, 22, 23, 26, 27, 28): skill `/machinery:setup` (whole) and `/machinery:setup <item>` (re-run one item); `setup.mjs show` and `setup.mjs set <key> <value>` validate `worktree`, `tiers.*`, `comparisonAgent`, `comparisonPaths`, `reviewBeforeMain`. "worktree: '<value>' is not accepted — use always, multi-commit or never"
12. `install.mjs --hosted-ci` wizard (14): hook commands to GitHub Actions workflows, replacing `templates/hosted-check.yml` and `--hosted`.
13. `worktree-create.mjs` (existing): strips prefixes, refuses empty names, reads `worktree.baseRef`. The `worktree` setting itself is read by the worktree skill (22).
14. Background compile check (15): bacon `check` → `grep --line-buffered` → `uniq` → Monitor.
15. `banner.mjs` (13): hosted-check line still says "local merge gate"; reword to the pre-push hook.

## Open questions
None. All closed in STATUS.md: core loading and Explore/Plan coverage (21), worktree setting (22), tiers (23, 41), design placement (24), sweep-guard (25), comparison timing (26, 42), review before main (27), setup skill allowed (32), issue tracking as a rule with environment setup (33), conversation out of developer-friendliness (34), ask on first need (35), replace on re-run (36), `install --machine` dropped (37), `/machinery:reload` kept (38), no defaults (39), retention (42).

New mechanism implied by these: `record-project` accepts a replacement (36); `record-global` creates the global file on demand and `install --machine` is removed (37); `tiers.assignment` validated by `setup.mjs` (41).
