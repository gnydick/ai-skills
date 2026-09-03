import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/PostToolUse-Edit.json'), 'utf8'));
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
const run = (cwd, file) => runScript('scripts/nudge.mjs', { stdin: JSON.stringify({ ...base, cwd, tool_input: { ...base.tool_input, file_path: file } }), cwd, env: { MACHINERY_HOME: home() } });

test('editing a project rule file with a stale index nudges once', () => {
  const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: home() } });
    const f = path.join(r.root, '.claude', 'rules', 'new.md'); fs.writeFileSync(f, '# N\n\n## S\n\n- r\n');
    const res = run(r.root, f);
    assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /index is stale after editing .*new\.md/);
  } finally { r.cleanup(); }
});

test('editing an unrelated file is silent; a fresh index is silent', () => {
  const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: home() } });
    assert.equal(run(r.root, path.join(r.root, 'README.md')).stdout, '');
    assert.equal(run(r.root, path.join(r.root, '.claude', 'rules', 'none.md')).stdout, ''); // no file → still fresh
  } finally { r.cleanup(); }
});

test('fails SILENT: garbage stdin → nothing, exit 0', () => {
  const res = runScript('scripts/nudge.mjs', { stdin: 'nope' }); assert.equal(res.stdout, ''); assert.equal(res.code, 0);
});

test('RED CHECK: the nudge is real — the message names the edited file', () => {
  const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: home() } });
    const f = path.join(r.root, '.claude', 'rules', 'z.md'); fs.writeFileSync(f, '## S\n\n- r\n');
    assert.ok(run(r.root, f).stdout.includes('z.md'));
  } finally { r.cleanup(); }
});
