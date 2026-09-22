import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADUATION_AGREEMENTS, AGREEMENT_MATCH_CAP, PICK_WINDOW, SHAPE_WINDOW, SHAPE_FACTOR,
  emptyTraining, trainingOf, commonPrefix, deriveMatcher, shadowPick, identify, noteRun, shapeMoved,
  driftReason, reopen, graduated, learnedId, learnedEntry, frozenFixture,
} from '../scripts/lib/training.mjs';
import { survivalProblems } from '../scripts/lib/survival.mjs';

const AT = '2026-09-05T12:00:00.000Z';
// A run of the spec's own example ("How an outcome pattern is learned"): the answer is the last line.
const RUN = (summary) => ['   Compiling fs-core v0.1.0', 'running 128 tests', summary];
// A pick carries the texts of EVERY line the session identified in that run (#168); a string is the
// one-line case written short.
const pickOf = (texts, log) => ({ texts: [].concat(texts), log, at: AT });
// `cargo test -p fs-core`: one `test result:` summary per target — lib, integration, doctest — at
// indices 4, 7 and 10, with the per-test lines that sit between them. Those per-test lines are what
// makes the prefix `test` genuinely over-wide over this run, and nothing else here starts with it.
const OK = (n) => `test result: ok. ${n} passed; 0 failed`;
const CARGO = (lib, integration, doctest) => [
  '   Compiling fs-core v0.1.0',
  'running 2 tests',
  'test slice::keeps_order ... ok',
  'test slice::rejects_empty ... ok',
  lib,
  'running 1 test',
  'test api::roundtrip ... ok',
  integration,
  'running 1 test',
  'test src/lib.rs - slice (line 12) ... ok',
  doctest,
];
const CARGO_ANSWERS = [4, 7, 10];
// One identified run is already enough to derive a matcher when the session identified several
// lines in it: three texts have a common prefix to take.
const cargoTrained = () => identify(emptyTraining(), { lines: CARGO(OK(3), OK(4), OK(9)), indices: CARGO_ANSWERS, log: 'l1', at: AT }).training;

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
  let r = identify(emptyTraining(), { lines: RUN('test result: ok. 3 passed; 0 failed'), indices: [2], log: 'l1', at: AT });
  assert.equal(r.agreed, null); assert.equal(r.graduates, false); assert.equal(r.matcher, null);
  r = identify(r.training, { lines: RUN('test result: ok. 4 passed; 0 failed'), indices: [2], log: 'l2', at: AT });
  assert.equal(r.agreed, null, 'no matcher existed before this pick, so nothing could agree');
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ok. ' });
  assert.equal(r.graduates, false);
  r = identify(r.training, { lines: RUN('test result: ok. 5 passed; 0 failed'), indices: [2], log: 'l3', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1); assert.equal(r.graduates, false);
  r = identify(r.training, { lines: RUN('test result: ok. 60 passed; 0 failed'), indices: [2], log: 'l4', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 2);
  assert.equal(r.graduates, true, `graduates on the ${GRADUATION_AGREEMENTS}nd consecutive agreement`);
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ok. ' }, 'a line the prefix matched cannot shorten it');
  assert.equal(r.training.picks.length, 4);
  assert.deepEqual(r.training.picks.at(-1), { texts: ['test result: ok. 60 passed; 0 failed'], log: 'l4', at: AT });
});

test('identify: a disagreement resets the streak and the matcher shortens — the spec example converges on its own', () => {
  let t = emptyTraining();
  for (const [s, l] of [['test result: ok. 128 passed; 0 failed', 'l1'], ['test result: ok. 12 passed; 0 failed', 'l2']]) t = identify(t, { lines: RUN(s), indices: [2], log: l, at: AT }).training;
  assert.deepEqual(deriveMatcher(t.picks), { type: 'prefix', value: 'test result: ok. 12' }, 'the prefix cut inside a number: exactly what two runs entitle it to');
  let r = identify(t, { lines: RUN('test result: FAILED. 1 passed; 1 failed'), indices: [2], log: 'l3', at: AT });
  assert.equal(r.agreed, false); assert.equal(r.training.streak, 0);
  assert.deepEqual(r.matcher, { type: 'prefix', value: 'test result: ' });
  r = identify(r.training, { lines: RUN('test result: ok. 7 passed; 0 failed'), indices: [2], log: 'l4', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1); assert.equal(r.graduates, false);
});

// #168: agreement is the shadow matcher's match set EQUALLING the identified set — same indices,
// none missing, none extra. That is the original one-line rule generalised to a set, and it is what
// keeps the over-wide-prefix guard alive. #166's "the pick is among the matches, at most 5" rule is
// superseded; the cases below are its cases, moved to the set rule. The cap now bounds the
// IDENTIFIED set (train-tool.mjs refuses a longer one), not the match count.
// Two picks of `widgets: N` derive the prefix `widgets: `; each case then hands identify() a run
// built to a stated number of matching lines.
const widgetsTrained = () => {
  let t = emptyTraining();
  for (const [s, l] of [['widgets: 3', 'l1'], ['widgets: 4', 'l2']]) t = identify(t, { lines: RUN(s), indices: [2], log: l, at: AT }).training;
  assert.deepEqual(deriveMatcher(t.picks), { type: 'prefix', value: 'widgets: ' });
  return t;
};
const widgetLines = (n) => Array.from({ length: n }, (_, i) => `widgets: ${i}`);

test('the identified-set cap is one named constant, and it is 5', () => { assert.equal(AGREEMENT_MATCH_CAP, 5); });

test('deriveMatcher: three identified texts in ONE pick derive the prefix, and a second pick of three leaves it unchanged', () => {
  const one = [pickOf([OK(3), OK(4), OK(9)], 'l1')];
  assert.deepEqual(deriveMatcher(one), { type: 'prefix', value: 'test result: ok. ' }, 'one run with three identified lines has a common prefix to take');
  const two = [...one, pickOf([OK(60), OK(7), OK(2)], 'l2')];
  assert.deepEqual(deriveMatcher(two), { type: 'prefix', value: 'test result: ok. ' });
});

test('identify: the shadow match set equals the identified set — agreed', () => {
  const t = cargoTrained(), lines = CARGO(OK(60), OK(7), OK(2));
  assert.deepEqual(shadowPick(deriveMatcher(t.picks), lines), CARGO_ANSWERS, 'the prefix hits exactly the three summary lines');
  const r = identify(t, { lines, indices: CARGO_ANSWERS, log: 'l2', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1);
});

test('identify: an identified line the shadow matcher missed — disagreed', () => {
  // The doctest target failed, so the prefix `test result: ok. ` hits 4 and 7 but not 10, while the
  // session identified all three answer lines.
  const t = cargoTrained(), lines = CARGO(OK(60), OK(7), 'test result: FAILED. 0 passed; 1 failed');
  const shadow = shadowPick(deriveMatcher(t.picks), lines);
  assert.deepEqual(shadow, [4, 7], 'the matcher reaches only two of the three identified lines');
  // RED CHECK: #166's rule — the pick among at most AGREEMENT_MATCH_CAP matches — answers TRUE on
  // this very input, so a test that expects a disagreement here is proven to see the change.
  assert.equal(shadow.length <= AGREEMENT_MATCH_CAP && shadow.includes(CARGO_ANSWERS[0]), true, 'RED CHECK: the #166 includes-rule agreed here');
  const r = identify(t, { lines, indices: CARGO_ANSWERS, log: 'l2', at: AT });
  assert.equal(r.agreed, false); assert.equal(r.training.streak, 0); assert.equal(r.graduates, false);
});

test('identify: a match the session did not identify — disagreed', () => {
  // A fourth `test result:` line, from a target the session did not read off as an answer.
  const t = cargoTrained(), lines = [...CARGO(OK(60), OK(7), OK(2)), OK(0)];
  assert.deepEqual(shadowPick(deriveMatcher(t.picks), lines), [...CARGO_ANSWERS, 11]);
  const r = identify(t, { lines, indices: CARGO_ANSWERS, log: 'l2', at: AT });
  assert.equal(r.agreed, false); assert.equal(r.training.streak, 0); assert.equal(r.graduates, false);
});

test('identify: one identified line and one match, at it — agreed; the one-line case is the set rule with one element', () => {
  const r = identify(widgetsTrained(), { lines: ['x', 'y', 'widgets: 9'], indices: [2], log: 'l3', at: AT });
  assert.equal(r.agreed, true); assert.equal(r.training.streak, 1);
});

test('identify: one matching line, elsewhere than the pick — disagreed', () => {
  const r = identify(widgetsTrained(), { lines: ['widgets: 9', 'x', 'nothing here'], indices: [2], log: 'l3', at: AT });
  assert.equal(r.agreed, false); assert.equal(r.training.streak, 0); assert.equal(r.graduates, false);
});

test('identify: AGREEMENT_MATCH_CAP identified lines, all of them matched — agreed; identifying only some of them — disagreed', () => {
  const lines = widgetLines(AGREEMENT_MATCH_CAP);
  const all = identify(widgetsTrained(), { lines, indices: lines.map((_, i) => i), log: 'l3', at: AT });
  assert.equal(all.agreed, true, 'a run whose every match was identified agrees, up to the cap');
  const some = identify(widgetsTrained(), { lines, indices: [0], log: 'l3', at: AT });
  assert.equal(some.agreed, false, 'an over-wide prefix hits lines nobody identified: a disagreement');
  assert.equal(some.training.streak, 0); assert.equal(some.graduates, false);
});

test('the pick window is bounded at PICK_WINDOW, most recent kept', () => {
  let t = emptyTraining();
  for (let i = 0; i < PICK_WINDOW + 3; i++) t = identify(t, { lines: RUN(`done ${i}`), indices: [2], log: `l${i}`, at: AT }).training;
  assert.equal(t.picks.length, PICK_WINDOW);
  assert.deepEqual(t.picks.at(-1).texts, [`done ${PICK_WINDOW + 2}`]);
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
  t = identify(t, { lines: RUN('done'), indices: [2], log: 'l', at: AT }).training;
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

test('trainingOf reads an old one-text pick as a one-element identified set — no migration, it ages out of the window', () => {
  const t = trainingOf({ training: { picks: [
    { text: 'test result: ok. 3 passed; 0 failed', log: 'l1', at: AT },
    { texts: [OK(4), OK(9)], log: 'l2', at: AT },
    { nope: 1 },
  ], streak: 1, history: [] } });
  assert.deepEqual(t.picks.map((p) => p.texts), [['test result: ok. 3 passed; 0 failed'], [OK(4), OK(9)]]);
  assert.deepEqual(deriveMatcher(t.picks), { type: 'prefix', value: 'test result: ok. ' }, 'the old pick derives alongside the new ones');
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
  const f = frozenFixture({ lines, indices: [2], picks: [pickOf('test result: ok. 3 passed; 0 failed', 'l1')], log: 'l4', at: AT, key: 'bash scripts/battery.sh' });
  assert.deepEqual(f.lines, [...lines, 'test result: ok. 3 passed; 0 failed']);
  assert.deepEqual(f.answers, [2, 3]);
  assert.match(f.source, /frozen at graduation/);
});

test('frozenFixture: every identified index of this run, then one appended line per identified text of each earlier pick', () => {
  const lines = CARGO(OK(60), OK(7), OK(2));
  const earlier = [pickOf([OK(3), OK(4), OK(9)], 'l1'), pickOf([OK(5), OK(6), OK(1)], 'l2')];
  const f = frozenFixture({ lines, indices: CARGO_ANSWERS, picks: earlier, log: 'l3', at: AT, key: 'cargo test' });
  assert.deepEqual(f.lines, [...lines, OK(3), OK(4), OK(9), OK(5), OK(6), OK(1)]);
  assert.deepEqual(f.answers, [4, 7, 10, 11, 12, 13, 14, 15, 16], 'this run keeps its three answers; each earlier identified line is one more');
});

test('the survival guard still fires on the multi-answer fixture: the right prefix passes, the over-wide `test` is refused', () => {
  const lines = CARGO(OK(60), OK(7), OK(2));
  const earlier = [pickOf([OK(3), OK(4), OK(9)], 'l1'), pickOf([OK(5), OK(6), OK(1)], 'l2')];
  const f = frozenFixture({ lines, indices: CARGO_ANSWERS, picks: earlier, log: 'l3', at: AT, key: 'cargo test' });
  const match = { type: 'prefix', value: 'cargo test' };
  const right = learnedEntry(match, { type: 'prefix', value: 'test result: ok. ' }, AT, 3);
  assert.deepEqual(survivalProblems('cargo-test', right, f), [], 'the matcher the loop derives survives its own fixture');
  // V-guard: `test` also heads every per-test line, which nobody identified. If answers were ever
  // DERIVED by applying the pattern this could not fail; it is what makes the guard non-vacuous.
  const wide = learnedEntry(match, { type: 'prefix', value: 'test' }, AT, 3);
  const problems = survivalProblems('cargo-test', wide, f);
  assert.ok(problems.some((p) => /also matches a non-answer line 2:/.test(p)), problems.join('\n'));
});
