// plugins/machinery/test/quiet-run-training.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript } from './helpers/run.mjs';
import { parseRunLog } from '../scripts/lib/runlog.mjs';
import { generalizedForm } from '../scripts/lib/observations.mjs';
import { decide } from '../scripts/lib/assimilate.mjs';

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
// The bespoke key is the identity head of the command (#164): the command name plus its first
// positional. `-e` is a flag, so it closes the head — the one-off script it carries is variation
// inside the tool, not identity — and the key is the runner's own name.
const BESPOKE = 'node';
// #168: a run may hold several answer lines and the session identifies every one of them, so the
// nudge says "answer line(s)" and shows the list form it now accepts.
const NUDGE = /\[quiet:train\] node: answer line\(s\) not yet learned \(0 identified, 0 of 2 agreements\) — read the log, then: node "([^"]+\/train-tool\.mjs)" identify --log "([^"]+)" --line <N\[,N\.\.\.\]>\n$/;

test('a noisy bespoke run ends with the training nudge, naming a log that exists and holds this run, and the run is noted', { skip: !bash }, () => {
  const root = repo('quiet-train-nudge-');
  const r = run(root, 'filter', gen(100));
  const m = NUDGE.exec(r.stdout);
  assert.ok(m, `no nudge at the end of:\n${r.stdout.slice(-400)}`);
  // Restored (Task 8): train-tool.mjs now exists, so the nudge's path is checked against the real
  // file, not just its shape. The shape checks stay alongside it rather than being replaced.
  assert.ok(fs.existsSync(m[1]), `the nudge names a train-tool.mjs that does not exist: ${m[1]}`);
  assert.equal(path.basename(m[1]), 'train-tool.mjs', 'the trainer the nudge names is train-tool.mjs');
  assert.equal(path.basename(path.dirname(m[1])), 'scripts', 'the trainer sits beside quiet-run.mjs');
  const { command, records } = parseRunLog(fs.readFileSync(m[2], 'utf8'));
  assert.equal(command, gen(100), 'the nudge points at THIS run');
  assert.equal(records.length, 101);
  const t = obsOf(root)[BESPOKE].training;
  assert.deepEqual(t.history, [{ lines: 101, stdoutLines: 101, stderrLines: 0, code: 0 }]);
  assert.equal(t.lastLog.replace(/\\/g, '/'), m[2]);
  assert.deepEqual(t.picks, []); assert.equal(t.streak, 0);
});

test('RED CHECK: a quiet bespoke run gets no nudge — a tool that is never wrapped again would never apply a matcher', { skip: !bash }, () => {
  const root = repo('quiet-train-quiet-');
  const r = run(root, 'filter', gen(5));
  assert.doesNotMatch(r.stdout, /\[quiet:train\]/);
  assert.equal(obsOf(root)[BESPOKE].training.history.length, 1, 'the run is still noted: the shape history is measurement, not a nudge');
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
  assert.match(r.stdout, /\[quiet:train\] node: learned answer line\(s\) re-opened for training \(matched-nothing\) — read the log, then: node "[^"]+" identify --log "[^"]+" --line <N\[,N\.\.\.\]>\n$/);
});

// Beyond the brief's literal test list: a regression pin on Task 4's sanitizer (lib/training.mjs
// trainingOf(), lines 35-44) — a hand-edited non-object `training` field reads as the empty shape
// rather than throwing. `training` here is a bare string, not an object: recordRun() only drops a
// PRIOR training field on `undefined`, so this garbage string survives into trainingOf(), which is
// the one place required to sanitise it. Fix round 1 note: this test alone is NOT evidence the
// try/catch guard around the recording block (quiet-run.mjs:169-214) does anything — trainingOf()
// never throws on this input, guard present or not, so the assertions below pass identically
// either way. It stays because the sanitizer behaviour is worth pinning; the guard itself is
// proven by the next test, which forces a real throw.
test('a malformed training record is sanitised rather than recorded raw (regression pin on trainingOf, not a guard test)', { skip: !bash }, () => {
  const root = repo('quiet-train-sanitize-');
  seed(root, 'observations.json', { [BESPOKE]: { identity: 'bespoke', ledger: {}, training: 'not-an-object' } });
  const cmd = `node -e "console.log('real output'); process.exit(7)"`;
  const r = run(root, 'filter', cmd);
  assert.equal(r.code, 7, "the wrapped command's own exit code survives a garbage training record");
  assert.equal(r.stdout, 'real output\n', "the wrapped command's own output survives a garbage training record");
  const t = obsOf(root)[BESPOKE].training;
  assert.deepEqual(t.picks, []); assert.equal(t.streak, 0);
  assert.deepEqual(t.history, [{ lines: 1, stdoutLines: 1, stderrLines: 0, code: 7 }], 'the string was sanitised to the empty shape, then this run was noted onto it');
  assert.equal(typeof t.lastLog, 'string');
});

// Fix round 1 — the falsifiable guard test. The property that actually depends on the try/catch
// at quiet-run.mjs:169-214 is the wrapped command's own EXIT CODE, not its stdout:
// process.stdout.write(out) (quiet-run.mjs:166) already ran, synchronously, before this try/catch
// even opens, so no throw inside it can touch what was already written — an stdout assertion here
// can never distinguish a present guard from a missing one. What an uncaught throw inside the
// block DOES change is main()'s own return: `return code` (line 217) never executes, main()'s
// promise rejects, and the outer .catch() (line 220) overwrites process.exitCode with 1 — turning
// this test's real exit code, 7, into 1. A sanitiser-safe value can never force that throw:
// everything reaching saveObservations() was loaded through JSON.parse (loadObservations, or this
// seed() helper's own JSON.stringify), and nothing JSON.parse can produce is unsafe for
// JSON.stringify to write back out — so a BigInt or a circular reference, the reviewer's
// suggestion, cannot be seeded through the observations.json file this record actually loads from.
// A directory sitting where observations.json is expected throws for real (EISDIR) at
// saveObservations()'s own fs.writeFileSync, inside the guarded region, for a wholly realistic
// reason (a path collision, not a fabricated in-memory value) — proven RED against a deliberately
// broken build in the accompanying report (task-7-report.md, "Fix round 1").
test('a write that genuinely throws inside the recording block still leaves the wrapped command its own exit code (falsifiable guard proof)', { skip: !bash }, () => {
  const root = repo('quiet-train-guard-throw-');
  const obsPath = path.join(root, '.claude', 'machinery', 'observations.json');
  fs.mkdirSync(obsPath, { recursive: true }); // observations.json IS a directory: the write inside the guard throws for real
  const cmd = `node -e "console.log('real output'); process.exit(7)"`;
  const r = run(root, 'filter', cmd);
  assert.equal(r.code, 7, "the wrapped command's own exit code survives a write that genuinely throws inside the guard");
  assert.equal(r.stdout, 'real output\n', "the wrapped command's own output is unaffected (already written before the guarded block opened)");
  assert.ok(fs.statSync(obsPath).isDirectory(), 'the write really did fail: observations.json is still the directory it was, never replaced');
});

// ---- Identity is the head, end to end through the real runner (#164) ----
// Required behaviour 3: flags are variation inside the tool. Before this ticket the runner keyed on
// the generalized form, so the two runs below wrote TWO records with one run each, and
// GRADUATION_AGREEMENTS = 2 on one key was unreachable — the ferrislicer wall, where `cargo test`
// ran 27 times and became 27 keys.
test('#164 two differently-flagged runs of one script write two history entries on ONE record', { skip: !bash }, () => {
  const root = repo('quiet-train-head-');
  fs.writeFileSync(path.join(root, 'noisy.sh'), 'for i in $(seq 1 100); do echo "   Compiling c$i"; done\necho done\n');
  run(root, 'filter', 'bash noisy.sh --fast');
  run(root, 'filter', 'bash noisy.sh --slow');
  const obs = obsOf(root);
  assert.deepEqual(Object.keys(obs), ['bash noisy.sh'], `two runs, one record: ${JSON.stringify(Object.keys(obs))}`);
  assert.equal(obs['bash noisy.sh'].training.history.length, 2, 'both runs are on that record, as two entries');
  assert.equal(obs['bash noisy.sh'].noisy, true);
  // POSITIVE CONTROL that the observer could have seen two records: the two command lines really do
  // differ where identity used to be taken from, and the run's SHAPE still tells them apart.
  assert.notEqual(generalizedForm('bash noisy.sh --fast'), generalizedForm('bash noisy.sh --slow'));
});

// ---- A zero-line run is not evidence of quiet, end to end (#164, owner 2026-09-21) ----
// With identity at the head, the redirected run and the bare run are ONE record. This is the real
// runner writing that record, then decide() reading it, so nothing here is a literal.
test('#164 ruling 2 e2e: a redirected 0-line run leaves the head unmeasured, so the next noisy bare run is wrapped', { skip: !bash }, () => {
  const root = repo('quiet-zero-line-');
  fs.writeFileSync(path.join(root, 'noisy.sh'), 'for i in $(seq 1 100); do echo "   Compiling c$i"; done\necho done\n');
  // Run 1: the child shell sends everything to a file, so nothing reaches the runner's pipes.
  run(root, 'filter', 'bash noisy.sh > out.txt 2>&1');
  const after1 = obsOf(root);
  assert.deepEqual(Object.keys(after1), ['bash noisy.sh'], 'the redirect target is an operand, so both runs share this head');
  assert.equal(after1['bash noisy.sh'].training.history.length, 1, 'the run IS observed: #160 stands');
  assert.deepEqual(after1['bash noisy.sh'].training.history[0], { lines: 0, stdoutLines: 0, stderrLines: 0, code: 0 });
  assert.ok(!('noisy' in after1['bash noisy.sh']), '0 lines on the pipe is no measurement of the tool');
  assert.equal(decide('bash noisy.sh', { catalog: {}, observations: after1 }).mode, 'observe', 'still unseen, so the next run is observed');
  // POSITIVE CONTROL for what the ruling prevents: the SAME record with the `noisy: false` the old
  // rule would have written routes to `plain` — unwrapped — so the 101-line run below would have
  // reached the session in full. The observer is demonstrably alive.
  const asOldRuleWrote = { 'bash noisy.sh': { ...after1['bash noisy.sh'], noisy: false, lines: 0, stdoutLines: 0, stderrLines: 0 } };
  assert.equal(decide('bash noisy.sh', { catalog: {}, observations: asOldRuleWrote }).mode, 'plain');
  // Run 2: bare, and it really does put output on the pipe. THAT decides.
  run(root, 'filter', 'bash noisy.sh');
  const after2 = obsOf(root);
  assert.equal(after2['bash noisy.sh'].noisy, true);
  assert.equal(after2['bash noisy.sh'].lines, 101, '100 compile lines plus `done`');
  assert.equal(after2['bash noisy.sh'].training.history.length, 2, 'both runs are on the one record');
  assert.equal(decide('bash noisy.sh', { catalog: {}, observations: after2 }).mode, 'noisy', 'wrap');
});
