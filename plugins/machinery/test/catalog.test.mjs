import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { loadCatalog, matchTool, matchedCandidate } from '../scripts/lib/catalog.mjs';
import { select, TAIL_LINES } from '../scripts/lib/filter.mjs';

// loadCatalog reads the universal half through pluginRoot(); pin it at this checkout so the suite
// can never read an installed copy of the plugin instead (lib-config.test.mjs convention).
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;

const CATALOG_FILE = path.join(PLUGIN, 'data', 'tool-catalog.json');
const FIXTURES = path.join(PLUGIN, 'test', 'fixtures', 'tool-catalog');
const readCatalog = () => JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const fixtureLines = (id) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${id}.json`), 'utf8')).lines;

// select() keeps the last TAIL_LINES lines unconditionally, so a short fixture's outcome line
// survives whatever its declaration says — the check would pass with no declaration at all.
// bury() appends CHATTER (which the tail rule itself discards) to push the outcome line out of
// that window, so a keep is attributable to a rule that actually looked at the line.
const bury = (lines) => [...lines, ...Array.from({ length: TAIL_LINES + 4 }, (_, i) => `   Compiling crate${i} v0.1.0`)];

// The per-entry contract from the design's Verification 7. What carries the weight here is the
// FIRST assertion: real recorded output must contain a line the declared pattern matches, which is
// what catches a pattern written from memory instead of from the tool. The survival assertions pin
// select()'s contract — that an outcome match is kept unconditionally, and not merely because it
// landed in the tail window. That an outcome match survives is true by construction while select()
// keeps what it matches; it is a regression guard on that contract, not proof the declaration is
// what saved the line. The test below that one proves the declaration is load-bearing.
function assertOutcomeSurvives(id, entry, lines) {
  const outcome = new RegExp(entry.outcome);
  const i = lines.findIndex((l) => outcome.test(l));
  assert.ok(i >= 0, `${id}: fixture does not contain a line matching its own outcome pattern`);
  assert.ok(select(lines, outcome).has(i), `${id}: outcome line did not survive select()`);
  const buried = bury(lines);
  assert.ok(buried.length - i > TAIL_LINES, `${id}: outcome line is still inside the unconditional tail window`);
  const kept = select(buried, outcome);
  assert.ok(kept.has(i), `${id}: outcome line did not survive select() once outside the tail window`);
  assert.ok(kept.size < buried.length, `${id}: select() kept every line — "it survived" would prove nothing here`);
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
    assertOutcomeSurvives(id, catalog[id], fixtureLines(id));
  }
});

// The one non-vacuous proof that a declaration changes the outcome: git commit's answer line is
// caught by nothing in filter.mjs's generic heuristics, so buried it is dropped without the
// declaration and kept with it. If select() ever stopped honouring outcomePattern, this fails.
test('the outcome declaration is load-bearing: git commit’s answer line is dropped without it', () => {
  const catalog = readCatalog();
  const buried = bury(fixtureLines('git-commit'));
  const outcome = new RegExp(catalog['git-commit'].outcome);
  const i = buried.findIndex((l) => outcome.test(l));
  assert.ok(!select(buried).has(i), 'the generic heuristics already keep this line — this test would prove nothing');
  assert.ok(select(buried, outcome).has(i));
});

// A pin, not coverage. npm's and pytest's answer lines are already caught by filter.mjs's SUMMARY
// regex, so their declarations are today a belt over an existing brace; git commit's is the only
// one carrying the guarantee alone. Recording that means a change on either side has to be
// re-reviewed rather than silently moving where the guarantee comes from.
test('pin: only git-commit’s outcome line depends on its declaration once outside the tail window', () => {
  const catalog = readCatalog();
  const dependent = Object.keys(catalog).filter((id) => {
    const buried = bury(fixtureLines(id));
    const i = buried.findIndex((l) => new RegExp(catalog[id].outcome).test(l));
    return !select(buried).has(i);
  });
  assert.deepEqual(dependent.sort(), ['git-commit']);
});

test('RED CHECK: the survival check rejects a fixture without the outcome line, and the tail rule is not what passes it', () => {
  const gitEntry = readCatalog()['git-commit'];
  assert.throws(() => assertOutcomeSurvives('x', gitEntry, ['   Compiling a', '   Compiling b']),
    /does not contain a line matching its own outcome pattern/);
  // And the precondition the load-bearing test rests on: buried, this real answer line is dropped
  // by select() with no declaration. If it were kept anyway, both tests above would be theatre.
  const buried = bury(['[main a1b2c3d] a commit message', ' 1 file changed, 2 insertions(+)']);
  assert.ok(!select(buried).has(0), 'select() keeps this line without a declaration — the checks above prove nothing');
});
