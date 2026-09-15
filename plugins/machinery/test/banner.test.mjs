import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/SessionStart.json'), 'utf8'));
// STATUS 54: the universal inbox and rules are the user's, under the home. Every home() is a
// throwaway, so nothing here reads or writes the real ones.
const home = () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(h, '.claude'));
  return h;
};
const run = (cwd, env = {}) => runScript('scripts/banner.mjs', { stdin: JSON.stringify({ ...base, cwd }), cwd, env: { MACHINERY_HOME: home(), ...env } });
const text = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;

test('reports measured facts for an uninstalled project', () => {
  const r = makeRepo();
  try {
    const t = text(run(r.root));
    assert.match(t, /^  core: .*core\.md \(present\)$/m);
    assert.match(t, /^  universal rules: .*[\\/]\.claude[\\/]rules[\\/]universal\.md \(absent\)$/m, t);
    assert.doesNotMatch(t, /junction|cant-break-by-design|rules source|pluginSource/);
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
    runScript('scripts/capture.mjs', { stdin: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'URULE: y', cwd: r.root, session_id: 's' }), cwd: r.root, env: { MACHINERY_HOME: h } });
    const universal = path.join(h, '.claude', 'rules', 'universal.md');
    fs.mkdirSync(path.dirname(universal), { recursive: true }); fs.writeFileSync(universal, '# Universal rules\n');
    const t = text(run(r.root, { MACHINERY_HOME: h }));
    assert.match(t, /core\.hooksPath: \.githooks/);
    assert.match(t, /gate: installed \d+\.\d+\.\d+ \(plugin \d+\.\d+\.\d+\)/);
    assert.match(t, /pending: project 1, universal 1/);
    assert.ok(t.includes(`  universal rules: ${universal} (present)`), t);
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

// #107 (owner, 2026-09-15: "Updated installs have to handle migration"): a project keeps the gate
// its last install wrote, so after a plugin update the installed copy can be older than the plugin
// and still name remedies the plugin no longer ships. The gate line says so and names the one
// remedy, re-running /machinery:install; an installed copy at the plugin's version gets no remedy.
test('RED CHECK: the gate line names /machinery:install when the installed stamp is older than the plugin, and not when it matches (#107)', () => {
  const r = makeRepo();
  try {
    const h = home();
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    const current = text(run(r.root, { MACHINERY_HOME: h }));
    assert.match(current, /^  gate: installed \d+\.\d+\.\d+ \(plugin \d+\.\d+\.\d+\)$/m, current);
    assert.doesNotMatch(current, /older than the plugin/);
    // A stamp older in the patch field only, since a lexical comparison would call 0.1.9 newer than 0.1.10.
    fs.writeFileSync(path.join(r.root, '.githooks', 'machinery', 'VERSION'), '0.1.9\n');
    const stale = text(run(r.root, { MACHINERY_HOME: h }));
    assert.match(stale, /^  gate: installed 0\.1\.9 \(plugin \d+\.\d+\.\d+\) — older than the plugin; run \/machinery:install to migrate$/m, stale);
  } finally { r.cleanup(); }
});
