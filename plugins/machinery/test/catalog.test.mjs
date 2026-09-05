import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { loadCatalog, matchTool, matchedCandidate } from '../scripts/lib/catalog.mjs';
import { select } from '../scripts/lib/filter.mjs';
import { bury, survivalProblems } from '../scripts/lib/survival.mjs';

// loadCatalog reads the universal half through pluginRoot(); pin it at this checkout so the suite
// can never read an installed copy of the plugin instead (lib-config.test.mjs convention).
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;

const CATALOG_FILE = path.join(PLUGIN, 'data', 'tool-catalog.json');
const FIXTURES = path.join(PLUGIN, 'test', 'fixtures', 'tool-catalog');
const readCatalog = () => JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const readFixture = (id) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${id}.json`), 'utf8'));
const fixtureLines = (id) => readFixture(id).lines;

// Verification 7's per-entry contract lives in scripts/lib/survival.mjs, because promote-tool.mjs
// enforces the same contract at the gate where a project entry crosses into this catalog. One
// derivation, two callers — a second copy here would eventually disagree with the gate, and the
// disagreement would arrive as a red suite nobody could attribute. bury() comes from there too.
function assertOutcomeSurvives(id, entry, fixture) {
  const problems = survivalProblems(id, entry, fixture);
  assert.equal(problems.length, 0, problems.join('\n'));
}

test('matchTool recognises a real invocation by regex and by prefix, and declines unrelated commands', () => {
  const catalog = loadCatalog(PLUGIN);
  assert.equal(matchTool('git commit -m "x"', catalog), 'git-commit');
  assert.equal(matchTool('npm ci --no-audit', catalog), 'npm-install');
  assert.equal(matchTool('npm install foo', catalog), 'npm-install');
  assert.equal(matchTool('pytest tests/ -k foo', catalog), 'pytest');
  assert.equal(matchTool('ls -la', catalog), null);
  assert.equal(matchTool('git commitizen', catalog), null, 'the word boundary must not admit a longer subcommand');
  assert.equal(matchTool('echo git commit', catalog), null, 'the pattern is anchored: a mention is not an invocation');
  assert.equal(matchTool('npm run build', catalog), null);
});

test('matchedCandidate finds a flag already present in the command', () => {
  assert.equal(matchedCandidate('git commit --quiet -m x', ['--quiet']), '--quiet');
  assert.equal(matchedCandidate('git commit -m x', ['--quiet']), null);
  assert.equal(matchedCandidate('pytest -q tests/', ['-q']), '-q');
  assert.equal(matchedCandidate('pytest tests/', []), null, 'an empty candidate list is a clean null, not a crash');
});

test('project catalog entries override a universal id of the same name', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'machinery'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.claude', 'machinery', 'tool-catalog.json'),
    JSON.stringify({ 'git-commit': { match: { type: 'prefix', value: 'git commit' }, outcome: 'OVERRIDDEN', candidates: [] } }));
  const catalog = loadCatalog(tmp);
  assert.equal(catalog['git-commit'].outcome, 'OVERRIDDEN');
  assert.ok(catalog['pytest'], 'the universal entries the project did not name are still there');
});

test('a project with no catalog of its own loads the universal one unchanged', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  assert.deepEqual(loadCatalog(tmp), readCatalog());
});

test('every universal catalog entry has a fixture proving its outcome survives filtering (design Verification 7)', () => {
  const catalog = readCatalog();
  const ids = Object.keys(catalog);
  assert.ok(ids.length > 0, 'zero catalog entries — this check would prove nothing');
  for (const id of ids) {
    const fixturePath = path.join(FIXTURES, `${id}.json`);
    assert.ok(fs.existsSync(fixturePath), `${id}: no fixture at ${fixturePath} — an entry with no fixture is not an entry`);
    assertOutcomeSurvives(id, catalog[id], readFixture(id));
  }
});

// The one non-vacuous proof that a declaration changes the outcome: git commit's answer line is
// caught by nothing in filter.mjs's generic heuristics, so buried it is dropped without the
// declaration and kept with it. If select() ever stopped honouring outcomePattern, this fails.
test('the outcome declaration is load-bearing: git commit’s answer lines are dropped without it', () => {
  const outcome = new RegExp(readCatalog()['git-commit'].outcome);
  const { lines, answers } = readFixture('git-commit');
  const buried = bury(lines);
  const without = select(buried), with_ = select(buried, outcome);
  for (const i of answers) {
    assert.ok(!without.has(i), `the generic heuristics already keep line ${i} — this test would prove nothing about it`);
    assert.ok(with_.has(i), `line ${i} was not kept by the declaration`);
  }
});

// A pin, not coverage. Measured 2026-09-04, once the fixtures carried every recorded form:
//   git-commit  all three bracket lines — kept by NOTHING generic
//   npm-install "added 1 package, …"     — kept by SUMMARY's `\badded \d+ packages?\b`
//               "up to date, audited …"  — kept by NOTHING generic (SUMMARY wants "added")
//   pytest      both summary lines       — kept by SUMMARY's `^={3,}.*={3,}$` / `\b\d+ passed\b`
// So two of the three entries carry a form whose survival rests on the declaration alone, and
// pytest's is today a belt over an existing brace. Recording that means a change on either side
// has to be re-reviewed rather than silently moving where the guarantee comes from.
test('pin: which entries carry an answer line that depends on their declaration once outside the tail window', () => {
  const dependent = Object.keys(readCatalog()).filter((id) => {
    const { lines, answers } = readFixture(id);
    const without = select(bury(lines));
    return answers.some((i) => !without.has(i));
  });
  assert.deepEqual(dependent.sort(), ['git-commit', 'npm-install']);
});

test('RED CHECK: the survival check catches a pattern that misses a real form, an undeclared fixture, an over-wide pattern, and the tail rule passing it', () => {
  const real = readFixture('git-commit');

  // 1. The reason the fixtures carry more than one recorded run. This is the plan's ORIGINAL
  //    git pattern — `\S+` cannot cross the space in `[main (root-commit) …]` or
  //    `[detached HEAD …]`. Against the real fixture it must go red, so reverting the correction
  //    cannot pass. Before the fixture carried those runs, this same revert passed silently.
  assert.throws(() => assertOutcomeSurvives('x', { outcome: '^\\[\\S+ [0-9a-f]{7,}\\]' }, real),
    /does not match a line this tool really emits/);

  // 2. A fixture that declares no answers proves nothing and must say so.
  assert.throws(() => assertOutcomeSurvives('x', real, { lines: real.lines, answers: [] }),
    /declares no answer lines/);

  // 3. A pattern cannot be "fixed" by widening it until it swallows ordinary chatter.
  assert.throws(() => assertOutcomeSurvives('x', { outcome: '.' }, real),
    /also matches a non-answer line/);

  // 4. The precondition the load-bearing test rests on: buried, a real answer line is dropped by
  //    select() with no declaration. If it were kept anyway, that test would be theatre.
  const buried = bury(['[main a1b2c3d] a commit message', ' 1 file changed, 2 insertions(+)']);
  assert.ok(!select(buried).has(0), 'select() keeps this line without a declaration — the checks above prove nothing');
});
