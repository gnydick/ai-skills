import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, PLUGIN } from './helpers/run.mjs';

// Plan Task B4 (recalibration 29; mechanism 10): a Bash/PowerShell command carrying --no-verify
// stops at a permission prompt naming the hook(s) it would skip. Not a refusal: the user answers.

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/PreToolUse-Bash.json'), 'utf8'));
const run = (command) => runScript('scripts/no-verify.mjs', { stdin: JSON.stringify({ ...base, tool_input: { ...base.tool_input, command } }) });

for (const [command, which] of [
  ['git commit -m "x" --no-verify', 'pre-commit'],
  ['git push --no-verify origin main', 'pre-push'],
  ['make release NO="--no-verify"', 'pre-commit, pre-push'],
]) {
  test(`asks before: ${command}`, () => {
    const res = run(command);
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout).hookSpecificOutput, {
      hookEventName: 'PreToolUse', permissionDecision: 'ask',
      permissionDecisionReason: `--no-verify skips the commit/push hooks (${which}). Allow?`,
    });
  });
}

test('RED CHECK: a command without --no-verify gets no decision', () => {
  const res = run('git commit -m "x"');
  assert.equal(res.code, 0);
  assert.equal(res.stdout, '');
});

test('garbage stdin is silent and exits 0 (fails open)', () => {
  const res = runScript('scripts/no-verify.mjs', { stdin: '{not json' });
  assert.equal(res.code, 0);
  assert.equal(res.stdout, '');
});
