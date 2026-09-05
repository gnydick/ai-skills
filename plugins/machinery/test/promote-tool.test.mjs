import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { survivalProblems } from '../scripts/lib/survival.mjs';

// Promotion writes into the plugin's OWN tracked files (data/tool-catalog.json,
// test/fixtures/tool-catalog/, .claude-plugin/plugin.json). Pointing it at this checkout would
// mean every suite run left a real diff behind, and — because `node --test` runs suite FILES in
// parallel — would race catalog.test.mjs, which reads data/tool-catalog.json. So every run here
// gets a scratch plugin root of its own via CLAUDE_PLUGIN_ROOT, and the real files are never
// touched. The last test in this file proves that.
function scratchPlugin(catalog = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-plugin-'));
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', 'tool-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'machinery', version: '0.4.7' }, null, 2) + '\n');
  return dir;
}

// A fixture that really does prove its outcome pattern survives: two recorded runs, each ending in
// the tool's answer line, and nothing in filter.mjs's generic heuristics keeps those lines, so the
// declaration is what saves them once they are outside the tail window.
const GOOD_LINES = [
  'reading config',
  'widget: alpha',
  'widget: beta',
  '<<< my-tool finished: 2 widgets',
  'reading config',
  'widget: gamma',
  '<<< my-tool finished: 1 widget',
];
const GOOD_FIXTURE = { source: 'my-tool 1.0, two runs recorded for this suite', answers: [3, 6], lines: GOOD_LINES };
const ENTRY = { match: { type: 'prefix', value: 'my-tool' }, outcome: '^<<< my-tool finished: \\d+ widgets?$', candidates: ['-q'] };

function project({ entry = ENTRY, fixture = GOOD_FIXTURE, id = 'my-tool', catalog = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-'));
  fs.mkdirSync(path.join(root, '.claude', 'machinery'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'machinery', 'tool-catalog.json'),
    catalog !== null ? catalog : JSON.stringify({ [id]: entry, 'other-tool': { match: { type: 'prefix', value: 'other' }, outcome: 'x', candidates: [] } }, null, 2));
  if (fixture !== null) {
    fs.mkdirSync(path.join(root, '.claude', 'machinery', 'fixtures'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'machinery', 'fixtures', `${id}.json`), JSON.stringify(fixture, null, 2));
  }
  return root;
}

const promote = (root, plugin, args = []) =>
  runScript('scripts/promote-tool.mjs', { args: ['--id', 'my-tool', '--root', root, ...args], env: { CLAUDE_PLUGIN_ROOT: plugin } });
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const universalOf = (plugin) => readJson(path.join(plugin, 'data', 'tool-catalog.json'));

test('promotion is refused when there is no fixture at all, and nothing is written', () => {
  const plugin = scratchPlugin({ keeper: { match: { type: 'prefix', value: 'k' }, outcome: 'k', candidates: [] } });
  const r = promote(project({ fixture: null }), plugin);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /fixture/);
  assert.deepEqual(Object.keys(universalOf(plugin)), ['keeper'], 'a refusal must land nothing');
});

// The defect this task exists to close. A fixture that merely EXISTS proves nothing: the design's
// standard is that the outcome pattern is shown to survive filtering. An existence check promotes
// this entry happily, and catalog.test.mjs then goes permanently red on it — the promotion gate
// would be manufacturing the failure the suite reports.
test('promotion is refused when the fixture exists but proves nothing (declares no answer lines)', () => {
  const plugin = scratchPlugin();
  const root = project({ fixture: { lines: ['noise', 'done'] }, entry: { ...ENTRY, outcome: '^done$' } });
  assert.ok(fs.existsSync(path.join(root, '.claude', 'machinery', 'fixtures', 'my-tool.json')), 'the fixture file IS present — the refusal must come from the proof, not its absence');
  const r = promote(root, plugin);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /does not prove/);
  assert.match(r.stderr, /declares no answer lines/);
  assert.deepEqual(universalOf(plugin), {}, 'a refusal must land nothing');
});

test('promotion is refused when a declared answer line is not one the outcome pattern matches', () => {
  const plugin = scratchPlugin();
  const r = promote(project({ fixture: { ...GOOD_FIXTURE, answers: [3, 5, 6] } }), plugin);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /does not match a line this tool really emits/);
  assert.deepEqual(universalOf(plugin), {});
});

test('promotion is refused when the outcome pattern is so wide it swallows the tool’s ordinary chatter', () => {
  const plugin = scratchPlugin();
  const r = promote(project({ entry: { ...ENTRY, outcome: '.' } }), plugin);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /also matches a non-answer line/);
  assert.deepEqual(universalOf(plugin), {});
});

test('promotion lands the entry beside what is already there, copies the fixture, empties the project catalog of it, and bumps the version', () => {
  const keeper = { match: { type: 'prefix', value: 'k' }, outcome: '^k$', candidates: [] };
  const plugin = scratchPlugin({ keeper });
  const root = project();
  const r = promote(root, plugin);
  assert.equal(r.code, 0, r.stderr);

  const after = universalOf(plugin);
  assert.deepEqual(after['my-tool'], ENTRY, 'the entry lands verbatim');
  assert.deepEqual(after.keeper, keeper, 'the entries already there are not clobbered');

  assert.deepEqual(readJson(path.join(plugin, 'test', 'fixtures', 'tool-catalog', 'my-tool.json')), GOOD_FIXTURE);

  const projectCatalog = readJson(path.join(root, '.claude', 'machinery', 'tool-catalog.json'));
  assert.ok(!('my-tool' in projectCatalog), 'the project copy would shadow the universal entry (loadCatalog lays project over universal)');
  assert.ok('other-tool' in projectCatalog, 'the project’s other entries are left alone');

  assert.equal(readJson(path.join(plugin, '.claude-plugin', 'plugin.json')).version, '0.4.8');
  assert.match(r.stdout, /no "verified" note/, 'a machine-derived entry entering the human-reviewed half is said out loud');
});

// Closes the loop: what promotion actually LANDED is judged by the same authority
// catalog.test.mjs applies to the universal catalog, so a green promotion cannot leave a red suite.
test('the entry promotion lands passes the universal catalog’s own Verification-7 check', () => {
  const plugin = scratchPlugin();
  assert.equal(promote(project(), plugin).code, 0);
  const landed = universalOf(plugin)['my-tool'];
  const landedFixture = readJson(path.join(plugin, 'test', 'fixtures', 'tool-catalog', 'my-tool.json'));
  assert.deepEqual(survivalProblems('my-tool', landed, landedFixture), []);
});

test('an id already in the universal catalog is not silently overwritten, and --force says it replaced one', () => {
  const mine = { match: { type: 'prefix', value: 'my-tool' }, outcome: 'REVIEWED BY HAND', candidates: [] };
  const plugin = scratchPlugin({ 'my-tool': mine });
  const refused = promote(project(), plugin);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /already in/);
  assert.deepEqual(universalOf(plugin)['my-tool'], mine, 'the reviewed entry survives the refusal');

  const forced = promote(project(), plugin, ['--force']);
  assert.equal(forced.code, 0, forced.stderr);
  assert.deepEqual(universalOf(plugin)['my-tool'], ENTRY);
  assert.match(forced.stdout, /--force: replaced/);
});

test('hand-editable input that is malformed gets a diagnostic, not a stack trace', () => {
  const plugin = scratchPlugin();
  const broken = promote(project({ catalog: '{"my-tool": ' }), plugin);
  assert.notEqual(broken.code, 0);
  assert.match(broken.stderr, /is not valid JSON/);
  assert.doesNotMatch(broken.stderr, /\n\s+at /, 'a stack trace means the input crashed us instead of being reported');

  const missing = promote(fs.mkdtempSync(path.join(os.tmpdir(), 'promote-empty-')), plugin);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /does not exist/);
  assert.doesNotMatch(missing.stderr, /\n\s+at /);

  const badFixture = promote(project({ fixture: 'not json at all' }), plugin);
  assert.notEqual(badFixture.code, 0);
  assert.match(badFixture.stderr, /the fixture for 'my-tool'/);
  assert.doesNotMatch(badFixture.stderr, /\n\s+at /);
});

test('an id that could address another directory is refused before any path is joined', () => {
  const plugin = scratchPlugin();
  for (const bad of ['../../evil', 'a/b', '.hidden']) {
    const r = runScript('scripts/promote-tool.mjs', { args: ['--id', bad, '--root', project()], env: { CLAUDE_PLUGIN_ROOT: plugin } });
    assert.notEqual(r.code, 0, bad);
    assert.match(r.stderr, /is not a usable catalog id/, bad);
  }
  const usage = runScript('scripts/promote-tool.mjs', { args: ['--root', 'x'], env: { CLAUDE_PLUGIN_ROOT: plugin } });
  assert.equal(usage.code, 2);
  assert.match(usage.stderr, /^usage: /);
});

// The reason every test above uses a scratch CLAUDE_PLUGIN_ROOT. Two prior runs of this suite have
// already happened by now; if any of them had written through to this checkout, these would be the
// files carrying it.
test('this suite never writes to the plugin’s own tracked catalog, fixtures or version', () => {
  assert.ok(!('my-tool' in JSON.parse(fs.readFileSync(path.join(PLUGIN, 'data', 'tool-catalog.json'), 'utf8'))));
  assert.ok(!fs.existsSync(path.join(PLUGIN, 'test', 'fixtures', 'tool-catalog', 'my-tool.json')));
});

test('RED CHECK: the survival gate is what refuses the empty fixture — the same run promotes the proving one', () => {
  // Same entry, same id, same present-on-disk fixture file: only the fixture's CONTENT differs.
  // If the gate were an existence check, both of these would promote, and the first assertion here
  // would fail. This is the check that would have caught the defect this task found.
  const proves = scratchPlugin(), provesNothing = scratchPlugin();
  const bad = promote(project({ fixture: { lines: GOOD_LINES } }), provesNothing); // same lines, no `answers`
  const good = promote(project(), proves);
  assert.notEqual(bad.code, 0, 'a fixture that declares nothing must not promote');
  assert.equal(good.code, 0, good.stderr);
  assert.deepEqual(universalOf(provesNothing), {});
  assert.ok('my-tool' in universalOf(proves));
});
