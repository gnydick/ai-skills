import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, PLUGIN } from './helpers/run.mjs';

const fixture = (name, command) => {
  const p = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads', `${name}.json`), 'utf8'));
  p.tool_input = { ...p.tool_input, command, description: 'd' };
  return JSON.stringify(p);
};
const out = (stdout) => JSON.parse(stdout).hookSpecificOutput;

test('noisy bash command is rewritten to run through quiet-run in filter mode', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /^node "[^"]*quiet-run\.mjs" --shell bash --mode filter "[^"]+"$/);
  assert.equal(u.description, 'd [quiet:filter]');
  const cmdfile = u.command.match(/"([^"]+)"$/)[1];
  assert.equal(fs.readFileSync(cmdfile, 'utf8'), 'cargo test');
});

test('infra powershell command gets the powershell wrapper and exit passthrough', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-PowerShell', 'git push') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /--shell powershell --mode infra .*; exit \$LASTEXITCODE$/);
});

test('read / piped / redirected / plain commands are untouched', () => {
  for (const c of ['gh issue view 1', 'cargo test | tail -5', 'cargo build > log', 'ls']) {
    const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c); assert.equal(r.code, 0);
  }
});

test('a non-shell tool is untouched', () => {
  const p = JSON.parse(fixture('PreToolUse-Bash', 'cargo test')); p.tool_name = 'Read';
  const r = runScript('scripts/quiet.mjs', { stdin: JSON.stringify(p) });
  assert.equal(r.stdout, '');
});

test('fails OPEN: garbage stdin → no output, exit 0 (spec I17)', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: '{not json' });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('fails OPEN: unwritable temp dir → no output, exit 0 (spec I17)', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test'), env: { CLAUDE_JOB_DIR: 'Z:\\nonexistent\\dir\\for\\quiet' } });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('RED CHECK: the rewrite is not the identity', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test') });
  assert.notEqual(out(r.stdout).updatedInput.command, 'cargo test');
});
