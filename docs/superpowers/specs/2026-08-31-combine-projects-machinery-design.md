# Combine Projects Machinery — Design

2026-08-31. Approved in session by Gabe.

## Goal

Unify the Claude process machinery of two projects — **ferrislicer**
(`C:\Users\Gabe E. Nydick\RustroverProjects\ferrislicer`) and **dwc-ng**
(`N:\ideaprojects\dwc-ng`) — into one plugin-shaped, all-prose machinery set in
`combine-projects-machinery/union/`, via internally reconciled per-project
copies and a reviewable reconciliation table. The union is simpler than either
source: fewer, plainer rules; minimal mechanisms.

## Scope

**In scope (process machinery), per project:**

- `CLAUDE.md` rules (all of them; project-specific ones get generalized)
- `.claude/settings.json` hook wiring
- `.claude/hooks/`: `rule_capture.py`, `rule_nudge.py`; ferrislicer also
  `quiet_hook.py`, `quiet_run.py`, `quiet_hook_test.py`, `create_worktree.py`
- `.claude/agents/` (ferrislicer): `config-field`, `invariant-auditor`,
  `parity-verifier`
- Process skills: `rule-intake` (both), `campaign`,
  `refresh-diverged-branch` (ferrislicer)
- Governance layer: `.githooks/pre-commit` (both), `docs/RULES-GROUPED.md`
  (the register: contract, statuses, structure, and its process-flavored rule
  groups), `docs/rules/*.md`, `docs/rule-inbox.md`, `docs/LEARNINGS.md`
  (process learnings), governance scripts — `register_check.py` (both),
  ferrislicer's `citation_creation_gate.py`, `sweep_guard.sh`,
  `check_ledger_tables.py`, `gen_issue_rules_doc.sh`, `new_ticket_pair.py`
- Gate-and-ratchet scripts, as patterns to generalize (their domain check
  lists become examples; the mechanics are the machinery): ferrislicer's
  `merge-gate.sh` (gate the merge result, not the branch; baseline-diff test
  judging — fail only on NEW failures, report newly-green loudly; isolated
  gate build cache; quick mode never for a merge; local gating when hosted CI
  is absent or untrusted) and `invariant_scan_gate.py` (ratchet over an
  audited standing baseline; deliberate reviewed baseline regeneration;
  shipping code only)
- The can't-break-by-design audit apparatus (`cbbd_denominator.py`,
  `cbbd_check.py`, `cbbd_report.py`): reproducible denominator of stated
  claims + obligation shapes, structural table checks, every actionable
  finding lands in exactly one fix — both projects use the unbreakable
  skills, so this is their shared audit method
- Ferrislicer register groups under **Design** (invariants by construction,
  enforcement ladder, invariant anti-patterns, invariant ledger) — universal
  engineering rules despite living among domain groups

**Out of scope:** domain-knowledge skills (`duet-gcode`, `duet-http-api`,
`rrf-object-model`, `solid-patterns`), domain register groups (Engine,
fs-config, fs-hub, Geometry kernel, Fill, G-code, Platforms, …), domain
verification tooling (oracle/parity/bench scripts — the checks themselves,
as opposed to the gate mechanics above, are slicer content), dwc-ng's hard
constraints / stack / architecture / first-tasks
sections, ferrislicer's reference-source *paths* (the citation *rules* stay),
`.claude/scratch`, `.claude/backups`, `.claude/design`, `.claude/locks`,
`__pycache__`.

**Discovery protocol:** more machinery is expected to surface mid-work. During
phase 1, follow every thread outward (settings references, hook imports,
register citations, scripts the gates call, docs the rules cite). New process
machinery joins scope, the per-project copy, and the table; each addition is
logged in that project's `NOTES.md` under "Discovered during reconciliation".

## Pipeline

Three phases, all output committed under `combine-projects-machinery/`.

### Phase 1 — Internal reconciliation (per project)

Copy in-scope machinery into `combine-projects-machinery/<project>/`,
**preserving original file forms** (Python stays Python). Reconcile each
project within itself: resolve contradictions among CLAUDE.md, full rule
texts, register entries, and mechanism behavior; dedupe restated rules; align
settings wiring with what hooks actually do.

Precedence for internal contradictions: **what the mechanism actually does** >
full rule text (`docs/rules/*.md`) > register entry > CLAUDE.md summary.
Mechanisms don't lie; prose drifts. Corrections land only in the cleaned copy
— source projects are never touched. Every judgment call gets a line in that
project's `NOTES.md`.

Output: two internally consistent, still-project-flavored machinery sets.

### Phase 2 — Behavior decomposition and the reconciliation table

Decompose both cleaned sets into individual behaviors (per-behavior
granularity, not per-file). Write `union/RECONCILIATION.md`: rows grouped
under the named groups below, columns:

**# | ferrislicer (concise, project terms) | dwc-ng (concise, project terms) |
proposed universal form (succinct lay language) | your feedback (left empty)**

- Behavior in one project only → "—" in the other column.
- Genuine conflict → ferrislicer's demand wins the proposed form, row marked
  ⚔, dwc-ng's difference stays visible in its column; a note flags when
  dwc-ng's form looks like the newer thinking. Gabe's feedback column decides.
- Complementary (one has the principle, the other the sharper mechanism) →
  the proposed form is the merged best of both, not ferrislicer's text alone.

**Gate: Gabe reviews the table (edits/annotates the feedback column) before
phase 3 begins.**

### Phase 3 — Union assembly

Approved behaviors become plugin-shaped prose in `union/`, modeled on this
repo's `plugins/unbreakable` layout: skills as prose SKILL.md files; hook and
gate behavior as exact, platform-neutral user stories (no code — a
reimplementer on any platform reproduces the behavior from the prose alone);
agents as prose definitions; settings wiring described in prose.

## Table groups

1. **Straight Talk** — reporting honesty, measured-vs-believed claims,
   deviations announced first, failures full-strength, concise lay analogies.
2. **Rule Governance** — the full dictation → capture → inbox → intake →
   register → durable home → commit-gate pipeline; nudge hook; ledger-mismatch
   post-mortems producing rule-shaped output.
3. **Verification & Evidence** — assumptions + blast radius; measurement
   scope; class rulings enumerate instances; traced call paths; tooling
   capabilities checked never asserted; targets verified from environment;
   falsifiable propositions.
4. **Agent Topology & Economy** — work starts in an agent; main agent does no
   work; agent classes; serial within / concurrent across; one agent per
   worktree; batching; cheapest capable model with verification gates; agent
   naming.
5. **Worktree & Campaign Discipline** — worktree per multi-commit effort;
   branch naming; pathspec commits; green-before-merge; mandatory teardown;
   all work in worktrees; campaign and refresh-diverged-branch flows.
6. **Work Tracking** — issue per piece of work; engineer-stranger specs;
   Context sub-issue pickup protocol; ledgers; commit markers; minimum-token
   reads.
7. **Test Double & UAT Discipline** — mock runs during development; mock
   parity in the same change; owner UAT gates deployment; per-iteration UAT;
   teardown ownership; identify processes by PID.
8. **Tool Output Hygiene** — success is silent; output filtering; heartbeat
   contract; gates echo sub-check denominators.
9. **Design Invariants** — can't-break-by-design; enforcement ladder;
   anti-patterns; never re-derive; no in-band sentinels; no panic on absence;
   environment read once; claimed ground; warn loudly; config-hub boundary;
   follow-the-reference-for-plurals; the cbbd audit apparatus (reproducible
   denominator of stated claims + obligation shapes, dispositioned ledger,
   fixes report where every actionable finding lands in exactly one fix).
10. **Reference Sources** — read-only, never copy/port; cite the actual
    source; understanding over transcription.
11. **Environment & Platform** — shell resolution (no-WSL pattern); build
    cache staleness; dependency security policy.
12. **Standing Agents** — ferrislicer's three agents as prose definitions.
13. **Register System** — single grouped record; maintenance contract; status
    marks; solo rules; "the register cites, never originates"; same-commit
    updates.
14. **Commit Gates** — what blocks vs. what advises; gate-what-the-commit-
    touches vs. run-always ⚔; "bypass twice → fix the checker".
15. **Merge Gates & Ratchets** — gate the merge result, never the branch;
    baseline-diff judging (fail only on new failures; report newly-green
    loudly); ratchets over audited standing baselines, ratcheted down in the
    same change that earned it; deliberate reviewed baseline regeneration;
    shipping code only; isolated gate build environment; quick mode never for
    a merge; local gating when hosted CI is absent or untrusted.

Groups may be added/renamed as discovery warrants; changes surface in the
table itself.

## Simplicity mandate

The union optimizes for followable, not exhaustive:

- **Fewer, plainer rules.** Overlapping rules collapse. A rule is one plain
  statement of what to do and when. Incident history, dated attributions,
  cross-reference chains, and defensive sub-clauses are stripped; rationale
  survives only when the rule would be misapplied without it, as one sentence.
- **Nuance dropped deliberately, visibly.** Load-bearing fine print that gets
  simplified away is flagged in the table row as a one-line "dropped nuance"
  note; Gabe's feedback column decides whether it stays dropped. Never silent
  weakening.
- **Simpler machinery.** Where sources grew parallel overlapping mechanisms,
  the union proposes the minimal mechanism set that still closes each loop.

## Union validation (after assembly)

Recorded in `union/VALIDATION.md`:

1. **Coherence** — no contradictions between union rules; every
   cross-reference resolves within the union.
2. **Closed loops** — each pipeline is complete end to end in prose (rule
   dictation loop; worktree lifecycle; mock/UAT lifecycle).
3. **Mechanism-story fidelity** — every user story re-checked against actual
   source behavior (inputs, outputs, exit conditions, blocks vs. advises).
4. **Best-sum check per group** — does the union capture everything either
   project got right; is the combined form stronger than either alone?
5. **One-minute test** — each group's machinery explainable in a minute;
   failures get another simplification round.

Findings needing Gabe's judgment become open-question rows appended to
`RECONCILIATION.md`, never silent calls.

## Deliverables

```
combine-projects-machinery/
  ferrislicer/    # phase 1: cleaned copy, original file forms + NOTES.md
  dwc-ng/         # phase 1: cleaned copy, original file forms + NOTES.md
  union/
    RECONCILIATION.md   # phase 2: grouped 5-column table (Gabe's gate)
    VALIDATION.md       # phase 3: validation record
    <plugin-shaped prose machinery>  # phase 3: skills/, hooks-as-stories,
                                     # agents/, wiring doc
```
