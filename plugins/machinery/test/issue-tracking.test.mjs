import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ABSENT, NO_ANSWER, DECLINED, ANSWERED, fileState, decide, readIfPresent, normalizeAnswer } from '../scripts/lib/issue-tracking.mjs';

// The precedence table of docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md (Ruling G).
// THE PROJECT FILE DECIDES WHENEVER IT EXISTS (Ruling B); the global file governs one row — no project
// file at all — and otherwise only pre-fills. Expectations come from the spec's table, spelled here as
// literals, never from the module under test.
const ANSWER = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.\nCheck: `<status command>` and `<one-item read command>`.\n';
const OTHER = 'Issue tracking: <other tracker> on `<other project>`, reached with `<other tool>`.\n';

test('fileState: three contents, and absence kept apart from all of them', () => {
  assert.equal(fileState(null), ABSENT);
  assert.equal(fileState('unanswered\n'), NO_ANSWER);
  assert.equal(fileState(''), NO_ANSWER, 'Ruling H: an empty file is read as unanswered');
  assert.equal(fileState('  \r\n'), NO_ANSWER, 'this plan: whitespace-only reads as empty (spec observation 6)');
  assert.equal(fileState('  unanswered \r\n'), NO_ANSWER);
  assert.equal(fileState('none\n'), DECLINED);
  assert.equal(fileState(ANSWER), ANSWERED);
  assert.equal(new Set([ABSENT, NO_ANSWER, DECLINED, ANSWERED]).size, 4);
});

// TEST 3 — three global cases (and absent), because the global-answer case is the one Ruling B decided
// and the one a later "simplification" breaks first.
test('RED CHECK: a project unanswered asks, whatever the global file says (test 3)', () => {
  for (const g of ['unanswered\n', 'none\n', ANSWER, null]) {
    assert.equal(decide({ project: 'unanswered\n', global: g }).ask, true, `global ${JSON.stringify(g)} suppressed the ask`);
  }
});

// TEST 4 — each asserted with the global unanswered AND with a different tracker line, so a function
// that consults the global file for the decision at all is caught.
test('a project none and a project answer do not ask (test 4)', () => {
  for (const g of ['unanswered\n', OTHER]) {
    assert.deepEqual(decide({ project: 'none\n', global: g }), { ask: false, prefill: null });
    assert.deepEqual(decide({ project: ANSWER, global: g }), { ask: false, prefill: null });
  }
});

// TEST 5 — the only row where the global file decides anything.
test('with no project file, the global file governs (test 5)', () => {
  assert.deepEqual(decide({ project: null, global: ANSWER }), { ask: false, prefill: null });
  assert.deepEqual(decide({ project: null, global: 'none\n' }), { ask: false, prefill: null });
  for (const g of ['unanswered\n', '', null]) {
    assert.deepEqual(decide({ project: null, global: g }), { ask: true, prefill: null }, `global ${JSON.stringify(g)}`);
  }
});

// TEST 6 — pre-fill is one of the global file's only two jobs; a change making it inert passes all else.
test('the global answer is the pre-fill (test 6)', () => {
  assert.deepEqual(decide({ project: 'unanswered\n', global: ANSWER }), { ask: true, prefill: ANSWER.trim() });
  assert.deepEqual(decide({ project: 'unanswered\n', global: 'unanswered\n' }), { ask: true, prefill: null });
  assert.deepEqual(decide({ project: 'unanswered\n', global: null }), { ask: true, prefill: null });
  // This plan's reading of "the global answer, if any, is the pre-fill": none carries an answer.
  assert.deepEqual(decide({ project: 'unanswered\n', global: 'none\n' }), { ask: true, prefill: 'none' });
});

// TEST 8 — positive control, both directions: a function that never asks and one that always asks each
// fail here, so tests 4 and 5 cannot pass for free.
test('positive control: the function asks on a project unanswered, and is not stuck asking (test 8)', () => {
  assert.strictEqual(decide({ project: 'unanswered\n', global: null }).ask, true, 'the decision is dead');
  assert.strictEqual(decide({ project: ANSWER, global: null }).ask, false, 'the decision is stuck on');
});

// TEST 14 — Ruling H.
test('an empty file is read as unanswered, and an empty project file is not an absent one (test 14)', () => {
  assert.deepEqual(decide({ project: '', global: 'unanswered\n' }), { ask: true, prefill: null });
  assert.deepEqual(decide({ project: '', global: ANSWER }), { ask: true, prefill: ANSWER.trim() }, 'the empty project file handed the decision to the global file');
  assert.deepEqual(decide({ project: null, global: '' }), { ask: true, prefill: null });
  assert.notDeepEqual(decide({ project: '', global: ANSWER }), decide({ project: null, global: ANSWER }));
  assert.equal(decide({ project: null, global: ANSWER }).ask, false);
});

test('readIfPresent: null for a missing file, the text for a present one, and a loud error for anything else', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'it-'));
  try {
    assert.equal(readIfPresent(path.join(d, 'missing', 'x.md')), null);
    fs.writeFileSync(path.join(d, 'x.md'), 'none\n');
    assert.equal(readIfPresent(path.join(d, 'x.md')), 'none\n');
    assert.throws(() => readIfPresent(d), /EISDIR|illegal operation on a directory/);
  } finally { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 }); }
});

test('normalizeAnswer keeps an answer, normalises its line endings, and refuses what would record unanswered', () => {
  assert.equal(normalizeAnswer('  Issue tracking: <tracker>.\r\nCheck: `<read>`.  \r\n'), 'Issue tracking: <tracker>.\nCheck: `<read>`.');
  assert.equal(normalizeAnswer('none\n'), 'none', 'the opt-out is an answer');
  assert.throws(() => normalizeAnswer(''), /empty answer/);
  assert.throws(() => normalizeAnswer(null), /empty answer/);
  assert.throws(() => normalizeAnswer(' unanswered \n'), /seeded word/);
  assert.throws(() => normalizeAnswer('---\nIssue tracking: <tracker>'), /rules index/);
});
