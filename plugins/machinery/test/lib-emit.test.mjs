import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript } from './helpers/run.mjs';

const probe = (fn, arg) => runScript('test/helpers/emit-probe.mjs', { env: { PROBE_FN: fn, PROBE_ARG: arg } });

test('updatedInput emits the PreToolUse shape exactly once', () => {
  const { stdout } = probe('updatedInput', '{"command":"x"}');
  const docs = stdout.trim().split('\n');
  assert.equal(docs.length, 1);
  assert.deepEqual(JSON.parse(docs[0]), { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { command: 'x' } } });
});

test('context emits additionalContext for the current event', () => {
  const { stdout } = probe('context', 'hello');
  assert.deepEqual(JSON.parse(stdout), { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: 'hello' } });
});

test('RED CHECK: none() prints nothing', () => {
  assert.equal(probe('none', '').stdout, '');
});
