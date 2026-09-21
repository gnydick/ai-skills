import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bespokeKey, generalizedForm, keyMatches, recordKeyFor, toolKey, isToolKey, recordRun, loadObservations, saveObservations, withTraining, moveRecord } from '../scripts/lib/observations.mjs';

// MOVED from "bespokeKey is the generalized form" (#87) to the new behaviour (#164): the flag names
// these cases asserted were in the key are now variation inside the tool. What each case still
// pins — that the runner's script is identity, that a flag's value never reaches the key, and that
// the derivation is its own fixed point — is asserted here on the head.
test('bespokeKey is the identity head: the command name plus its first positional token (#164)', () => {
  assert.equal(bespokeKey('bash scripts/battery.sh --quick'), 'bash scripts/battery.sh');
  assert.equal(bespokeKey('python scripts/oracle_compare.py --base HEAD~1'), 'python scripts/oracle_compare.py');
  assert.equal(bespokeKey('scripts/testq.sh --workspace'), 'scripts/testq.sh');
  // `--jobs 4` and `--jobs 8` were one record under #87 because the value was typed; they are one
  // record now because the whole flag is outside identity.
  assert.equal(bespokeKey('bash scripts/battery.sh --jobs 4'), 'bash scripts/battery.sh');
  assert.equal(bespokeKey(bespokeKey('bash scripts/battery.sh --jobs 4')), 'bash scripts/battery.sh', 'and the head is its own fixed point: re-deriving over a key changes nothing');
  // The SHAPE of the run still carries everything the key dropped (required behaviour 4).
  assert.equal(generalizedForm('bash scripts/battery.sh --jobs 4'), 'bash scripts/battery.sh --jobs %d');
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
  assert.equal(absent.key, 'a.sh'); assert.equal(absent.matched, false);
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

// MOVED to the new behaviour (#164). The first half stands as it was. The second half — "a
// different flag NAME is a different record", the #15 reading that made `--fast` and `--slow` two
// keys — is REVERSED by the owner's ruling ("Loose: flags are variation"), so what it asserted is
// re-asserted where the distinction now lives: the run's SHAPE, which still tells the two apart.
test('RED CHECK: two invocations differing only in a flag never fragment the record', () => {
  // The keys come from bespokeKey, as the real caller derives them — handing recordRun two
  // identical literal keys would prove only that an object has one key when written twice.
  const four = bespokeKey('bash scripts/battery.sh --jobs 4');
  const eight = bespokeKey('bash scripts/battery.sh --jobs 8');
  let obs = {};
  obs = recordRun(obs, four, { identity: 'bespoke', lineCount: 10 });
  obs = recordRun(obs, eight, { identity: 'bespoke', lineCount: 2000 });
  assert.deepEqual(Object.keys(obs), ['bash scripts/battery.sh']); // one key, last write wins on the shared fields
  assert.equal(obs['bash scripts/battery.sh'].noisy, true);
  // `--fast` and `--slow` are ONE tool run two ways now, which is the whole point of the ruling.
  assert.equal(bespokeKey('bash scripts/battery.sh --fast'), bespokeKey('bash scripts/battery.sh --slow'));
  // POSITIVE CONTROL for the half that was reversed: the distinction is not lost, it moved. The
  // shape still separates them, so a run's history can say which way the tool was run.
  assert.notEqual(generalizedForm('bash scripts/battery.sh --fast'), generalizedForm('bash scripts/battery.sh --slow'));
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
// for "never measured" (a legal value smuggling a different concept) that parked the tool in
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
  // MOVED to the new behaviour (#164): the prefix closes after the FIRST positional, not after two
  // subcommands, because it now IS the identity head — one string for one fact (behaviour 7).
  assert.equal(toolKey(null, 'gh issue edit 59').prefix, 'gh issue');
  // And a compound takes it from the first work-doing segment, never from the byte-mover: this used
  // to be `cd`, a learned entry that would have claimed every `cd` command there is.
  assert.equal(toolKey(null, 'cd /tmp/x && gh issue edit 59').prefix, 'gh issue');
});

// ---- The redirect target is an operand, not a head (#162) ----
// `>` and `>>` are operators, so until #162 the token after one HEADED a new segment, and a head is
// kept as written. The output filename was therefore the one operand the derivation never
// generalized: the same tool took a fresh key for every file it wrote to. Measured in ferrislicer's
// record on 2026-09-21: 28 `cargo test … > target` keys, 16 distinct once the target collapses.
// The operator itself stays — a redirected run and a bare run are genuinely two shapes — and so
// does the ORDER of the redirects, which is what puts different streams on the runner's pipes
// (#160). A pipe is untouched: after `|` the next token really is a command name.

test('#162.1 the token after a redirect is generalized like any other operand, so two output files are one record', () => {
  assert.equal(generalizedForm('cargo test -p x > out.txt'), generalizedForm('cargo test -p y > other.txt'));
  assert.equal(generalizedForm('cargo test -p x > out.txt'), 'cargo test -p %s > %p');
  assert.ok(!generalizedForm('cargo test -p x > out.txt').includes('out.txt'), 'the filename is gone from the key');
  // A word-shaped target earns the placeholder its own shape earns, by the same rules.
  assert.equal(generalizedForm('cargo test > outfile'), 'cargo test > %s');
  // The prefix closes at the operator exactly as it did: it is still a literal head of the command.
  assert.equal(toolKey(null, 'cargo test -p x > out.txt').prefix, 'cargo test');
});

test('#162.2 the redirect operator stays in the key, so a redirected run and a bare run are two records', () => {
  assert.notEqual(generalizedForm('cargo test -p x > out.txt'), generalizedForm('cargo test -p x'));
  assert.equal(generalizedForm('cargo test -p x'), 'cargo test -p %s');
});

test('#162.3 the ORDER of the redirects survives, because it decides which stream reaches the pipe (#160)', () => {
  assert.notEqual(generalizedForm('cargo test > a.txt 2>&1'), generalizedForm('cargo test 2>&1 > a.txt'));
  // Pinned: `2>&1` is not the redirect's operand — the operand is taken at the operator — so it
  // stands on its own, before or after, and that is where the two shapes differ.
  assert.equal(generalizedForm('cargo test > a.txt 2>&1'), 'cargo test > %p 2>&1');
  assert.equal(generalizedForm('cargo test 2>&1 > a.txt'), 'cargo test %s > %p');
});

test('#162.4 a pipeline stage is untouched: after `|` the next token is a command name and stays verbatim', () => {
  assert.equal(generalizedForm('cat x | grep y'), 'cat x | grep y');
  // `-20` reads as a flag NAME, not a value, so the whole stage is structure and survives as typed.
  assert.equal(generalizedForm('cargo test | tail -20'), 'cargo test | tail -20');
  // And a redirect inside a pipeline generalizes its own target without disturbing the stage after.
  assert.equal(generalizedForm('cargo test > a.txt | grep fail'), 'cargo test > %p | grep fail');
});

test('#162.5 every redirect operator the derivation already knows takes its operand the same way', () => {
  assert.equal(generalizedForm('cargo test >> run.log'), 'cargo test >> %p');
  assert.equal(generalizedForm('cargo test >> run.log'), generalizedForm('cargo test >> other.log'));
  assert.equal(generalizedForm('sort < in.txt'), 'sort < %p');
  assert.equal(generalizedForm('sort < in.txt'), generalizedForm('sort < other.txt'));
  assert.equal(generalizedForm('cat << EOF'), 'cat << %s');
  // An operator with nothing after it is data, not a crash.
  assert.equal(typeof generalizedForm('cargo test >'), 'string');
  assert.equal(generalizedForm('cargo test >'), 'cargo test >');
});

// The fixture is built the way the measurement was shaped: 16 structurally different commands — they
// differ by flag NAME, subcommand or script, never only by a value — and 12 of those run a second
// time writing to a different file. 16 + 12 = 28 command lines carrying 16 shapes. Both counts come
// from that construction; neither is copied out of a run.
const REDIRECT_FIXTURE = (out) => [
  `cargo test > ${out} 2>&1`,
  `cargo test --no-fail-fast > ${out} 2>&1`,
  `cargo test --no-fail-fast -p slicer > ${out} 2>&1`,
  `cargo test --locked --test integration -p slicer > ${out}`,
  `cargo build > ${out} 2>&1`,
  `cargo build --release > ${out}`,
  `cargo clippy --all-targets > ${out} 2>&1`,
  `cargo fmt --check > ${out}`,
  `npm test > ${out} 2>&1`,
  `npm run build > ${out}`,
  `node scripts/bump.mjs > ${out}`,
  `node scripts/reindex.mjs > ${out}`,
  `git status > ${out}`,
  `git log --oneline > ${out}`,
  `pytest tests/ > ${out} 2>&1`,
  `rustc --version > ${out}`,
];

// MOVED to the new behaviour (#164): what #162 fixed is that the output FILENAME no longer makes a
// shape of its own, and that is asserted here on generalizedForm, which is the shape. The record
// count is now the number of identity heads, not the number of shapes.
test('#162.6 the 28-into-16 collapse: the 12 shapes that existed only because of the filename are gone', () => {
  const shapes = REDIRECT_FIXTURE('.claude/scratch/baseline-integration-full.txt');
  const again = REDIRECT_FIXTURE('.claude/scratch/after-integration-full.txt').slice(0, 12);
  const commands = [...shapes, ...again];
  assert.equal(commands.length, 28);
  assert.equal(new Set(commands).size, 28, 'precondition: 28 genuinely different command lines');
  // POSITIVE CONTROL: the 16 shapes are 16 shapes. Over-collapsing shows up here, not as a pass.
  assert.equal(new Set(shapes.map(generalizedForm)).size, 16, `the shapes collapsed: ${JSON.stringify(shapes.map(generalizedForm))}`);
  assert.equal(new Set(commands.map(generalizedForm)).size, 16, `28 command lines, 16 shapes: ${JSON.stringify([...new Set(commands.map(generalizedForm))])}`);
  // And the records those 16 shapes write: 12, by construction — the four `cargo test` forms are
  // one tool and the two `cargo build` forms are one, so 16 - 3 - 1 = 12.
  assert.equal(new Set(commands.map(bespokeKey)).size, 12, JSON.stringify([...new Set(commands.map(bespokeKey))]));
});

// ---- The identity head: command plus first positional (#164) ----
// Gabe, 2026-09-21: "i meant it to be the glob, but with type correctness"; which glob — "Loose:
// flags are variation"; the head for a command with no subcommand — "Command + first positional".
// One rule covers both: the identity head is the command name plus its first positional token.
// Measured before the change, in ferrislicer's record: 27 `cargo test` runs became 27 keys, 60 of
// 67 cargo keys ran exactly once, and GRADUATION_AGREEMENTS = 2 was therefore unreachable.

test('#164.1 the three flag-distinct `cargo test` forms are ONE key, headed `cargo test`', () => {
  const forms = ['cargo test -p a', 'cargo test --locked -p b', 'cargo test --no-fail-fast -p c > out.txt 2>&1'];
  assert.equal(new Set(forms.map(bespokeKey)).size, 1, JSON.stringify(forms.map(bespokeKey)));
  assert.equal(bespokeKey(forms[0]), 'cargo test');
});

test('#164.2 a generic runner heads at the script it runs, so two subcommands of one script share a key and two scripts do not', () => {
  assert.equal(bespokeKey('node scripts/x.mjs check'), bespokeKey('node scripts/x.mjs build'));
  assert.equal(bespokeKey('node scripts/x.mjs check'), 'node scripts/x.mjs');
  assert.notEqual(bespokeKey('node scripts/x.mjs check'), bespokeKey('node scripts/y.mjs check'));
});

test('#164.3 a command with a subcommand heads at command plus subcommand, so its verbs share a key', () => {
  assert.equal(bespokeKey('gh issue create --title t'), bespokeKey('gh issue close 59'));
  assert.equal(bespokeKey('gh issue create --title t'), 'gh issue');
  assert.notEqual(bespokeKey('gh issue create'), bespokeKey('gh pr create'));
  // A flag CLOSES the head — the one departure from required behaviour 1's letter, forced by the
  // prefix invariant (behaviour 7) and measured on `python -m pytest tests/ -q`: under the literal
  // rule `-m` eats `pytest`, the first non-flag token is `tests/`, and the head `python tests/` is
  // a string the command does not start with. Closing at the flag collapses instead, which is the
  // visible direction. Reported on #164 for the owner.
  assert.equal(bespokeKey('gh --repo o/r issue create'), 'gh');
  assert.equal(bespokeKey('python -m pytest tests/ -q'), 'python');
  assert.ok('python -m pytest tests/ -q'.startsWith(bespokeKey('python -m pytest tests/ -q')));
});

test('#164.4 a compound heads at its first work-doing segment: the byte-mover never contributes (ruling C1, #87)', () => {
  assert.equal(bespokeKey('cd /x && cargo test -p a'), 'cargo test');
  assert.equal(bespokeKey('cd /x && cargo test -p a'), bespokeKey('cargo test -p a'));
  // A pipeline's producer heads it; the filter stage does not.
  assert.equal(bespokeKey('cargo test 2>&1 | tail -20'), 'cargo test');
  // Byte-movers all the way down write no record at all, so the head is moot — but it is still a
  // string, never the empty key.
  assert.equal(bespokeKey('cat x | grep y'), 'cat x');
});

test('#164.5 the head is the literal first positional: two spellings of a script path stay two heads', () => {
  // The judgement the ticket leaves to the implementer, taken inside the existing %p rules: the
  // first positional is never typed, because the head IS the prefix a learned entry matches on by
  // startsWith, and a normalised path is a string no command starts with.
  assert.notEqual(bespokeKey('bash run.sh'), bespokeKey('bash ../run.sh'));
  assert.equal(bespokeKey('bash ../run.sh'), 'bash ../run.sh');
  assert.equal(toolKey(null, 'bash ../run.sh').prefix, 'bash ../run.sh', 'and it is still a literal leading run of the command');
});

test('#164.6 the typed glob: a record key with a %d slot claims a number in that position and refuses a word', () => {
  // A key written before #164 is a full generalized form and holds typed slots. It keeps claiming
  // the commands that FIT them, which is how an old record is still read while it ages out.
  assert.equal(keyMatches('gh issue edit %d', 'gh issue edit 59'), true, 'positive control: a number fits the %d slot');
  assert.equal(keyMatches('gh issue edit %d', 'gh issue edit main'), false, 'a word does not fit a %d slot');
  assert.equal(keyMatches('gh issue edit %p', 'gh issue edit 59'), false, 'nor does a number fit a %p slot');
  // And the head claims anything with that head, which is the open tail slot.
  assert.equal(keyMatches('cargo test', 'cargo test --locked -p b > out.txt 2>&1'), true);
  assert.equal(keyMatches('cargo test', 'cargo build --release'), false);
});

test('#164.7 recordKeyFor prefers the head this version writes, and falls back to the old key that still claims the command', () => {
  assert.equal(recordKeyFor({}, 'gh issue edit 59'), 'gh issue', 'nothing recorded: the head a new record goes under');
  assert.equal(recordKeyFor({ 'gh issue edit %d': {} }, 'gh issue edit 59'), 'gh issue edit %d', 'the old record is still reached');
  assert.equal(recordKeyFor({ 'gh issue edit %d': {}, 'gh issue': {} }, 'gh issue edit 59'), 'gh issue', 'once the head record exists the old one is never read again: it ages out');
});

// The fixture list the prefix invariant and the first-positional risk are both measured over: 30
// realistic non-byte-mover commands spanning runners, build tools, gh/git and ad-hoc compounds.
const FIXTURE = [
  'cargo test -p a', 'cargo test --locked -p b', 'cargo test --no-fail-fast -p c > out.txt 2>&1',
  'cargo build --release', 'cargo clippy --all-targets -- -D warnings', 'cargo fmt --check',
  'cargo run --bin slicer -- --input a.stl', 'cargo bench --bench slice',
  'npm test', 'npm run build', 'npm install --no-audit', 'npx tsc --noEmit',
  'node scripts/test-tier.mjs merge', 'node scripts/build-skills.mjs check', 'node --test plugins/machinery/test/all.test.mjs',
  'bash scripts/battery.sh --quick', 'sh .githooks/pre-commit', 'pwsh -File scripts/release.ps1',
  'python -m pytest tests/ -q', 'pytest tests/unit --maxfail 1', 'ruff check .',
  'gh issue create --title t', 'gh issue view 164', 'gh pr create --fill', 'gh run watch 12345',
  'git commit -m x', 'git push origin main', 'git worktree add ../wt br',
  'make -j 8 release', 'docker build -t img .',
];

test('#164.8 PREFIX INVARIANT: for every fixture command the prefix a learned entry matches on IS the identity head', () => {
  for (const c of FIXTURE) assert.equal(toolKey(null, c).prefix, bespokeKey(c), c);
  // And the head really is a leading run of the command line, not merely equal to itself.
  for (const c of FIXTURE) assert.ok(c.startsWith(bespokeKey(c)), `${c} does not start with its head ${bespokeKey(c)}`);
});

// The ferrislicer measurement, reproduced as a fixture: 27 `cargo test` command lines, differing by
// flag set, target and redirect — never only by a value, which #87 already collapsed. Before #164
// they were 27 keys and `cargo test` could never graduate (GRADUATION_AGREEMENTS = 2 on one key).
const CARGO_TEST_27 = [
  'cargo test', 'cargo test --locked', 'cargo test --no-fail-fast', 'cargo test --release',
  'cargo test --workspace', 'cargo test --all-features', 'cargo test --no-default-features',
  'cargo test -p slicer', 'cargo test -p orca', 'cargo test -p slicer --lib', 'cargo test -p slicer --bins',
  'cargo test --test integration', 'cargo test --test walls', 'cargo test --doc',
  'cargo test --locked -p slicer --test integration', 'cargo test --no-fail-fast -p orca',
  'cargo test -- --nocapture', 'cargo test -- --test-threads 1', 'cargo test slicer::walls',
  'cargo test > out.txt', 'cargo test > out.txt 2>&1', 'cargo test 2>&1 > out.txt',
  'cargo test --locked > baseline.txt 2>&1', 'cargo test --no-fail-fast >> run.log',
  'cargo test 2>&1 | tail -20', 'cd /repo && cargo test --locked', 'cargo test --quiet -p slicer',
];

test('#164.9 the ferrislicer collapse: 27 `cargo test` command lines, one record', () => {
  assert.equal(CARGO_TEST_27.length, 27);
  assert.equal(new Set(CARGO_TEST_27).size, 27, 'precondition: 27 genuinely different command lines');
  // POSITIVE CONTROL: the shape derivation still tells them apart. 25, not 27, and the two pairs
  // that coincide are the ones #87 already collapsed — `-p slicer`/`-p orca` and `--test
  // integration`/`--test walls` differ only by a flag's VALUE. Measured, then reasoned back to the
  // construction; the number is the fixture's, not a run's.
  assert.equal(new Set(CARGO_TEST_27.map(generalizedForm)).size, 25, 'the shapes stay apart: only identity collapsed');
  assert.equal(new Set(CARGO_TEST_27.map(bespokeKey)).size, 1, JSON.stringify([...new Set(CARGO_TEST_27.map(bespokeKey))]));
  assert.equal(bespokeKey(CARGO_TEST_27[0]), 'cargo test');
  // And the collapse is not universal: a different subcommand is a different tool.
  assert.notEqual(bespokeKey('cargo test'), bespokeKey('cargo build'));
});
