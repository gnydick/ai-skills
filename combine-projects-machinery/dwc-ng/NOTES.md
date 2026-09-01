# dwc-ng reconciliation notes

## Copy manifest
Copied 10 files from the source root on 2026-09-01 (all files present, no missing files).

## Internal reconciliation
(one bullet per judgment call, added in Task 4)

- **CLAUDE.md machinery/content split (Step 2).** Deleted six sections per
  the brief's list: `## Context`, `## Hard constraints (these drive
  everything)`, `## Stack (already decided, do not relitigate)`,
  `## Architecture requirements`, `## Solid-specific rules (I will be
  reviewing for these)`, `## First tasks (in order, confirm plan before
  executing)`. Kept: `## Reference source: read-only, never copy`,
  `## Dependency policy (security)`, and all three `## Working rules`
  sections (verification discipline / development environment / work
  topology), unchanged except the one content fix below. Judgment call: the
  two-sentence trailing paragraph after the First-tasks numbered list ("Put
  this file's contents (condensed) into CLAUDE.md as project memory. Ask me
  before deviating from any decision recorded here.") has no heading of its
  own; it reads as a closing instruction about the deleted milestone list
  specifically ("this file's contents ... into CLAUDE.md", "any decision
  recorded here" = the just-deleted decisions), not a standalone process
  rule, so it was deleted with the section rather than kept.

- **CONTRADICTION FOUND AND FIXED — SessionStart banner lies about its own
  project's pre-commit gate.** `.claude/settings.json`'s SessionStart echo
  said "no pre-commit hook enforces this yet." Mechanism check:
  `.githooks/pre-commit` (copied, read in full) exists, is tracked, and
  runs `python scripts/register_check.py --fast` — which unconditionally
  includes `check_inbox` (blocks a PENDING `docs/rule-inbox.md` entry) —
  whenever a staged commit touches `docs/RULES-GROUPED.md`,
  `docs/rule-inbox.md`, `CLAUDE.md`, `docs/LEARNINGS.md`, or
  `scripts/register_check.py`. It activates per clone via `pnpm
  hooks:install` (`git config core.hooksPath .githooks` — confirmed in the
  source `package.json`, see wiring evidence below). Git history in the
  read-only source root shows the pre-commit hook (`f957e44`, 2026-08-26
  14:09 PDT) was added 3 minutes BEFORE the settings.json banner was
  written (`2663f6e`, 14:12 PDT) — the banner has been wrong about its own
  project since the moment it was authored, not from later drift. The
  project's own register (`docs/RULES-GROUPED.md` § "Claiming what the
  tooling can do", Evidence) documents this exact class of lie having been
  found and fixed once already, in
  `.claude/skills/rule-intake/SKILL.md` (commit `b7dfbab`, 2026-08-28) — but
  that fix was never propagated to the SessionStart banner or to
  `rule_nudge.py`'s docstring (next bullet), both of which still carried
  the pre-`b7dfbab` claim. Precedence used: mechanism
  (`.githooks/pre-commit` + `register_check.py`) > the already-corrected
  `SKILL.md` text > register entry > (uncorrected) settings.json/docstring
  prose. Fixed the banner to: "`.githooks/pre-commit` enforces this
  automatically once a clone runs `pnpm hooks:install` (sets
  `core.hooksPath`); there is no CI backstop yet." Verified `settings.json`
  still parses as JSON after the edit.

- **Same fix propagated to `rule_nudge.py`'s docstring.** The hook's
  module docstring made the identical false claim ("there is no pre-commit
  hook in this project today"), citing
  `docs/superpowers/2026-08-26-register-check-port.md` as its source — that
  doc is dated 2026-08-26 and accurately described the state as of the
  PORT (before the pre-commit hook existed), so the docstring was true when
  written and went stale 3 minutes later without being updated, same as
  the banner above. Corrected in place: the hook's own behavior (never
  blocks; advisory print only) is still stated accurately, but the
  parenthetical is now dated and reconciled with the mechanism — a
  pre-commit hook does gate the repo, conditional on `pnpm hooks:install`;
  what's genuinely still missing is CI. Verified the file still compiles
  (`python -m py_compile`).

- **Missing register-cited bullet, added to CLAUDE.md.** `docs/RULES-GROUPED.md`
  § "Proving a change against something that behaves like the machine" has
  7 rows citing `CLAUDE.md` § Working rules (development environment), but
  the copied CLAUDE.md section had only 6 bullets — row 2, "A completion
  claim records the UAT: what was driven, against which scenario, what was
  observed. No note means the change is not done," had no corresponding
  text in CLAUDE.md at all (confirmed absent in the read-only source too,
  via `grep -n "completion claim" CLAUDE.md` — zero hits — so this is a
  pre-existing source-side gap, not something introduced by copying).
  Cross-checked every other row of every register group against its cited
  CLAUDE.md section (Confirmation discipline: 4 rows / 4 bullets, one-to-one;
  Acting outside the working tree: 1/1; Claiming what the tooling can do:
  1/1; Dispatching work: 6 rows summarizing 8 CLAUDE.md bullets by design —
  the register's own contract says rows are one-sentence summaries, and the
  merges lose no distinct demand) — this was the only genuine gap found.
  Precedence used: register entry > CLAUDE.md summary (register wins when
  CLAUDE.md is silent). Added a bullet to CLAUDE.md § Working rules
  (development environment), positioned between rows 1 and 3's matching
  bullets to preserve the register's row order, wording it to match the
  register row's demand. The incident narrative that would explain WHY this
  rule was adopted lives in `docs/superpowers/2026-08-26-machine-identity-phase-1-final-review.md`,
  a domain final-review doc correctly left uncopied (out of scope) — flagged
  here in case a future reconciliation wants that context.

- **Boundary: domain specs cited by the register, not copied.**
  `docs/RULES-GROUPED.md` § "Persisted layouts across releases" cites
  `docs/superpowers/specs/2026-08-28-layout-migration-design.md`,
  `-layout-version-ownership.md`, and `-record-edits-not-state.md` — all
  layout/config domain design docs, correctly out of scope per the brief
  (process machinery only). Running the copied `scripts/register_check.py`
  against this copy therefore reports 7 `section citation names missing
  file` errors for those three paths — expected and by design, not a defect
  introduced by this reconciliation; logged here so Step 4's verification
  output isn't misread as a regression.

- **`docs/rule-inbox.md`'s 2026-09-01 PENDING entry — left undispositioned,
  by design.** The copy carries a `Disposition: PENDING` entry ("the test
  loop shouldn't feed the agent unless there is a failure," timestamp
  2026-09-01T02:33:29Z) that the source repo captured the same day this
  reconciliation runs. This task's scope is internal consistency of the
  copy, not adjudicating pending rules (adjudication is Gabe's call via
  `/rule-intake`, per the skill's own trust-property statement) — the entry
  is left exactly as copied. Flagging as an OPEN INBOX ITEM the eventual
  union-of-both-projects work (phase 2+) should not silently lose or
  overwrite: it is live, undispositioned governance input, not stale
  content.

- **Package.json wiring evidence (not copied — the file stays out of
  scope; fragment recorded here only as proof the hook/script names in the
  copy are actually wired in the source project).** From the read-only
  source root's `package.json` `scripts` block:

  ```json
  "test": "pnpm -r --if-present test && python scripts/register_check.py",
  "register:check": "python scripts/register_check.py",
  "register:check:fast": "python scripts/register_check.py --fast",
  "hooks:install": "git config core.hooksPath .githooks"
  ```

  Confirms: `register_check.py` (copied) is reachable via `pnpm
  register:check[:fast]` and is also run in FULL (non-`--fast`) mode by the
  root `pnpm test`; `hooks:install` is exactly `git config core.hooksPath
  .githooks`, the per-clone opt-in `.githooks/pre-commit`'s own header
  documents.

## Discovered during reconciliation
(one bullet per scope addition, added in Task 4)

- **`docs/superpowers/2026-08-26-register-check-port.md`** — thread:
  `.claude/hooks/rule_nudge.py`'s docstring cites this file by name as
  evidence for its (now-corrected, see above) pre-commit claim, and
  `.claude/skills/rule-intake/SKILL.md` also points to it ("See ... for the
  port's history"). Pure process/governance documentation — a dated,
  immutable historical record of how `register_check.py`/`rule_capture.py`/
  `rule_nudge.py`/the rule-intake skill were ported from ferrislicer,
  including a live falsification test of the checker and an explicit
  "no pre-commit or CI actually stops a bad register" concern (accurate as
  of that moment — the pre-commit hook was added 3 minutes later the same
  day, per source git history). Copied verbatim and left unedited: like
  `docs/LEARNINGS.md`, this is dated narrative history, not a live claim
  about current state, so it is not "fixed" even though a reader taking its
  Concern #2 at face value today would be misled without also reading the
  corrected `rule-intake/SKILL.md` and the now-corrected banner/docstring
  above.
