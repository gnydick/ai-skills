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

export const OUTSIDE = 0; // an ordinary code unit, outside every span
export const DELIM = 1;   // the quote character that opens or closes a span
export const INSIDE = 2;  // a code unit inside a span: data whatever it is

// One state per UTF-16 code unit of `command`, so a reader can slice the original string at
// positions taken from here. Quotes are ASCII, so code units and code points agree on every
// position that matters.
export function quoteStates(command) {
  const states = new Array(command.length);
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) { states[i] = ch === quote ? (quote = null, DELIM) : INSIDE; continue; }
    if (ch === '"' || ch === "'") { quote = ch; states[i] = DELIM; continue; }
    states[i] = OUTSIDE;
  }
  return states;
}

// `command.split(separator)`, except that a match may not start, end or reach inside a span: the
// separator runs over a copy in which every non-OUTSIDE code unit is replaced by FILL, and the
// pieces are cut from the original at the positions found there. FILL is a control character no
// separator names — `\s` does not match it, and a separator written with `.` would be wrong here
// anyway. The quote characters stay in the pieces: a reader that wants them stripped wants tokens.
const FILL = '';
export function splitOutside(command, separator) {
  const states = quoteStates(command);
  let mask = '';
  for (let i = 0; i < command.length; i++) mask += states[i] === OUTSIDE ? command[i] : FILL;
  const flags = separator.flags.includes('g') ? separator.flags : separator.flags + 'g';
  const pieces = [];
  let last = 0;
  for (const m of mask.matchAll(new RegExp(separator.source, flags))) {
    if (m[0] === '') continue;
    pieces.push(command.slice(last, m.index));
    last = m.index + m[0].length;
  }
  pieces.push(command.slice(last));
  return pieces;
}
