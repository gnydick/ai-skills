# Tool Assimilation (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the "6 of 10 tools fall through unfiltered" gap: an unknown command is observed instead of silently assumed quiet, a known-noisy tool with a real quiet flag gets suggested that flag before ever being wrapped, and every off-the-shelf tool's declared answer line is guaranteed to survive filtering.

**Architecture:** Two layers. `lib/capture.mjs` is a generic async process runner that records both output streams separately, in arrival order, with per-line timestamps — it knows nothing about any tool. Everything tool-specific lives in `lib/catalog.mjs` (a human-reviewed table: tool identity, quieting flags, the pattern that is the tool's answer) and `lib/observations.mjs` (a per-project, per-tool record of how noisy it has measured and which flags have been tried). `lib/assimilate.mjs` is the pure decision function that reads both and says what `quiet.mjs`/`quiet-run.mjs` should do. Nothing here is model-driven yet — that is a separate follow-on plan (bespoke-tool pattern learning) that builds on this core without changing any of it.

**Tech Stack:** Node ≥ 18, `node:test` + `node:assert/strict`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-04-tool-assimilation-design.md`

**Scope note:** The spec's "How an outcome pattern is learned" section (model-in-the-loop training for bespoke tools) is **not** in this plan. A bespoke tool here goes straight from unseen → wrap once noisy, with no suggestion and no learned pattern — exactly the honest floor the spec describes before training exists. That gap is closed by a follow-on plan once this one is merged.

**A second, narrower cut within this plan's own scope:** the spec's per-stream policy calls for recording stdout/stderr line counts separately, so a tool whose answer lives entirely on one stream (`scripts/battery.sh`: stdout 2, stderr 1400) can eventually be told apart from one where results and progress share a stream (`cargo test`). This plan **records** that split (Task 5's `stdoutLines`/`stderrLines`) but does not yet **act** on it — `select()` still filters the merged line array, not per-stream. Acting on the split (only emphasizing the stream that historically carries a tool's outcome) is deferred; recording it now means that data already exists when a later task decides to use it, rather than needing a second migration of the observation schema.

## Global Constraints

- **`PASS_THROUGH_LINES = 40`** (from `scripts/lib/filter.mjs`) is the one definition of "noisy." No new threshold is introduced anywhere in this plan.
- **Machine-derived patterns are never regex** — this plan introduces none; every pattern added by these tasks is written by a person into the catalog file and reviewed there. (The follow-on plan is where machine-derived prefixes appear, and it inherits this constraint.)
- **The ledger is keyed on parameters, never on the command.** One entry per (tool id, candidate string).
- **A project may add its own catalog entries**; on an id collision between project and universal catalogs, the project entry wins.
- **No shared corpus of negative verdicts.** A verdict (`insufficient`/`sufficient`) is never written to the universal catalog — only identity, candidates, and the outcome pattern are.
- **The observation record is JSON**, at `.claude/machinery/observations.json`, using the same `projectRoot()` resolution as the existing `.claude/machinery/inbox.md` and `INDEX.md` — one location shared across every worktree of a project, not per-worktree.
- **Every catalog entry ships a fixture proving its outcome line survives filtering.** An entry with no fixture is refused by the loader's own check (Task 4), not merely asked for in review.
- **Nothing in this plan may regress the 15 existing tests** in `test/quiet.test.mjs` and `test/quiet-run.test.mjs`. Task 2 states this as its explicit acceptance bar.

---

## File Structure

| Path | Responsibility |
|---|---|
| `plugins/machinery/scripts/lib/capture.mjs` | Generic async process capture: stream-tagged, timestamped lines; exit code. Knows no tool. |
| `plugins/machinery/scripts/lib/catalog.mjs` | Loads and merges the universal + project tool catalogs; matches a command to a tool id; finds an already-applied candidate. |
| `plugins/machinery/scripts/lib/observations.mjs` | Reads/writes the per-project observation record; computes the bespoke key; records a run's outcome into the right tool's entry and ledger. |
| `plugins/machinery/scripts/lib/assimilate.mjs` | The pure decision function: command + catalog + observations → mode. |
| `plugins/machinery/data/tool-catalog.json` | The universal, human-reviewed catalog. Seeded with 3 entries in Task 4. |
| `plugins/machinery/test/fixtures/tool-catalog/*.json` | One fixture per universal catalog entry, each proving its outcome line survives `select()`. |
| `plugins/machinery/scripts/lib/filter.mjs` | Modified (Task 3): `select()` gains an optional outcome-pattern parameter. |
| `plugins/machinery/scripts/quiet-run.mjs` | Modified (Task 2, 7): uses `capture.mjs`; adds `observe`/`suggest` modes; records observations at the end of every run. |
| `plugins/machinery/scripts/quiet.mjs` | Modified (Task 7): consults `assimilate.mjs` when `classify()` returns `plain`. |
| `plugins/machinery/scripts/promote-tool.mjs` | New (Task 8): moves a project catalog entry into the universal catalog. |
| `plugins/machinery/scripts/install.mjs` | Modified (Task 9): creates the two new per-project JSON files. |

---

## Task 1: Generic async process capture

**Files:**
- Create: `plugins/machinery/scripts/lib/capture.mjs`
- Test: `plugins/machinery/test/capture.test.mjs`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `export async function captureRun(exe, args, { input, env } = {})` → `Promise<{ code: number, records: Array<{t: number, stream: 'stdout'|'stderr', text: string}> }>`. `t` is seconds (float) since the call started, from a single monotonic clock. `input` (optional string) is written to the child's stdin then the stdin stream is ended; when omitted, the child's stdin is inherited from the caller's own stdin. `env` (optional object) replaces the child's environment; when omitted, `process.env` is inherited exactly as `spawn` does by default — this exists so `quiet-run.mjs` (Task 2) can keep passing its own `quietEnv()` through rather than that call silently becoming dead code. `code` follows today's `spawnSync` semantic: the process's exit code, or `1` if it was killed by a signal (never `null`). On a spawn failure (binary not found, etc.), the returned promise **rejects** with a plain `Error` whose `.message` is the underlying error's message — callers get the same information `quiet-run.mjs` gets from `r.error.message` today, just via rejection instead of a field.

- [ ] **Step 1: Write the failing test — stream separation and arrival order**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureRun } from '../scripts/lib/capture.mjs';

test('stdout and stderr are tagged separately and kept in arrival order', async () => {
  const code = `
    console.error('one on stderr');
    console.log('two on stdout');
    console.error('three on stderr');
  `;
  const { records, code: exitCode } = await captureRun(process.execPath, ['-e', code]);
  assert.equal(exitCode, 0);
  const shape = records.map((r) => [r.stream, r.text]);
  assert.deepEqual(shape, [
    ['stderr', 'one on stderr'],
    ['stdout', 'two on stdout'],
    ['stderr', 'three on stderr'],
  ]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/capture.test.mjs`
Expected: FAIL — `capture.mjs` does not exist yet.

- [ ] **Step 3: Implement `captureRun`**

```js
// plugins/machinery/scripts/lib/capture.mjs
// Generic async process capture. Knows nothing about any tool — that is
// assimilate.mjs's job. Records both streams separately, in the order chunks
// actually arrived, each line stamped with a monotonic offset from one start
// time (spec: "one clock authority, read once").
import { spawn } from 'node:child_process';

function linesOf(buf) {
  const text = buf.toString('utf8');
  const parts = text.split('\n');
  const trailing = parts.at(-1) === '' ? parts.pop() : null; // no trailing newline yet
  return { complete: parts, leftover: trailing ?? '' };
}

export function captureRun(exe, args, { input, env } = {}) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const elapsed = () => Number(process.hrtime.bigint() - start) / 1e9;
    const child = spawn(exe, args, {
      stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
      env: env ?? process.env,
    });
    const records = [];
    let leftover = { stdout: '', stderr: '' };
    let settled = false;

    child.on('error', (err) => { if (!settled) { settled = true; reject(new Error(err.message)); } });

    function onData(stream) {
      return (chunk) => {
        const t = elapsed();
        const joined = leftover[stream] + chunk.toString('utf8');
        const { complete, leftover: rest } = linesOf(Buffer.from(joined, 'utf8'));
        leftover[stream] = rest;
        for (const text of complete) records.push({ t, stream, text });
      };
    }
    child.stdout.on('data', onData('stdout'));
    child.stderr.on('data', onData('stderr'));

    if (input !== undefined) { child.stdin.write(input); child.stdin.end(); }

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      const t = elapsed();
      for (const stream of ['stdout', 'stderr']) if (leftover[stream]) records.push({ t, stream, text: leftover[stream] });
      resolve({ code: code ?? 1, records });
    });
  });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test plugins/machinery/test/capture.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write and run the timestamp test**

```js
test('timestamps are monotonically non-decreasing and reflect a real gap', async () => {
  const code = `console.log('first'); setTimeout(() => console.log('second'), 120);`;
  const { records } = await captureRun(process.execPath, ['-e', code]);
  assert.ok(records[1].t - records[0].t >= 0.08, `gap too small: ${records[1].t - records[0].t}`);
  for (let i = 1; i < records.length; i++) assert.ok(records[i].t >= records[i - 1].t);
});

test('a nonexistent executable rejects with the underlying message, not a raw stack', async () => {
  await assert.rejects(
    () => captureRun('this-binary-does-not-exist-xyz', []),
    (err) => { assert.ok(!err.stack?.includes('at Object.spawn')); return true; }
  );
});

test('exit code is 1, never null, when the child is signal-killed', { skip: process.platform === 'win32' }, async () => {
  const { code } = await captureRun('bash', ['-c', 'kill -TERM $$']);
  assert.equal(code, 1);
});

test('stdin passthrough: the child receives the given input', async () => {
  const { records } = await captureRun(process.execPath, ['-e', "process.stdin.on('data', d => console.log('got:' + d.toString().trim()))"], { input: 'hello\n' });
  assert.deepEqual(records.map((r) => r.text), ['got:hello']);
});

test('env, when given, replaces the child environment rather than being ignored', async () => {
  const { records } = await captureRun(process.execPath, ['-e', 'console.log(process.env.PROBE_VAR ?? "unset")'], { env: { ...process.env, PROBE_VAR: 'marker-123' } });
  assert.deepEqual(records.map((r) => r.text), ['marker-123']);
});
```

Run: `node --test plugins/machinery/test/capture.test.mjs`
Expected: PASS, all 6 tests (skip counted separately on Windows).

- [ ] **Step 6: Commit**

```bash
git add plugins/machinery/scripts/lib/capture.mjs plugins/machinery/test/capture.test.mjs
git commit -m "machinery: async, stream-tagged, timestamped process capture (lib/capture.mjs)"
```

---

## Task 2: Rewrite `quiet-run.mjs` on top of `capture.mjs`

**Files:**
- Modify: `plugins/machinery/scripts/quiet-run.mjs`
- Test: `plugins/machinery/test/quiet-run.test.mjs` (existing 8 tests must still pass unmodified; new tests appended)

**Interfaces:**
- Consumes: `captureRun` from Task 1.
- Produces: unchanged CLI/behavior for `--mode filter|infra` (this task only), so Task 3/5/7 can build on a runner whose observable output format has not moved.

**This task's acceptance bar is regression, stated up front:** all 8 tests currently in `quiet-run.test.mjs` must pass with zero edits to their assertions. None of them exercises stderr (checked: every fixture in that file writes only via `console.log`), so switching the capture mechanism cannot change what they observe.

- [ ] **Step 1: Run the existing suite to record the baseline**

Run: `node --test plugins/machinery/test/quiet-run.test.mjs`
Expected: 8 pass (this is today's baseline, not a new step's PASS — record it so Step 4 below has something to diff against).

- [ ] **Step 2: Replace the capture call**

In `plugins/machinery/scripts/quiet-run.mjs`, replace the `spawnSync`-based body of `main()` with an async version using `captureRun`:

```js
#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalise, select, selectInfra, render, PASS_THROUGH_LINES } from './lib/filter.mjs';
import { captureRun } from './lib/capture.mjs';

const SHELLS = Object.freeze({
  bash: (cmd) => ['bash', ['-c', cmd]],
  powershell: (cmd) => ['powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd]],
});

function quietEnv() { return { ...process.env }; }
function logDir() {
  const job = process.env.CLAUDE_JOB_DIR;
  return job ? path.join(job, 'tmp') : path.join(os.tmpdir(), 'claude-quiet');
}
function parseArgs(argv) {
  const a = { shell: 'bash', mode: 'filter', command: null, cmdfile: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--shell') a.shell = argv[++i];
    else if (x === '--mode') a.mode = argv[++i];
    else if (x === '-c') a.command = argv[++i];
    else if (!x.startsWith('--')) a.cmdfile = x;
  }
  return a;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!SHELLS[a.shell]) { process.stderr.write(`quiet-run: unknown shell '${a.shell}' (bash|powershell)\n`); return 2; }
  if (!['filter', 'infra', 'observe', 'suggest'].includes(a.mode)) { process.stderr.write(`quiet-run: unknown mode '${a.mode}'\n`); return 2; }
  let command = a.command;
  if (command === null && a.cmdfile) {
    try { command = fs.readFileSync(a.cmdfile, 'utf8'); }
    catch (e) { process.stderr.write(`quiet-run: cannot read ${a.cmdfile}: ${e.message}\n`); return 2; }
  }
  if (command === null) { process.stderr.write('quiet-run: need a cmdfile or -c\n'); return 2; }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const logPath = path.join(logDir(), `quiet-${stamp}-${process.pid}.log`);
  const [exe, args] = SHELLS[a.shell](command);
  const t0 = Date.now();
  let code, records;
  try {
    ({ code, records } = await captureRun(exe, args, { env: quietEnv() }));
  } catch (e) {
    process.stderr.write(`quiet-run: could not start ${a.shell}: ${e.message}\n`);
    return 1;
  }
  const lines = records.map((r) => r.text);
  let logDisplay = logPath;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const body = records.map((r) => `${r.t.toFixed(3)} ${r.stream === 'stdout' ? 'out' : 'err'}  ${r.text}`).join('\n');
    fs.writeFileSync(logPath, `$ ${command}\n${body}${body ? '\n' : ''}`);
  } catch (e) { logDisplay = `(unavailable: ${e.message})`; }

  // observe and suggest are ALWAYS verbatim, unconditionally — never the threshold branch below.
  // Getting this backwards (falling through to the filtered branch for 'suggest') would filter
  // exactly the trial run the spec requires to stay unobscured. filter/infra fall to the existing
  // threshold-or-forced verbatim path, unchanged from today.
  const forced = process.env.MACHINERY_QUIET === '0';
  const verbatim = forced || a.mode === 'observe' || a.mode === 'suggest'
    || (a.mode !== 'infra' && lines.length <= PASS_THROUGH_LINES);
  if (verbatim) process.stdout.write(lines.join('\n') + (lines.length ? '\n' : ''));
  else {
    const keep = a.mode === 'infra' ? selectInfra(lines, code) : select(lines);
    const header = `[quiet:${a.mode}] exit=${code}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${lines.length} lines -> ${Math.min(keep.size, 200)} shown  full log: ${logDisplay}`;
    process.stdout.write(render(lines, keep, header) + '\n');
  }
  if (a.cmdfile) { try { fs.rmSync(a.cmdfile); } catch {} }
  return code;
}

main().then((code) => { process.exitCode = code; }).catch((e) => { process.stderr.write(`quiet-run: ${e.message}\n`); process.exitCode = 1; });
```

Note what changed and what did not: the header format string, the verbatim threshold check, `select`/`selectInfra`/`render` calls, and the cmdfile-delete step are byte-identical to before. Only the capture mechanism and the log body format changed. `suggest` mode is folded into the "always verbatim" branch alongside `observe` for this task — Task 7 adds the extra suggestion line on top.

- [ ] **Step 3: Run the existing suite — regression check**

Run: `node --test plugins/machinery/test/quiet-run.test.mjs`
Expected: all 8 original tests PASS, unmodified. If any fails, this task is not done — do not proceed to Step 4 with a red baseline.

- [ ] **Step 4: Add tests for the new capability (stream separation reaching the log, stdin passthrough)**

```js
test('stderr and stdout both reach the log, each tagged, in real arrival order', { skip: !bash }, () => {
  const cmd = `node -e "console.error('e1');console.log('o1');console.error('e2')"`;
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd] });
  const log = r.stdout.split('full log: ')[1].trim();
  const body = fs.readFileSync(log, 'utf8').split('\n').slice(1); // drop the "$ cmd" line
  assert.deepEqual(body.map((l) => l.replace(/^\d+\.\d+ /, '')), ['err  e1', 'out  o1', 'err  e2']);
});

test('observe mode is always verbatim regardless of line count', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'observe', '-c', gen(100, 0)] });
  assert.equal(r.stdout.trim().split('\n').length, 100);
});

test('RED CHECK: suggest mode is verbatim even over threshold — a trial run must never be filtered', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'suggest', '-c', gen(100, 0)] });
  // 100 chatter lines + 1 error line from gen() = 101; verbatim means all 101 appear, not a
  // filtered ~10-line render. This is the exact case the backwards verbatim condition broke.
  assert.equal(r.stdout.trim().split('\n').length, 101);
});
```

- [ ] **Step 5: Run to verify these pass, then run the full file once more**

Run: `node --test plugins/machinery/test/quiet-run.test.mjs`
Expected: 11 pass (8 original + 3 new).

- [ ] **Step 6: Commit**

```bash
git add plugins/machinery/scripts/quiet-run.mjs plugins/machinery/test/quiet-run.test.mjs
git commit -m "machinery: quiet-run.mjs captures via lib/capture.mjs; adds observe mode"
```

---

## Task 3: `select()` gains an outcome-pattern parameter

**Files:**
- Modify: `plugins/machinery/scripts/lib/filter.mjs`
- Test: `plugins/machinery/test/filter.test.mjs` (new file — none existed for this module before)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function select(lines, outcomePattern)` — `outcomePattern` is an optional `RegExp`. When given, any line matching it is added to `keep` unconditionally, on the same footing as `SUMMARY`/`PROOF_LINE`. Task 7 is the only caller that will ever pass this argument.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select } from '../scripts/lib/filter.mjs';

test('a declared outcome pattern survives even when nothing else would keep it', () => {
  const lines = ['   Compiling foo v0.1.0', 'this line matches nothing built in', '   Compiling bar v0.1.0'];
  const kept = select(lines, /^this line matches/);
  assert.ok(kept.has(1), 'the outcome line must be kept');
});

test('omitting the argument leaves select() behaviour unchanged (regression)', () => {
  const lines = ['test result: ok. 3 passed; 0 failed', '   Compiling foo v0.1.0'];
  const before = select(lines); // no second arg — today's call shape, everywhere else in the codebase
  assert.deepEqual([...before].sort(), [0, 1]); // index 0: SUMMARY match; index 1: tail (only 2 lines, both in the last-8 tail)
});
```

- [ ] **Step 2: Run to verify the first test fails**

Run: `node --test plugins/machinery/test/filter.test.mjs`
Expected: first test FAILs (index 1 not kept); second test already passes against today's `select()`, confirming the regression baseline before the edit.

- [ ] **Step 3: Implement**

In `plugins/machinery/scripts/lib/filter.mjs`:

```js
export function select(lines, outcomePattern) {
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
    if (SUMMARY.test(line) || PROOF_LINE.test(line) || (outcomePattern && outcomePattern.test(line))) keep.add(i);
    else if (KEYWORD.test(line) && !CHATTER.test(line)) for (let k = i; k < Math.min(n, i + 1 + CONTEXT_AFTER); k++) keep.add(k);
    i++;
  }
  for (let k = Math.max(0, n - TAIL_LINES); k < n; k++) if (k === n - 1 || !CHATTER.test(lines[k])) keep.add(k);
  return keep;
}
```

- [ ] **Step 4: Run tests to verify both pass**

Run: `node --test plugins/machinery/test/filter.test.mjs`
Expected: 2 pass.

- [ ] **Step 5: Run the full existing suite to confirm no other caller broke**

Run: `node --test 'plugins/machinery/test/*.test.mjs'`
Expected: all prior tests still pass — `select(lines)` with no second argument is called everywhere else in the codebase and its behaviour must be unchanged.

- [ ] **Step 6: Commit**

```bash
git add plugins/machinery/scripts/lib/filter.mjs plugins/machinery/test/filter.test.mjs
git commit -m "machinery: select() takes an optional outcome pattern, kept unconditionally"
```

---

## Task 4: The universal tool catalog

**Files:**
- Create: `plugins/machinery/data/tool-catalog.json`
- Create: `plugins/machinery/scripts/lib/catalog.mjs`
- Create: `plugins/machinery/test/fixtures/tool-catalog/git-commit.json`, `npm-install.json`, `pytest.json`
- Test: `plugins/machinery/test/catalog.test.mjs`

**Interfaces:**
- Consumes: `select` from Task 3 (for the fixture-survival check).
- Produces:
  - `export function loadCatalog(root)` → merged `{ [id]: { match: {type: 'prefix'|'regex', value: string}, outcome: string, candidates: string[] } }`, project (`<root>/.claude/machinery/tool-catalog.json`, default `{}`) entries overriding universal ones by id.
  - `export function matchTool(command, catalog)` → tool id or `null`.
  - `export function matchedCandidate(command, candidates)` → the first candidate substring present in `command`, or `null`.

**Each catalog entry's candidate flag is verified against the real tool's own help text before it is written down** — this plan does not assert a flag's effect from memory alone.

- [ ] **Step 1: Verify the three candidate flags against real help output**

Run each and read the relevant line before proceeding:

```bash
git help commit | grep -A1 -- '-q, --quiet'
npm help install | grep -iA1 silent
pytest --help | grep -A1 -- '-q, --quiet'
```

Expected, respectively: `-q, --quiet` documented as suppressing the commit summary; `--silent`/`-s` (or `loglevel silent`) documented for npm install; `-q`/`--quiet` documented for pytest as reducing verbosity. Record whatever the actual installed tool prints — if wording differs from what is written below, use the real wording in Step 2's data, not this plan's guess.

- [ ] **Step 2: Write the catalog data**

```json
{
  "git-commit": {
    "match": { "type": "regex", "value": "^git\\s+commit\\b" },
    "outcome": "^\\[\\S+ [0-9a-f]{7,}\\]",
    "candidates": ["--quiet"]
  },
  "npm-install": {
    "match": { "type": "regex", "value": "^npm\\s+(install|ci)\\b" },
    "outcome": "^(added|up to date|found) \\d+ package",
    "candidates": ["--silent"]
  },
  "pytest": {
    "match": { "type": "prefix", "value": "pytest" },
    "outcome": "^=+ .*(passed|failed|error).* =+$",
    "candidates": ["-q"]
  }
}
```

File: `plugins/machinery/data/tool-catalog.json`

- [ ] **Step 3: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, matchTool, matchedCandidate } from '../scripts/lib/catalog.mjs';
import { select } from '../scripts/lib/filter.mjs';

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('matchTool recognises a real invocation by regex and by prefix', () => {
  const catalog = loadCatalog(PLUGIN);
  assert.equal(matchTool('git commit -m "x"', catalog), 'git-commit');
  assert.equal(matchTool('pytest tests/ -k foo', catalog), 'pytest');
  assert.equal(matchTool('ls -la', catalog), null);
});

test('matchedCandidate finds a flag already present in the command', () => {
  assert.equal(matchedCandidate('git commit --quiet -m x', ['--quiet']), '--quiet');
  assert.equal(matchedCandidate('git commit -m x', ['--quiet']), null);
});

test('project catalog entries override a universal id of the same name', () => {
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'catalog-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'machinery'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.claude', 'machinery', 'tool-catalog.json'),
    JSON.stringify({ 'git-commit': { match: { type: 'prefix', value: 'git commit' }, outcome: 'OVERRIDDEN', candidates: [] } }));
  const catalog = loadCatalog(tmp);
  assert.equal(catalog['git-commit'].outcome, 'OVERRIDDEN');
});

test('RED CHECK: every universal catalog entry has a fixture proving its outcome survives filtering', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'data', 'tool-catalog.json'), 'utf8'));
  const ids = Object.keys(catalog);
  assert.ok(ids.length > 0, 'zero catalog entries — this check would prove nothing');
  for (const id of ids) {
    const fixturePath = path.join(PLUGIN, 'test', 'fixtures', 'tool-catalog', `${id}.json`);
    assert.ok(fs.existsSync(fixturePath), `${id}: no fixture at ${fixturePath} — an entry with no fixture is not an entry`);
    const { lines } = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const outcome = new RegExp(catalog[id].outcome);
    const kept = select(lines, outcome);
    const outcomeIndex = lines.findIndex((l) => outcome.test(l));
    assert.ok(outcomeIndex >= 0, `${id}: fixture does not contain a line matching its own outcome pattern`);
    assert.ok(kept.has(outcomeIndex), `${id}: outcome line did not survive select()`);
  }
});
```

- [ ] **Step 2: Run to verify these fail**

Run: `node --test plugins/machinery/test/catalog.test.mjs`
Expected: FAIL — `catalog.mjs` and the fixtures do not exist yet.

- [ ] **Step 5: Implement `catalog.mjs`**

```js
// plugins/machinery/scripts/lib/catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pluginRoot } from './config.mjs';

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

export function loadCatalog(root) {
  const universal = readJson(path.join(pluginRoot(), 'data', 'tool-catalog.json'), {});
  const project = readJson(path.join(root, '.claude', 'machinery', 'tool-catalog.json'), {});
  return { ...universal, ...project }; // project wins on id collision, by design
}

export function matchTool(command, catalog) {
  for (const [id, entry] of Object.entries(catalog)) {
    if (entry.match.type === 'prefix' && command.trim().startsWith(entry.match.value)) return id;
    if (entry.match.type === 'regex' && new RegExp(entry.match.value).test(command)) return id;
  }
  return null;
}

export function matchedCandidate(command, candidates) {
  return candidates.find((c) => command.includes(c)) ?? null;
}
```

- [ ] **Step 6: Write the three fixtures**

`plugins/machinery/test/fixtures/tool-catalog/git-commit.json`:
```json
{ "lines": ["[main a1b2c3d] a commit message", " 1 file changed, 2 insertions(+)"] }
```

`plugins/machinery/test/fixtures/tool-catalog/npm-install.json`:
```json
{ "lines": ["npm WARN deprecated foo@1.0.0", "added 42 packages in 3s"] }
```

`plugins/machinery/test/fixtures/tool-catalog/pytest.json`:
```json
{ "lines": ["collecting ... collected 12 items", "================= 12 passed in 0.42s =================="] }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test plugins/machinery/test/catalog.test.mjs`
Expected: 4 pass.

- [ ] **Step 8: Commit**

```bash
git add plugins/machinery/data/tool-catalog.json plugins/machinery/scripts/lib/catalog.mjs \
        plugins/machinery/test/fixtures/tool-catalog plugins/machinery/test/catalog.test.mjs
git commit -m "machinery: universal tool catalog (git commit, npm install, pytest), each with a survival fixture"
```

---

## Task 5: Per-project observation record

**Files:**
- Create: `plugins/machinery/scripts/lib/observations.mjs`
- Test: `plugins/machinery/test/observations.test.mjs`

**Interfaces:**
- Consumes: `PASS_THROUGH_LINES` from `filter.mjs` (Task 3's file, unchanged constant).
- Produces:
  - `export function loadObservations(root)` / `export function saveObservations(root, obs)` at `<root>/.claude/machinery/observations.json`.
  - `export function bespokeKey(command)` → the leading non-flag tokens, e.g. `bash scripts/battery.sh --quick` → `"bash scripts/battery.sh"`.
  - `export function recordRun(obs, key, { identity, lineCount, stdoutLines, stderrLines, candidate, outcomeSurvived = true })` → returns the updated `obs` (does not write to disk; the caller saves).

**Ruling (mid-execution, recorded 2026-09-05 during Task 4's review — this section did not exist when Task 4 was dispatched):** a candidate is `sufficient` only if it *both* drops the line count *and* leaves the tool's declared outcome line intact. Measured during Task 4: `git commit --quiet` and `npm install --silent` print **nothing at all** — under line-count-only sufficiency, either would be marked `sufficient` and suggested forever, leaving the user with zero confirmation the command ran. `outcomeSurvived` defaults to `true` so a bespoke tool (no outcome pattern exists to lose) is judged on line count alone, exactly as before this ruling — this is additive, not a breaking change to the bespoke path.

**The field that must never be conflated:** `noisy`/`lines`/`stdoutLines`/`stderrLines` describe the tool's *bare* invocation — how it behaves with nothing added. A run made *with* a candidate flag applied is a trial measuring that flag, not a re-measurement of the bare tool, and must update only `ledger[candidate]`, never the bare fields. Getting this backwards means proving a flag works erases the fact that the *bare* command was ever noisy — the next bare invocation would read `noisy: false` and stop suggesting the very flag that made it quiet. Bare-run fields carry forward unchanged across trial calls; trial-run calls carry the bare fields forward unchanged.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bespokeKey, recordRun } from '../scripts/lib/observations.mjs';

test('bespokeKey strips flags and arguments, keeping the leading command shape', () => {
  assert.equal(bespokeKey('bash scripts/battery.sh --quick'), 'bash scripts/battery.sh');
  assert.equal(bespokeKey('python scripts/oracle_compare.py --base HEAD~1'), 'python scripts/oracle_compare.py');
  assert.equal(bespokeKey('scripts/testq.sh --workspace'), 'scripts/testq.sh');
});

test('recordRun marks noisy from the line count, using the one shared threshold', () => {
  let obs = {};
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 5 });
  assert.equal(obs['git-commit'].noisy, false);
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'bespoke', lineCount: 2100 });
  assert.equal(obs['bash scripts/battery.sh'].noisy, true);
});

test('recordRun with a candidate writes the ledger keyed on the flag, never the command', () => {
  let obs = {};
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 900, candidate: '--quiet' });
  assert.equal(obs['git-commit'].ledger['--quiet'], 'insufficient');
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 3, candidate: '--quiet' });
  assert.equal(obs['git-commit'].ledger['--quiet'], 'sufficient');
  // The ledger has exactly one entry, for the flag — not one per distinct invocation.
  assert.deepEqual(Object.keys(obs['git-commit'].ledger), ['--quiet']);
});

test('RED CHECK: two differently-flagged invocations of the same tool never fragment the record', () => {
  let obs = {};
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'bespoke', lineCount: 10 });
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'bespoke', lineCount: 2000 });
  assert.equal(Object.keys(obs).length, 1); // one key, last write wins on the shared fields
  assert.equal(obs['bash scripts/battery.sh'].noisy, true);
});

test('RED CHECK: a candidate that deletes the tool\'s own outcome line is never marked sufficient', () => {
  // Measured on real tools during Task 4: `git commit --quiet` and `npm install --silent`
  // print NOTHING — under line-count alone this would be marked sufficient and suggested
  // forever, leaving the user with zero confirmation the command ran.
  let obs = {};
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 900 }); // bare: noisy
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 0, candidate: '--quiet', outcomeSurvived: false });
  assert.equal(obs['git-commit'].ledger['--quiet'], 'insufficient', 'low line count alone must not be enough — the outcome line is gone');
});

test('a candidate that drops the line count AND keeps the outcome line is sufficient', () => {
  let obs = {};
  obs = recordRun(obs, 'pytest', { identity: 'catalog', lineCount: 900 });
  obs = recordRun(obs, 'pytest', { identity: 'catalog', lineCount: 3, candidate: '-q', outcomeSurvived: true });
  assert.equal(obs['pytest'].ledger['-q'], 'sufficient');
});

test('a bespoke tool (no outcome pattern exists) is judged on line count alone', () => {
  let obs = {};
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'bespoke', lineCount: 2000 });
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'bespoke', lineCount: 3 }); // no candidate concept for bespoke; this path is unaffected
  assert.equal(obs['bash scripts/battery.sh'].noisy, false);
});

test('RED CHECK: a sufficient trial never overwrites the bare command noisy state', () => {
  let obs = {};
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 900 }); // bare: noisy
  assert.equal(obs['git-commit'].noisy, true);
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 3, candidate: '--quiet' }); // trial: quiet WITH the flag
  assert.equal(obs['git-commit'].ledger['--quiet'], 'sufficient');
  // The bare tool is still noisy — only the trial's own line count was low, not the bare
  // invocation's. Getting this wrong is what would make the system stop suggesting the fix
  // the moment it is proven to work.
  assert.equal(obs['git-commit'].noisy, true, 'a trial run must never erase the bare noisy state');
  assert.equal(obs['git-commit'].lines, 900, 'bare line count must survive a trial call');
});

test('stdout/stderr counts are recorded separately for a bare run (spec: which stream carries the answer)', () => {
  let obs = {};
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'bespoke', lineCount: 1402, stdoutLines: 2, stderrLines: 1400 });
  assert.equal(obs['bash scripts/battery.sh'].stdoutLines, 2);
  assert.equal(obs['bash scripts/battery.sh'].stderrLines, 1400);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/observations.test.mjs`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// plugins/machinery/scripts/lib/observations.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PASS_THROUGH_LINES } from './filter.mjs';

const PATH_SEG = (root) => path.join(root, '.claude', 'machinery', 'observations.json');

export function loadObservations(root) {
  try { return JSON.parse(fs.readFileSync(PATH_SEG(root), 'utf8')); } catch { return {}; }
}

export function saveObservations(root, obs) {
  const p = PATH_SEG(root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obs, null, 2) + '\n');
}

// A bespoke tool's key is its leading non-flag tokens — the command with every
// argument stripped. cargo test --workspace and cargo test -p x collapse under
// a single catalog id via matchTool() instead; this handles what has no entry.
export function bespokeKey(command) {
  return command.trim().split(/\s+/).filter((tok) => !tok.startsWith('-')).join(' ');
}

export function recordRun(obs, key, { identity, lineCount, stdoutLines, stderrLines, candidate, outcomeSurvived = true }) {
  const prev = obs[key] ?? { ledger: {} };
  const entry = { identity, ledger: { ...prev.ledger } };
  if (candidate) {
    // A trial run measures whether THIS flag helps. It says nothing about the
    // bare tool's own noise level, which carries forward exactly as it was.
    entry.noisy = prev.noisy ?? false;
    entry.lines = prev.lines;
    entry.stdoutLines = prev.stdoutLines;
    entry.stderrLines = prev.stderrLines;
    // Sufficient means BOTH quiet enough AND the tool still said something. A flag that
    // drops the line count by deleting the tool's own answer is not a fix, it's a worse
    // failure mode — see the ruling above this function's Interfaces entry.
    entry.ledger[candidate] = (lineCount <= PASS_THROUGH_LINES && outcomeSurvived) ? 'sufficient' : 'insufficient';
  } else {
    // A bare run IS the tool's natural noise level.
    entry.noisy = lineCount > PASS_THROUGH_LINES;
    entry.lines = lineCount;
    entry.stdoutLines = stdoutLines;
    entry.stderrLines = stderrLines;
  }
  return { ...obs, [key]: entry };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/machinery/test/observations.test.mjs`
Expected: 9 pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/machinery/scripts/lib/observations.mjs plugins/machinery/test/observations.test.mjs
git commit -m "machinery: per-project observation record, ledger keyed on candidate flags"
```

---

## Task 6: The decision function

**Files:**
- Create: `plugins/machinery/scripts/lib/assimilate.mjs`
- Test: `plugins/machinery/test/assimilate.test.mjs`

**Interfaces:**
- Consumes: `matchTool`, `matchedCandidate` from Task 4; `bespokeKey` from Task 5.
- Produces: `export function decide(command, { catalog, observations })` → `{ mode: 'plain'|'observe'|'suggest'|'noisy', id, identity, suggestFlags }`. `id` is the catalog id or the bespoke key. `suggestFlags` is only set when `mode === 'suggest'`.

**The ledger-resolution rule this task encodes, stated once here because the spec's five-state table does not spell it out to this level:** if any candidate for a catalog tool is already marked `sufficient`, always suggest that one (ignore the rest — the tool is solved, just forgotten this time). Otherwise, suggest the next candidate that has no ledger entry at all. Only once every candidate has been tried and none is sufficient does the tool fall to `noisy` (wrap).

- [ ] **Step 1: Write the failing tests — one per branch of the five states, plus the resolution rule**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../scripts/lib/assimilate.mjs';

const catalog = { 'git-commit': { match: { type: 'regex', value: '^git\\s+commit\\b' }, outcome: 'x', candidates: ['--quiet'] } };

test('no observations at all -> observe, unwrapped', () => {
  const d = decide('git commit -m x', { catalog, observations: {} });
  assert.equal(d.mode, 'observe');
  assert.equal(d.identity, 'catalog');
});

test('last observation quiet -> nothing', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: false, ledger: {} } };
  assert.equal(decide('git commit -m x', { catalog, observations }).mode, 'plain');
});

test('noisy, bespoke -> wrap, no suggestion possible', () => {
  const observations = { 'bash scripts/battery.sh': { identity: 'bespoke', noisy: true, ledger: {} } };
  const d = decide('bash scripts/battery.sh', { catalog: {}, observations });
  assert.equal(d.mode, 'noisy');
  assert.equal(d.suggestFlags, undefined);
});

test('noisy, catalog, untried candidate left -> suggest that candidate', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: {} } };
  const d = decide('git commit -m x', { catalog, observations });
  assert.equal(d.mode, 'suggest');
  assert.equal(d.suggestFlags, '--quiet');
});

test('noisy, catalog, candidates exhausted with none sufficient -> wrap', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: { '--quiet': 'insufficient' } } };
  assert.equal(decide('git commit -m x', { catalog, observations }).mode, 'noisy');
});

test('a candidate already known sufficient is always the one suggested, even with others untried', () => {
  const twoFlags = { 'git-commit': { ...catalog['git-commit'], candidates: ['--quiet', '--no-verify'] } };
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: { '--quiet': 'sufficient' } } };
  const d = decide('git commit -m x', { catalog: twoFlags, observations });
  assert.equal(d.mode, 'suggest');
  assert.equal(d.suggestFlags, '--quiet');
});

test('a command that already carries an untried candidate is a trial run: observe, not suggest', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: {} } };
  const d = decide('git commit --quiet -m x', { catalog, observations });
  assert.equal(d.mode, 'observe'); // measuring the trial; suggesting again would be noise
});

test('RED CHECK: a tool with N candidates reaches wrap in at most N suggest states, never suggests twice', () => {
  const many = { t: { match: { type: 'prefix', value: 'toolx' }, outcome: 'x', candidates: ['-a', '-b', '-c'] } };
  let observations = { t: { identity: 'catalog', noisy: true, ledger: {} } };
  const suggested = [];
  for (let i = 0; i < 5; i++) {
    const d = decide('toolx', { catalog: many, observations });
    if (d.mode === 'suggest') { suggested.push(d.suggestFlags); observations = { t: { ...observations.t, ledger: { ...observations.t.ledger, [d.suggestFlags]: 'insufficient' } } }; }
    else break;
  }
  assert.deepEqual(suggested.sort(), ['-a', '-b', '-c']); // exactly the 3 candidates, no repeats
  assert.equal(decide('toolx', { catalog: many, observations }).mode, 'noisy'); // 4th call: exhausted
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/assimilate.test.mjs`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// plugins/machinery/scripts/lib/assimilate.mjs
import { matchTool, matchedCandidate } from './catalog.mjs';
import { bespokeKey } from './observations.mjs';

export function decide(command, { catalog, observations }) {
  const id = matchTool(command, catalog);
  if (id) {
    const entry = catalog[id];
    const rec = observations[id];
    if (!rec) return { mode: 'observe', id, identity: 'catalog' };
    if (!rec.noisy) return { mode: 'plain', id, identity: 'catalog' };
    const applied = matchedCandidate(command, entry.candidates);
    if (applied) return { mode: 'observe', id, identity: 'catalog' }; // mid-trial: don't obscure the measurement
    const sufficient = entry.candidates.find((c) => rec.ledger[c] === 'sufficient');
    if (sufficient) return { mode: 'suggest', id, identity: 'catalog', suggestFlags: sufficient };
    const untried = entry.candidates.find((c) => !(c in rec.ledger));
    if (untried) return { mode: 'suggest', id, identity: 'catalog', suggestFlags: untried };
    return { mode: 'noisy', id, identity: 'catalog' }; // exhausted, none sufficient
  }
  const key = bespokeKey(command);
  const rec = observations[key];
  if (!rec) return { mode: 'observe', id: key, identity: 'bespoke' };
  if (!rec.noisy) return { mode: 'plain', id: key, identity: 'bespoke' };
  return { mode: 'noisy', id: key, identity: 'bespoke' }; // no candidates exist for a bespoke tool in this plan
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/machinery/test/assimilate.test.mjs`
Expected: 8 pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/machinery/scripts/lib/assimilate.mjs plugins/machinery/test/assimilate.test.mjs
git commit -m "machinery: the five-state decision function, plus the sufficient-candidate resolution rule"
```

---

## Task 7: Wire the hooks

**Files:**
- Modify: `plugins/machinery/scripts/quiet.mjs`
- Modify: `plugins/machinery/scripts/quiet-run.mjs`
- Test: `plugins/machinery/test/quiet.test.mjs` (existing 7 tests must still pass; new tests appended)
- Test: `plugins/machinery/test/quiet-run.test.mjs` (append)

**Interfaces:**
- Consumes: `decide` (Task 6), `loadCatalog`/`matchTool`/`matchedCandidate` (Task 4), `loadObservations`/`saveObservations`/`recordRun`/`bespokeKey` (Task 5), `select` with outcome pattern (Task 3), `projectRoot` (existing `lib/root.mjs`).
- Produces: the end-to-end behaviour this whole plan exists for.

- [ ] **Step 1: Write the failing test for `quiet.mjs`'s new branch**

```js
// appended to test/quiet.test.mjs
import fs from 'node:fs';
import os from 'node:os';

function tmpProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-assimilate-'));
  fs.mkdirSync(path.join(root, '.git')); // enough for projectRoot() to recognise it — see lib/root.mjs
  return root;
}

test('a plain-classified command with no observation history is wrapped in observe mode', () => {
  const root = tmpProject();
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'pytest tests/') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /--mode observe/);
});

test('a command with no catalog match and no history is left untouched only if genuinely unrecognisable and quiet on measurement — for THIS test, still observed', () => {
  const root = tmpProject();
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.match(out(r.stdout).updatedInput.command, /--mode observe/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/quiet.test.mjs`
Expected: FAIL — `quiet.mjs` still returns nothing for `plain`-classified commands.

- [ ] **Step 3: Update `quiet.mjs`**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './lib/classify.mjs';
import { readPayload } from './lib/stdin.mjs';
import { updatedInput } from './lib/emit.mjs';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog } from './lib/catalog.mjs';
import { loadObservations } from './lib/observations.mjs';
import { decide } from './lib/assimilate.mjs';

function main() {
  const p = readPayload();
  if (!p) return;
  const tool = p.tool_name;
  if (tool !== 'Bash' && tool !== 'PowerShell') return;
  const input = p.tool_input ?? {};
  const command = input.command ?? '';
  const kind = classify(command);
  let mode = kind === 'infra' ? 'infra' : kind === 'noisy' ? 'filter' : null;
  if (!mode && kind === 'plain') {
    const root = projectRoot(process.cwd());
    const catalog = loadCatalog(root);
    const observations = loadObservations(root);
    const d = decide(command, { catalog, observations });
    if (d.mode === 'noisy') mode = 'filter';
    else if (d.mode !== 'plain') mode = d.mode; // 'observe' | 'suggest'
  }
  if (!mode) return;
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

- [ ] **Step 4: Run to verify the new tests pass and the original 7 still do**

Run: `node --test plugins/machinery/test/quiet.test.mjs`
Expected: 9 pass (7 original + 2 new).

- [ ] **Step 5: Write the failing test for `quiet-run.mjs`'s recording and outcome-pattern behaviour**

`matchTool`/`bespokeKey` operate on the **command text**. A `node -e "..."` fixture is not a real `git commit` invocation, so it resolves as bespoke, keyed by its own leading token (`node`) — the test below asserts on that real key directly, not on a catalog id the fixture never matches.

```js
// appended to test/quiet-run.test.mjs
test('a run records its observation under the bespoke key derived from the command itself', { skip: !bash }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-run-record-'));
  const cmd = `node -e "for(let i=0;i<80;i++)console.log('noise');console.log('done')"`;
  runScript('scripts/quiet-run.mjs', { env: { CLAUDE_PROJECT_ROOT: root }, args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd] });
  const obs = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'machinery', 'observations.json'), 'utf8'));
  assert.equal(obs['node'].identity, 'bespoke');
  assert.equal(obs['node'].noisy, true); // 81 lines > PASS_THROUGH_LINES (40)
  assert.equal(obs['node'].lines, 81);
  assert.ok(obs['node'].stdoutLines > 0);
});

test('suggest mode prints the recommendation after verbatim output', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'suggest', '-c', 'echo real-output'] });
  assert.match(r.stdout, /^real-output\n\[quiet:suggest\]/);
});

test('RED CHECK: a real git-commit --quiet trial is recorded insufficient — it drops the outcome line entirely', { skip: !bash }, () => {
  // Real repo, real git, real --quiet — not a simulated line count. This is the exact
  // measured case from Task 4's report: `git commit --quiet` prints NOTHING, so a
  // line-count-only sufficiency check would wrongly call it sufficient forever.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-run-outcome-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=T', 'commit', '--allow-empty', '-q', '-m', 'seed'], { cwd: root });
  fs.writeFileSync(path.join(root, 'a.txt'), 'x');
  execFileSync('git', ['add', 'a.txt'], { cwd: root });
  // First, mark the tool noisy with a bare (non-quiet) commit, so decide()'s own
  // downstream logic would treat a later --quiet trial as a real trial, not a first sighting.
  runScript('scripts/quiet-run.mjs', {
    cwd: root, env: { CLAUDE_PROJECT_ROOT: root },
    args: ['--shell', 'bash', '--mode', 'observe', '-c', `git -c user.email=t@t -c user.name=T commit -m bare`],
  });
  fs.writeFileSync(path.join(root, 'b.txt'), 'y');
  execFileSync('git', ['add', 'b.txt'], { cwd: root });
  runScript('scripts/quiet-run.mjs', {
    cwd: root, env: { CLAUDE_PROJECT_ROOT: root },
    args: ['--shell', 'bash', '--mode', 'observe', '-c', `git -c user.email=t@t -c user.name=T commit --quiet -m quiet`],
  });
  const obs = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'machinery', 'observations.json'), 'utf8'));
  assert.equal(obs['git-commit'].ledger['--quiet'], 'insufficient', 'a flag that deletes the outcome line must never be marked sufficient');
});
```

Add `import { execFileSync } from 'node:child_process';` to this test file's imports if not already present.

- [ ] **Step 6: Run to verify they fail**

Run: `node --test plugins/machinery/test/quiet-run.test.mjs`
Expected: FAIL — no recording exists yet, no suggestion line is printed.

- [ ] **Step 7: Update `quiet-run.mjs`** — add the recording step and the suggest-mode line, at the end of `main()`, after `lines` is computed and before the `cmdfile` cleanup:

```js
  // ... after computing `lines` and before the verbatim/render branch, resolve identity:
  const root = process.env.CLAUDE_PROJECT_ROOT ?? projectRoot(process.cwd());
  const catalog = loadCatalog(root);
  const toolId = matchTool(command, catalog);
  const outcomePattern = toolId ? new RegExp(catalog[toolId].outcome) : undefined;
  const key = toolId ?? bespokeKey(command);
  const candidate = toolId ? matchedCandidate(command, catalog[toolId].candidates) : null;

  // Same rule as Task 2, restated because this is the second and only other place it can be
  // gotten backwards: observe/suggest are UNCONDITIONALLY verbatim, never the filtered branch.
  const forced = process.env.MACHINERY_QUIET === '0';
  const verbatim = forced || a.mode === 'observe' || a.mode === 'suggest'
    || (a.mode !== 'infra' && lines.length <= PASS_THROUGH_LINES);
  let out;
  if (verbatim) out = lines.join('\n') + (lines.length ? '\n' : '');
  else {
    const keep = a.mode === 'infra' ? selectInfra(lines, code) : select(lines, outcomePattern);
    const header = `[quiet:${a.mode}] exit=${code}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${lines.length} lines -> ${Math.min(keep.size, 200)} shown  full log: ${logDisplay}`;
    out = render(lines, keep, header) + '\n';
  }
  if (a.mode === 'suggest') out += `[quiet:suggest] ${key} could be quieter — try: ${candidate ?? ''}\n`;
  process.stdout.write(out);

  try {
    const stdoutLines = records.filter((r) => r.stream === 'stdout').length;
    const stderrLines = records.filter((r) => r.stream === 'stderr').length;
    // Only meaningful for a trial run (candidate set): did the tool's own declared answer
    // survive taking the flag? Defaults true — a bare run or a bespoke tool (no outcome
    // pattern exists) is judged on line count alone, per Task 5's ruling.
    const outcomeSurvived = candidate && outcomePattern ? lines.some((l) => outcomePattern.test(l)) : true;
    let observations = loadObservations(root);
    observations = recordRun(observations, key, {
      identity: toolId ? 'catalog' : 'bespoke',
      lineCount: lines.length, stdoutLines, stderrLines, candidate, outcomeSurvived,
    });
    saveObservations(root, observations);
  } catch { /* recording is best-effort; never fail the wrapped command over it */ }
```

Add the corresponding imports at the top:
```js
import { projectRoot } from './lib/root.mjs';
import { loadCatalog, matchTool, matchedCandidate } from './lib/catalog.mjs';
import { loadObservations, saveObservations, recordRun, bespokeKey } from './lib/observations.mjs';
```

**Carried forward from Task 3's review** (a `/g`/`/y` `RegExp` passed to `select()` silently drops alternating matches via `lastIndex` statefulness): the `outcomePattern` constructed above, `new RegExp(catalog[toolId].outcome)`, must never carry a global or sticky flag. Task 4's catalog stores `outcome` as a plain pattern string with no flag information, so `new RegExp(catalog[toolId].outcome)` is always non-global by construction — this is what makes the interface a string rather than a pre-built `RegExp` (Task 4's own text notes this). No guard code is needed here as a result; if a future catalog format ever allows specifying flags, that change must re-open this note.

`suggestFlags` from `decide()` is not consulted here — `quiet-run.mjs` independently recomputes `candidate` via `matchedCandidate`, which is the same deterministic function `decide()` already called, so the two are guaranteed to agree without passing state across the process boundary.

- [ ] **Step 8: Fix and run the Step 5 test's wrong assumption, then verify all pass**

Rewrite the first Step 5 test's assertion to check the bespoke key `node` (the fixture command's own leading token), then:

Run: `node --test plugins/machinery/test/quiet-run.test.mjs`
Expected: all pass (11 from Tasks 2-3 + 3 new = 14).

- [ ] **Step 9: Run the whole suite**

Run: `node --test 'plugins/machinery/test/*.test.mjs'`
Expected: all pass, 0 failures. This is the point where every prior task's regression guarantee is checked together for the first time.

- [ ] **Step 10: Commit**

```bash
git add plugins/machinery/scripts/quiet.mjs plugins/machinery/scripts/quiet-run.mjs \
        plugins/machinery/test/quiet.test.mjs plugins/machinery/test/quiet-run.test.mjs
git commit -m "machinery: wire assimilate() into quiet.mjs; quiet-run.mjs records observations and suggests candidates"
```

---

## Task 8: Promotion — project catalog entry → universal catalog

**Files:**
- Create: `plugins/machinery/scripts/promote-tool.mjs`
- Test: `plugins/machinery/test/promote-tool.test.mjs`

**Interfaces:**
- Consumes: `pluginRoot` from `lib/config.mjs`; the version-bump behaviour already used by `scripts/bump.mjs` (this task shells out to it rather than reimplementing the bump, per never-re-derive).
- Produces: `node scripts/promote-tool.mjs --id <id> --root <projectRoot>` — CLI only, no exported function needed (mirrors `install.mjs`'s shape).

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScript, PLUGIN } from './helpers/run.mjs';

function projectWithEntry(withFixture) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-'));
  fs.mkdirSync(path.join(root, '.claude', 'machinery'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'machinery', 'tool-catalog.json'),
    JSON.stringify({ 'my-tool': { match: { type: 'prefix', value: 'my-tool' }, outcome: '^done$', candidates: ['-q'] } }));
  if (withFixture) {
    fs.mkdirSync(path.join(root, '.claude', 'machinery', 'fixtures'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'machinery', 'fixtures', 'my-tool.json'), JSON.stringify({ lines: ['noise', 'done'] }));
  }
  return root;
}

test('promotion is refused without a fixture proving the outcome survives', () => {
  const root = projectWithEntry(false);
  const r = runScript('scripts/promote-tool.mjs', { args: ['--id', 'my-tool', '--root', root] });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /fixture/);
});

test('promotion copies the entry into the universal catalog and leaves the project catalog empty of it', () => {
  const root = projectWithEntry(true);
  const before = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'data', 'tool-catalog.json'), 'utf8'));
  assert.ok(!('my-tool' in before), 'test pollution: my-tool already promoted from a prior run');
  const r = runScript('scripts/promote-tool.mjs', { args: ['--id', 'my-tool', '--root', root] });
  assert.equal(r.code, 0, r.stderr);
  const after = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'data', 'tool-catalog.json'), 'utf8'));
  assert.ok('my-tool' in after);
  // Clean up: this test mutates the plugin's own tracked data file.
  delete after['my-tool'];
  fs.writeFileSync(path.join(PLUGIN, 'data', 'tool-catalog.json'), JSON.stringify(before, null, 2) + '\n');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/promote-tool.test.mjs`
Expected: FAIL — script does not exist.

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// Promotes a project's own tool-catalog entry into the universal catalog.
// Mirrors rule-intake's shape: propose (the project entry already exists),
// file (this script), bump (delegate to bump.mjs, never re-derive it).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pluginRoot } from './lib/config.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const id = opt('--id');
const root = opt('--root');
if (!id || !root) { process.stderr.write('usage: promote-tool.mjs --id <id> --root <projectRoot>\n'); process.exit(2); }

const projectCatalogPath = path.join(root, '.claude', 'machinery', 'tool-catalog.json');
const fixturePath = path.join(root, '.claude', 'machinery', 'fixtures', `${id}.json`);
if (!fs.existsSync(fixturePath)) {
  process.stderr.write(`promote-tool: refusing — no fixture at ${fixturePath}; an entry with no fixture is not an entry\n`);
  process.exit(1);
}
const projectCatalog = JSON.parse(fs.readFileSync(projectCatalogPath, 'utf8'));
if (!(id in projectCatalog)) { process.stderr.write(`promote-tool: '${id}' is not in ${projectCatalogPath}\n`); process.exit(1); }

const universalPath = path.join(pluginRoot(), 'data', 'tool-catalog.json');
const universal = JSON.parse(fs.readFileSync(universalPath, 'utf8'));
universal[id] = projectCatalog[id];
fs.writeFileSync(universalPath, JSON.stringify(universal, null, 2) + '\n');

const universalFixtureDir = path.join(pluginRoot(), 'test', 'fixtures', 'tool-catalog');
fs.mkdirSync(universalFixtureDir, { recursive: true });
fs.copyFileSync(fixturePath, path.join(universalFixtureDir, `${id}.json`));

execFileSync(process.execPath, [path.join(pluginRoot(), 'scripts', 'bump.mjs')], { stdio: 'inherit' });
process.stdout.write(`promoted '${id}' into the universal catalog; plugin version bumped\n`);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/machinery/test/promote-tool.test.mjs`
Expected: 2 pass. (The second test mutates and then restores `data/tool-catalog.json` — verify with `git status` that no diff remains after the run.)

- [ ] **Step 5: Commit**

```bash
git add plugins/machinery/scripts/promote-tool.mjs plugins/machinery/test/promote-tool.test.mjs
git commit -m "machinery: promote-tool.mjs moves a project catalog entry into the universal one"
```

---

## Task 9: Installer creates the two new project files

**Files:**
- Modify: `plugins/machinery/scripts/install.mjs`
- Test: `plugins/machinery/test/install.test.mjs` (existing tests must still pass; append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `.claude/machinery/tool-catalog.json` (tracked) and `.claude/machinery/observations.json` (gitignored), both `{}`, created alongside the existing `inbox.md`/`INDEX.md` in `installProject()`.

**Ruling (mid-execution, recorded 2026-09-05 during Task 7's review):** the two new files are not the same kind of data and must not be treated identically. `tool-catalog.json` is a team decision — which tools this project knows about and what quiets them — exactly like a project rule: shared, reviewed, sensibly tracked, same as `inbox.md`/`INDEX.md`. `observations.json` is per-machine measurement: a different developer's terminal width, installed tool version, or which subset of a monorepo they have checked out all change what "noisy" measures — tracking it turns every developer's local noise readings into spurious merge conflicts and stale data presented as fact. **`observations.json` is gitignored, not staged.** The originally drafted plan treated them identically; that was wrong and is corrected here before this task is dispatched.

- [ ] **Step 1: Write the failing test**

```js
// appended to test/install.test.mjs — follow that file's existing fixture-project pattern
test('install creates an empty project tool catalog and observation record', () => {
  const root = freshGitProject(); // however the existing tests in this file build one — reuse that helper
  runScript('scripts/install.mjs', { args: ['--root', root] });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.claude', 'machinery', 'tool-catalog.json'), 'utf8')), {});
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.claude', 'machinery', 'observations.json'), 'utf8')), {});
});

test('RED CHECK: tool-catalog.json is staged, observations.json is gitignored, not staged', () => {
  const root = freshGitProject();
  runScript('scripts/install.mjs', { args: ['--root', root] });
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' });
  assert.match(staged, /\.claude\/machinery\/tool-catalog\.json/, 'the shared catalog overlay must be staged');
  assert.doesNotMatch(staged, /\.claude\/machinery\/observations\.json/, 'per-machine measurement must never be staged');
  const ignored = execFileSync('git', ['check-ignore', '.claude/machinery/observations.json'], { cwd: root, encoding: 'utf8' });
  assert.match(ignored, /observations\.json/, 'observations.json must actually be gitignored, not merely unstaged this once');
});
```

Add `import { execFileSync } from 'node:child_process';` to this test file if not already present.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test plugins/machinery/test/install.test.mjs`
Expected: FAIL — files not created, and the gitignore entry doesn't exist yet.

- [ ] **Step 3: Update `installProject()` in `install.mjs`**

Immediately after the existing `inbox` creation block (`if (!fs.existsSync(inbox)) { ... }`), add:

```js
  const toolCatalog = path.join(mach, 'tool-catalog.json');
  if (!fs.existsSync(toolCatalog)) { fs.writeFileSync(toolCatalog, '{}\n'); say(`created ${path.relative(root, toolCatalog)}`); }
  const observations = path.join(mach, 'observations.json');
  if (!fs.existsSync(observations)) { fs.writeFileSync(observations, '{}\n'); say(`created ${path.relative(root, observations)}`); }
  const gitignore = path.join(root, '.gitignore');
  const ignoreLine = '.claude/machinery/observations.json';
  const existingIgnore = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
  if (!existingIgnore.split('\n').includes(ignoreLine)) {
    fs.writeFileSync(gitignore, existingIgnore + (existingIgnore && !existingIgnore.endsWith('\n') ? '\n' : '') + ignoreLine + '\n');
    say('added .claude/machinery/observations.json to .gitignore');
  }
```

Note the ordering: the `.gitignore` entry must be written and the file must exist on disk *before* the final `git add`, or `observations.json` would already be untracked-but-not-ignored at add time — harmless either way since it is never named in the add list below, but the ignore entry landing first is what makes `git check-ignore` (used by the test above) resolve correctly in the same run.

And extend the final `git add` call to stage the catalog and the `.gitignore` — **`observations.json` is deliberately absent from this list**:

```js
  git(['add', '--', '.claude/rules', '.claude/machinery/inbox.md', '.claude/machinery/INDEX.md',
       '.claude/machinery/tool-catalog.json', '.gitignore', '.githooks'], root);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test plugins/machinery/test/install.test.mjs`
Expected: all pass, including both new ones.

- [ ] **Step 5: Commit**

```bash
git add plugins/machinery/scripts/install.mjs plugins/machinery/test/install.test.mjs
git commit -m "machinery: install.mjs creates the project tool catalog and observation record"
```

---

## Task 10: End-to-end proof — the measurement that started this closes to zero

**Files:**
- Test: `plugins/machinery/test/assimilation-e2e.test.mjs`

**Interfaces:**
- Consumes: `classify` (existing), `loadCatalog`, `decide`, everything wired in Task 7.
- Produces: nothing new — this is a closing proof, not a new capability.

- [ ] **Step 1: Write the test reproducing the spec's own measurement**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../scripts/lib/classify.mjs';
import { decide } from '../scripts/lib/assimilate.mjs';

// The exact ten commands measured in the design spec, § The problem.
const COMMANDS = [
  'cargo test --workspace',
  'bash scripts/battery.sh',
  'bash scripts/merge-gate.sh',
  'scripts/testq.sh --workspace',
  'bash scripts/perf.sh',
  'bash scripts/prove-gcode-identical.sh HEAD~1',
  'python scripts/oracle_compare.py',
  'python scripts/register_check_test.py',
  'gh issue view 854',
  'git commit -m x',
];

test('RED CHECK: nothing plain-classified is left silently unobserved once the assimilator is consulted', () => {
  const catalog = {}; // empty — none of these ten are catalog tools; this proves the BESPOKE floor, not suggestion behaviour
  let stillSilent = 0;
  for (const cmd of COMMANDS) {
    const kind = classify(cmd);
    if (kind === 'infra' || kind === 'noisy') continue; // already handled before this plan existed
    const d = decide(cmd, { catalog, observations: {} });
    if (d.mode === 'plain') stillSilent++;
  }
  console.log(`assimilation_coverage: ${stillSilent} of ${COMMANDS.length} commands still silently unobserved (must be 0)`);
  assert.equal(stillSilent, 0);
});
```

- [ ] **Step 2: Run it**

Run: `node --test plugins/machinery/test/assimilation-e2e.test.mjs`
Expected: PASS, with `assimilation_coverage: 0 of 10 commands still silently unobserved (must be 0)` printed — this is the proof-line convention (rules/tool-output.md § Proof lines and denominators), and it is the direct closing of the gap the spec opened with.

- [ ] **Step 3: Run the entire suite one last time**

Run: `node --test 'plugins/machinery/test/*.test.mjs'`
Expected: every test in the plugin passes — this plan's own tasks plus everything that predates them.

- [ ] **Step 4: Commit**

```bash
git add plugins/machinery/test/assimilation-e2e.test.mjs
git commit -m "machinery: end-to-end proof — the spec's 6-of-10 gap measures 0-of-10 after assimilation"
```
