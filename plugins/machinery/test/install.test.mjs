import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const version = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8')).version;
const install = (root, ...args) => runScript('scripts/install.mjs', { args: ['--root', root, ...args], cwd: root });

test('project install creates the layout, copies the gate, sets hooksPath, stamps the version (spec I6, I7)', () => {
  const r = makeRepo();
  try {
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    for (const f of ['.claude/rules', '.claude/machinery/inbox.md', '.claude/machinery/INDEX.md', '.githooks/pre-commit', '.githooks/machinery/gate.mjs', '.githooks/machinery/lib/inbox.mjs', '.githooks/machinery/VERSION'])
      assert.ok(fs.existsSync(path.join(r.root, f)), f);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks/machinery/VERSION'), 'utf8').trim(), version);
    assert.equal(execFileSync('git', ['config', 'core.hooksPath'], { cwd: r.root, encoding: 'utf8' }).trim(), '.githooks');
    assert.match(fs.readFileSync(path.join(r.root, '.githooks/pre-commit'), 'utf8'), /node \.githooks\/machinery\/gate\.mjs/);
    assert.match(res.stdout, /core\.hooksPath: \.githooks/);
  } finally { r.cleanup(); }
});

test('the installed gate runs standalone from the project (no plugin path baked in)', () => {
  const r = makeRepo();
  try {
    install(r.root);
    for (const f of ['gate.mjs', 'register-check.mjs', 'citation-target.mjs', 'sweep-guard.mjs']) assert.ok(!fs.readFileSync(path.join(r.root, '.githooks/machinery', f), 'utf8').includes(PLUGIN.replace(/\\/g, '/')));
    fs.writeFileSync(path.join(r.root, 'docs.md', ), 'x'); execFileSync('git', ['add', '-A'], { cwd: r.root });
    const g = execFileSync(process.execPath, [path.join(r.root, '.githooks/machinery/gate.mjs')], { cwd: r.root, encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' } });
    assert.match(g, /register_check: 0 of 0/);
  } finally { r.cleanup(); }
});

test('install is idempotent and refreshes the stamp', () => {
  const r = makeRepo();
  try {
    install(r.root); fs.writeFileSync(path.join(r.root, '.githooks/machinery/VERSION'), '0.0.0');
    const res = install(r.root); assert.equal(res.code, 0);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks/machinery/VERSION'), 'utf8').trim(), version);
    assert.equal(fs.readFileSync(path.join(r.root, '.claude/machinery/inbox.md'), 'utf8'), '');
  } finally { r.cleanup(); }
});

test('--hosted writes the workflow template; default does not', () => {
  const r = makeRepo();
  try {
    install(r.root); assert.ok(!fs.existsSync(path.join(r.root, '.github/workflows/machinery.yml')));
    install(r.root, '--hosted'); assert.ok(fs.existsSync(path.join(r.root, '.github/workflows/machinery.yml')));
  } finally { r.cleanup(); }
});

test('--machine creates the junction ~/.claude/rules/machinery → rules source (spec I11)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const tempRules = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
  try {
    fs.writeFileSync(path.join(tempRules, 't.md'), '# T\n\n## One\n\n- rule 1\n');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: tempRules }));
    const res = runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
    assert.equal(res.code, 0, res.stderr);
    const link = path.join(home, '.claude', 'rules', 'machinery');
    assert.equal(fs.realpathSync.native(link), fs.realpathSync.native(tempRules));
    assert.equal(runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } }).code, 0); // idempotent
  } finally {
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(tempRules, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('--machine refuses to replace a real directory sitting at the junction path', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const tempRules = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
  try {
    fs.writeFileSync(path.join(tempRules, 't.md'), '# T\n\n## One\n\n- rule 1\n');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: tempRules }));
    const link = path.join(home, '.claude', 'rules', 'machinery');
    fs.mkdirSync(link, { recursive: true });
    fs.writeFileSync(path.join(link, 'keep.md'), 'do not delete me\n');
    const res = runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
    assert.notEqual(res.code, 0);
    assert.ok(fs.existsSync(link));
    assert.ok(fs.existsSync(path.join(link, 'keep.md')));
    assert.equal(fs.readFileSync(path.join(link, 'keep.md'), 'utf8'), 'do not delete me\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(tempRules, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('a foreign .githooks/pre-commit that does not invoke the machinery gate is not overwritten (final review F)', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(r.root, '.githooks'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.githooks', 'pre-commit'), '#!/bin/sh\necho a different, unrelated hook\n');
    const res = install(r.root);
    assert.notEqual(res.code, 0);
    assert.match(res.stderr, /\.githooks[\\/]pre-commit/);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks', 'pre-commit'), 'utf8'), '#!/bin/sh\necho a different, unrelated hook\n');
  } finally { r.cleanup(); }
});

test('an existing pre-commit that already invokes the machinery gate is rewritten (idempotent)', () => {
  const r = makeRepo();
  try {
    install(r.root); // first install writes a gate-invoking pre-commit
    const res = install(r.root); // second install must not refuse its own file
    assert.equal(res.code, 0, res.stderr);
    assert.match(fs.readFileSync(path.join(r.root, '.githooks/pre-commit'), 'utf8'), /machinery\/gate\.mjs/);
  } finally { r.cleanup(); }
});

test('core.hooksPath already pointed elsewhere is not silently repointed (final review F)', () => {
  const r = makeRepo();
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.some-other-hooks'], { cwd: r.root });
    const res = install(r.root);
    assert.notEqual(res.code, 0);
    assert.match(res.stderr, /\.some-other-hooks/);
    assert.equal(execFileSync('git', ['config', 'core.hooksPath'], { cwd: r.root, encoding: 'utf8' }).trim(), '.some-other-hooks');
  } finally { r.cleanup(); }
});

test('RED CHECK: outside a git repository the project install refuses', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  const res = runScript('scripts/install.mjs', { args: ['--root', d], cwd: d });
  assert.notEqual(res.code, 0); assert.match(res.stderr, /git repository/);
});

// Task 9: the two tool-assimilation project files. Ruling (2026-09-05): tool-catalog.json is a team
// decision and is tracked like inbox.md/INDEX.md; observations.json is per-machine measurement and
// is gitignored, never staged.
test('install creates an empty project tool catalog and observation record', () => {
  const r = makeRepo();
  try {
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'tool-catalog.json'), 'utf8')), {});
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'observations.json'), 'utf8')), {});
    assert.match(res.stdout, /created \.claude[\\/]machinery[\\/]tool-catalog\.json/);
    assert.match(res.stdout, /created \.claude[\\/]machinery[\\/]observations\.json/);
  } finally { r.cleanup(); }
});

test('RED CHECK: tool-catalog.json is staged, observations.json is gitignored, not staged', () => {
  const r = makeRepo();
  try {
    install(r.root);
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: r.root, encoding: 'utf8' });
    assert.match(staged, /\.claude\/machinery\/tool-catalog\.json/, 'the shared catalog overlay must be staged');
    assert.doesNotMatch(staged, /\.claude\/machinery\/observations\.json/, 'per-machine measurement must never be staged');
    assert.match(staged, /^\.gitignore$/m, 'the ignore entry travels with the install');
    const ignored = execFileSync('git', ['check-ignore', '.claude/machinery/observations.json'], { cwd: r.root, encoding: 'utf8' });
    assert.match(ignored, /observations\.json/, 'observations.json must actually be gitignored, not merely unstaged this once');
    // The observer is alive: the tracked sibling is NOT reported ignored by the same query.
    assert.throws(() => execFileSync('git', ['check-ignore', '.claude/machinery/tool-catalog.json'], { cwd: r.root, encoding: 'utf8', stdio: 'pipe' }));
  } finally { r.cleanup(); }
});

test('the .gitignore entry is appended once, after existing content, even when that content is CRLF with no trailing newline', () => {
  const r = makeRepo();
  try {
    fs.writeFileSync(path.join(r.root, '.gitignore'), 'node_modules/\r\ndist/');
    install(r.root);
    const first = fs.readFileSync(path.join(r.root, '.gitignore'), 'utf8');
    assert.equal(first, 'node_modules/\r\ndist/\n.claude/machinery/observations.json\n');
    install(r.root); // idempotent: no second line, whatever the line endings already in the file
    assert.equal(fs.readFileSync(path.join(r.root, '.gitignore'), 'utf8'), first);
    fs.writeFileSync(path.join(r.root, '.gitignore'), 'node_modules/\r\n.claude/machinery/observations.json\r\n');
    const res = install(r.root);
    assert.equal(fs.readFileSync(path.join(r.root, '.gitignore'), 'utf8'), 'node_modules/\r\n.claude/machinery/observations.json\r\n');
    assert.doesNotMatch(res.stdout, /added .*observations\.json to \.gitignore/);
  } finally { r.cleanup(); }
});

test('an observations.json already tracked from before the ruling is named, not silently left tracked', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(r.root, '.claude', 'machinery'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.claude', 'machinery', 'observations.json'), '{}\n');
    execFileSync('git', ['add', '.claude/machinery/observations.json'], { cwd: r.root });
    execFileSync('git', ['commit', '-q', '-m', 'tracked before the ruling'], { cwd: r.root });
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stderr, /observations\.json is tracked/);
    assert.match(res.stderr, /git rm --cached/);
  } finally { r.cleanup(); }
});
