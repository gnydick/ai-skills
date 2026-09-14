# Machinery Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Owner answers (2026-09-14; STATUS decisions 43–48) — these replace the questions

1. **Yes, merge #99 as Task A0** (43). A0 runs; the "#99" steps in A3, A5, A6 and Task B6 apply.
2. **Ship a small `reload` skill; delete "and reload" from the `rule-process` description** (44). A2 includes both.
3. **Components come from a recorded setting, asked in setup** (45): key `components` in `.claude/machinery/config.json`, a mapping of component name → path prefix; `componentsOf(root, stagedPaths)` returns the names whose prefix a staged path starts with. B1's `setup.mjs` validates it; the setup skill's tiers item asks for it (Claude proposes from the workspace layout, per decision 41). Unrecorded → the hook refuses: "commit refused: no components recorded in .claude/machinery/config.json — run /machinery:setup tiers".
4. **Build/format checks are their own key `checks.commit`, asked in setup** (46). The pre-commit runs `checks.commit` (if recorded) before `tiers.fast`; B1 validates it; B2's hook text runs gate → checks → fast.
5. **`tiers.assignment` values: `ask-per-test`, `propose-per-commit`, `claude-decides`** (47). B1 validates exactly these.
6. **Yes — this repo's own `.githooks/pre-commit` moves onto the installed tiered hooks in this effort** (48): add **Task B8** after B3, before B7: record this repo's `components`, `checks.commit` (`node scripts/build-skills.mjs check`), `tiers.fast`, `tiers.merge` in its `.claude/machinery/config.json` and replace `.githooks/pre-commit` with the installed hook; TDD red = a test asserting the repo's hook text equals what `install.mjs` writes. Note `core.hooksPath` is absolute to the main checkout, so the new hook governs worktree commits only after merge.

**Goal:** Replace machinery's rules, skills and agents with the recalibration draft, and build the mechanisms the draft relies on, with every commit green.

**Architecture:**
- `plugins/machinery/core.md` is injected by `scripts/core.mjs` on `SessionStart` and every `SubagentStart`; no `~/.claude/rules` junction.
- Per-kind skills live at `claude-code/machinery/<kind>/SKILL.md`, staged into `plugins/machinery/skills/` by `scripts/build-skills.mjs`; a URULE is placed into `core.md` or a skill section.
- Capture and the inbox gate stay: `register_check` = pending entries, `spec_check` = pending + spec area. No index, citation check, nudge or supersession.
- Settings in `.claude/machinery/config.json` (`setup.mjs`); installed hooks: pre-commit (gate + `tiers.fast`), pre-push to main (`tiers.merge`); a PreToolUse hook asks before `--no-verify`.
- The invariant auditor, `invariant-audit` and `design-invariants.md` are parked in `docs/parked/for-unbreakable/`.

**Tech Stack:** Node ≥ 22 ES modules, `node:test`, git hooks, Claude Code plugin hooks.

**Spec:** `docs/learnings/recalibration-2026-09/STATUS.md` (decisions 1–42) and `docs/learnings/recalibration-2026-09/draft/` (`core.md`, `skills/*/SKILL.md`, `agents/comparison-agent.md`, `SUMMARY.md` § Mechanisms needed). `draft/parked-unbreakable/` is not shipped.

## Task list

| # | Title | Phase | Depends on | Main files |
|---|---|---|---|---|
| A0 | Merge #99 into this branch | A | Q1 | `plugins/machinery/.claude-plugin/plugin.json` (conflict) |
| A1 | Core loads into every session and subagent | A | A0 when run | `core.md`, `scripts/core.mjs`, `hooks/hooks.json`, `test/core.test.mjs` |
| A2 | Draft skills and agent swapped in; auditor parked | A | A1, Q2 | `claude-code/machinery/*`, `skills.manifest.json`, `agents/`, `docs/parked/for-unbreakable/` |
| A3 | Index, citation check and nudge removed | A | A2 | `scripts/gate/*`, `reindex.mjs`, `nudge.mjs`, `lib/index.mjs`, `lib/frontmatter.mjs`, `register/` |
| A4 | Refusals and capture name `/machinery:rule-process` | A | A3 | `gate/register-check.mjs`, `gate/spec-check.mjs`, `gate/gate.mjs`, `capture.mjs`, `intake.mjs` |
| A5 | A URULE files into `core.md` or a skill | A | A4 | `lib/config.mjs`, `place.mjs`, `intake.mjs` |
| A6 | `rules/` and the junction removed | A | A5 | `rules/`, `reload.mjs`, `lib/reload.mjs`, `banner.mjs`, `install.mjs` |
| B1 | `setup.mjs show` / `set` | B | A6, Q5 | `lib/settings.mjs`, `setup.mjs` |
| B2 | Pre-commit runs `tiers.fast` | B | B1, Q3, Q4 | `tiers.mjs`, `lib/components.mjs`, `install.mjs` |
| B3 | Pre-push runs `tiers.merge` on pushes to main | B | B2 | `tiers.mjs`, `install.mjs`, `banner.mjs` |
| B4 | `--no-verify` asks the user | B | A6 | `no-verify.mjs`, `lib/emit.mjs`, `hooks/hooks.json` |
| B5 | Hosted CI from the recorded tiers | B | B3 | `install.mjs`, `templates/`, `install` skill |
| B6 | Issue-tracking answer filed and replaced | B | A0, A5 | `intake.mjs` |
| B8 | This repo's own pre-commit onto the installed tiered hooks | B | B3 | `.githooks/pre-commit`, `.claude/machinery/config.json` |
| B7 | Documentation | B | B1–B6, B8 | READMEs, `marketplace.json`, `plugin.json`, `STATUS.md` |

## Global Constraints

- Work only in `I:/IdeaProjects/ai-skills/.claude/worktrees/machinery-rewrite`; all paths below are relative to it. Never edit anything under `~/.claude`; where a change needs one, report it.
- Every task runs on the top model tier (coding). An implementer may not spawn agents.
- Code tasks follow TDD in order. **TDD red:** write or edit the test, run only it, see it fail for the stated reason, report the command and failing line. **TDD green:** smallest change, run that same test, it passes. Never implement first and break code to watch a test fail; never disturb and restore a real file to prove a test.
- One test run form: `node --test --test-name-pattern "<test name>" plugins/machinery/test/<file>.test.mjs`. The cycle runs nothing broader (decision 15); the pre-commit hook runs the suites. Read its output; do not re-run them.
- The hook that runs is main's `.githooks/pre-commit` (`core.hooksPath` is the absolute `I:\IdeaProjects\ai-skills\.githooks`, measured), running this worktree's scripts: `build-skills.mjs check`, `scripts/test`, `plugins/machinery/test` (20 s budget), `gate.mjs --root plugins/machinery --universal`. Never `--no-verify`. A red hook: fix the cause, never the check.
- A change to a bucket skill is followed by `node scripts/build-skills.mjs build`. Any commit touching `plugins/machinery/` first runs `node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery`.
- Commit named paths only: `git add -- <new files>`, `git rm -q -- <removed>`, `git mv`, then `git commit -m "<why>" -m "<trailer from your session's attribution reminder>" -- <every path>`. The one exception is A0's merge commit.
- Report per task, ≤ 3 lines: the TDD red failing line, the TDD green pass line, the hook's `build_skills_tests:` line + `# pass`/`# fail` of the machinery suite + `register_check:` line, and the commit sha.
- The branch is not merged to main before B7 lands and the owner says go (worktree skill § What may be merged to main).

---

## Phase A — swap-in with the gate green

### Task A0: Merge #99 into this branch (only if Q1 is yes)

**Files:** `plugins/machinery/.claude-plugin/plugin.json` (the only path changed on both sides since merge-base 9587907, measured with `comm` over both `git diff --name-only`).

- [ ] **Step 1:** `git merge --no-ff --no-commit issue-tracking-build`. Expected: one conflict, the `"version"` line (`0.1.114` vs `0.1.119`); `"dependencies": ["unbreakable"]` merges cleanly from this side.
- [ ] **Step 2:** Resolve to `"version": "0.1.119"`, run the bump (→ `0.1.120`), `git add -- plugins/machinery/.claude-plugin/plugin.json`. `git status --short` lists only #99's paths and plugin.json.
- [ ] **Step 3:** `git commit -m "Merge issue-tracking-build (#99 Tasks 1-6) into machinery-rewrite" -m "<trailer>"`. #99's Task 7 and Task 9 are not run; B6 and B7 replace them.
- [ ] **Report:** conflicted files, the hook lines, sha.

### Task A1: Core loads into every session and subagent (decision 21)

**Files:**
- Create: `plugins/machinery/core.md` (copy of `docs/learnings/recalibration-2026-09/draft/core.md`, byte for byte), `plugins/machinery/scripts/core.mjs`, `plugins/machinery/test/core.test.mjs`, `plugins/machinery/test/fixtures/payloads/SubagentStart.json`
- Modify: `plugins/machinery/hooks/hooks.json`, `plugins/machinery/test/fixtures.test.mjs` (`REQUIRED` gains `'SubagentStart'`), `plugins/machinery/test/fixtures/payloads/README.md` (one line: SubagentStart added 2026-09-14, documentation-derived)

- [ ] **TDD red.** Copy `core.md`. Write the fixture:

```json
{
  "session_id": "fixture-session",
  "transcript_path": "<TRANSCRIPT>",
  "cwd": "<HOME>/proj",
  "permission_mode": "default",
  "hook_event_name": "SubagentStart",
  "agent_id": "fixture-agent",
  "agent_type": "Explore"
}
```

Write `test/core.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScript, PLUGIN } from './helpers/run.mjs';

const CORE = () => fs.readFileSync(path.join(PLUGIN, 'core.md'), 'utf8');
const payload = (name) => fs.readFileSync(path.join(PLUGIN, `test/fixtures/payloads/${name}.json`), 'utf8');

for (const event of ['SessionStart', 'SubagentStart']) {
  test(`${event} receives core.md verbatim as additionalContext`, () => {
    const res = runScript('scripts/core.mjs', { stdin: payload(event) });
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout).hookSpecificOutput, { hookEventName: event, additionalContext: CORE() });
  });
}

test('hooks.json runs core.mjs on SessionStart and on every SubagentStart (no matcher)', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const event of ['SessionStart', 'SubagentStart']) {
    assert.ok((hooks[event] ?? []).some((g) => g.matcher === undefined && g.hooks.some((h) => /scripts\/core\.mjs/.test(h.command))), event);
  }
});

test('RED CHECK: a plugin without core.md exits 1, names the path, and injects nothing', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-'));
  try {
    const res = runScript('scripts/core.mjs', { stdin: payload('SubagentStart'), env: { CLAUDE_PLUGIN_ROOT: empty } });
    assert.equal(res.code, 1);
    assert.equal(res.stdout, '');
    assert.ok(res.stderr.includes(path.join(empty, 'core.md')), res.stderr);
  } finally { fs.rmSync(empty, { recursive: true, force: true }); }
});
```

Run `node --test plugins/machinery/test/core.test.mjs`. Expected: 4 failures; the event tests fail on `0 !== 1` with stderr `Cannot find module …scripts\core.mjs`; the hooks test fails with message `SessionStart`.

- [ ] **TDD green.** `scripts/core.mjs`:

```js
#!/usr/bin/env node
// SessionStart and SubagentStart: inject core.md as additionalContext (recalibration decision 21).
import fs from 'node:fs';
import path from 'node:path';
import { readPayload } from './lib/stdin.mjs';
import { context } from './lib/emit.mjs';
import { pluginRoot } from './lib/config.mjs';

const event = readPayload()?.hook_event_name === 'SubagentStart' ? 'SubagentStart' : 'SessionStart';
const file = path.join(pluginRoot(), 'core.md');
let text;
try { text = fs.readFileSync(file, 'utf8'); }
catch (e) {
  process.stderr.write(`machinery core: cannot read ${file} (${e.code ?? e.message}) — reinstall: claude plugin install machinery@ai-skills --scope project\n`);
  process.exit(1);
}
context(text, event);
```

`hooks.json`: append `{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/core.mjs\"", "timeout": 10 }` to the existing SessionStart group; add `"SubagentStart": [{ "hooks": [ <record-payload entry as in other events>, <the core.mjs entry> ] }]`. Run the same file: 4 pass.

- [ ] **Commit.** Bump. `git add -- plugins/machinery/core.md plugins/machinery/scripts/core.mjs plugins/machinery/test/core.test.mjs plugins/machinery/test/fixtures/payloads/SubagentStart.json`; `git commit -m "machinery: core.md loads through SessionStart and SubagentStart hooks (recalibration 21)" -m "<trailer>" -- plugins/machinery/core.md plugins/machinery/scripts/core.mjs plugins/machinery/test/core.test.mjs plugins/machinery/test/fixtures/payloads/SubagentStart.json plugins/machinery/test/fixtures/payloads/README.md plugins/machinery/test/fixtures.test.mjs plugins/machinery/hooks/hooks.json plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines.

### Task A2: Draft skills and agent swapped in; auditor parked (decisions 2, 19, 38)

**Files:**
- Create (copy from `draft/skills/<kind>/SKILL.md`): `claude-code/machinery/{agents,instrumentation,postmortem,rule-process,setup,testing,tickets,tooling,worktree}/SKILL.md`
- Replace from draft: `claude-code/machinery/{install,refresh-diverged-branch,train-tool}/SKILL.md`, `plugins/machinery/agents/comparison-agent.md`
- Rewrite: `claude-code/machinery/reload/SKILL.md` (Q2)
- Remove: `claude-code/machinery/{effort-lifecycle,reindex,rule-intake,spec-intake}/`
- Move: `claude-code/machinery/invariant-audit/` → `docs/parked/for-unbreakable/skill-source/invariant-audit/`; `plugins/machinery/agents/invariant-auditor.md` → `docs/parked/for-unbreakable/agents/`; `plugins/machinery/scripts/audit-diff.mjs` → `docs/parked/for-unbreakable/scripts/`; `plugins/machinery/test/audit-diff.test.mjs` → `docs/parked/for-unbreakable/test/`
- Create: `docs/parked/for-unbreakable/README.md`
- Modify: `skills.manifest.json` (`routes.machinery.skills`), `plugins/machinery/test/skills.test.mjs`, `plugins/machinery/test/single-copy.test.mjs`, `README.md` (machinery table)
- Regenerate: `plugins/machinery/skills/`

- [ ] **TDD red.** In `skills.test.mjs` replace `RED CHECK: nine skills exist` with:

```js
test('RED CHECK: the routed machinery skills are the recalibrated set', () => {
  const routed = JSON.parse(fs.readFileSync(path.join(REPO, 'skills.manifest.json'), 'utf8')).targets['claude-plugin'].routes.machinery.skills;
  assert.deepEqual([...routed].sort(), ['agents', 'install', 'instrumentation', 'postmortem', 'refresh-diverged-branch', 'reload', 'rule-process', 'setup', 'testing', 'tickets', 'tooling', 'train-tool', 'worktree']);
  for (const name of routed) assert.ok(fs.existsSync(path.join(BUCKET, name, 'SKILL.md')), `${name} has no SKILL.md`);
});
```

Run it by name. Expected: `Expected values to be strictly deep-equal` listing `effort-lifecycle`, `invariant-audit`, `reindex`, `rule-intake`, `spec-intake`.

- [ ] **TDD green.**
  1. Copy the twelve draft skills and the draft agent into place. In `install/SKILL.md` delete the line starting `4. Hosted CI` (it returns with its mechanism in B5).
  2. Q2 yes: in `rule-process/SKILL.md` description change `Replaces rule-intake, spec-intake and reload.` to `Replaces rule-intake and spec-intake.`; write `reload/SKILL.md`:

```markdown
---
name: reload
description: Load when the user runs /machinery:reload, or after a filing changed core.md mid-session. Prints the current core.md (and with --project the project's .claude/rules) into this session without restarting.
---
# /machinery:reload

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/reload.mjs" --scratchpad "<this session's scratchpad>"` (`--project` adds `.claude/rules/`, `--all` prints every file; with no scratchpad omit the flag).
2. Read the returned blocks.
```

  3. `git rm -r -q` the four removed skill dirs; `git mv` the four parked items; write the parked README:

```markdown
# For unbreakable — parked

Moved out of machinery on 2026-09-14 by recalibration decisions 19 and 24 (`docs/learnings/recalibration-2026-09/STATUS.md`). They apply unbreakable's knowledge and move to unbreakable when it is worked: skills to `claude-code/unbreakable/`, agents to `plugins/unbreakable/agents/`.

- `skill-source/invariant-audit/` — was `claude-code/machinery/invariant-audit/`.
- `agents/invariant-auditor.md` — was `plugins/machinery/agents/`.
- `scripts/audit-diff.mjs`, `test/audit-diff.test.mjs` — were in `plugins/machinery/`; their `./lib/` and `./helpers/` imports still point at machinery and must be re-pointed on the move.
- The design-skill draft stays at `docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/`.

Open when worked: A308 (the auditor's model tier).
```

  4. `skills.manifest.json`: `routes.machinery.skills` = the 13 names above. `skills.test.mjs`: delete test `no skill restates a rule bullet verbatim (spec I37)` (skills are now the rules' home, decision 2; four draft sentences match rule bullets, measured). `single-copy.test.mjs`: delete `audit procedure lives only in the auditor brief (spec I35)`; `agents carry plugin agent frontmatter` iterates `['comparison-agent.md']`.
  5. Root `README.md` machinery table: one row per routed skill, cell = the first sentence of its frontmatter description; drop rows for removed skills.
  6. `node scripts/build-skills.mjs build` (expect `staged 13 skill(s) into plugins/machinery/skills/`). Run the red test: pass.
- [ ] **Commit.** Bump. `git add -- claude-code/machinery docs/parked/for-unbreakable/README.md`; `git commit -m "machinery: skills by kind from the recalibration draft; invariant auditor parked for unbreakable (recalibration 2, 19, 38)" -m "<trailer>" -- claude-code/machinery docs/parked/for-unbreakable plugins/machinery/skills plugins/machinery/agents plugins/machinery/scripts/audit-diff.mjs plugins/machinery/test/audit-diff.test.mjs plugins/machinery/test/skills.test.mjs plugins/machinery/test/single-copy.test.mjs plugins/machinery/.claude-plugin/plugin.json skills.manifest.json README.md`
- [ ] **Report:** global lines + the build's `staged 13 skill(s)` line.

### Task A3: Index, citation check and nudge removed (decision 10; SUMMARY mechanism 3)

**Files:**
- Remove: `plugins/machinery/scripts/{reindex.mjs,nudge.mjs}`, `scripts/lib/{index.mjs,frontmatter.mjs}`, `scripts/gate/citation-target.mjs`, `register/RULES_INDEX.md`, `test/{lib-index.test.mjs,nudge.test.mjs}`, `test/helpers/citation-target-driver.mjs`, `test/fixtures/payloads/PostToolUse-Edit.json`
- Modify: `scripts/gate/{register-check.mjs,spec-check.mjs,sweep-guard.mjs,gate.mjs}`, `scripts/gate/manifest.mjs` (regenerated), `scripts/lib/{layout.mjs,config.mjs}`, `scripts/{install.mjs,intake.mjs}`, `hooks/hooks.json` (PostToolUse group removed), tests `gate.test.mjs`, `spec.test.mjs`, `install.test.mjs`, `intake.test.mjs`, `single-copy.test.mjs`, `purity.test.mjs`, `fixtures.test.mjs`, `gate-manifest.test.mjs`, `lib-config.test.mjs`; #99: `scripts/lib/issue-tracking.mjs`, `test/issue-tracking.test.mjs`

- [ ] **TDD red.** Add to `gate.test.mjs`:

```js
test('a staged rule file with no index anywhere passes the gate (decision 10)', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/rules/t.md', RULE); write(r.root, '.claude/machinery/inbox.md', ''); g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout);
    assert.doesNotMatch(res.stdout, /index/);
  } finally { r.cleanup(); }
});
```

Add to `intake.test.mjs`:

```js
test('install and project intake write no index, and the filing commit is the rule file and the inbox (decision 10)', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    for (const f of ['RULES_INDEX.md', 'SPEC_INDEX.md']) assert.equal(fs.existsSync(path.join(r.root, '.claude', 'machinery', f)), false, f);
    const stamp = runScript('scripts/intake.mjs', { args: ['list', '--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } }).stdout.trim().split('\t')[0];
    runScript('scripts/place.mjs', { args: ['--file', path.join(r.root, '.claude', 'rules', 'straight-talk.md'), '--section', 'Claims', '--text', 'Never guess a path.'] });
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', stamp, '--home', '.claude/rules/straight-talk.md § Claims'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(g(r.root, 'show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean).sort(), ['.claude/machinery/inbox.md', '.claude/rules/straight-talk.md']);
  } finally { r.cleanup(); }
});
```

Run each by name. Expected: gate test fails `1 !== 0` on `index comparison(s) failed — index not staged`; intake test fails `true !== false` with message `RULES_INDEX.md`.

- [ ] **TDD green.**
  - `register-check.mjs`: body is only the pending count (`registerCheck({ inbox })`: `report('register_check', n, n, 'pending inbox entr… (must be 0)')`, return `n === 0`; malformed inbox → report and `false`); no git, no index imports; `claims: Object.freeze([])` (decision 3).
  - `spec-check.mjs`: keep the pending leg and the filed-outside-area leg; delete `stagedSpecTree` and every index leg; `claims: Object.freeze([])`. `sweep-guard.mjs`: `claims: Object.freeze([])`.
  - `gate.mjs`: layout and ctx carry `inbox`, `specsDir`, `specInbox`, `root`, `mergeMode` only; drop the citation comments and index imports. Regenerate: `node plugins/machinery/scripts/gate-manifest.mjs` (expect `gate_manifest: 0 of 3`).
  - `layout.mjs`: remove `RULES_INDEX`, `LEGACY_RULES_INDEX`, `SPEC_INDEX`, `REGISTER_DIR`. `config.mjs`: remove `universalIndex`, `projectIndex`, `legacyProjectIndex`, `projectSpecIndex`, `legacyProjectSpecIndex`.
  - `install.mjs`: no index generation, no migrations, stage list without indexes; gate lib copy list `['git.mjs', 'lines.mjs', 'root.mjs', 'inbox.mjs', 'report.mjs', 'layout.mjs']`.
  - `intake.mjs`: no index write; staged files `[rules|specs dir, inbox, ...extra]`.
  - `hooks.json`: delete the PostToolUse group. Delete the files listed under Remove.
  - #99 `lib/issue-tracking.mjs` `normalizeAnswer`: delete the `parseRuleFile` try-block and its import; in `issue-tracking.test.mjs` delete the `/rules index/` assertion.
  - Tests: in `gate.test.mjs` delete the citation-target import, the `reindex.mjs` call in `project()` and in `--universal runs the register check…`, and every test whose name contains `index`, `citation`, `SUBDIRECTORY`, `subdirectory`, `1 MiB`, `mid-stream`, `hunk`, `CRLF`, `line source`. In `spec.test.mjs` delete the tests named `the pre-#81 index name…`, `the pre-move spec index location…`, `the spec layout is resolvable…`, `the spec index is outside…`, `the spec index is generated, never authored, and a filed…`, `the spec index is generated from the spec files…`; strip index assertions from `install creates the spec layout…` and `spec intake refuses a home outside…`. In `install.test.mjs` delete both `migration:` tests and index assertions (including #99 test 1's `RULES_INDEX.md` lines). `single-copy.test.mjs`: delete `the register index is exactly the generated one (spec I2)`. `purity.test.mjs` EXEMPT: drop `reindex.mjs`. `fixtures.test.mjs` REQUIRED: drop `PostToolUse-Edit`. `gate-manifest.test.mjs`: delete `the unwired citation check carries its ruling and cites nothing (#29, I44)`. `lib-config.test.mjs`: drop index-path imports and asserts.
  - Check: `git grep -n -e RULES_INDEX -e SPEC_INDEX -e reindex -e generateIndex -e parseRuleFile -e citation-target -e nudge.mjs -- plugins/machinery ':!plugins/machinery/inbox.md'` prints only `test/observations.test.mjs` sample strings; rewrite or delete any other hit.
  - Run both red tests: pass.
- [ ] **Commit.** Bump. `git rm -q --` the Remove list; `git commit -m "machinery: drop the rules/spec indexes, citation check and nudge; the gate checks the inbox (recalibration 10)" -m "<trailer>" -- plugins/machinery`
  (whole-directory pathspec is correct here: every change under it belongs to this task; `git status --short` shows nothing outside it.)
- [ ] **Report:** global lines + the `git grep` residue count.

### Task A4: Refusals and capture name `/machinery:rule-process` (mechanisms 1, 2, 8; 4's root-session refusal)

**Files:** Modify `plugins/machinery/scripts/gate/{register-check.mjs,spec-check.mjs,gate.mjs}`, `scripts/capture.mjs`, `scripts/intake.mjs`, tests `gate.test.mjs`, `spec.test.mjs`, `capture.test.mjs`, `intake.test.mjs`.

- [ ] **TDD red.** Add/edit:

```js
// gate.test.mjs
test('a pending entry refuses the commit naming the inbox and /machinery:rule-process, with no bypass offered', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-14T00:00:00Z PRULE s\n\nPRULE: x\n\ndisposition: PENDING\n');
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /^commit refused: 1 pending entry in \.claude\/machinery\/inbox\.md — run \/machinery:rule-process$/m);
    assert.doesNotMatch(res.stdout, /--no-verify/);
  } finally { r.cleanup(); }
});
```

In `spec.test.mjs` test `RED CHECK: an undispositioned spec entry blocks the commit…` add `assert.match(res.stdout, /^commit refused: 1 pending entry in \.claude\/machinery\/spec-inbox\.md — run \/machinery:rule-process$/m);`.
In `capture.test.mjs` change the root PRULE assertion to `assert.match(ctx(res), /^PRULE captured verbatim to .*inbox\.md \(PENDING\)\. Commits are refused until it is filed: run \/machinery:rule-process\.$/m);`, the worktree assertion to `/Commits in .* are refused until it is filed: run \/machinery:rule-process from /`, the pending-nudge assertion to `/^1 rule pending in the inbox — run \/machinery:rule-process before this prompt\.$/m`; apply the same wording change to the SPEC capture assertions in `spec.test.mjs`.
In `intake.test.mjs` `intake commit --kind project refuses from inside a worktree` add `assert.ok(res.stderr.includes(\`run /machinery:rule-process from ${r.root}\`), res.stderr);`.

Run each by name. Expected failures: gate — `commit gate FAILED … --no-verify` present, refusal line absent; capture — old `Run the intake sequence now` text; intake — stderr lacks the root path.

- [ ] **TDD green.**
  - `register-check.mjs` and `spec-check.mjs`: after the count line, when pending, print `commit refused: ${n} pending entr${n === 1 ? 'y' : 'ies'} in ${rel} — run /machinery:rule-process` where `rel` is the inbox path relative to `root`, POSIX separators. Outside-area line becomes `commit refused: ${stamp} is filed at ${p}, outside docs/dictated-specs/ — dismiss it with disposition.mjs --dismissed or file it under docs/dictated-specs/`.
  - `gate.mjs`: delete the final `commit gate FAILED … --no-verify …` line; a throwing check prints `commit refused: gate check ${c.id} could not run — ${e.message}`.
  - `capture.mjs`: messages exactly `URULE|PRULE|SPEC captured verbatim to ${inbox} (PENDING). Commits are refused until it is filed: run /machinery:rule-process.` (root) and `… (PENDING). Commits in ${root} are refused until it is filed: run /machinery:rule-process from ${root}.` (worktree); nudges `${n} rule${s} pending in the inbox — run /machinery:rule-process before this prompt.` and `${n} specification${s} pending in the spec inbox — run /machinery:rule-process before this prompt.`; the de-duplication tests `l.includes('captured verbatim')`.
  - `intake.mjs` root-session refusals: `a project rule is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}` (and `a specification …`).
  - Run the red tests: pass.
- [ ] **Commit.** Bump. `git commit -m "machinery: refusals and capture name /machinery:rule-process and the fix; no --no-verify offer (recalibration 3)" -m "<trailer>" -- plugins/machinery/scripts/gate/register-check.mjs plugins/machinery/scripts/gate/spec-check.mjs plugins/machinery/scripts/gate/gate.mjs plugins/machinery/scripts/capture.mjs plugins/machinery/scripts/intake.mjs plugins/machinery/test/gate.test.mjs plugins/machinery/test/spec.test.mjs plugins/machinery/test/capture.test.mjs plugins/machinery/test/intake.test.mjs plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines.

### Task A5: A URULE files into `core.md` or a skill (mechanism 4)

**Files:** Modify `plugins/machinery/scripts/lib/{config.mjs,layout.mjs}`, `scripts/place.mjs`, `scripts/intake.mjs`, #99 `scripts/issue-tracking.mjs` (record-global guard); tests `lib-config.test.mjs`, `intake.test.mjs`, and every test helper that writes `rulesSource` into `machinery.json` (`capture.test.mjs`, `banner.test.mjs`, `reload.test.mjs`, #99 `issue-tracking-cli.test.mjs`) → `pluginSource: <the directory that held rules/>`.

- [ ] **TDD red.** `lib-config.test.mjs` (import `universalSource, universalCore` alongside the existing names):

```js
test('pluginSource names the universal source; inbox.md and core.md sit in it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ pluginSource: 'D:/checkout/plugins/machinery' }));
  process.env.MACHINERY_HOME = home;
  assert.equal(universalSource(), path.resolve('D:/checkout/plugins/machinery'));
  assert.equal(universalInbox(), path.resolve('D:/checkout/plugins/machinery/inbox.md'));
  assert.equal(universalCore(), path.resolve('D:/checkout/plugins/machinery/core.md'));
});

test('RED CHECK: a machinery.json still carrying rulesSource is refused, naming pluginSource', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: 'D:/checkout/plugins/machinery/rules' }));
  process.env.MACHINERY_HOME = home;
  assert.throws(() => universalSource(), /"rulesSource" was replaced by "pluginSource"/);
});
```

`intake.test.mjs` — change the `place appends…` test's file to `<tmp>/.claude/rules/a.md`, and add:

```js
test('place appends to core.md under its title, and into a bucket skill section; a bare rules/ file is refused', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'place-'));
  const core = path.join(d, 'plugins', 'machinery', 'core.md'); fs.mkdirSync(path.dirname(core), { recursive: true });
  fs.writeFileSync(core, '# Machinery core (always on)\n- one\n');
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', core, '--section', 'Machinery core (always on)', '--text', 'two'] }).code, 0);
  assert.equal(fs.readFileSync(core, 'utf8'), '# Machinery core (always on)\n- one\n- two\n');
  const skill = path.join(d, 'claude-code', 'machinery', 'testing', 'SKILL.md'); fs.mkdirSync(path.dirname(skill), { recursive: true });
  fs.writeFileSync(skill, '---\nname: testing\ndescription: d\n---\n# Testing\n\n## Writing a test\n- a\n\n## When something fails\n- b\n');
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', skill, '--section', 'Writing a test', '--text', 'c'] }).code, 0);
  assert.match(fs.readFileSync(skill, 'utf8'), /## Writing a test\n- a\n- c\n\n## When something fails/);
  const bare = path.join(d, 'rules', 'x.md'); fs.mkdirSync(path.dirname(bare)); fs.writeFileSync(bare, '');
  const res = runScript('scripts/place.mjs', { args: ['--file', bare, '--section', 'S', '--text', 't'] });
  assert.equal(res.code, 1);
  assert.match(res.stderr, /\.claude\/rules\/<file>\.md, claude-code\/machinery\/<kind>\/SKILL\.md or plugins\/machinery\/core\.md/);
});
```

Replace the two `universal intake …` tests with one fixture repo: `plugins/machinery/{core.md,inbox.md,.claude-plugin/plugin.json ("version":"0.1.0")}`, `claude-code/machinery/testing/SKILL.md` (as above), and a stub `scripts/build-skills.mjs`:

```js
import fs from 'node:fs';
if (process.argv[2] !== 'build') process.exit(2);
fs.mkdirSync('plugins/machinery/skills/testing', { recursive: true });
fs.copyFileSync('claude-code/machinery/testing/SKILL.md', 'plugins/machinery/skills/testing/SKILL.md');
```

committed; `machinery.json` `{ pluginSource: <repo>/plugins/machinery }`; append a URULE entry; place `c` under `Writing a test`; then:

```js
const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'universal', '--stamp', stamp, '--home', 'claude-code/machinery/testing/SKILL.md § Writing a test'], cwd: r.root, env });
assert.equal(res.code, 0, res.stderr + res.stdout);
assert.deepEqual(g(r.root, 'show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean).sort(),
  ['claude-code/machinery/testing/SKILL.md', 'plugins/machinery/.claude-plugin/plugin.json', 'plugins/machinery/inbox.md', 'plugins/machinery/skills/testing/SKILL.md']);
assert.equal(g(r.root, 'status', '--porcelain'), '');
const bad = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'universal', '--stamp', stamp, '--home', 'plugins/machinery/rules/x.md § S'], cwd: r.root, env });
assert.equal(bad.code, 1);
assert.match(bad.stderr, /filed in plugins\/machinery\/core\.md or claude-code\/machinery\/<kind>\/SKILL\.md/);
```

(the home check runs before the stamp lookup, so the already-filed stamp still reaches it.) Run each by name. Expected: config — `does not provide an export named 'universalSource'`; place — exit `1 !== 0` with `refusing to write outside a rules directory`; intake — non-zero with `no PENDING entry with stamp` (the old code reads `rulesSource`, not `pluginSource`).

- [ ] **TDD green.**
  - `layout.mjs`: `export const CORE = 'core.md';`. `config.mjs`:

```js
function userConfigFile() { return path.join(home(), '.claude', 'machinery.json'); }
export function universalSource() {
  const c = userConfig();
  if (c.rulesSource !== undefined && c.pluginSource === undefined) {
    throw new Error(`${userConfigFile()}: "rulesSource" was replaced by "pluginSource" — set "pluginSource" to the plugin directory (the parent of the old rules directory)`);
  }
  return c.pluginSource ? path.resolve(c.pluginSource) : pluginRoot();
}
export const universalInbox = () => path.join(universalSource(), INBOX);
export const universalCore = () => path.join(universalSource(), CORE);
// Read only by banner, reload and install --machine; removed with them in Task A6.
export const rulesSource = () => path.join(universalSource(), RULES_DIR);
```

  - `place.mjs`: replace the rules-directory test with `ALLOWED = [/[\\/]\.claude[\\/]rules[\\/][^\\/]+\.md$/, /[\\/]claude-code[\\/]machinery[\\/][a-z0-9-]+[\\/]SKILL\.md$/, /[\\/]plugins[\\/]machinery[\\/]core\.md$/]`; refusal `refusing to write ${abs}: a rule goes in .claude/rules/<file>.md, claude-code/machinery/<kind>/SKILL.md or plugins/machinery/core.md`. When no `## ${section}` exists, the file has no `## ` heading, and its `# ` title equals `section`, push the bullet at the end.
  - `intake.mjs` universal branch: `source = universalSource()`; `repo` = `git rev-parse --show-toplevel` of `realDir(source)`; `rel` = home before ` § `; accept `rel === path.relative(repo, universalCore())` (POSIX) or `/^claude-code\/machinery\/[a-z0-9-]+\/SKILL\.md$/`, else die `a universal rule is filed in ${coreRel} or claude-code/machinery/<kind>/SKILL.md, not ${rel}`. For a skill home run `spawnSync(process.execPath, [path.join(repo, 'scripts', 'build-skills.mjs'), 'build'], { cwd: repo, encoding: 'utf8' })` (non-zero → die naming the command and stderr) and add `path.join(source, 'skills')`. Bump `source`. Files = `[home file, (skills dir), inbox, plugin.json]`.
  - #99 `issue-tracking.mjs` record-global: guard against `universalSource()` instead of `rulesSource()`, same refusal wording with "the plugin source".
  - Run the red tests: pass.
- [ ] **Commit.** Bump. `git commit -m "machinery: a universal rule files into core.md or a skill's bucket source (recalibration 1, 2)" -m "<trailer>" -- plugins/machinery/scripts plugins/machinery/test plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines + one line for the owner: `~/.claude/machinery.json` needs `{ "pluginSource": "I:/IdeaProjects/ai-skills/plugins/machinery" }` in place of `rulesSource`.

### Task A6: `rules/` and the junction removed (decisions 21, 37, 38)

**Files:**
- Remove: `plugins/machinery/rules/{agent-topology,environment-and-platform,reference-sources,rule-governance,straight-talk,tool-output,verification-and-evidence,work-tracking,worktree-discipline}.md`
- Move: `plugins/machinery/rules/design-invariants.md` → `docs/parked/for-unbreakable/rules/design-invariants.md` (append its line to the parked README: "`rules/design-invariants.md` — was `plugins/machinery/rules/`, including § Weak claims and the enforcement ledger. Machinery no longer depends on unbreakable: nothing shipped names it.")
- Modify: `scripts/lib/config.mjs` (delete `rulesSource`), `scripts/reload.mjs`, `scripts/lib/reload.mjs`, `scripts/banner.mjs`, `scripts/install.mjs`, `.claude-plugin/plugin.json` (delete `"dependencies"`); tests `reload.test.mjs`, `banner.test.mjs`, `install.test.mjs`, `single-copy.test.mjs`, `skills.test.mjs`, `lib-config.test.mjs`

- [ ] **TDD red.**
  - `reload.test.mjs`: `fixture()` builds a plugin dir with `core.md` (`# Core\n\n- the core\n`) and `machinery.json` `{ pluginSource }`, plus a `makeRepo()` project whose `.claude/rules/` holds the ten `NAMES`; `run()` passes `cwd: f.project`. Existing tests pass `--project`, expect `11 files` and blocks `===== .claude/rules/<n> =====`. Add:

```js
test('RED CHECK: without --project reload prints core.md alone', () => {
  const f = fixture();
  try {
    const r = run(f, ['--all']);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(r.stdout.includes('===== core.md =====\n# Core\n\n- the core\n'), r.stdout);
    assert.match(r.stdout, /^machinery_reload: 1 files, 1 changed$/m);
  } finally { f.cleanup(); }
});
```

  - `banner.test.mjs` `reports measured facts for an uninstalled project`: replace the `rules source` assertion with `assert.match(t, /^  core: .*core\.md \(present\)$/m); assert.doesNotMatch(t, /junction|cant-break-by-design/);`; delete the three tests about rules source / unbreakable detection.
  - `install.test.mjs`: replace both `--machine` tests (and #99's `--machine seeds the global…`) with:

```js
test('RED CHECK: --machine is refused, names what replaced it, and links nothing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  try {
    const res = runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
    assert.equal(res.code, 2);
    assert.match(res.stderr, /--machine was removed: machinery's SessionStart and SubagentStart hooks load core\.md; enable machinery per project with claude plugin install machinery@ai-skills --scope project/);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'rules')), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
```

  Run each by name. Expected: reload — `missing: …rules`, count `0 files`; banner — no `core:` line; install — `0 !== 2` (the junction is created).

- [ ] **TDD green.**
  - `lib/reload.mjs`: `reloadDelta({ sources, … })`; `collect(sources)` treats a file source as one entry keyed by its label and a directory source as `<label>/<name>.md` entries; missing sources print as today. `reload.mjs`: `sources = [['core.md', universalCore()]]`, `--project` adds `['.claude/rules', projectRules(projectRoot(process.cwd()))]`.
  - `banner.mjs`: delete the rules-source/junction line, `cbbdInstalled` and its line; add `  core: ${path.join(pluginRoot(), 'core.md')} (${exists ? 'present' : 'MISSING — reinstall machinery'})`.
  - `install.mjs`: delete `installMachine`, `link`, #99's `seed` for the global file; `--machine` → stderr the tested sentence, exit 2. The project seed of `project_issue_tracking.md` stays.
  - `config.mjs`: delete `rulesSource`. Delete the rule files, `git mv` design-invariants, delete `"dependencies"` from plugin.json.
  - Tests: `single-copy.test.mjs` delete `the ten rule files exist in the plugin and nowhere else (spec I1)`; `skills.test.mjs` delete `reload prints every universal rule file as a delimited block`; `lib-config.test.mjs` defaults test asserts `universalSource() === PLUGIN` and `universalInbox()`.
  - Check: `git grep -n "rulesSource\|rules/[a-z-]*\.md" -- plugins/machinery ':!plugins/machinery/inbox.md'` hits are comments only; rewrite each comment that cites a deleted rule file to state its reason directly or delete it.
  - Run the red tests: pass.
- [ ] **Commit.** Bump. `git commit -m "machinery: universal rules are core.md and skills; rules/ and install --machine removed; unbreakable dependency dropped (recalibration 21, 37, 38)" -m "<trailer>" -- plugins/machinery docs/parked/for-unbreakable`
- [ ] **Report:** global lines + the rules-grep residue count.

---

## Phase B — remaining mechanisms

### Task B1: `setup.mjs show` / `set` (mechanism 11; decisions 22, 39, 41)

**Files:** Create `plugins/machinery/scripts/lib/settings.mjs`, `scripts/setup.mjs`, `test/setup.test.mjs`. Modify `scripts/lib/layout.mjs` (`export const CONFIG = 'config.json';`), `test/gate-purity.test.mjs` (`SERIALISES_TO_A_FILE` gains `path.join('lib', 'settings.mjs')`).

- [ ] **TDD red.** `test/setup.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { readSetting } from '../scripts/lib/settings.mjs';

const setup = (root, ...args) => runScript('scripts/setup.mjs', { args, cwd: root });
const CONFIG = (root) => path.join(root, '.claude', 'machinery', 'config.json');

test('set records each kind of key and show prints it; worktree shows its default until recorded', () => {
  const r = makeRepo();
  try {
    assert.match(setup(r.root, 'show').stdout, /^worktree: not recorded \(default: always\)$/m);
    assert.equal(setup(r.root, 'set', 'tiers.fast', 'node check.mjs <components>').code, 0);
    assert.equal(setup(r.root, 'set', 'reviewBeforeMain', 'person').code, 0);
    assert.equal(setup(r.root, 'set', 'comparisonPaths', 'src/render', 'src/export').code, 0);
    const shown = setup(r.root, 'show').stdout;
    assert.match(shown, /^tiers\.fast: node check\.mjs <components>$/m);
    assert.match(shown, /^comparisonPaths: src\/render, src\/export$/m);
    assert.match(shown, /^tiers\.merge: not recorded — \/machinery:setup tiers$/m);
    assert.match(shown, /^machinery_setup: 3 of 9 keys recorded$/m);
  } finally { r.cleanup(); }
});

test('readSetting on an unrecorded key without a default names the setup item', () => {
  const r = makeRepo();
  try {
    assert.equal(readSetting(r.root, 'worktree'), 'always');
    assert.throws(() => readSetting(r.root, 'reviewBeforeMain'), /^Error: reviewBeforeMain is not recorded in \.claude\/machinery\/config\.json — run \/machinery:setup review$/);
  } finally { r.cleanup(); }
});

test('RED CHECK: set refuses an unaccepted value, naming the accepted ones, and writes nothing', () => {
  const r = makeRepo();
  try {
    const res = setup(r.root, 'set', 'worktree', 'sometimes');
    assert.equal(res.code, 1);
    assert.equal(res.stderr.trim(), "worktree: 'sometimes' is not accepted — use always, multi-commit or never");
    const fast = setup(r.root, 'set', 'tiers.fast', 'cargo test');
    assert.equal(fast.code, 1);
    assert.match(fast.stderr, /tiers\.fast: 'cargo test' has no <components> placeholder/);
    assert.equal(fs.existsSync(CONFIG(r.root)), false);
  } finally { r.cleanup(); }
});

test('a malformed config.json is a diagnostic naming the file, not a stack trace', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.dirname(CONFIG(r.root)), { recursive: true }); fs.writeFileSync(CONFIG(r.root), '{oops');
    const res = setup(r.root, 'show');
    assert.equal(res.code, 1);
    assert.match(res.stderr, /config\.json: not valid JSON .* — fix or delete the file, then run \/machinery:setup/);
  } finally { r.cleanup(); }
});
```

Run `node --test plugins/machinery/test/setup.test.mjs`. Expected: `Cannot find module …scripts\lib\settings.mjs`.

- [ ] **TDD green.** `lib/settings.mjs` — one declaration of every key:

```js
import fs from 'node:fs';
import path from 'node:path';
import { MACHINERY_DIR, CONFIG } from './layout.mjs';

export const KEYS = Object.freeze({
  worktree: { item: 'worktree', accepts: ['always', 'multi-commit', 'never'], default: 'always' },
  'tiers.declaration': { item: 'tiers' },
  'tiers.fast': { item: 'tiers', placeholder: '<components>' },
  'tiers.merge': { item: 'tiers' },
  'tiers.heavy': { item: 'tiers' },
  'tiers.assignment': { item: 'tiers', accepts: ['ask-per-test', 'propose-per-commit', 'claude-decides'] }, // Q5
  comparisonAgent: { item: 'comparison-agent' },
  comparisonPaths: { item: 'comparison-agent', list: true },
  reviewBeforeMain: { item: 'review', accepts: ['none', 'person', 'agent', 'person-and-agent'] },
});
export const configFile = (root) => path.join(root, '.claude', MACHINERY_DIR, CONFIG);
const or = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} or ${a.at(-1)}` : a[0]);
const at = (doc, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc);

function load(root) {
  const file = configFile(root);
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`${file}: not valid JSON (${e.message}) — fix or delete the file, then run /machinery:setup`); }
}

export function validate(key, values) {
  const spec = KEYS[key];
  if (!spec) throw new Error(`${key}: not a setting — use ${or(Object.keys(KEYS))}`);
  if (spec.list) {
    if (!values.length || values.some((v) => !v.trim())) throw new Error(`${key}: give one or more non-empty values`);
    return values;
  }
  const value = values.join(' ').trim();
  if (!value) throw new Error(`${key}: an empty value records nothing`);
  if (spec.accepts && !spec.accepts.includes(value)) throw new Error(`${key}: '${value}' is not accepted — use ${or(spec.accepts)}`);
  if (spec.placeholder && !value.includes(spec.placeholder)) throw new Error(`${key}: '${value}' has no ${spec.placeholder} placeholder — write the command with ${spec.placeholder} where the component names go`);
  return value;
}

export function setSetting(root, key, values) {
  const value = validate(key, values);
  const doc = load(root);
  const parts = key.split('.');
  let node = doc;
  for (const p of parts.slice(0, -1)) node = node[p] ??= {};
  node[parts.at(-1)] = value;
  fs.mkdirSync(path.dirname(configFile(root)), { recursive: true });
  fs.writeFileSync(configFile(root), JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return value;
}

export function recorded(root, key) { return at(load(root), key); }

export function readSetting(root, key) {
  const v = recorded(root, key);
  if (v !== undefined) return v;
  if ('default' in KEYS[key]) return KEYS[key].default;
  throw new Error(`${key} is not recorded in .claude/machinery/config.json — run /machinery:setup ${KEYS[key].item}`);
}
```

`setup.mjs`: `show` prints per key `k: v` (arrays joined `, `), `worktree: not recorded (default: always)`, or `k: not recorded — /machinery:setup <item>`, then `machinery_setup: <n> of <total> keys recorded`; `set <key> <value…>` calls `setSetting` and prints `recorded <key>`; any thrown error → stderr message, exit 1; unknown subcommand → usage, exit 2. Root is `projectRoot(process.cwd())`. Run the file: 4 pass.

- [ ] **Commit.** Bump. `git add --` the three new files; `git commit -m "machinery: setup.mjs records and validates the project settings (recalibration 22, 39, 41)" -m "<trailer>" -- plugins/machinery/scripts/lib/settings.mjs plugins/machinery/scripts/setup.mjs plugins/machinery/test/setup.test.mjs plugins/machinery/scripts/lib/layout.mjs plugins/machinery/test/gate-purity.test.mjs plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines.

### Task B2: Pre-commit runs `tiers.fast` (mechanisms 5, 7; decisions 13, 15, 25, 39) — blocked on Q3, Q4

**Files:** Create `plugins/machinery/scripts/tiers.mjs`, `scripts/lib/components.mjs` (Q3's rule, one exported `componentsOf(root, stagedPaths) → string[]`), `test/tiers.test.mjs`. Modify `scripts/install.mjs` (writes the pre-commit below; copies `tiers.mjs` to `.githooks/machinery/` and `settings.mjs`, `components.mjs` into its `lib/`), `test/install.test.mjs`.

- [ ] **TDD red.** `test/tiers.test.mjs` imports `./helpers/env.mjs` first (env-scrub.test requires it of a suite that spawns git). Fixture: `makeRepo()`, `.git/info/exclude` listing `ran.txt`, `merged.txt`, `*.flag` (so the commands' own files never dirty the tree), `install.mjs --root`, commit; a component `pkg-a` in the form Q3's answer defines, containing `src/x.txt`; `check.mjs` at the root: `import fs from 'node:fs'; fs.writeFileSync('ran.txt', process.argv.slice(2).join(' ')); process.exit(fs.existsSync('fail.flag') ? 1 : 0);`.

```js
const fast = (root) => runScript('scripts/tiers.mjs', { args: ['fast'], cwd: root });

test('fast runs the recorded command once with the touched components', () => {
  // stage pkg-a/src/x.txt; setup.mjs set tiers.fast "node check.mjs <components>"
  const res = fast(r.root);
  assert.equal(res.code, 0, res.stdout + res.stderr);
  assert.equal(fs.readFileSync(path.join(r.root, 'ran.txt'), 'utf8'), 'pkg-a');
  assert.match(res.stdout, /^fast_tier: 0 of 1 touched components failed$/m);
});

test('a failing fast tier refuses the commit naming the components and the command', () => {
  // fail.flag present
  assert.equal(res.code, 1);
  assert.match(res.stdout, /^commit refused: fast tests failed in pkg-a — run `node check\.mjs pkg-a`, fix, commit again$/m);
});

test('RED CHECK: with no tiers recorded the hook refuses and names /machinery:setup tiers', () => {
  // nothing recorded, pkg-a/src/x.txt staged
  assert.equal(res.code, 1);
  assert.match(res.stdout, /^commit refused: no tiers recorded in \.claude\/machinery\/config\.json — run \/machinery:setup tiers$/m);
});

test('the installed pre-commit runs the gate, then the fast tier', () => {
  assert.equal(fs.readFileSync(path.join(r.root, '.githooks', 'pre-commit'), 'utf8'),
    '#!/bin/sh\n# Installed by /machinery:install.\nnode .githooks/machinery/gate.mjs && exec node .githooks/machinery/tiers.mjs fast\n');
});
```

Run the file. Expected: `Cannot find module …scripts\tiers.mjs`; the install test fails on the old hook text.

- [ ] **TDD green.** `tiers.mjs fast`: root = `projectRoot(cwd)`; `readSetting(root, 'tiers.fast')` — a thrown not-recorded error prints the tested refusal, exit 1; staged = `git diff --cached --name-only`; `comps = componentsOf(root, staged)`; none → `fast_tier: 0 of 0 touched components failed (nothing staged in a component)`, exit 0; else `cmd = recorded.replaceAll('<components>', comps.join(' '))`, `spawnSync(cmd, { cwd: root, shell: true, stdio: 'inherit' })`; non-zero → `fast_tier: 1 of 1 …` then the refusal line, exit 1; zero → the pass line. Q4's answer decides whether anything runs before `cmd`. Install writes the tested hook text and the copies. Run the file: pass.
- [ ] **Commit.** Bump. `git add --` new files; `git commit -m "machinery: the installed pre-commit runs the fast tier for touched components (recalibration 13, 15, 23)" -m "<trailer>" -- plugins/machinery/scripts/tiers.mjs plugins/machinery/scripts/lib/components.mjs plugins/machinery/test/tiers.test.mjs plugins/machinery/scripts/install.mjs plugins/machinery/test/install.test.mjs plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines + hook duration if the 20 s budget line appears.

### Task B3: Pre-push runs `tiers.merge` on pushes to main; banner line (mechanisms 6, 15; decision 13 amended)

**Files:** Modify `plugins/machinery/scripts/tiers.mjs`, `scripts/install.mjs` (writes `.githooks/pre-push`), `scripts/banner.mjs`, tests `tiers.test.mjs`, `banner.test.mjs`.

- [ ] **TDD red.** In `tiers.test.mjs`, fixture `makeRepo({ withOrigin: true })`, install, record `tiers.fast` and `tiers.merge` = `node merge.mjs` (`merge.mjs` exits 1 when `merge-fail.flag` exists, writes `merged.txt`), commit via hooks:

```js
test('push to main runs the merge tier on the pushed commit; a failure refuses the push', () => {
  let p = spawnSync('git', ['push', '-q', 'origin', 'main'], { cwd: r.root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  assert.ok(fs.existsSync(path.join(r.root, 'merged.txt')));
  // commit again, create merge-fail.flag (excluded like ran.txt and merged.txt)
  p = spawnSync('git', ['push', '-q', 'origin', 'main'], { cwd: r.root, encoding: 'utf8' });
  assert.notEqual(p.status, 0);
  assert.match(p.stdout + p.stderr, /push refused: merge tests failed — run `node merge\.mjs`, fix, push again/);
});

test('RED CHECK: a dirty tree, or HEAD not the pushed commit, refuses the push naming both commits', () => {
  // modify README.md without committing
  const p = spawnSync('git', ['push', '-q', 'origin', 'main'], { cwd: r.root, encoding: 'utf8' });
  assert.notEqual(p.status, 0);
  assert.match(p.stdout + p.stderr, /push refused: working tree not clean or HEAD [0-9a-f]{40} is not pushed [0-9a-f]{40} — commit, check out [0-9a-f]{40}, push again/);
});

test('a push to another branch runs no merge tier', () => {
  const p = spawnSync('git', ['push', '-q', 'origin', 'main:feature'], { cwd: r.root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  assert.equal(fs.existsSync(path.join(r.root, 'merged.txt')), false);
});
```

`banner.test.mjs`: `assert.match(t, /hosted check: none — the pre-push hook is the blocking check before main/)`. Run each by name. Expected: pushes succeed (no pre-push installed) → `merged.txt` missing / status 0; banner shows `local merge gate`.

- [ ] **TDD green.** `tiers.mjs merge`: read stdin lines `<local ref> <local sha> <remote ref> <remote sha>`; keep lines whose remote ref is `refs/heads/main` and local sha is not all zeros; none → `merge_tier: 0 of 0 pushes to main`, exit 0; `git status --porcelain` non-empty or `git rev-parse HEAD` ≠ local sha → the tested refusal (with HEAD, local sha, local sha), exit 1; `readSetting(root, 'tiers.merge')` not recorded → `push refused: no tiers recorded in .claude/machinery/config.json — run /machinery:setup tiers`, exit 1; run the command in place (`shell: true`, `stdio: 'inherit'`); non-zero → `push refused: merge tests failed — run \`<cmd>\`, fix, push again`, exit 1; pass → `merge_tier: 0 of 1 pushes to main failed`. Install writes `#!/bin/sh\n# Installed by /machinery:install.\nexec node .githooks/machinery/tiers.mjs merge\n` and chmods it. Banner: `none — the pre-push hook is the blocking check before main`. Run: pass.
- [ ] **Commit.** Bump. `git commit -m "machinery: the installed pre-push runs the merge tier on pushes to main, in place (recalibration 13)" -m "<trailer>" -- plugins/machinery/scripts/tiers.mjs plugins/machinery/scripts/install.mjs plugins/machinery/scripts/banner.mjs plugins/machinery/test/tiers.test.mjs plugins/machinery/test/banner.test.mjs plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines + hook duration.

### Task B4: `--no-verify` asks the user (decision 29; mechanism 10)

**Files:** Create `plugins/machinery/scripts/no-verify.mjs`, `test/no-verify.test.mjs`. Modify `scripts/lib/emit.mjs`, `test/lib-emit.test.mjs`, `hooks/hooks.json` (PreToolUse `Bash|PowerShell` group gains `node "${CLAUDE_PLUGIN_ROOT}/scripts/no-verify.mjs"`, timeout 5).

- [ ] **TDD red.** `test/no-verify.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/PreToolUse-Bash.json'), 'utf8'));
const run = (command) => runScript('scripts/no-verify.mjs', { stdin: JSON.stringify({ ...base, tool_input: { ...base.tool_input, command } }) });

for (const [command, which] of [
  ['git commit -m "x" --no-verify', 'pre-commit'],
  ['git push --no-verify origin main', 'pre-push'],
  ['make release NO="--no-verify"', 'pre-commit, pre-push'],
]) {
  test(`asks before: ${command}`, () => {
    const res = run(command);
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout).hookSpecificOutput, {
      hookEventName: 'PreToolUse', permissionDecision: 'ask',
      permissionDecisionReason: `--no-verify skips the commit/push hooks (${which}). Allow?`,
    });
  });
}

test('RED CHECK: a command without --no-verify gets no decision', () => {
  const res = run('git commit -m "x"');
  assert.equal(res.code, 0);
  assert.equal(res.stdout, '');
});
```

`lib-emit.test.mjs`: `permission('ask', 'r')` writes `{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: 'r' } }`. Run each file. Expected: `Cannot find module …no-verify.mjs`; `permission is not a function`/missing export.

- [ ] **TDD green.** `emit.mjs`: `export function permission(decision, reason) { write({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason } }); }`. `no-verify.mjs`: payload command; no `--no-verify` substring → exit 0 silent; `t = tokens(command)` (`lib/quotes.mjs`); after a `git` token, the first of `commit`/`push` gives `pre-commit`/`pre-push`; otherwise `pre-commit, pre-push`; `permission('ask', …)`. Garbage stdin → silent exit 0. Add to hooks.json. Run: pass.
- [ ] **Commit.** Bump. `git add --` new files; `git commit -m "machinery: a command with --no-verify stops at a permission prompt (recalibration 29)" -m "<trailer>" -- plugins/machinery/scripts/no-verify.mjs plugins/machinery/test/no-verify.test.mjs plugins/machinery/scripts/lib/emit.mjs plugins/machinery/test/lib-emit.test.mjs plugins/machinery/hooks/hooks.json plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines.

### Task B5: Hosted CI from the recorded tiers (decision 14; mechanism 12)

**Files:** Modify `plugins/machinery/scripts/install.mjs` (`--hosted-ci` replaces `--hosted`), `test/install.test.mjs`, `claude-code/machinery/install/SKILL.md` (restore draft step 4 verbatim), regenerate `plugins/machinery/skills/`. Remove `plugins/machinery/templates/hosted-check.yml`.

- [ ] **TDD red.** Replace `--hosted writes the workflow template; default does not` with:

```js
test('--hosted-ci writes a workflow running the recorded gate and tier commands', () => {
  const r = makeRepo();
  try {
    install(r.root);
    runScript('scripts/setup.mjs', { args: ['set', 'tiers.merge', 'node --test'], cwd: r.root });
    runScript('scripts/setup.mjs', { args: ['set', 'tiers.heavy', 'node heavy.mjs'], cwd: r.root });
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root, '--hosted-ci'], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    const wf = fs.readFileSync(path.join(r.root, '.github', 'workflows', 'machinery.yml'), 'utf8');
    assert.match(wf, /^on:\n  push: \{ branches: \[main\] \}\n  pull_request: \{\}\n  workflow_dispatch: \{\}$/m);
    assert.match(wf, /^      - run: node \.githooks\/machinery\/gate\.mjs$/m);
    assert.match(wf, /^      - run: node --test$/m);
    assert.match(wf, /^    if: github\.event_name == 'workflow_dispatch'\n(.*\n)*      - run: node heavy\.mjs$/m);
  } finally { r.cleanup(); }
});

test('RED CHECK: --hosted-ci with no tiers recorded refuses and writes nothing', () => {
  const r = makeRepo();
  try {
    install(r.root);
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root, '--hosted-ci'], cwd: r.root });
    assert.equal(res.code, 1);
    assert.match(res.stderr, /tiers\.merge is not recorded in \.claude\/machinery\/config\.json — run \/machinery:setup tiers/);
    assert.equal(fs.existsSync(path.join(r.root, '.github')), false);
  } finally { r.cleanup(); }
});
```

Run each by name. Expected: exit 0 with no workflow written (the flag is unknown), then the refusal test fails `0 !== 1`.

- [ ] **TDD green.** `install.mjs --hosted-ci`: read `tiers.merge` (required) and `tiers.heavy` (optional: `recorded()`); write

```yaml
# Written by /machinery:install --hosted-ci from .claude/machinery/config.json. Re-run after changing the tiers.
name: machinery
on:
  push: { branches: [main] }
  pull_request: {}
  workflow_dispatch: {}
jobs:
  merge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node .githooks/machinery/gate.mjs
      - run: <tiers.merge>
  heavy:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: <tiers.heavy>
```

(`heavy` job only when recorded). Delete the `--hosted` branch and the template. Restore install skill step 4 from the draft; `node scripts/build-skills.mjs build`. Run: pass.
- [ ] **Commit.** Bump. `git rm -q -- plugins/machinery/templates/hosted-check.yml`; `git commit -m "machinery: install --hosted-ci turns the recorded hook commands into a GitHub Actions workflow (recalibration 14)" -m "<trailer>" -- plugins/machinery/scripts/install.mjs plugins/machinery/test/install.test.mjs plugins/machinery/templates claude-code/machinery/install/SKILL.md plugins/machinery/skills/install/SKILL.md plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines.

### Task B6: Issue-tracking answer filed and replaced (decisions 33, 36; replaces #99 Task 7) — needs A0

Measured before planning: `record-project` refuses only while an issue-tracking entry is still pending (`if (already.length)` in `issue-tracking.mjs`); a re-run after filing already records a new entry. The missing half is intake.

**Files:** Modify `plugins/machinery/scripts/intake.mjs`, `test/intake.test.mjs`.

- [ ] **TDD red.** Append:

```js
const ANSWER_1 = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.';
const ANSWER_2 = 'Issue tracking: <other tracker> on `<project>`, reached with `<other tool>`.';

test('an issue-tracking entry is filed as the whole project file, and a re-run replaces it naming old and new', () => {
  const h = home(); const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
    const file = path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md');
    for (const [answer, old] of [[ANSWER_1, 'unanswered'], [ANSWER_2, ANSWER_1]]) {
      const rec = runScript('scripts/issue-tracking.mjs', { args: ['record-project', '--answer', answer, '--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h, CLAUDE_CODE_SESSION_ID: 's' } });
      assert.equal(rec.code, 0, rec.stderr);
      const [entry] = pending(projectInbox(r.root));
      const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', entry.stamp, '--home', '.claude/rules/project_issue_tracking.md § Issue tracking'], cwd: r.root, env: { MACHINERY_HOME: h } });
      assert.equal(res.code, 0, res.stderr + res.stdout);
      assert.equal(fs.readFileSync(file, 'utf8'), `${answer}\n`);
      assert.equal(g(r.root, 'log', '-1', '--format=%s'), `rule: issue tracking: ${old.slice(0, 40)} → ${answer.slice(0, 40)}`);
      assert.equal(g(r.root, 'status', '--porcelain'), '');
    }
  } finally { r.cleanup(); }
});

test('RED CHECK: an issue-tracking entry with any other home is refused, naming the home', () => {
  // record-project once, then intake commit with --home '.claude/rules/a.md § S'
  assert.equal(res.code, 1);
  assert.match(res.stderr, /an issue-tracking entry is filed only to \.claude\/rules\/project_issue_tracking\.md — run again with --home "\.claude\/rules\/project_issue_tracking\.md"/);
});
```

Run each by name. Expected: file content still `unanswered\n` plus nothing / subject `rule: …Note: automatic capture…`; the refusal test exits 0.

- [ ] **TDD green.** In `intake.mjs` project branch: when the entry's text ends with `CAPTURE_NOTE` (`lib/issue-tracking.mjs`), require the home file to equal `path.relative(repo, projectIssueTracking(repo))` (else the tested refusal); `answer = normalizeAnswer(entry.text.slice(0, -CAPTURE_NOTE.length))`; `old = (readIfPresent(file) ?? 'unanswered').trim().split('\n')[0]`; write `${answer}\n` as the whole file; disposition `filed → .claude/rules/project_issue_tracking.md`; subject `rule: issue tracking: ${old.slice(0, 40)} → ${answer.split('\n')[0].slice(0, 40)}`. Run: pass.
- [ ] **Commit.** Bump. `git commit -m "intake: an issue-tracking answer replaces the project file; the commit names old and new (#99, recalibration 36)" -m "<trailer>" -- plugins/machinery/scripts/intake.mjs plugins/machinery/test/intake.test.mjs plugins/machinery/.claude-plugin/plugin.json`
- [ ] **Report:** global lines.

### Task B7: Documentation (no code; one commit after the last code task)

**Files:** `plugins/machinery/README.md`, `plugins/machinery/.claude-plugin/plugin.json` (description), `.claude-plugin/marketplace.json` (description), `docs/learnings/recalibration-2026-09/STATUS.md` (§ State), `docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md` (header line), `docs/superpowers/plans/2026-09-12-issue-tracking-config.md` (Tasks 7 and 9 headers).

- [ ] **Step 1:** `plugins/machinery/README.md`: rewrite to the shipped state — install per project (`claude plugin install machinery@ai-skills --scope project|local`, `/machinery:install`, `/machinery:setup`); hooks: SessionStart (banner, core), SubagentStart (core), UserPromptSubmit (capture), PreToolUse (quiet, no-verify), WorktreeCreate; installed git hooks: pre-commit (inbox/spec checks, sweep-guard advisory, fast tier), pre-push to main (merge tier); where rules live (`core.md`, `claude-code/machinery/<kind>/SKILL.md`, `.claude/rules/`, inboxes, `docs/dictated-specs/`); teaching it a tool (keep that section). No sentence restates a refusal the hooks print (decision 3). Delete the Dependency section.
- [ ] **Step 2:** Both descriptions: `Claude process machinery: an always-on core loaded into every session and subagent, skills by kind, PRULE:/URULE:/SPEC: capture with an inbox gate, a quiet-output filter, a worktree-create hook, and per-project git hooks negotiated by /machinery:setup.`
- [ ] **Step 3:** STATUS.md § State: add one bullet — rewrite implemented on `machinery-rewrite` per this plan; the `~/.claude/rules` junction restore commands no longer apply (the core loads through the plugin hooks); `~/.claude/machinery.json` uses `pluginSource`.
- [ ] **Step 4:** Old core design spec, after its title: `> Superseded in part by the 2026-09 recalibration (docs/learnings/recalibration-2026-09/STATUS.md decisions 1–3, 10, 13, 21, 37): the rules index, citation gate, junction install and rule files it describes no longer exist.` #99 plan Tasks 7 and 9: a blockquote `Superseded 2026-09-14: replaced by docs/superpowers/plans/2026-09-14-machinery-rewrite.md Tasks B6 and B7.`
- [ ] **Commit.** Bump. `git commit -m "docs: machinery README, descriptions and pickup context for the recalibrated plugin" -m "<trailer>" -- plugins/machinery/README.md plugins/machinery/.claude-plugin/plugin.json .claude-plugin/marketplace.json docs/learnings/recalibration-2026-09/STATUS.md docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md docs/superpowers/plans/2026-09-12-issue-tracking-config.md`
- [ ] **Report:** the hook lines and sha; then `git worktree list` output line count.
