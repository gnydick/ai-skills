import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bespokeKey, generalizedForm, toolKey, isToolKey, recordRun, loadObservations, saveObservations, withTraining, moveRecord } from '../scripts/lib/observations.mjs';

test('bespokeKey is the generalized form: the command and its flag NAMES as written, every value a typed placeholder', () => {
  assert.equal(bespokeKey('bash scripts/battery.sh --quick'), 'bash scripts/battery.sh --quick');
  assert.equal(bespokeKey('python scripts/oracle_compare.py --base HEAD~1'), 'python scripts/oracle_compare.py --base %s');
  assert.equal(bespokeKey('scripts/testq.sh --workspace'), 'scripts/testq.sh --workspace');
  // A flag's own VALUE carries no dash of its own, and it is still a value: `--jobs 4` and
  // `--jobs 8` are one record, not two — see the fragmentation red check below.
  assert.equal(bespokeKey('bash scripts/battery.sh --jobs 4'), 'bash scripts/battery.sh --jobs %d');
  assert.equal(bespokeKey(bespokeKey('bash scripts/battery.sh --jobs 4')), 'bash scripts/battery.sh --jobs %d', 'and the form is its own fixed point: re-deriving over a key changes nothing');
});

// Both halves off one matchTool() answer, so a key and its provenance cannot disagree. The values
// come from the two commands' own shapes: a matched command keys on the id the catalog gave, an
// unmatched one on its own leading tokens.
test('toolKey carries the key and whether the catalog matched, both from the one answer it was handed', () => {
  const CMD = 'bash scripts/battery.sh --quick';
  const matched = toolKey('bash-scripts-battery.sh', CMD);
  assert.equal(matched.key, 'bash-scripts-battery.sh'); assert.equal(matched.matched, true);
  const bespoke = toolKey(null, CMD);
  assert.equal(bespoke.key, bespokeKey(CMD)); assert.equal(bespoke.matched, false);
  // A caller with nothing to say says nothing: an absent answer is no match, never a match on a
  // key it made up itself.
  const absent = toolKey(undefined, 'a.sh --x');
  assert.equal(absent.key, 'a.sh --x'); assert.equal(absent.matched, false);
  // The mark is not a field a caller can write. Only what toolKey() made carries it.
  assert.ok(isToolKey(matched) && isToolKey(bespoke));
  assert.ok(!isToolKey({ key: 'a.sh', matched: true }), 'a hand-built lookalike is not the pair');
  assert.ok(!isToolKey('a.sh') && !isToolKey(null));
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

test('RED CHECK: two invocations differing only in a flag VALUE never fragment the record', () => {
  // The keys come from bespokeKey, as the real caller derives them — handing recordRun two
  // identical literal keys would prove only that an object has one key when written twice.
  // Two different flag NAMES are two records on purpose (#15: `--fast` and `--slow` sharing one
  // was the damaging collapse); what must never fragment is one flag carrying two values.
  const four = bespokeKey('bash scripts/battery.sh --jobs 4');
  const eight = bespokeKey('bash scripts/battery.sh --jobs 8');
  let obs = {};
  obs = recordRun(obs, four, { identity: 'bespoke', lineCount: 10 });
  obs = recordRun(obs, eight, { identity: 'bespoke', lineCount: 2000 });
  assert.deepEqual(Object.keys(obs), ['bash scripts/battery.sh --jobs %d']); // one key, last write wins on the shared fields
  assert.equal(obs['bash scripts/battery.sh --jobs %d'].noisy, true);
  // And the collapse half, which stays refused: a different flag name is a different record.
  assert.notEqual(bespokeKey('bash scripts/battery.sh --fast'), bespokeKey('bash scripts/battery.sh --slow'));
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

// ---- The generalized command form (#87) ----
// A tool whose variants are UNBOUNDED — `gh issue edit 59`, `60`, `61` — used to take a fresh key
// per invocation, so no history ever formed and the answer line, identical across all of them, was
// never learned. The form is the owner's, 2026-09-07: the command plus an alphabetized list of
// parameters whose VALUES are typed placeholders. Flag NAMES are structure and survive, which is
// what keeps `--fast` and `--slow` apart. Measured before the change: 60 entries in this repo, 59
// seen exactly once, nothing ever graduated.

test('#87.1 two invocations differing only in a numeric argument derive ONE form; a differing flag NAME derives two', () => {
  assert.equal(generalizedForm('gh issue edit 59'), 'gh issue edit %d');
  assert.equal(generalizedForm('gh issue edit 59'), generalizedForm('gh issue edit 60'));
  assert.notEqual(generalizedForm('bash run.sh --fast'), generalizedForm('bash run.sh --slow'));
  assert.equal(generalizedForm('bash run.sh --fast'), 'bash run.sh --fast');
});

test('#87.2 alphabetizing the parameters collapses the order the flags were written in', () => {
  const a = generalizedForm('gh issue edit 59 --add-label bug --body text');
  const b = generalizedForm('gh issue edit 59 --body text --add-label bug');
  assert.equal(a, b);
  assert.equal(a, 'gh issue edit %d --add-label %s --body %s');
  // The equal-sign form is the same parameter, so it alphabetizes into the same place.
  assert.equal(generalizedForm('tool --beta=2 --alpha=x'), 'tool --alpha=%s --beta=%d');
});

test('#87.3 a placeholder never merges two commands that differ by something other than a value', () => {
  // Same value shape on both sides, different flag NAME: two forms, not one.
  assert.notEqual(generalizedForm('curl --url localhost'), generalizedForm('curl --data localhost'));
  // Same value shape, different subcommand: two forms.
  assert.notEqual(generalizedForm('git checkout main'), generalizedForm('git branch main'));
  // And a value's TYPE is carried without its precision or width: 0.2 and 0.25 are one form
  // (`%f0.2` would fragment again on the next value, which is the defect being fixed).
  assert.equal(generalizedForm('tool --ratio 0.2'), generalizedForm('tool --ratio 0.25'));
  assert.equal(generalizedForm('tool --ratio 0.2'), 'tool --ratio %f');
});

test('#87.4 after every enumerated generic runner the first positional survives; in the same position after a non-runner it collapses', () => {
  for (const runner of ['bash', 'sh', 'python', 'node', 'npx']) {
    assert.equal(generalizedForm(`${runner} scripts/bump.mjs`), `${runner} scripts/bump.mjs`, runner);
    assert.notEqual(generalizedForm(`${runner} scripts/bump.mjs`), generalizedForm(`${runner} scripts/reindex.mjs`), `${runner}: two scripts are two tools`);
  }
  // `gh` carries its own identity, so its first positional is an argument like any other.
  assert.equal(generalizedForm('gh scripts/bump.mjs'), 'gh %p');
  assert.equal(generalizedForm('gh scripts/bump.mjs'), generalizedForm('gh scripts/reindex.mjs'));
});

test('#87.5 the same command from two different session scratchpads derives one form', () => {
  const at = (uuid) => `cd "C:/Users/GABEE~1.NYD/AppData/Local/Temp/claude/I--IdeaProjects-ai-skills/${uuid}/scratchpad" && gh issue edit 59`;
  const one = at('9ecd1656-81be-4fe2-bf97-4ae33982de6f'), two = at('5696552d-b37b-4476-a0b7-089391e2f6b6');
  assert.notEqual(one, two, 'precondition: two genuinely different command lines');
  assert.equal(generalizedForm(one), generalizedForm(two));
  assert.equal(generalizedForm(one), 'cd %p && gh issue edit %d');
});

test('#87.6 POSITIVE CONTROL: genuinely different commands stay apart, pairwise', () => {
  // Any rule that over-collapses — dropping flag names, placeholdering a runner's script, merging
  // subcommands — shows up here as two of these deriving one form.
  const commands = [
    'bash run.sh --fast', 'bash run.sh --slow',
    'node scripts/bump.mjs', 'node scripts/reindex.mjs',
    'gh issue edit 59', 'gh issue comment 59', 'gh issue create',
    'npm test', 'npm run build',
  ];
  const forms = commands.map((c) => generalizedForm(c));
  assert.equal(new Set(forms).size, commands.length, `collapsed: ${JSON.stringify(forms)}`);
});

test('#87 a malformed, empty or quoted-argument command is data, never a stack trace', () => {
  for (const bad of ['', '   ', '"', "cmd 'unterminated", '&& --x', '-', '--', 'cmd --msg "two words here"', 'cmd\t\n']) {
    assert.equal(typeof generalizedForm(bad), 'string', JSON.stringify(bad));
  }
  assert.equal(generalizedForm(''), '');
  assert.equal(generalizedForm('cmd --msg "two words here"'), 'cmd --msg %s');
});

test('#87 a run of same-typed values is one placeholder, so the form does not fragment on how many were passed', () => {
  assert.equal(generalizedForm('cp a/b.mjs c/d.mjs e/f.mjs'), 'cp %p');
  assert.equal(generalizedForm('cp a/b.mjs'), generalizedForm('cp a/b.mjs c/d.mjs'));
});

test('#87 the pair carries the matchable prefix a graduated entry needs — the leading run the command really starts with', () => {
  // The key now holds placeholders, so it is no longer a prefix of anything. The literal leading
  // run is derived at the same site and travels with the key, so graduation still writes a `match`
  // that matches the commands it was learned from.
  assert.equal(toolKey(null, 'bash scripts/battery.sh --quick').prefix, 'bash scripts/battery.sh');
  assert.equal(toolKey(null, 'gh issue edit 59').prefix, 'gh issue edit');
  assert.equal(toolKey(null, 'cd /tmp/x && gh issue edit 59').prefix, 'cd');
});
