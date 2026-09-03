import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScript } from './helpers/run.mjs';

// A "command" that prints N lines of chatter plus one error and exits with a code — via node so it is shell-agnostic.
const gen = (n, code) => `node -e "for(let i=0;i<${n};i++)console.log('   Compiling c'+i);console.log('error: boom');process.exit(${code})"`;
const bash = fs.existsSync('C:/Program Files/Git/bin/bash.exe') || process.platform !== 'win32';

test('short output is verbatim in filter mode (test_short_output_is_verbatim_threshold)', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(5, 0)] });
  assert.equal(r.code, 0);
  assert.ok(!r.stdout.startsWith('[quiet:'));
  assert.equal(r.stdout.trim().split('\n').length, 6);
});

test('long output is filtered, header states counts, exit status preserved', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(100, 3)] });
  assert.equal(r.code, 3);
  const [header, ...rest] = r.stdout.trim().split('\n');
  assert.match(header, /^\[quiet:filter\] exit=3 {2}\d+\.\ds {2}101 lines -> \d+ shown {2}full log: /);
  assert.ok(rest.some((l) => l === 'error: boom'));
  assert.ok(rest.length < 20);
});

test('infra mode on success shows proof lines only; the log file has everything', { skip: !bash }, () => {
  const cmd = `node -e "console.log('remote: chatter');console.log('Already up to date.')"`;
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'infra', '-c', cmd] });
  const [header, ...rest] = r.stdout.trim().split('\n');
  assert.deepEqual(rest, ['Already up to date.']);
  const log = header.split('full log: ')[1];
  assert.ok(fs.readFileSync(log, 'utf8').includes('remote: chatter'));
});

test('opt-out env prints verbatim', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(100, 0)], env: { MACHINERY_QUIET: '0' } });
  assert.equal(r.stdout.trim().split('\n').length, 101);
});

test('cmdfile form is read then deleted', { skip: !bash }, () => {
  const f = path.join(os.tmpdir(), `cmd-${Date.now()}.txt`);
  fs.writeFileSync(f, gen(2, 0));
  runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', f] });
  assert.ok(!fs.existsSync(f));
});

test('a missing cmdfile is refused with a reason on stderr, not a stack trace (final review E)', () => {
  const f = path.join(os.tmpdir(), `cmd-does-not-exist-${Date.now()}.txt`);
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', f] });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /quiet-run: cannot read/);
  assert.doesNotMatch(r.stderr, /at Object\.readFileSync/); // no raw stack trace leaking to stderr
});

test('RED CHECK: an unknown shell is refused (spec I21)', () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'zsh', '--mode', 'filter', '-c', 'echo x'] });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /shell/);
});

test('an unwritable log directory does not swallow output or exit status (failure-open)', { skip: !bash }, () => {
  // Point CLAUDE_JOB_DIR at a temp dir whose "tmp" entry is a regular FILE, so the
  // log directory can never be created — the wrapper must still print the filtered
  // output and preserve the command's own exit status.
  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-run-nodir-'));
  fs.writeFileSync(path.join(jobDir, 'tmp'), 'not a directory');
  const r = runScript('scripts/quiet-run.mjs', {
    args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(100, 3)],
    env: { CLAUDE_JOB_DIR: jobDir },
  });
  assert.equal(r.code, 3);
  const [header, ...rest] = r.stdout.trim().split('\n');
  assert.match(header, /^\[quiet:filter\]/);
  assert.match(header, /full log: \(unavailable:/);
  assert.ok(rest.some((l) => l === 'error: boom'));
  fs.rmSync(jobDir, { recursive: true, force: true });
});
