import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/SessionStart.json'), 'utf8'));
// Final review D: without a machinery.json, universalInbox() falls back to the plugin's OWN
// directory — a suite that never sets pluginSource reads (and could be broken by) the REAL, live
// plugins/machinery/inbox.md. Point every home() at its own throwaway plugin source instead.
const home = () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(h, '.claude'));
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-'));
  fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ pluginSource: source }));
  return h;
};
const run = (cwd, env = {}) => runScript('scripts/banner.mjs', { stdin: JSON.stringify({ ...base, cwd }), cwd, env: { MACHINERY_HOME: home(), ...env } });
const text = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;

test('reports measured facts for an uninstalled project', () => {
  const r = makeRepo();
  try {
    const t = text(run(r.root));
    assert.match(t, /^  core: .*core\.md \(present\)$/m);
    assert.doesNotMatch(t, /junction|cant-break-by-design/);
    assert.match(t, /core\.hooksPath: not set — run \/machinery:install/);
    assert.match(t, /gate: not installed/);
    assert.match(t, /pending: project 0, universal 0/);
    assert.match(t, /markers: PRULE: \(project\) URULE: \(universal\)/);
    assert.match(t, /hosted check: none — the pre-push hook is the blocking check before main; \/machinery:install --hosted-ci writes one$/m);
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

test('RED CHECK: the gate line names a version only when the VERSION stamp exists (final review C3)', () => {
  // A genuine mutation detector, replacing an assertion that only ever proved the absence of a
  // phrase capture.mjs emits (never one the banner itself could emit either way): the banner's
  // "gate:" line must flip between "not installed" and "installed <ver> (plugin <ver>)" based on
  // whether it actually measured the VERSION stamp file, not print a version number regardless.
  const r = makeRepo();
  try {
    const uninstalled = text(run(r.root));
    assert.match(uninstalled, /gate: not installed/);
    assert.doesNotMatch(uninstalled, /gate: installed \d/);
    const h = home();
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    const installed = text(run(r.root, { MACHINERY_HOME: h }));
    assert.match(installed, /gate: installed \d+\.\d+\.\d+ \(plugin \d+\.\d+\.\d+\)/);
    assert.doesNotMatch(installed, /gate: not installed/);
  } finally { r.cleanup(); }
});

// Issue tracking, this plan's choice 1 and Decision 3: the developer-friendliness skill finds the decide
// command by this line, and a session without the line is one without machinery.
test('names the issue-tracking command by an absolute path that exists', () => {
  const r = makeRepo();
  try {
    const m = /issue tracking command: node "([^"]+)"/.exec(text(run(r.root)));
    assert.ok(m, 'the banner does not name the issue-tracking command');
    assert.ok(path.isAbsolute(m[1]), m[1]);
    assert.equal(fs.realpathSync.native(m[1]), fs.realpathSync.native(path.join(PLUGIN, 'scripts', 'issue-tracking.mjs')));
  } finally { r.cleanup(); }
});

test('RED CHECK: a plugin root without the command is reported MISSING, never offered as runnable', () => {
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-'));
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(fake, '.claude-plugin'));
    fs.copyFileSync(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), path.join(fake, '.claude-plugin', 'plugin.json'));
    fs.copyFileSync(path.join(PLUGIN, 'markers.json'), path.join(fake, 'markers.json'));
    const t = text(run(r.root, { CLAUDE_PLUGIN_ROOT: fake }));
    assert.match(t, /issue tracking command: MISSING — expected at .*issue-tracking\.mjs/);
    assert.doesNotMatch(t, /issue tracking command: node /);
  } finally { r.cleanup(); fs.rmSync(fake, { recursive: true, force: true, maxRetries: 5 }); }
});
