import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { pending, parseInbox, appendEntry } from '../scripts/lib/inbox.mjs';
import { projectInbox, universalInbox } from '../scripts/lib/config.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
// capture.mjs (Task 8) is not landed in this worktree yet — seed the inbox directly with the
// same lib/inbox.mjs primitive capture.mjs would call, writing to the same inbox file.
function withHome(h, fn) {
  const prev = process.env.MACHINERY_HOME;
  process.env.MACHINERY_HOME = h;
  try { return fn(); } finally { if (prev === undefined) delete process.env.MACHINERY_HOME; else process.env.MACHINERY_HOME = prev; }
}
function projectWithPending(h) {
  const r = makeRepo();
  runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '--no-verify', '-m', 'install');
  appendEntry(projectInbox(r.root), { marker: 'PRULE', text: 'PRULE: never guess a path', session: 's' });
  return r;
}

test('place appends a bullet under an existing heading and creates a missing one', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')); const f = path.join(d, 'rules', 'a.md'); fs.mkdirSync(path.dirname(f));
  fs.writeFileSync(f, '# A\n\n## One\n\n- old\n');
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'One', '--text', 'new rule'] }).code, 0);
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'Two', '--text', 'another'] }).code, 0);
  assert.equal(fs.readFileSync(f, 'utf8'), '# A\n\n## One\n\n- old\n- new rule\n\n## Two\n\n- another\n');
});

test('place refuses a file outside a rules directory (spec I34)', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'x-')), 'notes.md'); fs.writeFileSync(f, '');
  assert.notEqual(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'S', '--text', 't'] }).code, 0);
});

test('bump patch-increments plugin.json', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-')); fs.mkdirSync(path.join(d, '.claude-plugin'));
  fs.writeFileSync(path.join(d, '.claude-plugin', 'plugin.json'), '{\n  "name": "x",\n  "version": "0.1.9"\n}\n');
  const res = runScript('scripts/bump.mjs', { args: ['--plugin', d] });
  assert.equal(res.stdout.trim(), '0.1.10');
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, '.claude-plugin', 'plugin.json'), 'utf8')).version, '0.1.10');
});

test('intake list shows pending project entries; commit files, reindexes, dispositions, commits in the root (spec I29, I30)', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const list = runScript('scripts/intake.mjs', { args: ['list', '--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.match(list.stdout, /\tPRULE\t.*inbox\.md\tPRULE: never guess a path/);
    const stamp = list.stdout.trim().split('\t')[0];
    const rf = path.join(r.root, '.claude', 'rules', 'straight-talk.md');
    runScript('scripts/place.mjs', { args: ['--file', rf, '--section', 'Claims', '--text', 'Never guess a path; resolve it.'] });
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', stamp, '--home', '.claude/rules/straight-talk.md § Claims'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 0);
    const [e] = parseInbox(fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'inbox.md'), 'utf8'));
    assert.equal(e.state, 'FILED'); assert.match(e.disposition, /filed → \.claude\/rules\/straight-talk\.md § Claims/);
    assert.match(g(r.root, 'log', '-1', '--format=%s'), /^rule: PRULE: never guess a path/);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root }).code, 0);
  } finally { r.cleanup(); }
});

test('intake commit --kind project refuses from inside a worktree (spec I29)', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const wt = addWorktree(r.root, 'feat');
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', wt, '--stamp', 'x', '--home', 'y'], cwd: wt, env: { MACHINERY_HOME: h } });
    assert.notEqual(res.code, 0); assert.match(res.stderr, /root session/);
  } finally { r.cleanup(); }
});

test('universal intake bumps the plugin version in the same commit (spec I31)', () => {
  // A fake plugin checkout: rules/, inbox.md, register/, .claude-plugin/plugin.json, git-initialised.
  const r = makeRepo(); const h = home();
  try {
    const plug = path.join(r.root, 'plugins', 'machinery');
    fs.mkdirSync(path.join(plug, 'rules'), { recursive: true }); fs.mkdirSync(path.join(plug, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(plug, 'rules', 'straight-talk.md'), '# S\n\n## Claims\n\n- a\n');
    fs.writeFileSync(path.join(plug, '.claude-plugin', 'plugin.json'), '{"name":"machinery","version":"0.1.0"}');
    fs.writeFileSync(path.join(plug, 'inbox.md'), '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(plug, 'rules'), '--out', path.join(plug, 'register', 'INDEX.md')] });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'plugin');
    fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: path.join(plug, 'rules') }));
    withHome(h, () => appendEntry(universalInbox(), { marker: 'URULE', text: 'URULE: say less', session: 's' }));
    const stamp = runScript('scripts/intake.mjs', { args: ['list'], cwd: r.root, env: { MACHINERY_HOME: h } }).stdout.trim().split('\t')[0];
    runScript('scripts/place.mjs', { args: ['--file', path.join(plug, 'rules', 'straight-talk.md'), '--section', 'Claims', '--text', 'Say less.'] });
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'universal', '--stamp', stamp, '--home', 'rules/straight-talk.md § Claims'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(JSON.parse(fs.readFileSync(path.join(plug, '.claude-plugin', 'plugin.json'), 'utf8')).version, '0.1.1');
    assert.match(g(r.root, 'show', '--stat', 'HEAD'), /plugin\.json/);
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', plug, '--universal'], cwd: plug }).code, 0);
  } finally { r.cleanup(); }
});

test('intake commit --kind universal commits in the rules source\'s own checkout, not the worktree\'s main checkout (I30 regression)', () => {
  // Reproduces the dogfood defect: the plugin lives in a worktree. projectRoot()
  // resolves through the worktree's common dir to the MAIN checkout, so a naive
  // repo choice would try to `git add`/`git commit` paths that don't exist there.
  const r = makeRepo(); const h = home();
  try {
    const wt = addWorktree(r.root, 'wt');
    const plug = path.join(wt, 'plug');
    fs.mkdirSync(path.join(plug, 'rules'), { recursive: true }); fs.mkdirSync(path.join(plug, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(plug, 'rules', 't.md'), '# T\n\n## Claims\n\n- a\n');
    fs.writeFileSync(path.join(plug, '.claude-plugin', 'plugin.json'), '{"name":"machinery","version":"0.1.0"}');
    fs.writeFileSync(path.join(plug, 'inbox.md'), '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(plug, 'rules'), '--out', path.join(plug, 'register', 'INDEX.md')] });
    g(wt, 'add', '-A'); g(wt, 'commit', '-q', '-m', 'plugin');
    fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: path.join(plug, 'rules') }));
    withHome(h, () => appendEntry(universalInbox(), { marker: 'URULE', text: 'URULE: file it where it lives', session: 's' }));
    const mainHeadBefore = g(r.root, 'rev-parse', 'HEAD');
    const env = { MACHINERY_HOME: h, CLAUDE_PLUGIN_ROOT: plug };
    const stamp = runScript('scripts/intake.mjs', { args: ['list'], cwd: wt, env }).stdout.trim().split('\t')[0];
    runScript('scripts/place.mjs', { args: ['--file', path.join(plug, 'rules', 't.md'), '--section', 'Claims', '--text', 'File it where it lives.'] });
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'universal', '--root', wt, '--stamp', stamp, '--home', 'rules/t.md § Claims'], cwd: wt, env });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.match(g(wt, 'log', '-1', '--format=%s'), /^rule:/);
    assert.equal(g(r.root, 'rev-parse', 'HEAD'), mainHeadBefore);
  } finally { r.cleanup(); }
});

test('RED CHECK: intake commit with an unknown stamp fails and commits nothing', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const before = g(r.root, 'rev-parse', 'HEAD');
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', 'nope', '--home', 'x'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.notEqual(res.code, 0); assert.equal(g(r.root, 'rev-parse', 'HEAD'), before);
  } finally { r.cleanup(); }
});
