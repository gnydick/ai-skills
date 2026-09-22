import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADUATION_AGREEMENTS, AGREEMENT_MATCH_CAP, PICK_WINDOW, SHAPE_WINDOW, SHAPE_FACTOR,
  emptyTraining, trainingOf, commonPrefix, deriveMatcher, shadowPick, identify, noteRun, shapeMoved,
  driftReason, reopen, graduated, learnedId, learnedEntry, frozenFixture,
} from '../scripts/lib/training.mjs';

const AT = '2026-09-05T12:00:00.000Z';
// A run of the spec's own example ("How an outcome pattern is learned"): the answer is the last line.
const RUN = (summary) => ['   Compiling fs-core v0.1.0', 'running 128 tests', summary];
const pickOf = (text, log) => ({ text, log, at: AT });

test('K is one named constant, and it is 2', () => { assert.equal(GRADUATION_AGREEMENTS, 2); });

test('commonPrefix is the longest common prefix, character by character', () => {
  assert.equal(commonPrefix(['test result: ok. 128 passed', 'test result: ok. 12 passed']), 'test result: ok. 12');
  assert.equal(commonPrefix(['test result: ok. 128 passed', 'test result: FAILED. 1 passed']), 'test result: ');
  assert.equal(commonPrefix(['abc', 'xyz']), '');
  assert.equal(commonPrefix(['same', 'same']), 'same');
  assert.equal(commonPrefix([]), '');
});

test('V10: the same picks always derive the same matcher; the spec example yields `test result: `', () => {
  const picks = [pickOf('test result: ok. 128 passed; 0 failed', 'a'), pickOf('test result: ok. 12 passed; 0 failed', 'b'), pickOf('test result: FAILED. 1 passed; 1 failed', 'c')];
  const once = deriveMatcher(picks), twice = deriveMatcher(picks.map((p) => ({ ...p })));
  assert.deepEqual(once, { type: 'prefix', value: 'test result: ' });
  assert.deepEqual(twice, once);
});

test('V10 / V9: a single observation never derives a matcher, and what is derived is a prefix, never a regex', () => {
  assert.equal(deriveMatcher([]), null);
  assert.equal(deriveMatcher([pickOf('test result: ok', 'a')]), null);
  const m = deriveMatcher([pickOf('[main (root-commit) a1b2c3d] x', 'a'), pickOf('[main (root-commit) 9f8e7d6] y', 'b')]);
  assert.deepEqual(m, { type: 'prefix', value: '[main (root-commit) ' });
  assert.ok(!(m instanceof RegExp));
  assert.equal(deriveMatcher([pickOf('abc', 'a'), pickOf('xyz', 'b')]), null, 'an empty prefix would match every line: no matcher');
});

test('shadowPick is every line the prefix matches, by index', () => {
  const m = { type: 'prefix', value: 'test result: ' };
  assert.deepEqual(shadowPick(m, RUN('test result: ok. 3 passed')), [2]);
  assert.deepEqual(shadowPick(m, ['test result: a', 'x', 'test result: b']), [0, 2]);
  assert.deepEqual(shadowPick(m, RUN('done')), []);
});

test('identify: two picks form the matcher, the next K agreements graduate it, and the frozen matcher is the one that agreed', () => {
  let r = identify(emptyTraining(), { lines: RUN('test result: ok. 3 passed; 0 failed'), index: 2, log: 'l1', at: AT });
  assert.equal(r.agreed, null); assert.equal(r.graduates, false); assert.equal(r.matcher, null);
  r = identify(r.training, { lines: RUN('test result: ok. 4 passed; 0 failed'), index: 2, log: 'l2', at: AT });
  assert.equal(r.agreed, null, 'no matcher existed before this pick, so nothing could agree');
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ok. ' });
  assert.equal(r.graduates, false);
  r = identify(r.training, { lines: RUN('test result: ok. 5 passed; 0 failed'), index: 2, log: 'l3', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1); assert.equal(r.graduates, false);
  r = identify(r.training, { lines: RUN('test result: ok. 60 passed; 0 failed'), index: 2, log: 'l4', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 2);
  assert.equal(r.graduates, true, `graduates on the ${GRADUATION_AGREEMENTS}nd consecutive agreement`);
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ok. ' }, 'a line the prefix matched cannot shorten it');
  assert.equal(r.training.picks.length, 4);
  assert.deepEqual(r.training.picks.at(-1), { text: 'test result: ok. 60 passed; 0 failed', log: 'l4', at: AT });
});

test('identify: a disagreement resets the streak and the matcher shortens — the spec example converges on its own', () => {
  let t = emptyTraining();
  for (const [s, l] of [['test result: ok. 128 passed; 0 failed', 'l1'], ['test result: ok. 12 passed; 0 failed', 'l2']]) t = identify(t, { lines: RUN(s), index: 2, log: l, at: AT }).training;
  assert.deepEqual(deriveMatcher(t.picks), { type: 'prefix', value: 'test result: ok. 12' }, 'the prefix cut inside a number: exactly what two runs entitle it to');
  let r = identify(t, { lines: RUN('test result: FAILED. 1 passed; 1 failed'), index: 2, log: 'l3', at: AT });
  assert.equal(r.agreed, false); assert.equal(r.training.streak, 0);
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ' });
  r = identify(r.training, { lines: RUN('test result: ok. 7 passed; 0 failed'), index: 2, log: 'l4', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1); assert.equal(r.graduates, false);
});

// #166: agreement is the pick being AMONG the matcher's matches, with at most AGREEMENT_MATCH_CAP of
// them in the run. Two picks of `widgets: N` derive the prefix `widgets: `; each case below then
// hands identify() a run built to a stated number of matching lines.
const widgetsTrained = () => {
  let t = emptyTraining();
  for (const [s, l] of [['widgets: 3', 'l1'], ['widgets: 4', 'l2']]) t = identify(t, { lines: RUN(s), index: 2, log: l, at: AT }).training;
  assert.deepEqual(deriveMatcher(t.picks), { type: 'prefix', value: 'widgets: ' });
  return t;
};
const widgetLines = (n) => Array.from({ length: n }, (_, i) => `widgets: ${i}`);

test('the match cap is one named constant, and it is 5', () => { assert.equal(AGREEMENT_MATCH_CAP, 5); });

test('identify: three matching lines and the pick is the first of them — agreed', () => {
  const t = widgetsTrained(), lines = widgetLines(3);
  // RED CHECK: the old rule — exactly one match, at the pick — answers false on this very input, so
  // a test that expects agreement here is proven to see the change.
  const shadow = shadowPick(deriveMatcher(t.picks), lines);
  assert.deepEqual(shadow, [0, 1, 2], 'the prefix matches all three lines');
  assert.equal(shadow.length === 1 && shadow[0] === 0, false, 'RED CHECK: the exactly-one rule disagreed here');
  const r = identify(t, { lines, index: 0, log: 'l3', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1);
});

test('identify: three matching lines and the pick is the third of them — agreed', () => {
  const r = identify(widgetsTrained(), { lines: widgetLines(3), index: 2, log: 'l3', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1);
});

test('identify: more than AGREEMENT_MATCH_CAP matching lines disagrees — an over-wide prefix cannot graduate', () => {
  const atCap = identify(widgetsTrained(), { lines: widgetLines(AGREEMENT_MATCH_CAP), index: 0, log: 'l3', at: AT });
  assert.equal(atCap.agreed, true, 'the cap itself is still an agreement');
  const over = identify(widgetsTrained(), { lines: widgetLines(AGREEMENT_MATCH_CAP + 1), index: 0, log: 'l3', at: AT });
  assert.equal(over.agreed, false); assert.equal(over.training.streak, 0); assert.equal(over.graduates, false);
});

test('identify: one matching line, at the pick — agreed', () => {
  const r = identify(widgetsTrained(), { lines: ['x', 'y', 'widgets: 9'], index: 2, log: 'l3', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1);
});

test('identify: one matching line, elsewhere than the pick — disagreed', () => {
  const r = identify(widgetsTrained(), { lines: ['widgets: 9', 'x', 'nothing here'], index: 2, log: 'l3', at: AT });
  assert.equal(r.agreed, false); assert.equal(r.training.streak, 0); assert.equal(r.graduates, false);
});

test('the pick window is bounded at PICK_WINDOW, most recent kept', () => {
  let t = emptyTraining();
  for (let i = 0; i < PICK_WINDOW + 3; i++) t = identify(t, { lines: RUN(`done ${i}`), index: 2, log: `l${i}`, at: AT }).training;
  assert.equal(t.picks.length, PICK_WINDOW);
  assert.equal(t.picks.at(-1).text, `done ${PICK_WINDOW + 2}`);
});

test('noteRun keeps the last SHAPE_WINDOW runs, oldest first, and the last log', () => {
  let t = emptyTraining();
  for (let i = 0; i < SHAPE_WINDOW + 2; i++) t = noteRun(t, { log: `l${i}`, lines: 100 + i, stdoutLines: 100 + i, stderrLines: 0, code: 0 });
  assert.equal(t.history.length, SHAPE_WINDOW);
  assert.equal(t.history[0].lines, 102);
  assert.equal(t.history.at(-1).lines, 100 + SHAPE_WINDOW + 1);
  assert.equal(t.lastLog, `l${SHAPE_WINDOW + 1}`);
});

// Design verification 12, each trigger on its own — one combined case would pass on any one of three.
const steady = () => { let t = emptyTraining(); for (let i = 0; i < 3; i++) t = noteRun(t, { log: `l${i}`, lines: 100, stdoutLines: 90, stderrLines: 10, code: 0 }); return t; };
const OK_RUN = { matched: 1, code: 0, errorBlock: false, lines: 100, stdoutLines: 90, stderrLines: 10 };

test('V12 (1): the matcher matching nothing in a run re-opens training', () => {
  assert.equal(driftReason(steady(), { ...OK_RUN, matched: 0 }), 'matched-nothing');
  assert.equal(driftReason(steady(), OK_RUN), null, 'a run that matched does not');
});

test('V12 (2): a non-zero exit with no error block re-opens training; with an error block it does not', () => {
  assert.equal(driftReason(steady(), { ...OK_RUN, code: 1, errorBlock: false }), 'nonzero-without-error-block');
  assert.equal(driftReason(steady(), { ...OK_RUN, code: 1, errorBlock: true }), null);
});

test('V12 (3): a material move in line count or in the stdout share re-opens training; a small one does not', () => {
  assert.equal(driftReason(steady(), { ...OK_RUN, lines: 100 * SHAPE_FACTOR + 1, stdoutLines: 100 * SHAPE_FACTOR + 1, stderrLines: 0 }), 'shape');
  assert.equal(driftReason(steady(), { ...OK_RUN, lines: 10, stdoutLines: 9, stderrLines: 1 }), 'shape');
  assert.equal(driftReason(steady(), { ...OK_RUN, lines: 100, stdoutLines: 10, stderrLines: 90 }), 'shape', 'the answer stream flipped');
  assert.equal(driftReason(steady(), { ...OK_RUN, lines: 150, stdoutLines: 130, stderrLines: 20 }), null);
  const one = noteRun(emptyTraining(), { log: 'l', lines: 100, stdoutLines: 90, stderrLines: 10, code: 0 }).history;
  assert.equal(shapeMoved(one, { lines: 5000, stdoutLines: 0, stderrLines: 5000 }), false, 'one remembered run is no shape to move from');
});

test('reopen discards the picks and the streak, keeps the history, names the reason; graduated() clears the re-open', () => {
  let t = steady();
  t = identify(t, { lines: RUN('done'), index: 2, log: 'l', at: AT }).training;
  const r = reopen(t, 'matched-nothing', 'l9', AT);
  assert.deepEqual(r.picks, []); assert.equal(r.streak, 0);
  assert.equal(r.history.length, 3);
  assert.deepEqual(r.open, { reason: 'matched-nothing', log: 'l9', at: AT });
  const g = graduated(r);
  assert.ok(!('open' in g)); assert.deepEqual(g.picks, []); assert.equal(g.history.length, 3);
});

test('trainingOf reads a hand-edited record as data: anything not the right shape is the empty one', () => {
  assert.deepEqual(trainingOf(undefined), emptyTraining());
  assert.deepEqual(trainingOf({ training: 'garbage' }), emptyTraining());
  assert.deepEqual(trainingOf({ training: { picks: 'x', streak: -1, history: null } }), emptyTraining());
  const t = trainingOf({ training: { picks: [{ text: 'a', log: 'l', at: AT }, { nope: 1 }], streak: 2, history: [{ lines: 3, stdoutLines: 3, stderrLines: 0, code: 0 }], lastLog: 'l', open: { reason: 'shape', log: 'l', at: AT } } });
  assert.equal(t.picks.length, 1); assert.equal(t.streak, 2); assert.equal(t.history.length, 1); assert.equal(t.lastLog, 'l'); assert.equal(t.open.reason, 'shape');
});

test('learnedId is a filename-safe slug that satisfies promote-tool.mjs’s own id rule', () => {
  assert.equal(learnedId('bash scripts/battery.sh'), 'bash-scripts-battery.sh');
  assert.equal(learnedId('python scripts/oracle_compare.py'), 'python-scripts-oracle_compare.py');
  assert.equal(learnedId('./scripts/x.sh'), 'scripts-x.sh');
  assert.equal(learnedId('node'), 'node');
  for (const id of ['bash-scripts-battery.sh', 'scripts-x.sh']) assert.match(id, /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
  assert.throws(() => learnedId('///'), /no usable id/);
});

test('learnedEntry and frozenFixture have the shapes catalog.mjs and survival.mjs read', () => {
  const m = { type: 'prefix', value: 'test result: ok. ' };
  // The match is handed in whole (C1): what a re-graduation preserves is the entry's own match, so
  // this function never builds one from a key it cannot tell apart from an id.
  const match = { type: 'prefix', value: 'bash scripts/battery.sh' };
  assert.deepEqual(learnedEntry(match, m, AT, 4),
    { match, outcome: m, candidates: [], learned: { at: AT, picks: 4 } });
  const lines = RUN('test result: ok. 60 passed; 0 failed');
  const f = frozenFixture({ lines, index: 2, picks: [pickOf('test result: ok. 3 passed; 0 failed', 'l1')], log: 'l4', at: AT, key: 'bash scripts/battery.sh' });
  assert.deepEqual(f.lines, [...lines, 'test result: ok. 3 passed; 0 failed']);
  assert.deepEqual(f.answers, [2, 3]);
  assert.match(f.source, /frozen at graduation/);
});
