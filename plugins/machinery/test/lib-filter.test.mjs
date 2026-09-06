import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, select, selectInfra, render, hasErrorBlock, MAX_SHOWN, PASS_THROUGH_LINES } from '../scripts/lib/filter.mjs';

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
  assert.equal(out.length, MAX_SHOWN + 2);
  assert.equal(out[120], `... [${500 - MAX_SHOWN} kept lines elided between head and tail] ...`);
  assert.equal(out[121], `... [${420 - 119 - 1} lines omitted] ...`);
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

// select(lines, outcomePattern) — the optional declared-outcome pattern.
// Every line of this corpus is placed to exercise one branch; TAIL_LINES is 8, so
// the tail window is 10..17 and indices 0..9 are kept only by a rule that names them.
const outcomeCorpus = () => [
  '   Compiling a v0.1.0',               //  0 chatter, outside the tail
  'plain narrative line',                //  1 matched by nothing built in, outside the tail
  'error[E0599]: no method named `foo`', //  2 BLOCK_START, block runs to the blank
  '  --> src/x.rs:1:1',                  //  3
  '',                                    //  4 blank ends the block
  '   Compiling b v0.1.0',               //  5 chatter, outside the tail
  'HEARTBEAT build 42s 3/9',             //  6 PROOF_LINE
  'zz_gate --check: 7 of 7 ok',          //  7 PROOF_LINE
  'something cannot be resolved',        //  8 KEYWORD, carries CONTEXT_AFTER
  'context one',                         //  9
  'context two',                         // 10
  '   Compiling c v0.1.0',               // 11 chatter in the tail: dropped
  'a totally unremarkable line',          // 12 non-chatter in the tail: kept
  '   Downloading d',                    // 13 chatter in the tail: dropped
  'test result: ok. 3 passed; 0 failed', // 14 SUMMARY
  '   Compiling e v0.1.0',               // 15 chatter in the tail: dropped
  'plain tail line',                     // 16 non-chatter in the tail: kept
  '   Compiling f v0.1.0',               // 17 last line: always kept
];
// Derived by hand from the five regexes and the tail rule, not read back off a run.
const OUTCOME_CORPUS_BASELINE = [2, 3, 6, 7, 8, 9, 10, 12, 14, 16, 17];
const sorted = (keep) => [...keep].sort((a, b) => a - b);
// The baseline plus one declared outcome line, in index order.
const baselinePlus = (i) => [...OUTCOME_CORPUS_BASELINE, i].sort((a, b) => a - b);

test('a declared outcome pattern survives where nothing built in would keep it', () => {
  const k = select(outcomeCorpus(), /^plain narrative/);
  assert.ok(k.has(1), 'the outcome line must be kept');
  assert.deepEqual(sorted(k), baselinePlus(1), 'and it must add that line only');
});

test('a declared outcome pattern outranks CHATTER, like SUMMARY and PROOF_LINE do', () => {
  const k = select(outcomeCorpus(), /^\s*Compiling b\b/);
  assert.ok(k.has(5), 'a chatter line the caller declared an outcome is kept');
  assert.deepEqual(sorted(k), baselinePlus(5), 'and it must add that line only');
});

test('omitting the outcome pattern leaves select() behaviour unchanged (regression)', () => {
  assert.deepEqual(sorted(select(outcomeCorpus())), OUTCOME_CORPUS_BASELINE);
});

test('passing the outcome pattern as undefined is the same as omitting it (regression)', () => {
  assert.deepEqual(sorted(select(outcomeCorpus(), undefined)), OUTCOME_CORPUS_BASELINE);
});

// ---- The training loop: the drift trigger's error-block fact, and the floor (design Verification 13) ----

test('hasErrorBlock reads the same rule select() opens a block on', () => {
  assert.equal(hasErrorBlock(['   Compiling a', 'error[E0599]: no method', '  --> x']), true);
  assert.equal(hasErrorBlock(['   Compiling a', 'test result: ok. 3 passed; 0 failed']), false);
  assert.equal(hasErrorBlock([]), false);
});

// A deliberately WRONG learned matcher — a prefix nothing in the corpus starts with — leaves the floor
// exactly as it was: the final line, the error block and the proof lines survive, and nothing kept
// without the matcher is lost. This is the bound that makes model-trained matching acceptable, so it
// is tested rather than argued.
test('V13: a wrong learned matcher promotes nothing and removes nothing — the floor stands', () => {
  const wrong = { test: (line) => line.startsWith('NOTHING STARTS WITH THIS') };
  const without = sorted(select(outcomeCorpus()));
  const withWrong = sorted(select(outcomeCorpus(), wrong));
  assert.deepEqual(withWrong, without);
  assert.ok(withWrong.includes(17), 'the final line survives');
  assert.ok(withWrong.includes(2) && withWrong.includes(3), 'the error block survives');
  assert.ok(withWrong.includes(6) && withWrong.includes(7), 'the proof lines survive');
});

test('V13: a learned matcher that matches a line ADDS it and can subtract nothing — the kept set only grows', () => {
  const matcher = { test: (line) => line.startsWith('   Compiling a') }; // index 0: a chatter line, outside the tail
  const without = sorted(select(outcomeCorpus()));
  const withIt = sorted(select(outcomeCorpus(), matcher));
  assert.deepEqual(withIt, [0, ...without]);
});

// I1 of the final whole-branch review, and the reason V13 no longer stops at select(). The floor is
// a property of select(); render()'s display cap sits ABOVE it. Once more than MAX_SHOWN lines are
// kept, render() shows a head and a tail with an explicit elision line between them, so at exactly
// the cap promoting one more line pushes a previously shown line into the elided middle. Ruled
// 2026-09-06: the cap is a pre-existing display limit that applies to all output whether a matcher
// is involved or not, so the DOCUMENTATION changes (README, and the spec's § The floor stays
// underneath) and render() does not — and the boundary is pinned by this test rather than by prose.
const proof = (i) => `my_tool: line ${i}`; // a PROOF_LINE: kept on its own account, never by the tail rule
// n proof lines, then chatter long enough that the tail window holds nothing but chatter: select()
// keeps every proof line plus the unconditionally kept last line, and nothing else.
const capCorpus = (proofs) => [...Array.from({ length: proofs }, (_, i) => proof(i)), ...Array.from({ length: 12 }, (_, i) => `   Compiling c${i}`)];
const promoteBuriedChatter = { test: (line) => line === '   Compiling c0' };
// render() interleaves its own scaffolding — `... [n lines omitted] ...` between non-adjacent kept
// lines, and the elision line at the cap. The question here is which of the tool's OWN lines a
// reader can still see, so the scaffolding is separated out rather than compared as content.
const MARKER = /^\.\.\. \[.+\] \.\.\.$/;
const body = (ls, keep) => shown(ls, keep).filter((l) => !MARKER.test(l));
const scaffolding = (ls, keep) => shown(ls, keep).filter((l) => MARKER.test(l));

test('V13 through render(): under the display cap a matcher hides nothing; AT the cap it can, and the elision line says how many', () => {
  const under = capCorpus(MAX_SHOWN - 2);
  assert.equal(select(under).size, MAX_SHOWN - 1, 'the corpus sits one under the cap');
  assert.equal(select(under, promoteBuriedChatter).size, MAX_SHOWN, 'and promotion puts it exactly on the cap');
  const underAfter = body(under, select(under, promoteBuriedChatter));
  assert.deepEqual(body(under, select(under)).filter((l) => !underAfter.includes(l)), [], 'nothing shown before is missing after');
  assert.ok(underAfter.includes('   Compiling c0'), 'and the promoted line is shown');
  assert.ok(!scaffolding(under, select(under, promoteBuriedChatter)).some((l) => /elided/.test(l)), 'no elision at or under the cap');

  // One line further on, the promotion crosses the cap. This is the boundary, and it is the whole
  // of it: what a matcher can cost is one line moved into an elision that names itself.
  const at = capCorpus(MAX_SHOWN - 1);
  assert.equal(select(at).size, MAX_SHOWN, 'the corpus sits exactly on the cap');
  assert.equal(select(at, promoteBuriedChatter).size, MAX_SHOWN + 1);
  const before = body(at, select(at)), after = body(at, select(at, promoteBuriedChatter));
  assert.ok(!scaffolding(at, select(at)).some((l) => /elided/.test(l)), 'a keep set exactly at the cap renders whole');
  assert.ok(scaffolding(at, select(at, promoteBuriedChatter)).includes('... [1 kept lines elided between head and tail] ...'),
    `the elision names its own count: ${scaffolding(at, select(at, promoteBuriedChatter)).join(' | ')}`);
  const hidden = before.filter((l) => !after.includes(l));
  assert.equal(hidden.length, 1, `exactly the one line the crossing cost: ${hidden.join(' | ')}`);
  assert.match(hidden[0], /^my_tool: line \d+$/, 'RED CHECK: what it hid is an ordinary kept line, not the elision marker itself');
});
