// The per-project observation record: what this project's tools actually did when they ran here,
// and which quiet candidate has already been tried on each. Story:
// specs/2026-09-04-tool-assimilation-design.md ("The ledger"). Loading, saving and recording only —
// matching a command to a catalog entry is catalog.mjs's job, deciding what to keep is filter.mjs's.
//
// One threshold decides noisy, and it is filter.mjs's PASS_THROUGH_LINES, imported rather than
// restated: a second copy here would drift and the record would disagree with the filter that
// produced the lines it counted.
import fs from 'node:fs';
import path from 'node:path';
import { PASS_THROUGH_LINES } from './filter.mjs';
import { ensureIgnored, OBSERVATIONS_IGNORE } from './ignore.mjs';
import { tokens } from './quotes.mjs';

const recordFile = (root) => path.join(root, ...OBSERVATIONS_IGNORE.split('/'));

// A missing, truncated or hand-edited record is data, not a broken invariant: it loads as empty
// and the project simply starts observing again.
export function loadObservations(root) {
  try { return JSON.parse(fs.readFileSync(recordFile(root), 'utf8')); } catch { return {}; }
}

// Writes the record. This is the site that creates the file in a project the first time a wrapped
// command runs there — before any install has had the chance — so it is the site that ensures the
// ignore entry (final review I6; ruling 2026-09-05: per-machine measurement, never tracked). Returns
// whether the .gitignore line was written this time, so the caller can say so exactly once.
export function saveObservations(root, obs) {
  const p = recordFile(root);
  const created = !fs.existsSync(p);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obs, null, 2) + '\n');
  return created && ensureIgnored(root, OBSERVATIONS_IGNORE);
}

// ---- The generalized command form (#87) ----
//
// A bespoke tool's key is its command line GENERALIZED: the command, its subcommands and its flag
// NAMES kept as written, every argument VALUE replaced by a typed placeholder, and the flags
// alphabetized so the order they were typed in cannot make a second record. The shape is the
// owner's, 2026-09-07: "command plus alphabetized list of params with values with placeholders like
// `gh --a_param %d --b_param %f --c_param %s`".
//
// Why: a record is keyed by command LINE, not by tool, and that is the design — "command lines are
// unique, not tools. so there can be as many entries for a command as there are variants" (owner,
// 2026-09-07). A variant that recurs accumulates and can graduate; one that never recurs was never
// worth learning. What that does not cover is a tool whose variants are UNBOUNDED — `gh issue edit
// 59`, `60`, `61` — where every invocation is a fresh key, no history ever forms, and an answer
// line identical across all of them is re-learned from scratch forever. Measured here on
// 2026-09-07: 60 entries, 59 seen exactly once, 0 picks, 0 graduations.
//
// This is a heuristic and is meant to be one — "this where heuristics are a feature, not a
// replacement for something exact and deterministic" (owner, same day). Nothing exact is
// recoverable from a command string. The invariant is not that the key is right; it is that a wrong
// key cannot silently persist, which the training loop already carries: a matcher that stops
// matching re-opens training.
//
// WHICH WAY TO BE WRONG, because the two failure modes are not symmetric. COLLAPSE — two tools at
// one key — surfaces as picks that never agree, so the tool never graduates and training stays
// open: noisy, visible, self-limiting, and the detector already exists. FRAGMENTATION — one tool
// across many keys — produces SILENCE: a key seen once, no picks, nothing to notice; it hid here
// for days and was found only by counting. So where a token's role is unsure, this prefers a
// placeholder to preserving a distinction of doubtful value.

// After a generic runner the first value-shaped token is the tool's IDENTITY, not a parameter (#15
// requirement 2): `node scripts/bump.mjs` and `node scripts/install.mjs` are two tools, and `node
// %p` would merge every script in a project into one record. The runner's own name carries no
// identity at all, which is what makes it the exception rather than a special case.
export const GENERIC_RUNNERS = new Set([
  'bash', 'sh', 'zsh', 'dash', 'ksh', 'node', 'npx', 'deno', 'bun',
  'python', 'python2', 'python3', 'ruby', 'perl', 'pwsh', 'powershell',
]);
// A compound is a sequence of commands, so an operator ends one and the token after it heads the
// next: its own runner check, its own subcommand budget, its own alphabetized flags.
const OPERATOR = /^(?:&&|\|\||[|;&]|>>?|<<?)$/;
const INT = /^[+-]?\d+$/;
const FLOAT = /^[+-]?(?:\d+\.\d*|\.\d+|\d+(?:\.\d+)?[eE][+-]?\d+)$/;
// Path-shaped: a separator either way round, a home or relative lead, a bare drive, or a filename
// extension. Absolute paths carrying a session-scoped temporary directory are the largest single
// source of unrepeatable keys in the measured record, and they all land here.
const PATHISH = /[\\/]|^~|^\.\.?$|^[A-Za-z]:$|\.[A-Za-z0-9]{1,8}$/;
// A bare word: a subcommand, not a value. `issue` and `edit` in `gh issue edit 59`.
const WORD = /^[A-Za-z][A-Za-z0-9_-]*$/;
// How deep a subcommand path is taken to go. `gh issue edit`, `git remote add`, `npm run build` —
// the convention is a group and a verb. Past that a bare positional is read as a VALUE, which is
// what collapses `gh label create blocked` and `gh label create deployment-isolation` into one
// record rather than one each, forever.
const SUBCOMMAND_DEPTH = 2;

// A value's TYPE only, never its precision or width: `%f0.2` would fragment again on the next
// value, which is the defect this exists to fix (#87 required behaviour 4).
// A token that is ALREADY a placeholder stands for itself, so the derivation is idempotent: a key
// fed back through it — a log filtered by key, a record read and re-keyed — comes out unchanged
// rather than degrading one type at a time into `%s`.
const PLACEHOLDER = /^%[dfps]$/;
const placeholder = (tok) => (PLACEHOLDER.test(tok) ? tok : INT.test(tok) ? '%d' : FLOAT.test(tok) ? '%f' : PATHISH.test(tok) ? '%p' : '%s');
const isFlag = (tok) => tok.length > 1 && tok.startsWith('-') && !/\s/.test(tok);

// What one token becomes. `positional` is false for a flag's own operand, which is always a value:
// a flag's name is structure and its operand never is. So `--label bug` cannot spend the subcommand
// budget that `gh issue edit` needs, and the runner exception is the FIRST POSITIONAL only, exactly
// as #15 requirement 2 states it — `node -e "…"` carries a one-off script, not an identity, and
// `python -m pytest` collapsing with `python -m http.server` is collapse, the visible direction.
function valueOf(seg, tok, positional) {
  if (positional && seg.runner && !seg.identity) { seg.identity = true; return tok; }
  if (positional && WORD.test(tok) && seg.depth < SUBCOMMAND_DEPTH) { seg.depth++; return tok; }
  return placeholder(tok);
}

// Consecutive identical placeholders are one: how MANY same-typed values were passed is not what
// tells two tools apart, and `git add a.mjs b.mjs` keying differently from `git add a.mjs` is the
// fragmentation this whole derivation exists to remove.
const collapseRuns = (parts) => parts.filter((p, i) => !(p.startsWith('%') && p === parts[i - 1]));

// The alphabetized parameters go after the positionals, and an identical parameter written twice is
// written once: both are order and count, neither is identity.
const render = (seg) => [...collapseRuns(seg.parts), ...[...new Set(seg.flags)].sort()].join(' ');

// The derivation, and the one place it happens. Returns BOTH the key and the literal leading run of
// the command it came from, because they are one walk and a second walk would eventually disagree
// with the first. The `prefix` is what a graduated catalog
// entry matches on: the key now holds placeholders, so it is no longer a prefix of any command, and
// an entry built from it would match nothing forever. It closes at the first token this derivation
// did NOT keep verbatim — the first placeholder, the first flag, or the first operator — so it is
// always a literal head of the real command line.
//
// A malformed, empty, or half-quoted command is data, never a crash: tokens() runs an unterminated
// span to the end of the string, and every branch below is total over whatever comes out.
export function generalize(command) {
  const toks = tokens(command);
  const out = [], prefix = [];
  let seg = null, prefixOpen = true;
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (OPERATOR.test(tok)) {
      if (seg) out.push(render(seg));
      out.push(tok); seg = null; prefixOpen = false;
      continue;
    }
    if (!seg) {
      // The head is the command's own name and is always kept as written.
      seg = { runner: GENERIC_RUNNERS.has(tok.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase()), identity: false, depth: 0, parts: [tok], flags: [] };
      if (prefixOpen) prefix.push(tok);
      continue;
    }
    if (isFlag(tok)) {
      prefixOpen = false;
      const eq = tok.indexOf('=');
      if (eq > 0) { seg.flags.push(`${tok.slice(0, eq)}=${valueOf(seg, tok.slice(eq + 1), false)}`); continue; }
      // `--` is the end-of-flags marker, not a parameter, so it takes no operand of its own.
      const next = toks[i + 1];
      if (tok !== '--' && next !== undefined && !OPERATOR.test(next) && !isFlag(next)) { seg.flags.push(`${tok} ${valueOf(seg, next, false)}`); i++; }
      else seg.flags.push(tok);
      continue;
    }
    const part = valueOf(seg, tok, true);
    if (part === tok && prefixOpen) prefix.push(tok); else prefixOpen = false;
    seg.parts.push(part);
  }
  if (seg) out.push(render(seg));
  return { key: out.join(' '), prefix: prefix.join(' ') };
}

export const generalizedForm = (command) => generalize(command).key;
// The key a bespoke tool is recorded under IS its generalized form. `cargo test --workspace` and
// `cargo test -p x` collapse under a single catalog id via matchTool() instead; this handles what
// has no entry.
export const bespokeKey = (command) => generalize(command).key;

// The key a run is recorded under and — inseparably — HOW it was derived. Both derivation sites
// (quiet-run.mjs's runner, train-tool.mjs's identify and logs) already hold the answer matchTool()
// gave them, so it is handed in rather than asked for a second time, which could answer
// differently; this is the one place that turns it into the pair, so the two sites
// can no longer derive the key differently.
//
// Why a pair and not the bare string: the id a bespoke key sanitizes to can COINCIDE with an
// existing learned entry's id without that entry having matched the command at all — `./a.sh`
// graduates to the id `a.sh`, and a later `a.sh --x`, which that entry does NOT match, keys on
// `a.sh` too. `matched` is the only thing that separates "this tool again" from "a different tool
// at the same string", and lib/graduate.mjs cannot recover it from the key. Both halves are read
// off one normalized `id`, so they cannot disagree, and the pair carries a brand no other module
// can forge: a caller cannot hand the graduation gate a `matched` it did not get from matchTool()
// — the distinguishing value is created at the one authority that reads the source of truth.
//
// The pair carries a third thing since #87: `prefix`, the literal leading run of THIS command, from
// the same walk that made the key. A generalized key holds placeholders, so it is a prefix of
// nothing; graduation needs a `match` that the commands it was learned from actually start with,
// and deriving one from the key is not possible — it has to come from the command, at the one site
// that already reads it.
const TOOL_KEY = Symbol('toolKey');
export function toolKey(toolId, command) {
  const id = toolId ?? null;
  const { key, prefix } = generalize(command);
  return Object.freeze({ [TOOL_KEY]: true, key: id ?? key, matched: id !== null, prefix });
}
export const isToolKey = (v) => !!v && typeof v === 'object' && v[TOOL_KEY] === true;

// Fields with no value are left out rather than written as `undefined`: JSON drops an explicit
// undefined, so writing one would make the record in memory a different shape from the record that
// comes back off disk, and anything testing for a field's presence would read the two differently.
const defined = (fields) => Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

export function recordRun(obs, key, { identity, lineCount, stdoutLines, stderrLines, candidate, outcomeSurvived = true }) {
  const prev = obs[key] ?? { ledger: {} };
  const measured = candidate
    // A trial run measures whether THIS flag helps. It says nothing about the bare tool's own
    // noise level, which carries forward exactly as it was — INCLUDING when there is none yet. A
    // trial before any bare run leaves `noisy` absent (defined() drops it): absence is the signal
    // that the bare tool was never measured, and decide() reads it as unseen. `?? false` here was
    // a stand-in value that parked the tool in plain forever (final review I3).
    ? { noisy: prev.noisy, lines: prev.lines, stdoutLines: prev.stdoutLines, stderrLines: prev.stderrLines }
    // A bare run IS the tool's natural noise level.
    : { noisy: lineCount > PASS_THROUGH_LINES, lines: lineCount, stdoutLines, stderrLines };
  // The training loop's sub-record (lib/training.mjs) rides on the same entry and is nobody's
  // business here: carried forward exactly as it was when present, absent when it was absent. A
  // record rebuilt without it would silently reset a tool's training on every run.
  const entry = { ...defined({ identity, ...measured }), ledger: { ...prev.ledger }, ...(prev.training === undefined ? {} : { training: prev.training }) };
  // Sufficient means BOTH quiet enough AND the tool still said something. A flag that drops the
  // line count by deleting the tool's own answer is not a fix, it's a worse failure mode — measured
  // on `git commit --quiet` and `npm install --silent`, which print nothing at all. outcomeSurvived
  // defaults to true, so a tool with no declared outcome pattern to lose is judged on line count
  // alone; the bare branch above never reads it.
  if (candidate) entry.ledger[candidate] = (lineCount <= PASS_THROUGH_LINES && outcomeSurvived) ? 'sufficient' : 'insufficient';
  return { ...obs, [key]: entry };
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// The training loop's own sub-record, written by the runner (noteRun / reopen) and by train-tool.mjs
// (identify). Set on a record that exists, or on the minimal record when none does — a pick can land
// before the runner has ever measured the tool here (batch identification over a stored log), and
// that record must not invent a `noisy`: absence stays the signal decide() reads as unseen.
export const withTraining = (obs, key, training) => ({ ...obs, [key]: { ...(isObject(obs[key]) ? obs[key] : { ledger: {} }), training } });

// Renames a record: graduation gives a bespoke tool a catalog id, and the measurement made under the
// bespoke key follows it rather than being taken again. Nothing to move returns obs itself.
export function moveRecord(obs, from, to) {
  if (!(from in obs)) return obs;
  const { [from]: rec, ...rest } = obs;
  return { ...rest, [to]: rec };
}
