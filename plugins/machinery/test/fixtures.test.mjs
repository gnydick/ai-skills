import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PLUGIN } from './helpers/run.mjs';

const DIR = path.join(PLUGIN, 'test', 'fixtures', 'payloads');
const REQUIRED = ['SessionStart', 'UserPromptSubmit', 'PreToolUse-Bash', 'PreToolUse-PowerShell', 'PostToolUse-Edit', 'WorktreeCreate'];

for (const name of REQUIRED) {
  test(`recorded payload exists and is scrubbed: ${name}`, () => {
    const file = path.join(DIR, `${name}.json`);
    assert.ok(fs.existsSync(file), `${name}.json missing — re-record (Task 2 step 3)`);
    const text = fs.readFileSync(file, 'utf8');
    const p = JSON.parse(text);
    assert.equal(p.hook_event_name, name.split('-')[0]);
    assert.ok(!text.includes(os.userInfo().username), 'fixture contains a username — scrub it');
  });
}

test('RED CHECK: a fixture with the wrong event name is rejected', () => {
  const p = JSON.parse(fs.readFileSync(path.join(DIR, 'SessionStart.json'), 'utf8'));
  assert.notEqual(p.hook_event_name, 'UserPromptSubmit');
});
