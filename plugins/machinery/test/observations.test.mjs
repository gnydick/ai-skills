import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bespokeKey, recordRun, loadObservations, saveObservations } from '../scripts/lib/observations.mjs';

test('bespokeKey strips flags and arguments, keeping the leading command shape', () => {
  assert.equal(bespokeKey('bash scripts/battery.sh --quick'), 'bash scripts/battery.sh');
  assert.equal(bespokeKey('python scripts/oracle_compare.py --base HEAD~1'), 'python scripts/oracle_compare.py');
  assert.equal(bespokeKey('scripts/testq.sh --workspace'), 'scripts/testq.sh');
  // A flag's own VALUE is not a leading token: everything from the first flag onward is argument,
  // whether or not it starts with a dash. Dropping only the dashed tokens leaves the value behind
  // and gives the same tool two keys — see the fragmentation red check below.
  assert.equal(bespokeKey('bash scripts/battery.sh --jobs 4'), 'bash scripts/battery.sh');
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
  // The keys come from bespokeKey, as the real caller derives them — handing recordRun two
  // identical literal keys would prove only that an object has one key when written twice.
  const quick = bespokeKey('bash scripts/battery.sh --quick');
  const jobs = bespokeKey('bash scripts/battery.sh --jobs 4');
  let obs = {};
  obs = recordRun(obs, quick, { identity: 'bespoke', lineCount: 10 });
  obs = recordRun(obs, jobs, { identity: 'bespoke', lineCount: 2000 });
  assert.deepEqual(Object.keys(obs), ['bash scripts/battery.sh']); // one key, last write wins on the shared fields
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

test('the bare path ignores outcomeSurvived entirely (the default is additive, not a behaviour change)', () => {
  // The ruling adds outcomeSurvived for trials only. Proving the bare path never reads it is what
  // makes "defaults to true, so the bespoke path is judged exactly as before" a mechanism rather
  // than a claim: even an explicit `false` leaves a bare entry byte-identical.
  const args = { identity: 'bespoke', lineCount: 2000, stdoutLines: 4, stderrLines: 1996 };
  const without = recordRun({}, 'bash scripts/battery.sh', { ...args });
  const withFalse = recordRun({}, 'bash scripts/battery.sh', { ...args, outcomeSurvived: false });
  const withTrue = recordRun({}, 'bash scripts/battery.sh', { ...args, outcomeSurvived: true });
  assert.deepEqual(withFalse, without);
  assert.deepEqual(withTrue, without);
  assert.equal(JSON.stringify(withFalse), JSON.stringify(without));
});

test('RED CHECK: a sufficient trial never overwrites the bare command noisy state', () => {
  let obs = {};
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 900, stdoutLines: 2, stderrLines: 898 }); // bare: noisy
  assert.equal(obs['git-commit'].noisy, true);
  obs = recordRun(obs, 'git-commit', { identity: 'catalog', lineCount: 3, stdoutLines: 3, stderrLines: 0, candidate: '--quiet' }); // trial: quiet WITH the flag
  assert.equal(obs['git-commit'].ledger['--quiet'], 'sufficient');
  // The bare tool is still noisy — only the trial's own line count was low, not the bare
  // invocation's. Getting this wrong is what would make the system stop suggesting the fix
  // the moment it is proven to work.
  assert.equal(obs['git-commit'].noisy, true, 'a trial run must never erase the bare noisy state');
  assert.equal(obs['git-commit'].lines, 900, 'bare line count must survive a trial call');
  // The trial carried its own stream counts too; none of them may reach the bare fields.
  assert.equal(obs['git-commit'].stdoutLines, 2, 'bare stdout count must survive a trial call');
  assert.equal(obs['git-commit'].stderrLines, 898, 'bare stderr count must survive a trial call');
});

// Final review I3: a trial run with no bare run before it used to write `noisy: false` — a stand-in
// for "never measured" (rules/design-invariants.md § Absence and defaults) that parked the tool in
// plain forever, since plain never re-observes. Absence is the signal: no bare measurement, no field.
test('RED CHECK: a trial before any bare run never fabricates a noisy verdict — the field is absent', () => {
  const obs = recordRun({}, 'pytest', { identity: 'catalog', lineCount: 3, stdoutLines: 3, stderrLines: 0, candidate: '-q', outcomeSurvived: true });
  assert.equal(obs.pytest.ledger['-q'], 'sufficient', 'the trial itself is still recorded');
  assert.ok(!('noisy' in obs.pytest), `noisy must be absent, got ${JSON.stringify(obs.pytest.noisy)}`);
  assert.ok(!('lines' in obs.pytest) && !('stdoutLines' in obs.pytest) && !('stderrLines' in obs.pytest), 'no bare counts either');
  // And once a bare run lands, the measurement is the bare run's, not the trial's.
  const after = recordRun(obs, 'pytest', { identity: 'catalog', lineCount: 900, stdoutLines: 900, stderrLines: 0 });
  assert.equal(after.pytest.noisy, true);
  assert.equal(after.pytest.ledger['-q'], 'sufficient', 'the earlier trial verdict survives the bare run');
});

test('stdout/stderr counts are recorded separately for a bare run (spec: which stream carries the answer)', () => {
  let obs = {};
  obs = recordRun(obs, 'bash scripts/battery.sh', { identity: 'bespoke', lineCount: 1402, stdoutLines: 2, stderrLines: 1400 });
  assert.equal(obs['bash scripts/battery.sh'].stdoutLines, 2);
  assert.equal(obs['bash scripts/battery.sh'].stderrLines, 1400);
});

test('the record round-trips through disk at .claude/machinery/observations.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'observations-'));
  try {
    const obs = recordRun({}, 'git-commit', { identity: 'catalog', lineCount: 900, candidate: '--quiet', outcomeSurvived: false });
    saveObservations(root, obs);
    assert.ok(fs.existsSync(path.join(root, '.claude', 'machinery', 'observations.json')));
    assert.deepEqual(loadObservations(root), obs);
  } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }); }
});

// Final review I6: the creator of the file owns its ignore entry. saveObservations() reports whether
// it wrote the .gitignore line, so the caller can say so once; a second save with the file already
// there touches .gitignore no more than install.mjs's own idempotent pass does (the same function).
test('saveObservations adds the .gitignore entry on first creation, reports it, and never a second time', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'observations-'));
  try {
    fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\r\ndist/'); // CRLF, no trailing newline: Task 9's own case
    assert.equal(saveObservations(root, { a: { noisy: false, ledger: {} } }), true);
    const once = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    assert.equal(once, 'node_modules/\r\ndist/\n.claude/machinery/observations.json\n');
    assert.equal(saveObservations(root, { a: { noisy: true, ledger: {} } }), false);
    assert.equal(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), once);
  } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }); }
});

test('a missing or unreadable record loads as empty, never as a crash (external input is data)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'observations-'));
  try {
    assert.deepEqual(loadObservations(root), {});
    const file = path.join(root, '.claude', 'machinery', 'observations.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ this is not json');
    assert.deepEqual(loadObservations(root), {});
  } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }); }
});
