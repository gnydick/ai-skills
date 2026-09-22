// plugins/machinery/test/train-tool.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { formatRunLog } from '../scripts/lib/runlog.mjs';
import { loadCatalogReport, matchTool } from '../scripts/lib/catalog.mjs';
import { survivalProblems } from '../scripts/lib/survival.mjs';
import { learnedId, AGREEMENT_MATCH_CAP } from '../scripts/lib/training.mjs';
import { bespokeKey } from '../scripts/lib/observations.mjs';

process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;

// The whole loop through the CLI, over SYNTHETIC run logs written with the runner's own formatter:
// no tool is spawned, so the four runs cost four node starts and nothing else.
const repo = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); execFileSync('git', ['init', '-q'], { cwd: d }); return d; };
const JOB = fs.mkdtempSync(path.join(os.tmpdir(), 'train-tool-job-'));
fs.mkdirSync(path.join(JOB, 'tmp'));
let n = 0;
const CMD = 'bash scripts/battery.sh --quick';
// The key IS the generalized command form (#87), flag name and all, so the id it sanitizes to
// carries the flag too. Derived here rather than typed, so the two cannot drift apart.
const LEARNED_ID = learnedId(bespokeKey(CMD));
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
// A `cargo test -p fs-core` run: one `test result:` summary per target, with the per-test lines that
// sit between them. Eleven records after the one-line `$ command` header, so the three summary lines
// are FILE lines 6, 9 and 12 — the numbers a Read of the log shows, which is what `--line` takes.
const OK = (n) => `test result: ok. ${n} passed; 0 failed`;
const CARGO_LINES = [6, 9, 12];
function writeCargoLog(lib, integration, doctest, command = CMD) {
  const texts = [
    '   Compiling fs-core v0.1.0', 'running 2 tests', 'test slice::keeps_order ... ok',
    'test slice::rejects_empty ... ok', lib, 'running 1 test', 'test api::roundtrip ... ok',
    integration, 'running 1 test', 'test src/lib.rs - slice (line 12) ... ok', doctest,
  ];
  const file = path.join(JOB, 'tmp', `quiet-20260905-12000${n++}-1.log`);
  fs.writeFileSync(file, formatRunLog(command, texts.map((text, i) => ({ t: 0.1 * i, stream: 'stdout', text }))));
  return file;
}
const train = (root, ...args) => runScript('scripts/train-tool.mjs', { cwd: root, args, env: { CLAUDE_JOB_DIR: JOB } });
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const machinery = (root, ...p) => path.join(root, '.claude', 'machinery', ...p);
// One case below drives the REAL runner, because only the runner can produce drift; it is the one
// bash spawn in this file and it is guarded the way quiet-run-training.test.mjs guards its own.
const bash = fs.existsSync('C:/Program Files/Git/bin/bash.exe') || process.platform !== 'win32';
const runner = (root, cmd) => runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd], env: { CLAUDE_JOB_DIR: JOB } });

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
  // The id no longer carries the flag: identity is the head (#164), so `--quick` is variation
  // inside the tool and `bash scripts/battery.sh --quick` sanitizes to `bash-scripts-battery.sh`.
  assert.match(r4.stdout, /graduated: 'bash-scripts-battery\.sh' now keeps lines starting with `test result: ok\. `/);
  assert.match(r4.stdout, /commit both/);
  const entry = read(machinery(root, 'tool-catalog.json'))[LEARNED_ID];
  assert.deepEqual(entry.outcome, { type: 'prefix', value: 'test result: ok. ' });
  // The entry matches on the pair's PREFIX, the literal leading run of the command (#87) — the key
  // itself now carries the flag name and could carry placeholders, and no command starts with one.
  assert.deepEqual(entry.match, { type: 'prefix', value: 'bash scripts/battery.sh' });
  const fixture = read(machinery(root, 'fixtures', `${LEARNED_ID}.json`));
  assert.deepEqual(survivalProblems(LEARNED_ID, entry, fixture), []);
  assert.deepEqual(fixture.answers, [2, 3, 4, 5]);
  const { catalog, dropped } = loadCatalogReport(root);
  assert.deepEqual(dropped, []); assert.ok(catalog[LEARNED_ID]);
  assert.equal(matchTool(CMD, catalog), LEARNED_ID, 'and the entry it wrote really does match the command it was learned from');
  const obs = read(machinery(root, 'observations.json'));
  assert.ok(!(CMD in obs), 'the record moved with the tool');
  assert.deepEqual(obs[LEARNED_ID].training.picks, []);
  // Graduated and not re-opened: a further identification is refused, and says why.
  const r5 = train(root, 'identify', '--log', writeLog('test result: ok. 9 passed; 0 failed'), '--line', '4');
  assert.notEqual(r5.code, 0); assert.match(r5.stderr, /already graduated/);
});

// Final whole-branch review, C1: the loop has to close BACKWARD as well as forward. A tool has two
// identities — the bespoke key (`bash scripts/battery.sh`) before graduation, and the sanitized
// catalog id (`bash-scripts-battery.sh`) after — and from the first run after graduation
// matchTool() answers with the id, so the runner and this CLI both key on the id from then on. A
// re-graduation after drift therefore arrives with `key` ALREADY EQUAL to the id, while the entry
// it must not break still carries the bespoke command shape in `match.value`; rebuilding that
// `match` from the key would write the id, which no command starts with, and the entry would match
// nothing forever. Every other learned-entry case in this suite uses a key where
// learnedId(key) === key (`node`), which is exactly why this stayed invisible: it can only break on
// a key carrying a space or a slash — that is, on every bespoke tool the design names.
//
// Driven end to end: four identifications graduate it, the REAL runner drifts it (only the runner
// can), four more identifications re-graduate it. The key is never handed in by the test.
test('the loop closes backward: drift re-opens a graduated tool and re-identifying to agreement re-graduates it', { skip: !bash }, () => {
  const root = repo('train-tool-reclose-');
  const ID = LEARNED_ID, KEY = CMD, PREFIX = 'bash scripts/battery.sh';
  let r;
  for (const s of ['3', '4', '5', '60']) r = train(root, 'identify', '--log', writeLog(`test result: ok. ${s} passed; 0 failed`), '--line', '4');
  assert.equal(r.code, 0, r.stderr);
  assert.ok(r.stdout.includes(`graduated: '${ID}'`), r.stdout);

  // Drift, through the real runner. The tool prints nothing starting with the learned prefix, which
  // is the design's first trigger ("the matcher matched nothing in a run"). That this re-opens the
  // record under ID rather than KEY is the whole mechanism of the defect, and it is asserted here.
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'battery.sh'),
    'i=0\nwhile [ $i -lt 100 ]; do echo "   Compiling c$i"; i=$((i+1)); done\necho "PASS: 99 checks ok"\n');
  const drift = runner(root, KEY);
  assert.equal(drift.code, 0, drift.stderr);
  assert.match(drift.stdout, /\[quiet:train\] bash-scripts-battery\.sh: learned answer line\(s\) re-opened for training \(matched-nothing\)/);
  assert.equal(read(machinery(root, 'observations.json'))[ID].training.open.reason, 'matched-nothing');
  assert.ok(!(KEY in read(machinery(root, 'observations.json'))), 'the runner keys on the id once the tool has graduated');

  // Round two, to agreement on a DIFFERENT answer shape, so a re-graduation that merely re-wrote
  // the old entry unchanged could not pass this.
  for (const s of ['3', '4', '5', '60']) r = train(root, 'identify', '--log', writeLog(`PASS: ${s} checks ok`), '--line', '4');
  assert.match(r.stdout, /shadow: agreed — 2 of 2 consecutive agreements/);
  assert.equal(r.code, 0, `re-graduation refused:\n${r.stderr}`);
  assert.ok(r.stdout.includes(`graduated: '${ID}' now keeps lines starting with \`PASS: \``), r.stdout);

  const { catalog, dropped } = loadCatalogReport(root);
  assert.deepEqual(dropped, []);
  assert.deepEqual(catalog[ID].match, { type: 'prefix', value: PREFIX }, 'the entry still matches the command the tool is really run as');
  assert.deepEqual(catalog[ID].outcome, { type: 'prefix', value: 'PASS: ' }, 'and it learned the new answer line');
  assert.equal(matchTool(CMD, catalog), ID, 'RED CHECK: a re-graduated entry that matched nothing would be a dead entry');
  assert.deepEqual(survivalProblems(ID, catalog[ID], read(machinery(root, 'fixtures', `${ID}.json`))), []);
  const obs = read(machinery(root, 'observations.json'));
  assert.ok(!(KEY in obs), 'the record is not orphaned back under the bespoke key');
  assert.ok(!('open' in obs[ID].training), 'the re-open is answered, so the next run is not nudged again');
});

// #168: a run may hold several answer lines and the session identifies every one of them.
test('identify takes several answer lines, comma-separated, and records all of them as one pick', () => {
  const root = repo('train-tool-multi-');
  const log = writeCargoLog(OK(3), OK(4), OK(9));
  const r = train(root, 'identify', '--log', log, '--line', CARGO_LINES.join(','));
  assert.equal(r.code, 0, r.stderr);
  for (const s of [OK(3), OK(4), OK(9)]) assert.match(r.stdout, new RegExp(`identified: ${s.replace(/[.]/g, '\\.')}`), r.stdout);
  // Three identified texts in ONE run already have a common prefix to take, so the matcher forms on
  // the first pick — the point of the whole change.
  assert.match(r.stdout, /matcher: prefix `test result: ok\. `/, r.stdout);
  const training = read(machinery(root, 'observations.json'))[bespokeKey(CMD)].training;
  assert.equal(training.picks.length, 1);
  assert.deepEqual(training.picks[0].texts, [OK(3), OK(4), OK(9)]);
});

test('identify takes the same several lines as repeated --line flags', () => {
  const root = repo('train-tool-multiflag-');
  const log = writeCargoLog(OK(3), OK(4), OK(9));
  const r = train(root, 'identify', '--log', log, '--line', '6', '--line', '9', '--line', '12');
  assert.equal(r.code, 0, r.stderr);
  const training = read(machinery(root, 'observations.json'))[bespokeKey(CMD)].training;
  assert.deepEqual(training.picks[0].texts, [OK(3), OK(4), OK(9)]);
});

test('identify refuses more than AGREEMENT_MATCH_CAP answer lines, naming the cap, and refuses a non-record among several', () => {
  const root = repo('train-tool-cap-');
  const log = writeCargoLog(OK(3), OK(4), OK(9));
  const over = train(root, 'identify', '--log', log, '--line', '2,3,4,5,6,7');
  assert.notEqual(over.code, 0);
  assert.match(over.stderr, new RegExp(`at most ${AGREEMENT_MATCH_CAP} answer line`), over.stderr);
  assert.doesNotMatch(over.stderr, /\n\s+at /, 'a diagnostic, not a stack trace');
  // The record check still applies to each line of a list, exactly as it does to a lone --line.
  const past = train(root, 'identify', '--log', log, '--line', '6,9,99');
  assert.notEqual(past.code, 0);
  assert.match(past.stderr, /--line 99 is not a record of/, past.stderr);
  assert.ok(!fs.existsSync(machinery(root, 'observations.json')), 'RED CHECK: neither refusal records anything');
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

// Fix round 1: the one path in the CLI that deliberately half-writes. When graduate() refuses,
// identifyCmd still saves the session's pick (the streak the agreement earned is real and should
// not be re-earned) before dying — a write followed by a die, unlike every other refusal above,
// which is refused before any write is reachable. Reaching it needs graduate() itself to say no,
// AFTER identify() has already agreed to graduate.
//
// lib-graduate.test.mjs's own V11 ("a fixture that cannot prove the matcher refuses graduation")
// reaches graduate()'s refusal by calling it directly with an `index` that disagrees with the
// matcher `identify()` already built — something only a library-level caller can do. The CLI
// cannot: identifyCmd passes the SAME `lines` and the SAME `index` to both identify() and
// graduate() (train-tool.mjs:~65-73), and identify()'s own agreement rule (training.mjs, "on an
// agreement it [the matcher] equals the one that agreed, because a line the prefix matched cannot
// shorten it") makes that a mathematical guarantee, not a convention: agreement requires the
// picked line to already start with the PRE-pick matcher, so the POST-pick matcher — the only one
// graduate() ever sees — cannot become shorter, and so cannot newly match some other line in the
// same run that the shadow check (over those identical lines) did not already rule on. Checked
// empirically too: every attempt to smuggle in a stray matching line (in the graduating run itself,
// or via a PICK_WINDOW-truncation trick) broke the shadow agreement first, before graduate() was
// ever reached — never once produced a survival-provable-false, agreed-true combination.
// survivalProblems() is consequently unreachable through this CLI's own honest, index-consistent
// call sequence; a request to reach it that way cannot be honoured. What is genuinely reachable —
// and reaches the exact same untested branch — is graduate()'s OTHER refusal: a hand-written
// catalog entry sitting at the SANITIZED id learnedId(key) produces, which identifyCmd's own
// pre-check cannot see because that check looks up the catalog by the RAW key, not by the id
// graduate() computes and looks up internally. That gap is real and this test drives it.
test('graduation refused by a collision at the sanitized id: the pick still counts, but nothing crosses into the catalog or the fixture', () => {
  const root = repo('train-tool-collision-');
  // A hand-written entry filed directly under the id "bash scripts/battery.sh" would sanitize to
  // (learnedId), for an unrelated command — identifyCmd's pre-check looks up catalog[key] with the
  // RAW key "bash scripts/battery.sh" and finds nothing there, so it never sees this entry; only
  // graduate()'s own internal catalog[id] lookup does.
  const ID = LEARNED_ID;
  // The bespoke KEY is CMD generalized (bespokeKey) — the same key train-tool.mjs itself derives at
  // runtime from the log's own `$ command` header.
  const KEY = bespokeKey(CMD);
  fs.mkdirSync(machinery(root), { recursive: true });
  const handWritten = { [ID]: { match: { type: 'prefix', value: 'unrelated command' }, outcome: '^nope', candidates: [] } };
  fs.writeFileSync(machinery(root, 'tool-catalog.json'), JSON.stringify(handWritten, null, 2) + '\n');
  // One prior agreement already on record (as two real identify() calls would have left it), so
  // this run's identify() call is the graduating (2nd consecutive) one.
  const priorPicks = ['3', '4', '5'].map((s, i) => ({ text: `test result: ok. ${s} passed; 0 failed`, log: `seed${i}`, at: '2026-09-05T11:00:00.000Z' }));
  fs.writeFileSync(machinery(root, 'observations.json'), JSON.stringify({
    [KEY]: { ledger: {}, training: { picks: priorPicks, streak: 1, history: [] } },
  }, null, 2) + '\n');
  const log = writeLog('test result: ok. 60 passed; 0 failed');
  const r = train(root, 'identify', '--log', log, '--line', '4');
  assert.notEqual(r.code, 0);
  assert.match(r.stdout, /shadow: agreed — 2 of 2 consecutive agreements/, 'identify() itself agreed and would have graduated');
  // The header is neutral (M1): this refusal is a collision, and the fixture is not in question.
  assert.match(r.stderr, /graduation refused:\n/);
  assert.doesNotMatch(r.stderr, /the fixture does not prove/, 'the header does not name the fixture on a refusal that is not about it');
  assert.match(r.stderr, /hand-written catalog entry/);
  // Half 1: the pick still counted. The training record moved forward exactly as identify()
  // computed it — four picks now on file, the streak at 2 — under the ORIGINAL key: graduation
  // never reached the point of moving the record to the learned id.
  const obs = read(machinery(root, 'observations.json'));
  assert.ok(!(ID in obs), 'the record was never moved: graduation refused before that step');
  const training = obs[KEY].training;
  assert.equal(training.streak, 2);
  assert.deepEqual(training.picks.flatMap((p) => p.texts), [
    'test result: ok. 3 passed; 0 failed', 'test result: ok. 4 passed; 0 failed',
    'test result: ok. 5 passed; 0 failed', 'test result: ok. 60 passed; 0 failed',
  ]);
  // Half 2: nothing crossed into the catalog or the fixture. The hand-written entry is the same
  // VALUE it was seeded with — read() is JSON.parse plus deepEqual, so this is a value comparison
  // and says nothing about formatting — and no fixture file exists for the id that was refused.
  assert.deepEqual(read(machinery(root, 'tool-catalog.json')), handWritten);
  assert.ok(!fs.existsSync(machinery(root, 'fixtures', `${ID}.json`)), 'RED CHECK: a refused graduation writes no fixture');
});

test('logs lists stored run logs newest first with the key the runner would use, filtered by --key, with a proof line', () => {
  const root = repo('train-tool-logs-');
  const a = writeLog('x', 'python scripts/oracle_compare.py --base HEAD~1');
  // The key is the identity head (#164), so the flag is no longer part of it: every `--base` this
  // script was run with lists under the one key.
  const r = train(root, 'logs', '--key', 'python scripts/oracle_compare.py');
  assert.equal(r.code, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines[0], `${a}\tpython scripts/oracle_compare.py`);
  assert.match(lines.at(-1), /^train_tool_logs: 1 of \d+ run logs match 'python scripts\/oracle_compare\.py'/);
  const all = train(root, 'logs');
  // Under the identity head the key is no longer the command line itself (#164), so the expectation
  // is derived the way the runner derives it rather than spelled out again.
  assert.ok(all.stdout.split('\n').filter((l) => l.endsWith(`\t${bespokeKey(CMD)}`)).length >= 4, 'the loop test’s logs are listed under their bespoke key in a project with no learned entry');
});
