// The single authority for one question: does this fixture PROVE that this catalog entry's
// outcome pattern survives filtering? That is the design's Verification 7 — "an entry with no
// fixture is not an entry" — and the point of the standard is the proof, not the file's presence.
//
// Two callers, one derivation (rules/design-invariants.md § Never re-derive a fact):
//   - test/catalog.test.mjs enforces it over every entry already in the universal catalog;
//   - scripts/promote-tool.mjs enforces it at the one gate where a project's own entry crosses
//     into that catalog, so an entry the suite would reject can never land in the first place.
// Split in two, the gate and the suite would eventually disagree, and the disagreement would
// arrive as a permanently red suite nobody could attribute.
//
// Returns a list of problems, empty when the fixture proves it. It never throws on a malformed
// fixture: the project half of this data is hand-editable, so a bad shape is a diagnostic
// (rules/design-invariants.md § External input).
import { select, TAIL_LINES } from './filter.mjs';

// Lines are quoted into diagnostics with backticks, not JSON.stringify: spec I19 bans
// JSON.stringify anywhere under scripts/ but lib/emit.mjs and the declared file-writers, and this
// file is neither — it serialises nothing. Taking an exemption it could not honestly satisfy would
// weaken the one-hook-JSON-writer proxy for the sake of quoting a string.

// select() keeps the last TAIL_LINES lines unconditionally, so a short fixture's outcome line
// survives whatever its declaration says — the check would pass with no declaration at all.
// bury() appends CHATTER (which the tail rule itself discards) to push the answer lines out of
// that window, so a keep is attributable to a rule that actually looked at the line.
export const bury = (lines) => [...lines, ...Array.from({ length: TAIL_LINES + 4 }, (_, i) => `   Compiling crate${i} v0.1.0`)];

// The per-entry contract from the design's Verification 7.
//
// The fixture names its own answer lines, in `answers`, as indices a person read off the recorded
// runs — NEVER found by applying the outcome pattern, which would make the check test itself. That
// is what carries the weight: EVERY declared answer must match, so a fixture only has to include a
// form the pattern gets wrong for the wrong pattern to go red. A check that searched for the first
// matching line instead would pass on a fixture whose first run happens to suit both patterns, and
// silently prove nothing about the rest.
//
// The survival assertions pin select()'s contract — that an outcome match is kept unconditionally,
// and not merely because it landed in the tail window. That an outcome match survives is true by
// construction while select() keeps what it matches; it is a regression guard on that contract,
// not proof the declaration is what saved the line. catalog.test.mjs proves that separately.
export function survivalProblems(id, entry, fixture) {
  const problems = [];
  const bad = (m) => problems.push(`${id}: ${m}`);

  // Structural checks first: nothing below can run without lines, answers and a usable pattern,
  // so these return rather than accumulate, and a hand-edited file gets one clear reason.
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) { bad('the fixture is not a JSON object'); return problems; }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { bad('the catalog entry is not a JSON object'); return problems; }
  const { lines, answers } = fixture;
  if (!Array.isArray(lines) || lines.length === 0 || lines.some((l) => typeof l !== 'string')) { bad('the fixture has no `lines` array of recorded output'); return problems; }
  if (!Array.isArray(answers) || answers.length === 0) { bad('fixture declares no answer lines — it proves nothing'); return problems; }
  if (typeof entry.outcome !== 'string' || entry.outcome === '') { bad('the catalog entry declares no `outcome` pattern'); return problems; }
  let outcome;
  try { outcome = new RegExp(entry.outcome); } catch (e) { bad(`the \`outcome\` pattern is not a valid regular expression: ${e.message}`); return problems; }

  const buried = bury(lines);
  const keptPlain = select(lines, outcome), keptBuried = select(buried, outcome);
  for (const i of answers) {
    if (!Number.isInteger(i) || i < 0 || i >= lines.length) { bad(`declared answer index ${i} is not a line of this fixture`); continue; }
    if (!outcome.test(lines[i])) bad(`the outcome pattern does not match a line this tool really emits: \`${lines[i]}\``);
    if (!keptPlain.has(i)) bad(`answer line ${i} did not survive select()`);
    if (!(buried.length - i > TAIL_LINES)) bad(`answer line ${i} is still inside the unconditional tail window`);
    if (!keptBuried.has(i)) bad(`answer line ${i} did not survive select() once outside the tail window`);
  }
  // The pattern is not allowed to be so wide it swallows the tool's ordinary chatter: nothing the
  // fixture did NOT declare an answer may match it. This is what stops a wrong pattern being
  // "fixed" by widening it until everything matches. Checked before the assertion below, because a
  // pattern that matches every line would otherwise be reported as select() keeping too much.
  lines.forEach((line, i) => {
    if (!answers.includes(i) && outcome.test(line)) bad(`the outcome pattern also matches a non-answer line ${i}: \`${line}\``);
  });
  if (!(keptBuried.size < buried.length)) bad('select() kept every line — "it survived" would prove nothing here');
  return problems;
}
