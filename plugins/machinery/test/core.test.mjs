import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScript, PLUGIN } from './helpers/run.mjs';

const CORE = () => fs.readFileSync(path.join(PLUGIN, 'core.md'), 'utf8');
const payload = (name) => fs.readFileSync(path.join(PLUGIN, `test/fixtures/payloads/${name}.json`), 'utf8');

for (const event of ['SessionStart', 'SubagentStart']) {
  test(`${event} receives core.md verbatim as additionalContext`, () => {
    const res = runScript('scripts/core.mjs', { stdin: payload(event) });
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout).hookSpecificOutput, { hookEventName: event, additionalContext: CORE() });
  });
}

test('hooks.json runs core.mjs on SessionStart and on every SubagentStart (no matcher)', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const event of ['SessionStart', 'SubagentStart']) {
    assert.ok((hooks[event] ?? []).some((g) => g.matcher === undefined && g.hooks.some((h) => /scripts\/core\.mjs/.test(h.command))), event);
  }
});

test('RED CHECK: a plugin without core.md exits 1, names the path, and injects nothing', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-'));
  try {
    const res = runScript('scripts/core.mjs', { stdin: payload('SubagentStart'), env: { CLAUDE_PLUGIN_ROOT: empty } });
    assert.equal(res.code, 1);
    assert.equal(res.stdout, '');
    assert.ok(res.stderr.includes(path.join(empty, 'core.md')), res.stderr);
  } finally { fs.rmSync(empty, { recursive: true, force: true }); }
});
