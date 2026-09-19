import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/SessionStart.json'), 'utf8'));
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
const banner = (cwd) => JSON.parse(runScript('scripts/banner.mjs', { stdin: JSON.stringify({ ...base, cwd }), cwd, env: { MACHINERY_HOME: home() } }).stdout).hookSpecificOutput.additionalContext;
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };

function oldProject() {
  const r = makeRepo();
  write(r.root, 'docs/dictated-specs/collision-model.md', '# Collision\n\n## A\n');
  write(r.root, 'docs/dictated-specs/tooling.md', '# Tooling\n');
  write(r.root, 'docs/adr/0001-x.md', '# ADR\n');
  write(r.root, 'docs/superpowers/specs/2026-06-21-x-design.md', '# X\n');
  write(r.root, 'docs/superpowers/plans/2026-06-21-x.md', '# P\n');
  write(r.root, 'docs/superpowers/plans/2026-06-22-y.md', '---\nkind: plan\nticket: 1\nstatus: done\n---\n# P\n');
  return r;
}

test('the banner names each kind of unmigrated content with its count, with no gate installed', () => {
  const r = oldProject();
  try {
    const t = banner(r.root);
    assert.match(t, /gate: not installed/);
    assert.match(t, /slip box: NOT MIGRATED — 2 old spec file\(s\) in docs\/dictated-specs\/, docs\/adr\/ \(1 file\(s\)\), 2 superpowers file\(s\) without front matter; run node ".*intake\.mjs" migrate --plan <file>/);
  } finally { r.cleanup(); }
});

test('install prints the same line and migrates nothing', () => {
  const r = oldProject();
  try {
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /slip box: NOT MIGRATED — 2 old spec file\(s\)/);
    assert.ok(fs.existsSync(path.join(r.root, 'docs/adr/0001-x.md')), 'install moved nothing');
  } finally { r.cleanup(); }
});

// docs/adr as a regular FILE: existsSync passes, readdirSync throws ENOTDIR. It stands for every
// way unmigrated() can throw on a directory the installer never used to walk (EACCES too).
// docs/dictated-specs cannot be the fixture: install mkdirs that one itself, so a file there
// crashes install before the slip box check is ever reached.
const cannotCheck = () => { const r = makeRepo(); fs.mkdirSync(path.join(r.root, 'docs')); fs.writeFileSync(path.join(r.root, 'docs', 'adr'), 'not a directory\n'); return r; };

// Measured 2026-09-19: with the check unguarded and mid-install, the throw escaped installProject
// after the gate files were written but before core.hooksPath was set and the layout staged — a
// half install that looked like a crash. It is now last, and guarded.
test('install survives a slip box check that throws: it still sets the hooks path, stages the layout, and says so', () => {
  const r = cannotCheck();
  try {
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.match(res.stdout, /slip box: could not check — /);
    assert.equal(g(r.root, 'config', 'core.hooksPath'), '.githooks');
    assert.match(res.stdout, /core\.hooksPath: \.githooks/);
    assert.ok(g(r.root, 'diff', '--cached', '--name-only').length > 0, 'the layout is staged');
  } finally { r.cleanup(); }
});

test('the banner degrades one line when the slip box check throws, and keeps the rest', () => {
  const r = cannotCheck();
  try {
    const t = banner(r.root);
    assert.match(t, /slip box: could not check — /);
    assert.match(t, /gate: not installed/);
    assert.match(t, /pending: project \d+, universal \d+/);
  } finally { r.cleanup(); }
});

// Owner, 2026-09-19 (the Task 6 and Task 7 rulings): the tree being committed is the tree that
// counts. A migration done on a branch must stop the nagging in that worktree. Only this line
// moves to checkoutRoot — the gate stamp, hooks path and hosted check belong to the main checkout.
test('the slip box line follows the checkout: migrated in a worktree, still unmigrated in main', () => {
  const r = makeRepo();
  try {
    write(r.root, 'docs/adr/0001-x.md', '# ADR\n');
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'old layout');
    const wt = addWorktree(r.root, 'feat');
    g(wt, 'rm', '-r', '-q', 'docs/adr');
    write(wt, 'docs/dictated-specs/INDEX.md', '# index\n');
    g(wt, 'add', '-A'); g(wt, 'commit', '-q', '-m', 'migrated on the branch');
    assert.doesNotMatch(banner(wt), /slip box/);
    assert.match(banner(r.root), /slip box: NOT MIGRATED — docs\/adr\/ \(1 file\(s\)\)/);
  } finally { r.cleanup(); }
});

test('RED CHECK: a migrated project gets no slip box line at all', () => {
  const r = makeRepo();
  try {
    write(r.root, 'docs/dictated-specs/INDEX.md', '# index\n');
    write(r.root, 'docs/superpowers/plans/2026-06-22-y.md', '---\nkind: plan\nticket: 1\nstatus: done\n---\n# P\n');
    assert.doesNotMatch(banner(r.root), /slip box/);
  } finally { r.cleanup(); }
});
