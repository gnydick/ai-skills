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
  // observe and suggest are ALWAYS verbatim, unconditionally — never the threshold branch.
  // filter/infra keep today's threshold-or-forced verbatim path, unchanged.
  const forced = process.env.MACHINERY_QUIET === '0';
  const verbatim = forced || a.mode === 'observe' || a.mode === 'suggest'
    || (a.mode !== 'infra' && lines.length <= PASS_THROUGH_LINES);
  if (verbatim) process.stdout.write(lines.join('\n') + (lines.length ? '\n' : ''));
  else {
    const keep = a.mode === 'infra' ? selectInfra(lines, code) : select(lines);
    const header = `[quiet:${a.mode}] exit=${code}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${lines.length} lines -> ${Math.min(keep.size, MAX_SHOWN)} shown  full log: ${logDisplay}`;
    process.stdout.write(render(lines, keep, header) + '\n');
  }
  if (a.cmdfile) { try { fs.rmSync(a.cmdfile); } catch {} }
  return code;
}

main().then((code) => { process.exitCode = code; }).catch((e) => { process.stderr.write(`quiet-run: ${e.message}\n`); process.exitCode = 1; });
