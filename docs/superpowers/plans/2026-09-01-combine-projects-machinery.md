# Combine Projects Machinery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the Claude process machinery of ferrislicer and dwc-ng into per-project cleaned copies, a reviewable reconciliation table, and a unified all-prose plugin under `combine-projects-machinery/`.

**Architecture:** Three sequential phases. Phase 1 copies each project's in-scope machinery verbatim into a per-project directory and fixes internal contradictions there (never in the sources). Phase 2 decomposes both cleaned sets into per-behavior rows in a five-column table Gabe reviews (hard gate). Phase 3 assembles approved behaviors into plugin-shaped, platform-neutral prose and validates the result.

**Tech Stack:** Markdown prose; PowerShell for copying and mechanical verification. No new code ships — Python/shell files appear only as verbatim phase-1 copies.

**Spec:** `docs/superpowers/specs/2026-08-31-combine-projects-machinery-design.md`

## Global Constraints

- Source roots (read-only, NEVER edited): ferrislicer = `C:\Users\Gabe E. Nydick\RustroverProjects\ferrislicer`, dwc-ng = `N:\ideaprojects\dwc-ng`.
- All output lands under `I:\IdeaProjects\ai-skills\combine-projects-machinery\` (repo `I:\IdeaProjects\ai-skills`, branch `main`).
- Phase 1 copies keep original file forms (Python stays Python) and original relative paths under `combine-projects-machinery/<project>/`.
- Phase 1 internal-contradiction precedence: mechanism behavior > `docs/rules/*.md` full text > register entry > CLAUDE.md summary. Every judgment call gets a `NOTES.md` line.
- Discovery protocol: any newly found process machinery joins scope, the copy, and the table; log each addition under "Discovered during reconciliation" in that project's `NOTES.md`.
- Table row format (exactly 5 columns): `| <id> | <ferrislicer, concise> | <dwc-ng, concise> | <proposed universal form> | |` — feedback column ALWAYS left empty; missing behavior = `—`; conflicts prefix the universal cell with `⚔ `.
- Ferrislicer wins genuine conflicts; complementary rules merge into a best-of-both universal form.
- Universal forms: succinct lay language; no project nouns (ferrislicer, dwc-ng, Orca/OrcaSlicer, PrusaSlicer, CrealityPrint, SanityPrint, RRF/RepRapFirmware, Duet, DWC, SolidJS, Cargo, pnpm, Babylon, uPlot, CodeMirror, hotpath, `FS_*`, `GIT_\d+`, drive letters, file paths); simplification is visible, never silent — load-bearing dropped fine print gets a "dropped nuance:" note in the universal cell.
- Phase 3 union is 100% prose: hook/script/gate behavior written as exact platform-neutral user stories a stranger could reimplement from alone.
- Hard gate between phases 2 and 3: Gabe reviews `RECONCILIATION.md`. Do not start phase 3 without his verdicts.
- Commit after every task; commit messages end with the standard Co-Authored-By / Claude-Session trailer.

---

### Task 1: Copy ferrislicer machinery (phase 1a)

**Files:**
- Create: `combine-projects-machinery/ferrislicer/` — verbatim copies listed below, preserving relative paths
- Create: `combine-projects-machinery/ferrislicer/NOTES.md`

**Interfaces:**
- Consumes: the ferrislicer source root (read-only)
- Produces: the cleaned-copy working set Tasks 3 and 5–8 read; `NOTES.md` with headings `## Copy manifest`, `## Internal reconciliation`, `## Discovered during reconciliation`

- [ ] **Step 1: Copy the in-scope file set**

```powershell
$FS  = 'C:\Users\Gabe E. Nydick\RustroverProjects\ferrislicer'
$OUT = 'I:\IdeaProjects\ai-skills\combine-projects-machinery\ferrislicer'
$files = @(
  'CLAUDE.md',
  '.claude\settings.json',
  '.claude\hooks\rule_capture.py', '.claude\hooks\rule_nudge.py',
  '.claude\hooks\quiet_hook.py', '.claude\hooks\quiet_hook_test.py',
  '.claude\hooks\quiet_run.py', '.claude\hooks\create_worktree.py',
  '.claude\agents\config-field.md', '.claude\agents\invariant-auditor.md',
  '.claude\agents\parity-verifier.md',
  '.claude\skills\rule-intake\SKILL.md', '.claude\skills\campaign\SKILL.md',
  '.claude\skills\refresh-diverged-branch\SKILL.md',
  '.githooks\pre-commit',
  'docs\RULES-GROUPED.md', 'docs\rule-inbox.md', 'docs\LEARNINGS.md',
  'scripts\register_check.py', 'scripts\register_check_test.py',
  'scripts\citation_creation_gate.py', 'scripts\citation_creation_gate_test.py',
  'scripts\sweep_guard.sh', 'scripts\sweep_guard_test.py',
  'scripts\check_ledger_tables.py', 'scripts\gen_issue_rules_doc.sh',
  'scripts\new_ticket_pair.py',
  'scripts\merge-gate.sh', 'scripts\invariant_scan_gate.py',
  'scripts\cbbd_check.py', 'scripts\cbbd_denominator.py', 'scripts\cbbd_report.py'
)
foreach ($f in $files) {
  $src = Join-Path $FS $f; $dst = Join-Path $OUT $f
  New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
  Copy-Item $src $dst
}
Copy-Item (Join-Path $FS 'docs\rules') (Join-Path $OUT 'docs\rules') -Recurse
```

If a listed file is missing at the source, do not silently continue: record it in `NOTES.md` under `## Copy manifest` and move on.

- [ ] **Step 2: Verify the copy is complete and verbatim**

```powershell
foreach ($f in $files) { if (-not (Test-Path (Join-Path $OUT $f))) { Write-Output "MISSING $f" } }
(Get-ChildItem (Join-Path $OUT 'docs\rules') -File).Count   # expected: 25
git -C $FS status --porcelain                                # expected: no output touching these files (source untouched)
```

Expected: no `MISSING` lines; 25 rule files; source tree unmodified.

- [ ] **Step 3: Create NOTES.md**

```markdown
# ferrislicer reconciliation notes

## Copy manifest
Copied <N> files from the source root on 2026-09-01 (list any missing/skipped here).

## Internal reconciliation
(one bullet per judgment call, added in Task 3)

## Discovered during reconciliation
(one bullet per scope addition, added in Task 3)
```

- [ ] **Step 4: Commit**

```powershell
git -C 'I:\IdeaProjects\ai-skills' add combine-projects-machinery/ferrislicer
git -C 'I:\IdeaProjects\ai-skills' commit -m "phase1: verbatim copy of ferrislicer process machinery"
```

---

### Task 2: Copy dwc-ng machinery (phase 1a)

**Files:**
- Create: `combine-projects-machinery/dwc-ng/` — verbatim copies listed below, preserving relative paths
- Create: `combine-projects-machinery/dwc-ng/NOTES.md`

**Interfaces:**
- Consumes: the dwc-ng source root (read-only)
- Produces: the cleaned-copy working set Tasks 4 and 5–8 read; `NOTES.md` with the same three headings as Task 1

- [ ] **Step 1: Copy the in-scope file set**

```powershell
$DW  = 'N:\ideaprojects\dwc-ng'
$OUT = 'I:\IdeaProjects\ai-skills\combine-projects-machinery\dwc-ng'
$files = @(
  'CLAUDE.md',
  '.claude\settings.json',
  '.claude\hooks\rule_capture.py', '.claude\hooks\rule_nudge.py',
  '.claude\skills\rule-intake\SKILL.md',
  '.githooks\pre-commit',
  'docs\RULES-GROUPED.md', 'docs\rule-inbox.md', 'docs\LEARNINGS.md',
  'scripts\register_check.py'
)
foreach ($f in $files) {
  $src = Join-Path $DW $f; $dst = Join-Path $OUT $f
  New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
  Copy-Item $src $dst
}
```

Note: dwc-ng's CLAUDE.md mixes machinery with project content. Copy it whole here anyway — trimming is reconciliation (Task 4), not copying.

- [ ] **Step 2: Verify the copy**

```powershell
foreach ($f in $files) { if (-not (Test-Path (Join-Path $OUT $f))) { Write-Output "MISSING $f" } }
git -C $DW status --porcelain
```

Expected: no `MISSING` lines; source tree unmodified.

- [ ] **Step 3: Create NOTES.md** — same skeleton as Task 1 Step 3, titled `# dwc-ng reconciliation notes`.

- [ ] **Step 4: Commit**

```powershell
git -C 'I:\IdeaProjects\ai-skills' add combine-projects-machinery/dwc-ng
git -C 'I:\IdeaProjects\ai-skills' commit -m "phase1: verbatim copy of dwc-ng process machinery"
```

---

### Task 3: Internally reconcile ferrislicer (phase 1b)

**Files:**
- Modify: any file under `combine-projects-machinery/ferrislicer/` (never the source root)
- Modify: `combine-projects-machinery/ferrislicer/NOTES.md`

**Interfaces:**
- Consumes: Task 1's copies
- Produces: an internally consistent ferrislicer machinery set; every correction and discovery logged in `NOTES.md`

- [ ] **Step 1: Run discovery.** Read every copied file completely. Follow every outward thread: paths referenced by `settings.json` hooks, files the hooks read/write (e.g. `rule_capture.py` writes `docs/rule-inbox.md`), scripts the pre-commit gate calls, docs the register cites in its process-flavored groups, files the skills instruct reading. For each referenced file that is process machinery and not yet copied: copy it (same relative path), and add a bullet under `## Discovered during reconciliation` naming the file and the thread that led to it. Domain files (slicer engine docs, oracle tooling, `docs/INVARIANTS.md` engine content, `docs/superpowers/specs/*` pipeline maps) stay out — if unsure, copy the file and flag the question in `NOTES.md` rather than deciding silently.

- [ ] **Step 2: Build the contradiction list.** For each rule that exists in more than one artifact (CLAUDE.md summary, `docs/rules/<rule>.md` full text, register entry, hook/script behavior), compare the versions. A contradiction is a difference in demand, trigger, or scope — not wording. Also check: does `settings.json` wire every hook the prose claims, and does each hook actually do what the prose claims (read the Python). Write the list as `NOTES.md` bullets before fixing anything.

- [ ] **Step 3: Fix contradictions in the cleaned copy.** Apply the precedence from Global Constraints (mechanism > full rule text > register > CLAUDE.md). Correct the losing text in the copy. Each fix's `NOTES.md` bullet states: what disagreed, which version won, why.

- [ ] **Step 4: Verify internal consistency mechanically where possible**

```powershell
$C = 'I:\IdeaProjects\ai-skills\combine-projects-machinery\ferrislicer'
# every "Full rule:" pointer in the copied CLAUDE.md resolves inside the copy
Select-String -Path (Join-Path $C 'CLAUDE.md') -Pattern 'docs/rules/[a-z0-9-]+\.md' -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object {
    if (-not (Test-Path (Join-Path $C $_.Value))) { Write-Output "DANGLING $($_.Value)" } }
```

Expected: no `DANGLING` lines. (Register citations pointing at non-copied domain docs are fine — note the pattern once in `NOTES.md` instead of copying the domain corpus.)

- [ ] **Step 5: Commit**

```powershell
git -C 'I:\IdeaProjects\ai-skills' add combine-projects-machinery/ferrislicer
git -C 'I:\IdeaProjects\ai-skills' commit -m "phase1: internally reconcile ferrislicer machinery"
```

---

### Task 4: Internally reconcile dwc-ng (phase 1b)

**Files:**
- Modify: any file under `combine-projects-machinery/dwc-ng/` (never the source root)
- Modify: `combine-projects-machinery/dwc-ng/NOTES.md`

**Interfaces:**
- Consumes: Task 2's copies
- Produces: an internally consistent dwc-ng machinery set, machinery separated from project content; `NOTES.md` updated

- [ ] **Step 1: Run discovery.** Same procedure as Task 3 Step 1, over the dwc-ng copy. Known threads to follow: the pre-commit gate calls `scripts/register_check.py` (already copied); the SessionStart hook text names `docs/rule-inbox.md` and `docs/RULES-GROUPED.md`; CLAUDE.md's working-rules sections cite `docs/LEARNINGS.md` and `docs/RULES-GROUPED.md`; check `package.json` scripts for `hooks:install` and `register:check` definitions — if they exist, copy the relevant `package.json` fragment into `NOTES.md` (not the file) as wiring evidence.

- [ ] **Step 2: Separate machinery from project content in the copied CLAUDE.md.** In `combine-projects-machinery/dwc-ng/CLAUDE.md`, delete the out-of-scope sections per the spec: Context, Hard constraints, Stack, Architecture requirements, Solid-specific rules, First tasks. Keep: Reference source read-only rule, Dependency policy, all three Working rules sections. Add one `NOTES.md` bullet listing exactly which sections were removed.

- [ ] **Step 3: Build the contradiction list, then fix.** Same procedure as Task 3 Steps 2–3 (compare CLAUDE.md vs register entries vs hook/script behavior; precedence per Global Constraints; every fix logged). Known area to check: ferrislicer's SessionStart banner claims commits are blocked on PENDING inbox entries while dwc-ng's says "no pre-commit hook enforces this yet" — that is a cross-project difference (phase 2's job), but verify each project's own claim is true of its own gate and fix the one that lies about itself.

- [ ] **Step 4: Verify** — re-read the cleaned CLAUDE.md top to bottom: every remaining section is process machinery; every doc it cites exists in the copy or is noted. Then:

```powershell
git -C 'N:\ideaprojects\dwc-ng' status --porcelain   # expected: empty (source untouched)
```

- [ ] **Step 5: Commit**

```powershell
git -C 'I:\IdeaProjects\ai-skills' add combine-projects-machinery/dwc-ng
git -C 'I:\IdeaProjects\ai-skills' commit -m "phase1: internally reconcile dwc-ng machinery"
```

---

### Task 5: Reconciliation table — scaffold + groups 1–4 (phase 2)

**Files:**
- Create: `combine-projects-machinery/union/RECONCILIATION.md`

**Interfaces:**
- Consumes: both cleaned machinery sets (Tasks 3–4)
- Produces: the table document with header, legend, and populated groups 1–4; row-id scheme `<group#>.<row#>` (e.g. `3.2`) that Tasks 6–8 continue and phase 3 cites

- [ ] **Step 1: Write the document header and legend**

```markdown
# Machinery reconciliation: ferrislicer × dwc-ng

Row format: id | ferrislicer (concise, project terms) | dwc-ng (concise,
project terms) | proposed universal form (lay language) | your feedback.

- `—` = the project has no version of this behavior.
- `⚔` prefix on the universal cell = genuine conflict; ferrislicer's demand
  won; the dwc-ng column shows what was overruled. Your feedback decides.
- "dropped nuance:" inside a universal cell = fine print deliberately
  simplified away; say so in feedback if it must survive.
- Leave your verdict in the last column: blank/OK = approved as written;
  anything else = instruction for phase 3.
```

- [ ] **Step 2: Populate group 1 — Straight Talk.** Source: ferrislicer CLAUDE.md §Be straightforward, §Be concise/analogies + `docs/rules/be-straightforward.md`, `be-concise-analogies.md`; dwc-ng has no direct counterpart (its honesty demands live inside Working rules — cross-reference, don't duplicate: a behavior goes in the group where its trigger lives). Example row setting the bar for every later row:

```markdown
| 1.1 | "I don't know" said the moment it's true; never papered over with a plausible plan | — | Say "I don't know" the moment it is true. Not knowing is a reportable state, never hidden behind a confident-sounding plan. | |
```

- [ ] **Step 3: Populate group 2 — Rule Governance.** Sources: both projects' `rule_capture.py`, `rule_nudge.py`, `rule-intake/SKILL.md`, SessionStart banners, `docs/rule-inbox.md` formats, CLAUDE.md §ledger-mismatch + §map-living-documentation (register half); dwc-ng register §Confirmation discipline where it governs rule filing. Diff the two `rule_capture.py` / `rule_nudge.py` / `rule-intake` versions line by line — behavioral differences become ⚔ or merged rows, one row per behavior (capture trigger, inbox entry shape, pending-blocks-commit, nudge condition, intake flow steps, register update discipline, post-mortem trigger and output shape).

- [ ] **Step 4: Populate group 3 — Verification & Evidence.** Sources: ferrislicer CLAUDE.md §assumptions-and-blast-radius, §measurement-scope + their `docs/rules/` files, register §Verification groups; dwc-ng CLAUDE.md Working rules (verification discipline — all six bullets) and register §Confirmation discipline, §Claiming what the tooling can do. This group is rich on BOTH sides: expect mostly merged best-of-both rows.

- [ ] **Step 5: Populate group 4 — Agent Topology & Economy.** Sources: ferrislicer CLAUDE.md §work-starts-in-an-agent, §agent-cost-economy, §serial-agents-only, §batch-the-units + `docs/rules/` counterparts; dwc-ng CLAUDE.md Working rules (work topology) and register §Dispatching work. Known ⚔/merge case: ferrislicer's open-ended classes vs dwc-ng's named four (effort/review/test/rule-intake) + one-agent-per-worktree + class-and-target naming — mark ⚔ where demands differ, note where dwc-ng reads as the newer thinking.

- [ ] **Step 6: Verify table structure**

```powershell
$T = 'I:\IdeaProjects\ai-skills\combine-projects-machinery\union\RECONCILIATION.md'
Get-Content $T | Where-Object { $_ -match '^\| \d+\.\d+ ' } | ForEach-Object {
  if ((($_ -replace '\\\|','').ToCharArray() | Where-Object { $_ -eq '|' }).Count -ne 6) { Write-Output "BAD ROW: $_" } }
```

Expected: no `BAD ROW` lines (6 pipes = 5 columns).

- [ ] **Step 7: Commit**

```powershell
git -C 'I:\IdeaProjects\ai-skills' add combine-projects-machinery/union/RECONCILIATION.md
git -C 'I:\IdeaProjects\ai-skills' commit -m "phase2: reconciliation table groups 1-4"
```

---

### Task 6: Reconciliation table — groups 5–8 (phase 2)

**Files:**
- Modify: `combine-projects-machinery/union/RECONCILIATION.md`

**Interfaces:**
- Consumes: cleaned sets; Task 5's document, id scheme, and row-quality bar
- Produces: populated groups 5–8

- [ ] **Step 1: Populate group 5 — Worktree & Campaign Discipline.** Sources: ferrislicer CLAUDE.md §Worktrees + `docs/rules/worktrees.md`, `campaign/SKILL.md`, `refresh-diverged-branch/SKILL.md`, `create_worktree.py`, register §Process — worktrees/shared-worktree; dwc-ng CLAUDE.md Working rules (work topology: all-work-in-worktrees, mock-belongs-to-worktree). One row per behavior: when a worktree is required, branch naming, base ref, pathspec commits, green-before-merge, teardown, shared-state announcement, the campaign sequence, the diverged-branch rebuild flow.

- [ ] **Step 2: Populate group 6 — Work Tracking.** Sources: ferrislicer CLAUDE.md §Tracking work + `docs/rules/tracking-work.md`, `new_ticket_pair.py`, `gen_issue_rules_doc.sh`; dwc-ng: `—` for most rows (it has no issue-pair protocol) — its LEARNINGS.md conventions go here where they track work.

- [ ] **Step 3: Populate group 7 — Test Double & UAT Discipline.** Sources: dwc-ng CLAUDE.md Working rules (development environment — all six bullets) and register §Proving a change against something that behaves like the machine; ferrislicer: `—` mostly (its battery/goldens are domain, but its green-before-merge row in group 5 cross-references here). Generalize "mock-duet" to "a test double of the real target"; PID/port checks to "identify the process you are driving, never trust that something answered".

- [ ] **Step 4: Populate group 8 — Tool Output Hygiene.** Sources: ferrislicer `quiet_hook.py`, `quiet_run.py`, `quiet_hook_test.py`, CLAUDE.md §heartbeat + §gate-echoes-denominator + their `docs/rules/` files; dwc-ng: `—`. Read the Python carefully — the universal cells here are the seed of phase 3's hook user stories, so state observable behavior exactly (what is filtered, what always survives, what happens on match/no-match/error).

- [ ] **Step 5: Verify structure** — rerun Task 5 Step 6's check. Expected: no `BAD ROW`.

- [ ] **Step 6: Commit** — message `phase2: reconciliation table groups 5-8`.

---

### Task 7: Reconciliation table — groups 9–12 (phase 2)

**Files:**
- Modify: `combine-projects-machinery/union/RECONCILIATION.md`

**Interfaces:**
- Consumes: cleaned sets; the established row bar
- Produces: populated groups 9–12

- [ ] **Step 1: Populate group 9 — Design Invariants.** Sources: ferrislicer CLAUDE.md §Design, §never-re-derive, §no-in-band-sentinels, §panic-on-absence, §environment-read-once, §claimed-ground, §warn-loudly, §config-fields-stop-at-the-hub, §follow-orca-for-plurals + `docs/rules/` files, register §Design groups (invariants by construction, enforcement ladder, anti-patterns, invariant ledger), `cbbd_denominator.py`/`cbbd_check.py`/`cbbd_report.py`; dwc-ng CLAUDE.md "nothing should be able to break by construction" + register §Persisted layouts. This is the largest, most project-flavored group: every universal cell must pass the no-project-nouns rule, and domain rules generalize to their underlying principle (e.g. claimed-ground → "once a pipeline stage consumes a resource, no later stage may receive it; declines are routed to one named recipient"). The cbbd audit apparatus becomes rows describing the method: reproducible denominator (stated claims + obligation shapes), full disposition, every actionable finding in exactly one fix.

- [ ] **Step 2: Populate group 10 — Reference Sources.** Sources: ferrislicer CLAUDE.md §Reference sources + `docs/rules/reference-sources.md`; dwc-ng CLAUDE.md §Reference source read-only. Both projects converged on this independently — expect merged rows: read-only, never port, cite the actual owner, understanding-not-transcription, "if the solution seems to require copying, stop and ask".

- [ ] **Step 3: Populate group 11 — Environment & Platform.** Sources: ferrislicer CLAUDE.md §No WSL, §Build cache + `docs/rules/no-wsl.md`; dwc-ng CLAUDE.md §Dependency policy. Generalize: resolve real tools by path never by PATH luck and fail loudly; stale-build-cache symptoms contradict source → clean before believing errors; dependencies frozen, additions require the owner's ask.

- [ ] **Step 4: Populate group 12 — Standing Agents.** Sources: ferrislicer `.claude/agents/config-field.md`, `invariant-auditor.md`, `parity-verifier.md` (read fully — they were only inventoried in brainstorming, so treat contents as fresh input and add discovered behaviors to earlier groups if they belong there); dwc-ng: `—`. One row per agent (its job, trigger, inputs, output contract) plus rows for any cross-cutting agent conventions found.

- [ ] **Step 5: Verify structure** — rerun Task 5 Step 6's check. Expected: no `BAD ROW`.

- [ ] **Step 6: Commit** — message `phase2: reconciliation table groups 9-12`.

---

### Task 8: Reconciliation table — groups 13–15, conflict sweep, coverage check (phase 2)

**Files:**
- Modify: `combine-projects-machinery/union/RECONCILIATION.md`

**Interfaces:**
- Consumes: cleaned sets; groups 1–12
- Produces: the complete table, ready for Gabe's review

- [ ] **Step 1: Populate group 13 — Register System.** Sources: both `docs/RULES-GROUPED.md` §Maintaining this file, structure (statuses 🟢🟡🔴, groups, solo rules, Contents), both `register_check.py` behaviors (diff them). Rows: one grouped record; the register cites never originates; same-commit updates; status semantics; what `register_check` verifies (citations resolve, SUPERSEDED bidirectional, inbox dispositioned).

- [ ] **Step 2: Populate group 14 — Commit Gates.** Sources: both `.githooks/pre-commit` (diff them), `citation_creation_gate.py`, `check_ledger_tables.py`, `sweep_guard.sh`, `gen_issue_rules_doc.sh --check`. Rows: block vs advise; validate-at-authoring-time-never-again; render-don't-restate (doc generated from its authority); ⚔ gate-what-the-commit-touches (dwc-ng) vs run-always (ferrislicer); "bypass twice → fix the checker"; hooks tracked in-tree and activated per clone, never self-installing.

- [ ] **Step 3: Populate group 15 — Merge Gates & Ratchets.** Sources: `merge-gate.sh` (full read — 309 lines), `invariant_scan_gate.py`. Rows: gate the merge result never the branch; baseline-diff judging (new failures fail; newly-green reported loudly); isolated gate build environment; quick mode never for a merge; local gating when hosted CI is absent/untrusted; ratchet semantics (above baseline fails, drops invite same-change ratchet-down, regeneration deliberate and reviewed, shipping code only).

- [ ] **Step 4: Conflict and coverage sweep.**
  - Re-read both cleaned CLAUDE.md files and both registers' process groups section by section; for each demand, name the row that carries it. Anything unrowed: add it (new row in its group, or a new group with a `NOTES`-style comment at the table top explaining the addition).
  - Verify every ⚔ row's dwc-ng cell actually shows what was overruled.
  - Verify no universal cell contains a banned project noun:

```powershell
$T = 'I:\IdeaProjects\ai-skills\combine-projects-machinery\union\RECONCILIATION.md'
Get-Content $T | Where-Object { $_ -match '^\| \d+\.\d+ ' } | ForEach-Object {
  $cells = ($_ -replace '\\\|', [char]1).Split('|'); $u = $cells[4]
  if ($u -match '(?i)ferrislicer|dwc-ng|orca|prusa|creality|sanityprint|reprap|\bRRF\b|\bduet\b|\bDWC\b|solidjs|cargo|\bpnpm\b|babylon|uplot|codemirror|hotpath|FS_[A-Z]|GIT_[0-9]') {
    Write-Output "NOUN LEAK: $_" } }
```

Expected: no `NOUN LEAK` lines. Rerun Task 5 Step 6's structure check too.

- [ ] **Step 5: Commit** — message `phase2: reconciliation table complete`.

---

### Task 9: HARD GATE — Gabe reviews the table

**Files:** none modified by the implementer.

**Interfaces:**
- Consumes: the complete `RECONCILIATION.md`
- Produces: Gabe's verdicts in the feedback column (or in conversation), which every phase-3 task treats as binding

- [ ] **Step 1: Hand over.** Tell Gabe the table is ready at `combine-projects-machinery/union/RECONCILIATION.md`, with counts: rows per group, ⚔ rows, "dropped nuance" rows. Ask him to fill the feedback column (blank/OK = approved) or give verdicts in chat.
- [ ] **Step 2: STOP.** Do not begin any phase-3 task until Gabe says the review is done. Apply his edits: chat verdicts get transcribed into the feedback column so the table remains the single record; then commit `phase2: Gabe's review verdicts`.

---

### Task 10: Union rules document (phase 3)

**Files:**
- Create: `combine-projects-machinery/union/plugin/RULES.md`

**Interfaces:**
- Consumes: approved rows of groups 1, 3, 5 (rule half), 6, 9, 10, 11 (the rules that bind every session)
- Produces: `plugin/RULES.md` — the union's CLAUDE.md-equivalent; later tasks cross-reference its section names verbatim

- [ ] **Step 1: Write RULES.md.** Structure: one `##` section per group, rules as short bullets in the approved universal wording (feedback-modified where Gabe said so). Apply the simplicity mandate: one plain statement of what to do and when; a single rationale sentence only where the rule would be misapplied without it; no dated attributions, no incident narratives, no cross-reference chains. Open with a 3-sentence preamble saying what the document is and that project-specific examples live in the source projects, not here.

- [ ] **Step 2: Verify.** Every approved row from the consumed groups appears (traceable by content) exactly once; run the Task 8 Step 4 noun-leak check with the path swapped to `plugin/RULES.md` — expected: no leaks. Read it end to end against the one-minute test: can each section be explained aloud in a minute? Rework any section that fails.

- [ ] **Step 3: Commit** — message `phase3: union rules document`.

---

### Task 11: Union hook and gate stories (phase 3)

**Files:**
- Create: `combine-projects-machinery/union/plugin/hooks/rule-capture.md`
- Create: `combine-projects-machinery/union/plugin/hooks/rule-nudge.md`
- Create: `combine-projects-machinery/union/plugin/hooks/quiet-output.md`
- Create: `combine-projects-machinery/union/plugin/hooks/worktree-create.md`
- Create: `combine-projects-machinery/union/plugin/hooks/session-banner.md`
- Create: `combine-projects-machinery/union/plugin/gates/commit-gate.md`
- Create: `combine-projects-machinery/union/plugin/gates/merge-gate.md`
- Create: `combine-projects-machinery/union/plugin/gates/ratchets.md`
- Create: `combine-projects-machinery/union/plugin/WIRING.md`

**Interfaces:**
- Consumes: approved rows of groups 2 (mechanism half), 8, 14, 15; the phase-1 Python/shell sources as behavior ground truth
- Produces: one prose user story per mechanism; `WIRING.md` describing every attachment point

- [ ] **Step 1: Write each hook story** to this template (platform-neutral, reimplementable from the prose alone):

```markdown
# <Mechanism name>

**When it runs:** <the exact event: a user prompt is submitted / before a
shell tool call / after a file edit / a session starts / a worktree is
created>

**What it reads:** <inputs and where they come from>

**What it does:** <numbered behavior, every branch: on match, on no-match,
on malformed input, on failure — including exit/blocking semantics>

**What the user sees:** <messages, verbatim where they matter>

**Acceptance checks:** <3–6 given/when/then lines a reimplementer runs to
prove parity>
```

Ground truth is the phase-1 copies of the scripts, not memory — re-read each before writing its story. `quiet-output.md` must state the filter rules and the always-survives patterns (heartbeats included) exactly; `commit-gate.md` covers block-vs-advise and each sub-check as one story section; `merge-gate.md` and `ratchets.md` carry the group-15 mechanics with the domain check lists reduced to one generalized example each.

- [ ] **Step 2: Write WIRING.md.** For each story: which event it attaches to, its ordering/timeout expectations, and what a platform needs to provide (an event on prompt submit, a pre-commit entry point, etc.). Include the per-clone activation rule (wiring is tracked in-tree, activated explicitly, never self-installing).

- [ ] **Step 3: Verify.** For each story, check every "What it does" claim against the phase-1 source one final time (inputs, outputs, exit codes, block vs advise); noun-leak check over `plugin/hooks` and `plugin/gates` — expected: no leaks; each acceptance-checks block has ≥3 lines.

- [ ] **Step 4: Commit** — message `phase3: hook and gate user stories`.

---

### Task 12: Union skills and agents (phase 3)

**Files:**
- Create: `combine-projects-machinery/union/plugin/skills/rule-intake/SKILL.md`
- Create: `combine-projects-machinery/union/plugin/skills/campaign/SKILL.md`
- Create: `combine-projects-machinery/union/plugin/skills/refresh-diverged-branch/SKILL.md`
- Create: `combine-projects-machinery/union/plugin/agents/config-auditor.md` (generalized from config-field — rename per its actual generalized content)
- Create: `combine-projects-machinery/union/plugin/agents/invariant-auditor.md`
- Create: `combine-projects-machinery/union/plugin/agents/parity-verifier.md`
- Create: `combine-projects-machinery/union/plugin/README.md`

**Interfaces:**
- Consumes: approved rows of groups 2 (flow half), 4, 5 (sequence half), 7, 12, 13; `plugin/RULES.md` section names; hook stories from Task 11
- Produces: the complete plugin prose set

- [ ] **Step 1: Write the three skills.** Each SKILL.md: standard frontmatter (name, description in trigger-first form), then the generalized flow in the approved universal wording. `campaign` generalizes to the multi-commit-effort lifecycle (create isolated workspace → work → gate on green → merge → mandatory teardown); `refresh-diverged-branch` keeps its git flow (git is platform-neutral); `rule-intake` merges both projects' versions per the approved group-2 rows. Skills reference `RULES.md` sections by name instead of restating rules ("the rules live in RULES.md; this skill is the sequence").

- [ ] **Step 2: Write the three agent definitions** as prose briefs: purpose, when to dispatch, inputs, verification obligations, output contract — generalized from the phase-1 agent files per approved group-12 rows. If a source agent is irreducibly domain-bound, its generalized brief keeps the method and drops the domain checklists; record that reduction in the brief's own one-line note.

- [ ] **Step 3: Write README.md.** What the plugin is, the directory map, how the pieces relate (rules bind always; skills are sequences; hooks/gates are mechanisms a platform implements from the stories; agents are dispatchable briefs), and where verdicts came from (point at `../RECONCILIATION.md`).

- [ ] **Step 4: Verify.** Noun-leak check over all of `plugin/` — expected: no leaks; every `RULES.md` section referenced by a skill exists (grep each referenced heading); every approved row from the consumed groups is traceable to a file.

- [ ] **Step 5: Commit** — message `phase3: union skills, agents, README`.

---

### Task 13: Union validation (phase 3)

**Files:**
- Create: `combine-projects-machinery/union/VALIDATION.md`
- Modify: any `union/plugin/` file a check fails (fix inline), `RECONCILIATION.md` (open-question rows only)

**Interfaces:**
- Consumes: everything under `union/`
- Produces: the validation record; the union declared done or open questions handed to Gabe

- [ ] **Step 1: Run the five checks from the spec, recording each in VALIDATION.md:**

```markdown
# Union validation — 2026-09-XX

## 1. Coherence
(no two union rules contradict; every cross-reference resolves — list checked pairs/refs and verdicts)

## 2. Closed loops
(rule dictation → capture → inbox → intake → register → gate; workspace create → work → merge → teardown; double stand-up → UAT → teardown — each traced step by step through the union files, naming the file that carries each step)

## 3. Mechanism-story fidelity
(per story: re-checked against phase-1 source; verdict)

## 4. Best-sum per group
(per group 1–15: does the union capture everything either project got right; is the combined form stronger than either alone; one short paragraph each)

## 5. One-minute test
(per group: pass/fail; failures reworked and re-checked)
```

- [ ] **Step 2: Fix what fails.** Inline fixes to `plugin/` files; anything needing Gabe's judgment becomes a new row in `RECONCILIATION.md` under a final `## Open questions` group (same 5-column format, feedback column empty).

- [ ] **Step 3: Final mechanical sweep** — structure check and noun-leak check over the whole `union/` tree (both from Task 8 Step 4, path swapped); expected clean. Then:

```powershell
git -C 'C:\Users\Gabe E. Nydick\RustroverProjects\ferrislicer' status --porcelain   # empty
git -C 'N:\ideaprojects\dwc-ng' status --porcelain                                   # empty
```

- [ ] **Step 4: Commit** — message `phase3: union validated`. Report to Gabe: what was validated, any open-question rows awaiting him, and the suggestion that promoting `union/plugin/` into a real installable plugin under `plugins/` is a separate follow-up task he can request.
