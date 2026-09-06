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
