import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteStates, splitOutside, segmentsOutside, OUTSIDE, DELIM, INSIDE, COMMENT } from '../scripts/lib/quotes.mjs';

// Issue #11: the one definition of a quoted span — a second derivation would eventually disagree
// with the first. catalog.mjs's tokens() and classify.mjs's segment splitter both read this; neither keeps
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

// Issue #13: the hook wraps each segment of a compound on its own and rejoins the separators
// verbatim, so the split has to hand back the separator that FOLLOWS each piece — spacing and all,
// because the rebuilt command is `text + sep` for every piece. One definition of the split:
// segmentsOutside() is the loop, and splitOutside() is its pieces with the separators dropped.
const SEP = /\s*(?:;|&&|\|\||(?<![>&])&(?!&)|\r?\n)\s*/;
test('#13: segmentsOutside hands back each piece with the separator that follows it, spacing included', () => {
  assert.deepEqual(segmentsOutside('a && b; c', SEP), [{ text: 'a', sep: ' && ' }, { text: 'b', sep: '; ' }, { text: 'c', sep: '' }]);
  assert.deepEqual(segmentsOutside('cargo build & cat x', SEP), [{ text: 'cargo build', sep: ' & ' }, { text: 'cat x', sep: '' }]);
  assert.deepEqual(segmentsOutside('plain', SEP), [{ text: 'plain', sep: '' }], 'no separator: the whole command, once, followed by nothing');
  assert.deepEqual(segmentsOutside('', SEP), [{ text: '', sep: '' }], 'the empty command is one empty piece, like splitOutside');
  assert.deepEqual(segmentsOutside('cat a;', SEP), [{ text: 'cat a', sep: ';' }, { text: '', sep: '' }], 'a trailing separator leaves an empty last piece, as splitOutside does');
});

test('#13: a separator inside a span is data to segmentsOutside too — it is the same loop', () => {
  assert.deepEqual(segmentsOutside('echo "a && b" && ls', SEP), [{ text: 'echo "a && b"', sep: ' && ' }, { text: 'ls', sep: '' }]);
  assert.deepEqual(segmentsOutside("cat 'x; cargo build", SEP), [{ text: "cat 'x; cargo build", sep: '' }], 'an unterminated span swallows every separator after it');
});

test('#13: rejoining text + sep is the identity, so a command can be rebuilt around the pieces that get wrapped', () => {
  for (const c of ['a && b; c', 'cat a;', '\ncargo build', 'a ;; b', 'echo "x; y" || ls\n', 'cargo build 2>&1 & ls', '  spaced  &&  out  ', '']) {
    assert.equal(segmentsOutside(c, SEP).map((s) => s.text + s.sep).join(''), c, JSON.stringify(c));
  }
});

test('#13: splitOutside is segmentsOutside without the separators — one definition of the split, not two', () => {
  for (const c of ['a && b; c', 'echo "a && b" && ls', 'cat a;', 'plain', '', 'cat a 2>&1 & ls']) {
    assert.deepEqual(splitOutside(c, SEP), segmentsOutside(c, SEP).map((s) => s.text), JSON.stringify(c));
  }
});

// Fix round 2 for #13 (controller's amendment after re-review, 2026-09-05): a `#` comment is a span
// like a quote. The reviewer measured `echo "a" ; # comment && node -e …` split inside the comment,
// and the commented-out node ran. A `#` that begins a word — at the start, or after whitespace or
// a separator character, outside quotes — opens a span to the next newline (or the end); nothing
// inside it is OUTSIDE, so a separator there is data to the splitter and a word there is no token.
const C = COMMENT;
test('#13 fix 2: a # that begins a word opens a comment span to the newline; one that does not is data', () => {
  assert.deepEqual(quoteStates('a # b'), [O, O, C, C, C]);
  assert.deepEqual(quoteStates('# b'), [C, C, C]);
  assert.deepEqual(quoteStates('a#b'), [O, O, O], 'inside a word: not a comment');
  assert.deepEqual(quoteStates('$#'), [O, O], 'the parameter count: not a comment');
  assert.deepEqual(quoteStates('"#"'), [D, I, D], 'inside quotes: data');
  assert.deepEqual(quoteStates('a;# b'), [O, O, C, C, C], 'after a separator character');
  assert.deepEqual(quoteStates('a # b\nc'), [O, O, C, C, C, O, O], 'the newline ends it and is itself outside');
  assert.deepEqual(quoteStates('a # "b\nc'), [O, O, C, C, C, C, O, O], 'a quote inside a comment opens nothing');
});
test('#13 fix 2: the splitter sees no separator inside a comment, and the mask hides the comment from every reader', () => {
  const SEP2 = /\s*(?:;|&&|\|\||(?<![>&])&(?!&)|\r?\n)\s*/;
  assert.deepEqual(segmentsOutside('echo a ; # c && d', SEP2), [{ text: 'echo a', sep: ' ; ' }, { text: '# c && d', sep: '' }]);
  assert.deepEqual(segmentsOutside('# skip: x && y', SEP2), [{ text: '# skip: x && y', sep: '' }]);
  assert.deepEqual(segmentsOutside('a\n# note && b\nc', SEP2), [{ text: 'a', sep: '\n' }, { text: '# note && b', sep: '\n' }, { text: 'c', sep: '' }]);
  assert.deepEqual(splitOutside('echo "#x" && b', SEP2), ['echo "#x"', 'b'], 'a quoted # is not a comment: the && still splits');
  assert.deepEqual(splitOutside('echo a#b && c', SEP2), ['echo a#b', 'c']);
});

test('RED CHECK: the separator handed back is the real one, not a constant — different separators in one command come back different', () => {
  const seps = segmentsOutside('a && b || c; d', SEP).map((s) => s.sep);
  assert.deepEqual(seps, [' && ', ' || ', '; ', '']);
  assert.notEqual(seps[0], seps[1]);
});
