import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureRun } from '../scripts/lib/capture.mjs';

test('stdout and stderr are tagged separately and kept in arrival order', async () => {
  const code = `
    console.error('one on stderr');
    console.log('two on stdout');
    console.error('three on stderr');
  `;
  const { records, code: exitCode } = await captureRun(process.execPath, ['-e', code]);
  assert.equal(exitCode, 0);
  const shape = records.map((r) => [r.stream, r.text]);
  assert.deepEqual(shape, [
    ['stderr', 'one on stderr'],
    ['stdout', 'two on stdout'],
    ['stderr', 'three on stderr'],
  ]);
});

test('timestamps are monotonically non-decreasing and reflect a real gap', async () => {
  const code = `console.log('first'); setTimeout(() => console.log('second'), 120);`;
  const { records } = await captureRun(process.execPath, ['-e', code]);
  assert.ok(records[1].t - records[0].t >= 0.08, `gap too small: ${records[1].t - records[0].t}`);
  for (let i = 1; i < records.length; i++) assert.ok(records[i].t >= records[i - 1].t);
});

test('a nonexistent executable rejects with the underlying message, not a raw stack', async () => {
  await assert.rejects(
    () => captureRun('this-binary-does-not-exist-xyz', []),
    (err) => { assert.ok(!err.stack?.includes('at Object.spawn')); return true; }
  );
});

test('exit code is 1, never null, when the child is signal-killed', { skip: process.platform === 'win32' }, async () => {
  const { code } = await captureRun('bash', ['-c', 'kill -TERM $$']);
  assert.equal(code, 1);
});

test('stdin passthrough: the child receives the given input', async () => {
  const { records } = await captureRun(process.execPath, ['-e', "process.stdin.on('data', d => console.log('got:' + d.toString().trim()))"], { input: 'hello\n' });
  assert.deepEqual(records.map((r) => r.text), ['got:hello']);
});

test('env, when given, replaces the child environment rather than being ignored', async () => {
  const { records } = await captureRun(process.execPath, ['-e', 'console.log(process.env.PROBE_VAR ?? "unset")'], { env: { ...process.env, PROBE_VAR: 'marker-123' } });
  assert.deepEqual(records.map((r) => r.text), ['marker-123']);
});

// RED CHECK for this suite (spec I39): the five tests above all write whole lines in one go, so
// none of them can tell a correct line splitter from one that emits every chunk as a finished
// line. This one can — it forces one line to straddle two `data` events, and ends on a line with
// no newline at all, so a splitter that flushes early records 'abc' and 'def' as two lines and a
// splitter that never flushes at close drops the tail entirely. Both are silent losses of the
// user's own output.
test('RED CHECK: a line split across two chunks is stitched, and an unterminated tail is not dropped', async () => {
  const code = `process.stdout.write('abc');
    setTimeout(() => process.stdout.write('def' + String.fromCharCode(10)), 60);
    setTimeout(() => process.stdout.write('tail-with-no-newline'), 140);`;
  const { records } = await captureRun(process.execPath, ['-e', code]);
  assert.deepEqual(records.map((r) => [r.stream, r.text]), [
    ['stdout', 'abcdef'],
    ['stdout', 'tail-with-no-newline'],
  ]);
});
