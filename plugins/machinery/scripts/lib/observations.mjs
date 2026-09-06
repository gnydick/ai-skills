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

// A bespoke tool's key is its LEADING non-flag tokens — the command with every argument stripped,
// stopping at the first flag. Everything from that flag onward is argument, including a flag's own
// value, which carries no dash of its own: `--jobs 4` would otherwise leave `4` in the key and give
// one tool two records. `cargo test --workspace` and `cargo test -p x` collapse under a single
// catalog id via matchTool() instead; this handles what has no entry.
export function bespokeKey(command) {
  const tokens = command.trim().split(/\s+/);
  const firstFlag = tokens.findIndex((tok) => tok.startsWith('-'));
  return (firstFlag === -1 ? tokens : tokens.slice(0, firstFlag)).join(' ');
}

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
