import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatRunLog, parseRunLog, linesOf, listRunLogs, logDir } from '../scripts/lib/runlog.mjs';
import { normalise } from '../scripts/lib/filter.mjs';

const RECORDS = [
  { t: 0.412, stream: 'stdout', text: 'running 128 tests' },
  { t: 0.418, stream: 'stderr', text: '   Compiling fs-core v0.1.0' },
  { t: 1.5, stream: 'stdout', text: '10%\r50%\r100%' },          // a bare \r: progress frames, verbatim
  { t: 2, stream: 'stdout', text: '\x1b[32mgreen\x1b[0m   ' },   // ANSI and trailing spaces, verbatim
  { t: 8.902, stream: 'stdout', text: '' },                        // an empty record is a record
  { t: 8.903, stream: 'stdout', text: 'test result: ok. 128 passed; 0 failed' },
];

test('the log format is the one the runner has always written: $ command, then <t> <out|err>  <text>', () => {
  const log = formatRunLog('cargo test --workspace', RECORDS.slice(0, 2));
  assert.equal(log, '$ cargo test --workspace\n0.412 out  running 128 tests\n0.418 err     Compiling fs-core v0.1.0\n');
  assert.equal(formatRunLog('true', []), '$ true\n');
});

test('parse is the inverse of format, byte for byte, including a bare \\r, ANSI, trailing spaces and an empty record', () => {
  const { command, records } = parseRunLog(formatRunLog('cargo test --workspace', RECORDS));
  assert.equal(command, 'cargo test --workspace');
  assert.deepEqual(records, RECORDS.map((r) => ({ ...r, t: Number(r.t.toFixed(3)) })));
});

test('a multi-line command round-trips: the header runs until the first record line', () => {
  const cmd = 'cargo build\ncargo test';
  const { command, records } = parseRunLog(formatRunLog(cmd, RECORDS.slice(0, 1)));
  assert.equal(command, cmd);
  assert.equal(records.length, 1);
});

test('linesOf is the display derivation: what the runner shows and what the trainer reads are one normalise() over the same texts', () => {
  const { records } = parseRunLog(formatRunLog('x', RECORDS));
  assert.deepEqual(linesOf(records), normalise(RECORDS.map((r) => r.text).join('\n')));
  // Derived by hand from normalise()'s own rules: last \r frame wins, ANSI stripped, trailing spaces
  // trimmed, an interior empty line kept.
  assert.deepEqual(linesOf(records), ['running 128 tests', '   Compiling fs-core v0.1.0', '100%', 'green', '', 'test result: ok. 128 passed; 0 failed']);
});

test('RED CHECK: text that is not a run log is refused with a reason, never parsed into nonsense', () => {
  assert.throws(() => parseRunLog('not a log\n'), /first line/);
  assert.throws(() => parseRunLog('$ x\n0.100 out  fine\nthis is neither\n'), /line 3/);
});

test('logDir honours CLAUDE_JOB_DIR and falls back to the temp dir; listRunLogs lists quiet-*.log newest stamp first', () => {
  const saved = process.env.CLAUDE_JOB_DIR;
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'runlog-'));
  try {
    process.env.CLAUDE_JOB_DIR = job;
    assert.equal(logDir(), path.join(job, 'tmp'));
    fs.mkdirSync(logDir());
    for (const n of ['quiet-20260905-100000-1.log', 'quiet-20260905-120000-2.log', 'quiet-20260904-235959-3.log', 'other.txt']) fs.writeFileSync(path.join(logDir(), n), '$ x\n');
    assert.deepEqual(listRunLogs().map((f) => path.basename(f)), ['quiet-20260905-120000-2.log', 'quiet-20260905-100000-1.log', 'quiet-20260904-235959-3.log']);
    delete process.env.CLAUDE_JOB_DIR;
    assert.equal(logDir(), path.join(os.tmpdir(), 'claude-quiet'));
    assert.deepEqual(listRunLogs(path.join(job, 'no-such-dir')), []);
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_JOB_DIR; else process.env.CLAUDE_JOB_DIR = saved;
    fs.rmSync(job, { recursive: true, force: true, maxRetries: 5 });
  }
});
