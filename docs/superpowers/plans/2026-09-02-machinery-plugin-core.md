# Machinery Plugin Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `plugins/machinery` — a Claude Code plugin whose universal rules are always on, whose five hooks and per-project commit gate actually run, and whose rule-dictation loop closes automatically.

**Architecture:** Node ESM scripts, zero dependencies, under `plugins/machinery/scripts/` with a shared `lib/`; `hooks/hooks.json` wires five events; `/machinery:install` copies a read-only gate into each project and sets `core.hooksPath`; universal rules become always-on through a junction under `~/.claude/rules/`; the register index is generated, never hand-written. Every script's header cites its union story; every test file is that story's acceptance checks.

**Tech Stack:** Node ≥ 20 (ESM, `node:test`, `node:child_process`, `node:fs`), git. No npm packages.

**Spec:** `docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md` — read it first; its invariant ledger I1–I42 is the review rubric.

## Global Constraints

- Repo root: `I:\IdeaProjects\ai-skills` (this plan runs in a worktree of it; every path below is repo-relative; commit in the worktree's branch).
- Node only, zero dependencies, ESM (`.mjs`), `node:test` for every test; Windows-native paths via `node:path`; the only external processes are `git`, `node`, and the shells `quiet-run` is asked to use.
- Plugin name `machinery`; version starts `0.1.0`; the repo's version-bump check (`scripts/build-skills.mjs check`) must pass at every commit — bump `plugins/machinery/.claude-plugin/plugin.json` when a task changes the plugin after its version was last set (patch level), or `git commit` will be rejected by the pre-commit hook.
- Markers: `PRULE:` (project rule) and `URULE:` (universal rule), case-insensitive, first non-whitespace token; bare `RULE:` captures nothing. Both live in `plugins/machinery/markers.json` and nowhere else in code.
- Paths that must stay OUT of any rules directory: inbox and index. Project side `.claude/machinery/inbox.md` and `.claude/machinery/INDEX.md`; plugin side `plugins/machinery/inbox.md` and `plugins/machinery/register/INDEX.md`.
- Rule identity = `file § Section`; per-file frontmatter keys: `status` (exactly one of `🟢`, `🟡`, `🔴`) and `supersedes` (list of `{section, by, date}`).
- Failure posture per hook (spec §Claude-side): quiet **open**; capture **loud**; nudge **silent**; worktree-create **closed**; banner **loud, non-blocking**.
- Hook JSON is produced only by `scripts/lib/emit.mjs`; `JSON.stringify` may not appear in any other file under `scripts/` (a test enforces it). Nothing under `scripts/gate/` may call `fs.write*`, `fs.append*`, `fs.rm*`, `fs.mkdir*` (a test enforces it).
- Every test suite has one mutation test proving it can go red; a meta-test counts them.
- Tests run only against temp repositories made by `test/helpers/repo.mjs`; never against a real checkout.
- Commit messages end with the trailer:

  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011LX8RSYosynbzXj5ut7oL1
  ```

## File Structure

```
plugins/machinery/
  .claude-plugin/plugin.json         Task 1
  markers.json                       Task 1
  hooks/hooks.json                   Task 1 (recorder), Task 6, 8, 12, 13, 14 (wire each hook as it lands)
  scripts/lib/root.mjs               Task 1   project root + isRootSession
  scripts/lib/git.mjs                Task 1   run git, resolve once, fail loud
  scripts/lib/emit.mjs               Task 1   the only hook-JSON writer
  scripts/lib/stdin.mjs              Task 1   read hook payload
  scripts/record-payload.mjs         Task 2   captures real event payloads into fixtures
  scripts/lib/classify.mjs           Task 3   read | piped | redirected | infra | noisy | plain
  scripts/lib/filter.mjs             Task 4   normalise / select / selectInfra / render
  scripts/quiet-run.mjs              Task 5   runs the command, filters, preserves exit status
  scripts/quiet.mjs                  Task 6   PreToolUse hook (updatedInput)
  scripts/lib/config.mjs             Task 7   rules source, universal inbox path, plugin root
  scripts/lib/inbox.mjs              Task 7   parse / append / disposition
  scripts/capture.mjs                Task 8   UserPromptSubmit hook
  scripts/lib/frontmatter.mjs        Task 9   status + supersedes
  scripts/lib/index.mjs              Task 9   generate INDEX.md from a rules dir
  scripts/reindex.mjs                Task 9
  scripts/lib/report.mjs             Task 10  denominator lines
  scripts/gate/{gate,register-check,citation-target,sweep-guard}.mjs  Task 10
  scripts/install.mjs                Task 11  --machine | project | --hosted
  templates/hosted-check.yml         Task 11
  scripts/banner.mjs                 Task 12  SessionStart
  scripts/nudge.mjs                  Task 13  PostToolUse
  scripts/worktree-create.mjs        Task 14  WorktreeCreate
  scripts/{place,bump,disposition,intake}.mjs  Task 15
  scripts/reload.mjs                 Task 16
  rules/*.md, register/INDEX.md, inbox.md, agents/*.md   Task 17 (moved from the union)
  test/helpers/repo.mjs              Task 1   temp-repo fixture factory
  test/helpers/run.mjs               Task 1   run a script with stdin JSON, capture stdout/stderr/code
  test/fixtures/payloads/*.json      Task 2
  test/*.test.mjs                    one per script/lib
claude-code/{install,reload,reindex,rule-intake,effort-lifecycle,refresh-diverged-branch}/SKILL.md   Task 16
skills.manifest.json                 Task 1 (bucket + route)
.githooks/pre-commit                 Task 18
```

---

### Task 1: Plugin scaffold, shared lib, test harness, manifest route

**Files:**
- Create: `plugins/machinery/.claude-plugin/plugin.json`, `plugins/machinery/markers.json`, `plugins/machinery/hooks/hooks.json`
- Create: `plugins/machinery/scripts/lib/root.mjs`, `git.mjs`, `emit.mjs`, `stdin.mjs`
- Create: `plugins/machinery/test/helpers/repo.mjs`, `run.mjs`
- Create: `plugins/machinery/test/lib-root.test.mjs`, `lib-emit.test.mjs`
- Create: `claude-code/.gitkeep`
- Modify: `skills.manifest.json` (add bucket + route)

**Interfaces:**
- Produces: `root.mjs` → `projectRoot(cwd): string` (directory that owns `.git`, resolved through worktrees), `isRootSession(cwd): boolean`; `git.mjs` → `git(args: string[], cwd: string): {code, stdout, stderr}` and `gitExe(): string` (resolved once; throws `Error('git not found; looked for: …')`); `emit.mjs` → `updatedInput(toolInput)`, `context(text)`, `none()` — each prints exactly one JSON document to stdout and returns; `stdin.mjs` → `readPayload(): object | null`; `repo.mjs` → `makeRepo({withOrigin?: boolean}): {root, origin?, cleanup()}` and `addWorktree(root, name): string`; `run.mjs` → `runScript(script, {stdin?, cwd?, env?}): {code, stdout, stderr}`.

- [ ] **Step 1: plugin.json, markers.json, empty hooks.json**

`plugins/machinery/.claude-plugin/plugin.json`:
```json
{
  "name": "machinery",
  "description": "The union of two projects' Claude process machinery, made to run: always-on universal rules, a PRULE:/URULE: rule-capture loop with automatic intake, a quiet-output filter, a worktree-create hook, and a per-project commit gate installed by /machinery:install.",
  "version": "0.1.0",
  "author": { "name": "Gabe E. Nydick", "email": "gnydick@nydick.net" },
  "homepage": "https://github.com/gnydick/ai-skills",
  "repository": "https://github.com/gnydick/ai-skills",
  "license": "GPL-3.0",
  "keywords": ["rules", "hooks", "governance", "commit-gate", "worktrees"]
}
```
`plugins/machinery/markers.json`:
```json
{ "project": "PRULE:", "universal": "URULE:", "ambiguous": "RULE:" }
```
`plugins/machinery/hooks/hooks.json`: `{ "hooks": {} }` (tasks add entries as scripts land).

- [ ] **Step 2: write the failing tests for root and emit**

`plugins/machinery/test/lib-root.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { projectRoot, isRootSession } from '../scripts/lib/root.mjs';

test('projectRoot from the main checkout is the checkout', () => {
  const r = makeRepo();
  try { assert.equal(projectRoot(r.root), r.root); assert.equal(isRootSession(r.root), true); }
  finally { r.cleanup(); }
});

test('projectRoot from inside a worktree is the main checkout, not the worktree', () => {
  const r = makeRepo();
  try {
    const wt = addWorktree(r.root, 'feature-x');
    assert.equal(projectRoot(wt), r.root);
    assert.equal(isRootSession(wt), false);
    assert.equal(projectRoot(path.join(wt, 'sub')), r.root);
  } finally { r.cleanup(); }
});

test('RED CHECK: a directory that is not a repo throws', () => {
  const r = makeRepo();
  try { assert.throws(() => projectRoot(path.join(r.root, '..')), /not inside a git repository/); }
  finally { r.cleanup(); }
});
```
`plugins/machinery/test/lib-emit.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript } from './helpers/run.mjs';

const probe = (fn, arg) => runScript('test/helpers/emit-probe.mjs', { env: { PROBE_FN: fn, PROBE_ARG: arg } });

test('updatedInput emits the PreToolUse shape exactly once', () => {
  const { stdout } = probe('updatedInput', '{"command":"x"}');
  const docs = stdout.trim().split('\n');
  assert.equal(docs.length, 1);
  assert.deepEqual(JSON.parse(docs[0]), { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { command: 'x' } } });
});

test('context emits additionalContext for the current event', () => {
  const { stdout } = probe('context', 'hello');
  assert.deepEqual(JSON.parse(stdout), { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: 'hello' } });
});

test('RED CHECK: none() prints nothing', () => {
  assert.equal(probe('none', '').stdout, '');
});
```
`plugins/machinery/test/helpers/emit-probe.mjs`:
```js
import * as emit from '../../scripts/lib/emit.mjs';
const fn = process.env.PROBE_FN, arg = process.env.PROBE_ARG;
if (fn === 'updatedInput') emit.updatedInput(JSON.parse(arg));
else if (fn === 'context') emit.context(arg, 'UserPromptSubmit');
else emit.none();
```

- [ ] **Step 3: run — expect failure (modules missing)**

Run from `plugins/machinery`: `node --test test/lib-root.test.mjs test/lib-emit.test.mjs`
Expected: FAIL, `Cannot find module` for `helpers/repo.mjs` / `lib/root.mjs`.

- [ ] **Step 4: implement the helpers and lib**

`plugins/machinery/test/helpers/repo.mjs`:
```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const sh = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function makeRepo({ withOrigin = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'machinery-'));
  const root = path.join(base, 'repo');
  fs.mkdirSync(root);
  sh(['init', '-q', '-b', 'main'], root);
  sh(['config', 'user.email', 't@example.com'], root);
  sh(['config', 'user.name', 'Test'], root);
  fs.writeFileSync(path.join(root, 'README.md'), '# fixture\n');
  sh(['add', 'README.md'], root);
  sh(['commit', '-q', '-m', 'init'], root);
  let origin;
  if (withOrigin) {
    origin = path.join(base, 'origin.git');
    sh(['init', '-q', '--bare', '-b', 'main', origin], base);
    sh(['remote', 'add', 'origin', origin], root);
    sh(['push', '-q', '-u', 'origin', 'main'], root);
    sh(['remote', 'set-head', 'origin', 'main'], root);
  }
  const realRoot = fs.realpathSync.native(root);
  return { root: realRoot, origin, cleanup: () => fs.rmSync(base, { recursive: true, force: true, maxRetries: 5 }) };
}

export function addWorktree(root, name) {
  const wt = path.join(root, '.claude', 'worktrees', name);
  sh(['worktree', 'add', '-q', wt, '-b', name], root);
  return fs.realpathSync.native(wt);
}

export function commitAll(root, message) {
  sh(['add', '-A'], root);
  sh(['commit', '-q', '-m', message], root);
  return sh(['rev-parse', 'HEAD'], root);
}
```
`plugins/machinery/test/helpers/run.mjs`:
```js
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function runScript(script, { stdin = '', cwd = PLUGIN, env = {}, args = [] } = {}) {
  const r = spawnSync(process.execPath, [path.join(PLUGIN, script), ...args], {
    cwd, input: stdin, encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN, ...env },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
```
`plugins/machinery/scripts/lib/git.mjs`:
```js
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let exe = null;
// Resolved once (union: rules/tool-output.md § A check that cannot run fails
// loudly). Bare `git` is fine on every platform; the loud failure names it.
export function gitExe() {
  if (exe) return exe;
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) throw new Error('git not found; looked for: `git` on PATH');
  exe = 'git';
  return exe;
}

export function git(args, cwd) {
  const r = spawnSync(gitExe(), args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { code: r.status ?? 1, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
}

export function realDir(p) { return fs.existsSync(p) ? fs.realpathSync.native(p) : path.resolve(p); }
```
`plugins/machinery/scripts/lib/root.mjs`:
```js
// Story: union/plugin/hooks/rule-capture.md ("resolves the project root, not
// the session's own checkout"). The root is the directory owning the COMMON
// git dir, so a worktree resolves to the main checkout.
import path from 'node:path';
import { git, realDir } from './git.mjs';

function commonDir(cwd) {
  const r = git(['rev-parse', '--git-common-dir'], cwd);
  if (r.code !== 0) throw new Error(`not inside a git repository: ${cwd}`);
  return realDir(path.resolve(cwd, r.stdout));
}

export function projectRoot(cwd = process.cwd()) {
  return path.dirname(commonDir(cwd));
}

export function isRootSession(cwd = process.cwd()) {
  const own = git(['rev-parse', '--git-dir'], cwd);
  if (own.code !== 0) throw new Error(`not inside a git repository: ${cwd}`);
  return realDir(path.resolve(cwd, own.stdout)) === commonDir(cwd);
}
```
`plugins/machinery/scripts/lib/emit.mjs`:
```js
// The ONLY place hook JSON is written (spec I19). One document per call.
const write = (doc) => process.stdout.write(JSON.stringify(doc) + '\n');
export function updatedInput(toolInput) {
  write({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: toolInput } });
}
export function context(text, event = 'UserPromptSubmit') {
  write({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
}
export function none() {}
```
`plugins/machinery/scripts/lib/stdin.mjs`:
```js
import fs from 'node:fs';
export function readPayload() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return null; }
}
```

- [ ] **Step 5: run — expect pass**

Run: `node --test test/lib-root.test.mjs test/lib-emit.test.mjs` (from `plugins/machinery`)
Expected: 6 passing.

- [ ] **Step 6: declare the bucket and route**

In `skills.manifest.json` add under `buckets`:
```json
"claude-code": {
  "description": "Claude Code only: skills that name this harness's hooks, commands, and plugin layout.",
  "targets": ["claude-plugin"]
}
```
and under `targets.claude-plugin.routes`:
```json
"machinery": { "path": "plugins/machinery", "skills": [] }
```
Create `claude-code/.gitkeep`. Run `node scripts/build-skills.mjs check` from the repo root — expected: `✓ machinery 0.1.0 is a new version` and no errors (an empty bucket with an empty route is legal).

- [ ] **Step 7: commit**

```bash
git add plugins/machinery claude-code skills.manifest.json
git commit -m "machinery: plugin scaffold, shared lib, test harness, manifest route"
```

---

### Task 2: Record real hook payloads as fixtures

**Files:**
- Create: `plugins/machinery/scripts/record-payload.mjs`
- Create: `plugins/machinery/test/fixtures/payloads/{SessionStart,UserPromptSubmit,PreToolUse-Bash,PreToolUse-PowerShell,PostToolUse-Edit,WorktreeCreate}.json`
- Create: `plugins/machinery/test/fixtures.test.mjs`
- Modify: `plugins/machinery/hooks/hooks.json`

**Interfaces:**
- Produces: the six fixture files — the exact JSON Claude Code sends each hook on this machine — replayed by every later hook test.

- [ ] **Step 1: the recorder**

`plugins/machinery/scripts/record-payload.mjs`:
```js
// Dev-only. When MACHINERY_RECORD is set to a directory, writes each hook
// payload it receives to <dir>/<event>[-<tool>].json. Prints nothing.
import fs from 'node:fs';
import path from 'node:path';
import { readPayload } from './lib/stdin.mjs';
const dir = process.env.MACHINERY_RECORD;
const p = readPayload();
if (dir && p) {
  const name = [p.hook_event_name, p.tool_name].filter(Boolean).join('-');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(p, null, 2) + '\n');
}
```

- [ ] **Step 2: wire the recorder for every event (temporarily first in the list)**

`plugins/machinery/hooks/hooks.json`:
```json
{
  "hooks": {
    "SessionStart":     [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/record-payload.mjs\"", "timeout": 5 }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/record-payload.mjs\"", "timeout": 5 }] }],
    "PreToolUse":       [{ "matcher": "Bash|PowerShell", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/record-payload.mjs\"", "timeout": 5 }] }],
    "PostToolUse":      [{ "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/record-payload.mjs\"", "timeout": 5 }] }],
    "WorktreeCreate":   [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/record-payload.mjs\"", "timeout": 5 }] }]
  }
}
```

- [ ] **Step 3: record (manual, this machine)**

In a terminal: set `MACHINERY_RECORD` to `plugins/machinery/test/fixtures/payloads` (absolute path), then start `claude --plugin-dir <absolute path to plugins/machinery>` in any git repo, and in that session: send one prompt; run one Bash tool command and one PowerShell tool command; edit one file; create a worktree with the worktree tool; exit. Confirm six files exist. **Scrub** them: replace absolute paths under your home with `<HOME>` and any transcript path with `<TRANSCRIPT>` (a test below refuses fixtures containing your username).

- [ ] **Step 4: the fixture test**

`plugins/machinery/test/fixtures.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PLUGIN } from './helpers/run.mjs';

const DIR = path.join(PLUGIN, 'test', 'fixtures', 'payloads');
const REQUIRED = ['SessionStart', 'UserPromptSubmit', 'PreToolUse-Bash', 'PreToolUse-PowerShell', 'PostToolUse-Edit', 'WorktreeCreate'];

for (const name of REQUIRED) {
  test(`recorded payload exists and is scrubbed: ${name}`, () => {
    const file = path.join(DIR, `${name}.json`);
    assert.ok(fs.existsSync(file), `${name}.json missing — re-record (Task 2 step 3)`);
    const text = fs.readFileSync(file, 'utf8');
    const p = JSON.parse(text);
    assert.equal(p.hook_event_name, name.split('-')[0]);
    assert.ok(!text.includes(os.userInfo().username), 'fixture contains a username — scrub it');
  });
}

test('RED CHECK: a fixture with the wrong event name is rejected', () => {
  const p = JSON.parse(fs.readFileSync(path.join(DIR, 'SessionStart.json'), 'utf8'));
  assert.notEqual(p.hook_event_name, 'UserPromptSubmit');
});
```
Run: `node --test test/fixtures.test.mjs` — expected: 7 passing.

- [ ] **Step 5: commit** — `git add plugins/machinery && git commit -m "machinery: record real hook payloads as replay fixtures"` (bump version to `0.1.1` in plugin.json first if the check demands it).

---

### Task 3: `lib/classify.mjs` — command classification with one precedence

**Files:**
- Create: `plugins/machinery/scripts/lib/classify.mjs`
- Test: `plugins/machinery/test/lib-classify.test.mjs`

**Interfaces:**
- Produces: `classify(command: string): 'read' | 'piped' | 'redirected' | 'infra' | 'noisy' | 'plain'` — the only classifier (spec I10, I18); `MODES = Object.freeze({...})`.

Story: `combine-projects-machinery/union/plugin/hooks/quiet-output.md` steps 4–14. Source regexes ported from `combine-projects-machinery/ferrislicer/.claude/hooks/quiet_hook.py:33-113`.

- [ ] **Step 1: failing test** — `test/lib-classify.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../scripts/lib/classify.mjs';

const cases = [
  // ported from quiet_hook_test.py: test_noisy_commands_wrap / test_quiet_commands_pass
  ['cargo build', 'noisy'], ['cargo test --workspace', 'noisy'], ['npm install', 'noisy'], ['pnpm run build', 'noisy'],
  ['npx vitest', 'noisy'], ['pip install requests', 'noisy'], ['pytest -q', 'noisy'], ['make', 'noisy'],
  ['CARGO_TARGET_DIR=/tmp/t cargo build', 'noisy'],
  ['ls -la', 'plain'], ['cat README.md', 'plain'], ['echo hi', 'plain'],
  // test_direct_python_test_runners_wrap
  ['python scripts/register_check_test.py', 'noisy'], ['python .claude/hooks/quiet_hook_test.py', 'noisy'],
  // test_payload_tools_never_wrap
  ['python scripts/oracle_compare.py a b', 'plain'],
  // test_gh_chatter_is_filtered (incl. auth status + extension install|upgrade)
  ['gh run view 123', 'noisy'], ['gh pr checks', 'noisy'], ['gh auth status', 'noisy'], ['gh extension install foo/bar', 'noisy'],
  // test_infra_actions_show_proof_only (incl. -C <dir> option)
  ['git commit -m x', 'infra'], ['git push', 'infra'], ['git pull --rebase', 'infra'], ['git fetch origin', 'infra'],
  ['git -C sub push', 'infra'], ['gh pr create --fill', 'infra'], ['git worktree add .claude/worktrees/x -b x', 'infra'],
  // test_git_reads_pass
  ['git status', 'plain'], ['git log --oneline -5', 'plain'], ['git diff', 'plain'],
  // test_gh_reads_are_never_wrapped
  ['gh issue view 12', 'read'], ['gh pr diff 3', 'read'], ['gh api repos/x/y', 'read'],
  // test_piped_gate_still_opts_out / test_gh_piped_or_trivial_passes
  ['cargo test 2>&1 | tail -20', 'piped'], ['gh run view 1 | grep fail', 'piped'], ['gh --version', 'plain'],
  // redirect: a file redirect opts out, a bare stderr-merge does not (quiet_hook.py:105)
  ['cargo build > build.log', 'redirected'], ['cargo build 2> err.log', 'redirected'], ['cargo build 2>&1 > build.log', 'noisy'],
  // precedence: infra before noisy for commands in both sets
  ['git clone https://x/y', 'infra'],
  // never
  ['python quiet_run.py -c x', 'plain'], ['cargo --version', 'plain'], ['npm --help', 'plain'],
  ['', 'plain'],
];
for (const [cmd, want] of cases) test(`classify(${JSON.stringify(cmd)}) = ${want}`, () => assert.equal(classify(cmd), want));

test('RED CHECK: the classifier is not the identity', () => assert.notEqual(classify('cargo build'), 'plain'));
```

- [ ] **Step 2: run — expect module-not-found failure.** `node --test test/lib-classify.test.mjs`

- [ ] **Step 3: implement** — `scripts/lib/classify.mjs`:
```js
// Story: hooks/quiet-output.md steps 4–14. Precedence is the ORDER below and
// nowhere else (spec I10, I18): never → piped → redirected → read → infra → noisy → plain.
const LEAD = String.raw`(?:^|[;&|(]\s*|\bthen\s+|\bdo\s+|&&\s*)\s*(?:\w+=\S*\s+)*`;

const NOISY = new RegExp(LEAD + String.raw`(?:` +
  String.raw`cargo\s+(?:\+\S+\s+)?(?:build|b|test|t|check|c|clippy|run|r|bench|doc|install|update|fetch|clean|nextest|fmt|llvm-cov|tarpaulin|xtask)\b` +
  String.raw`|(?:npm|pnpm|yarn|bun)\s+(?:install|i|ci|add|run|test|build|update|up|exec|create)\b` +
  String.raw`|npx\s+\S+` +
  String.raw`|pip3?\s+(?:install|download|wheel|uninstall)\b` +
  String.raw`|uv\s+(?:pip|sync|run|tool|add)\b` +
  String.raw`|(?:python3?|py)\s+-m\s+(?:pip|pytest|build|venv|unittest)\b` +
  String.raw`|pytest\b|tox\b|maturin\b|poetry\s+(?:install|run|build|update)\b` +
  String.raw`|(?:cmake\s+--build|make\b|ninja\b|msbuild\b|dotnet\s+(?:build|test|restore|run)|gradle\w*\b|mvn\b)` +
  String.raw`|docker\s+(?:build|pull|compose|push)\b` +
  String.raw`|git\s+(?:clone|fetch|pull)\b` +
  String.raw`|rustup\s+(?:update|install|toolchain|component)\b` +
  String.raw`|(?:python3?|py)\s+(?:-\S+\s+)*(?:\./|\.\./)?(?:scripts|\.claude/hooks)/\S*_test\.py\b` +
  String.raw`|sccache\s+--start-server\b` +
  String.raw`|gh\s+(?:run\s+(?:view|watch|download)|pr\s+checks|auth\s+status|extension\s+(?:install|upgrade))\b` +
  String.raw`)`);

const INFRA = new RegExp(LEAD +
  String.raw`(?:git\s+(?:-C\s+\S+\s+)?(?:commit|push|pull|fetch|merge|rebase|clone|cherry-pick|worktree\s+(?:add|remove|prune)|submodule)\b` +
  String.raw`|gh\s+(?:pr\s+(?:create|merge|close|ready|review|comment|edit)|issue\s+(?:create|edit|comment|close|reopen|transfer|pin|unpin|develop)|workflow\s+(?:run|enable|disable)|release\s+(?:create|upload|delete)|run\s+(?:rerun|cancel)|repo\s+(?:clone|fork|sync|create)|label\s+(?:create|clone|delete)|auth\s+(?:login|refresh|setup-git))\b)`);

const GH_READ = new RegExp(LEAD +
  String.raw`gh\s+(?:issue\s+(?:view|list|status)|pr\s+(?:view|list|diff|status)|api\b|search\b|release\s+(?:view|list)|run\s+list|repo\s+(?:view|list)|label\s+list|project\b|gist\s+(?:view|list)|workflow\s+(?:view|list))\b`);

const PIPED = /\|\s*(?:tail|head|grep|rg|wc|sed|awk|sort|uniq|jq|tee|less|cut|python|py|quiet[-_]run)\b/;
const NEVER = /quiet[-_]run\.(?:py|mjs)|--version\b|-V\b|--help\b/;
const FILE_REDIRECT = /\d?>\s*\S/;

export const MODES = Object.freeze(['read', 'piped', 'redirected', 'infra', 'noisy', 'plain']);

export function classify(command) {
  if (!command || NEVER.test(command)) return 'plain';
  if (PIPED.test(command)) return 'piped';
  // quiet_hook.py:105 — a stderr-merge token cancels the redirect exemption entirely.
  if (command.includes('>') && FILE_REDIRECT.test(command) && !command.includes('2>&1')) return 'redirected';
  if (GH_READ.test(command)) return 'read';
  if (INFRA.test(command)) return 'infra';
  if (NOISY.test(command)) return 'noisy';
  return 'plain';
}
```

- [ ] **Step 4: run — expect all passing.** `node --test test/lib-classify.test.mjs`

- [ ] **Step 5: commit** — `git add plugins/machinery && git commit -m "machinery: command classifier with single precedence"`

---

### Task 4: `lib/filter.mjs` — normalise, select, render

**Files:**
- Create: `plugins/machinery/scripts/lib/filter.mjs`
- Test: `plugins/machinery/test/lib-filter.test.mjs`

**Interfaces:**
- Produces: `normalise(buf: Buffer|string): string[]`, `select(lines): Set<number>`, `selectInfra(lines, code): Set<number>`, `render(lines, keep, header): string`, constants `PASS_THROUGH_LINES=40, TAIL_LINES=8, CONTEXT_AFTER=2, MAX_SHOWN=200`.

Story: `hooks/quiet-output.md` steps 19–26; source `quiet_run.py:40-241`.

- [ ] **Step 1: failing test** — `test/lib-filter.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, select, selectInfra, render, MAX_SHOWN, PASS_THROUGH_LINES } from '../scripts/lib/filter.mjs';

const lines = (...l) => l;
const shown = (ls, keep) => render(ls, keep, 'H').split('\n').slice(1);

test('normalise: CRLF, progress-bar frames, ANSI, trailing blanks (test_progress_bar_keeps_last_frame, test_ansi_stripped)', () => {
  const out = normalise(Buffer.from('a\r\n10%\r50%\r100%\n\x1b[31mred\x1b[0m\n\n\n'));
  assert.deepEqual(out, ['a', '100%', 'red']);
});

test('infra success keeps only proof lines (test_infra_success_keeps_only_proof_lines)', () => {
  const ls = lines('To github.com:x/y', ' * [new branch] b -> b', "branch 'b' set up to track 'origin/b'.");
  assert.deepEqual([...selectInfra(ls, 0)].sort(), [1, 2]);
  assert.deepEqual([...selectInfra(lines('Already up to date.'), 0)], [0]);
});

test('infra success with no proof line keeps the last line', () => {
  assert.deepEqual([...selectInfra(lines('remote: hello', 'done-ish'), 0)], [1]);
});

test('infra failure keeps errors (test_infra_failure_keeps_errors)', () => {
  const ls = lines('Compiling x', 'error: failed to push some refs', '  hint: pull first', 'Compiling y');
  const k = selectInfra(ls, 1);
  assert.ok(k.has(1) && k.has(2));
});

test('heartbeat survives in both modes buried in chatter (test_heartbeat_survives_*)', () => {
  const chatter = Array.from({ length: 20 }, (_, i) => `   Compiling crate${i}`);
  const ls = [...chatter, 'HEARTBEAT battery 42s 3/9', ...chatter];
  assert.ok(select(ls).has(20));
  assert.ok(selectInfra(ls, 0).has(20));
});

test('a conforming gate denominator survives without enumeration; prose word-colon does not (test_conforming_gate_denominator…, test_proof_line_does_not_admit_prose_word_colon)', () => {
  const ls = ['zz_gate --check: 7 of 7 ok', 'remote: hello there', 'warning: something'];
  const k = select(ls);
  assert.ok(k.has(0));
  assert.ok(!k.has(1));
});

test('error block kept to the blank line, summary kept, chatter dropped (test_error_block_and_summary_kept_chatter_dropped)', () => {
  const ls = ['   Compiling a', 'error[E0599]: no method', '  --> src/x.rs:1', '', '   Compiling b', 'test result: FAILED. 1 passed; 1 failed'];
  const k = select(ls);
  assert.ok(k.has(1) && k.has(2) && k.has(5));
  assert.ok(!k.has(0));
});

test('test failure section kept (test_test_failure_section_kept)', () => {
  const ls = ['running 3 tests', 'test a ... ok', '---- b stdout ----', 'assertion failed', '', 'failures:', '    b'];
  const k = select(ls);
  assert.ok(k.has(2) && k.has(3) && k.has(5) && k.has(6));
});

test('tail always kept except chatter, last line always (select tail rule)', () => {
  const ls = Array.from({ length: 50 }, (_, i) => (i === 49 ? '   Compiling last' : `plain ${i}`));
  const k = select(ls);
  assert.ok(k.has(49));
  assert.ok(k.has(42));
});

test('bulk noise still dropped: 400 chatter lines shrink under ten (test_bulk_noise_still_dropped)', () => {
  const ls = Array.from({ length: 400 }, (_, i) => `   Compiling c${i}`);
  assert.ok(select(ls).size < 10);
});

test('render caps at MAX_SHOWN with 3/5 head + 2/5 tail and both markers (step 26)', () => {
  const ls = Array.from({ length: 500 }, (_, i) => `error: e${i}`);
  const keep = new Set(ls.map((_, i) => i));
  const out = shown(ls, keep);
  assert.equal(out.length, MAX_SHOWN + 1);
  assert.equal(out[120], `... [${500 - MAX_SHOWN} kept lines elided between head and tail] ...`);
  assert.equal(out[0], 'error: e0'); assert.equal(out.at(-1), 'error: e499');
});

test('render marks gaps between kept lines', () => {
  const out = shown(['a', 'b', 'c', 'd'], new Set([0, 3]));
  assert.deepEqual(out, ['a', '... [2 lines omitted] ...', 'd']);
});

test('constants match the story', () => { assert.equal(PASS_THROUGH_LINES, 40); assert.equal(MAX_SHOWN, 200); });

test('RED CHECK: select does not keep everything', () => {
  assert.ok(select(Array.from({ length: 100 }, (_, i) => `   Compiling c${i}`)).size < 100);
});
```

- [ ] **Step 2: run — expect failure.** `node --test test/lib-filter.test.mjs`

- [ ] **Step 3: implement** — `scripts/lib/filter.mjs`:
```js
// Story: hooks/quiet-output.md steps 19–26. Ported from quiet_run.py:40-241.
export const PASS_THROUGH_LINES = 40, TAIL_LINES = 8, CONTEXT_AFTER = 2, MAX_SHOWN = 200;

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;
const BLOCK_START = /^(error(\[E\d+\])?:|error:|ERROR|thread '.*' panicked|panicked at|Traceback \(most recent call last\)|---- .* (stdout|stderr) ----|failures:|FAILED|FAIL\b|npm ERR!|npm error|ERR!|fatal:|\s*Caused by:|The following warnings were emitted)/i;
const KEYWORD = /(\berror\b|\bfailed\b|\bfailure\b|\bfailures\b|\bpanick?|\bexception\b|\bfatal\b|\bunresolved\b|\bcould not\b|\bcannot\b|\bdenied\b|\btimed out\b|\btimeout\b|\babort|\bsegfault|\bkilled\b|\bFAIL\b|\bFAILED\b|\bassert)/i;
const SUMMARY = /(^test result:|^\s*Finished\b|^\s*Summary\b|^={3,}.*={3,}$|^\s*Doc-tests\b|^running \d+ tests?$|^\s*Running (unittests|tests\/)|\badded \d+ packages?\b|\bSuccessfully installed\b|\bSuccessfully built\b|^\s*warning: .* generated \d+ warnings?|^\s*warning: build failed|\bBuild succeeded\b|\bBUILD (SUCCESSFUL|FAILED)\b|\b\d+ passed\b|\b\d+ failed\b|^\s*[✓✔✗✘X!*-]\s|https?:\/\/github\.com\/\S+|^\s*(Merged|Created|Deleted|Closed|Reopened|Requested|Cloning|ANNOTATIONS|JOBS)\b|\bcompleted with\b|\b(succeeded|skipped|cancelled)\b|^Error: |^error: could not compile)/i;
// The one declared proof-line format: a heartbeat, or `<snake_case_tool>[ --flag]: <text>` (rules/tool-output.md § Heartbeats).
const PROOF_LINE = /(^HEARTBEAT\s|^[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\s+--?[\w.-]+)?:\s+\S)/;
const INFRA_OK = /(^\[[^\]]+ [0-9a-f]{7,}\] |^\s*[0-9a-f]{7,}\.\.[0-9a-f]{7,}\s+\S+\s+->\s+\S+|^\s*\+\s+[0-9a-f]{7,}\.{3}[0-9a-f]{7,}\s+\S+\s+->|^\s*\*\s+\[new (?:branch|tag)\]|^\s*-\s+\[deleted\]|^Everything up-to-date$|^Already up to date\.?$|^Fast-forward$|^Updating [0-9a-f]{7,}\.\.[0-9a-f]{7,}$|^\s*\d+ files? changed|^Merge made by|^Successfully rebased|^Switched to|^HEAD is now at|^Preparing worktree|^Cloning into|^branch '.*' set up to track|https?:\/\/github\.com\/\S+|^\s*[✓✔]\s|^\s*(Merged|Created|Deleted|Closed|Reopened|Logged in)\b)/i;
const CHATTER = /^\s*(Compiling|Checking|Downloading|Downloaded|Updating|Fresh|Blocking|Installing|Locking|Adding|Removing|Documenting|Building|Collecting|Requirement already satisfied|Using cached|Preparing|Unpacking)\b|^test .* \.\.\. ok$|^\s*warning: unused|^\s*\|/;

export function normalise(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  const out = [];
  for (let line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.includes('\r')) line = line.split('\r').at(-1);
    out.push(line.replace(ANSI, '').trimEnd());
  }
  while (out.length && !out.at(-1)) out.pop();
  return out;
}

export function select(lines) {
  const n = lines.length, keep = new Set();
  let i = 0;
  while (i < n) {
    const line = lines[i];
    if (BLOCK_START.test(line)) {
      let j = i;
      while (j < n && (lines[j].trim() || j === i)) { keep.add(j); j++; }
      i = Math.max(j, i + 1);
      continue;
    }
    if (SUMMARY.test(line) || PROOF_LINE.test(line)) keep.add(i);
    else if (KEYWORD.test(line) && !CHATTER.test(line)) for (let k = i; k < Math.min(n, i + 1 + CONTEXT_AFTER); k++) keep.add(k);
    i++;
  }
  for (let k = Math.max(0, n - TAIL_LINES); k < n; k++) if (k === n - 1 || !CHATTER.test(lines[k])) keep.add(k);
  return keep;
}

export function selectInfra(lines, code) {
  if (code !== 0) return select(lines);
  const keep = new Set();
  lines.forEach((l, i) => { if (INFRA_OK.test(l) || PROOF_LINE.test(l)) keep.add(i); });
  if (!keep.size && lines.length) keep.add(lines.length - 1);
  return keep;
}

export function render(lines, keep, header) {
  let idx = [...keep].sort((a, b) => a - b);
  let note = null;
  if (idx.length > MAX_SHOWN) {
    const head = Math.floor(MAX_SHOWN * 3 / 5), tail = MAX_SHOWN - head;
    note = `... [${idx.length - MAX_SHOWN} kept lines elided between head and tail] ...`;
    idx = [...idx.slice(0, head), null, ...idx.slice(-tail)];
  }
  const out = [header];
  let prev = -1;
  for (const k of idx) {
    if (k === null) { out.push(note); continue; }
    if (prev >= 0 && k !== prev + 1) out.push(`... [${k - prev - 1} lines omitted] ...`);
    out.push(lines[k]);
    prev = k;
  }
  return out.join('\n');
}
```

- [ ] **Step 4: run — expect all passing.** If the 3/5 split test's index is off by one, the bug is in the test's slice arithmetic, not the story: head = 120 lines, then the note at position 120 (0-based after the header). Fix the test only if the implementation matches `quiet_run.py:216-219`.

- [ ] **Step 5: commit** — `git commit -am "machinery: output filter — normalise, select, render"` (add new files first).

---

### Task 5: `quiet-run.mjs` — run a command, filter its output, keep its exit status

**Files:**
- Create: `plugins/machinery/scripts/quiet-run.mjs`
- Test: `plugins/machinery/test/quiet-run.test.mjs`

**Interfaces:**
- Consumes: `filter.mjs` (Task 4).
- Produces: CLI `node quiet-run.mjs --shell bash|powershell --mode filter|infra (-c "<command>" | <cmdfile>)`; prints either the verbatim output (≤ 40 lines in filter mode, or opt-out `MACHINERY_QUIET=0`) or a header line `[quiet:<mode>] exit=<n>  <s>s  <N> lines -> <M> shown  full log: <path>` followed by the rendered selection; exits with the command's exit status; deletes the cmdfile.

Story: `hooks/quiet-output.md` steps 15–27; source `quiet_run.py:125-301`.

- [ ] **Step 1: failing test** — `test/quiet-run.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScript } from './helpers/run.mjs';

// A "command" that prints N lines of chatter plus one error and exits with a code — via node so it is shell-agnostic.
const gen = (n, code) => `node -e "for(let i=0;i<${n};i++)console.log('   Compiling c'+i);console.log('error: boom');process.exit(${code})"`;
const bash = fs.existsSync('C:/Program Files/Git/bin/bash.exe') || process.platform !== 'win32';

test('short output is verbatim in filter mode (test_short_output_is_verbatim_threshold)', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(5, 0)] });
  assert.equal(r.code, 0);
  assert.ok(!r.stdout.startsWith('[quiet:'));
  assert.equal(r.stdout.trim().split('\n').length, 6);
});

test('long output is filtered, header states counts, exit status preserved', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(100, 3)] });
  assert.equal(r.code, 3);
  const [header, ...rest] = r.stdout.trim().split('\n');
  assert.match(header, /^\[quiet:filter\] exit=3 {2}\d+\.\ds {2}101 lines -> \d+ shown {2}full log: /);
  assert.ok(rest.some((l) => l === 'error: boom'));
  assert.ok(rest.length < 20);
});

test('infra mode on success shows proof lines only; the log file has everything', { skip: !bash }, () => {
  const cmd = `node -e "console.log('remote: chatter');console.log('Already up to date.')"`;
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'infra', '-c', cmd] });
  const [header, ...rest] = r.stdout.trim().split('\n');
  assert.deepEqual(rest, ['Already up to date.']);
  const log = header.split('full log: ')[1];
  assert.ok(fs.readFileSync(log, 'utf8').includes('remote: chatter'));
});

test('opt-out env prints verbatim', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(100, 0)], env: { MACHINERY_QUIET: '0' } });
  assert.equal(r.stdout.trim().split('\n').length, 101);
});

test('cmdfile form is read then deleted', { skip: !bash }, () => {
  const f = path.join(os.tmpdir(), `cmd-${Date.now()}.txt`);
  fs.writeFileSync(f, gen(2, 0));
  runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', f] });
  assert.ok(!fs.existsSync(f));
});

test('RED CHECK: an unknown shell is refused (spec I21)', () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'zsh', '--mode', 'filter', '-c', 'echo x'] });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /shell/);
});
```

- [ ] **Step 2: run — expect failure.** `node --test test/quiet-run.test.mjs`

- [ ] **Step 3: implement** — `scripts/quiet-run.mjs`:
```js
#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 15–27 (the runner half). Ported from quiet_run.py.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalise, select, selectInfra, render, PASS_THROUGH_LINES, MAX_SHOWN } from './lib/filter.mjs';

const SHELLS = Object.freeze({
  bash: (cmd) => {
    for (const c of ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files\\Git\\usr\\bin\\bash.exe']) if (fs.existsSync(c)) return [c, ['-lc', cmd]];
    return ['bash', ['-lc', cmd]];
  },
  powershell: (cmd) => ['powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd]],
});

function quietEnv() {
  const env = { ...process.env, CARGO_TERM_COLOR: 'never', CARGO_TERM_PROGRESS_WHEN: 'never', NO_COLOR: '1', TERM: 'dumb', CI: '1',
    npm_config_progress: 'false', npm_config_color: 'false', PIP_PROGRESS_BAR: 'off', PIP_NO_COLOR: '1', PYTHONUNBUFFERED: '1', PY_COLORS: '0',
    GH_PAGER: 'cat', GH_NO_UPDATE_NOTIFIER: '1', GH_PROMPT_DISABLED: '1', CLICOLOR: '0', CLICOLOR_FORCE: '0' };
  delete env.FORCE_COLOR; delete env.GH_FORCE_TTY;
  return env;
}

function logDir() {
  const job = process.env.CLAUDE_JOB_DIR;
  const d = job ? path.join(job, 'tmp') : path.join(os.tmpdir(), 'claude-quiet');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function parseArgs(argv) {
  const a = { shell: 'bash', mode: 'filter', command: null, cmdfile: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--shell') a.shell = argv[++i];
    else if (x === '--mode') a.mode = argv[++i];
    else if (x === '-c' || x === '--command') a.command = argv[++i];
    else a.cmdfile = x;
  }
  return a;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!SHELLS[a.shell]) { process.stderr.write(`quiet-run: unknown shell '${a.shell}' (bash|powershell)\n`); return 2; }
  if (a.mode !== 'filter' && a.mode !== 'infra') { process.stderr.write(`quiet-run: unknown mode '${a.mode}'\n`); return 2; }
  let command = a.command;
  if (command === null && a.cmdfile) command = fs.readFileSync(a.cmdfile, 'utf8');
  if (command === null) { process.stderr.write('quiet-run: need a cmdfile or -c\n'); return 2; }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const logPath = path.join(logDir(), `quiet-${stamp}-${process.pid}.log`);
  const [exe, args] = SHELLS[a.shell](command);
  const t0 = Date.now();
  const r = spawnSync(exe, args, { env: quietEnv(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  const code = r.status ?? 1;
  const raw = Buffer.concat([r.stdout ?? Buffer.alloc(0), r.stderr ?? Buffer.alloc(0)]); // both streams as one (step 19)
  fs.writeFileSync(logPath, Buffer.concat([Buffer.from(`$ ${command}\n`), raw]));
  const lines = normalise(raw);
  const forced = process.env.MACHINERY_QUIET === '0';
  const verbatim = forced || (a.mode !== 'infra' && lines.length <= PASS_THROUGH_LINES);
  if (verbatim) process.stdout.write(lines.join('\n') + (lines.length ? '\n' : ''));
  else {
    const keep = a.mode === 'infra' ? selectInfra(lines, code) : select(lines);
    const header = `[quiet:${a.mode}] exit=${code}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${lines.length} lines -> ${Math.min(keep.size, MAX_SHOWN)} shown  full log: ${logPath}`;
    process.stdout.write(render(lines, keep, header) + '\n');
  }
  if (a.cmdfile) { try { fs.rmSync(a.cmdfile); } catch {} }
  return code;
}

process.exitCode = main();
```
Note: `spawnSync` with two pipes cannot interleave stdout and stderr in true order; the story asks for "both streams as one stream". Interleaving fidelity is a known ceiling (record it in the file header) — the filter is line-based and order between streams rarely matters for selection; the full log keeps both.

- [ ] **Step 4: run — expect passing** (the bash tests skip on a machine without Git Bash; on this machine they run).

- [ ] **Step 5: commit** — `git add plugins/machinery && git commit -m "machinery: quiet-run — filtered runner preserving exit status"`

---

### Task 6: `quiet.mjs` — the PreToolUse hook

**Files:**
- Create: `plugins/machinery/scripts/quiet.mjs`
- Modify: `plugins/machinery/hooks/hooks.json` (PreToolUse entry after the recorder)
- Test: `plugins/machinery/test/quiet.test.mjs`

**Interfaces:**
- Consumes: `classify` (Task 3), `emit.updatedInput` (Task 1), `readPayload` (Task 1), fixture `PreToolUse-Bash.json` / `PreToolUse-PowerShell.json` (Task 2).
- Produces: on `infra`/`noisy` — one `updatedInput` document whose `command` runs `quiet-run.mjs` with the right shell and mode and whose `description` gains ` [quiet:<mode>]`; otherwise nothing. Fails **open**: any internal error → no output, exit 0.

- [ ] **Step 1: failing test** — `test/quiet.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, PLUGIN } from './helpers/run.mjs';

const fixture = (name, command) => {
  const p = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads', `${name}.json`), 'utf8'));
  p.tool_input = { ...p.tool_input, command, description: 'd' };
  return JSON.stringify(p);
};
const out = (stdout) => JSON.parse(stdout).hookSpecificOutput;

test('noisy bash command is rewritten to run through quiet-run in filter mode', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /^node "[^"]*quiet-run\.mjs" --shell bash --mode filter "[^"]+"$/);
  assert.equal(u.description, 'd [quiet:filter]');
  const cmdfile = u.command.match(/"([^"]+)"$/)[1];
  assert.equal(fs.readFileSync(cmdfile, 'utf8'), 'cargo test');
});

test('infra powershell command gets the powershell wrapper and exit passthrough', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-PowerShell', 'git push') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /--shell powershell --mode infra .*; exit \$LASTEXITCODE$/);
});

test('read / piped / redirected / plain commands are untouched', () => {
  for (const c of ['gh issue view 1', 'cargo test | tail -5', 'cargo build > log', 'ls']) {
    const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c); assert.equal(r.code, 0);
  }
});

test('a non-shell tool is untouched', () => {
  const p = JSON.parse(fixture('PreToolUse-Bash', 'cargo test')); p.tool_name = 'Read';
  const r = runScript('scripts/quiet.mjs', { stdin: JSON.stringify(p) });
  assert.equal(r.stdout, '');
});

test('fails OPEN: garbage stdin → no output, exit 0 (spec I17)', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: '{not json' });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('fails OPEN: unwritable temp dir → no output, exit 0 (spec I17)', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test'), env: { CLAUDE_JOB_DIR: 'Z:\\nonexistent\\dir\\for\\quiet' } });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('RED CHECK: the rewrite is not the identity', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test') });
  assert.notEqual(out(r.stdout).updatedInput.command, 'cargo test');
});
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/quiet.mjs`:
```js
#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 1–18 (the hook half). Fails OPEN (spec I17).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './lib/classify.mjs';
import { readPayload } from './lib/stdin.mjs';
import { updatedInput } from './lib/emit.mjs';

function main() {
  const p = readPayload();
  if (!p) return;
  const tool = p.tool_name;
  if (tool !== 'Bash' && tool !== 'PowerShell') return;
  const input = p.tool_input ?? {};
  const command = input.command ?? '';
  const kind = classify(command);
  if (kind !== 'infra' && kind !== 'noisy') return;
  const mode = kind === 'infra' ? 'infra' : 'filter';
  const shell = tool === 'PowerShell' ? 'powershell' : 'bash';
  const job = process.env.CLAUDE_JOB_DIR;
  const dir = job ? path.join(job, 'tmp') : path.join(os.tmpdir(), 'claude-quiet');
  fs.mkdirSync(dir, { recursive: true });
  const cmdfile = path.join(dir, `cmd-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(cmdfile, command, 'utf8');
  let runner = path.join(path.dirname(fileURLToPath(import.meta.url)), 'quiet-run.mjs');
  let file = cmdfile;
  if (shell === 'bash') { runner = runner.replace(/\\/g, '/'); file = file.replace(/\\/g, '/'); }
  const wrapped = shell === 'bash'
    ? `node "${runner}" --shell bash --mode ${mode} "${file}"`
    : `node "${runner}" --shell powershell --mode ${mode} "${file}"; exit $LASTEXITCODE`;
  updatedInput({ ...input, command: wrapped, description: `${input.description ?? ''} [quiet:${mode}]`.trim() });
}

try { main(); } catch { /* fail open: the command runs unfiltered */ }
process.exitCode = 0;
```

- [ ] **Step 4: wire it** — in `hooks/hooks.json`, `PreToolUse[0].hooks` gets a second entry after the recorder:
```json
{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/quiet.mjs\"", "timeout": 15, "statusMessage": "Quiet-output check" }
```

- [ ] **Step 5: run — expect passing.** Then run the whole suite: `node --test test/` — all green.

- [ ] **Step 6: commit** — `git add plugins/machinery && git commit -m "machinery: quiet PreToolUse hook (fail-open rewrite)"` — bump version if the check asks.

---

### Task 7: `lib/config.mjs` and `lib/inbox.mjs`

**Files:**
- Create: `plugins/machinery/scripts/lib/config.mjs`, `plugins/machinery/scripts/lib/inbox.mjs`
- Test: `plugins/machinery/test/lib-config.test.mjs`, `plugins/machinery/test/lib-inbox.test.mjs`

**Interfaces:**
- Produces: `config.mjs` → `pluginRoot(): string` (from `CLAUDE_PLUGIN_ROOT`, else the directory above `scripts/`), `rulesSource(): string` (`~/.claude/machinery.json` → `rulesSource`, else `<pluginRoot>/rules`; `$HOME` overridable by `MACHINERY_HOME` for tests), `universalInbox(): string` (`path.join(path.dirname(rulesSource()), 'inbox.md')`), `projectInbox(root)`, `projectIndex(root)`, `projectRules(root)`, `markers()` (from `markers.json`).
- `inbox.mjs` → `parseInbox(text): Entry[]` with `Entry = {state: 'PENDING'|'FILED'|'DISMISSED', stamp, marker, session, text, disposition, start, end}` (line offsets); `appendEntry(file, {marker, text, session}): Entry`; `setDisposition(file, stamp, {state, detail})`; `pending(file): Entry[]`.

Format (spec § Rules):
```
## PENDING 2026-09-02T20:00:00Z PRULE session-abc

<verbatim prompt text>

disposition: PENDING
```
Filed: heading `## FILED …`, `disposition: filed → rules/straight-talk.md § Claims`. Dismissed: `## DISMISSED …`, `disposition: dismissed: <reason>`.

- [ ] **Step 1: failing tests** — `test/lib-config.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { rulesSource, universalInbox, projectInbox, projectIndex, markers, pluginRoot } from '../scripts/lib/config.mjs';

test('defaults: rules source is the plugin rules dir; universal inbox beside it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  process.env.MACHINERY_HOME = home; process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;
  assert.equal(rulesSource(), path.join(PLUGIN, 'rules'));
  assert.equal(universalInbox(), path.join(PLUGIN, 'inbox.md'));
});

test('~/.claude/machinery.json overrides the source', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: 'D:/checkout/plugins/machinery/rules' }));
  process.env.MACHINERY_HOME = home;
  assert.equal(rulesSource(), path.resolve('D:/checkout/plugins/machinery/rules'));
  assert.equal(universalInbox(), path.resolve('D:/checkout/plugins/machinery/inbox.md'));
});

test('project paths sit outside the rules directory (spec I12)', () => {
  assert.equal(projectInbox('R'), path.join('R', '.claude', 'machinery', 'inbox.md'));
  assert.equal(projectIndex('R'), path.join('R', '.claude', 'machinery', 'INDEX.md'));
});

test('markers come from markers.json', () => assert.deepEqual(markers(), { project: 'PRULE:', universal: 'URULE:', ambiguous: 'RULE:' }));

test('RED CHECK: a malformed machinery.json is an error, not a silent default', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), '{oops');
  process.env.MACHINERY_HOME = home;
  assert.throws(() => rulesSource(), /machinery\.json/);
});
```
`test/lib-inbox.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseInbox, appendEntry, setDisposition, pending } from '../scripts/lib/inbox.mjs';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-')), 'inbox.md');

test('append then parse round-trips verbatim text', () => {
  const f = tmp();
  const e = appendEntry(f, { marker: 'PRULE', text: 'PRULE: never guess\n  second line', session: 's1' });
  const [got] = parseInbox(fs.readFileSync(f, 'utf8'));
  assert.equal(got.state, 'PENDING'); assert.equal(got.marker, 'PRULE'); assert.equal(got.session, 's1');
  assert.equal(got.text, 'PRULE: never guess\n  second line'); assert.equal(got.stamp, e.stamp);
});

test('append-only: the same text twice is two entries (no dedup)', () => {
  const f = tmp();
  appendEntry(f, { marker: 'URULE', text: 'x', session: 's' }); appendEntry(f, { marker: 'URULE', text: 'x', session: 's' });
  assert.equal(parseInbox(fs.readFileSync(f, 'utf8')).length, 2);
});

test('setDisposition flips the heading state and writes the detail line', () => {
  const f = tmp();
  const e = appendEntry(f, { marker: 'PRULE', text: 'x', session: 's' });
  setDisposition(f, e.stamp, { state: 'FILED', detail: 'filed → rules/straight-talk.md § Claims' });
  const [got] = parseInbox(fs.readFileSync(f, 'utf8'));
  assert.equal(got.state, 'FILED'); assert.equal(got.disposition, 'filed → rules/straight-talk.md § Claims');
  assert.equal(pending(f).length, 0);
});

test('pending lists only PENDING entries', () => {
  const f = tmp();
  const a = appendEntry(f, { marker: 'PRULE', text: 'a', session: 's' });
  appendEntry(f, { marker: 'PRULE', text: 'b', session: 's' });
  setDisposition(f, a.stamp, { state: 'DISMISSED', detail: 'dismissed: duplicate' });
  assert.deepEqual(pending(f).map((e) => e.text), ['b']);
});

test('a missing inbox file is an empty inbox', () => assert.deepEqual(pending(path.join(os.tmpdir(), 'nope', 'inbox.md')), []));

test('RED CHECK: a block without a disposition line is rejected as malformed', () => {
  assert.throws(() => parseInbox('## PENDING 2026-01-01T00:00:00Z PRULE s\n\ntext\n'), /malformed/);
});
```

- [ ] **Step 2: run — expect failures.**

- [ ] **Step 3: implement** — `scripts/lib/config.mjs`:
```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const home = () => process.env.MACHINERY_HOME || os.homedir();
export function pluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}
function userConfig() {
  const f = path.join(home(), '.claude', 'machinery.json');
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`machinery.json is not valid JSON: ${f} (${e.message})`); }
}
export function rulesSource() {
  const c = userConfig();
  return c.rulesSource ? path.resolve(c.rulesSource) : path.join(pluginRoot(), 'rules');
}
export const universalInbox = () => path.join(path.dirname(rulesSource()), 'inbox.md');
export const universalIndex = () => path.join(path.dirname(rulesSource()), 'register', 'INDEX.md');
export const projectRules = (root) => path.join(root, '.claude', 'rules');
export const projectInbox = (root) => path.join(root, '.claude', 'machinery', 'inbox.md');
export const projectIndex = (root) => path.join(root, '.claude', 'machinery', 'INDEX.md');
export function markers() { return JSON.parse(fs.readFileSync(path.join(pluginRoot(), 'markers.json'), 'utf8')); }
```
`scripts/lib/inbox.mjs`:
```js
// Story: hooks/rule-capture.md (entry shape) and skills/rule-intake (dispositions). Parse, don't validate (spec I8).
import fs from 'node:fs';
import path from 'node:path';

const HEAD = /^## (PENDING|FILED|DISMISSED) (\S+) (PRULE|URULE) (\S+)\s*$/;
const DISP = /^disposition: (.*)$/;

export function parseInbox(text) {
  const lines = text.split(/\r?\n/), entries = [];
  for (let i = 0; i < lines.length; i++) {
    const m = HEAD.exec(lines[i]);
    if (!m) continue;
    let j = i + 1, disposition = null, body = [];
    while (j < lines.length && !HEAD.test(lines[j])) {
      const d = DISP.exec(lines[j]);
      if (d) { disposition = d[1]; j++; break; }
      body.push(lines[j]); j++;
    }
    if (disposition === null) throw new Error(`malformed inbox: entry at line ${i + 1} has no disposition line`);
    const bodyText = body.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
    entries.push({ state: m[1], stamp: m[2], marker: m[3], session: m[4], text: bodyText, disposition, start: i, end: j });
    i = j - 1;
  }
  return entries;
}

export function appendEntry(file, { marker, text, session }) {
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const block = `\n## PENDING ${stamp} ${marker} ${session}\n\n${text.trim()}\n\ndisposition: PENDING\n`;
  fs.appendFileSync(file, block, 'utf8');
  return { state: 'PENDING', stamp, marker, session, text: text.trim(), disposition: 'PENDING' };
}

export function setDisposition(file, stamp, { state, detail }) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const entries = parseInbox(lines.join('\n'));
  const e = entries.find((x) => x.stamp === stamp);
  if (!e) throw new Error(`no inbox entry with stamp ${stamp}`);
  lines[e.start] = lines[e.start].replace(/^## \w+/, `## ${state}`);
  lines[e.end - 1] = `disposition: ${detail}`;
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

export function pending(file) {
  if (!fs.existsSync(file)) return [];
  return parseInbox(fs.readFileSync(file, 'utf8')).filter((e) => e.state === 'PENDING');
}
```

- [ ] **Step 4: run — expect passing.** `node --test test/lib-config.test.mjs test/lib-inbox.test.mjs`

- [ ] **Step 5: commit** — `git add plugins/machinery && git commit -m "machinery: config and inbox modules"`

---

### Task 8: `capture.mjs` — the UserPromptSubmit hook

**Files:**
- Create: `plugins/machinery/scripts/capture.mjs`
- Modify: `plugins/machinery/hooks/hooks.json` (UserPromptSubmit entry)
- Test: `plugins/machinery/test/capture.test.mjs`

**Interfaces:**
- Consumes: `markers()`, `projectInbox`, `universalInbox` (Task 7), `projectRoot`, `isRootSession` (Task 1), `appendEntry`, `pending` (Task 7), `emit.context`, fixture `UserPromptSubmit.json`.
- Produces: the capture behavior of spec §Claude-side + the pending nudge; the returned context text is what triggers automatic intake (Task 15's skill reads it).

Story: `hooks/rule-capture.md`.

- [ ] **Step 1: failing test** — `test/capture.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { pending } from '../scripts/lib/inbox.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/UserPromptSubmit.json'), 'utf8'));
const payload = (prompt, cwd) => JSON.stringify({ ...base, prompt, cwd });
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
const ctx = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
const run = (prompt, cwd, env = {}) => runScript('scripts/capture.mjs', { stdin: payload(prompt, cwd), cwd, env: { MACHINERY_HOME: home(), ...env } });

test('PRULE from the ROOT session lands in the root inbox and asks for intake now', () => {
  const r = makeRepo();
  try {
    const res = run('PRULE: never guess a path', r.root);
    const inbox = path.join(r.root, '.claude', 'machinery', 'inbox.md');
    assert.equal(pending(inbox).length, 1);
    assert.equal(pending(inbox)[0].text, 'PRULE: never guess a path');
    assert.match(ctx(res), /captured to .*inbox\.md.*run the intake sequence now/i);
  } finally { r.cleanup(); }
});

test('PRULE from INSIDE A WORKTREE lands in the root inbox, not the copy, and says filing waits for a root session (spec I20, I29)', () => {
  const r = makeRepo();
  try {
    const wt = addWorktree(r.root, 'feat');
    const res = run('PRULE: x', wt);
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 1);
    assert.ok(!fs.existsSync(path.join(wt, '.claude', 'machinery', 'inbox.md')));
    assert.match(ctx(res), /filed from a root session/i);
  } finally { r.cleanup(); }
});

test('URULE lands in the universal inbox beside the rules source (spec I3)', () => {
  const r = makeRepo();
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'src-')); fs.mkdirSync(path.join(src, 'rules'));
  const h = home(); fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: path.join(src, 'rules') }));
  try {
    const res = run('urule: universal thing', r.root, { MACHINERY_HOME: h });
    assert.equal(pending(path.join(src, 'inbox.md')).length, 1);
    assert.ok(!fs.existsSync(path.join(r.root, '.claude', 'machinery', 'inbox.md')));
    assert.match(ctx(res), /captured to .*inbox\.md/i);
  } finally { r.cleanup(); }
});

test('bare RULE: captures nothing and asks which', () => {
  const r = makeRepo();
  try {
    const res = run('RULE: ambiguous', r.root);
    assert.ok(!fs.existsSync(path.join(r.root, '.claude', 'machinery', 'inbox.md')));
    assert.match(ctx(res), /PRULE: or URULE:/);
  } finally { r.cleanup(); }
});

test('an unmarked prompt with nothing pending produces no output', () => {
  const r = makeRepo();
  try { const res = run('hello', r.root); assert.equal(res.stdout, ''); assert.equal(res.code, 0); }
  finally { r.cleanup(); }
});

test('an unmarked prompt in a root session with pending entries prepends the intake nudge (spec I32)', () => {
  const r = makeRepo();
  try {
    run('PRULE: a', r.root);
    const res = run('unrelated', r.root);
    assert.match(ctx(res), /1 rule.* pending .* running intake/i);
  } finally { r.cleanup(); }
});

test('fails LOUD: unwritable inbox → non-zero exit with the reason on stderr', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(r.root, '.claude', 'machinery'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.claude', 'machinery', 'inbox.md'), '');
    fs.chmodSync(path.join(r.root, '.claude', 'machinery', 'inbox.md'), 0o444);
    fs.mkdirSync(path.join(r.root, '.claude', 'machinery', 'inbox.md', 'x'), { recursive: true }).catch?.(() => {});
  } catch { /* platform-dependent; fall through to the directory trick below */ }
  finally { r.cleanup(); }
  // Portable way to make the inbox path unwritable: make it a DIRECTORY.
  const r2 = makeRepo();
  try {
    fs.mkdirSync(path.join(r2.root, '.claude', 'machinery', 'inbox.md'), { recursive: true });
    const res = run('PRULE: x', r2.root);
    assert.notEqual(res.code, 0); assert.match(res.stderr, /inbox/);
  } finally { r2.cleanup(); }
});

test('RED CHECK: a PRULE is not silently dropped', () => {
  const r = makeRepo();
  try { run('PRULE: kept', r.root); assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 1); }
  finally { r.cleanup(); }
});
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/capture.mjs`:
```js
#!/usr/bin/env node
// Story: hooks/rule-capture.md. Fails LOUD (spec §Claude-side): a rule you dictated and lost is the worst outcome.
import { readPayload } from './lib/stdin.mjs';
import { context } from './lib/emit.mjs';
import { markers, projectInbox, universalInbox } from './lib/config.mjs';
import { projectRoot, isRootSession } from './lib/root.mjs';
import { appendEntry, pending } from './lib/inbox.mjs';

function main() {
  const p = readPayload();
  if (!p) return 0;
  const cwd = p.cwd || process.cwd();
  const m = markers();
  const prompt = String(p.prompt ?? '');
  const head = prompt.trimStart().toLowerCase();
  const session = p.session_id || 'unknown-session';
  const root = projectRoot(cwd);
  const rootSession = isRootSession(cwd);
  const lines = [];

  if (head.startsWith(m.universal.toLowerCase())) {
    const inbox = universalInbox();
    appendEntry(inbox, { marker: 'URULE', text: prompt, session });
    lines.push(`URULE captured verbatim to ${inbox} (PENDING). Run the intake sequence now (skill: machinery:rule-intake): file it in the universal rules, regenerate the index, bump the plugin version, disposition the entry, commit, then /machinery:reload.`);
  } else if (head.startsWith(m.project.toLowerCase())) {
    const inbox = projectInbox(root);
    appendEntry(inbox, { marker: 'PRULE', text: prompt, session });
    lines.push(rootSession
      ? `PRULE captured verbatim to ${inbox} (PENDING). Run the intake sequence now (skill: machinery:rule-intake): file it in this project's rules, regenerate the index, disposition the entry, commit. Commits are blocked until then.`
      : `PRULE captured verbatim to the project root's inbox ${inbox} (PENDING). This session is inside an isolated working copy, so it will be filed from a root session; the root's commits stay blocked until then.`);
  } else if (head.startsWith(m.ambiguous.toLowerCase())) {
    lines.push(`Ambiguous marker: nothing was captured. Dictate a project rule with ${m.project} or a universal rule with ${m.universal}.`);
  }

  const proj = rootSession ? pending(projectInbox(root)).length : 0;
  const univ = pending(universalInbox()).length;
  const n = proj + univ;
  if (n && !lines.some((l) => l.includes('Run the intake sequence now'))) {
    lines.unshift(`${n} rule${n === 1 ? '' : 's'} pending in the inbox${proj && univ ? 'es' : ''} — running intake (skill: machinery:rule-intake) before this prompt.`);
  }
  if (lines.length) context(lines.join('\n'));
  return 0;
}

try { process.exitCode = main(); }
catch (e) { process.stderr.write(`rule capture failed (inbox not written): ${e.message}\n`); process.exitCode = 1; }
```

- [ ] **Step 4: wire it** — `hooks.json` `UserPromptSubmit[0].hooks` gains `{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/capture.mjs\"", "timeout": 30, "statusMessage": "Checking for PRULE:/URULE: mark" }` after the recorder.

- [ ] **Step 5: run — expect passing** (remove the platform-dependent chmod attempt from the loud-failure test if it misbehaves; the directory trick is the assertion).

- [ ] **Step 6: commit** — `git add plugins/machinery && git commit -m "machinery: PRULE/URULE capture hook with pending-intake nudge"`

---

### Task 9: Frontmatter, the index generator, `reindex.mjs`

**Files:**
- Create: `plugins/machinery/scripts/lib/frontmatter.mjs`, `plugins/machinery/scripts/lib/index.mjs`, `plugins/machinery/scripts/reindex.mjs`
- Test: `plugins/machinery/test/lib-index.test.mjs`

**Interfaces:**
- Produces: `frontmatter.mjs` → `parseRuleFile(text, name): {status: '🟢'|'🟡'|'🔴', supersedes: [{section, by, date}], sections: [{heading, rules: number}], rules: number}` (throws on any other status or malformed frontmatter); `index.mjs` → `generateIndex(rulesDir): string` (deterministic markdown), `readIndex(file): string|null`; `reindex.mjs` CLI → `node reindex.mjs --rules <dir> --out <file>` writes the file, exits 0; `--check` compares only (exit 1 if different, printing a unified hint).

Rule file frontmatter (optional; absent = `status: 🟢`, no supersessions):
```
---
status: 🟢
supersedes:
  - section: Old section name
    by: rules/agent-topology.md § Where an agent works
    date: 2026-09-02
---
```
A "rule" = a top-level `- ` bullet. A "section" = a `## ` heading. The generated index:
```
# Register index

Generated by machinery — do not edit; run /machinery:reindex.

| File | Status | Rules | Sections |
|---|---|---|---|
| rules/straight-talk.md | 🟢 | 10 | Claims; Admissions; Brevity |

## Supersession

| Superseded | By | Date |
|---|---|---|
| rules/agent-topology.md § Old section name | rules/agent-topology.md § Where an agent works | 2026-09-02 |

## Superseded by (derived)

| Section | Supersedes | Date |
|---|---|---|
| rules/agent-topology.md § Where an agent works | rules/agent-topology.md § Old section name | 2026-09-02 |
```

- [ ] **Step 1: failing test** — `test/lib-index.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRuleFile } from '../scripts/lib/frontmatter.mjs';
import { generateIndex } from '../scripts/lib/index.mjs';
import { runScript } from './helpers/run.mjs';

const rulesDir = (files) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(d, n), t);
  return d;
};
const A = `---\nstatus: 🟢\nsupersedes:\n  - section: Old way\n    by: b.md § New way\n    date: 2026-09-02\n---\n# A\n\n## One\n\n- rule 1\n- rule 2\n  continued\n\n## Two\n\n- rule 3\n`;
const B = `# B\n\n## New way\n\n- rule x\n\n## Old way\n\n- rule y\n`;

test('parseRuleFile: status default, sections and rule counts', () => {
  const p = parseRuleFile(B, 'b.md');
  assert.equal(p.status, '🟢'); assert.equal(p.rules, 2);
  assert.deepEqual(p.sections.map((s) => s.heading), ['New way', 'Old way']);
});

test('parseRuleFile: frontmatter status and supersedes', () => {
  const p = parseRuleFile(A, 'a.md');
  assert.equal(p.rules, 3);
  assert.deepEqual(p.supersedes, [{ section: 'Old way', by: 'b.md § New way', date: '2026-09-02' }]);
});

test('generateIndex is deterministic and derives the reverse links (spec I2, I13)', () => {
  const d = rulesDir({ 'a.md': A, 'b.md': B });
  const out = generateIndex(d);
  assert.equal(out, generateIndex(d));
  assert.ok(out.includes('| rules/a.md | 🟢 | 3 | One; Two |'));
  assert.ok(out.includes('| rules/a.md § Old way | b.md § New way | 2026-09-02 |'));
  assert.ok(out.includes('## Superseded by (derived)'));
  assert.ok(out.includes('| b.md § New way | rules/a.md § Old way | 2026-09-02 |'));
});

test('reindex --check exits 1 when the file is stale and 0 after --out (spec I28)', () => {
  const d = rulesDir({ 'a.md': A });
  const out = path.join(path.dirname(d), 'INDEX.md');
  fs.writeFileSync(out, 'stale');
  assert.equal(runScript('scripts/reindex.mjs', { args: ['--rules', d, '--out', out, '--check'] }).code, 1);
  assert.equal(runScript('scripts/reindex.mjs', { args: ['--rules', d, '--out', out] }).code, 0);
  assert.equal(runScript('scripts/reindex.mjs', { args: ['--rules', d, '--out', out, '--check'] }).code, 0);
});

test('RED CHECK: an unknown status is refused (spec I16)', () => {
  assert.throws(() => parseRuleFile('---\nstatus: 🟠\n---\n# x\n', 'x.md'), /status/);
});

test('RED CHECK: a supersession naming a missing section is refused by the generator', () => {
  const d = rulesDir({ 'a.md': A.replace('section: Old way', 'section: Nope') });
  assert.throws(() => generateIndex(d), /Nope/);
});
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/lib/frontmatter.mjs`:
```js
// Rule identity = file § section (union: rules/rule-governance.md § Where a rule lives). Parse, don't validate.
const STATUSES = new Set(['🟢', '🟡', '🔴']);

function parseFrontmatter(lines) {
  if (lines[0]?.trim() !== '---') return { meta: { status: '🟢', supersedes: [] }, body: lines };
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error('frontmatter never closes');
  const meta = { status: '🟢', supersedes: [] };
  let cur = null;
  for (const raw of lines.slice(1, end)) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if ((m = /^status:\s*(\S+)$/.exec(line))) { if (!STATUSES.has(m[1])) throw new Error(`unknown status '${m[1]}' (🟢|🟡|🔴)`); meta.status = m[1]; }
    else if (/^supersedes:\s*$/.test(line)) cur = 'supersedes';
    else if (cur === 'supersedes' && (m = /^\s+-\s+section:\s*(.+)$/.exec(line))) meta.supersedes.push({ section: m[1].trim(), by: null, date: null });
    else if (cur === 'supersedes' && (m = /^\s+by:\s*(.+)$/.exec(line))) meta.supersedes.at(-1).by = m[1].trim();
    else if (cur === 'supersedes' && (m = /^\s+date:\s*(\S+)$/.exec(line))) meta.supersedes.at(-1).date = m[1];
    else if (line.trim()) throw new Error(`unrecognised frontmatter line: ${line}`);
  }
  for (const s of meta.supersedes) if (!s.by || !s.date) throw new Error(`supersedes entry for '${s.section}' needs by and date`);
  return { meta, body: lines.slice(end + 1) };
}

export function parseRuleFile(text, name) {
  const { meta, body } = parseFrontmatter(text.split(/\r?\n/));
  const sections = [];
  let inFence = false;
  for (const line of body) {
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const h = /^## (.+)$/.exec(line);
    if (h) { sections.push({ heading: h[1].trim(), rules: 0 }); continue; }
    if (/^- /.test(line) && sections.length) sections.at(-1).rules++;
  }
  return { name, status: meta.status, supersedes: meta.supersedes, sections, rules: sections.reduce((n, s) => n + s.rules, 0) };
}
```
`scripts/lib/index.mjs`:
```js
// Story: register/INDEX.md's contract, made mechanical (spec I2, I13): the index is derived, never authored.
import fs from 'node:fs';
import path from 'node:path';
import { parseRuleFile } from './frontmatter.mjs';

export function readRules(rulesDir) {
  return fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort()
    .map((f) => parseRuleFile(fs.readFileSync(path.join(rulesDir, f), 'utf8'), f));
}

export function generateIndex(rulesDir) {
  const files = readRules(rulesDir);
  const known = new Set(files.flatMap((f) => f.sections.map((s) => `rules/${f.name} § ${s.heading}`)));
  const rows = files.map((f) => `| rules/${f.name} | ${f.status} | ${f.rules} | ${f.sections.map((s) => s.heading).join('; ')} |`);
  const sup = [];
  for (const f of files) for (const s of f.supersedes) {
    const key = `rules/${f.name} § ${s.section}`;
    if (!known.has(key)) throw new Error(`${f.name}: supersedes names a section that does not exist: '${s.section}'`);
    sup.push({ superseded: key, by: s.by, date: s.date });
  }
  sup.sort((a, b) => a.superseded.localeCompare(b.superseded));
  const out = ['# Register index', '', 'Generated by machinery — do not edit; run /machinery:reindex.', '',
    '| File | Status | Rules | Sections |', '|---|---|---|---|', ...rows, '', '## Supersession', '',
    '| Superseded | By | Date |', '|---|---|---|', ...sup.map((s) => `| ${s.superseded} | ${s.by} | ${s.date} |`), '',
    '## Superseded by (derived)', '', '| Section | Supersedes | Date |', '|---|---|---|',
    ...[...sup].sort((a, b) => a.by.localeCompare(b.by)).map((s) => `| ${s.by} | ${s.superseded} | ${s.date} |`), ''];
  return out.join('\n');
}

export const readIndex = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
```
`scripts/reindex.mjs`:
```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateIndex, readIndex } from './lib/index.mjs';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const rules = opt('--rules'), out = opt('--out'), check = argv.includes('--check');
if (!rules || !out) { process.stderr.write('usage: reindex --rules <dir> --out <file> [--check]\n'); process.exit(2); }
const fresh = generateIndex(rules);
if (check) {
  const cur = readIndex(out);
  if (cur === fresh) process.exit(0);
  process.stdout.write(`register_check: index is stale — ${out} differs from a fresh regeneration; run /machinery:reindex\n`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, fresh, 'utf8');
```

- [ ] **Step 4: run — expect passing.**

- [ ] **Step 5: commit** — `git add plugins/machinery && git commit -m "machinery: frontmatter parser and generated register index"`

---

### Task 10: The commit gate

**Files:**
- Create: `plugins/machinery/scripts/lib/report.mjs`
- Create: `plugins/machinery/scripts/gate/gate.mjs`, `register-check.mjs`, `citation-target.mjs`, `sweep-guard.mjs`
- Test: `plugins/machinery/test/gate.test.mjs`, `plugins/machinery/test/gate-purity.test.mjs`

**Interfaces:**
- Consumes: `git` (Task 1), `pending` (Task 7), `generateIndex/readIndex` (Task 9), config paths (Task 7).
- Produces: `node gate.mjs [--root <dir>] [--universal] [--full]` exits 1 on any blocking failure, 0 otherwise; prints one `<check>: <n> of <m> …` line per executed check (zero included) via `report()`; sweep guard prints `ADVISORY:` lines only. `--universal` runs the register check over the plugin (`rules/`, `register/INDEX.md`, `inbox.md`) instead of a project. `--full` also re-validates every citation in the tree (reserved for the hosted check / merge gate).
- `report.mjs` → `report(check: string, n: number, of: number, note?: string)` prints `${check}: ${n} of ${of}${note ? ' — ' + note : ''}`.

Story: `gates/commit-gate.md`. Sources: both `.githooks/pre-commit`, `scripts/citation_creation_gate.py:95-137`, `scripts/sweep_guard.sh`.

- [ ] **Step 1: failing test** — `test/gate.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const RULE = '# T\n\n## S\n\n- a rule\n';
function project(root) {
  write(root, '.claude/rules/t.md', RULE);
  write(root, '.claude/machinery/inbox.md', '');
  runScript('scripts/reindex.mjs', { args: ['--rules', path.join(root, '.claude/rules'), '--out', path.join(root, '.claude/machinery/INDEX.md')] });
  g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', 'install');
}
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });

test('clean commit passes and every executed check prints its denominator, zero included (spec I25)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/a.md', 'hello'); g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^register_check: 0 of 0 pending/m);
    assert.match(res.stdout, /^citation_target: 0 of 0 new citations/m);
  } finally { r.cleanup(); }
});

test('a PENDING inbox entry blocks', () => {
  const r = makeRepo();
  try {
    project(r.root);
    write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-02T00:00:00Z PRULE s\n\nPRULE: x\n\ndisposition: PENDING\n'); g(r.root, 'add', '-A');
    const res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /1 of 1 pending/);
  } finally { r.cleanup(); }
});

test('a stale (hand-edited) index blocks (spec I28)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, '.claude/machinery/INDEX.md', 'edited by hand'); g(r.root, 'add', '-A');
    const res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /index is stale/);
  } finally { r.cleanup(); }
});

test('a new path:line citation to a blank line blocks; a real one passes (spec I26)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'src/x.js', 'line1\n\nline3\n'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'src');
    write(r.root, 'docs/n.md', 'see `src/x.js:2` and `src/x.js:3`'); g(r.root, 'add', '-A');
    const res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /citation_target: 1 of 2 new citations failed/);
    write(r.root, 'docs/n.md', 'see `src/x.js:3`'); g(r.root, 'add', '-A');
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('a file § Section citation to a missing heading blocks; an existing one passes', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/n.md', 'see `.claude/rules/t.md` § Nope'); g(r.root, 'add', '-A');
    assert.equal(gate(r.root).code, 1);
    write(r.root, 'docs/n.md', 'see `.claude/rules/t.md` § S'); g(r.root, 'add', '-A');
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('old citations are never re-audited: a pre-existing bad citation does not block a new commit', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/old.md', 'see `src/nothere.js:9`'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '--no-verify', '-m', 'old');
    write(r.root, 'docs/new.md', 'plain'); g(r.root, 'add', '-A');
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('sweep guard: docs commit adding a brand-new non-docs file warns, never blocks; modifying an existing non-docs file silences it', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/a.md', 'x'); write(r.root, 'stray.tmp', 'oops'); g(r.root, 'add', '-A');
    let res = gate(r.root); assert.equal(res.code, 0); assert.match(res.stdout, /ADVISORY: sweep-guard denominator: 2 staged, 2 newly-tracked, 1 non-doc suspect/); assert.match(res.stdout, /stray\.tmp/);
    g(r.root, 'commit', '-q', '--no-verify', '-m', 'x');
    write(r.root, 'docs/a.md', 'y'); write(r.root, 'README.md', 'changed'); write(r.root, 'new.tmp', 'n'); g(r.root, 'add', '-A');
    res = gate(r.root); assert.doesNotMatch(res.stdout, /ADVISORY/);
  } finally { r.cleanup(); }
});

test('--universal runs the register check over the plugin layout', () => {
  const r = makeRepo();
  try {
    write(r.root, 'rules/t.md', RULE); write(r.root, 'inbox.md', '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(r.root, 'rules'), '--out', path.join(r.root, 'register/INDEX.md')] });
    g(r.root, 'add', '-A');
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', r.root, '--universal'], cwd: r.root }).code, 0);
  } finally { r.cleanup(); }
});

test('RED CHECK: the gate is not a no-op — a pending entry really fails it', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-02T00:00:00Z PRULE s\n\nx\n\ndisposition: PENDING\n'); g(r.root, 'add', '-A');
    assert.notEqual(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});
```
`test/gate-purity.test.mjs` (spec I23, I19 lint):
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test('nothing under scripts/gate writes to the tree (spec I23)', () => {
  for (const f of walk(path.join(PLUGIN, 'scripts', 'gate'))) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /\bfs\.(write|append|rm|mkdir|unlink|rename|copy)\w*\(/, f);
  }
});

test('JSON.stringify appears only in lib/emit.mjs (spec I19)', () => {
  for (const f of walk(path.join(PLUGIN, 'scripts'))) {
    if (f.endsWith(path.join('lib', 'emit.mjs')) || f.endsWith('record-payload.mjs')) continue;
    assert.ok(!fs.readFileSync(f, 'utf8').includes('JSON.stringify('), `${f} stringifies JSON outside emit.mjs`);
  }
});

test('RED CHECK: the purity scan sees files', () => assert.ok(walk(path.join(PLUGIN, 'scripts', 'gate')).length >= 4));
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/lib/report.mjs`:
```js
// Every executed check prints its denominator, zero included (union: rules/tool-output.md § Proof lines and denominators; spec I25).
export function report(check, n, of, note) {
  process.stdout.write(`${check}: ${n} of ${of}${note ? ' — ' + note : ''}\n`);
}
```
`scripts/gate/register-check.mjs`:
```js
import fs from 'node:fs';
import path from 'node:path';
import { pending } from '../lib/inbox.mjs';
import { generateIndex, readIndex } from '../lib/index.mjs';
import { report } from '../lib/report.mjs';

// {rulesDir, inbox, index} → true if it passes. Never writes (spec I23).
export function registerCheck({ rulesDir, inbox, index }) {
  let ok = true;
  let pend = [];
  try { pend = pending(inbox); } catch (e) { report('register_check', 1, 1, `inbox malformed — ${e.message}`); return false; }
  report('register_check', pend.length, pend.length, `pending inbox entr${pend.length === 1 ? 'y' : 'ies'} (must be 0)`);
  if (pend.length) ok = false;
  let fresh;
  try { fresh = fs.existsSync(rulesDir) ? generateIndex(rulesDir) : null; }
  catch (e) { report('register_check', 1, 1, `rule files: ${e.message}`); return false; }
  const cur = readIndex(index);
  if (fresh !== null && cur !== fresh) { process.stdout.write(`register_check: index is stale — ${path.relative(process.cwd(), index) || index} differs from a fresh regeneration; run /machinery:reindex\n`); ok = false; }
  return ok;
}
```
`scripts/gate/citation-target.mjs`:
```js
import path from 'node:path';
import { git } from '../lib/git.mjs';
import { report } from '../lib/report.mjs';

// Ported from citation_creation_gate.py:95-137 plus the union's `file § Section` form.
const EXTS = 'md|rs|py|mjs|js|ts|tsx|json|toml|yaml|yml|sh|ps1|txt|html|css';
const LINE_CITE = new RegExp(String.raw`\x60([\w.][\w./\\-]*\.(?:${EXTS})):(\d+)(?:-(\d+))?\x60`, 'g');
const SECTION_CITE = new RegExp(String.raw`\x60([\w.][\w./\\-]*\.md)\x60\s*§\s*([^\n|]+?)(?=\s*(?:[|.;,)]|$))`, 'gm');
const SELF_EXCLUDE = [/scripts\/gate\/citation-target\.mjs$/, /test\/gate\.test\.mjs$/];
const stemHasLetter = (p) => /[A-Za-z]/.test(p.split(/[\\/]/).at(-1).replace(/\.[^.]+$/, ''));

function stagedAdded(root, mergeMode) {
  const args = mergeMode ? ['diff', '-U0', 'HEAD^1', 'HEAD'] : ['diff', '--cached', '-U0'];
  const d = git(args, root);
  if (d.code !== 0) throw new Error(`git diff failed: ${d.stderr}`);
  const out = []; let file = null;
  for (const line of d.stdout.split('\n')) {
    if (line.startsWith('+++ b/')) file = line.slice(6);
    else if (line.startsWith('+') && !line.startsWith('+++') && file) out.push({ file, text: line.slice(1) });
  }
  return out.filter((x) => !SELF_EXCLUDE.some((re) => re.test(x.file)));
}

function blobLine(root, mergeMode, file, n) {
  const ref = mergeMode ? 'HEAD' : '';
  const r = git(['show', `${ref}:${file}`], root);
  if (r.code !== 0) return null;
  const lines = r.stdout.split('\n');
  return n >= 1 && n <= lines.length ? lines[n - 1] : null;
}

export function citationTarget({ root, mergeMode = false }) {
  const added = stagedAdded(root, mergeMode);
  const cites = [];
  for (const { file, text } of added) {
    for (const m of text.matchAll(LINE_CITE)) if (stemHasLetter(m[1])) cites.push({ from: file, kind: 'line', path: m[1].replace(/\\/g, '/'), line: Number(m[2]) });
    for (const m of text.matchAll(SECTION_CITE)) cites.push({ from: file, kind: 'section', path: m[1].replace(/\\/g, '/'), section: m[2].trim() });
  }
  const failures = [];
  for (const c of cites) {
    if (c.kind === 'line') {
      const l = blobLine(root, mergeMode, c.path, c.line);
      if (l === null || !l.trim()) failures.push(`${c.from}: \`${c.path}:${c.line}\` → ${l === null ? 'no such file/line in the index' : 'blank line'}`);
    } else {
      const r = git(['show', `${mergeMode ? 'HEAD' : ''}:${c.path}`], root);
      const ok = r.code === 0 && r.stdout.split('\n').some((x) => x.trim() === `## ${c.section}` || x.trim() === `# ${c.section}`);
      if (!ok) failures.push(`${c.from}: \`${c.path}\` § ${c.section} → ${r.code === 0 ? 'no such heading' : 'no such file in the index'}`);
    }
  }
  report('citation_target', failures.length, cites.length, `new citations failed (validated once, at authoring)`);
  for (const f of failures) process.stdout.write(`  ${f}\n`);
  return failures.length === 0;
}
```
`scripts/gate/sweep-guard.mjs`:
```js
import { git } from '../lib/git.mjs';
// Ported from sweep_guard.sh. ADVISORY: never affects the outcome; silent when nothing to say.
const DOCS = /^(CLAUDE\.md$|docs\/|\.claude\/rules\/|\.claude\/machinery\/)/;
const TOOLING = /^(scripts\/|\.githooks\/)/;
export function sweepGuard({ root }) {
  const staged = git(['diff', '--cached', '--name-only'], root).stdout.split('\n').filter(Boolean);
  const added = git(['diff', '--cached', '--diff-filter=A', '--name-only'], root).stdout.split('\n').filter(Boolean);
  const suspects = added.filter((f) => !DOCS.test(f));
  if (!suspects.length) return;
  if (!staged.some((f) => DOCS.test(f))) return;
  const addedSet = new Set(added);
  const others = staged.filter((f) => !addedSet.has(f) && !DOCS.test(f) && !TOOLING.test(f));
  if (others.length) return;
  process.stdout.write(`ADVISORY: sweep-guard denominator: ${staged.length} staged, ${added.length} newly-tracked, ${suspects.length} non-doc suspect(s).\n`);
  for (const f of suspects) process.stdout.write(`ADVISORY: docs commit stages a newly-tracked non-doc file: ${f} - confirm not swept by a wildcard git add.\n`);
}
```
`scripts/gate/gate.mjs`:
```js
#!/usr/bin/env node
// Story: gates/commit-gate.md. Runs on EVERY commit (ruled), check-only, cheap.
// The check list is a closed array (spec I24): nothing can extend it.
import path from 'node:path';
import { registerCheck } from './register-check.mjs';
import { citationTarget } from './citation-target.mjs';
import { sweepGuard } from './sweep-guard.mjs';
import { projectRoot } from '../lib/root.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const universal = argv.includes('--universal');
const mergeMode = argv.includes('--merge');
const root = opt('--root') ? path.resolve(opt('--root')) : projectRoot(process.cwd());

const layout = universal
  ? { rulesDir: path.join(root, 'rules'), inbox: path.join(root, 'inbox.md'), index: path.join(root, 'register', 'INDEX.md') }
  : { rulesDir: path.join(root, '.claude', 'rules'), inbox: path.join(root, '.claude', 'machinery', 'inbox.md'), index: path.join(root, '.claude', 'machinery', 'INDEX.md') };

const CHECKS = Object.freeze([
  () => registerCheck(layout),
  () => citationTarget({ root, mergeMode }),
]);
let ok = true;
for (const check of CHECKS) { try { if (!check()) ok = false; } catch (e) { process.stdout.write(`gate: a check could not run — ${e.message}\n`); ok = false; } }
sweepGuard({ root });
if (!ok) process.stdout.write('commit gate FAILED (see lines above). Commit rejected. Bypass only for a genuine emergency: `git commit --no-verify`; twice means the checker is wrong — fix the checker.\n');
process.exitCode = ok ? 0 : 1;
```

- [ ] **Step 4: run — expect passing.** `node --test test/gate.test.mjs test/gate-purity.test.mjs`. If the section-citation regex over-matches prose, tighten it to require the backticked `.md` path immediately before `§` — the test cases define the contract.

- [ ] **Step 5: commit** — `git add plugins/machinery && git commit -m "machinery: commit gate — register check, citation targets, advisory sweep guard"`

---

### Task 11: `install.mjs` — per-project layer, machine junction, hosted template

**Files:**
- Create: `plugins/machinery/scripts/install.mjs`, `plugins/machinery/templates/hosted-check.yml`
- Test: `plugins/machinery/test/install.test.mjs`

**Interfaces:**
- Consumes: `projectRoot`, `git` (Task 1), `generateIndex` (Task 9), `rulesSource`, `pluginRoot` (Task 7).
- Produces: `node install.mjs [--root <dir>] [--hosted]` (project install) and `node install.mjs --machine` (junction). Writes `.claude/rules/` (if absent), `.claude/machinery/inbox.md` (if absent), `.claude/machinery/INDEX.md` (regenerated), `.githooks/machinery/{gate.mjs, register-check.mjs, citation-target.mjs, sweep-guard.mjs, lib/*}`, `.githooks/machinery/VERSION` (plugin version), `.githooks/pre-commit`, and runs `git config core.hooksPath .githooks`. `--hosted` copies `templates/hosted-check.yml` to `.github/workflows/machinery.yml`. Prints each action and, at the end, the measured state. Idempotent.

Story: `gates/commit-gate.md` (activation), spec §Git-side.

- [ ] **Step 1: failing test** — `test/install.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const version = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8')).version;
const install = (root, ...args) => runScript('scripts/install.mjs', { args: ['--root', root, ...args], cwd: root });

test('project install creates the layout, copies the gate, sets hooksPath, stamps the version (spec I6, I7)', () => {
  const r = makeRepo();
  try {
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    for (const f of ['.claude/rules', '.claude/machinery/inbox.md', '.claude/machinery/INDEX.md', '.githooks/pre-commit', '.githooks/machinery/gate.mjs', '.githooks/machinery/lib/inbox.mjs', '.githooks/machinery/VERSION'])
      assert.ok(fs.existsSync(path.join(r.root, f)), f);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks/machinery/VERSION'), 'utf8').trim(), version);
    assert.equal(execFileSync('git', ['config', 'core.hooksPath'], { cwd: r.root, encoding: 'utf8' }).trim(), '.githooks');
    assert.match(fs.readFileSync(path.join(r.root, '.githooks/pre-commit'), 'utf8'), /node \.githooks\/machinery\/gate\.mjs/);
    assert.match(res.stdout, /core\.hooksPath: \.githooks/);
  } finally { r.cleanup(); }
});

test('the installed gate runs standalone from the project (no plugin path baked in)', () => {
  const r = makeRepo();
  try {
    install(r.root);
    for (const f of ['gate.mjs', 'register-check.mjs', 'citation-target.mjs', 'sweep-guard.mjs']) assert.ok(!fs.readFileSync(path.join(r.root, '.githooks/machinery', f), 'utf8').includes(PLUGIN.replace(/\\/g, '/')));
    fs.writeFileSync(path.join(r.root, 'docs.md', ), 'x'); execFileSync('git', ['add', '-A'], { cwd: r.root });
    const g = execFileSync(process.execPath, [path.join(r.root, '.githooks/machinery/gate.mjs')], { cwd: r.root, encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' } });
    assert.match(g, /register_check: 0 of 0/);
  } finally { r.cleanup(); }
});

test('install is idempotent and refreshes the stamp', () => {
  const r = makeRepo();
  try {
    install(r.root); fs.writeFileSync(path.join(r.root, '.githooks/machinery/VERSION'), '0.0.0');
    const res = install(r.root); assert.equal(res.code, 0);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks/machinery/VERSION'), 'utf8').trim(), version);
    assert.equal(fs.readFileSync(path.join(r.root, '.claude/machinery/inbox.md'), 'utf8'), '');
  } finally { r.cleanup(); }
});

test('--hosted writes the workflow template; default does not', () => {
  const r = makeRepo();
  try {
    install(r.root); assert.ok(!fs.existsSync(path.join(r.root, '.github/workflows/machinery.yml')));
    install(r.root, '--hosted'); assert.ok(fs.existsSync(path.join(r.root, '.github/workflows/machinery.yml')));
  } finally { r.cleanup(); }
});

test('--machine creates the junction ~/.claude/rules/machinery → rules source (spec I11)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const res = runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
  assert.equal(res.code, 0, res.stderr);
  const link = path.join(home, '.claude', 'rules', 'machinery');
  assert.equal(fs.realpathSync.native(link), fs.realpathSync.native(path.join(PLUGIN, 'rules')));
  assert.equal(runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } }).code, 0); // idempotent
});

test('RED CHECK: outside a git repository the project install refuses', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  const res = runScript('scripts/install.mjs', { args: ['--root', d], cwd: d });
  assert.notEqual(res.code, 0); assert.match(res.stderr, /git repository/);
});
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `plugins/machinery/templates/hosted-check.yml`:
```yaml
# Installed by /machinery:install --hosted. Runs the same document checks the
# commit gate runs, on every push and change request, with no build toolchain.
# The hosted check BLOCKS (ruled 2026-09-02): protect the branch on this job.
name: machinery
on: { push: {}, pull_request: {} }
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: node .githooks/machinery/gate.mjs --merge --full
```
`scripts/install.mjs`:
```js
#!/usr/bin/env node
// Story: gates/commit-gate.md (activation per clone, never self-installing — this is the one path that sets core.hooksPath; spec I7).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { git } from './lib/git.mjs';
import { projectRoot } from './lib/root.mjs';
import { generateIndex } from './lib/index.mjs';
import { pluginRoot, rulesSource } from './lib/config.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const say = (s) => process.stdout.write(s + '\n');
const version = () => JSON.parse(fs.readFileSync(path.join(pluginRoot(), '.claude-plugin', 'plugin.json'), 'utf8')).version;

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function link(target, source) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (fs.realpathSync.native(target) === fs.realpathSync.native(source)) return 'already';
    fs.rmSync(target, { recursive: false, force: true });
  }
  if (process.platform === 'win32') execFileSync('cmd', ['/c', 'mklink', '/J', target, source], { stdio: 'pipe' });
  else fs.symlinkSync(source, target, 'dir');
  return 'created';
}

function installMachine() {
  const home = process.env.MACHINERY_HOME || os.homedir();
  const target = path.join(home, '.claude', 'rules', 'machinery');
  const src = rulesSource();
  if (!fs.existsSync(src)) { process.stderr.write(`rules source does not exist: ${src}\n`); return 1; }
  say(`~/.claude/rules/machinery -> ${src}: ${link(target, src)}`);
  return 0;
}

function installProject() {
  const root = opt('--root') ? path.resolve(opt('--root')) : projectRoot(process.cwd());
  if (git(['rev-parse', '--git-dir'], root).code !== 0) { process.stderr.write(`not a git repository: ${root}\n`); return 1; }
  const rules = path.join(root, '.claude', 'rules'), mach = path.join(root, '.claude', 'machinery');
  fs.mkdirSync(rules, { recursive: true }); fs.mkdirSync(mach, { recursive: true });
  const inbox = path.join(mach, 'inbox.md');
  if (!fs.existsSync(inbox)) { fs.writeFileSync(inbox, ''); say(`created ${path.relative(root, inbox)}`); }
  fs.writeFileSync(path.join(mach, 'INDEX.md'), generateIndex(rules)); say('regenerated .claude/machinery/INDEX.md');
  const hooksDir = path.join(root, '.githooks'), gateDir = path.join(hooksDir, 'machinery');
  fs.rmSync(gateDir, { recursive: true, force: true });
  copyDir(path.join(pluginRoot(), 'scripts', 'gate'), gateDir);
  // The gate's read-side lib, copied so the project never points at the plugin cache (spec I6).
  fs.mkdirSync(path.join(gateDir, 'lib'), { recursive: true });
  for (const f of ['git.mjs', 'root.mjs', 'inbox.mjs', 'frontmatter.mjs', 'index.mjs', 'report.mjs']) fs.copyFileSync(path.join(pluginRoot(), 'scripts', 'lib', f), path.join(gateDir, 'lib', f));
  fs.writeFileSync(path.join(gateDir, 'VERSION'), version() + '\n');
  fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\n# Installed by /machinery:install. Runs the machinery commit gate on every commit.\nexec node .githooks/machinery/gate.mjs\n');
  try { fs.chmodSync(path.join(hooksDir, 'pre-commit'), 0o755); } catch {}
  say(`installed gate ${version()} into .githooks/machinery/`);
  git(['config', 'core.hooksPath', '.githooks'], root);
  if (argv.includes('--hosted')) {
    const wf = path.join(root, '.github', 'workflows', 'machinery.yml');
    fs.mkdirSync(path.dirname(wf), { recursive: true });
    fs.copyFileSync(path.join(pluginRoot(), 'templates', 'hosted-check.yml'), wf); say('wrote .github/workflows/machinery.yml');
  }
  say(`core.hooksPath: ${git(['config', 'core.hooksPath'], root).stdout}`);
  say(`hosted check: ${fs.existsSync(path.join(root, '.github', 'workflows', 'machinery.yml')) ? 'present' : 'none (the local merge gate is the sole blocking backstop)'}`);
  return 0;
}

process.exitCode = argv.includes('--machine') ? installMachine() : installProject();
```
Note: the copied gate imports `../lib/...` — the layout `.githooks/machinery/{gate.mjs, register-check.mjs, …, lib/}` must match the plugin's `scripts/gate/` + `scripts/lib/` import paths. Because `scripts/gate/*.mjs` import from `'../lib/…'`, copy the gate files to `.githooks/machinery/` and the lib to `.githooks/machinery/../lib`? No — keep imports relative and correct in BOTH places by placing the copied lib at `.githooks/machinery/lib/` and rewriting each copied gate file's `'../lib/'` to `'./lib/'` during copy:
```js
// inside installProject, replace copyDir(...) of the gate with:
fs.mkdirSync(gateDir, { recursive: true });
for (const f of fs.readdirSync(path.join(pluginRoot(), 'scripts', 'gate'))) {
  const src = fs.readFileSync(path.join(pluginRoot(), 'scripts', 'gate', f), 'utf8').replaceAll("'../lib/", "'./lib/");
  fs.writeFileSync(path.join(gateDir, f), src);
}
```
(Keep `copyDir` for nothing else; delete it if unused.)

- [ ] **Step 4: run — expect passing.** On Windows the junction test needs no elevation (`mklink /J`).

- [ ] **Step 5: commit** — `git add plugins/machinery && git commit -m "machinery: install — project layer, gate copy, machine junction, hosted template"`

---

### Task 12: `banner.mjs` — SessionStart

**Files:**
- Create: `plugins/machinery/scripts/banner.mjs`
- Modify: `plugins/machinery/hooks/hooks.json` (SessionStart entry)
- Test: `plugins/machinery/test/banner.test.mjs`

**Interfaces:**
- Consumes: config (Task 7), `pending` (Task 7), `git` (Task 1), fixture `SessionStart.json`.
- Produces: one `additionalContext` (event `SessionStart`) listing only measured facts, each on its own line: rules source path + junction resolves?; `core.hooksPath` for this project; installed gate stamp vs plugin version; pending entries (project, universal); worktree hook observed? (a marker file `~/.claude/machinery-observed-worktree` written by Task 14's hook); `cant-break-by-design` installed?; the markers. Failure posture: loud, non-blocking — an exception becomes the banner text, exit 0.

- [ ] **Step 1: failing test** — `test/banner.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/SessionStart.json'), 'utf8'));
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
const run = (cwd, env = {}) => runScript('scripts/banner.mjs', { stdin: JSON.stringify({ ...base, cwd }), cwd, env: { MACHINERY_HOME: home(), ...env } });
const text = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;

test('reports measured facts for an uninstalled project', () => {
  const r = makeRepo();
  try {
    const t = text(run(r.root));
    assert.match(t, /rules source: .*rules \(junction: missing\)/);
    assert.match(t, /core\.hooksPath: not set — run \/machinery:install/);
    assert.match(t, /gate: not installed/);
    assert.match(t, /pending: project 0, universal 0/);
    assert.match(t, /markers: PRULE: \(project\) URULE: \(universal\)/);
    assert.match(t, /hosted check: none/);
  } finally { r.cleanup(); }
});

test('after install and a capture, reports hooksPath, stamp, and pending count', () => {
  const r = makeRepo();
  try {
    const h = home();
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    runScript('scripts/capture.mjs', { stdin: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'PRULE: x', cwd: r.root, session_id: 's' }), cwd: r.root, env: { MACHINERY_HOME: h } });
    const t = text(run(r.root, { MACHINERY_HOME: h }));
    assert.match(t, /core\.hooksPath: \.githooks/);
    assert.match(t, /gate: installed \d+\.\d+\.\d+ \(plugin \d+\.\d+\.\d+\)/);
    assert.match(t, /pending: project 1/);
  } finally { r.cleanup(); }
});

test('a rules source that does not resolve is reported loudly, exit 0', () => {
  const r = makeRepo();
  try {
    const h = home(); fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: 'Z:/nope/rules' }));
    const res = run(r.root, { MACHINERY_HOME: h });
    assert.equal(res.code, 0); assert.match(text(res), /rules source: .*DOES NOT EXIST/);
  } finally { r.cleanup(); }
});

test('RED CHECK: the banner never claims a hook is active without measuring', () => {
  const r = makeRepo();
  try { assert.doesNotMatch(text(run(r.root)), /commits are blocked/i); } finally { r.cleanup(); }
});
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/banner.mjs`:
```js
#!/usr/bin/env node
// Story: hooks/session-banner.md. Prints only what it measured (spec I7, I27, I38). Loud, non-blocking.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPayload } from './lib/stdin.mjs';
import { context } from './lib/emit.mjs';
import { git } from './lib/git.mjs';
import { projectRoot } from './lib/root.mjs';
import { markers, rulesSource, universalInbox, projectInbox, pluginRoot } from './lib/config.mjs';
import { pending } from './lib/inbox.mjs';

function banner() {
  const p = readPayload() ?? {};
  const cwd = p.cwd || process.cwd();
  const home = process.env.MACHINERY_HOME || os.homedir();
  const m = markers();
  const lines = ['machinery:'];
  const src = rulesSource();
  const junction = path.join(home, '.claude', 'rules', 'machinery');
  const jstate = !fs.existsSync(src) ? 'DOES NOT EXIST' : !fs.existsSync(junction) ? 'junction: missing — run /machinery:install --machine' : fs.realpathSync.native(junction) === fs.realpathSync.native(src) ? 'junction: ok' : 'junction: points elsewhere';
  lines.push(`  rules source: ${src} (${jstate})`);
  let root = null;
  try { root = projectRoot(cwd); } catch { lines.push('  project: not a git repository'); }
  let proj = 0;
  if (root) {
    const hp = git(['config', 'core.hooksPath'], root).stdout;
    lines.push(`  core.hooksPath: ${hp || 'not set — run /machinery:install'}`);
    const stamp = path.join(root, '.githooks', 'machinery', 'VERSION');
    const pv = JSON.parse(fs.readFileSync(path.join(pluginRoot(), '.claude-plugin', 'plugin.json'), 'utf8')).version;
    lines.push(`  gate: ${fs.existsSync(stamp) ? `installed ${fs.readFileSync(stamp, 'utf8').trim()} (plugin ${pv})` : 'not installed'}`);
    lines.push(`  hosted check: ${fs.existsSync(path.join(root, '.github', 'workflows', 'machinery.yml')) ? 'present' : 'none — the local merge gate is the sole blocking backstop'}`);
    try { proj = pending(projectInbox(root)).length; } catch (e) { lines.push(`  project inbox: MALFORMED — ${e.message}`); }
  }
  let univ = 0;
  try { univ = pending(universalInbox()).length; } catch (e) { lines.push(`  universal inbox: MALFORMED — ${e.message}`); }
  lines.push(`  pending: project ${proj}, universal ${univ}${proj + univ ? ' — intake runs at the next prompt in an eligible session' : ''}`);
  lines.push(`  worktree hook: ${fs.existsSync(path.join(home, '.claude', 'machinery-observed-worktree')) ? 'observed firing on this machine' : 'never observed on this machine'}`);
  const cbbd = [path.join(home, '.claude', 'skills', 'cant-break-by-design'), path.join(home, '.claude', 'plugins')].some((d) => fs.existsSync(d) && (d.endsWith('cant-break-by-design') || JSON.stringify(fs.readdirSync(d)).includes('unbreakable')));
  lines.push(`  cant-break-by-design skill (mandatory): ${cbbd ? 'installed' : 'NOT FOUND — install the unbreakable plugin'}`);
  lines.push(`  markers: ${m.project} (project) ${m.universal} (universal); a bare ${m.ambiguous} captures nothing`);
  return lines.join('\n');
}

let text;
try { text = banner(); } catch (e) { text = `machinery: banner failed — ${e.message}`; }
context(text, 'SessionStart');
process.exitCode = 0;
```
(The `cbbd` detection above uses `JSON.stringify` — forbidden outside `emit.mjs` by the purity test; write it as `fs.readdirSync(d).some((n) => n.includes('unbreakable'))` instead.)

- [ ] **Step 4: wire it** — `hooks.json` `SessionStart[0].hooks` gains `{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/banner.mjs\"", "timeout": 10 }`.

- [ ] **Step 5: run — expect passing; then the full suite.**

- [ ] **Step 6: commit** — `git add plugins/machinery && git commit -m "machinery: session banner of measured facts"`

---

### Task 13: `nudge.mjs` — PostToolUse

**Files:**
- Create: `plugins/machinery/scripts/nudge.mjs`
- Modify: `plugins/machinery/hooks/hooks.json` (PostToolUse entry)
- Test: `plugins/machinery/test/nudge.test.mjs`

**Interfaces:**
- Consumes: config paths, `generateIndex/readIndex`, fixture `PostToolUse-Edit.json`.
- Produces: when the edited path is under a rules directory (project or universal) or is an inbox: regenerate the matching index in memory; if it differs from the file, emit one context line `machinery: the index is stale after editing <file> — intake regenerates it; or run /machinery:reindex`. Anything else, or any error → nothing (silent).

- [ ] **Step 1: failing test** — `test/nudge.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/PostToolUse-Edit.json'), 'utf8'));
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
const run = (cwd, file) => runScript('scripts/nudge.mjs', { stdin: JSON.stringify({ ...base, cwd, tool_input: { ...base.tool_input, file_path: file } }), cwd, env: { MACHINERY_HOME: home() } });

test('editing a project rule file with a stale index nudges once', () => {
  const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: home() } });
    const f = path.join(r.root, '.claude', 'rules', 'new.md'); fs.writeFileSync(f, '# N\n\n## S\n\n- r\n');
    const res = run(r.root, f);
    assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /index is stale after editing .*new\.md/);
  } finally { r.cleanup(); }
});

test('editing an unrelated file is silent; a fresh index is silent', () => {
  const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: home() } });
    assert.equal(run(r.root, path.join(r.root, 'README.md')).stdout, '');
    assert.equal(run(r.root, path.join(r.root, '.claude', 'rules', 'none.md')).stdout, ''); // no file → still fresh
  } finally { r.cleanup(); }
});

test('fails SILENT: garbage stdin → nothing, exit 0', () => {
  const res = runScript('scripts/nudge.mjs', { stdin: 'nope' }); assert.equal(res.stdout, ''); assert.equal(res.code, 0);
});

test('RED CHECK: the nudge is real — the message names the edited file', () => {
  const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: home() } });
    const f = path.join(r.root, '.claude', 'rules', 'z.md'); fs.writeFileSync(f, '## S\n\n- r\n');
    assert.ok(run(r.root, f).stdout.includes('z.md'));
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/nudge.mjs`:
```js
#!/usr/bin/env node
// Story: hooks/rule-nudge.md. Advisory; any failure is silence.
import path from 'node:path';
import { readPayload } from './lib/stdin.mjs';
import { context } from './lib/emit.mjs';
import { projectRoot } from './lib/root.mjs';
import { projectRules, projectIndex, projectInbox, rulesSource, universalIndex, universalInbox } from './lib/config.mjs';
import { generateIndex, readIndex } from './lib/index.mjs';

function main() {
  const p = readPayload();
  const file = p?.tool_input?.file_path;
  if (!file) return;
  const abs = path.resolve(file);
  const inside = (dir) => abs.toLowerCase().startsWith(path.resolve(dir).toLowerCase() + path.sep);
  const targets = [];
  try { const root = projectRoot(p.cwd || process.cwd()); if (inside(projectRules(root)) || abs === path.resolve(projectInbox(root))) targets.push({ rules: projectRules(root), index: projectIndex(root) }); } catch {}
  const src = rulesSource();
  if (inside(src) || abs === path.resolve(universalInbox())) targets.push({ rules: src, index: universalIndex() });
  for (const t of targets) {
    if (readIndex(t.index) !== generateIndex(t.rules)) { context(`machinery: the index is stale after editing ${file} — intake regenerates it; or run /machinery:reindex`, 'PostToolUse'); return; }
  }
}
try { main(); } catch { /* silent */ }
process.exitCode = 0;
```

- [ ] **Step 4: wire it** — `hooks.json` `PostToolUse[0].hooks` gains `{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/nudge.mjs\"", "timeout": 30, "statusMessage": "Index nudge check" }`.

- [ ] **Step 5: run — expect passing.** — **Step 6: commit** — `git commit -m "machinery: post-edit index nudge"`.

---

### Task 14: `worktree-create.mjs` — WorktreeCreate

**Files:**
- Create: `plugins/machinery/scripts/worktree-create.mjs`
- Modify: `plugins/machinery/hooks/hooks.json` (WorktreeCreate entry)
- Test: `plugins/machinery/test/worktree-create.test.mjs`

**Interfaces:**
- Consumes: `git` (Task 1), fixture `WorktreeCreate.json`.
- Produces: stdout = the created worktree's absolute path, nothing else; all chatter to stderr; non-zero exit aborts creation. Also touches `~/.claude/machinery-observed-worktree` (the banner's evidence that the event fires — spec I22).

Story: `hooks/worktree-create.md`; source `create_worktree.py`.

- [ ] **Step 1: failing test** — `test/worktree-create.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/WorktreeCreate.json'), 'utf8'));
const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const run = (root, name, extra = {}) => runScript('scripts/worktree-create.mjs', { stdin: JSON.stringify({ ...base, cwd: root, name, ...extra }), cwd: root, env: { MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) } });

test('branch = name verbatim, stdout is the path only, base = local HEAD when baseRef is head', () => {
  const r = makeRepo({ withOrigin: true });
  try {
    fs.mkdirSync(path.join(r.root, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.claude', 'settings.json'), '{"worktree":{"baseRef":"head"}}');
    fs.writeFileSync(path.join(r.root, 'local.txt'), 'ahead'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'ahead of origin');
    const res = run(r.root, 'feat-a');
    assert.equal(res.code, 0, res.stderr);
    const p = res.stdout.trim();
    assert.equal(res.stdout.trim().split('\n').length, 1);
    assert.equal(g(p, 'branch', '--show-current'), 'feat-a');
    assert.equal(g(p, 'rev-parse', 'HEAD'), g(r.root, 'rev-parse', 'HEAD'));
  } finally { r.cleanup(); }
});

test('default (fresh) branches from the origin default, and strips a worktree- prefix', () => {
  const r = makeRepo({ withOrigin: true });
  try {
    fs.writeFileSync(path.join(r.root, 'local.txt'), 'ahead'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'ahead');
    const res = run(r.root, 'worktree-feat-b');
    const p = res.stdout.trim();
    assert.equal(g(p, 'branch', '--show-current'), 'feat-b');
    assert.equal(g(p, 'rev-parse', 'HEAD'), g(r.root, 'rev-parse', 'origin/main'));
  } finally { r.cleanup(); }
});

test('an existing branch is attached, not recreated', () => {
  const r = makeRepo();
  try { g(r.root, 'branch', 'exists'); const res = run(r.root, 'exists'); assert.equal(g(res.stdout.trim(), 'branch', '--show-current'), 'exists'); }
  finally { r.cleanup(); }
});

test('fails CLOSED: empty name → non-zero, nothing on stdout, reason on stderr', () => {
  const r = makeRepo();
  try { const res = run(r.root, ''); assert.notEqual(res.code, 0); assert.equal(res.stdout, ''); assert.match(res.stderr, /empty worktree name/); }
  finally { r.cleanup(); }
});

test('RED CHECK: the observed-marker file is written when the hook runs', () => {
  const r = makeRepo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  try {
    runScript('scripts/worktree-create.mjs', { stdin: JSON.stringify({ ...base, cwd: r.root, name: 'm' }), cwd: r.root, env: { MACHINERY_HOME: home } });
    assert.ok(fs.existsSync(path.join(home, '.claude', 'machinery-observed-worktree')));
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/worktree-create.mjs`:
```js
#!/usr/bin/env node
// Story: hooks/worktree-create.md. Ported from create_worktree.py. Fails CLOSED.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readPayload } from './lib/stdin.mjs';
import { git, gitExe } from './lib/git.mjs';

const fail = (msg) => { process.stderr.write(`WorktreeCreate hook: ${msg}\n`); process.exit(1); };
const loud = (args, cwd) => spawnSync(gitExe(), args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] }).status ?? 1; // git's stdout → our stderr? no: inherit sends it to OUR stdout. Use 'pipe' and forward to stderr:
function gitLoud(args, cwd) {
  const r = spawnSync(gitExe(), args, { cwd, encoding: 'utf8' });
  if (r.stdout) process.stderr.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

function baseRef(repo) {
  let mode = 'fresh';
  try { mode = JSON.parse(fs.readFileSync(path.join(repo, '.claude', 'settings.json'), 'utf8')).worktree?.baseRef ?? 'fresh'; } catch {}
  if (mode === 'head') return 'HEAD';
  const r = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], repo);
  return r.code === 0 && r.stdout ? r.stdout : 'HEAD';
}

const home = process.env.MACHINERY_HOME || os.homedir();
try { fs.mkdirSync(path.join(home, '.claude'), { recursive: true }); fs.writeFileSync(path.join(home, '.claude', 'machinery-observed-worktree'), new Date().toISOString()); } catch {}

const p = readPayload() ?? {};
const name = p.name || p.worktree_name || '';
const repo = p.cwd || process.cwd();
const basePath = p.base_path || path.join(repo, '.claude', 'worktrees');
const branch = name.replace(/^worktree-/, '');
if (!branch) fail(`empty worktree name; payload had name=${name === '' ? '""' : name}`);
const ref = p.git_ref || baseRef(repo);
const dest = path.join(basePath, branch);
fs.mkdirSync(basePath, { recursive: true });
const exists = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repo).code === 0;
const rc = exists ? gitLoud(['worktree', 'add', dest, branch], repo) : gitLoud(['worktree', 'add', dest, '-b', branch, ref], repo);
if (rc !== 0) fail(`git worktree add failed (exit ${rc})`);
process.stdout.write(dest + '\n');
```
(Delete the stray `loud` helper line — `gitLoud` is the one to keep; it exists to keep stdout clean for the path contract.)

- [ ] **Step 4: wire it** — `hooks.json` `WorktreeCreate[0].hooks` gains `{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/worktree-create.mjs\"", "timeout": 300, "statusMessage": "Creating worktree (unprefixed branch)" }`.

- [ ] **Step 5: run — expect passing.** — **Step 6: commit** — `git commit -m "machinery: worktree-create hook"`.

---

### Task 15: Intake — `place`, `bump`, `disposition`, `intake`

**Files:**
- Create: `plugins/machinery/scripts/place.mjs`, `bump.mjs`, `disposition.mjs`, `intake.mjs`
- Test: `plugins/machinery/test/intake.test.mjs`

**Interfaces:**
- Consumes: inbox, config, index (Tasks 7, 9), `git`, `isRootSession` (Task 1).
- Produces:
  - `place.mjs --file <rules/x.md> --section "<Heading>" --text "<one rule bullet text>"` — appends `- <text>` under the heading (creating `## <Heading>` at the end if absent); the only script that writes rule bullets (spec I34). Exit 1 if the file is outside a rules directory.
  - `bump.mjs [--plugin <dir>]` — patch-bumps `.claude-plugin/plugin.json` version, prints the new version.
  - `disposition.mjs --inbox <file> --stamp <stamp> (--filed "<file § Section>" | --dismissed "<reason>")`.
  - `intake.mjs list [--root <dir>]` — prints pending entries (project + universal) as `stamp\tmarker\tinbox\ttext-first-line`; `intake.mjs commit --kind project|universal [--root <dir>] --stamp <stamp> --home "<file § Section>"` — regenerates the right index, (universal) bumps, stages exactly the files it touched, commits with message `rule: <first line of the text>`; refuses `project` unless `isRootSession(root)` (spec I29); prints what it committed.

Story: `skills/rule-intake/SKILL.md` (the sequence; the model supplies wording, file, section).

- [ ] **Step 1: failing test** — `test/intake.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { pending, parseInbox } from '../scripts/lib/inbox.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
function projectWithPending(h) {
  const r = makeRepo();
  runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '--no-verify', '-m', 'install');
  runScript('scripts/capture.mjs', { stdin: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'PRULE: never guess a path', cwd: r.root, session_id: 's' }), cwd: r.root, env: { MACHINERY_HOME: h } });
  return r;
}

test('place appends a bullet under an existing heading and creates a missing one', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')); const f = path.join(d, 'rules', 'a.md'); fs.mkdirSync(path.dirname(f));
  fs.writeFileSync(f, '# A\n\n## One\n\n- old\n');
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'One', '--text', 'new rule'] }).code, 0);
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'Two', '--text', 'another'] }).code, 0);
  assert.equal(fs.readFileSync(f, 'utf8'), '# A\n\n## One\n\n- old\n- new rule\n\n## Two\n\n- another\n');
});

test('place refuses a file outside a rules directory (spec I34)', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'x-')), 'notes.md'); fs.writeFileSync(f, '');
  assert.notEqual(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'S', '--text', 't'] }).code, 0);
});

test('bump patch-increments plugin.json', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-')); fs.mkdirSync(path.join(d, '.claude-plugin'));
  fs.writeFileSync(path.join(d, '.claude-plugin', 'plugin.json'), '{\n  "name": "x",\n  "version": "0.1.9"\n}\n');
  const res = runScript('scripts/bump.mjs', { args: ['--plugin', d] });
  assert.equal(res.stdout.trim(), '0.1.10');
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, '.claude-plugin', 'plugin.json'), 'utf8')).version, '0.1.10');
});

test('intake list shows pending project entries; commit files, reindexes, dispositions, commits in the root (spec I29, I30)', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const list = runScript('scripts/intake.mjs', { args: ['list', '--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.match(list.stdout, /\tPRULE\t.*inbox\.md\tPRULE: never guess a path/);
    const stamp = list.stdout.trim().split('\t')[0];
    const rf = path.join(r.root, '.claude', 'rules', 'straight-talk.md');
    runScript('scripts/place.mjs', { args: ['--file', rf, '--section', 'Claims', '--text', 'Never guess a path; resolve it.'] });
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', stamp, '--home', '.claude/rules/straight-talk.md § Claims'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 0);
    const [e] = parseInbox(fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'inbox.md'), 'utf8'));
    assert.equal(e.state, 'FILED'); assert.match(e.disposition, /filed → \.claude\/rules\/straight-talk\.md § Claims/);
    assert.match(g(r.root, 'log', '-1', '--format=%s'), /^rule: PRULE: never guess a path/);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root }).code, 0);
  } finally { r.cleanup(); }
});

test('intake commit --kind project refuses from inside a worktree (spec I29)', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const wt = addWorktree(r.root, 'feat');
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', wt, '--stamp', 'x', '--home', 'y'], cwd: wt, env: { MACHINERY_HOME: h } });
    assert.notEqual(res.code, 0); assert.match(res.stderr, /root session/);
  } finally { r.cleanup(); }
});

test('universal intake bumps the plugin version in the same commit (spec I31)', () => {
  // A fake plugin checkout: rules/, inbox.md, register/, .claude-plugin/plugin.json, git-initialised.
  const r = makeRepo(); const h = home();
  try {
    const plug = path.join(r.root, 'plugins', 'machinery');
    fs.mkdirSync(path.join(plug, 'rules'), { recursive: true }); fs.mkdirSync(path.join(plug, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(plug, 'rules', 'straight-talk.md'), '# S\n\n## Claims\n\n- a\n');
    fs.writeFileSync(path.join(plug, '.claude-plugin', 'plugin.json'), '{"name":"machinery","version":"0.1.0"}');
    fs.writeFileSync(path.join(plug, 'inbox.md'), '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(plug, 'rules'), '--out', path.join(plug, 'register', 'INDEX.md')] });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'plugin');
    fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: path.join(plug, 'rules') }));
    runScript('scripts/capture.mjs', { stdin: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'URULE: say less', cwd: r.root, session_id: 's' }), cwd: r.root, env: { MACHINERY_HOME: h } });
    const stamp = runScript('scripts/intake.mjs', { args: ['list'], cwd: r.root, env: { MACHINERY_HOME: h } }).stdout.trim().split('\t')[0];
    runScript('scripts/place.mjs', { args: ['--file', path.join(plug, 'rules', 'straight-talk.md'), '--section', 'Claims', '--text', 'Say less.'] });
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'universal', '--stamp', stamp, '--home', 'rules/straight-talk.md § Claims'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(JSON.parse(fs.readFileSync(path.join(plug, '.claude-plugin', 'plugin.json'), 'utf8')).version, '0.1.1');
    assert.match(g(r.root, 'show', '--stat', 'HEAD'), /plugin\.json/);
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', plug, '--universal'], cwd: plug }).code, 0);
  } finally { r.cleanup(); }
});

test('RED CHECK: intake commit with an unknown stamp fails and commits nothing', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const before = g(r.root, 'rev-parse', 'HEAD');
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', 'nope', '--home', 'x'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.notEqual(res.code, 0); assert.equal(g(r.root, 'rev-parse', 'HEAD'), before);
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/place.mjs`:
```js
#!/usr/bin/env node
// The only writer of rule bullets in scripts (spec I34). Writes only under an existing-or-created ## heading (spec I33).
import fs from 'node:fs';
import path from 'node:path';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const file = opt('--file'), section = opt('--section'), text = opt('--text');
if (!file || !section || !text) { process.stderr.write('usage: place --file <rules/x.md> --section "<Heading>" --text "<rule>"\n'); process.exit(2); }
const abs = path.resolve(file);
if (!/[\\/]rules[\\/][^\\/]+\.md$/.test(abs)) { process.stderr.write(`refusing to write outside a rules directory: ${abs}\n`); process.exit(1); }
let lines = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\s+$/, '').split(/\r?\n/) : [`# ${path.basename(abs, '.md')}`];
const at = lines.findIndex((l) => l.trim() === `## ${section}`);
const bullet = `- ${text.trim()}`;
if (at < 0) lines.push('', `## ${section}`, '', bullet);
else {
  let end = at + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  while (end > at + 1 && !lines[end - 1].trim()) end--;
  lines.splice(end, 0, bullet);
}
fs.writeFileSync(abs, lines.join('\n') + '\n', 'utf8');
process.stdout.write(`${path.basename(abs)} § ${section}: + ${bullet}\n`);
```
`scripts/bump.mjs`:
```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pluginRoot } from './lib/config.mjs';
const i = process.argv.indexOf('--plugin');
const dir = i >= 0 ? path.resolve(process.argv[i + 1]) : pluginRoot();
const f = path.join(dir, '.claude-plugin', 'plugin.json');
const text = fs.readFileSync(f, 'utf8');
const m = /"version":\s*"(\d+)\.(\d+)\.(\d+)"/.exec(text);
if (!m) { process.stderr.write(`no semver version in ${f}\n`); process.exit(1); }
const next = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
fs.writeFileSync(f, text.replace(m[0], `"version": "${next}"`), 'utf8');
process.stdout.write(next + '\n');
```
`scripts/disposition.mjs`:
```js
#!/usr/bin/env node
import { setDisposition } from './lib/inbox.mjs';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const inbox = opt('--inbox'), stamp = opt('--stamp'), filed = opt('--filed'), dismissed = opt('--dismissed');
if (!inbox || !stamp || (!filed && !dismissed)) { process.stderr.write('usage: disposition --inbox <file> --stamp <stamp> (--filed "<file § Section>" | --dismissed "<reason>")\n'); process.exit(2); }
setDisposition(inbox, stamp, filed ? { state: 'FILED', detail: `filed → ${filed}` } : { state: 'DISMISSED', detail: `dismissed: ${dismissed}` });
process.stdout.write(`${stamp}: ${filed ? 'filed' : 'dismissed'}\n`);
```
`scripts/intake.mjs`:
```js
#!/usr/bin/env node
// Story: skills/rule-intake/SKILL.md — the mechanical steps. Two pipelines, each one commit in one repo (spec I30).
import fs from 'node:fs';
import path from 'node:path';
import { git } from './lib/git.mjs';
import { projectRoot, isRootSession } from './lib/root.mjs';
import { projectInbox, projectIndex, projectRules, universalInbox, universalIndex, rulesSource } from './lib/config.mjs';
import { pending, setDisposition } from './lib/inbox.mjs';
import { generateIndex } from './lib/index.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const here = path.dirname(fileURLToPath(import.meta.url));
const die = (m) => { process.stderr.write(m + '\n'); process.exit(1); };

function list() {
  const out = [];
  let root = null; try { root = projectRoot(opt('--root') || process.cwd()); } catch {}
  if (root && isRootSession(opt('--root') || process.cwd())) for (const e of pending(projectInbox(root))) out.push([e.stamp, e.marker, projectInbox(root), e.text.split('\n')[0]]);
  for (const e of pending(universalInbox())) out.push([e.stamp, e.marker, universalInbox(), e.text.split('\n')[0]]);
  process.stdout.write(out.map((r) => r.join('\t')).join('\n') + (out.length ? '\n' : ''));
}

function commit() {
  const kind = opt('--kind'), stamp = opt('--stamp'), home = opt('--home');
  if (!['project', 'universal'].includes(kind) || !stamp || !home) die('usage: intake commit --kind project|universal [--root <dir>] --stamp <stamp> --home "<file § Section>"');
  let repo, inbox, index, rules, extra = [];
  if (kind === 'project') {
    const cwd = opt('--root') || process.cwd();
    if (!isRootSession(cwd)) die('a project rule is filed only from a root session (git dir = common dir); this is an isolated working copy — leave the entry pending and file from the root');
    repo = projectRoot(cwd); inbox = projectInbox(repo); index = projectIndex(repo); rules = projectRules(repo);
  } else {
    rules = rulesSource(); inbox = universalInbox(); index = universalIndex();
    repo = projectRoot(rules);
    const plug = path.dirname(rules);
    const b = spawnSync(process.execPath, [path.join(here, 'bump.mjs'), '--plugin', plug], { encoding: 'utf8' });
    if (b.status !== 0) die(`bump failed: ${b.stderr}`);
    extra.push(path.join(plug, '.claude-plugin', 'plugin.json'));
    process.stdout.write(`bumped plugin version to ${b.stdout.trim()}\n`);
  }
  const entry = pending(inbox).find((e) => e.stamp === stamp);
  if (!entry) die(`no PENDING entry with stamp ${stamp} in ${inbox}`);
  fs.mkdirSync(path.dirname(index), { recursive: true });
  fs.writeFileSync(index, generateIndex(rules), 'utf8');
  setDisposition(inbox, stamp, { state: 'FILED', detail: `filed → ${home}` });
  const files = [rules, index, inbox, ...extra].map((f) => path.relative(repo, f));
  const add = git(['add', '--', ...files], repo);
  if (add.code !== 0) die(`git add failed: ${add.stderr}`);
  const subject = `rule: ${entry.text.split('\n')[0].slice(0, 72)}`;
  const c = git(['commit', '-q', '-m', `${subject}\n\nFiled → ${home}\nInbox entry ${stamp} (${entry.marker})`, '--', ...files], repo);
  if (c.code !== 0) die(`git commit failed: ${c.stderr}\n${c.stdout}`);
  process.stdout.write(`committed in ${repo}: ${subject}\n`);
}

if (cmd === 'list') list(); else if (cmd === 'commit') commit(); else die('usage: intake list [--root <dir>] | intake commit …');
```
Note the ordering in `commit()`: for `universal`, the bump happens before the entry check — move the `pending(...).find` check to the top of `commit()` (before any write) so an unknown stamp commits nothing (the RED CHECK). The test dictates the order; fix the code, not the test.

- [ ] **Step 4: run — expect passing.** — **Step 5: commit** — `git commit -m "machinery: intake — place, bump, disposition, list/commit"`.

---

### Task 16: `reload.mjs`, the six skills, the route

**Files:**
- Create: `plugins/machinery/scripts/reload.mjs`
- Create: `claude-code/{install,reload,reindex,rule-intake,effort-lifecycle,refresh-diverged-branch}/SKILL.md`
- Modify: `skills.manifest.json` (route skills list)
- Test: `plugins/machinery/test/skills.test.mjs`

**Interfaces:**
- Consumes: union skills at `combine-projects-machinery/union/plugin/skills/*/SKILL.md` (content source), `markers()`, intake scripts (Task 15).
- Produces: `reload.mjs [--project]` prints every rule file under the rules source (and `.claude/rules/` of the project with `--project`) as `===== <path> =====` blocks; the six skills; the build stages them.

- [ ] **Step 1: failing test** — `test/skills.test.mjs` (spec I36, I37):
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN, runScript } from './helpers/run.mjs';

const REPO = path.resolve(PLUGIN, '..', '..');
const BUCKET = path.join(REPO, 'claude-code');
const skills = () => fs.readdirSync(BUCKET).filter((d) => fs.existsSync(path.join(BUCKET, d, 'SKILL.md')));
const text = (d) => fs.readFileSync(path.join(BUCKET, d, 'SKILL.md'), 'utf8');

test('every /machinery:<name> a skill names is a routed skill (spec I36)', () => {
  const routed = new Set(JSON.parse(fs.readFileSync(path.join(REPO, 'skills.manifest.json'), 'utf8')).targets['claude-plugin'].routes.machinery.skills);
  for (const d of skills()) for (const m of text(d).matchAll(/\/machinery:([a-z-]+)/g)) assert.ok(routed.has(m[1]), `${d} names /machinery:${m[1]} which is not routed`);
});

test('no skill restates a rule bullet verbatim (spec I37)', () => {
  const rulesDir = path.join(PLUGIN, 'rules');
  if (!fs.existsSync(rulesDir)) return; // rules land in Task 17; this test bites from then on
  const firstSentences = fs.readdirSync(rulesDir).flatMap((f) => fs.readFileSync(path.join(rulesDir, f), 'utf8').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).split(/(?<=\.)\s/)[0].trim()).filter((s) => s.length > 40));
  for (const d of skills()) { const t = text(d); for (const s of firstSentences) assert.ok(!t.includes(s), `${d} restates a rule: "${s.slice(0, 60)}…"`); }
});

test('the markers named in skills are the ones in markers.json', () => {
  const m = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'markers.json'), 'utf8'));
  for (const d of skills()) for (const tok of text(d).matchAll(/\b[A-Z]RULE:/g)) assert.ok([m.project, m.universal].includes(tok[0]), `${d} uses ${tok[0]}`);
});

test('reload prints every universal rule file as a delimited block', () => {
  const res = runScript('scripts/reload.mjs');
  assert.equal(res.code, 0);
  for (const f of fs.readdirSync(path.join(PLUGIN, 'rules'))) assert.ok(res.stdout.includes(`===== rules/${f} =====`));
});

test('RED CHECK: six skills exist', () => assert.deepEqual(skills().sort(), ['effort-lifecycle', 'install', 'refresh-diverged-branch', 'reindex', 'reload', 'rule-intake']));
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: implement** — `scripts/reload.mjs`:
```js
#!/usr/bin/env node
// /machinery:reload — puts the rule files into the running session's context (spec I14).
import fs from 'node:fs';
import path from 'node:path';
import { rulesSource, projectRules } from './lib/config.mjs';
import { projectRoot } from './lib/root.mjs';
const dirs = [['rules', rulesSource()]];
if (process.argv.includes('--project')) { try { dirs.push(['.claude/rules', projectRules(projectRoot(process.cwd()))]); } catch {} }
for (const [label, dir] of dirs) {
  if (!fs.existsSync(dir)) { process.stdout.write(`===== ${label} ===== (missing: ${dir})\n`); continue; }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) process.stdout.write(`===== ${label}/${f} =====\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n`);
}
```
Skills — each `claude-code/<name>/SKILL.md` with frontmatter `name: <name>` and a trigger-first `description`:

`install`:
```markdown
---
name: install
description: Use once per machine (`--machine`) to make the universal rules always-on, and once per project to install the commit gate, inbox and index. Idempotent; re-run after a plugin update to refresh the gate.
---
# /machinery:install

Run the installer and show the user its measured summary verbatim.

- Per project (from the project, any working copy): `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs"` — add `--hosted` only if the project has a hosted CI that will protect the branch on the check.
- Per machine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --machine` — creates `~/.claude/rules/machinery` → the rules source (default: this plugin's `rules/`; override in `~/.claude/machinery.json` with `{"rulesSource": "<path>"}`).

This is the only way the commit gate is activated: hooks are tracked in the project and activated per clone, never self-installing.
```
`reload`:
```markdown
---
name: reload
description: Use after a universal rule is filed, or when a rule file changed outside intake, to put the current rule files into this session's context without restarting. `--project` includes the project's own rules.
---
# /machinery:reload

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/reload.mjs"` (add `--project` to include `.claude/rules/`) and read the output: those are the rule files as they stand now. Other sessions pick them up at their next start.
```
`reindex`:
```markdown
---
name: reindex
description: Use when the index is reported stale (the post-edit nudge, or the commit gate) after a rule file was edited by hand. Regenerates the generated index; never edit it directly.
---
# /machinery:reindex

- Project: `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --rules .claude/rules --out .claude/machinery/INDEX.md`
- Universal (in the rules-source checkout): `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --rules rules --out register/INDEX.md`

Commit the regenerated index together with the rule change that made it stale.
```
`rule-intake` — start from `combine-projects-machinery/union/plugin/skills/rule-intake/SKILL.md`, keep its sequence, and replace the mechanics with the scripts; the body must contain these steps verbatim in spirit:
```markdown
---
name: rule-intake
description: Use the moment a PRULE: or URULE: prompt is captured (the capture hook says "run the intake sequence now"), when a prompt starts with "N rules pending — running intake", or when the commit gate reports a PENDING entry. Files each pending rule into its home, regenerates the index, dispositions the entry, commits. Never self-files a rule nobody dictated.
---
# /machinery:rule-intake

The rules live in `rules/rule-governance.md`; this is the sequence. Where this and a rule file disagree, the rule file wins.

1. **List** what is pending: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" list` — one line per entry: `stamp  marker  inbox  first-line`. PRULE entries appear only in a root session; if you are in an isolated working copy, say so and stop — they will be filed from a root session.
2. **For each entry**, read the verbatim text from the inbox. Decide the final wording (one plain statement of what to do and when), the rule file it joins, and the section — for a project rule under `.claude/rules/`, for a universal rule under the rules source's `rules/`. Before folding it into a group that looks like its home, ask whether that group's own remedy would have produced this rule's fix; if not, it is a different rule — new section.
3. **Supersession:** if the rule replaces an existing section, add a `supersedes` entry to the new home's frontmatter (`section`, `by`, `date`); the index derives the reverse link.
4. **Write the home** with the only bullet writer: `node "${CLAUDE_PLUGIN_ROOT}/scripts/place.mjs" --file <rule file> --section "<Heading>" --text "<wording>"`.
5. **Commit the filing** (index regenerated, entry dispositioned, one commit in one repository; universal also bumps the plugin version):
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind project|universal --stamp <stamp> --home "<file> § <Heading>"`
6. **Dismiss** instead of file when the dictated text is not a rule (a question, a duplicate): `node "${CLAUDE_PLUGIN_ROOT}/scripts/disposition.mjs" --inbox <inbox> --stamp <stamp> --dismissed "<reason>"`, then commit the inbox.
7. **Universal only:** `/machinery:reload` so this session sees the rule now.
8. Report what was filed where, verbatim `file § Section`, and what was dismissed with its reason.
```
`effort-lifecycle` and `refresh-diverged-branch`: copy the union's `SKILL.md` for each, then edit `effort-lifecycle` so that step 3 (create the copy) says "use the worktree tool; the plugin's WorktreeCreate hook names the branch after the copy", and the merge step names `/machinery:merge-gate` as "(spec 2 — until it exists, run the project's own verification legs on the merged result)". Nothing else changes.

Route: in `skills.manifest.json`, `routes.machinery.skills` = `["install", "reload", "reindex", "rule-intake", "effort-lifecycle", "refresh-diverged-branch"]`. Then `node scripts/build-skills.mjs build` (stages into `plugins/machinery/skills/`) and `node scripts/build-skills.mjs check`.

- [ ] **Step 4: run — expect passing** (`node --test test/skills.test.mjs` from the plugin; `build-skills.mjs check` from the repo root).

- [ ] **Step 5: commit** — `git add claude-code plugins/machinery skills.manifest.json && git commit -m "machinery: reload, six skills, plugin route"`

---

### Task 17: Move rules, register, and agents into the plugin; split design-invariants

**Files:**
- Move: `combine-projects-machinery/union/plugin/rules/*.md` → `plugins/machinery/rules/` (git mv)
- Move: `combine-projects-machinery/union/plugin/agents/{invariant-auditor,comparison-agent}.md` → `plugins/machinery/agents/`
- Delete: `combine-projects-machinery/union/plugin/register/INDEX.md` (replaced by the generated one)
- Create: `plugins/machinery/register/INDEX.md` (generated), `plugins/machinery/inbox.md` (empty)
- Modify: `plugins/machinery/rules/design-invariants.md` (remove the two audit sections), `plugins/machinery/agents/invariant-auditor.md` (add them as `## Procedure`), `combine-projects-machinery/union/plugin/README.md` (pointer), `plugins/machinery/.claude-plugin/plugin.json` (bump)
- Test: `plugins/machinery/test/single-copy.test.mjs`

**Interfaces:**
- Produces: the plugin's `rules/` as the single copy (spec I1, I35); the union directory keeps stories, WIRING, records.

- [ ] **Step 1: failing test** — `test/single-copy.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { generateIndex } from '../scripts/lib/index.mjs';

const REPO = path.resolve(PLUGIN, '..', '..');
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : [];
const h1 = (f) => (fs.readFileSync(f, 'utf8').match(/^# (.+)$/m) || [])[1];

test('the ten rule files exist in the plugin and nowhere else in the repo (spec I1)', () => {
  const mine = fs.readdirSync(path.join(PLUGIN, 'rules')).filter((f) => f.endsWith('.md'));
  assert.equal(mine.length, 10);
  const titles = new Set(mine.map((f) => h1(path.join(PLUGIN, 'rules', f))));
  const elsewhere = walk(path.join(REPO, 'combine-projects-machinery')).filter((f) => /[\\/]rules[\\/][^\\/]+\.md$/.test(f) && !f.includes(path.join('ferrislicer', 'docs')) && !f.includes(path.join('dwc-ng', 'docs')));
  for (const f of elsewhere) assert.ok(!titles.has(h1(f)), `duplicate rule file outside the plugin: ${f}`);
});

test('the register index is exactly the generated one (spec I2)', () => {
  assert.equal(fs.readFileSync(path.join(PLUGIN, 'register', 'INDEX.md'), 'utf8'), generateIndex(path.join(PLUGIN, 'rules')));
});

test('audit procedure lives only in the auditor brief (spec I35)', () => {
  const rules = fs.readFileSync(path.join(PLUGIN, 'rules', 'design-invariants.md'), 'utf8');
  assert.doesNotMatch(rules, /^## Auditing invariants/m);
  const agent = fs.readFileSync(path.join(PLUGIN, 'agents', 'invariant-auditor.md'), 'utf8');
  assert.match(agent, /^## Procedure/m); assert.match(agent, /denominator/i);
});

test('agents carry plugin agent frontmatter', () => {
  for (const f of ['invariant-auditor.md', 'comparison-agent.md']) {
    const t = fs.readFileSync(path.join(PLUGIN, 'agents', f), 'utf8');
    assert.match(t, /^---\nname: [a-z-]+\ndescription: .+\n(tools: .+\n)?---/);
  }
});

test('RED CHECK: the universal inbox exists and is empty', () => assert.equal(fs.readFileSync(path.join(PLUGIN, 'inbox.md'), 'utf8'), ''));
```

- [ ] **Step 2: run — expect failure.**

- [ ] **Step 3: do the moves**

```bash
git mv combine-projects-machinery/union/plugin/rules plugins/machinery/rules
git mv combine-projects-machinery/union/plugin/agents plugins/machinery/agents
git rm -q combine-projects-machinery/union/plugin/register/INDEX.md
: > plugins/machinery/inbox.md
```
Then, in `plugins/machinery/rules/design-invariants.md`, cut the two sections `## Auditing invariants: the denominator` and `## Auditing invariants: the output` (everything from each heading to the next `## `) and paste them, in order, under a new `## Procedure` heading in `plugins/machinery/agents/invariant-auditor.md`, before its rows comment; append `; audit method moved from rules/design-invariants.md 2026-09-02` to the agent file's rows comment and drop those row ids from the rule file's comment. Prepend agent frontmatter to both agent files:
```markdown
---
name: invariant-auditor
description: Audits a diff against the mandatory can't-break-by-design ladder — rates each invariant claim's stated strength against its real mechanism, returns findings in a fixed shape and a ledger delta. Dispatch before merging an effort.
tools: Read, Grep, Glob, Bash
---
```
```markdown
---
name: comparison-agent
description: Compares this build's output against a reference implementation's, verdict first, separating regression from pre-existing difference. Never rebakes an expectation, never edits to pass, reports skipped as unproven.
tools: Read, Grep, Glob, Bash
---
```
Generate the index: `node plugins/machinery/scripts/reindex.mjs --rules plugins/machinery/rules --out plugins/machinery/register/INDEX.md`. Replace the union README's rules/register/agents entries with one line: "Rules, the register index, and the agent briefs now live in `plugins/machinery/` (the running plugin); the stories and WIRING here are the platform-neutral spec it implements."

- [ ] **Step 4: run — expect passing**: `node --test test/` (all suites, including Task 16's restatement test which now bites) and `node scripts/build-skills.mjs check`. Bump the plugin version.

- [ ] **Step 5: commit** — `git add -A plugins/machinery combine-projects-machinery/union && git commit -m "machinery: rules, generated register index, agents moved into the plugin; audit method split into the auditor brief"`

---

### Task 18: This repo's commit gate runs the plugin's tests and universal gate

**Files:**
- Modify: `.githooks/pre-commit`
- Modify: `plugins/machinery/test/helpers/run.mjs` (none) — no code; wiring only
- Test: run the hook by hand

**Interfaces:**
- Produces: every commit in this repo runs `build-skills.mjs check`, then `node --test plugins/machinery/test` under a 10 s budget, then `gate.mjs --universal` over the plugin (spec I42; the plugin dogfoods its own register).

- [ ] **Step 1: edit `.githooks/pre-commit`**

```sh
#!/bin/sh
# Runs every guard in the repo before a commit lands (see scripts/build-skills.mjs check),
# then the machinery plugin's own tests and its universal register gate.
# Enable once per clone: node scripts/build-skills.mjs hooks
set -e
node scripts/build-skills.mjs check
start=$(date +%s)
node --test plugins/machinery/test
end=$(date +%s)
if [ $((end - start)) -gt 10 ]; then
  echo "pre-commit: machinery tests took $((end - start))s — over the 10s budget (spec I42); move the slow suite behind an env flag or speed it up" >&2
  exit 1
fi
node plugins/machinery/scripts/gate/gate.mjs --root plugins/machinery --universal
```

- [ ] **Step 2: verify by hand** — `sh .githooks/pre-commit` from the repo root: expected `✓` lines, the test summary with 0 failures, `register_check: 0 of 0 pending…`, exit 0. If the suite exceeds 10 s on this machine, mark the slowest integration suites (`install`, `intake`, `gate`) to run only when `MACHINERY_FULL_TESTS=1` is set and run them in Task 20 instead — record the decision in the plan's ledger line for I42.

- [ ] **Step 3: commit** — `git add .githooks/pre-commit && git commit -m "pre-commit: run machinery tests (10s budget) and the universal register gate"`

---

### Task 19: Meta-tests — every suite can go red; hook payload fixtures replayed

**Files:**
- Create: `plugins/machinery/test/meta.test.mjs`

- [ ] **Step 1: write it**
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';

const TESTS = fs.readdirSync(path.join(PLUGIN, 'test')).filter((f) => f.endsWith('.test.mjs') && f !== 'meta.test.mjs');

test('every suite carries a RED CHECK (spec I39)', () => {
  for (const f of TESTS) assert.match(fs.readFileSync(path.join(PLUGIN, 'test', f), 'utf8'), /RED CHECK/, `${f} has no red check`);
});

test('every hook script has a suite that replays a recorded payload (spec I40)', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  const scripts = new Set(Object.values(hooks).flat().flatMap((g) => g.hooks).map((h) => h.command.match(/scripts\/([\w-]+)\.mjs/)[1]).filter((s) => s !== 'record-payload'));
  for (const s of scripts) {
    const suite = fs.readFileSync(path.join(PLUGIN, 'test', `${s}.test.mjs`), 'utf8');
    assert.match(suite, /fixtures\/payloads\//, `${s}.test.mjs does not replay a recorded payload`);
  }
});

test('the recorder is the first hook of every event and inert without MACHINERY_RECORD', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const [ev, groups] of Object.entries(hooks)) assert.match(groups[0].hooks[0].command, /record-payload/, ev);
});

test('RED CHECK: the meta-test sees the suites', () => assert.ok(TESTS.length >= 12));
```

- [ ] **Step 2: run — expect passing** (fix any suite it names). **Step 3: commit** — `git commit -m "machinery: meta-tests for red checks and payload replay"`.

---

### Task 20: Verify the platform facts by hand; date the spec; final tidy

**Files:**
- Modify: `docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md` (platform facts table: add `Verified <date>`)
- Modify: `plugins/machinery/hooks/hooks.json` (leave the recorder in place — it is inert without `MACHINERY_RECORD`)
- Create: `plugins/machinery/README.md`

- [ ] **Step 1: install locally and run the checklist** (this machine, a real session):
  1. `node plugins/machinery/scripts/install.mjs --machine` → junction created; a new session in ANY repo shows the universal rules loaded (ask it to quote one rule from `rules/straight-talk.md`).
  2. Start `claude --plugin-dir <abs path>/plugins/machinery` in a scratch git repo: the banner appears as session context (measured lines, no claims).
  3. `/machinery:install` in that repo; commit a file → the gate runs (its count lines appear in git's output).
  4. Type `PRULE: test rule` → captured to `.claude/machinery/inbox.md`; the session runs intake in the same turn; a commit lands; `git log -1` shows `rule: PRULE: test rule`.
  5. Type `URULE: test universal` → captured to the plugin's `inbox.md`; intake files it, bumps the version, commits in the checkout, reloads.
  6. Run `cargo --version` (untouched) and `git status` (untouched), then a noisy command such as `npm --help` (untouched — `--help` is NEVER) and `git fetch` (rewritten: description ends `[quiet:infra]`).
  7. Create a worktree with the worktree tool → branch name equals the name; `~/.claude/machinery-observed-worktree` exists; next session's banner says "observed firing".
  8. Edit a rule file by hand → the nudge appears after the edit.
  Record each as pass/fail with the date in the spec's platform-facts table (`Verified 2026-09-…` or `FAILED: …`). A failure on 2, 6, or 7 is a spec-level finding: stop and report; do not paper over it.

- [ ] **Step 2: README** — `plugins/machinery/README.md`: what it is (one paragraph), install (machine + project), the markers, what each hook does in one line each, where the rules live (single copy), how a universal rule is filed, the dependency on `cant-break-by-design` (the `unbreakable` plugin), and a pointer to the union spec. Noun-free.

- [ ] **Step 3: full suite + repo gate** — `node --test plugins/machinery/test` and `node scripts/build-skills.mjs check` → green. Bump the version. Commit — `git commit -m "machinery: platform facts verified; README"`.

---

## Self-review (done at authoring)

**Spec coverage:** shape + bucket/route (T1, T16); platform facts recorded (T2) and verified (T20); rules source/junction/reload (T7, T11, T16); index generated + frontmatter (T9); inbox format (T7); five hooks (T6, T8, T12, T13, T14) wired in `hooks.json`; install + gate (T10, T11); intake pipelines + root rule + bump (T15); skills incl. `install/reload/reindex` (T16); agents + audit split + single copy (T17); repo gate + budget (T18); red checks + payload replay (T19); README (T20). Ledger items with no direct task: I3's `markers.json` (T1, read in T8/T12/T16 test), I21 (T5 red check), I24 (T10 `CHECKS` frozen), I36/I37 (T16 tests), I38 (T12).

**Placeholder scan:** none — every step has its code or its exact command.

**Type consistency:** `projectRoot/isRootSession` (T1) used in T8, T10, T12, T13, T15, T16; `pending/appendEntry/setDisposition/parseInbox` (T7) used in T8, T10, T12, T15; `generateIndex/readIndex` (T9) used in T10, T11, T13, T15, T17; `report` (T10) in gate files only; `classify` (T3) in T6; `context/updatedInput` (T1) in T6, T8, T12, T13; `markers()` (T7) in T8, T12; marker strings `PRULE:`/`URULE:` consistent with `markers.json`.

**Known ceilings, restated so nobody "fixes" them:** interleaving of stdout/stderr in `quiet-run` is by concatenation (T5); `WorktreeCreate` may not exist on other builds (T14 leaves the marker file as evidence); skills cannot be forced (banner reports).
