import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, select, selectInfra, render, MAX_SHOWN, PASS_THROUGH_LINES } from '../scripts/lib/filter.mjs';

const lines = (...l) => l;
const shown = (ls, keep) => render(ls, keep, 'H').split('\n').slice(1);

test('normalise: CRLF, progress-bar frames, ANSI, trailing blanks (test_progress_bar_keeps_last_frame, test_ansi_stripped)', () => {
  const out = normalise(Buffer.from('a\r\n10%\r50%\r100%\n\x1b[31mred\x1b[0m\n\n\n'));
  assert.deepEqual(out, ['a', '100%', 'red']);
});

test('infra success keeps only proof lines (test_infra_success_keeps_only_proof_lines)', () => {
  const ls = lines('To github.com:x/y', ' * [new branch] b -> b', "branch 'b' set up to track 'origin/b'.");
  assert.deepEqual([...selectInfra(ls, 0)].sort(), [1, 2]);
  assert.deepEqual([...selectInfra(lines('Already up to date.'), 0)], [0]);
});

test('infra success with no proof line keeps the last line', () => {
  assert.deepEqual([...selectInfra(lines('remote: hello', 'done-ish'), 0)], [1]);
});

test('infra failure keeps errors (test_infra_failure_keeps_errors)', () => {
  const ls = lines('Compiling x', 'error: failed to push some refs', '  hint: pull first', 'Compiling y');
  const k = selectInfra(ls, 1);
  assert.ok(k.has(1) && k.has(2));
});

test('heartbeat survives in both modes buried in chatter (test_heartbeat_survives_*)', () => {
  const chatter = Array.from({ length: 20 }, (_, i) => `   Compiling crate${i}`);
  const ls = [...chatter, 'HEARTBEAT battery 42s 3/9', ...chatter];
  assert.ok(select(ls).has(20));
  assert.ok(selectInfra(ls, 0).has(20));
});

test('a conforming gate denominator survives without enumeration; prose word-colon does not (test_conforming_gate_denominator…, test_proof_line_does_not_admit_prose_word_colon)', () => {
  const ls = ['zz_gate --check: 7 of 7 ok', 'remote: hello there', 'warning: something'];
  const k = selectInfra(ls, 0);
  assert.ok(k.has(0));
  assert.ok(!k.has(1));
});

test('error block kept to the blank line, summary kept, chatter dropped (test_error_block_and_summary_kept_chatter_dropped)', () => {
  const ls = ['   Compiling a', 'error[E0599]: no method', '  --> src/x.rs:1', '', '   Compiling b', 'test result: FAILED. 1 passed; 1 failed'];
  const k = select(ls);
  assert.ok(k.has(1) && k.has(2) && k.has(5));
  assert.ok(!k.has(0));
});

test('test failure section kept (test_test_failure_section_kept)', () => {
  const ls = ['running 3 tests', 'test a ... ok', '---- b stdout ----', 'assertion failed', '', 'failures:', '    b'];
  const k = select(ls);
  assert.ok(k.has(2) && k.has(3) && k.has(5) && k.has(6));
});

test('tail always kept except chatter, last line always (select tail rule)', () => {
  const ls = Array.from({ length: 50 }, (_, i) => (i === 49 ? '   Compiling last' : `plain ${i}`));
  const k = select(ls);
  assert.ok(k.has(49));
  assert.ok(k.has(42));
});

test('bulk noise still dropped: 400 chatter lines shrink under ten (test_bulk_noise_still_dropped)', () => {
  const ls = Array.from({ length: 400 }, (_, i) => `   Compiling c${i}`);
  assert.ok(select(ls).size < 10);
});

test('render caps at MAX_SHOWN with 3/5 head + 2/5 tail and both markers (step 26)', () => {
  const ls = Array.from({ length: 500 }, (_, i) => `error: e${i}`);
  const keep = new Set(ls.map((_, i) => i));
  const out = shown(ls, keep);
  assert.equal(out.length, MAX_SHOWN + 1);
  assert.equal(out[120], `... [${500 - MAX_SHOWN} kept lines elided between head and tail] ...`);
  assert.equal(out[0], 'error: e0'); assert.equal(out.at(-1), 'error: e499');
});

test('render marks gaps between kept lines', () => {
  const out = shown(['a', 'b', 'c', 'd'], new Set([0, 3]));
  assert.deepEqual(out, ['a', '... [2 lines omitted] ...', 'd']);
});

test('constants match the story', () => { assert.equal(PASS_THROUGH_LINES, 40); assert.equal(MAX_SHOWN, 200); });

test('RED CHECK: select does not keep everything', () => {
  assert.ok(select(Array.from({ length: 100 }, (_, i) => `   Compiling c${i}`)).size < 100);
});
