import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/SessionStart.json'), 'utf8'));
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
const run = (cwd, env = {}) => runScript('scripts/banner.mjs', { stdin: JSON.stringify({ ...base, cwd }), cwd, env: { MACHINERY_HOME: home(), ...env } });
const text = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;

test('reports measured facts for an uninstalled project', () => {
  const r = makeRepo();
  try {
    const t = text(run(r.root));
    assert.match(t, /rules source: .*rules \(junction: missing/);
    assert.match(t, /core\.hooksPath: not set — run \/machinery:install/);
    assert.match(t, /gate: not installed/);
    assert.match(t, /pending: project 0, universal 0/);
    assert.match(t, /markers: PRULE: \(project\) URULE: \(universal\)/);
    assert.match(t, /hosted check: none/);
  } finally { r.cleanup(); }
});

test('after install and a capture, reports hooksPath, stamp, and pending count', () => {
  const r = makeRepo();
  try {
    const h = home();
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    runScript('scripts/capture.mjs', { stdin: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'PRULE: x', cwd: r.root, session_id: 's' }), cwd: r.root, env: { MACHINERY_HOME: h } });
    const t = text(run(r.root, { MACHINERY_HOME: h }));
    assert.match(t, /core\.hooksPath: \.githooks/);
    assert.match(t, /gate: installed \d+\.\d+\.\d+ \(plugin \d+\.\d+\.\d+\)/);
    assert.match(t, /pending: project 1/);
  } finally { r.cleanup(); }
});

test('a rules source that does not resolve is reported loudly, exit 0', () => {
  const r = makeRepo();
  try {
    const h = home(); fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: 'Z:/nope/rules' }));
    const res = run(r.root, { MACHINERY_HOME: h });
    assert.equal(res.code, 0); assert.match(text(res), /rules source: .*DOES NOT EXIST/);
  } finally { r.cleanup(); }
});

test('a plugin-installed unbreakable (installed_plugins.json, no loose skill dir) is detected (final review B)', () => {
  const r = makeRepo();
  try {
    const h = home();
    fs.mkdirSync(path.join(h, '.claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: { 'unbreakable@ai-skills': [{ scope: 'user', version: '0.3.1' }] },
    }));
    const t = text(run(r.root, { MACHINERY_HOME: h }));
    assert.match(t, /cant-break-by-design skill \(mandatory\): installed/);
  } finally { r.cleanup(); }
});

test('no loose skill dir and no matching installed_plugins.json entry reports NOT FOUND', () => {
  const r = makeRepo();
  try {
    const h = home();
    fs.mkdirSync(path.join(h, '.claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(h, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: { 'some-other-plugin@marketplace': [{ scope: 'user', version: '1.0.0' }] },
    }));
    const t = text(run(r.root, { MACHINERY_HOME: h }));
    assert.match(t, /cant-break-by-design skill \(mandatory\): NOT FOUND — install the unbreakable plugin/);
  } finally { r.cleanup(); }
});

test('RED CHECK: the banner never claims a hook is active without measuring', () => {
  const r = makeRepo();
  try { assert.doesNotMatch(text(run(r.root)), /commits are blocked/i); } finally { r.cleanup(); }
});
