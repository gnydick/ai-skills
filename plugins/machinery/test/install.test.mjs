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

test('RED CHECK: outside a git repository the project install refuses', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  const res = runScript('scripts/install.mjs', { args: ['--root', d], cwd: d });
  assert.notEqual(res.code, 0); assert.match(res.stderr, /git repository/);
});
