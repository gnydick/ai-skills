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

// ---- Task 2: capture via lib/capture.mjs (stream separation, always-verbatim modes) ----

test('stderr and stdout both reach the log, each tagged, in real arrival order', { skip: !bash }, () => {
  // Spaced writes: the point of the record log is arrival order, and only writes the parent
  // has demonstrably drained between can prove ordering rather than poll-readiness luck.
  const cmd = `node -e "console.error('e1');setTimeout(()=>{console.log('o1');setTimeout(()=>console.error('e2'),150)},150)"`;
  // infra mode is never verbatim, so a header (and with it the log path) always exists.
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'infra', '-c', cmd] });
  const log = r.stdout.trim().split('\n')[0].split('full log: ')[1];
  const body = fs.readFileSync(log, 'utf8').trim().split('\n').slice(1); // drop the "$ cmd" line
  assert.deepEqual(body.map((l) => l.replace(/^\d+\.\d+ /, '')), ['err  e1', 'out  o1', 'err  e2']);
});

test('observe mode is always verbatim regardless of line count', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'observe', '-c', gen(100, 0)] });
  assert.equal(r.stdout.trim().split('\n').length, 101); // 100 chatter + 1 error line from gen()
});

test('RED CHECK: suggest mode is verbatim even over threshold — a trial run must never be filtered', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'suggest', '-c', gen(100, 0)] });
  // 100 chatter lines + 1 error line from gen() = 101; verbatim means all 101 appear, not a
  // filtered ~10-line render. This is the exact case the backwards verbatim condition broke.
  assert.equal(r.stdout.trim().split('\n').length, 101);
});

test('RED CHECK: displayed lines still go through normalise — ANSI stripped, CR-overwrite collapsed', { skip: !bash }, () => {
  // Guards the deviation reported in task-2-report.md: the brief's sample fed records[].text
  // straight to the display path, silently dropping filter.mjs's normalise() and with it ANSI
  // stripping, CR-overwrite collapsing and trailing-whitespace trimming.
  // Built from char codes so no backslash escape has to survive JS -> bash -> node -e intact.
  const cmd = `node -e "const E=String.fromCharCode(27),CR=String.fromCharCode(13),NL=String.fromCharCode(10);process.stdout.write(E+'[32mgreen'+E+'[0m'+NL);process.stdout.write('a'+CR+'b   '+NL)"`;
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd] });
  assert.deepEqual(r.stdout.trim().split('\n'), ['green', 'b']);
});
