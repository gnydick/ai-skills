#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 15–27 (the runner half). Ported from quiet_run.py.
// Known ceiling: spawnSync with two pipes cannot interleave stdout/stderr in true
// chronological order; the story asks for "both streams as one stream". The filter is
// line-based and selection order rarely depends on interleaving; the full log has both.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalise, select, selectInfra, render, PASS_THROUGH_LINES, MAX_SHOWN } from './lib/filter.mjs';

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
    else a.cmdfile = x;
  }
  return a;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!SHELLS[a.shell]) { process.stderr.write(`quiet-run: unknown shell '${a.shell}' (bash|powershell)\n`); return 2; }
  if (a.mode !== 'filter' && a.mode !== 'infra') { process.stderr.write(`quiet-run: unknown mode '${a.mode}'\n`); return 2; }
  let command = a.command;
  if (command === null && a.cmdfile) command = fs.readFileSync(a.cmdfile, 'utf8');
  if (command === null) { process.stderr.write('quiet-run: need a cmdfile or -c\n'); return 2; }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const logPath = path.join(logDir(), `quiet-${stamp}-${process.pid}.log`);
  const [exe, args] = SHELLS[a.shell](command);
  const t0 = Date.now();
  const r = spawnSync(exe, args, { env: quietEnv(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  if (r.error) { process.stderr.write(`quiet-run: could not start ${a.shell}: ${r.error.message}\n`); return 1; }
  const code = r.status ?? 1;
  const raw = Buffer.concat([r.stdout ?? Buffer.alloc(0), r.stderr ?? Buffer.alloc(0)]); // both streams as one (step 19)
  let logDisplay = logPath;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, Buffer.concat([Buffer.from(`$ ${command}\n`), raw]));
  } catch (e) { logDisplay = `(unavailable: ${e.message})`; }
  const lines = normalise(raw);
  const forced = process.env.MACHINERY_QUIET === '0';
  const verbatim = forced || (a.mode !== 'infra' && lines.length <= PASS_THROUGH_LINES);
  if (verbatim) process.stdout.write(lines.join('\n') + (lines.length ? '\n' : ''));
  else {
    const keep = a.mode === 'infra' ? selectInfra(lines, code) : select(lines);
    const header = `[quiet:${a.mode}] exit=${code}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${lines.length} lines -> ${Math.min(keep.size, MAX_SHOWN)} shown  full log: ${logDisplay}`;
    process.stdout.write(render(lines, keep, header) + '\n');
  }
  if (a.cmdfile) { try { fs.rmSync(a.cmdfile); } catch {} }
  return code;
}

process.exitCode = main();
