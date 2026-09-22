import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { graduate, projectCatalogFile, projectFixtureFile } from '../scripts/lib/graduate.mjs';
import { loadCatalogReport, matchTool } from '../scripts/lib/catalog.mjs';
import { survivalProblems } from '../scripts/lib/survival.mjs';
import { emptyTraining, identify, learnedId } from '../scripts/lib/training.mjs';
import { bespokeKey, toolKey } from '../scripts/lib/observations.mjs';

// loadCatalogReport reads the universal half through pluginRoot(); pin it at this checkout.
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;

const AT = '2026-09-05T12:00:00.000Z';
const KEY = 'bash scripts/battery.sh';
const ID = 'bash-scripts-battery.sh';
const RUN = (summary) => ['   Compiling fs-core v0.1.0', 'running 128 tests', summary];
// The four identified runs a graduation takes with K = 2, replayed through identify() itself.
function trained() {
  let r = { training: emptyTraining() };
  for (const [s, l] of [['3', 'l1'], ['4', 'l2'], ['5', 'l3'], ['60', 'l4']]) r = identify(r.training, { lines: RUN(`test result: ok. ${s} passed; 0 failed`), indices: [2], log: l, at: AT });
  assert.equal(r.graduates, true, 'precondition: the loop graduates on these four');
  return { ...r, lines: RUN('test result: ok. 60 passed; 0 failed') };
}
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'graduate-'));
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
// The tool pair as the CLI derives it: matchTool() said nothing about `bash scripts/battery.sh`
// until it has graduated, so the default is the bespoke half. A case that needs the matched half
// passes its own `tool`.
const args = (r, extra = {}) => ({
  tool: toolKey(null, KEY), catalog: {}, training: r.training, matcher: r.matcher, lines: r.lines, indices: [2], log: 'l4', at: AT,
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

// #168, the case the whole ticket exists for: a run with one summary line per target, every one of
// them identified by the session. `cargo test -p fs-core` prints three, with per-test lines between
// them, so the fixture the gate writes carries three answers from this run and three more appended
// from the earlier pick — and the per-test lines it did NOT declare are what the survival check has
// left to fail on.
const OK = (n) => `test result: ok. ${n} passed; 0 failed`;
const CARGO = (lib, integration, doctest) => [
  '   Compiling fs-core v0.1.0', 'running 2 tests', 'test slice::keeps_order ... ok',
  'test slice::rejects_empty ... ok', lib, 'running 1 test', 'test api::roundtrip ... ok',
  integration, 'running 1 test', 'test src/lib.rs - slice (line 12) ... ok', doctest,
];
const CARGO_ANSWERS = [4, 7, 10];

test('graduation of a multi-answer run freezes every identified line of it, and the fixture it writes passes survival', () => {
  const dir = root();
  let r = { training: emptyTraining() };
  for (const [a, b, c, l] of [[3, 4, 9, 'l1'], [5, 6, 1, 'l2'], [60, 7, 2, 'l3']]) {
    r = identify(r.training, { lines: CARGO(OK(a), OK(b), OK(c)), indices: CARGO_ANSWERS, log: l, at: AT });
  }
  assert.equal(r.graduates, true, 'precondition: three identified lines in the first run already form the prefix, then K agreements');
  const lines = CARGO(OK(60), OK(7), OK(2));
  const g = graduate(dir, args(r, { lines, indices: CARGO_ANSWERS }));
  assert.equal(g.ok, true, g.problems && g.problems.join('\n'));
  const entry = read(projectCatalogFile(dir))[ID];
  assert.deepEqual(entry.outcome, { type: 'prefix', value: 'test result: ok. ' });
  const fixture = read(projectFixtureFile(dir, ID));
  assert.deepEqual(fixture.answers, [4, 7, 10, 11, 12, 13, 14, 15, 16]);
  assert.equal(fixture.lines.length, 17);
  assert.deepEqual(survivalProblems(ID, entry, fixture), [], 'what landed passes the same authority the suite applies');
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
  const g = graduate(dir, args(r, { indices: [1] }));
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
  // C1: how a re-graduation ACTUALLY arrives. Once the entry exists matchTool() answers with the
  // id, so the runner and train-tool.mjs both key on the id and hand THAT in. The entry's own match
  // has to survive it: rebuilt from the id it would read `bash-scripts-battery.sh`, which no
  // command starts with, and the entry would match nothing for ever. The pair is derived here the
  // way the CLI derives it — from matchTool() over the command itself — so what makes this a
  // re-graduation is the entry answering for the command, not the two strings being equal.
  const landed = { [ID]: read(projectCatalogFile(dir))[ID] };
  assert.equal(matchTool(KEY, landed), ID, 'precondition: the entry really does match the command now');
  const byId = graduate(dir, args(r, { tool: toolKey(matchTool(KEY, landed), KEY), catalog: landed, at: '2026-09-07T00:00:00.000Z' }));
  assert.equal(byId.ok, true, byId.problems && byId.problems.join('\n'));
  assert.equal(byId.id, ID);
  assert.deepEqual(read(projectCatalogFile(dir))[ID].match, { type: 'prefix', value: KEY }, 'the bespoke command shape is preserved, never replaced by the id');
});

// Final re-review: the C1 fix reads "an existing learned entry sits at this key" as "this is that
// tool again", and a bespoke key can land on that string BY COINCIDENCE. `./a.sh` graduates to the
// id `a.sh` (learnedId strips the leading `./`), and a later run of `a.sh` reached through the
// search path — a command that entry does NOT match, since it does not start with `./a.sh` — keys
// on bespokeKey('a.sh'), which is also `a.sh`. The strings collide; the tools do not. Read as a
// re-graduation, one
// invocation's learned answer is silently overwritten with the other's while `match.value` still
// says `./a.sh`. A re-graduation is real only when the entry's OWN match answered for this command.
// Every value below is derived from the two commands' own shapes, never from graduate()'s output.
test('RED CHECK — a bespoke key that merely COINCIDES with a learned id is a collision, not a re-graduation', () => {
  const dir = root(), r = trained();
  const FIRST = './a.sh', SECOND = 'a.sh';
  const ALIAS = learnedId(FIRST);
  assert.equal(ALIAS, bespokeKey(SECOND), 'precondition: two unrelated commands, one string');
  const other = { [ALIAS]: { match: { type: 'prefix', value: FIRST }, outcome: { type: 'prefix', value: 'ok: ' }, candidates: [], learned: { at: AT, picks: 4 } } };
  assert.equal(matchTool(SECOND, other), null, 'precondition: the entry does not match the second command');
  fs.mkdirSync(path.dirname(projectCatalogFile(dir)), { recursive: true });
  fs.writeFileSync(projectCatalogFile(dir), JSON.stringify(other, null, 2) + '\n');
  const before = fs.readFileSync(projectCatalogFile(dir), 'utf8');
  // The pair exactly as the callers derive it for SECOND: matchTool said nothing, so it is bespoke.
  const g = graduate(dir, args(r, { tool: toolKey(matchTool(SECOND, other), SECOND), catalog: other }));
  assert.equal(g.ok, false, 'the entry never matched this command, so the shared string is not identity');
  assert.match(g.problems[0], /already the learned entry for '\.\/a\.sh'/);
  assert.equal(fs.readFileSync(projectCatalogFile(dir), 'utf8'), before, 'the other tool’s entry is byte-unchanged');
  assert.ok(!fs.existsSync(projectFixtureFile(dir, ALIAS)), 'and no fixture was written');
});

// The mechanism behind the case above, exercised rather than asserted in prose: `matched` cannot be
// claimed by a caller, only obtained from toolKey(). A bare key string — the old calling shape — and
// a hand-built lookalike are both refused, so the coincidence case cannot come back by a caller
// deciding for itself that the strings being equal means the tool matched.
test('the graduation gate takes only the derived pair: a key string, and a hand-built lookalike, are both refused', () => {
  const dir = root(), r = trained();
  const { tool, ...rest } = args(r);
  assert.throws(() => graduate(dir, { ...rest, tool: KEY }), /not a key string/);
  assert.throws(() => graduate(dir, { ...rest, tool: { key: KEY, matched: true } }), /not a key string/);
  assert.ok(!fs.existsSync(projectCatalogFile(dir)), 'and nothing was written on the way to the throw');
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
