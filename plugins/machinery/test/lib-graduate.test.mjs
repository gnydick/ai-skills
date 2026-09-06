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
