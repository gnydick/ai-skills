// plugins/machinery/test/quiet-run-training.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript } from './helpers/run.mjs';
import { parseRunLog } from '../scripts/lib/runlog.mjs';

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
  assert.doesNotMatch(r.stdout, /\[quiet:train\]/, 'graduated and standing: no nudge');
  assert.ok(!('open' in obsOf(root).node.training), 'the matcher matched, so nothing re-opened');
});

// ---- Task 7: the runner notes runs, judges drift, and nudges (design, "The nudge register") ----
const gen = (n) => `node -e "for(let i=0;i<${n};i++)console.log('   Compiling c'+i);console.log('done')"`;
const NUDGE = /\[quiet:train\] node: answer line not yet learned \(0 identified, 0 of 2 agreements\) — read the log, then: node "([^"]+\/train-tool\.mjs)" identify --log "([^"]+)" --line <N>\n$/;

test('a noisy bespoke run ends with the training nudge, naming a log that exists and holds this run, and the run is noted', { skip: !bash }, () => {
  const root = repo('quiet-train-nudge-');
  const r = run(root, 'filter', gen(100));
  const m = NUDGE.exec(r.stdout);
  assert.ok(m, `no nudge at the end of:\n${r.stdout.slice(-400)}`);
  // DEVIATION from the brief's literal `assert.ok(fs.existsSync(m[1]), ...)`: train-tool.mjs is
  // Task 8's deliverable and has not landed in this worktree yet (confirmed: absent from the tree
  // and from git log through e81eb4c). Asserting existence would fail for a reason unrelated to
  // this task's own code, so the check here is what IS decidable now — that the nudge's own path
  // construction (TRAINER in quiet-run.mjs) is well-formed and sits beside quiet-run.mjs itself.
  assert.equal(path.basename(m[1]), 'train-tool.mjs', 'the trainer the nudge names is train-tool.mjs');
  assert.equal(path.basename(path.dirname(m[1])), 'scripts', 'the trainer sits beside quiet-run.mjs');
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

// Beyond the brief's literal test list: the top-level task requires a case proving the training
// path is guarded — a malformed training record must never cost the wrapped command its own
// output or its own exit code (rules/design-invariants.md, and this file's own header: recording
// is best-effort). `training` here is a bare string, not an object: recordRun() only drops a
// PRIOR training field on `undefined`, so a hand-edited non-object string survives into
// trainingOf(), which is the one place required to sanitise it rather than throw.
test('the training path never costs the wrapped command its output or exit code, however malformed the training record', { skip: !bash }, () => {
  const root = repo('quiet-train-guard-');
  seed(root, 'observations.json', { node: { identity: 'bespoke', ledger: {}, training: 'not-an-object' } });
  const cmd = `node -e "console.log('real output'); process.exit(7)"`;
  const r = run(root, 'filter', cmd);
  assert.equal(r.code, 7, "the wrapped command's own exit code survives a garbage training record");
  assert.equal(r.stdout, 'real output\n', "the wrapped command's own output survives a garbage training record");
});
