import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/WorktreeCreate.json'), 'utf8'));
const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
// The fixture's own worktree_path (a fixed, unrelated path) would otherwise
// win over `name` under the documented-shape priority — drop it here so
// these name-driven calls exercise the name/base_path fallback, as the
// coordinator's ruling intends. JSON.stringify omits undefined-valued keys.
const run = (root, name, extra = {}) => runScript('scripts/worktree-create.mjs', { stdin: JSON.stringify({ ...base, worktree_path: undefined, cwd: root, name, ...extra }), cwd: root, env: { MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) } });

test('branch = name verbatim, stdout is the path only, base = local HEAD when baseRef is head', () => {
  const r = makeRepo({ withOrigin: true });
  try {
    fs.mkdirSync(path.join(r.root, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.claude', 'settings.json'), '{"worktree":{"baseRef":"head"}}');
    fs.writeFileSync(path.join(r.root, 'local.txt'), 'ahead'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'ahead of origin');
    const res = run(r.root, 'feat-a');
    assert.equal(res.code, 0, res.stderr);
    const p = res.stdout.trim();
    assert.equal(res.stdout.trim().split('\n').length, 1);
    assert.equal(g(p, 'branch', '--show-current'), 'feat-a');
    assert.equal(g(p, 'rev-parse', 'HEAD'), g(r.root, 'rev-parse', 'HEAD'));
  } finally { r.cleanup(); }
});

test('default (fresh) branches from the origin default, and strips a worktree- prefix', () => {
  const r = makeRepo({ withOrigin: true });
  try {
    fs.writeFileSync(path.join(r.root, 'local.txt'), 'ahead'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'ahead');
    const res = run(r.root, 'worktree-feat-b');
    const p = res.stdout.trim();
    assert.equal(g(p, 'branch', '--show-current'), 'feat-b');
    assert.equal(g(p, 'rev-parse', 'HEAD'), g(r.root, 'rev-parse', 'origin/main'));
  } finally { r.cleanup(); }
});

test('an existing branch is attached, not recreated', () => {
  const r = makeRepo();
  try { g(r.root, 'branch', 'exists'); const res = run(r.root, 'exists'); assert.equal(g(res.stdout.trim(), 'branch', '--show-current'), 'exists'); }
  finally { r.cleanup(); }
});

test('fails CLOSED: empty name → non-zero, nothing on stdout, reason on stderr', () => {
  const r = makeRepo();
  try { const res = run(r.root, ''); assert.notEqual(res.code, 0); assert.equal(res.stdout, ''); assert.match(res.stderr, /empty worktree name/); }
  finally { r.cleanup(); }
});

test('documented payload shape: worktree_path (no name) sets stdout, branch, and registers the worktree', () => {
  const r = makeRepo();
  try {
    const wp = path.join(r.root, '.claude', 'worktrees', 'docshape');
    const res = runScript('scripts/worktree-create.mjs', {
      stdin: JSON.stringify({ ...base, cwd: r.root, worktree_path: wp }),
      cwd: r.root,
      env: { MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) },
    });
    assert.equal(res.code, 0, res.stderr);
    assert.equal(res.stdout.trim(), wp);
    assert.equal(g(wp, 'branch', '--show-current'), 'docshape');
    assert.match(g(r.root, 'worktree', 'list'), /docshape/);
  } finally { r.cleanup(); }
});

test('RED CHECK: the observed-marker file is written when the hook runs', () => {
  const r = makeRepo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  try {
    runScript('scripts/worktree-create.mjs', { stdin: JSON.stringify({ ...base, worktree_path: undefined, cwd: r.root, name: 'm' }), cwd: r.root, env: { MACHINERY_HOME: home } });
    assert.ok(fs.existsSync(path.join(home, '.claude', 'machinery-observed-worktree')));
  } finally { r.cleanup(); }
});
