# ferrislicer reconciliation notes

## Copy manifest
Copied 33 files from the source root on 2026-09-01 (all files present, no missing files).
Task 3 added 3 discovered files (see "Discovered during reconciliation" below):
`docs/github-issue-rules.template.md`, `docs/github-issue-rules.md`,
`.github/workflows/governance.yml` — 36 files total after reconciliation.

## Internal reconciliation
(one bullet per judgment call, added in Task 3)

- **Contradiction (mechanism vs. doc prose): `docs/rule-inbox.md`'s "where the
  gate actually runs" explanation.** The inbox header claimed "Claude
  sessions: `.claude/settings.json` runs it [register_check.py], so commits
  made through a session are gated." Mechanism check: `.claude/settings.json`
  wires exactly five hooks (`quiet_hook` on PreToolUse, `create_worktree` on
  WorktreeCreate, `rule_capture` on UserPromptSubmit, `rule_nudge` on
  PostToolUse, a SessionStart echo banner) — none of them runs
  `register_check.py` or any other git hook; only `.githooks/pre-commit`
  does, and only in a clone where `git config core.hooksPath .githooks` has
  been run (a per-clone git setting, unrelated to Claude Code). **Mechanism
  won** (precedence: mechanism > doc prose): rewrote the inbox's explanation
  to say `.githooks/pre-commit` gates a commit the same way whether made
  through a Claude session or a bare terminal, and that `.claude/settings.json`
  gives a session no additional git-hook gating beyond what `core.hooksPath`
  already provides. The "CI: `.github/workflows/governance.yml` runs it on
  push" and "a bare `git commit` with no hooksPath set is not gated" bullets
  were already accurate and are unchanged in substance.

- **Propagation of the above fix (reviewer-flagged follow-up).** The
  unconditional "a PENDING entry blocks every commit" / "blocks commits"
  phrasing survived, unfixed, in four other artifacts that state the same
  mechanism: `CLAUDE.md` § The map is living documentation,
  `docs/rules/map-living-documentation.md` (its full-rule text),
  `docs/RULES-GROUPED.md`'s 2026-08-15 register row citing that section, and
  the SessionStart echo banner in `.claude/settings.json`. Per the stated
  precedence (mechanism > full rule text > register > CLAUDE.md summary),
  all four were the losing text and are corrected the same way
  `docs/rule-inbox.md` was: each now states the gate only fires "in a clone
  with `core.hooksPath` set to `.githooks`, or on CI push" rather than
  claiming an unconditional block. Edits were minimal — one clause inserted
  into the existing sentence in each file, no other rewording.

## Discovered during reconciliation
(one bullet per scope addition, added in Task 3)

- **`docs/github-issue-rules.template.md` and `docs/github-issue-rules.md`.**
  Thread: `.githooks/pre-commit` blockingly calls
  `bash scripts/gen_issue_rules_doc.sh --check` (already copied in Task 1);
  that script renders `docs/github-issue-rules.md` from
  `docs/github-issue-rules.template.md` plus the
  `<!-- DRIFT-GATE:BEGIN/END tracking-work -->` marked block inside
  `docs/rules/tracking-work.md` (already copied) and fails the commit if the
  on-disk artifact drifts from a fresh render. Both the template (a
  placeholder shell, no rule text) and the rendered artifact are pure process
  machinery (issue-tracking mechanics: pickup commands, ticket-pair creation,
  labels, worktree pairing) — copied verbatim, byte-identical to source, and
  verified the copied `docs/rules/tracking-work.md` still carries the two
  marker lines the generator's `extract_block` depends on.
- **`.github/workflows/governance.yml`.** Thread: `docs/rule-inbox.md`'s
  mechanism explanation (see reconciliation bullet above) names this file as
  the CI backstop for `register_check.py`/`register_check_test.py` when a
  clone never ran `git config core.hooksPath .githooks` — the CI-side mirror
  of `.githooks/pre-commit`'s governance gates, i.e. process/governance
  machinery in the same sense as the pre-commit script already copied. Copied
  verbatim. Boundary: three of its five steps (Pipeline model check, ADR 0008
  provenance-state gate + its self-test) invoke `scripts/pipeline_model_check.py`
  and `scripts/adr_provenance_gate*.py` against domain-specific engine
  artifacts (Alloy pipeline models, `crates/fs-config-hub/src/hub.rs`'s
  `Provenance` enum) — those scripts and the crate are NOT copied, matching
  the domain-corpus exclusion. The workflow file documents the CI *shape*
  faithfully even though two of its five steps reference gates outside this
  snapshot's scope, the same pattern as a register row citing a non-copied
  domain doc.

## Boundary notes (scope decisions, not contradictions)

- **Register (`docs/RULES-GROUPED.md`) citations to domain docs.** The
  register's process-flavored groups (Process — worktrees/commits/staging,
  shared-worktree coordination, formatting scope, agent orchestration,
  review and audit agents, issue tracking, user-audit handling; CI — gate
  integrity; Governance — decision records; Verification — a measurement's
  scope is part of its claim; the Solo/Process area) were read in full and
  are internally consistent with CLAUDE.md and the docs/rules/*.md full
  texts — no demand/trigger/scope contradictions found. Many rows across the
  whole register (not just those groups) cite `docs/superpowers/specs/*`,
  `docs/superpowers/plans/*`, `docs/adr/*`, `docs/refactors/*`, `docs/ci.md`,
  `docs/dev/traps.md`, and similar domain/engine design docs that are out of
  scope per the brief and are NOT copied. This is expected and acceptable
  (per the brief) — noted once here rather than per citation.
- **`.claude/agents/*.md` citing domain authorities.** All three copied
  agents (`config-field.md`, `invariant-auditor.md`, `parity-verifier.md`)
  are themselves process machinery (specialized subagent definitions), but
  their bodies point at domain-specific authorities not copied:
  `docs/INVARIANTS.md`, `docs/adr/0008-config-provenance-and-inheritance.md`,
  `crates/fs-config/registry/defs.toml`, `crates/fs-config-hub/src/hub.rs`,
  `scripts/adr_provenance_gate.py`, `scripts/config_key_map.py`,
  `scripts/oracle_compare.py`, `scripts/orca_slice.py`, etc. Left uncopied
  (engine/domain corpus); the agent definitions themselves are unchanged and
  internally consistent with CLAUDE.md and the register.
- **`scripts/check_ledger_tables.py` reads `docs/INVARIANTS.md`.** Domain
  engine ledger — not copied, per the brief's explicit instruction. The
  script itself stays (it is the pre-commit gate machinery); it will not run
  successfully against this snapshot alone, same as several other gate
  scripts below.
- **`scripts/cbbd_check.py` / `cbbd_denominator.py` / `cbbd_report.py`**
  read/write `docs/audits/2026-08-14-cbbd*.md` and scan `crates/*/src/**/*.rs`
  — domain engine audit content and source, not copied. The three scripts
  are the general can't-break-by-design audit *methodology* (process
  machinery) but their inputs/outputs are domain-specific and out of scope.
- **`scripts/merge-gate.sh`** (already copied, Task 1) invokes a long tail of
  scripts not copied: `scripts/pipeline_model_check.py`,
  `scripts/citation_source_gate.py`, `scripts/testq.sh`/`testq_verdict.py`,
  `scripts/config_key_map*.py`, `scripts/adr_provenance_gate*.py`,
  `scripts/fs_config_codegen_test.py`. These test domain engine correctness
  (config registry, ADR provenance, pipeline model, workspace test battery)
  rather than process/governance mechanics, so they were left out — this
  copy documents merge-gate.sh's role and structure, not a runnable clone of
  the full battery. `scripts/register_check.py`/`register_check_test.py`,
  the only governance-shaped calls inside it, are already copied.
