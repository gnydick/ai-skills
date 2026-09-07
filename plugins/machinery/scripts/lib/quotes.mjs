// The one definition of a quoted span in a shell-like command line (issue #11;
// rules/design-invariants.md § Never re-derive a fact). Two readers: catalog.mjs's tokens(), which
// keeps a span inside one argv token, and classify.mjs's segment splitter, which must not split on
// a `&&` or `;` that sits inside one. Before this file each carried a scanner of its own and they
// disagreed — `echo "a && b"` was one token to the first and two segments to the second. A unit with
// no dependencies of its own, so either reader can import it without paying for the other; and
// catalog.test.mjs scans the source tree for a second `ch === '"'` loop, because moving this back
// out compiles perfectly.
//
// The rule, in full: a single or double quote outside a span opens one; the same character closes
// it; the other quote character inside a span is data; an unterminated span runs to the end of the
// command — that is data, not a crash. No backslash escapes, no `$(...)`, no heredocs: this is not
// a shell parser and does not try to be. Good enough to tell an argument from a flag and a real
// separator from a quoted one, which is all either reader needs.
//
// A comment is a span too (#13 fix round 2, controller's ruling after re-review, 2026-09-05: the
// splitter cut `echo "a" ; # comment && node -e …` inside the comment and the commented-out node
// ran). A `#` that begins a word — at the start of the command, or after whitespace or a separator
// character, and outside a quoted span — opens a comment that runs to the next newline or the end.
// Every code unit inside it is COMMENT: not OUTSIDE, so the splitter sees no separator there and
// the tokeniser makes no token of it; and not INSIDE either, because it is not data for anyone.
// The newline that ends it is OUTSIDE — it is the separator the splitter needs to see. A `#` inside
// a word (`a#b`, `$#`) is an ordinary character, as it is to the shell.

export const OUTSIDE = 0; // an ordinary code unit, outside every span
export const DELIM = 1;   // the quote character that opens or closes a span
export const INSIDE = 2;  // a code unit inside a span: data whatever it is
export const COMMENT = 3; // a code unit inside a # comment: not data, not a separator, not a token

// One state per UTF-16 code unit of `command`, so a reader can slice the original string at
// positions taken from here. Quotes and `#` are ASCII, so code units and code points agree on every
// position that matters.
const WORD_START = /[\s;&|()]/;
export function quoteStates(command) {
  const states = new Array(command.length);
  let quote = null, comment = false;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (comment) { if (ch === '\n') { comment = false; states[i] = OUTSIDE; } else states[i] = COMMENT; continue; }
    if (quote) { states[i] = ch === quote ? (quote = null, DELIM) : INSIDE; continue; }
    if (ch === '"' || ch === "'") { quote = ch; states[i] = DELIM; continue; }
    if (ch === '#' && (i === 0 || WORD_START.test(command[i - 1]))) { comment = true; states[i] = COMMENT; continue; }
    states[i] = OUTSIDE;
  }
  return states;
}

// `command.split(separator)`, with three differences. A match may not start, end or reach inside a
// span: the separator runs over a copy in which every non-OUTSIDE code unit is replaced by FILL,
// and the pieces are cut from the original at the positions found there. An empty match is
// skipped, never a boundary, where String.split would cut between every character. And a capture
// group in the separator is never spliced into the result, where String.split would insert each
// group between the pieces. FILL is a control character no separator names — `\s` does not match
// it, and a separator written with `.` would be wrong here anyway. The quote characters stay in
// the pieces: a reader that wants them stripped wants tokens.
const FILL = '\u0001';
// Each piece comes back with the separator that FOLLOWED it, exactly as matched — spacing and all —
// and the last piece's is ''. The quiet hook wraps each segment of a compound on its own and
// rebuilds the command around the ones it wrapped (issue #13), so `text + sep` over this list has
// to give the original back byte for byte. splitOutside() below is this list with the separators
// dropped: one loop, one definition of where a piece ends, so the two readers cannot disagree.
// The command with every code unit that is not OUTSIDE replaced by FILL: what a reader sees when it
// asks about the shell's own syntax and nothing inside a span may answer. The splitter runs its
// separator over it; classify.mjs's simple-command predicate counts brackets and looks for a
// heredoc operator on it (#13 fix round 1). One builder, so no reader re-derives the mask.
export function maskOutside(command) {
  const states = quoteStates(command);
  let mask = '';
  for (let i = 0; i < command.length; i++) mask += states[i] === OUTSIDE ? command[i] : FILL;
  return mask;
}
export function segmentsOutside(command, separator) {
  const mask = maskOutside(command);
  const flags = separator.flags.includes('g') ? separator.flags : separator.flags + 'g';
  const pieces = [];
  let last = 0;
  for (const m of mask.matchAll(new RegExp(separator.source, flags))) {
    if (m[0] === '') continue;
    pieces.push({ text: command.slice(last, m.index), sep: m[0] });
    last = m.index + m[0].length;
  }
  pieces.push({ text: command.slice(last), sep: '' });
  return pieces;
}
export const splitOutside = (command, separator) => segmentsOutside(command, separator).map((s) => s.text);

// The command's argv, as the shell would see it, near enough: whitespace-split, with a single- or
// double-quoted span kept inside one token and its quotes stripped. A quote opens a span wherever it
// sits in the token, not only at its start (re-review R3: `-m"do not --quiet me"` used to split as
// `-m"do`, `not`, `--quiet`, `me"`, and a flag inside a commit message was recorded as applied). An
// unterminated span runs to the end of the command — that is data, not a crash. Good enough to tell
// an argument from a flag, which is all any caller needs; it is not a shell parser and does not try
// to be. It lives here, beside the span definition it reads, rather than in any one reader (issue
// #11): catalog.mjs's matchedCandidate() and observations.mjs's generalizedForm() both take their
// argv from it, so no reader can grow a splitter of its own and disagree with the other.
// A `#` comment is a span there as well (#13 fix round 2), and a word inside it is no token: a flag
// named in a trailing comment was never applied.
export function tokens(command) {
  const states = quoteStates(command);
  const out = [];
  let token = '', inToken = false;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (states[i] === COMMENT) continue;
    if (states[i] === DELIM) { inToken = true; continue; }
    if (states[i] === INSIDE) { token += ch; continue; }
    if (/\s/.test(ch)) { if (inToken) out.push(token); token = ''; inToken = false; continue; }
    token += ch; inToken = true;
  }
  if (inToken) out.push(token);
  return out;
}
