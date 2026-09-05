import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteStates, splitOutside, OUTSIDE, DELIM, INSIDE } from '../scripts/lib/quotes.mjs';

// Issue #11: the one definition of a quoted span (rules/design-invariants.md § Never re-derive a
// fact). catalog.mjs's tokens() and classify.mjs's segment splitter both read this; neither keeps
// a scanner of its own. The states are per code unit, so a consumer can slice the original
// command at positions taken from them.
const O = OUTSIDE, D = DELIM, I = INSIDE;

test('quoteStates marks the delimiters and everything between them, per code unit', () => {
  assert.deepEqual(quoteStates('a"b c"d'), [O, D, I, I, I, D, O]);
  assert.deepEqual(quoteStates("a'b c'd"), [O, D, I, I, I, D, O]);
  assert.deepEqual(quoteStates('ab'), [O, O]);
  assert.deepEqual(quoteStates(''), []);
});

test('quoteStates: the other quote character inside a span is data, and a span opens anywhere in a word (re-review R3)', () => {
  assert.deepEqual(quoteStates(`'a"b'`), [D, I, I, I, D]);
  assert.deepEqual(quoteStates(`"it's"`), [D, I, I, I, I, D]);
  assert.deepEqual(quoteStates('-m"x"'), [O, O, D, I, D]);
  assert.deepEqual(quoteStates('""'), [D, D], 'an empty span is two delimiters and nothing inside');
});

test('quoteStates: an unterminated span runs to the end of the command — data, not a throw', () => {
  assert.deepEqual(quoteStates('a"b c'), [O, D, I, I, I]);
  assert.deepEqual(quoteStates("'"), [D]);
  assert.doesNotThrow(() => quoteStates('cargo build "'));
});

test('splitOutside splits on the separator only outside quotes and keeps the quote characters in the pieces', () => {
  const AND = /\s*&&\s*/;
  assert.deepEqual(splitOutside('echo "a && b" && ls', AND), ['echo "a && b"', 'ls']);
  assert.deepEqual(splitOutside("echo 'a && b'", AND), ["echo 'a && b'"]);
  assert.deepEqual(splitOutside('"a"&&"b"', AND), ['"a"', '"b"'], 'a separator hard against a span is still a separator');
  assert.deepEqual(splitOutside('a && b && c', AND), ['a', 'b', 'c']);
  assert.deepEqual(splitOutside('plain', AND), ['plain'], 'no separator: the whole command, once');
  assert.deepEqual(splitOutside('', AND), [''], 'the empty command is one empty piece, like String.split');
});

test('splitOutside: an unterminated span swallows every separator after it', () => {
  assert.deepEqual(splitOutside('echo "a && b', /\s*&&\s*/), ['echo "a && b']);
  assert.deepEqual(splitOutside("cat 'x; cargo build", /\s*;\s*/), ["cat 'x; cargo build"]);
});

test('splitOutside: a separator regex with lookbehind still sees the real characters outside quotes', () => {
  const SINGLE_AMP = /\s*(?<![>&])&(?!&)\s*/;
  assert.deepEqual(splitOutside('cat a 2>&1 & ls', SINGLE_AMP), ['cat a 2>&1', 'ls']);
  assert.deepEqual(splitOutside('cat "a & b" & ls', SINGLE_AMP), ['cat "a & b"', 'ls']);
});

test('splitOutside: whitespace trimming in the separator never reaches into a span', () => {
  // The span's own spaces are masked, so `\s*` around the separator stops at the closing quote.
  assert.deepEqual(splitOutside('echo " x " ; ls', /\s*;\s*/), ['echo " x "', 'ls']);
});

test('RED CHECK: the scanner sees quotes and the splitter splits — a scanner that never opened a span would pass every "not split inside" case for free', () => {
  assert.notDeepEqual(quoteStates('"x"'), [O, O, O]);
  assert.equal(splitOutside('a;b', /;/).length, 2);
  assert.equal(splitOutside('"a;b"', /;/).length, 1);
});
