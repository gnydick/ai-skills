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
import { isRead } from './classify.mjs';
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
// A redirect is the exception to "the token after an operator heads a command" (#162). It ends the
// command as every operator does, but what follows it is a FILE, not a command name, and a head is
// kept as written — so until #162 one tool took a fresh key for every file it wrote to. Measured in
// ferrislicer's record, 2026-09-21: 28 `cargo test … > target` keys, 16 shapes. The operator itself
// stays in the key, because a redirected run and a bare run really are two shapes, and it stays
// WHERE IT WAS WRITTEN, because the order of the redirects decides which stream reaches the
// runner's pipe (#160). Old keys are not migrated; they age out (ticket requirement 5).
const REDIRECT = /^(?:>>?|<<?)$/;
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

// ---- The identity head (#164) ----
//
// The owner's ruling, 2026-09-21, verbatim: "i meant it to be the glob, but with type correctness";
// which glob — "Loose: flags are variation"; and the head of a command with no subcommand —
// "Command + first positional". One rule covers both: THE IDENTITY HEAD IS THE COMMAND NAME PLUS
// ITS FIRST POSITIONAL TOKEN. `cargo test -p x` heads at `cargo test`, `node scripts/x.mjs check`
// at `node scripts/x.mjs`, `gh issue create` at `gh issue`, `bash run.sh` at `bash run.sh`.
//
// Why the generalized form could not stay the key. It kept every flag NAME literal and the lookup
// was string equality over it, so two runs of one tool shared a record only when their flags were
// identical. Measured in ferrislicer's record, 2026-09-21: `cargo test` ran 27 times and became 27
// keys; 60 of 67 cargo keys were seen exactly once. GRADUATION_AGREEMENTS is 2 consecutive
// agreements on ONE key (lib/training.mjs), so no cargo subcommand could ever have graduated. Under
// the head those 27 are one record with 27 runs.
//
// The first positional is kept AS WRITTEN, never typed. That is what makes the head a literal
// leading run of the command, which is the property graduation needs: the head is also the `prefix`
// a learned entry matches on, by startsWith (lib/graduate.mjs). `bash run.sh` and `bash ../run.sh`
// are therefore two heads — normalising the script token would produce a string no command starts
// with, and there is no rule inside `placeholder()` that could say which of two spellings is the
// canonical one.
//
// A FLAG CLOSES THE HEAD. This is the one place the implementation departs from required behaviour
// 1's letter ("the first token after the command that is not a flag and not an operator"), and it
// is behaviour 7 that forces it: measured on `python -m pytest tests/ -q`, where `-m` takes
// `pytest` as its operand, so the first token that is neither flag nor operator is `tests/` and the
// literal rule yields the head `python tests/` — a string the command does not start with, which
// breaks the prefix invariant AND fragments the record by test directory. Closing at the flag gives
// `python`, which is a collapse, and collapse is the visible, self-limiting direction (#87: picks
// that never agree keep training open, where fragmentation is silent). Every example the ticket
// names is unaffected — `cargo test -p x`, `node scripts/x.mjs check`, `gh issue create`,
// `git commit -m x`, `bash run.sh`, `sh .githooks/pre-commit` all head exactly as it says.
const headOf = (seg) => seg.head.join(' ');
// Which segment of a compound the head comes from: the first one that is not a byte-mover (ruling
// C1, #87, unchanged — `cd /x && cargo test -p a` heads at `cargo test`, never at `cd`). isRead()
// is classify.mjs's, the authority that owns the byte-mover list, asked rather than re-spelled. A
// command that is byte-movers all the way down writes no record at all, so its head is moot; it
// falls back to its first segment rather than to the empty string, which would be a key.
const workDoing = (segs) => segs.find((s) => !isRead(s.text.join(' '))) ?? segs[0];

// The derivation, and the one place it happens. Returns the identity head — which is both the key
// and the literal leading run a graduated entry matches on, one string for one fact — together with
// `full`, the generalized form the key used to be. They come out of ONE walk, because a second walk
// would eventually disagree with the first.
//
// `full` survives the key change because it is still two things: the SHAPE of a run (flags,
// targets and redirect order, which #160 and #162 made matter for measurement but which required
// behaviour 4 keeps out of identity), and the typed glob that a record written before this ticket
// is keyed on — see keyMatches() below, which is how those records keep being read while they age
// out (required behaviour 9: no migration).
//
// A malformed, empty, or half-quoted command is data, never a crash: tokens() runs an unterminated
// span to the end of the string, and every branch below is total over whatever comes out.
export function generalize(command) {
  const toks = tokens(command);
  const out = [], segs = [];
  let seg = null;
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (OPERATOR.test(tok)) {
      if (seg) out.push(render(seg));
      out.push(tok); seg = null;
      // A redirect takes the token after it as its own operand, typed like any other value, so the
      // target never heads a segment and never survives verbatim (#162).
      const target = toks[i + 1];
      if (REDIRECT.test(tok) && target !== undefined && !OPERATOR.test(target)) { out.push(placeholder(target)); i++; }
      continue;
    }
    if (!seg) {
      // The head is the command's own name and is always kept as written.
      seg = { runner: GENERIC_RUNNERS.has(tok.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase()), identity: false, depth: 0, parts: [tok], flags: [], head: [tok], headOpen: true, text: [tok] };
      segs.push(seg);
      continue;
    }
    seg.text.push(tok);
    if (isFlag(tok)) {
      seg.headOpen = false;
      const eq = tok.indexOf('=');
      if (eq > 0) { seg.flags.push(`${tok.slice(0, eq)}=${valueOf(seg, tok.slice(eq + 1), false)}`); continue; }
      // `--` is the end-of-flags marker, not a parameter, so it takes no operand of its own.
      const next = toks[i + 1];
      if (tok !== '--' && next !== undefined && !OPERATOR.test(next) && !isFlag(next)) { seg.flags.push(`${tok} ${valueOf(seg, next, false)}`); seg.text.push(next); i++; }
      else seg.flags.push(tok);
      continue;
    }
    // The first positional closes the head, and nothing after it is identity.
    if (seg.headOpen) { seg.head.push(tok); seg.headOpen = false; }
    seg.parts.push(valueOf(seg, tok, true));
  }
  if (seg) out.push(render(seg));
  const head = segs.length ? headOf(workDoing(segs)) : '';
  return { key: head, prefix: head, full: out.join(' ') };
}

// The SHAPE of a run: the command, its flag NAMES as written, every value a typed placeholder, the
// flags alphabetized, the redirects where they were typed. Identity since #87 and until #164; a
// run's shape, and the typed glob old records are keyed on, since.
export const generalizedForm = (command) => generalize(command).full;
// The key a bespoke tool is recorded under IS its identity head (#164). `cargo test --workspace`
// and `cargo test -p x` are one record with two runs; a catalog entry, when one matches, still wins
// over this entirely (matchTool(), required behaviour 6).
export const bespokeKey = (command) => generalize(command).key;

// Whether a record key CLAIMS this command — the typed glob, and the reason decide() looks a record
// up by this rather than by string equality (required behaviour 2). Two ways a key can claim:
//
//   the head — the key written since #164; everything after it is variation inside the tool, so the
//   key is a glob with one open tail slot and any command with this head fits it;
//
//   the full generalized form — the key written BEFORE #164, which holds typed slots. It claims
//   only the commands that FIT those slots: `gh issue edit %d` claims `gh issue edit 59` and not
//   `gh issue edit main`, because generalizing the command is what tests each token against the
//   slot's type. Type correctness is therefore the derivation itself, not a second spelling of it.
//
// This is what lets old records keep being read with no migration (required behaviour 9). Nothing
// ever WRITES a full-form key again, so an old record stops being reached the moment the head
// record exists, and ages out.
export function keyMatches(recordKey, command) {
  const { key, full } = generalize(command);
  return recordKey === key || recordKey === full;
}

// The key in this record that claims the command, preferring the one this version writes. Returns
// the head when nothing claims it, so a caller always has the key a new record goes under.
export function recordKeyFor(observations, command) {
  const { key, full } = generalize(command);
  if (Object.hasOwn(observations, key)) return key;
  if (full !== key && Object.hasOwn(observations, full)) return full;
  return key;
}

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
    // A bare run that put OUTPUT on the runner's pipes IS the tool's natural noise level.
    : lineCount > 0 ? { noisy: lineCount > PASS_THROUGH_LINES, lines: lineCount, stdoutLines, stderrLines }
    // A ZERO-LINE run is not. Owner's ruling, 2026-09-21 (#164): a run whose redirect or filter left
    // nothing for the runner to see is still OBSERVED — it joins the shape history, #160 stands —
    // but it does not decide `noisy`. Identity collapsed to the head that day, so `cargo test >
    // out.txt 2>&1` and a bare `cargo test` are ONE record; letting the redirected run write
    // `noisy: false` marked the tool quiet, assimilate.mjs routes a quiet record to `plain`, and the
    // next bare `cargo test` with 300 lines then ran unwrapped. The earlier reading — "what the
    // record says about an empty pipe is true, not a gap" (#160) — was honest while every redirect
    // shape had a key of its own; under the head it lets one run's plumbing silence another's.
    //
    // So the previous bare measurement carries forward exactly as it was, INCLUDING when there is
    // none: defined() drops an absent `noisy`, and absence is the unseen state decide() observes.
    // A record whose every run is 0 lines therefore never leaves that state.
    : { noisy: prev.noisy, lines: prev.lines, stdoutLines: prev.stdoutLines, stderrLines: prev.stderrLines };
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
