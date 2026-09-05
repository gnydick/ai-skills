import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../scripts/lib/assimilate.mjs';

const catalog = { 'git-commit': { match: { type: 'regex', value: '^git\\s+commit\\b' }, outcome: 'x', candidates: ['--quiet'] } };

test('no observations at all -> observe, unwrapped', () => {
  const d = decide('git commit -m x', { catalog, observations: {} });
  assert.equal(d.mode, 'observe');
  assert.equal(d.identity, 'catalog');
});

test('last observation quiet -> nothing', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: false, ledger: {} } };
  assert.equal(decide('git commit -m x', { catalog, observations }).mode, 'plain');
});

test('noisy, bespoke -> wrap, no suggestion possible', () => {
  const observations = { 'bash scripts/battery.sh': { identity: 'bespoke', noisy: true, ledger: {} } };
  const d = decide('bash scripts/battery.sh', { catalog: {}, observations });
  assert.equal(d.mode, 'noisy');
  assert.equal(d.suggestFlags, undefined);
});

test('noisy, catalog, untried candidate left -> suggest that candidate', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: {} } };
  const d = decide('git commit -m x', { catalog, observations });
  assert.equal(d.mode, 'suggest');
  assert.equal(d.suggestFlags, '--quiet');
});

test('noisy, catalog, candidates exhausted with none sufficient -> wrap', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: { '--quiet': 'insufficient' } } };
  assert.equal(decide('git commit -m x', { catalog, observations }).mode, 'noisy');
});

test('a candidate already known sufficient is always the one suggested, even with others untried', () => {
  const twoFlags = { 'git-commit': { ...catalog['git-commit'], candidates: ['--quiet', '--no-verify'] } };
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: { '--quiet': 'sufficient' } } };
  const d = decide('git commit -m x', { catalog: twoFlags, observations });
  assert.equal(d.mode, 'suggest');
  assert.equal(d.suggestFlags, '--quiet');
});

test('a command that already carries an untried candidate is a trial run: observe, not suggest', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: {} } };
  const d = decide('git commit --quiet -m x', { catalog, observations });
  assert.equal(d.mode, 'observe'); // measuring the trial; suggesting again would be noise
});

// A catalog entry with NO candidate list is the state the design's own training loop produces: a
// bespoke tool "earns an outcome pattern through the training loop"
// (docs/superpowers/specs/2026-09-04-tool-assimilation-design.md, "Declared outcome patterns" and
// "How an outcome pattern is learned") and lands in the project's tool-catalog.json carrying an
// `outcome` and nothing to suggest, because a bespoke tool has no documented quiet flags to
// declare. matchTool() then matches it, so decide() reaches entry.candidates. The design's rule for
// a tool with nothing to look up is "straight to wrap on the first noisy observation", which an
// empty candidate list falls through to on its own — so this is a behaviour test, not a defensive
// one.
test('a catalog entry with no candidates behaves like a bespoke tool: observe, then straight to wrap', () => {
  const learned = { battery: { match: { type: 'prefix', value: 'bash scripts/battery.sh' }, outcome: '^BATTERY' } };
  assert.equal(decide('bash scripts/battery.sh', { catalog: learned, observations: {} }).mode, 'observe');
  const observations = { battery: { identity: 'catalog', noisy: true, ledger: {} } };
  const d = decide('bash scripts/battery.sh', { catalog: learned, observations });
  assert.equal(d.mode, 'noisy');
  assert.equal(d.suggestFlags, undefined);
});

// observations.mjs states this contract in its own header: "A missing, truncated or hand-edited
// record is data, not a broken invariant." loadObservations() hands back whatever JSON is on disk
// without validating its shape, so a record missing its ledger reaches decide() intact. A record
// that has recorded no attempt is a record whose every candidate is untried.
test('a hand-edited observation record with no ledger is data: every candidate reads as untried', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: true } };
  const d = decide('git commit -m x', { catalog, observations });
  assert.equal(d.mode, 'suggest');
  assert.equal(d.suggestFlags, '--quiet');
});

// Final review I2: the record and the catalog are both hand-editable, and `ledgerOf`/`candidatesOf`
// guarded only nullish — a string ledger reached `c in ledger` and threw, out of the hook, which
// swallowed it. Anything that is not the collection it should be IS the empty collection.
test('a ledger that is not an object reads as no recorded attempts; candidates that are not a list read as none (final review I2)', () => {
  const observations = { 'git-commit': { identity: 'catalog', noisy: true, ledger: 'hand-edited' } };
  const d = decide('git commit -m x', { catalog, observations });
  assert.equal(d.mode, 'suggest');
  assert.equal(d.suggestFlags, '--quiet');
  const stringCandidates = { 'git-commit': { ...catalog['git-commit'], candidates: '--quiet' } };
  const clean = { 'git-commit': { identity: 'catalog', noisy: true, ledger: {} } };
  assert.equal(decide('git commit -m x', { catalog: stringCandidates, observations: clean }).mode, 'noisy', 'no list, nothing to suggest: straight to wrap');
  const numberRecord = { 'git-commit': 7 };
  assert.equal(decide('git commit -m x', { catalog, observations: numberRecord }).mode, 'observe', 'a record that is not an object is no record');
});

// Final review I3, the other half: a record with a ledger but no bare measurement is a tool whose
// own noise level is unknown. It is unseen, so it is observed — not "plain" because `!undefined`.
test('a record with no bare measurement is unseen: observe, on both the catalog and the bespoke path (final review I3)', () => {
  const trialOnly = { 'git-commit': { identity: 'catalog', ledger: { '--quiet': 'sufficient' } } };
  assert.equal(decide('git commit -m x', { catalog, observations: trialOnly }).mode, 'observe');
  const bespokeNoMeasure = { 'bash scripts/battery.sh': { identity: 'bespoke', ledger: {} } };
  assert.equal(decide('bash scripts/battery.sh', { catalog: {}, observations: bespokeNoMeasure }).mode, 'observe');
  // The observer is alive: the same records WITH a measurement leave observe.
  assert.equal(decide('git commit -m x', { catalog, observations: { 'git-commit': { ...trialOnly['git-commit'], noisy: true } } }).mode, 'suggest');
  assert.equal(decide('bash scripts/battery.sh', { catalog: {}, observations: { 'bash scripts/battery.sh': { identity: 'bespoke', noisy: false, ledger: {} } } }).mode, 'plain');
});

test('RED CHECK: a tool with N candidates reaches wrap in at most N suggest states, never suggests twice', () => {
  const many = { t: { match: { type: 'prefix', value: 'toolx' }, outcome: 'x', candidates: ['-a', '-b', '-c'] } };
  let observations = { t: { identity: 'catalog', noisy: true, ledger: {} } };
  const suggested = [];
  for (let i = 0; i < 5; i++) {
    const d = decide('toolx', { catalog: many, observations });
    if (d.mode === 'suggest') { suggested.push(d.suggestFlags); observations = { t: { ...observations.t, ledger: { ...observations.t.ledger, [d.suggestFlags]: 'insufficient' } } }; }
    else break;
  }
  assert.deepEqual(suggested.sort(), ['-a', '-b', '-c']); // exactly the 3 candidates, no repeats
  assert.equal(decide('toolx', { catalog: many, observations }).mode, 'noisy'); // 4th call: exhausted
});
