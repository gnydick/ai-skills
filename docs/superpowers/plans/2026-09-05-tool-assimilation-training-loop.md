# Tool Assimilation (Training Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bespoke tool earns its own answer line: the wrapper records each run and nudges, the session says which line of the log is the answer, the matcher falls out as a longest common prefix, graduates after two consecutive shadow agreements into a tracked project catalog entry with a frozen fixture, and goes back into training on its own when it drifts.

**Architecture:** Three new units under `scripts/lib/` — `runlog.mjs` (the per-run log's one format, written by the runner and read back by the trainer), `training.mjs` (the loop's arithmetic: prefix derivation, shadow comparison, the graduation count, the drift triggers — pure, no I/O) and `graduate.mjs` (the one gate that writes a learned entry and its fixture, judged by the same `survival.mjs` the suite and `promote-tool.mjs` already use). `quiet-run.mjs` gains the recording, drift and nudge steps at the end of every run; a new CLI `train-tool.mjs` is the session's half. Nothing model-driven runs inside a hook: the nudge is a line on the runner's own stdout, and identification happens when the session chooses to run the CLI.

**Tech Stack:** Node ≥ 18, `node:test` + `node:assert/strict`, no new dependencies (the plugin has no `package.json`, and `rules/environment-and-platform.md` § Dependencies forbids adding one without the owner's authorization).

**Spec:** `docs/superpowers/specs/2026-09-04-tool-assimilation-design.md` — sections `## What must survive: the preservation contract`, `## How an outcome pattern is learned` (all subsections), `## The nudge register`, `## Where things live`, `## Verification` items 9–13. Plan 1 (`docs/superpowers/plans/2026-09-05-tool-assimilation-core.md`) built the observe/decide/wrap machinery this plan extends; its shipped code is the floor here, read in full and named per task.

## Global Constraints

- **`PASS_THROUGH_LINES = 40`** and **`TAIL_LINES = 8`** (`scripts/lib/filter.mjs`) are the one definition of noisy and of the tail. "Noisy reuses the threshold the runner already declares — `PASS_THROUGH_LINES = 40`." The nudge fires only above it.
- **"Machine-derived patterns are prefix or literal only. Never regex."** and **"Regex is permitted only in the human-reviewed universal table."** A learned matcher is `{ type: 'prefix', value }` by construction (a longest common prefix), tested with `startsWith`, never compiled to a regex; the loader drops and names a learned entry carrying a regex string (Verification 9).
- **"Identification is the model's job; generalisation is not."** The session supplies a line index; the matcher is arithmetic. **"A single observation can never graduate."**
- **"The model in the loop is the session."** No hook blocks on inference; the runner records and nudges, the session runs `train-tool.mjs` in a turn it was already having, over logs the runner already wrote — so batch identification over stored logs works.
- **"After K consecutive agreements the matcher graduates."** K is `GRADUATION_AGREEMENTS = 2`, one named constant in `scripts/lib/training.mjs` (reasoning below).
- **"A matcher that cannot be graduated with a fixture is not graduated."** Graduation runs `survivalProblems()` over the frozen fixture before the first write, and refuses on any problem (Verification 11).
- **Drift re-opens training** on exactly three facts the wrapper already records: "the matcher matched **nothing** in a run", "the exit code was **non-zero** and no error block was found", "the output's shape moved materially — line count distribution, or the ratio between stdout and stderr" (Verification 12, each trigger asserted separately).
- **"The learned matcher only ever promotes a line into the kept set. It cannot remove one."** `select()` is not changed by this plan except that the second argument may be any object with a `test(line)` method; the final line, error blocks and proof lines survive whatever the matcher says (Verification 13).
- **"A suggestion is advisory and never blocks … a proposal, never an application."** The training nudge is one line on the runner's stdout after the output, the same channel as `[quiet:suggest]`; nothing rewrites a command or waits on the session.
- **"Project state goes in `.claude/machinery/`."** Training state (picks, streak, shape history, re-open) lives in the per-machine, gitignored `observations.json`; the graduated matcher lives in the tracked `.claude/machinery/tool-catalog.json`; the frozen fixture in the tracked `.claude/machinery/fixtures/<id>.json` — the path `promote-tool.mjs` already reads a project fixture from.
- **"The verdict is not promotable."** Nothing here writes to `data/tool-catalog.json`; a learned entry reaches the universal catalog only through `promote-tool.mjs`, which is unchanged.
- **"The observation record is JSON, read directly by the assimilator."** `decide()` is unchanged: a learned entry has zero candidates, so a noisy graduated tool wraps exactly as a noisy bespoke one did.
- **Byte-faithful runner.** The log is written verbatim (bare `\r`, ANSI intact) and `normalise()` runs once over the record texts, in one shared derivation, on the way to the display and on the way back out of the log.
- **Suite conventions.** Every new suite file carries a `RED CHECK:` (`test/meta.test.mjs`); expectations come from the input's own shape; `JSON.stringify` under `scripts/` only in `lib/emit.mjs` and the file-writers named in `test/purity.test.mjs` (this plan adds `lib/graduate.mjs` there); no file under `scripts/` but `lib/quotes.mjs` may name a quote character (`test/catalog.test.mjs`).
- **Time budget.** The pre-commit hook refuses the commit if the suite exceeds 15 s wall clock. Measured before this plan, 2026-09-05: 544 tests, 543 pass, 1 skipped, **12.0 s**. `node --test` runs suite files concurrently, so wall clock follows the longest file, not the sum: every spawning test this plan adds goes into a **new** file, never appended to `quiet.test.mjs` or `quiet-run.test.mjs`, and each task states its spawn count. Total added: 5 runner spawns (bash + node, ≈ 0.4 s each) and 12 CLI spawns (≈ 0.15 s each), in two new files.
- **Version bump.** `scripts/build-skills.mjs check` (run by the pre-commit) refuses a commit that changes `plugins/machinery` without moving `.claude-plugin/plugin.json`'s version. Every commit below runs `node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery` and stages `plugins/machinery/.claude-plugin/plugin.json`. The `--plugin` flag is deliberate: without it `bump.mjs` resolves `pluginRoot()`, which honours `CLAUDE_PLUGIN_ROOT` and could edit an installed cache instead of this checkout.
- **Commits.** Explicit pathspecs after `--`, never `--no-verify`, never `git add -A`.

---

## Decisions taken in planning

### K = 2 (`GRADUATION_AGREEMENTS`)

The spec fixes the mechanism — "K consecutive agreements" between the local matcher's pick and the session's — but not the number. The two costs weigh unevenly:

- **A wrong graduation is bounded and reversible.** The matcher can only promote a line into the kept set (the floor, `select()`), so the worst a wrong one does is show a few extra lines; and drift re-opens training the first run it matches nothing. Neither costs the user anything they have to notice.
- **A late graduation is paid in session attention**, per tool, per project, on every noisy run until it lands: each extra K is one more identified run, one more `Read` of a log and one more CLI call.

Given that asymmetry, K is the smallest count that is evidence rather than coincidence. The prefix exists only after two picks, and the first agreement after that proves only that the prefix fits a run it had not seen; a second, consecutive, is what separates a stable line from a prefix that happened to fit once. A third would buy nothing the frozen fixture does not already hold. So a tool graduates on its fourth identified run at the earliest (two to form, two to confirm), and the spec's own worked example — `test result:` after three runs — becomes graduation after four.

### Where a graduated matcher and its fixture live: tracked, in the project catalog

`## Where things live` puts "observations · which candidates were tried · whether they sufficed here" in the project, and Plan 1 (ruling 2026-09-05) split that into a tracked `tool-catalog.json` (a team decision) and a gitignored `observations.json` (per-machine measurement). The training loop produces three things, and they fall on different sides of that line:

- **Training state** — picks, the streak, the shape history, a re-open — is measurement in progress on this machine's runs. It goes in `observations.json`, gitignored. Losing it costs at most one more graduation's worth of runs.
- **The graduated matcher** is not a verdict about volume; it is the shape of the tool's own answer line, a property of the script in the repository, the same on every machine that runs it — exactly the class of fact the universal table holds for an off-the-shelf tool, with "universal" collapsing to "this project" because nobody else has `scripts/battery.sh`. It is written as a learned entry in the tracked `.claude/machinery/tool-catalog.json`, which is what `scripts/lib/assimilate.mjs` already expects ("a bespoke tool that earns an outcome pattern through the training loop lands in the project catalog with an `outcome` and no candidates"). The decision to track it is deliberate: a matcher one machine trained becomes a team artifact because a person on that machine read the log and identified the line, and the entry carries a `learned` mark saying a machine derived it.
- **The frozen fixture** is the matcher's regression test, and a test belongs beside the code it guards: tracked, at `.claude/machinery/fixtures/<id>.json`, which is the path `promote-tool.mjs` already reads a project fixture from. A tool believed bespoke that turns out to be off-the-shelf therefore promotes with the existing command and no new mechanism.

One consequence is named rather than discovered: the catalog id is a filename-safe slug of the bespoke key (`bash scripts/battery.sh` → `bash-scripts-battery.sh`), so on the graduating machine the observation record is moved from the key to the id in the same write, and on every other machine the tool is observed once under its new id when the catalog arrives — the same one-verbatim-run cost the spec states for meeting any new tool.

---

## File Structure

| Path | Responsibility |
|---|---|
| `plugins/machinery/scripts/lib/runlog.mjs` | New. The per-run log: `logDir()`, `formatRunLog()`, `parseRunLog()`, `linesOf()` (the one display derivation), `listRunLogs()`. |
| `plugins/machinery/scripts/lib/filter.mjs` | Modified (Task 2): exports `hasErrorBlock(lines)`. `select()` unchanged. |
| `plugins/machinery/scripts/lib/catalog.mjs` | Modified (Task 3): `outcomeMatcher(entry)` — the one compiler of an `outcome` (regex string, or `{type:'prefix'|'literal', value}`); `isLearned(entry)`; `entryProblem()` exported and refusing a learned entry whose outcome is not prefix/literal. |
| `plugins/machinery/scripts/lib/survival.mjs` | Modified (Task 3): compiles the outcome through `outcomeMatcher()`. |
| `plugins/machinery/scripts/lib/training.mjs` | New (Task 4). Pure: constants (`GRADUATION_AGREEMENTS` …), `commonPrefix`, `deriveMatcher`, `shadowPick`, `identify`, `noteRun`, `shapeMoved`, `driftReason`, `reopen`, `graduated`, `learnedId`, `learnedEntry`, `frozenFixture`, `trainingOf`, `emptyTraining`. |
| `plugins/machinery/scripts/lib/observations.mjs` | Modified (Task 5): `recordRun` carries `training` forward; `withTraining()`, `moveRecord()`. |
| `plugins/machinery/scripts/lib/graduate.mjs` | New (Task 6). `graduate()` — refuses before the first write, then writes the fixture, the learned entry, and moves the record. |
| `plugins/machinery/scripts/quiet-run.mjs` | Modified (Tasks 1, 3, 7): log via `runlog.mjs`; outcome via `outcomeMatcher()`; notes runs, judges drift, prints the `[quiet:train]` nudge. |
| `plugins/machinery/scripts/train-tool.mjs` | New (Task 8). CLI: `identify --log <file> --line <N>`, `logs [--key <key>]`. |
| `claude-code/machinery/train-tool/SKILL.md`, `skills.manifest.json`, `plugins/machinery/skills/train-tool/SKILL.md` | New / modified (Task 9): the session's procedure, routed and built. |
| `plugins/machinery/README.md` | Modified (Task 9): one paragraph under "Teaching it a tool". |
| `plugins/machinery/test/lib-runlog.test.mjs` | New (Task 1). |
| `plugins/machinery/test/lib-filter.test.mjs` | Appended (Task 2): `hasErrorBlock`, Verification 13. |
| `plugins/machinery/test/catalog.test.mjs` | Appended (Task 3): `outcomeMatcher`, learned-entry loading, survival on the prefix form. |
| `plugins/machinery/test/quiet-run-training.test.mjs` | New (Task 3), appended (Task 7). The runner's training seam; every bash spawn this plan adds to the runner lives here. |
| `plugins/machinery/test/lib-training.test.mjs` | New (Task 4). Verification 10, 12, K. |
| `plugins/machinery/test/observations.test.mjs` | Appended (Task 5). |
| `plugins/machinery/test/lib-graduate.test.mjs` | New (Task 6). Verification 9 (gate), 11. |
| `plugins/machinery/test/purity.test.mjs` | Modified (Task 6): `lib/graduate.mjs` joins the file-writer exemption. |
| `plugins/machinery/test/train-tool.test.mjs` | New (Task 8). The loop end to end over synthetic logs. |
| `plugins/machinery/test/skills.test.mjs` | Modified (Task 9): seven skills become eight. |

---

## Task 1: The run log has one home

**Files:**
- Create: `plugins/machinery/scripts/lib/runlog.mjs`
- Modify: `plugins/machinery/scripts/quiet-run.mjs` (imports, `logDir`, the log write, the `lines` derivation)
- Test: `plugins/machinery/test/lib-runlog.test.mjs`

**Interfaces:**
- Consumes: `normalise` from `scripts/lib/filter.mjs` (unchanged).
- Produces:
  - `export function logDir()` → the directory the runner writes logs into (`$CLAUDE_JOB_DIR/tmp`, else `<os.tmpdir()>/claude-quiet`). Moved verbatim from `quiet-run.mjs`.
  - `export function formatRunLog(command, records)` → the log text: `$ <command>\n` then one line per record `<t.toFixed(3)> <out|err>  <text>\n`. Byte-identical to what `quiet-run.mjs` wrote before this task.
  - `export function parseRunLog(text)` → `{ command: string, records: Array<{ t: number, stream: 'stdout'|'stderr', text: string }> }`. Throws an `Error` with a reason on text that is not a run log.
  - `export function linesOf(records)` → `normalise(records.map((r) => r.text).join('\n'))` — the display lines. The runner and the trainer both call this and nothing else.
  - `export function listRunLogs(dir = logDir())` → absolute paths of `quiet-*.log` in `dir`, newest stamp first; `[]` when the directory does not exist.

**Test cost:** 0 spawns; in-memory plus one temp directory.

- [ ] **Step 1: Write the failing tests**

```js
// plugins/machinery/test/lib-runlog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatRunLog, parseRunLog, linesOf, listRunLogs, logDir } from '../scripts/lib/runlog.mjs';
import { normalise } from '../scripts/lib/filter.mjs';

const RECORDS = [
  { t: 0.412, stream: 'stdout', text: 'running 128 tests' },
  { t: 0.418, stream: 'stderr', text: '   Compiling fs-core v0.1.0' },
  { t: 1.5, stream: 'stdout', text: '10%\r50%\r100%' },          // a bare \r: progress frames, verbatim
  { t: 2, stream: 'stdout', text: '\x1b[32mgreen\x1b[0m   ' },   // ANSI and trailing spaces, verbatim
  { t: 8.902, stream: 'stdout', text: '' },                        // an empty record is a record
  { t: 8.903, stream: 'stdout', text: 'test result: ok. 128 passed; 0 failed' },
];

test('the log format is the one the runner has always written: $ command, then <t> <out|err>  <text>', () => {
  const log = formatRunLog('cargo test --workspace', RECORDS.slice(0, 2));
  assert.equal(log, '$ cargo test --workspace\n0.412 out  running 128 tests\n0.418 err     Compiling fs-core v0.1.0\n');
  assert.equal(formatRunLog('true', []), '$ true\n');
});

test('parse is the inverse of format, byte for byte, including a bare \\r, ANSI, trailing spaces and an empty record', () => {
  const { command, records } = parseRunLog(formatRunLog('cargo test --workspace', RECORDS));
  assert.equal(command, 'cargo test --workspace');
  assert.deepEqual(records, RECORDS.map((r) => ({ ...r, t: Number(r.t.toFixed(3)) })));
});

test('a multi-line command round-trips: the header runs until the first record line', () => {
  const cmd = 'cargo build\ncargo test';
  const { command, records } = parseRunLog(formatRunLog(cmd, RECORDS.slice(0, 1)));
  assert.equal(command, cmd);
  assert.equal(records.length, 1);
});

test('linesOf is the display derivation: what the runner shows and what the trainer reads are one normalise() over the same texts', () => {
  const { records } = parseRunLog(formatRunLog('x', RECORDS));
  assert.deepEqual(linesOf(records), normalise(RECORDS.map((r) => r.text).join('\n')));
  // Derived by hand from normalise()'s own rules: last \r frame wins, ANSI stripped, trailing spaces
  // trimmed, an interior empty line kept.
  assert.deepEqual(linesOf(records), ['running 128 tests', '   Compiling fs-core v0.1.0', '100%', 'green', '', 'test result: ok. 128 passed; 0 failed']);
});

test('RED CHECK: text that is not a run log is refused with a reason, never parsed into nonsense', () => {
  assert.throws(() => parseRunLog('not a log\n'), /first line/);
  assert.throws(() => parseRunLog('$ x\n0.100 out  fine\nthis is neither\n'), /line 3/);
});

test('logDir honours CLAUDE_JOB_DIR and falls back to the temp dir; listRunLogs lists quiet-*.log newest stamp first', () => {
  const saved = process.env.CLAUDE_JOB_DIR;
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'runlog-'));
  try {
    process.env.CLAUDE_JOB_DIR = job;
    assert.equal(logDir(), path.join(job, 'tmp'));
    fs.mkdirSync(logDir());
    for (const n of ['quiet-20260905-100000-1.log', 'quiet-20260905-120000-2.log', 'quiet-20260904-235959-3.log', 'other.txt']) fs.writeFileSync(path.join(logDir(), n), '$ x\n');
    assert.deepEqual(listRunLogs().map((f) => path.basename(f)), ['quiet-20260905-120000-2.log', 'quiet-20260905-100000-1.log', 'quiet-20260904-235959-3.log']);
    delete process.env.CLAUDE_JOB_DIR;
    assert.equal(logDir(), path.join(os.tmpdir(), 'claude-quiet'));
    assert.deepEqual(listRunLogs(path.join(job, 'no-such-dir')), []);
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_JOB_DIR; else process.env.CLAUDE_JOB_DIR = saved;
    fs.rmSync(job, { recursive: true, force: true, maxRetries: 5 });
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/lib-runlog.test.mjs`
Expected: FAIL — `runlog.mjs` does not exist.

- [ ] **Step 3: Implement `runlog.mjs`**

```js
// plugins/machinery/scripts/lib/runlog.mjs
// The one home of the per-run log: where it lives, how a run is written into it, and how it is read
// back. Two readers of the same bytes — quiet-run.mjs writes one after every wrapped run, and
// train-tool.mjs reads one when the session identifies a tool's answer line in it — so the format is
// spelled once (rules/design-invariants.md § Never re-derive a fact). The log is verbatim: a record's
// text keeps its bare \r and its ANSI, because filter.mjs's normalise() owns collapsing progress
// frames and stripping colour, and it runs on the way OUT of the records exactly as it runs on the
// way to the display. linesOf() is that single derivation; the runner and the trainer both call it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalise } from './filter.mjs';

export function logDir() {
  const job = process.env.CLAUDE_JOB_DIR;
  return job ? path.join(job, 'tmp') : path.join(os.tmpdir(), 'claude-quiet');
}

// `$ <command>` first, then one line per record: the offset in seconds to three places, a three-letter
// stream tag, two spaces, the text verbatim. A record's text never contains \n — lib/lines.mjs split on
// it — so a record is exactly one line of the file, and a multi-line command is however many lines it
// has before the first record.
const TAG = { stdout: 'out', stderr: 'err' };
export function formatRunLog(command, records) {
  const body = records.map((r) => `${r.t.toFixed(3)} ${TAG[r.stream]}  ${r.text}`).join('\n');
  return `$ ${command}\n${body}${body ? '\n' : ''}`;
}

// The `s` flag makes `.` match a bare \r inside the text; without it a progress-frame record would
// fail to parse as a record at all. `$` without `m` is the end of this one line only.
const RECORD = /^(\d+\.\d{3}) (out|err)  (.*)$/s;
export function parseRunLog(text) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (!lines.length || !lines[0].startsWith('$ ')) throw new Error('not a run log: the first line does not start with a dollar sign and a space');
  const command = [lines[0].slice(2)];
  const records = [];
  let i = 1;
  while (i < lines.length && !RECORD.test(lines[i])) command.push(lines[i++]);
  for (; i < lines.length; i++) {
    const m = RECORD.exec(lines[i]);
    if (!m) throw new Error(`not a run log: line ${i + 1} is neither a record nor part of the command`);
    records.push({ t: Number(m[1]), stream: m[2] === 'out' ? 'stdout' : 'stderr', text: m[3] });
  }
  return { command: command.join('\n'), records };
}

export const linesOf = (records) => normalise(records.map((r) => r.text).join('\n'));

// The stamp in a log's name (YYYYMMDD-HHMMSS) sorts lexically, so newest first is a name sort reversed;
// no stat per file. A directory that is not there holds no logs.
export function listRunLogs(dir = logDir()) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((n) => /^quiet-.*\.log$/.test(n)).sort().reverse().map((n) => path.join(dir, n));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test plugins/machinery/test/lib-runlog.test.mjs`
Expected: 6 pass.

- [ ] **Step 5: Point the runner at it — a move with no change in behaviour**

In `plugins/machinery/scripts/quiet-run.mjs`:

Replace the import lines
```js
import os from 'node:os';
import path from 'node:path';
import { normalise, select, selectInfra, render, PASS_THROUGH_LINES, MAX_SHOWN } from './lib/filter.mjs';
```
with
```js
import path from 'node:path';
import { select, selectInfra, render, PASS_THROUGH_LINES, MAX_SHOWN } from './lib/filter.mjs';
import { logDir, formatRunLog, linesOf } from './lib/runlog.mjs';
```

Delete the whole `function logDir() { … }` block (its body now lives in `runlog.mjs`).

Replace
```js
  const lines = normalise(records.map((r) => r.text).join('\n'));
```
with
```js
  // linesOf() is the one derivation of the display lines — normalise() over the record texts — and
  // train-tool.mjs reads the same lines back out of the log through the same function, so the index
  // the session identifies is an index into exactly what was shown.
  const lines = linesOf(records);
```

Replace
```js
    const body = records.map((r) => `${r.t.toFixed(3)} ${r.stream === 'stdout' ? 'out' : 'err'}  ${r.text}`).join('\n');
    fs.writeFileSync(logPath, `$ ${command}\n${body}${body ? '\n' : ''}`);
```
with
```js
    fs.writeFileSync(logPath, formatRunLog(command, records));
```
Leave the comment above it ("The log keeps what the display path cannot …") in place.

- [ ] **Step 6: Run the runner's existing suite — the log format is pinned there**

Run: `node --test plugins/machinery/test/quiet-run.test.mjs`
Expected: all pass, unmodified — `stderr and stdout both reach the log, each tagged, in real arrival order` reads the log body back with the exact `err  e1` / `out  o1` shape, and `displayed lines still go through normalise` pins the display derivation.

- [ ] **Step 7: Run the whole suite, then commit**

Run: `node --test 'plugins/machinery/test/*.test.mjs'`
Expected: all pass, 0 fail.

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- plugins/machinery/scripts/lib/runlog.mjs plugins/machinery/scripts/quiet-run.mjs plugins/machinery/test/lib-runlog.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: the per-run log has one home, lib/runlog.mjs, written by the runner and readable back"
```

---

## Task 2: `hasErrorBlock`, and the floor under a learned matcher (Verification 13)

**Files:**
- Modify: `plugins/machinery/scripts/lib/filter.mjs`
- Test: `plugins/machinery/test/lib-filter.test.mjs` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export const hasErrorBlock = (lines) => boolean` — true when any line matches `BLOCK_START`, the same regex `select()` opens an error block on. `select(lines, outcomePattern)` is unchanged; this task pins that `outcomePattern` may be any object with a `test(line)` method (a RegExp has one; so does the prefix matcher Task 3 builds).

**Test cost:** 0 spawns.

- [ ] **Step 1: Write the failing tests — append to `lib-filter.test.mjs`, after the `outcomeCorpus` tests at its end**

```js
// ---- The training loop: the drift trigger's error-block fact, and the floor (design Verification 13) ----

test('hasErrorBlock reads the same rule select() opens a block on', () => {
  assert.equal(hasErrorBlock(['   Compiling a', 'error[E0599]: no method', '  --> x']), true);
  assert.equal(hasErrorBlock(['   Compiling a', 'test result: ok. 3 passed; 0 failed']), false);
  assert.equal(hasErrorBlock([]), false);
});

// A deliberately WRONG learned matcher — a prefix nothing in the corpus starts with — leaves the floor
// exactly as it was: the final line, the error block and the proof lines survive, and nothing kept
// without the matcher is lost. This is the bound that makes model-trained matching acceptable, so it
// is tested rather than argued.
test('V13: a wrong learned matcher promotes nothing and removes nothing — the floor stands', () => {
  const wrong = { test: (line) => line.startsWith('NOTHING STARTS WITH THIS') };
  const without = sorted(select(outcomeCorpus()));
  const withWrong = sorted(select(outcomeCorpus(), wrong));
  assert.deepEqual(withWrong, without);
  assert.ok(withWrong.includes(17), 'the final line survives');
  assert.ok(withWrong.includes(2) && withWrong.includes(3), 'the error block survives');
  assert.ok(withWrong.includes(6) && withWrong.includes(7), 'the proof lines survive');
});

test('V13: a learned matcher that matches a line ADDS it and can subtract nothing — the kept set only grows', () => {
  const matcher = { test: (line) => line.startsWith('   Compiling a') }; // index 0: a chatter line, outside the tail
  const without = sorted(select(outcomeCorpus()));
  const withIt = sorted(select(outcomeCorpus(), matcher));
  assert.deepEqual(withIt, [0, ...without]);
});
```

Change the file's first import line to
```js
import { normalise, select, selectInfra, render, hasErrorBlock, MAX_SHOWN, PASS_THROUGH_LINES } from '../scripts/lib/filter.mjs';
```

- [ ] **Step 2: Run to verify the first test fails**

Run: `node --test plugins/machinery/test/lib-filter.test.mjs`
Expected: `hasErrorBlock` test FAILs (not exported); the two V13 tests already pass against today's `select()` — that is the point: the floor exists today, and these pin it before a matcher object is ever passed in production.

- [ ] **Step 3: Implement**

In `plugins/machinery/scripts/lib/filter.mjs`, after the `select()` function:

```js
// The one authority on "an error block starts here", exported for the training loop's drift trigger
// ("the exit code was non-zero and no error block was found"). It reads BLOCK_START, the regex
// select() opens a block on, so the wrapper and the filter cannot disagree about what a block is.
export const hasErrorBlock = (lines) => lines.some((l) => BLOCK_START.test(l));
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test plugins/machinery/test/lib-filter.test.mjs`
Expected: all pass (the file's prior tests plus 3).

- [ ] **Step 5: Commit**

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- plugins/machinery/scripts/lib/filter.mjs plugins/machinery/test/lib-filter.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: filter.mjs exports hasErrorBlock; the floor under a learned matcher is pinned (design V13)"
```

---
## Task 3: One compiler for an `outcome`, and the machine-derived form (Verification 9 at load)

**Files:**
- Modify: `plugins/machinery/scripts/lib/catalog.mjs`
- Modify: `plugins/machinery/scripts/lib/survival.mjs`
- Modify: `plugins/machinery/scripts/quiet-run.mjs` (the outcome-pattern line)
- Test: `plugins/machinery/test/catalog.test.mjs` (append)
- Test: `plugins/machinery/test/quiet-run-training.test.mjs` (new)

**Interfaces:**
- Consumes: `select` (unchanged), `survivalProblems` (its outcome compilation changes here).
- Produces:
  - `export function outcomeMatcher(entry)` → `undefined` when `entry.outcome` is absent; a `RegExp` when it is a non-empty string; `{ type: 'prefix', value, test(line) }` or `{ type: 'literal', value, test(line) }` when it is `{ type, value }` with a non-empty string value; throws an `Error` whose message contains the word `outcome` on any other shape. Every reader of an `outcome` — the runner, `survival.mjs` — goes through this.
  - `export const isLearned = (entry) => boolean` — true when `entry.learned` is a plain object.
  - `export function entryProblem(entry)` → the existing function, now exported, plus one rule: a learned entry whose `outcome` is not `{ type: 'prefix' | 'literal', value: non-empty string }` returns a problem whose text contains `never a regex`.
  - The catalog entry shape gains two optional fields: `outcome` may be `{ "type": "prefix" | "literal", "value": string }` as well as a regex string; `learned: { at: string, picks: number }` marks an entry the training loop wrote.

**Test cost:** 2 runner spawns (bash + node), in a new file so they run beside the other suites rather than after them.

- [ ] **Step 1: Write the failing tests — append to `catalog.test.mjs`**

Change the file's `catalog.mjs` import line to
```js
import { loadCatalog, loadCatalogReport, matchTool, matchedCandidate, outcomeMatcher, isLearned, entryProblem } from '../scripts/lib/catalog.mjs';
```

Append at the end of the file (`projectWith()` is defined higher up in this file and is reused):

```js
// ---- The training loop: the machine-derived outcome form (design, "Match techniques") ----

test('outcomeMatcher: a string is a regex, an object is a prefix or literal tested without any regex, absence is undefined', () => {
  assert.ok(outcomeMatcher({ outcome: '^test result:' }) instanceof RegExp);
  const p = outcomeMatcher({ outcome: { type: 'prefix', value: 'test result: ' } });
  assert.ok(!(p instanceof RegExp));
  assert.equal(p.type, 'prefix'); assert.equal(p.value, 'test result: ');
  assert.equal(p.test('test result: ok. 3 passed'), true);
  assert.equal(p.test('  test result: ok'), false, 'a prefix is anchored at column 0 by construction');
  assert.equal(p.test('test result:'), false, 'shorter than the prefix is not a match');
  const l = outcomeMatcher({ outcome: { type: 'literal', value: 'DONE' } });
  assert.equal(l.test('DONE'), true);
  assert.equal(l.test('DONE.'), false);
  assert.equal(outcomeMatcher({}), undefined);
  assert.equal(outcomeMatcher(undefined), undefined);
});

test('RED CHECK — V9 at the compiler: regex metacharacters in a prefix are characters, never syntax', () => {
  const p = outcomeMatcher({ outcome: { type: 'prefix', value: '[main (root-commit)' } });
  assert.equal(p.test('[main (root-commit) a1b2c3d] x'), true);
  assert.equal(p.test('main root-commit a1b2c3d'), false);
  assert.throws(() => outcomeMatcher({ outcome: '[main (root-commit)' }), 'the same text as a regex is unusable, which is exactly why a machine never writes one');
});

test('outcomeMatcher throws, naming the outcome, on every other shape', () => {
  for (const outcome of ['', { type: 'regex', value: 'x' }, { type: 'prefix' }, { type: 'prefix', value: '' }, 42, ['x']]) {
    assert.throws(() => outcomeMatcher({ outcome }), /outcome/, String(outcome));
  }
});

test('V9 at load: a learned entry whose outcome is a regex string is dropped and named; a learned prefix entry and a hand-written regex entry both load', () => {
  const tmp = projectWith({
    smuggled: { match: { type: 'prefix', value: 'scripts/a.sh' }, outcome: '^done', candidates: [], learned: { at: '2026-09-05T00:00:00Z', picks: 4 } },
    earned: { match: { type: 'prefix', value: 'scripts/b.sh' }, outcome: { type: 'prefix', value: 'done: ' }, candidates: [], learned: { at: '2026-09-05T00:00:00Z', picks: 4 } },
    hand: { match: { type: 'prefix', value: 'scripts/c.sh' }, outcome: '^done', candidates: [] },
  });
  const { catalog, dropped } = loadCatalogReport(tmp);
  assert.ok(catalog.earned && catalog.hand);
  assert.ok(!('smuggled' in catalog));
  assert.deepEqual(dropped.map((d) => d.id), ['smuggled']);
  assert.match(dropped[0].problem, /never a regex/);
  assert.equal(isLearned(catalog.earned), true);
  assert.equal(isLearned(catalog.hand), false);
  assert.equal(entryProblem(catalog.earned), null);
});

test('survivalProblems judges the prefix form by the same rules: it must match every answer and no non-answer', () => {
  const fixture = { source: 't', answers: [1], lines: ['widgets: alpha', 'widgets built: 3', 'cleanup'] };
  assert.deepEqual(survivalProblems('t', { outcome: { type: 'prefix', value: 'widgets built: ' } }, fixture), []);
  const wide = survivalProblems('t', { outcome: { type: 'prefix', value: 'widgets' } }, fixture);
  assert.ok(wide.some((p) => /also matches a non-answer line 0/.test(p)), wide.join('\n'));
  const broken = survivalProblems('t', { outcome: { type: 'prefix', value: '' } }, fixture);
  assert.ok(broken.some((p) => /unusable/.test(p)), broken.join('\n'));
  const none = survivalProblems('t', { candidates: [] }, fixture);
  assert.ok(none.some((p) => /declares no `outcome`/.test(p)), none.join('\n'));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/catalog.test.mjs`
Expected: FAIL — `outcomeMatcher`, `isLearned` and `entryProblem` are not exported.

- [ ] **Step 3: Implement in `catalog.mjs`**

Change `function entryProblem(entry) {` to `export function entryProblem(entry) {`, and insert before its final `return null;`:

```js
  // Design verification 9: a machine-derived pattern is prefix or literal, never regex. The writer
  // (lib/graduate.mjs) can only produce the object form; this is the check over the record for
  // anything that arrived another way — a hand edit, an older file. A learned entry carrying a
  // regex string is dropped and named, and the tool falls back to the generic contract.
  if (isObject(entry.learned)) {
    const o = entry.outcome;
    if (!isObject(o) || (o.type !== 'prefix' && o.type !== 'literal') || typeof o.value !== 'string' || o.value === '')
      return 'a "learned" entry must carry an outcome of the form { type: prefix | literal, value }: a machine-derived pattern is never a regex (design verification 9)';
  }
```

Append at the end of the file:

```js
// The one compiler of an entry's `outcome` into the thing select() tests lines with. Two forms, one
// per half of the design ("Match techniques, and which are allowed where"): a STRING is a regex — the
// human-reviewed universal form, a person has read it and a fixture exercises it — and an OBJECT
// { type: prefix | literal, value } is the machine-derived form, which can neither over-match
// silently nor backtrack. A prefix or literal is never compiled to a regex: it is tested by
// startsWith or equality, so there is no escaping step to get wrong. Returns undefined when the entry
// declares no outcome; throws, with a reason, on any other shape — the caller decides what a
// malformed outcome costs (the runner warns and falls back to the generic filter).
export function outcomeMatcher(entry) {
  const o = entry?.outcome;
  if (o === undefined) return undefined;
  if (typeof o === 'string') {
    if (o === '') throw new Error('the outcome pattern is empty');
    return new RegExp(o);
  }
  if (isObject(o) && typeof o.value === 'string' && o.value !== '') {
    if (o.type === 'prefix') return { type: 'prefix', value: o.value, test: (line) => line.startsWith(o.value) };
    if (o.type === 'literal') return { type: 'literal', value: o.value, test: (line) => line === o.value };
  }
  throw new Error('the outcome is neither a regex string nor an object of the form { type: prefix | literal, value }');
}

// A learned entry is one the training loop wrote (lib/graduate.mjs), marked by its `learned` field.
// The mark is what drift acts on and what a later graduation may overwrite; an entry without it was
// written by a person and is never trained over.
export const isLearned = (entry) => isObject(entry) && isObject(entry.learned);
```

- [ ] **Step 4: Route `survival.mjs` through the compiler**

In `plugins/machinery/scripts/lib/survival.mjs`, add the import
```js
import { outcomeMatcher } from './catalog.mjs';
```
and replace
```js
  if (typeof entry.outcome !== 'string' || entry.outcome === '') { bad('the catalog entry declares no `outcome` pattern'); return problems; }
  let outcome;
  try { outcome = new RegExp(entry.outcome); } catch (e) { bad(`the \`outcome\` pattern is not a valid regular expression: ${e.message}`); return problems; }
```
with
```js
  // One compiler for the outcome (catalog.mjs), so the prefix form a graduation writes is judged by
  // exactly the object select() will be handed, not by a second reading of the same field.
  let outcome;
  try { outcome = outcomeMatcher(entry); } catch (e) { bad(`the \`outcome\` pattern is unusable: ${e.message}`); return problems; }
  if (outcome === undefined) { bad('the catalog entry declares no `outcome` pattern'); return problems; }
```

- [ ] **Step 5: Route the runner through it**

In `plugins/machinery/scripts/quiet-run.mjs`, change the catalog import to
```js
import { loadCatalog, matchTool, matchedCandidate, outcomeMatcher } from './lib/catalog.mjs';
```
and replace
```js
    if (toolId && catalog[toolId].outcome) outcomePattern = new RegExp(catalog[toolId].outcome);
```
with
```js
    // outcomeMatcher() is the one compiler: a regex for a hand-written entry, a startsWith test for a
    // learned one, undefined for none. It is non-global by construction either way — a catalog
    // `outcome` carries no flag information — which is what keeps select() clear of the lastIndex
    // statefulness a /g or /y pattern brings (Task 3 of the core plan). A malformed outcome throws
    // here and is caught below like the other two catalog reads.
    if (toolId) outcomePattern = outcomeMatcher(catalog[toolId]);
```
The comment block that previously sat above the deleted line (beginning "A missing `outcome` stays undefined …") is replaced by the one above.

- [ ] **Step 6: Run the catalog, promote-tool and runner suites**

Run: `node --test plugins/machinery/test/catalog.test.mjs plugins/machinery/test/promote-tool.test.mjs plugins/machinery/test/quiet-run.test.mjs`
Expected: all pass. `promote-tool.test.mjs`'s refusal messages (`does not prove`, `declares no answer lines`, `does not match a line this tool really emits`, `also matches a non-answer line`) are unchanged by this task; `quiet-run.test.mjs`'s `an unusable catalog entry warns and degrades` still sees `quiet-run: unusable tool catalog` because `outcomeMatcher` throws where `new RegExp` did.

- [ ] **Step 7: Write the runner-level proof — the new file `quiet-run-training.test.mjs`**

```js
// plugins/machinery/test/quiet-run-training.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript } from './helpers/run.mjs';

// The runner's training-loop seam, in a file of its own: node --test runs suite FILES concurrently,
// so a new file adds to the wall clock only what it costs on its own, where appending bash-spawning
// cases to quiet-run.test.mjs would lengthen the longest pole (the pre-commit budget).
const bash = fs.existsSync('C:/Program Files/Git/bin/bash.exe') || process.platform !== 'win32';
const repo = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); execFileSync('git', ['init', '-q'], { cwd: d }); return d; };
const seed = (root, name, data) => { const dir = path.join(root, '.claude', 'machinery'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), JSON.stringify(data)); };
const obsOf = (root) => JSON.parse(fs.readFileSync(path.join(root, '.claude', 'machinery', 'observations.json'), 'utf8'));
const run = (root, mode, cmd) => runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', mode, '-c', cmd] });
const AT = '2026-09-05T12:00:00.000Z';
// 101 lines, the answer at line 11 — far outside the tail, kept by no generic rule.
const ANSWER_RUN = `node -e "for(let i=0;i<100;i++){if(i===10)console.log('ANSWER 42');console.log('   Compiling c'+i)}"`;
const LEARNED = { node: { match: { type: 'prefix', value: 'node' }, outcome: { type: 'prefix', value: 'ANSWER ' }, candidates: [], learned: { at: AT, picks: 4 } } };

test('RED CHECK (control): without a learned entry the buried answer line is dropped by the generic contract', { skip: !bash }, () => {
  const root = repo('quiet-train-control-');
  const r = run(root, 'filter', ANSWER_RUN);
  assert.doesNotMatch(r.stdout, /ANSWER 42/);
});

test("a learned prefix entry's answer line survives filtering, applied through the same seam as a declared regex", { skip: !bash }, () => {
  const root = repo('quiet-train-learned-');
  seed(root, 'tool-catalog.json', LEARNED);
  const r = run(root, 'filter', ANSWER_RUN);
  assert.match(r.stdout, /ANSWER 42/);
  // stderr is not empty here: the first save in a fresh repository says it added the .gitignore
  // entry (pinned in quiet-run.test.mjs). What must be absent is the catalog warning.
  assert.doesNotMatch(r.stderr, /unusable tool catalog/, 'a well-formed learned entry raises no catalog warning');
});
```

- [ ] **Step 8: Run it, then the whole suite, then commit**

Run: `node --test plugins/machinery/test/quiet-run-training.test.mjs`
Expected: 2 pass.

Run: `node --test 'plugins/machinery/test/*.test.mjs'`
Expected: all pass, 0 fail.

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- plugins/machinery/scripts/lib/catalog.mjs plugins/machinery/scripts/lib/survival.mjs plugins/machinery/scripts/quiet-run.mjs plugins/machinery/test/catalog.test.mjs plugins/machinery/test/quiet-run-training.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: outcomeMatcher() compiles an outcome once; a learned entry's outcome is prefix or literal, never regex (design V9)"
```

---
## Task 4: The loop's arithmetic — `lib/training.mjs` (Verification 10, 12; K)

**Files:**
- Create: `plugins/machinery/scripts/lib/training.mjs`
- Test: `plugins/machinery/test/lib-training.test.mjs`

**Interfaces:**
- Consumes: `outcomeMatcher` from Task 3 (so the shadow pick uses the same `startsWith` test the runner will).
- Produces (all pure; `training` is the sub-record `{ picks: Array<{ text, log, at }>, streak: number, history: Array<{ lines, stdoutLines, stderrLines, code }>, lastLog?: string, open?: { reason, log, at } }`):
  - Constants: `GRADUATION_AGREEMENTS = 2`, `PICK_WINDOW = 8`, `SHAPE_WINDOW = 5`, `SHAPE_FACTOR = 3`, `SHAPE_SHARE_DELTA = 0.5`.
  - `export const emptyTraining = () => ({ picks: [], streak: 0, history: [] })`
  - `export function trainingOf(rec)` → a well-shaped `training` read off an observation record (any malformed field reads as empty).
  - `export function commonPrefix(strings)` → string.
  - `export function deriveMatcher(picks)` → `{ type: 'prefix', value }` or `null` (fewer than two picks, or an empty common prefix).
  - `export function shadowPick(matcher, lines)` → the indices of every line the matcher matches.
  - `export function identify(training, { lines, index, log, at })` → `{ training, agreed: true|false|null, matcher, graduates: boolean }`.
  - `export function noteRun(training, { log, lines, stdoutLines, stderrLines, code })` → `training` with the run appended to `history` (bounded) and `lastLog` set.
  - `export function shapeMoved(history, run)` → boolean. `export function driftReason(training, run)` → `'matched-nothing' | 'nonzero-without-error-block' | 'shape' | null`, where `run` is `{ matched, code, errorBlock, lines, stdoutLines, stderrLines }`.
  - `export const reopen = (training, reason, log, at)` → `training` with `picks: []`, `streak: 0`, `open: { reason, log, at }`.
  - `export const graduated = (training)` → `training` with `picks: []`, `streak: 0` and no `open`.
  - `export function learnedId(key)` → a slug matching `^[A-Za-z0-9][A-Za-z0-9._-]*$`; throws when nothing usable remains.
  - `export const learnedEntry = (key, matcher, at, picks)` → `{ match: { type: 'prefix', value: key }, outcome: matcher, candidates: [], learned: { at, picks } }`.
  - `export function frozenFixture({ lines, index, picks, log, at, key })` → `{ source, answers, lines }` in the shape `survival.mjs` judges.

**Test cost:** 0 spawns.

- [ ] **Step 1: Write the failing tests**

```js
// plugins/machinery/test/lib-training.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADUATION_AGREEMENTS, PICK_WINDOW, SHAPE_WINDOW, SHAPE_FACTOR,
  emptyTraining, trainingOf, commonPrefix, deriveMatcher, shadowPick, identify, noteRun, shapeMoved,
  driftReason, reopen, graduated, learnedId, learnedEntry, frozenFixture,
} from '../scripts/lib/training.mjs';

const AT = '2026-09-05T12:00:00.000Z';
// A run of the spec's own example ("How an outcome pattern is learned"): the answer is the last line.
const RUN = (summary) => ['   Compiling fs-core v0.1.0', 'running 128 tests', summary];
const pickOf = (text, log) => ({ text, log, at: AT });

test('K is one named constant, and it is 2', () => { assert.equal(GRADUATION_AGREEMENTS, 2); });

test('commonPrefix is the longest common prefix, character by character', () => {
  assert.equal(commonPrefix(['test result: ok. 128 passed', 'test result: ok. 12 passed']), 'test result: ok. 12');
  assert.equal(commonPrefix(['test result: ok. 128 passed', 'test result: FAILED. 1 passed']), 'test result: ');
  assert.equal(commonPrefix(['abc', 'xyz']), '');
  assert.equal(commonPrefix(['same', 'same']), 'same');
  assert.equal(commonPrefix([]), '');
});

test('V10: the same picks always derive the same matcher; the spec example yields `test result: `', () => {
  const picks = [pickOf('test result: ok. 128 passed; 0 failed', 'a'), pickOf('test result: ok. 12 passed; 0 failed', 'b'), pickOf('test result: FAILED. 1 passed; 1 failed', 'c')];
  const once = deriveMatcher(picks), twice = deriveMatcher(picks.map((p) => ({ ...p })));
  assert.deepEqual(once, { type: 'prefix', value: 'test result: ' });
  assert.deepEqual(twice, once);
});

test('V10 / V9: a single observation never derives a matcher, and what is derived is a prefix, never a regex', () => {
  assert.equal(deriveMatcher([]), null);
  assert.equal(deriveMatcher([pickOf('test result: ok', 'a')]), null);
  const m = deriveMatcher([pickOf('[main (root-commit) a1b2c3d] x', 'a'), pickOf('[main (root-commit) 9f8e7d6] y', 'b')]);
  assert.deepEqual(m, { type: 'prefix', value: '[main (root-commit) ' });
  assert.ok(!(m instanceof RegExp));
  assert.equal(deriveMatcher([pickOf('abc', 'a'), pickOf('xyz', 'b')]), null, 'an empty prefix would match every line: no matcher');
});

test('shadowPick is every line the prefix matches, by index', () => {
  const m = { type: 'prefix', value: 'test result: ' };
  assert.deepEqual(shadowPick(m, RUN('test result: ok. 3 passed')), [2]);
  assert.deepEqual(shadowPick(m, ['test result: a', 'x', 'test result: b']), [0, 2]);
  assert.deepEqual(shadowPick(m, RUN('done')), []);
});

test('identify: two picks form the matcher, the next K agreements graduate it, and the frozen matcher is the one that agreed', () => {
  let r = identify(emptyTraining(), { lines: RUN('test result: ok. 3 passed; 0 failed'), index: 2, log: 'l1', at: AT });
  assert.equal(r.agreed, null); assert.equal(r.graduates, false); assert.equal(r.matcher, null);
  r = identify(r.training, { lines: RUN('test result: ok. 4 passed; 0 failed'), index: 2, log: 'l2', at: AT });
  assert.equal(r.agreed, null, 'no matcher existed before this pick, so nothing could agree');
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ok. ' });
  assert.equal(r.graduates, false);
  r = identify(r.training, { lines: RUN('test result: ok. 5 passed; 0 failed'), index: 2, log: 'l3', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1); assert.equal(r.graduates, false);
  r = identify(r.training, { lines: RUN('test result: ok. 60 passed; 0 failed'), index: 2, log: 'l4', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 2);
  assert.equal(r.graduates, true, `graduates on the ${GRADUATION_AGREEMENTS}nd consecutive agreement`);
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ok. ' }, 'a line the prefix matched cannot shorten it');
  assert.equal(r.training.picks.length, 4);
  assert.deepEqual(r.training.picks.at(-1), { text: 'test result: ok. 60 passed; 0 failed', log: 'l4', at: AT });
});

test('identify: a disagreement resets the streak and the matcher shortens — the spec example converges on its own', () => {
  let t = emptyTraining();
  for (const [s, l] of [['test result: ok. 128 passed; 0 failed', 'l1'], ['test result: ok. 12 passed; 0 failed', 'l2']]) t = identify(t, { lines: RUN(s), index: 2, log: l, at: AT }).training;
  assert.deepEqual(deriveMatcher(t.picks), { type: 'prefix', value: 'test result: ok. 12' }, 'the prefix cut inside a number: exactly what two runs entitle it to');
  let r = identify(t, { lines: RUN('test result: FAILED. 1 passed; 1 failed'), index: 2, log: 'l3', at: AT });
  assert.equal(r.agreed, false); assert.equal(r.training.streak, 0);
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ' });
  r = identify(r.training, { lines: RUN('test result: ok. 7 passed; 0 failed'), index: 2, log: 'l4', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1); assert.equal(r.graduates, false);
});

test('RED CHECK: a matcher that also matches a second line in the run disagrees — an over-wide prefix cannot graduate', () => {
  let t = emptyTraining();
  for (const [s, l] of [['widgets: 3', 'l1'], ['widgets: 4', 'l2']]) t = identify(t, { lines: RUN(s), index: 2, log: l, at: AT }).training;
  assert.deepEqual(deriveMatcher(t.picks), { type: 'prefix', value: 'widgets: ' });
  // The prefix now also matches line 0 of this run: the shadow pick is [0, 2], not [2].
  const r = identify(t, { lines: ['widgets: 1', 'x', 'widgets: 3'], index: 2, log: 'l3', at: AT });
  assert.equal(r.agreed, false); assert.equal(r.training.streak, 0); assert.equal(r.graduates, false);
});

test('the pick window is bounded at PICK_WINDOW, most recent kept', () => {
  let t = emptyTraining();
  for (let i = 0; i < PICK_WINDOW + 3; i++) t = identify(t, { lines: RUN(`done ${i}`), index: 2, log: `l${i}`, at: AT }).training;
  assert.equal(t.picks.length, PICK_WINDOW);
  assert.equal(t.picks.at(-1).text, `done ${PICK_WINDOW + 2}`);
});

test('noteRun keeps the last SHAPE_WINDOW runs, oldest first, and the last log', () => {
  let t = emptyTraining();
  for (let i = 0; i < SHAPE_WINDOW + 2; i++) t = noteRun(t, { log: `l${i}`, lines: 100 + i, stdoutLines: 100 + i, stderrLines: 0, code: 0 });
  assert.equal(t.history.length, SHAPE_WINDOW);
  assert.equal(t.history[0].lines, 102);
  assert.equal(t.history.at(-1).lines, 100 + SHAPE_WINDOW + 1);
  assert.equal(t.lastLog, `l${SHAPE_WINDOW + 1}`);
});

// Design verification 12, each trigger on its own — one combined case would pass on any one of three.
const steady = () => { let t = emptyTraining(); for (let i = 0; i < 3; i++) t = noteRun(t, { log: `l${i}`, lines: 100, stdoutLines: 90, stderrLines: 10, code: 0 }); return t; };
const OK_RUN = { matched: 1, code: 0, errorBlock: false, lines: 100, stdoutLines: 90, stderrLines: 10 };

test('V12 (1): the matcher matching nothing in a run re-opens training', () => {
  assert.equal(driftReason(steady(), { ...OK_RUN, matched: 0 }), 'matched-nothing');
  assert.equal(driftReason(steady(), OK_RUN), null, 'a run that matched does not');
});

test('V12 (2): a non-zero exit with no error block re-opens training; with an error block it does not', () => {
  assert.equal(driftReason(steady(), { ...OK_RUN, code: 1, errorBlock: false }), 'nonzero-without-error-block');
  assert.equal(driftReason(steady(), { ...OK_RUN, code: 1, errorBlock: true }), null);
});

test('V12 (3): a material move in line count or in the stdout share re-opens training; a small one does not', () => {
  assert.equal(driftReason(steady(), { ...OK_RUN, lines: 100 * SHAPE_FACTOR + 1, stdoutLines: 100 * SHAPE_FACTOR + 1, stderrLines: 0 }), 'shape');
  assert.equal(driftReason(steady(), { ...OK_RUN, lines: 10, stdoutLines: 9, stderrLines: 1 }), 'shape');
  assert.equal(driftReason(steady(), { ...OK_RUN, lines: 100, stdoutLines: 10, stderrLines: 90 }), 'shape', 'the answer stream flipped');
  assert.equal(driftReason(steady(), { ...OK_RUN, lines: 150, stdoutLines: 130, stderrLines: 20 }), null);
  const one = noteRun(emptyTraining(), { log: 'l', lines: 100, stdoutLines: 90, stderrLines: 10, code: 0 }).history;
  assert.equal(shapeMoved(one, { lines: 5000, stdoutLines: 0, stderrLines: 5000 }), false, 'one remembered run is no shape to move from');
});

test('reopen discards the picks and the streak, keeps the history, names the reason; graduated() clears the re-open', () => {
  let t = steady();
  t = identify(t, { lines: RUN('done'), index: 2, log: 'l', at: AT }).training;
  const r = reopen(t, 'matched-nothing', 'l9', AT);
  assert.deepEqual(r.picks, []); assert.equal(r.streak, 0);
  assert.equal(r.history.length, 3);
  assert.deepEqual(r.open, { reason: 'matched-nothing', log: 'l9', at: AT });
  const g = graduated(r);
  assert.ok(!('open' in g)); assert.deepEqual(g.picks, []); assert.equal(g.history.length, 3);
});

test('trainingOf reads a hand-edited record as data: anything not the right shape is the empty one', () => {
  assert.deepEqual(trainingOf(undefined), emptyTraining());
  assert.deepEqual(trainingOf({ training: 'garbage' }), emptyTraining());
  assert.deepEqual(trainingOf({ training: { picks: 'x', streak: -1, history: null } }), emptyTraining());
  const t = trainingOf({ training: { picks: [{ text: 'a', log: 'l', at: AT }, { nope: 1 }], streak: 2, history: [{ lines: 3, stdoutLines: 3, stderrLines: 0, code: 0 }], lastLog: 'l', open: { reason: 'shape', log: 'l', at: AT } } });
  assert.equal(t.picks.length, 1); assert.equal(t.streak, 2); assert.equal(t.history.length, 1); assert.equal(t.lastLog, 'l'); assert.equal(t.open.reason, 'shape');
});

test('learnedId is a filename-safe slug that satisfies promote-tool.mjs’s own id rule', () => {
  assert.equal(learnedId('bash scripts/battery.sh'), 'bash-scripts-battery.sh');
  assert.equal(learnedId('python scripts/oracle_compare.py'), 'python-scripts-oracle_compare.py');
  assert.equal(learnedId('./scripts/x.sh'), 'scripts-x.sh');
  assert.equal(learnedId('node'), 'node');
  for (const id of ['bash-scripts-battery.sh', 'scripts-x.sh']) assert.match(id, /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
  assert.throws(() => learnedId('///'), /no usable id/);
});

test('learnedEntry and frozenFixture have the shapes catalog.mjs and survival.mjs read', () => {
  const m = { type: 'prefix', value: 'test result: ok. ' };
  assert.deepEqual(learnedEntry('bash scripts/battery.sh', m, AT, 4),
    { match: { type: 'prefix', value: 'bash scripts/battery.sh' }, outcome: m, candidates: [], learned: { at: AT, picks: 4 } });
  const lines = RUN('test result: ok. 60 passed; 0 failed');
  const f = frozenFixture({ lines, index: 2, picks: [pickOf('test result: ok. 3 passed; 0 failed', 'l1')], log: 'l4', at: AT, key: 'bash scripts/battery.sh' });
  assert.deepEqual(f.lines, [...lines, 'test result: ok. 3 passed; 0 failed']);
  assert.deepEqual(f.answers, [2, 3]);
  assert.match(f.source, /frozen at graduation/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/lib-training.test.mjs`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// plugins/machinery/scripts/lib/training.mjs
// The training loop's arithmetic, with no I/O of its own. Story: docs/superpowers/specs/
// 2026-09-04-tool-assimilation-design.md, "How an outcome pattern is learned". The session does the
// identifying (train-tool.mjs hands its pick in here); everything else — the matcher, the shadow
// comparison, the graduation count, the drift triggers — is a function of what was recorded, so the
// same picks always yield the same matcher (design verification 10), and a matcher is a prefix
// because the only thing that makes one is a longest common prefix (verification 9, by construction).
import { outcomeMatcher } from './catalog.mjs';

// K: the consecutive shadow agreements a matcher needs to graduate. Two, because a wrong graduation
// is bounded and reversible while a late one is paid in session attention: the matcher can only
// promote a line, never hide one (the floor, filter.mjs), and drift re-opens training the first run
// it matches nothing — so graduating too early costs a few extra lines shown until the next run
// corrects it. The first agreement after the prefix forms proves only that the prefix fits a run it
// had not seen; the second, consecutive, is the smallest count that separates a stable line from a
// coincidence of the two picks the prefix was built from. A third would cost every project one more
// identified run per tool for evidence the frozen fixture already carries.
export const GRADUATION_AGREEMENTS = 2;
// The most recent picks the prefix is taken over. Bounded, so a tool that never graduates cannot grow
// the record without limit; wide enough for a formation (2) and a graduation (K) with room for a few
// disagreements between.
export const PICK_WINDOW = 8;
// The bare runs remembered for the shape trigger, and what "moved materially" means: the line count
// leaving a factor-of-three band around the remembered median, or the share of lines on stdout
// moving by more than half. Named here, once, because they are judgement calls.
export const SHAPE_WINDOW = 5;
export const SHAPE_FACTOR = 3;
export const SHAPE_SHARE_DELTA = 0.5;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const emptyTraining = () => ({ picks: [], streak: 0, history: [] });

// A training record that came off disk is external input: any field that is not the collection it
// should be reads as the empty one, so a hand edit cannot throw out of the runner or the trainer.
export function trainingOf(rec) {
  const t = isObject(rec) && isObject(rec.training) ? rec.training : {};
  return {
    picks: Array.isArray(t.picks) ? t.picks.filter((p) => isObject(p) && typeof p.text === 'string') : [],
    streak: Number.isInteger(t.streak) && t.streak >= 0 ? t.streak : 0,
    history: Array.isArray(t.history) ? t.history.filter((h) => isObject(h) && Number.isInteger(h.lines)) : [],
    ...(typeof t.lastLog === 'string' ? { lastLog: t.lastLog } : {}),
    ...(isObject(t.open) ? { open: t.open } : {}),
  };
}

export function commonPrefix(strings) {
  if (!strings.length) return '';
  let prefix = strings[0];
  for (const s of strings.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return prefix;
}

// The matcher the picks so far derive, or null while there is nothing to derive one from. Fewer than
// two picks is null — "a single observation can never graduate: there is nothing to take a common
// prefix OF" — and so is an empty common prefix, which would match every line.
export function deriveMatcher(picks) {
  if (picks.length < 2) return null;
  const value = commonPrefix(picks.map((p) => p.text));
  return value ? { type: 'prefix', value } : null;
}

// The local matcher's own pick over a run: every index the prefix matches, tested by the same
// compiler the runner hands select() (catalog.mjs), not a second spelling of startsWith.
export function shadowPick(matcher, lines) {
  const m = outcomeMatcher({ outcome: matcher });
  return lines.flatMap((line, i) => (m.test(line) ? [i] : []));
}

// One identification by the session. `index` is the line the session says is the answer, in `lines`
// — this run's normalised output. The shadow comparison runs FIRST, against the matcher the picks
// BEFORE this one derive: agreement is that matcher picking exactly this line and no other. Then the
// pick joins the window and the matcher is re-derived. `graduates` is true when this agreement is the
// K-th in a row; the matcher returned is then the one to freeze — on an agreement it equals the one
// that agreed, because a line the prefix matched cannot shorten it.
export function identify(training, { lines, index, log, at }) {
  const before = deriveMatcher(training.picks);
  let agreed = null, streak = training.streak;
  if (before) {
    const shadow = shadowPick(before, lines);
    agreed = shadow.length === 1 && shadow[0] === index;
    streak = agreed ? streak + 1 : 0;
  }
  const picks = [...training.picks, { text: lines[index], log, at }].slice(-PICK_WINDOW);
  const matcher = deriveMatcher(picks);
  const graduates = agreed === true && streak >= GRADUATION_AGREEMENTS && matcher !== null;
  return { training: { ...training, picks, streak }, agreed, matcher, graduates };
}

// What the wrapper records about one bare run: appended to the bounded history, oldest first.
export function noteRun(training, { log, lines, stdoutLines, stderrLines, code }) {
  const history = [...training.history, { lines, stdoutLines, stderrLines, code }].slice(-SHAPE_WINDOW);
  return { ...training, history, lastLog: log };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const share = (h) => (h.lines > 0 ? h.stdoutLines / h.lines : 0);

// The shape trigger. Two remembered runs are the least that have a shape to move from; with fewer,
// nothing has moved. Both halves are judged against the remembered median.
export function shapeMoved(history, run) {
  if (history.length < 2) return false;
  const lines = median(history.map((h) => h.lines)), s = median(history.map(share));
  if (run.lines > lines * SHAPE_FACTOR || run.lines * SHAPE_FACTOR < lines) return true;
  return Math.abs(share(run) - s) > SHAPE_SHARE_DELTA;
}

// Why a graduated matcher goes back into training after this run, or null. The design's three
// triggers, in its order, each a fact the wrapper already has: `matched` is how many lines the
// learned matcher promoted, `errorBlock` is filter.mjs's hasErrorBlock over the run.
export function driftReason(training, run) {
  if (run.matched === 0) return 'matched-nothing';
  if (run.code !== 0 && !run.errorBlock) return 'nonzero-without-error-block';
  if (shapeMoved(training.history, run)) return 'shape';
  return null;
}

// Re-opening discards the picks the doubted matcher was derived from, and the streak with them. The
// history stays: it is what the shape trigger reads.
export const reopen = (training, reason, log, at) => ({ ...training, picks: [], streak: 0, open: { reason, log, at } });

// After graduation the picks and the streak are frozen in the fixture and the re-open is answered;
// the history stays for drift.
export const graduated = (training) => { const { open, ...rest } = training; return { ...rest, picks: [], streak: 0 }; };

// The catalog id a learned entry takes. A bespoke key is a command shape — `bash scripts/battery.sh`
// — and an id names a fixture FILE and must satisfy promote-tool.mjs's own id rule, so every run of
// characters outside [A-Za-z0-9._-] becomes one dash and a leading non-alphanumeric run is dropped.
export function learnedId(key) {
  const id = key.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  if (!id) throw new Error(`no usable id can be made from the key: ${key}`);
  return id;
}

// The entry graduation writes: matched by the same leading tokens the bespoke key was, the learned
// prefix as its outcome, no candidates (a bespoke tool has no documented quiet flags), and the
// `learned` mark that says a machine wrote it and drift may re-open it.
export const learnedEntry = (key, matcher, at, picks) => ({
  match: { type: 'prefix', value: key },
  outcome: matcher,
  candidates: [],
  learned: { at, picks },
});

// The frozen fixture, in the shape survival.mjs judges: this run's lines with the session's pick as
// the answer, then every earlier pick's text appended as a further recorded answer line — each one a
// line the tool really emitted on a run the session read — so a later change to the matcher has to
// survive every form the loop saw, not only the last. Answers are indices a person identified, never
// found by applying the pattern.
export function frozenFixture({ lines, index, picks, log, at, key }) {
  const extra = picks.map((p) => p.text);
  return {
    source: `${key}: frozen at graduation ${at} from ${log}; ${extra.length} earlier identified line(s) appended`,
    answers: [index, ...extra.map((_, i) => lines.length + i)],
    lines: [...lines, ...extra],
  };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test plugins/machinery/test/lib-training.test.mjs`
Expected: 17 pass.

- [ ] **Step 5: Commit**

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- plugins/machinery/scripts/lib/training.mjs plugins/machinery/test/lib-training.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: lib/training.mjs — prefix derivation, shadow agreement (K = 2), drift triggers, all pure (design V10, V12)"
```

---
## Task 5: The observation record carries training state

**Files:**
- Modify: `plugins/machinery/scripts/lib/observations.mjs`
- Test: `plugins/machinery/test/observations.test.mjs` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `recordRun(obs, key, …)` — unchanged signature; the returned entry now carries `prev.training` forward unchanged when the previous record had one, on bare runs and on trials alike, and has no `training` field when it did not.
  - `export const withTraining = (obs, key, training)` → a new `obs` whose `[key]` is the existing record (or `{ ledger: {} }` when none) with `training` set.
  - `export function moveRecord(obs, from, to)` → a new `obs` with the record under `from` now under `to`; returns `obs` itself when there is nothing under `from`.

**Test cost:** 0 spawns.

- [ ] **Step 1: Write the failing tests — append to `observations.test.mjs`**

Change the import line to
```js
import { bespokeKey, recordRun, loadObservations, saveObservations, withTraining, moveRecord } from '../scripts/lib/observations.mjs';
```

Append:

```js
// ---- The training loop: the record carries the loop's own sub-record ----

test('recordRun carries a training sub-record forward unchanged, on a bare run and on a trial', () => {
  const training = { picks: [{ text: 'done', log: 'l', at: 'a' }], streak: 1, history: [] };
  let obs = withTraining({}, 'bash scripts/battery.sh', training);
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'bespoke', lineCount: 200, stdoutLines: 200, stderrLines: 0 });
  assert.deepEqual(obs['bash scripts/battery.sh'].training, training);
  assert.equal(obs['bash scripts/battery.sh'].noisy, true);
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'catalog', lineCount: 3, candidate: '-q' });
  assert.deepEqual(obs['bash scripts/battery.sh'].training, training);
});

test('RED CHECK: a record with no training has no training field after recordRun — nothing is invented', () => {
  const obs = recordRun({}, 'x', { identity: 'bespoke', lineCount: 3 });
  assert.ok(!('training' in obs.x));
});

test('withTraining writes on a record that exists and creates the minimal one that does not; moveRecord renames a key', () => {
  let obs = recordRun({}, 'a', { identity: 'bespoke', lineCount: 90, stdoutLines: 90, stderrLines: 0 });
  obs = withTraining(obs, 'a', { picks: [], streak: 0, history: [] });
  assert.equal(obs.a.noisy, true); assert.deepEqual(obs.a.training, { picks: [], streak: 0, history: [] });
  obs = withTraining(obs, 'fresh', { picks: [], streak: 0, history: [] });
  assert.deepEqual(obs.fresh, { ledger: {}, training: { picks: [], streak: 0, history: [] } }, 'no noisy invented: absence stays the signal');
  const moved = moveRecord(obs, 'a', 'a-slug');
  assert.ok(!('a' in moved)); assert.equal(moved['a-slug'].noisy, true); assert.ok('fresh' in moved);
  assert.equal(moveRecord(obs, 'absent', 'x'), obs, 'nothing to move: the same object back');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/observations.test.mjs`
Expected: FAIL — `withTraining` is not exported (the first test cannot even build its input).

- [ ] **Step 3: Implement**

In `plugins/machinery/scripts/lib/observations.mjs`, replace
```js
  const entry = { ...defined({ identity, ...measured }), ledger: { ...prev.ledger } };
```
with
```js
  // The training loop's sub-record (lib/training.mjs) rides on the same entry and is nobody's
  // business here: carried forward exactly as it was when present, absent when it was absent. A
  // record rebuilt without it would silently reset a tool's training on every run.
  const entry = { ...defined({ identity, ...measured }), ledger: { ...prev.ledger }, ...(prev.training === undefined ? {} : { training: prev.training }) };
```

Append at the end of the file:

```js
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// The training loop's own sub-record, written by the runner (noteRun / reopen) and by train-tool.mjs
// (identify). Set on a record that exists, or on the minimal record when none does — a pick can land
// before the runner has ever measured the tool here (batch identification over a stored log), and
// that record must not invent a `noisy`: absence stays the signal decide() reads as unseen.
export const withTraining = (obs, key, training) => ({ ...obs, [key]: { ...(isObject(obs[key]) ? obs[key] : { ledger: {} }), training } });

// Renames a record: graduation gives a bespoke tool a catalog id, and the measurement made under the
// bespoke key follows it rather than being taken again. Nothing to move returns obs itself.
export function moveRecord(obs, from, to) {
  if (!(from in obs)) return obs;
  const { [from]: rec, ...rest } = obs;
  return { ...rest, [to]: rec };
}
```

- [ ] **Step 4: Run to verify they pass, and the assimilator suite still does**

Run: `node --test plugins/machinery/test/observations.test.mjs plugins/machinery/test/assimilate.test.mjs`
Expected: all pass — `the bare path ignores outcomeSurvived entirely` still holds byte-for-byte because a record with no `training` gains no field.

- [ ] **Step 5: Commit**

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- plugins/machinery/scripts/lib/observations.mjs plugins/machinery/test/observations.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: the observation record carries the training sub-record forward; withTraining and moveRecord"
```

---
## Task 6: The graduation gate — `lib/graduate.mjs` (Verification 9 at the gate, 11)

**Files:**
- Create: `plugins/machinery/scripts/lib/graduate.mjs`
- Modify: `plugins/machinery/test/purity.test.mjs` (the file-writer exemption list)
- Test: `plugins/machinery/test/lib-graduate.test.mjs`

**Interfaces:**
- Consumes: `isLearned`, `entryProblem` (Task 3); `survivalProblems` (`survival.mjs`, through Task 3's compiler); `learnedId`, `learnedEntry`, `frozenFixture`, `graduated` (Task 4); `moveRecord`, `withTraining` (Task 5).
- Produces:
  - `export const projectCatalogFile = (root)` → `<root>/.claude/machinery/tool-catalog.json`; `export const projectFixtureFile = (root, id)` → `<root>/.claude/machinery/fixtures/<id>.json`.
  - `export function graduate(root, { key, catalog, observations, training, matcher, lines, index, log, at })` → `{ ok: true, id, files: [catalogFile, fixtureFile], observations }` after writing, or `{ ok: false, problems: string[] }` having written nothing. `catalog` is the merged catalog (`loadCatalog(root)`), `training` the sub-record `identify()` returned (its last pick is this run's), `matcher` the one `identify()` returned.

**Test cost:** 0 spawns; temp directories only.

- [ ] **Step 1: Write the failing tests**

```js
// plugins/machinery/test/lib-graduate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { graduate, projectCatalogFile, projectFixtureFile } from '../scripts/lib/graduate.mjs';
import { loadCatalogReport } from '../scripts/lib/catalog.mjs';
import { survivalProblems } from '../scripts/lib/survival.mjs';
import { emptyTraining, identify } from '../scripts/lib/training.mjs';

// loadCatalogReport reads the universal half through pluginRoot(); pin it at this checkout.
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;

const AT = '2026-09-05T12:00:00.000Z';
const KEY = 'bash scripts/battery.sh';
const ID = 'bash-scripts-battery.sh';
const RUN = (summary) => ['   Compiling fs-core v0.1.0', 'running 128 tests', summary];
// The four identified runs a graduation takes with K = 2, replayed through identify() itself.
function trained() {
  let r = { training: emptyTraining() };
  for (const [s, l] of [['3', 'l1'], ['4', 'l2'], ['5', 'l3'], ['60', 'l4']]) r = identify(r.training, { lines: RUN(`test result: ok. ${s} passed; 0 failed`), index: 2, log: l, at: AT });
  assert.equal(r.graduates, true, 'precondition: the loop graduates on these four');
  return { ...r, lines: RUN('test result: ok. 60 passed; 0 failed') };
}
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'graduate-'));
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const args = (r, extra = {}) => ({
  key: KEY, catalog: {}, training: r.training, matcher: r.matcher, lines: r.lines, index: 2, log: 'l4', at: AT,
  observations: { [KEY]: { identity: 'bespoke', noisy: true, lines: 1400, ledger: {}, training: r.training } },
  ...extra,
});

test('graduation writes the learned entry into the project catalog and the frozen fixture beside it, both loadable', () => {
  const dir = root(), r = trained();
  const g = graduate(dir, args(r));
  assert.equal(g.ok, true, g.problems && g.problems.join('\n'));
  assert.equal(g.id, ID);
  assert.deepEqual(g.files, [projectCatalogFile(dir), projectFixtureFile(dir, ID)]);
  const entry = read(projectCatalogFile(dir))[ID];
  assert.deepEqual(entry.outcome, { type: 'prefix', value: 'test result: ok. ' });
  assert.deepEqual(entry.match, { type: 'prefix', value: KEY });
  assert.deepEqual(entry.candidates, []);
  assert.deepEqual(entry.learned, { at: AT, picks: 4 });
  const fixture = read(projectFixtureFile(dir, ID));
  assert.deepEqual(fixture.answers, [2, 3, 4, 5]);
  assert.equal(fixture.lines.length, 6);
  assert.deepEqual(survivalProblems(ID, entry, fixture), [], 'what landed passes the same authority the suite applies');
  const { catalog, dropped } = loadCatalogReport(dir);
  assert.deepEqual(dropped, []); assert.ok(catalog[ID]);
});

test('graduation moves the observation record from the bespoke key to the learned id, and clears the training it froze', () => {
  const dir = root(), r = trained();
  const g = graduate(dir, args(r));
  assert.ok(!(KEY in g.observations));
  const rec = g.observations[ID];
  assert.equal(rec.noisy, true); assert.equal(rec.lines, 1400);
  assert.deepEqual(rec.training.picks, []); assert.equal(rec.training.streak, 0); assert.ok(!('open' in rec.training));
});

test('V11 positive control: a fixture that cannot prove the matcher refuses graduation, and nothing is written', () => {
  const dir = root(), r = trained();
  // The session points at a line the derived prefix does not match: the fixture's declared answer
  // fails the pattern, and the gate refuses before the first write.
  const g = graduate(dir, args(r, { index: 1 }));
  assert.equal(g.ok, false);
  assert.ok(g.problems.some((p) => /does not match a line this tool really emits/.test(p)), g.problems.join('\n'));
  assert.ok(!fs.existsSync(projectCatalogFile(dir)) && !fs.existsSync(projectFixtureFile(dir, ID)));
});

test('RED CHECK — V9 at the gate: a matcher that is not a prefix or literal object is refused, whatever the fixture says', () => {
  const dir = root(), r = trained();
  const g = graduate(dir, args(r, { matcher: '^test result: ok\\. ' }));
  assert.equal(g.ok, false);
  assert.ok(g.problems.some((p) => /never a regex/.test(p)), g.problems.join('\n'));
  assert.ok(!fs.existsSync(projectCatalogFile(dir)));
});

test('a hand-written entry under the same id is never overwritten; a learned entry for a DIFFERENT key is a collision', () => {
  const dir = root(), r = trained();
  const hand = { [ID]: { match: { type: 'prefix', value: KEY }, outcome: '^done', candidates: [] } };
  const h = graduate(dir, args(r, { catalog: hand }));
  assert.equal(h.ok, false); assert.match(h.problems[0], /hand-written/);
  const other = { [ID]: { match: { type: 'prefix', value: 'bash scripts battery.sh' }, outcome: { type: 'prefix', value: 'x' }, candidates: [], learned: { at: AT, picks: 4 } } };
  const o = graduate(dir, args(r, { catalog: other }));
  assert.equal(o.ok, false); assert.match(o.problems[0], /already the learned entry/);
  assert.ok(!fs.existsSync(projectCatalogFile(dir)));
});

test('re-graduation overwrites the learned entry and its fixture, and leaves the project catalog’s other entries alone', () => {
  const dir = root(), r = trained();
  fs.mkdirSync(path.dirname(projectCatalogFile(dir)), { recursive: true });
  fs.writeFileSync(projectCatalogFile(dir), JSON.stringify({ keeper: { match: { type: 'prefix', value: 'k' }, outcome: '^k$', candidates: [] } }, null, 2) + '\n');
  const first = graduate(dir, args(r));
  assert.equal(first.ok, true, first.problems && first.problems.join('\n'));
  const again = graduate(dir, args(r, { catalog: { [ID]: read(projectCatalogFile(dir))[ID] }, at: '2026-09-06T00:00:00.000Z' }));
  assert.equal(again.ok, true, again.problems && again.problems.join('\n'));
  const cat = read(projectCatalogFile(dir));
  assert.ok(cat.keeper, 'untouched');
  assert.equal(cat[ID].learned.at, '2026-09-06T00:00:00.000Z');
  assert.match(read(projectFixtureFile(dir, ID)).source, /2026-09-06/);
});

test('a project catalog that is not valid JSON is external input: graduation refuses rather than replacing it', () => {
  const dir = root(), r = trained();
  fs.mkdirSync(path.dirname(projectCatalogFile(dir)), { recursive: true });
  fs.writeFileSync(projectCatalogFile(dir), '{ not json');
  const g = graduate(dir, args(r));
  assert.equal(g.ok, false); assert.match(g.problems[0], /not valid JSON/);
  assert.equal(fs.readFileSync(projectCatalogFile(dir), 'utf8'), '{ not json');
  assert.ok(!fs.existsSync(projectFixtureFile(dir, ID)), 'refused before the first write, the fixture included');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/lib-graduate.test.mjs`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// plugins/machinery/scripts/lib/graduate.mjs
// The one gate between a trained matcher and the project catalog. Story: the design's "Graduation
// freezes a fixture" — "a matcher that cannot be graduated with a fixture is not graduated."
// Everything that can refuse happens before the first write, and the judgement is not made here: it
// is read from survival.mjs, the same authority test/catalog.test.mjs enforces over the universal
// catalog and promote-tool.mjs enforces at promotion, so the loop cannot land an entry the suite
// would reject (rules/design-invariants.md § Never re-derive a fact). The entry's own loadability is
// read from catalog.mjs's entryProblem() the same way — a machine-derived outcome that is not a
// prefix or literal is refused here, at the writer, not only dropped later at the reader.
import fs from 'node:fs';
import path from 'node:path';
import { isLearned, entryProblem } from './catalog.mjs';
import { survivalProblems } from './survival.mjs';
import { learnedId, learnedEntry, frozenFixture, graduated } from './training.mjs';
import { moveRecord, withTraining } from './observations.mjs';

export const projectCatalogFile = (root) => path.join(root, '.claude', 'machinery', 'tool-catalog.json');
export const projectFixtureFile = (root, id) => path.join(root, '.claude', 'machinery', 'fixtures', `${id}.json`);

// The project catalog is written back whole, so it is read raw here — not through loadCatalog(),
// which lays it over the universal table and drops what it cannot use. A file that is present but
// unreadable is external input: a problem, never a replacement (rules/design-invariants.md
// § External input).
function readProjectCatalog(file) {
  if (!fs.existsSync(file)) return { value: {} };
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { problem: `${file} is not valid JSON: ${e.message}` }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { problem: `${file} is not a JSON object` };
  return { value };
}

export function graduate(root, { key, catalog, observations, training, matcher, lines, index, log, at }) {
  const id = learnedId(key);
  const existing = catalog[id];
  if (existing && !isLearned(existing)) return { ok: false, problems: [`'${id}' is a hand-written catalog entry; training never overwrites one`] };
  if (existing && existing.match?.value !== key) return { ok: false, problems: [`'${id}' is already the learned entry for '${existing.match?.value}', not '${key}'`] };
  const entry = learnedEntry(key, matcher, at, training.picks.length);
  const unloadable = entryProblem(entry);
  if (unloadable) return { ok: false, problems: [`'${id}': ${unloadable}`] };
  // The last pick is this run's; the earlier ones are appended to the fixture as further answers.
  const fixture = frozenFixture({ lines, index, picks: training.picks.slice(0, -1), log, at, key });
  const problems = survivalProblems(id, entry, fixture);
  if (problems.length) return { ok: false, problems };
  const catalogFile = projectCatalogFile(root), fixtureFile = projectFixtureFile(root, id);
  const project = readProjectCatalog(catalogFile);
  if (project.problem) return { ok: false, problems: [project.problem] };
  // Fixture first, entry second: an entry with no fixture is what promote-tool.mjs refuses, while a
  // fixture with no entry is inert. A failure between the two writes leaves the harmless state.
  fs.mkdirSync(path.dirname(fixtureFile), { recursive: true });
  fs.writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2) + '\n');
  fs.writeFileSync(catalogFile, JSON.stringify({ ...project.value, [id]: entry }, null, 2) + '\n');
  const moved = key === id ? observations : moveRecord(observations, key, id);
  return { ok: true, id, files: [catalogFile, fixtureFile], observations: withTraining(moved, id, graduated(training)) };
}
```

- [ ] **Step 4: Add the file-writer exemption**

In `plugins/machinery/test/purity.test.mjs`, replace
```js
const SERIALISES_TO_A_FILE = [path.join('record-payload.mjs'), path.join('lib', 'observations.mjs'), path.join('promote-tool.mjs')];
```
with
```js
const SERIALISES_TO_A_FILE = [path.join('record-payload.mjs'), path.join('lib', 'observations.mjs'), path.join('promote-tool.mjs'), path.join('lib', 'graduate.mjs')];
```
and extend the comment above it so its list of what each exempt file serialises names `lib/graduate.mjs the learned catalog entry and its frozen fixture`.

- [ ] **Step 5: Run to verify they pass**

Run: `node --test plugins/machinery/test/lib-graduate.test.mjs plugins/machinery/test/purity.test.mjs`
Expected: 7 + 3 pass.

- [ ] **Step 6: Commit**

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- plugins/machinery/scripts/lib/graduate.mjs plugins/machinery/test/lib-graduate.test.mjs plugins/machinery/test/purity.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: lib/graduate.mjs — a matcher graduates only with a fixture that proves it (design V11), into the tracked project catalog"
```

---
## Task 7: The runner notes runs, judges drift, and nudges (the nudge register; Verification 12 through the wrapper)

**Files:**
- Modify: `plugins/machinery/scripts/quiet-run.mjs`
- Test: `plugins/machinery/test/quiet-run-training.test.mjs` (created in Task 3; append, and extend one test)

**Interfaces:**
- Consumes: `hasErrorBlock` (Task 2); `isLearned` (Task 3); `trainingOf`, `noteRun`, `driftReason`, `reopen`, `GRADUATION_AGREEMENTS` (Task 4); `withTraining` (Task 5); `parseRunLog` (Task 1, in the test).
- Produces: after every run in `filter` or `observe` mode of a tool with no candidate flag applied that is either bespoke or has a learned entry, the runner (a) notes the run into `observations[key].training` (`history`, `lastLog`), (b) for a learned entry that is not already re-opened, evaluates `driftReason` against the history *before* this run and re-opens on a reason, and (c) when the run was noisy (`lines.length > PASS_THROUGH_LINES`) and the tool is not graduated — or is graduated and re-opened — appends one line to stdout after the output:
  `[quiet:train] <key>: answer line not yet learned (<n> identified, <s> of 2 agreements) — read the log, then: node "<plugin>/scripts/train-tool.mjs" identify --log "<log>" --line <N>`
  or, re-opened, `[quiet:train] <key>: learned answer line re-opened for training (<reason>) — read the log, then: …`. Paths in the nudge use forward slashes. The `<N>` is literal: the session fills it in. `train-tool.mjs` is Task 8's; the nudge names its path now so Task 8 has nothing to change here.

**Test cost:** 3 runner spawns (bash + node) appended to the Task 3 file, plus two assertions added to an existing spawn there.

- [ ] **Step 1: Write the failing tests — append to `quiet-run-training.test.mjs`**

Add to that file's imports:
```js
import { parseRunLog } from '../scripts/lib/runlog.mjs';
```

In the existing test `a learned prefix entry's answer line survives filtering …`, after the `assert.equal(r.stderr, '', …)` line, add:
```js
  assert.doesNotMatch(r.stdout, /\[quiet:train\]/, 'graduated and standing: no nudge');
  assert.ok(!('open' in obsOf(root).node.training), 'the matcher matched, so nothing re-opened');
```

Append at the end of the file (the helpers `repo`, `seed`, `obsOf`, `run`, `bash`, `AT`, `LEARNED` are defined at its top):

```js
// ---- Task 7: the runner notes runs, judges drift, and nudges (design, "The nudge register") ----
const gen = (n) => `node -e "for(let i=0;i<${n};i++)console.log('   Compiling c'+i);console.log('done')"`;
const NUDGE = /\[quiet:train\] node: answer line not yet learned \(0 identified, 0 of 2 agreements\) — read the log, then: node "([^"]+\/train-tool\.mjs)" identify --log "([^"]+)" --line <N>\n$/;

test('a noisy bespoke run ends with the training nudge, naming a log that exists and holds this run, and the run is noted', { skip: !bash }, () => {
  const root = repo('quiet-train-nudge-');
  const r = run(root, 'filter', gen(100));
  const m = NUDGE.exec(r.stdout);
  assert.ok(m, `no nudge at the end of:\n${r.stdout.slice(-400)}`);
  assert.ok(fs.existsSync(m[1]), 'the trainer the nudge names exists');
  const { command, records } = parseRunLog(fs.readFileSync(m[2], 'utf8'));
  assert.equal(command, gen(100), 'the nudge points at THIS run');
  assert.equal(records.length, 101);
  const t = obsOf(root).node.training;
  assert.deepEqual(t.history, [{ lines: 101, stdoutLines: 101, stderrLines: 0, code: 0 }]);
  assert.equal(t.lastLog.replace(/\\/g, '/'), m[2]);
  assert.deepEqual(t.picks, []); assert.equal(t.streak, 0);
});

test('RED CHECK: a quiet bespoke run gets no nudge — a tool that is never wrapped again would never apply a matcher', { skip: !bash }, () => {
  const root = repo('quiet-train-quiet-');
  const r = run(root, 'filter', gen(5));
  assert.doesNotMatch(r.stdout, /\[quiet:train\]/);
  assert.equal(obsOf(root).node.training.history.length, 1, 'the run is still noted: the shape history is measurement, not a nudge');
});

test('V12 through the runner: a learned matcher that matches nothing re-opens training — picks discarded, reason recorded, nudge says so', { skip: !bash }, () => {
  const root = repo('quiet-train-drift-');
  seed(root, 'tool-catalog.json', LEARNED);
  seed(root, 'observations.json', { node: { identity: 'catalog', noisy: true, lines: 101, stdoutLines: 101, stderrLines: 0, ledger: {}, training: { picks: [{ text: 'ANSWER 41', log: 'old', at: AT }], streak: 0, history: [] } } });
  const r = run(root, 'filter', gen(100)); // 101 lines, none starting with "ANSWER "
  const t = obsOf(root).node.training;
  assert.equal(t.open.reason, 'matched-nothing');
  assert.deepEqual(t.picks, []);
  assert.equal(t.history.length, 1, 'noted after the judgement, so the judgement saw the history it was meant to');
  assert.match(r.stdout, /\[quiet:train\] node: learned answer line re-opened for training \(matched-nothing\) — read the log, then: node "[^"]+" identify --log "[^"]+" --line <N>\n$/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/quiet-run-training.test.mjs`
Expected: the three new tests FAIL (no nudge, no `training` in the record); the two from Task 3 still pass.

- [ ] **Step 3: Implement — imports and the nudge helper**

In `plugins/machinery/scripts/quiet-run.mjs`, the import block becomes:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { select, selectInfra, render, hasErrorBlock, PASS_THROUGH_LINES, MAX_SHOWN } from './lib/filter.mjs';
import { logDir, formatRunLog, linesOf } from './lib/runlog.mjs';
import { captureRun } from './lib/capture.mjs';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog, matchTool, matchedCandidate, outcomeMatcher, isLearned } from './lib/catalog.mjs';
import { loadObservations, saveObservations, recordRun, bespokeKey, withTraining } from './lib/observations.mjs';
import { decide, candidatesOf } from './lib/assimilate.mjs';
import { trainingOf, noteRun, driftReason, reopen, GRADUATION_AGREEMENTS } from './lib/training.mjs';
```

After `quietEnv()`, add:

```js
// The training nudge (design, "The nudge register"): advisory, on this runner's own stdout after
// the output — the same channel as the suggest line — never a hook that waits on anything, and
// never applied to anything. It points at the log this run wrote and at the one command that hands
// the session's pick to the loop; the <N> is for the session to supply. Forward slashes in both
// paths: node reads them on every platform and the bash shell needs them.
const TRAINER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'train-tool.mjs').replace(/\\/g, '/');
function trainingNudge(key, training, learned, logPath) {
  const state = learned
    ? `learned answer line re-opened for training (${training.open.reason})`
    : `answer line not yet learned (${training.picks.length} identified, ${training.streak} of ${GRADUATION_AGREEMENTS} agreements)`;
  return `[quiet:train] ${key}: ${state} — read the log, then: node "${TRAINER}" identify --log "${logPath.replace(/\\/g, '/')}" --line <N>\n`;
}
```

- [ ] **Step 4: Implement — the recording block**

Replace the whole block from `  try {` / `    if (root) {` (the one that computes `stdoutLines`) down to and including its closing `} catch { /* recording is best-effort; never fail the wrapped command over it */ }` with:

```js
  let nudge = '';
  try {
    if (root) {
      const stdoutLines = records.filter((r) => r.stream === 'stdout').length;
      const stderrLines = records.filter((r) => r.stream === 'stderr').length;
      // Only meaningful on a trial run (a candidate flag is actually present): did the tool's own
      // declared answer survive taking it? Defaults true, so a bare run — or a tool with no
      // declared outcome pattern to lose — is judged on line count alone, per Task 5's ruling.
      const outcomeSurvived = candidate && outcomePattern ? lines.some((l) => outcomePattern.test(l)) : true;
      let next = recordRun(observations, key, {
        identity: toolId ? 'catalog' : 'bespoke',
        lineCount: lines.length, stdoutLines, stderrLines, candidate, outcomeSurvived,
      });
      // The training loop (design, "How an outcome pattern is learned"), for the runs that can
      // learn: a bare run — never a trial, whose lines measure a flag — of a tool with no declared
      // answer line of its own, which is a bespoke tool or one whose entry the loop itself wrote
      // (isLearned). Not infra: selectInfra() takes no outcome pattern, so nothing learned there
      // would ever be applied. Drift is judged BEFORE this run joins the history it is judged
      // against, and only while the matcher stands — a re-opened one is already in question, and
      // re-judging it every run would discard each new pick before it could count.
      const learned = toolId !== null && isLearned(catalog[toolId]);
      if (!candidate && a.mode !== 'infra' && (toolId === null || learned)) {
        let training = trainingOf(next[key]);
        if (learned && !training.open) {
          const reason = driftReason(training, {
            matched: outcomePattern ? lines.filter((l) => outcomePattern.test(l)).length : 0,
            code, errorBlock: hasErrorBlock(lines), lines: lines.length, stdoutLines, stderrLines,
          });
          if (reason) training = reopen(training, reason, logPath, new Date().toISOString());
        }
        training = noteRun(training, { log: logPath, lines: lines.length, stdoutLines, stderrLines, code });
        next = withTraining(next, key, training);
        // Noisy by the one threshold, and not yet (or no longer) graduated: the session is asked. A
        // quiet tool is never wrapped again, so a matcher for it would never be applied. No log,
        // nothing to identify in — said, not skipped.
        if (lines.length > PASS_THROUGH_LINES && (!learned || training.open)) {
          nudge = logDisplay === logPath
            ? trainingNudge(key, training, learned, logPath)
            : `[quiet:train] ${key}: nothing to identify this run — the log could not be written ${logDisplay}\n`;
        }
      }
      const ignored = saveObservations(root, next);
      // Said once, when it happens: the project's .gitignore just changed under the user
      // (rules/design-invariants.md § Telling the user what you dropped — additions too).
      if (ignored) process.stderr.write('quiet-run: created .claude/machinery/observations.json and added it to .gitignore (per-machine measurement, never tracked)\n');
    }
  } catch { /* recording is best-effort; never fail the wrapped command over it */ }
  if (nudge) process.stdout.write(nudge);
```

- [ ] **Step 5: Run the new file, then the two runner suites, then everything**

Run: `node --test plugins/machinery/test/quiet-run-training.test.mjs`
Expected: 5 pass.

Run: `node --test plugins/machinery/test/quiet-run.test.mjs plugins/machinery/test/quiet.test.mjs`
Expected: all pass, unmodified. The cases there that would see a nudge are the ones that run a noisy bespoke command inside a repository, and none of them asserts on the tail of stdout: `a run records its observation …` reads the record; the `ANSWER 42` control asserts `doesNotMatch`. Every other bespoke case is either quiet, outside a repository (nothing recorded), or a catalog tool without `learned`.

Run: `node --test 'plugins/machinery/test/*.test.mjs'`
Expected: all pass, 0 fail, and the wall clock reported at the end under 15 s.

- [ ] **Step 6: Commit**

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- plugins/machinery/scripts/quiet-run.mjs plugins/machinery/test/quiet-run-training.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: quiet-run.mjs notes each training-eligible run, re-opens a drifted matcher (design V12), and nudges on stdout"
```

---
## Task 8: The session's half — `train-tool.mjs`

**Files:**
- Create: `plugins/machinery/scripts/train-tool.mjs`
- Test: `plugins/machinery/test/train-tool.test.mjs`

**Interfaces:**
- Consumes: `parseRunLog`, `linesOf`, `listRunLogs`, `logDir` (Task 1); `loadCatalog`, `matchTool`, `isLearned` (Task 3); `loadObservations`, `saveObservations`, `bespokeKey`, `withTraining` (Task 5); `trainingOf`, `identify`, `GRADUATION_AGREEMENTS` (Task 4); `graduate` (Task 6); `projectRoot` (`lib/root.mjs`, existing).
- Produces, CLI only:
  - `node scripts/train-tool.mjs identify --log <run log> --line <N> [--root <project>]` — `N` is the log file's own 1-based line number (line 1 is `$ <command>`). Prints `identified: <text>`, a `shadow:` line, `matcher: prefix \`<value>\`` when one exists, and on graduation `graduated: '<id>' …`, one `wrote <file>` per file, and a `commit both` line. Exit 0. Refusals exit 1 with `train-tool: <reason>` on stderr and no stack trace; usage errors exit 2.
  - `node scripts/train-tool.mjs logs [--key <key>]` — one line `<file>\t<key>` per stored run log, newest first, then a proof line `train_tool_logs: <n> of <total> run logs …`.
  - The key is derived exactly as the runner derives it: `matchTool(command, catalog) ?? bespokeKey(command)` over the log's own `$ command` header. There is no `--key` on `identify`, so the session cannot file a pick under the wrong tool.

**Test cost:** CLI spawns only (node, over synthetic logs written with `formatRunLog`), one `git init` per case, in a new file.

*Corrected after the final whole-branch review (ledger #12): this line read "12 CLI spawns … two `git init`s" and was wrong on the second count as landed — the file has four `repo()` calls, not two. The C1 fix then added a fifth case, `the loop closes backward`, which is the one exception to "no bash, no tool run": it drives the real runner once, because only the runner can produce drift. As it stands the file costs 22 node spawns — 21 of `train-tool.mjs`, plus the one `quiet-run.mjs` spawn that wraps a real bash run — and five `git init`s, and runs in ~1.1 s well inside the pre-commit budget whose pole is `gate.test.mjs`.*

- [ ] **Step 1: Write the failing tests**

```js
// plugins/machinery/test/train-tool.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { formatRunLog } from '../scripts/lib/runlog.mjs';
import { loadCatalogReport } from '../scripts/lib/catalog.mjs';
import { survivalProblems } from '../scripts/lib/survival.mjs';

process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;

// The whole loop through the CLI, over SYNTHETIC run logs written with the runner's own formatter:
// no tool is spawned, so the four runs cost four node starts and nothing else.
const repo = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); execFileSync('git', ['init', '-q'], { cwd: d }); return d; };
const JOB = fs.mkdtempSync(path.join(os.tmpdir(), 'train-tool-job-'));
fs.mkdirSync(path.join(JOB, 'tmp'));
let n = 0;
const CMD = 'bash scripts/battery.sh --quick';
function writeLog(summary, command = CMD) {
  const records = [
    { t: 0.1, stream: 'stderr', text: '   Compiling fs-core v0.1.0' },
    { t: 0.2, stream: 'stdout', text: 'running 128 tests' },
    { t: 1.5, stream: 'stdout', text: summary },
  ];
  const file = path.join(JOB, 'tmp', `quiet-20260905-12000${n++}-1.log`);
  fs.writeFileSync(file, formatRunLog(command, records));
  return file;
}
const train = (root, ...args) => runScript('scripts/train-tool.mjs', { cwd: root, args, env: { CLAUDE_JOB_DIR: JOB } });
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const machinery = (root, ...p) => path.join(root, '.claude', 'machinery', ...p);

test('the loop, end to end: two picks form the prefix, two agreements graduate it, and the files land where the catalog reads them', () => {
  const root = repo('train-tool-loop-');
  const logs = ['3', '4', '5', '60'].map((s) => writeLog(`test result: ok. ${s} passed; 0 failed`));
  // The summary is the third record of each log; line 1 is `$ command`, so it is line 4 of the file.
  const r1 = train(root, 'identify', '--log', logs[0], '--line', '4');
  assert.equal(r1.code, 0, r1.stderr);
  assert.match(r1.stdout, /^identified: test result: ok\. 3 passed; 0 failed\n/);
  assert.match(r1.stdout, /shadow: no matcher yet/);
  const r2 = train(root, 'identify', '--log', logs[1], '--line', '4');
  assert.match(r2.stdout, /matcher: prefix `test result: ok\. `/);
  const r3 = train(root, 'identify', '--log', logs[2], '--line', '4');
  assert.match(r3.stdout, /shadow: agreed — 1 of 2 consecutive agreements/);
  assert.doesNotMatch(r3.stdout, /graduated/);
  const r4 = train(root, 'identify', '--log', logs[3], '--line', '4');
  assert.equal(r4.code, 0, r4.stderr);
  assert.match(r4.stdout, /shadow: agreed — 2 of 2 consecutive agreements/);
  assert.match(r4.stdout, /graduated: 'bash-scripts-battery\.sh' now keeps lines starting with `test result: ok\. `/);
  assert.match(r4.stdout, /commit both/);
  const entry = read(machinery(root, 'tool-catalog.json'))['bash-scripts-battery.sh'];
  assert.deepEqual(entry.outcome, { type: 'prefix', value: 'test result: ok. ' });
  assert.deepEqual(entry.match, { type: 'prefix', value: 'bash scripts/battery.sh' });
  const fixture = read(machinery(root, 'fixtures', 'bash-scripts-battery.sh.json'));
  assert.deepEqual(survivalProblems('bash-scripts-battery.sh', entry, fixture), []);
  assert.deepEqual(fixture.answers, [2, 3, 4, 5]);
  const { catalog, dropped } = loadCatalogReport(root);
  assert.deepEqual(dropped, []); assert.ok(catalog['bash-scripts-battery.sh']);
  const obs = read(machinery(root, 'observations.json'));
  assert.ok(!('bash scripts/battery.sh' in obs), 'the record moved with the tool');
  assert.deepEqual(obs['bash-scripts-battery.sh'].training.picks, []);
  // Graduated and not re-opened: a further identification is refused, and says why.
  const r5 = train(root, 'identify', '--log', writeLog('test result: ok. 9 passed; 0 failed'), '--line', '4');
  assert.notEqual(r5.code, 0); assert.match(r5.stderr, /already graduated/);
});

test('refusals are diagnostics, not stack traces: a missing log, a line that is not a record, a hand-written entry, no arguments', () => {
  const root = repo('train-tool-refuse-');
  const missing = train(root, 'identify', '--log', path.join(JOB, 'tmp', 'quiet-none.log'), '--line', '4');
  assert.notEqual(missing.code, 0); assert.match(missing.stderr, /no run log at/); assert.doesNotMatch(missing.stderr, /\n\s+at /);
  const log = writeLog('test result: ok. 1 passed; 0 failed');
  const header = train(root, 'identify', '--log', log, '--line', '1');
  assert.notEqual(header.code, 0); assert.match(header.stderr, /records are lines 2 to 4/);
  const past = train(root, 'identify', '--log', log, '--line', '5');
  assert.notEqual(past.code, 0); assert.match(past.stderr, /records are lines 2 to 4/);
  fs.mkdirSync(machinery(root), { recursive: true });
  fs.writeFileSync(machinery(root, 'tool-catalog.json'), JSON.stringify({ battery: { match: { type: 'prefix', value: 'bash scripts/battery.sh' }, outcome: '^test result:', candidates: [] } }));
  const hand = train(root, 'identify', '--log', log, '--line', '4');
  assert.notEqual(hand.code, 0); assert.match(hand.stderr, /hand-written catalog entry/);
  assert.ok(!fs.existsSync(machinery(root, 'observations.json')), 'RED CHECK: a refusal records nothing');
  const usage = train(root, 'identify');
  assert.equal(usage.code, 2); assert.match(usage.stderr, /^usage: /);
});

test('logs lists stored run logs newest first with the key the runner would use, filtered by --key, with a proof line', () => {
  const root = repo('train-tool-logs-');
  const a = writeLog('x', 'python scripts/oracle_compare.py --base HEAD~1');
  const r = train(root, 'logs', '--key', 'python scripts/oracle_compare.py');
  assert.equal(r.code, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines[0], `${a}\tpython scripts/oracle_compare.py`);
  assert.match(lines.at(-1), /^train_tool_logs: 1 of \d+ run logs match 'python scripts\/oracle_compare\.py'/);
  const all = train(root, 'logs');
  assert.ok(all.stdout.split('\n').filter((l) => l.endsWith('\tbash scripts/battery.sh')).length >= 4, 'the loop test’s logs are listed under their bespoke key in a project with no learned entry');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test plugins/machinery/test/train-tool.test.mjs`
Expected: FAIL — the script does not exist.

- [ ] **Step 3: Implement**

```js
#!/usr/bin/env node
// plugins/machinery/scripts/train-tool.mjs
// The session's half of the training loop. Story: the design's "The model in the loop is the
// session": the wrapper records a run and nudges; the assistant, in a turn it was already having,
// reads the run's log and says which line is the answer — `identify` — and this script does the rest
// with arithmetic (lib/training.mjs) and the graduation gate (lib/graduate.mjs). No inference
// happens here and no hook waits on this. `logs` lists stored run logs, so identification can also
// happen in batch over runs that already happened.
//
//   node train-tool.mjs identify --log <run log> --line <N> [--root <project>]
//   node train-tool.mjs logs [--key <key>]
//
// N is the log FILE's own line number, as a Read of it shows: line 1 is `$ <command>`.
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog, matchTool, isLearned } from './lib/catalog.mjs';
import { loadObservations, saveObservations, bespokeKey, withTraining } from './lib/observations.mjs';
import { parseRunLog, linesOf, listRunLogs, logDir } from './lib/runlog.mjs';
import { trainingOf, identify, GRADUATION_AGREEMENTS } from './lib/training.mjs';
import { graduate } from './lib/graduate.mjs';

const argv = process.argv.slice(2);
const sub = argv[0];
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const say = (s) => process.stdout.write(s + '\n');
const die = (m) => { process.stderr.write(`train-tool: ${m}\n`); process.exit(1); };
const usage = () => { process.stderr.write('usage: train-tool.mjs identify --log <run log> --line <N> [--root <project>]\n       train-tool.mjs logs [--key <key>]\n'); process.exit(2); };

// A log is external input: missing, unreadable or malformed is a diagnostic, never a stack trace
// (rules/design-invariants.md § External input).
function readLog(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) { return die(e.code === 'ENOENT' ? `no run log at ${file}` : `cannot read ${file}: ${e.message}`); }
  try { return parseRunLog(text); } catch (e) { return die(`${file}: ${e.message}`); }
}
// The key exactly as the runner derives it for the same command — one derivation, so the pick lands
// on the record the runner writes to, and a graduated tool is found under its learned id.
const keyOf = (command, catalog) => matchTool(command, catalog) ?? bespokeKey(command);

function identifyCmd() {
  const file = opt('--log'), n = Number(opt('--line'));
  if (!file || !Number.isInteger(n)) return usage();
  const { command, records } = readLog(file);
  const lines = linesOf(records);
  const headerLines = command.split('\n').length;
  const index = n - headerLines - 1;
  if (index < 0 || index >= lines.length) die(`--line ${n} is not a record of ${file}: records are lines ${headerLines + 1} to ${headerLines + lines.length}`);
  let root;
  try { root = opt('--root') ? path.resolve(opt('--root')) : projectRoot(process.cwd()); } catch (e) { return die(e.message); }
  const catalog = loadCatalog(root);
  const observations = loadObservations(root);
  const key = keyOf(command, catalog);
  const entry = catalog[key];
  if (entry && !isLearned(entry)) die(`'${key}' has a hand-written catalog entry; its answer line is declared there, not learned`);
  const training = trainingOf(observations[key]);
  if (entry && !training.open) die(`'${key}' has already graduated; drift re-opens it, and the runner says so when it does`);
  const at = new Date().toISOString();
  const r = identify(training, { lines, index, log: file, at });
  say(`identified: ${lines[index]}`);
  if (r.agreed === null) say(r.matcher ? 'shadow: nothing to compare against before this pick; it forms the first matcher' : 'shadow: no matcher yet — one pick; the prefix needs two');
  else say(`shadow: ${r.agreed ? 'agreed' : 'disagreed'} — ${r.training.streak} of ${GRADUATION_AGREEMENTS} consecutive agreements`);
  if (r.matcher) say(`matcher: prefix \`${r.matcher.value}\``);
  if (!r.graduates) { saveObservations(root, withTraining(observations, key, r.training)); return; }
  const g = graduate(root, { key, catalog, observations, training: r.training, matcher: r.matcher, lines, index, log: file, at });
  if (!g.ok) {
    // The pick still counts; the gate is what said no, and it says why.
    saveObservations(root, withTraining(observations, key, r.training));
    return die(`graduation refused — the fixture does not prove the matcher:\n  ${g.problems.join('\n  ')}`);
  }
  saveObservations(root, g.observations);
  say(`graduated: '${g.id}' now keeps lines starting with \`${r.matcher.value}\` when '${key}' is filtered`);
  for (const f of g.files) say(`wrote ${f}`);
  say('commit both: the learned matcher and its frozen fixture are a team artifact, like the rest of the project catalog');
}

function logsCmd() {
  const want = opt('--key');
  let catalog = {};
  try { catalog = loadCatalog(projectRoot(process.cwd())); } catch { /* outside a repository: bespoke keys only */ }
  const files = listRunLogs();
  let shown = 0;
  for (const file of files) {
    let command;
    try { ({ command } = parseRunLog(fs.readFileSync(file, 'utf8'))); } catch { continue; }
    const key = keyOf(command, catalog);
    if (want && key !== want) continue;
    say(`${file}\t${key}`); shown++;
  }
  // The proof line (rules/tool-output.md § Proof lines and denominators): the count and its denominator.
  say(`train_tool_logs: ${shown} of ${files.length} run logs ${want ? `match '${want}'` : 'listed'} in ${logDir()}`);
}

if (sub === 'identify') identifyCmd();
else if (sub === 'logs') logsCmd();
else usage();
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test plugins/machinery/test/train-tool.test.mjs`
Expected: 3 pass.

- [ ] **Step 5: Run the whole suite, then commit**

Run: `node --test 'plugins/machinery/test/*.test.mjs'`
Expected: all pass, 0 fail; `meta.test.mjs` sees the new suite's `RED CHECK`; `catalog.test.mjs`'s quote-scanner still finds exactly `lib/quotes.mjs` (nothing above names a quote character); `purity.test.mjs` finds no `JSON.stringify` here.

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- plugins/machinery/scripts/train-tool.mjs plugins/machinery/test/train-tool.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: train-tool.mjs — the session identifies a run's answer line; arithmetic derives the matcher and graduates it"
```

---
## Task 9: The skill the session follows, routed and built; the README

**Files:**
- Create: `claude-code/machinery/train-tool/SKILL.md` (the bucket source — never edit `plugins/machinery/skills/` by hand; `scripts/build-skills.mjs` generates it)
- Modify: `skills.manifest.json` (route `machinery` gains `train-tool`)
- Generate: `plugins/machinery/skills/train-tool/SKILL.md` via `node scripts/build-skills.mjs build`
- Modify: `plugins/machinery/README.md`
- Modify: `plugins/machinery/test/skills.test.mjs` (seven routed skills become eight)

**Interfaces:**
- Consumes: the `train-tool.mjs` CLI surface from Task 8 — `test/skills.test.mjs` checks that every `--flag` a skill names beside `scripts/train-tool.mjs` exists in that script's source (`--log`, `--line`, `--key` all do).
- Produces: `/machinery:train-tool`, the procedure the session runs when a tool result ends with a `[quiet:train]` line, or to identify in batch over stored logs.

**Test cost:** 0 spawns beyond `skills.test.mjs`'s existing `reload.mjs` spawn.

- [ ] **Step 1: Write the failing test change**

In `plugins/machinery/test/skills.test.mjs`, replace
```js
test('RED CHECK: seven skills exist', () => {
  const routed = JSON.parse(fs.readFileSync(path.join(REPO, 'skills.manifest.json'), 'utf8')).targets['claude-plugin'].routes.machinery.skills;
  assert.equal(routed.length, 7);
```
with
```js
test('RED CHECK: eight skills exist', () => {
  const routed = JSON.parse(fs.readFileSync(path.join(REPO, 'skills.manifest.json'), 'utf8')).targets['claude-plugin'].routes.machinery.skills;
  assert.equal(routed.length, 8);
  assert.ok(routed.includes('train-tool'), 'the training loop’s skill is routed');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test plugins/machinery/test/skills.test.mjs`
Expected: FAIL — seven routed skills, no `train-tool`.

- [ ] **Step 3: Write the skill**

`claude-code/machinery/train-tool/SKILL.md`:

```markdown
---
name: train-tool
description: Use when a wrapped command's output ends with a `[quiet:train]` line, or to teach the output filter a bespoke tool's answer line in batch from stored run logs. Reads the run's log, names the one line that is the tool's answer, and hands it to the training loop; the matcher is derived, never typed, and graduation writes a tracked catalog entry with its frozen fixture.
---
# /machinery:train-tool

The runner ends a noisy run of an unlearned tool with one advisory line:
`[quiet:train] <key>: answer line not yet learned (…) — read the log, then: node "…/scripts/train-tool.mjs" identify --log "<log>" --line <N>`.
It never blocks and nothing is applied by it; answering it is the whole of this skill.

1. Read the log the line names, with the `Read` tool so line numbers show. Line 1 is `$ <command>`; every line after is `<seconds> <out|err>  <text>`, verbatim.
2. Choose the ONE line that is the tool's answer: the line that states what happened — the summary, the verdict, the count. Not an error line (those survive on their own), not the last line (it always survives), not a progress line.
3. Run exactly: `node "${CLAUDE_PLUGIN_ROOT}/scripts/train-tool.mjs" identify --log "<log>" --line <N>`, with `N` the log file's own line number.
4. Read what comes back. `identified:` echoes the line — if it is not the one you meant, run again with the right number. `shadow:` says whether the prefix derived from earlier picks agreed with yours. `graduated:` names the id, and two `wrote` lines name the catalog entry and its frozen fixture: commit both with the next change, they are a team artifact. `train-tool: graduation refused` lists what the fixture could not prove; keep identifying on later runs.

Do not invent the pattern. The matcher is the longest common prefix of the lines you identify across runs; if you find yourself wanting to write a regex, stop — a hand-written entry goes in `.claude/machinery/tool-catalog.json` on its own, with its own fixture, and is never trained over. If the answer line genuinely differs in shape from run to run, say so to the owner and stop identifying it: a tool like that stays on the generic contract by design.

When a learned matcher drifts the runner says `learned answer line re-opened for training (<reason>)`; the steps are the same.

Batch: `node "${CLAUDE_PLUGIN_ROOT}/scripts/train-tool.mjs" logs --key "<key>"` lists that tool's stored run logs, newest first; identify them oldest first, one call each.
```

- [ ] **Step 4: Route it and build**

In `skills.manifest.json`, under `targets` → `claude-plugin` → `routes` → `machinery` → `skills`, append `"train-tool"` after `"invariant-audit"`:
```json
          "skills": [
            "install",
            "reload",
            "reindex",
            "rule-intake",
            "effort-lifecycle",
            "refresh-diverged-branch",
            "invariant-audit",
            "train-tool"
          ]
```

Run: `node scripts/build-skills.mjs build`
Expected: `staged 8 skill(s) into plugins/machinery/skills/` among its lines, and `plugins/machinery/skills/train-tool/SKILL.md` now exists, byte-identical to the bucket source.

Run: `node scripts/build-skills.mjs check`
Expected: passes except, possibly, the version line for `machinery` — which the bump in Step 7 satisfies.

- [ ] **Step 5: The README paragraph**

In `plugins/machinery/README.md`, after the paragraph under `## Teaching it a tool` (the one ending "moves the entry into the universal catalog and bumps the plugin version."), add:

```markdown
A tool the catalog does not know starts on the generic contract — the last line, error blocks,
proof lines and whatever the summary heuristics catch — and earns its own answer line through the
training loop. A noisy run ends with a `[quiet:train]` line naming the run's log; the session reads
the log and says which line is the answer (`/machinery:train-tool`); the matcher is the longest
common prefix of the lines identified across runs, a prefix by construction and never a regex; and
after two consecutive runs on which that prefix picks exactly the line the session picked, it
graduates into a learned entry in `.claude/machinery/tool-catalog.json` (tracked, a team artifact
like the rest of the project catalog) with a frozen fixture in `.claude/machinery/fixtures/<id>.json`
as its regression test. A learned matcher can only add a line to what is shown, never hide one. It
goes back into training on its own when it matches nothing in a run, when a run fails with no error
block, or when the output's shape moves; the state of that training lives in `observations.json`
and is per-machine like the rest of it.
```

- [ ] **Step 6: Run the skills suite and the whole suite**

Run: `node --test plugins/machinery/test/skills.test.mjs`
Expected: all pass — the eight-skills check, the CLI-flag scan (`--log`, `--line`, `--key` all appear in `scripts/train-tool.mjs`), the no-rule-restated check, and the routed-name check (`/machinery:train-tool` is now routed).

Run: `node --test 'plugins/machinery/test/*.test.mjs'`
Expected: all pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
cd /i/IdeaProjects/ai-skills
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add -- claude-code/machinery/train-tool/SKILL.md skills.manifest.json plugins/machinery/skills/train-tool/SKILL.md plugins/machinery/README.md plugins/machinery/test/skills.test.mjs plugins/machinery/.claude-plugin/plugin.json
git commit -m "machinery: /machinery:train-tool — the session's procedure for identifying a tool's answer line; README"
```

---
## Self-review

Run against the spec after the plan was written, as the writing-plans skill requires. Findings were fixed inline; what follows is the record.

### Spec coverage

| Spec requirement | Task |
|---|---|
| **Preservation contract** — the generic contract unchanged; "the final line unconditionally", error blocks, proof lines survive whatever the matcher says | Task 2 (V13 pinned with a wrong prefix matcher and with a matching one); `select()` is not modified by any task |
| "A bespoke tool … **earns** an outcome pattern through the training loop" | Tasks 4, 6, 8 |
| **Match techniques** — machine-derived patterns prefix or literal only; regex only in the human-reviewed table | Task 3 (`outcomeMatcher` never compiles the object form to a regex; `entryProblem` drops a learned regex at load — V9 at the reader), Task 4 (`deriveMatcher` builds only `{type:'prefix'}`), Task 6 (`graduate` refuses anything `entryProblem` would drop — V9 at the writer) |
| **The model in the loop is the session** — no hook blocks on inference; the hook records and nudges; identification in a turn the assistant was already having; batch over stored logs | Task 7 (nudge on the runner's stdout, nothing waits), Task 8 (`identify` over any stored log, `logs` to find them), Task 9 (the skill) |
| **Identification is the model's job; generalisation is not** — LCP across repeated observations; a single observation never graduates | Task 4 (V10: `deriveMatcher` null below two picks; deterministic) |
| **Graduation is shadow agreement** — both the local matcher and the session pick; K consecutive agreements; the nudge stops for that tool | Task 4 (`identify`: shadow first, then the pick; K = 2), Task 7 (no nudge once graduated and standing) |
| **Graduation freezes a fixture** — "a matcher that cannot be graduated with a fixture is not graduated" | Task 6 (V11: `survivalProblems` before the first write; positive control refuses and writes nothing) |
| **Drift re-opens training** — matched nothing; non-zero exit with no error block; shape moved (line-count distribution, stdout/stderr ratio) | Task 2 (`hasErrorBlock`), Task 4 (V12, each trigger separately), Task 7 (through the runner, the first trigger; `open` recorded, picks discarded, nudge names the reason) |
| **The floor stays underneath** — the matcher only promotes | Task 2 |
| **The honest limit** — a tool whose answer varies never graduates | Task 4 (the over-wide and disagreement cases: no graduation; the skill in Task 9 says to stop and say so) |
| **The nudge register** — advisory, never blocks, a proposal never an application; idempotent, state a function of the record | Task 7 (one stdout line after the output; the nudge text is computed from the record on every run, no "nudged already" flag) |
| **Where things live** — project state in `.claude/machinery/`; universal half untouched; promotion by the existing lifecycle | Task 6 (project catalog + `fixtures/<id>.json`, the path `promote-tool.mjs` already reads), Task 5 (training state in `observations.json`); nothing writes `data/tool-catalog.json` |
| **Verification 9** | Tasks 3, 4, 6 |
| **Verification 10** | Task 4 |
| **Verification 11** | Task 6 |
| **Verification 12** | Tasks 4, 7 |
| **Verification 13** | Task 2 |

Gaps found and closed during review: the runner's nudge originally had no case for a log that could not be written (a nudge pointing at nothing) — Task 7 now says so instead; `graduate()` originally read the project catalog through a fallback that would have replaced an unparsable file — Task 6 now refuses and pins it.

Not covered, by decision rather than omission, each stated in the task that owns it: `infra` runs do not train (Task 7 — `selectInfra()` takes no outcome pattern, so a matcher learned there would never be applied); a learned entry for a tool later found to be off-the-shelf reaches the universal catalog only through the unchanged `promote-tool.mjs` (Task 6 writes exactly the layout it reads).

### Placeholder scan

Searched the plan for `TBD`, `TODO`, `implement later`, `fill in`, `appropriate`, `handle edge cases`, `similar to Task`. None. Every code step shows the code; every run step names the command and the expected result. The one `<N>` in the plan is a literal the runner prints, for the session to replace, and is asserted as such in Task 7's tests.

### Type consistency

- `training` sub-record shape `{ picks, streak, history, lastLog?, open? }`: defined in Task 4 (`emptyTraining`, `trainingOf`), carried by Task 5 (`recordRun`, `withTraining`), written by Task 7 (`noteRun`, `reopen`), read by Task 8 (`trainingOf`, `identify`), consumed by Task 6 (`training.picks`, `graduated`). Field names match across all five.
- `identify()` returns `{ training, agreed, matcher, graduates }` (Task 4); Task 8 reads exactly those four; Task 6's `graduate()` takes `training` and `matcher` from it.
- `driftReason(training, run)` with `run = { matched, code, errorBlock, lines, stdoutLines, stderrLines }` (Task 4); Task 7 builds exactly that object.
- `outcomeMatcher(entry)` returns an object with `test(line)` (Task 3); `select(lines, outcomePattern)` calls `outcomePattern.test(line)` (Task 2 pins it); `shadowPick` (Task 4) calls the same compiler.
- `graduate(root, { key, catalog, observations, training, matcher, lines, index, log, at })` (Task 6) is called with exactly those keys in Task 8.
- `formatRunLog(command, records)` / `parseRunLog(text)` / `linesOf(records)` (Task 1) are used with those signatures in Tasks 7 (runner) and 8 (CLI and test).
- The learned entry `{ match: { type: 'prefix', value: key }, outcome: { type: 'prefix', value }, candidates: [], learned: { at, picks } }` is built in Task 4, checked by Task 3's `entryProblem`, written by Task 6, seeded verbatim in Task 7's tests and asserted in Task 8's.
- Every commit bumps with `--plugin plugins/machinery`; every test file this plan creates contains the literal `RED CHECK`.
