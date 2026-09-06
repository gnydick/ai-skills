#!/usr/bin/env node
// plugins/machinery/scripts/train-tool.mjs
// The session's half of the training loop. Story: the design's "The model in the loop is the
// session": the wrapper records a run and nudges; the assistant, in a turn it was already having,
// reads the run's log and says which line is the answer — `identify` — and this script does the rest
// with arithmetic (lib/training.mjs) and the graduation gate (lib/graduate.mjs). No inference
// happens here and no hook waits on this. `logs` lists stored run logs, so identification can also
// happen in batch over runs that already happened.
//
//   node train-tool.mjs identify --log <run log> --line <N> [--root <project>]
//   node train-tool.mjs logs [--key <key>]
//
// N is the log FILE's own line number, as a Read of it shows: line 1 is `$ <command>`.
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog, matchTool, isLearned } from './lib/catalog.mjs';
import { loadObservations, saveObservations, bespokeKey, withTraining } from './lib/observations.mjs';
import { parseRunLog, linesOf, listRunLogs, logDir } from './lib/runlog.mjs';
import { trainingOf, identify, GRADUATION_AGREEMENTS } from './lib/training.mjs';
import { graduate } from './lib/graduate.mjs';

const argv = process.argv.slice(2);
const sub = argv[0];
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const say = (s) => process.stdout.write(s + '\n');
const die = (m) => { process.stderr.write(`train-tool: ${m}\n`); process.exit(1); };
const usage = () => { process.stderr.write('usage: train-tool.mjs identify --log <run log> --line <N> [--root <project>]\n       train-tool.mjs logs [--key <key>]\n'); process.exit(2); };

// A log is external input: missing, unreadable or malformed is a diagnostic, never a stack trace
// (rules/design-invariants.md § External input).
function readLog(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) { return die(e.code === 'ENOENT' ? `no run log at ${file}` : `cannot read ${file}: ${e.message}`); }
  try { return parseRunLog(text); } catch (e) { return die(`${file}: ${e.message}`); }
}
// The key exactly as the runner derives it for the same command — one derivation, so the pick lands
// on the record the runner writes to, and a graduated tool is found under its learned id.
const keyOf = (command, catalog) => matchTool(command, catalog) ?? bespokeKey(command);

function identifyCmd() {
  const file = opt('--log'), n = Number(opt('--line'));
  if (!file || !Number.isInteger(n)) return usage();
  const { command, records } = readLog(file);
  const lines = linesOf(records);
  const headerLines = command.split('\n').length;
  const index = n - headerLines - 1;
  if (index < 0 || index >= lines.length) die(`--line ${n} is not a record of ${file}: records are lines ${headerLines + 1} to ${headerLines + lines.length}`);
  let root;
  try { root = opt('--root') ? path.resolve(opt('--root')) : projectRoot(process.cwd()); } catch (e) { return die(e.message); }
  const catalog = loadCatalog(root);
  const observations = loadObservations(root);
  const key = keyOf(command, catalog);
  const entry = catalog[key];
  if (entry && !isLearned(entry)) die(`'${key}' has a hand-written catalog entry; its answer line is declared there, not learned`);
  const training = trainingOf(observations[key]);
  if (entry && !training.open) die(`'${key}' has already graduated; drift re-opens it, and the runner says so when it does`);
  const at = new Date().toISOString();
  const r = identify(training, { lines, index, log: file, at });
  say(`identified: ${lines[index]}`);
  if (r.agreed === null) say(r.matcher ? 'shadow: nothing to compare against before this pick; it forms the first matcher' : 'shadow: no matcher yet — one pick; the prefix needs two');
  else say(`shadow: ${r.agreed ? 'agreed' : 'disagreed'} — ${r.training.streak} of ${GRADUATION_AGREEMENTS} consecutive agreements`);
  if (r.matcher) say(`matcher: prefix \`${r.matcher.value}\``);
  if (!r.graduates) { saveObservations(root, withTraining(observations, key, r.training)); return; }
  const g = graduate(root, { key, catalog, observations, training: r.training, matcher: r.matcher, lines, index, log: file, at });
  if (!g.ok) {
    // The pick still counts; the gate is what said no, and it says why. The header is NEUTRAL:
    // graduate() also refuses for reasons the fixture has nothing to do with — a collision at the
    // sanitized id, a project catalog that is not readable JSON — and a header naming the fixture
    // sent the session looking in the wrong place for all of them (final review M1).
    saveObservations(root, withTraining(observations, key, r.training));
    return die(`graduation refused:\n  ${g.problems.join('\n  ')}`);
  }
  saveObservations(root, g.observations);
  say(`graduated: '${g.id}' now keeps lines starting with \`${r.matcher.value}\` when '${key}' is filtered`);
  for (const f of g.files) say(`wrote ${f}`);
  say('commit both: the learned matcher and its frozen fixture are a team artifact, like the rest of the project catalog');
}

function logsCmd() {
  const want = opt('--key');
  let catalog = {};
  try { catalog = loadCatalog(projectRoot(process.cwd())); } catch { /* outside a repository: bespoke keys only */ }
  const files = listRunLogs();
  let shown = 0;
  for (const file of files) {
    let command;
    try { ({ command } = parseRunLog(fs.readFileSync(file, 'utf8'))); } catch { continue; }
    const key = keyOf(command, catalog);
    if (want && key !== want) continue;
    say(`${file}\t${key}`); shown++;
  }
  // The proof line (rules/tool-output.md § Proof lines and denominators): the count and its denominator.
  say(`train_tool_logs: ${shown} of ${files.length} run logs ${want ? `match '${want}'` : 'listed'} in ${logDir()}`);
}

if (sub === 'identify') identifyCmd();
else if (sub === 'logs') logsCmd();
else usage();
