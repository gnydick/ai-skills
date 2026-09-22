#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 15–27 (the runner half). Ported from quiet_run.py.
// Capture is lib/capture.mjs's job now: it reads the two pipes separately and records every
// line in real arrival order with the stream it came from, so the ceiling spawnSync imposed
// (stdout and stderr concatenated, their true interleaving unrecoverable) is gone. The full
// log keeps both facts per line; the display path is unchanged and still line-based.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { select, selectInfra, render, hasErrorBlock, PASS_THROUGH_LINES, MAX_SHOWN } from './lib/filter.mjs';
import { logDir, formatRunLog, linesOf } from './lib/runlog.mjs';
import { captureRun } from './lib/capture.mjs';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog, matchTool, matchedCandidate, outcomeMatcher, isLearned } from './lib/catalog.mjs';
import { loadObservations, saveObservations, recordRun, toolKey, withTraining } from './lib/observations.mjs';
import { decide, candidatesOf } from './lib/assimilate.mjs';
import { trainingOf, noteRun, driftReason, reopen, GRADUATION_AGREEMENTS } from './lib/training.mjs';

const SHELLS = Object.freeze({
  bash: (cmd) => {
    for (const c of ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files\\Git\\usr\\bin\\bash.exe']) if (fs.existsSync(c)) return [c, ['-lc', cmd]];
    return ['bash', ['-lc', cmd]];
  },
  powershell: (cmd) => ['powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd]],
});

function quietEnv() {
  const env = { ...process.env, CARGO_TERM_COLOR: 'never', CARGO_TERM_PROGRESS_WHEN: 'never', NO_COLOR: '1', TERM: 'dumb', CI: '1',
    npm_config_progress: 'false', npm_config_color: 'false', PIP_PROGRESS_BAR: 'off', PIP_NO_COLOR: '1', PYTHONUNBUFFERED: '1', PY_COLORS: '0',
    GH_PAGER: 'cat', GH_NO_UPDATE_NOTIFIER: '1', GH_PROMPT_DISABLED: '1', CLICOLOR: '0', CLICOLOR_FORCE: '0' };
  delete env.FORCE_COLOR; delete env.GH_FORCE_TTY;
  return env;
}

// The training nudge (design, "The nudge register"): advisory, on this runner's own stdout after
// the output — the same channel as the suggest line — never a hook that waits on anything, and
// never applied to anything. It points at the log this run wrote and at the one command that hands
// the session's picks to the loop; the <N[,N...]> list is for the session to supply, one number per
// answer line it identified in that run (#168). Forward slashes in both paths: node reads them on
// every platform and the bash shell needs them.
const TRAINER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'train-tool.mjs').replace(/\\/g, '/');
function trainingNudge(key, training, learned, logPath) {
  const state = learned
    ? `learned answer line(s) re-opened for training (${training.open.reason})`
    : `answer line(s) not yet learned (${training.picks.length} identified, ${training.streak} of ${GRADUATION_AGREEMENTS} agreements)`;
  return `[quiet:train] ${key}: ${state} — read the log, then: node "${TRAINER}" identify --log "${logPath.replace(/\\/g, '/')}" --line <N[,N...]>\n`;
}

function parseArgs(argv) {
  const a = { shell: 'bash', mode: 'filter', command: null, cmdfile: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--shell') a.shell = argv[++i];
    else if (x === '--mode') a.mode = argv[++i];
    else if (x === '-c' || x === '--command') a.command = argv[++i];
    else if (!x.startsWith('--')) a.cmdfile = x;
  }
  return a;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!SHELLS[a.shell]) { process.stderr.write(`quiet-run: unknown shell '${a.shell}' (bash|powershell)\n`); return 2; }
  if (!['filter', 'infra', 'observe', 'suggest'].includes(a.mode)) { process.stderr.write(`quiet-run: unknown mode '${a.mode}'\n`); return 2; }
  let command = a.command;
  if (command === null && a.cmdfile) {
    // A re-executed rewritten command can point at a cmdfile that's already been consumed and
    // deleted (spec I17: fail LOUD with a reason, never a raw stack trace — final review E).
    try { command = fs.readFileSync(a.cmdfile, 'utf8'); }
    catch (e) { process.stderr.write(`quiet-run: cannot read ${a.cmdfile}: ${e.message}\n`); return 2; }
  }
  if (command === null) { process.stderr.write('quiet-run: need a cmdfile or -c\n'); return 2; }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const logPath = path.join(logDir(), `quiet-${stamp}-${process.pid}.log`);
  const [exe, args] = SHELLS[a.shell](command);
  const t0 = Date.now();
  let code, records;
  try {
    // A spawn failure rejects here — it is not an exit code and never was one.
    ({ code, records } = await captureRun(exe, args, { env: quietEnv() }));
  } catch (e) {
    process.stderr.write(`quiet-run: could not start ${a.shell}: ${e.message}\n`);
    return 1;
  }
  // The display path still goes through normalise(), exactly as it did when the input was one
  // concatenated buffer: filter.mjs owns ANSI stripping, CR-overwrite collapsing, trailing-space
  // trimming and trailing-blank removal, and skipping it here would silently drop all four.
  // linesOf() is the one derivation of the display lines — normalise() over the record texts — and
  // train-tool.mjs reads the same lines back out of the log through the same function, so the index
  // the session identifies is an index into exactly what was shown.
  const lines = linesOf(records);
  let logDisplay = logPath;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    // The log keeps what the display path cannot: when each line arrived and which stream it
    // came from. Written verbatim — carriage returns and all — because normalise() owns that.
    fs.writeFileSync(logPath, formatRunLog(command, records));
  } catch (e) { logDisplay = `(unavailable: ${e.message})`; }
  // The assimilator's inputs, resolved once and read by everything below. Nothing here may cost
  // the wrapped command its output or its exit status — that claim covers THREE sites, this one,
  // the outcome-pattern read below it, and the decide() call in the suggest branch further down;
  // a bare one among guarded siblings is how the claim goes quietly false. Two things can go wrong
  // here:
  // projectRoot() throws outside a git checkout, and a catalog entry is external input — the
  // project half is machine-written and both halves are hand-editable — so a malformed `match` or
  // `outcome` pattern throws, and a `candidates` that is not a list throws too. Both degrade to
  // "nothing is known about this tool" and the second says so, because a silently generic filter
  // on a tool that declared an answer line is exactly the failure the declaration exists to stop.
  // Read before recording, so the suggestion below is computed from the same record quiet.mjs saw.
  let root = null, catalog = {}, observations = {}, toolId = null, outcomePattern, candidate = null;
  try { root = projectRoot(process.cwd()); catalog = loadCatalog(root); observations = loadObservations(root); }
  catch { /* not inside a repository: nowhere to keep a record, and nothing to look one up in */ }
  try {
    toolId = matchTool(command, catalog);
    // outcomeMatcher() is the one compiler: a regex for a hand-written entry, a startsWith test for a
    // learned one, undefined for none. It is non-global by construction either way — a catalog
    // `outcome` carries no flag information — which is what keeps select() clear of the lastIndex
    // statefulness a /g or /y pattern brings (Task 3 of the core plan). A malformed outcome throws
    // here and is caught below like the other two catalog reads.
    if (toolId) outcomePattern = outcomeMatcher(catalog[toolId]);
    // Two different questions, deliberately not one variable. `candidate` is the flag THIS run is
    // a trial of — already present in the command — which is the only thing the ledger can record
    // a verdict about. The flag to RECOMMEND is by definition not in the command, so
    // matchedCandidate() can never name it; decide() owns that choice and is re-asked below.
    // candidatesOf() is decide()'s own reading of the list — one coercion, not two that drift.
    if (toolId) candidate = matchedCandidate(command, candidatesOf(catalog[toolId]));
  } catch (e) {
    process.stderr.write(`quiet-run: unusable tool catalog (${e.message}); falling back to the generic filter\n`);
    catalog = {}; toolId = null; outcomePattern = undefined; candidate = null;
  }
  // One derivation shared with train-tool.mjs, from the matchTool() answer already in hand rather
  // than a second lookup: the trainer's pick has to land on the record this run writes.
  const key = toolKey(toolId, command).key;

  // observe and suggest are ALWAYS verbatim, unconditionally — never the threshold branch.
  // filter/infra keep today's threshold-or-forced verbatim path, unchanged.
  const forced = process.env.MACHINERY_QUIET === '0';
  const verbatim = forced || a.mode === 'observe' || a.mode === 'suggest'
    || (a.mode !== 'infra' && lines.length <= PASS_THROUGH_LINES);
  let out;
  if (verbatim) out = lines.join('\n') + (lines.length ? '\n' : '');
  else {
    const keep = a.mode === 'infra' ? selectInfra(lines, code) : select(lines, outcomePattern);
    const header = `[quiet:${a.mode}] exit=${code}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${lines.length} lines -> ${Math.min(keep.size, MAX_SHOWN)} shown  full log: ${logDisplay}`;
    out = render(lines, keep, header) + '\n';
  }
  if (a.mode === 'suggest') {
    // Advisory, never applied: the assistant is told what to try, and nothing rewrites the command
    // the user wrote (design, "The nudge register"). The no-flag branch is reachable whenever this
    // runner is invoked in suggest mode over a tool decide() has nothing to offer for, and saying
    // so is better than printing `try: ` with nothing after it.
    //
    // The THIRD thing that reads external input, and it fails open like the other two. The
    // observation record is hand-editable and observations.mjs promises a hand-edited one is data
    // rather than a broken invariant — a promise that only holds if every reader agrees. A `ledger`
    // that is a string, not an object, reaches assimilate.mjs's `!(c in ledger)` and throws; left
    // bare, that took the wrapped command's output and turned its exit 7 into a 1.
    let suggestion;
    try { suggestion = decide(command, { catalog, observations }).suggestFlags; }
    catch (e) {
      process.stderr.write(`quiet-run: unusable observation record (${e.message}); no candidate can be suggested\n`);
      suggestion = undefined;
    }
    out += suggestion
      ? `[quiet:suggest] ${key} is noisy here — try adding: ${suggestion}\n`
      : `[quiet:suggest] ${key} is noisy here, and no untried quiet flag is declared for it\n`;
  }
  process.stdout.write(out);

  let nudge = '';
  try {
    if (root) {
      const stdoutLines = records.filter((r) => r.stream === 'stdout').length;
      const stderrLines = records.filter((r) => r.stream === 'stderr').length;
      // Only meaningful on a trial run (a candidate flag is actually present): did the tool's own
      // declared answer survive taking it? Defaults true, so a bare run — or a tool with no
      // declared outcome pattern to lose — is judged on line count alone, per Task 5's ruling.
      const outcomeSurvived = candidate && outcomePattern ? lines.some((l) => outcomePattern.test(l)) : true;
      let next = recordRun(observations, key, {
        identity: toolId ? 'catalog' : 'bespoke',
        lineCount: lines.length, stdoutLines, stderrLines, candidate, outcomeSurvived,
      });
      // The training loop (design, "How an outcome pattern is learned"), for the runs that can
      // learn: a bare run — never a trial, whose lines measure a flag — of a tool with no declared
      // answer line of its own, which is a bespoke tool or one whose entry the loop itself wrote
      // (isLearned). Not infra: selectInfra() takes no outcome pattern, so nothing learned there
      // would ever be applied. Drift is judged BEFORE this run joins the history it is judged
      // against, and only while the matcher stands — a re-opened one is already in question, and
      // re-judging it every run would discard each new pick before it could count.
      const learned = toolId !== null && isLearned(catalog[toolId]);
      if (!candidate && a.mode !== 'infra' && (toolId === null || learned)) {
        let training = trainingOf(next[key]);
        if (learned && !training.open) {
          const reason = driftReason(training, {
            matched: outcomePattern ? lines.filter((l) => outcomePattern.test(l)).length : 0,
            code, errorBlock: hasErrorBlock(lines), lines: lines.length, stdoutLines, stderrLines,
          });
          if (reason) training = reopen(training, reason, logPath, new Date().toISOString());
        }
        training = noteRun(training, { log: logPath, lines: lines.length, stdoutLines, stderrLines, code });
        next = withTraining(next, key, training);
        // Noisy by the one threshold, and not yet (or no longer) graduated: the session is asked. A
        // quiet tool is never wrapped again, so a matcher for it would never be applied. No log,
        // nothing to identify in — said, not skipped.
        if (lines.length > PASS_THROUGH_LINES && (!learned || training.open)) {
          nudge = logDisplay === logPath
            ? trainingNudge(key, training, learned, logPath)
            : `[quiet:train] ${key}: nothing to identify this run — the log could not be written ${logDisplay}\n`;
        }
      }
      const ignored = saveObservations(root, next);
      // Said once, when it happens: the project's .gitignore just changed under the user
      // (a change made on the user's behalf is said where they see it — additions too).
      if (ignored) process.stderr.write('quiet-run: created .claude/machinery/observations.json and added it to .gitignore (per-machine measurement, never tracked)\n');
    }
  } catch { /* recording is best-effort; never fail the wrapped command over it */ }
  if (nudge) process.stdout.write(nudge);
  if (a.cmdfile) { try { fs.rmSync(a.cmdfile); } catch {} }
  return code;
}

main().then((code) => { process.exitCode = code; }).catch((e) => { process.stderr.write(`quiet-run: ${e.message}\n`); process.exitCode = 1; });
