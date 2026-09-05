#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 15–27 (the runner half). Ported from quiet_run.py.
// Capture is lib/capture.mjs's job now: it reads the two pipes separately and records every
// line in real arrival order with the stream it came from, so the ceiling spawnSync imposed
// (stdout and stderr concatenated, their true interleaving unrecoverable) is gone. The full
// log keeps both facts per line; the display path is unchanged and still line-based.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalise, select, selectInfra, render, PASS_THROUGH_LINES, MAX_SHOWN } from './lib/filter.mjs';
import { captureRun } from './lib/capture.mjs';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog, matchTool, matchedCandidate } from './lib/catalog.mjs';
import { loadObservations, saveObservations, recordRun, bespokeKey } from './lib/observations.mjs';
import { decide, candidatesOf } from './lib/assimilate.mjs';

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

function logDir() {
  const job = process.env.CLAUDE_JOB_DIR;
  return job ? path.join(job, 'tmp') : path.join(os.tmpdir(), 'claude-quiet');
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
  const lines = normalise(records.map((r) => r.text).join('\n'));
  let logDisplay = logPath;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    // The log keeps what the display path cannot: when each line arrived and which stream it
    // came from. Written verbatim — carriage returns and all — because normalise() owns that.
    const body = records.map((r) => `${r.t.toFixed(3)} ${r.stream === 'stdout' ? 'out' : 'err'}  ${r.text}`).join('\n');
    fs.writeFileSync(logPath, `$ ${command}\n${body}${body ? '\n' : ''}`);
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
    // A missing `outcome` stays undefined rather than becoming `new RegExp(undefined)`, which is
    // /undefined/ and keeps any line with that word in it. `outcome` is a plain pattern string
    // carrying no flag information, so this RegExp is non-global by construction — which is what
    // keeps select() clear of the lastIndex statefulness a /g or /y pattern brings (Task 3's
    // review). A catalog format that ever allowed flags would have to re-open that.
    if (toolId && catalog[toolId].outcome) outcomePattern = new RegExp(catalog[toolId].outcome);
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
  const key = toolId ?? bespokeKey(command);

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

  try {
    if (root) {
      const stdoutLines = records.filter((r) => r.stream === 'stdout').length;
      const stderrLines = records.filter((r) => r.stream === 'stderr').length;
      // Only meaningful on a trial run (a candidate flag is actually present): did the tool's own
      // declared answer survive taking it? Defaults true, so a bare run — or a tool with no
      // declared outcome pattern to lose — is judged on line count alone, per Task 5's ruling.
      const outcomeSurvived = candidate && outcomePattern ? lines.some((l) => outcomePattern.test(l)) : true;
      saveObservations(root, recordRun(observations, key, {
        identity: toolId ? 'catalog' : 'bespoke',
        lineCount: lines.length, stdoutLines, stderrLines, candidate, outcomeSurvived,
      }));
    }
  } catch { /* recording is best-effort; never fail the wrapped command over it */ }
  if (a.cmdfile) { try { fs.rmSync(a.cmdfile); } catch {} }
  return code;
}

main().then((code) => { process.exitCode = code; }).catch((e) => { process.stderr.write(`quiet-run: ${e.message}\n`); process.exitCode = 1; });
