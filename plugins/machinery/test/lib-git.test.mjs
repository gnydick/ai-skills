import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { git, gitRaw } from '../scripts/lib/git.mjs';

// Story: measured incident, 2026-09-02 (see lib/git.mjs's own comment). A
// real `git commit` from a linked worktree exports GIT_DIR to every hook it
// runs, never GIT_WORK_TREE, and — for the partial commits this repo's own
// convention requires (explicit pathspecs) — GIT_INDEX_FILE pointing at the
// in-flight temp index. Inherited as-is by a spawned git, GIT_DIR without
// GIT_WORK_TREE breaks every `:./relative` pathspec gate/citation-target.mjs
// depends on; GIT_INDEX_FILE must still be honoured, or a partial commit's
// check silently reads the wrong (whole-worktree) snapshot.

function withEnv(key, value, fn) {
  const saved = process.env[key];
  process.env[key] = value;
  try { return fn(); } finally { if (saved === undefined) delete process.env[key]; else process.env[key] = saved; }
}

// The bug needs cwd to be a SUBDIRECTORY of the worktree, not the worktree
// root itself — citation-target.mjs always calls git() with `root` set to
// e.g. `<worktree>/plugins/machinery`. From the worktree root itself the
// (wrong) "cwd is the work-tree top" assumption GIT_DIR-without-GIT_WORK_TREE
// makes happens to hold, so a test at the worktree root would pass on the
// unfixed code and prove nothing.
test('git()/gitRaw() still resolve a :./ pathspec, from a SUBDIRECTORY, when the process has inherited a linked-worktree GIT_DIR with no GIT_WORK_TREE', () => {
  const r = makeRepo();
  try {
    const wt = addWorktree(r.root, 'feature-y');
    const sub = path.join(wt, 'sub');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'inner.txt'), 'inner content\n');
    execFileSync('git', ['add', 'sub/inner.txt'], { cwd: wt });
    execFileSync('git', ['commit', '-q', '-m', 'add sub/inner.txt'], { cwd: wt });
    const gitDirRes = git(['rev-parse', '--absolute-git-dir'], sub);
    assert.equal(gitDirRes.code, 0, gitDirRes.stderr);

    withEnv('GIT_DIR', gitDirRes.stdout, () => {
      const res = git(['show', ':./inner.txt'], sub);
      assert.equal(res.code, 0, res.stderr);
      assert.match(res.stdout, /inner content/);

      const raw = gitRaw(['show', ':./inner.txt'], sub);
      assert.equal(raw.code, 0, raw.stderr);
      assert.match(raw.stdout, /inner content/);
    });
  } finally { r.cleanup(); }
});

test('RED CHECK: raw git (no scrub), from that same subdirectory, really does fail under the contamination — proves the fixture exercises the bug', () => {
  const r = makeRepo();
  try {
    const wt = addWorktree(r.root, 'feature-z');
    const sub = path.join(wt, 'sub');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'inner.txt'), 'inner content\n');
    execFileSync('git', ['add', 'sub/inner.txt'], { cwd: wt });
    execFileSync('git', ['commit', '-q', '-m', 'add sub/inner.txt'], { cwd: wt });
    const gitDirRes = git(['rev-parse', '--absolute-git-dir'], sub);
    const raw = spawnSync('git', ['show', ':./inner.txt'], { cwd: sub, encoding: 'utf8', env: { ...process.env, GIT_DIR: gitDirRes.stdout } });
    assert.notEqual(raw.status, 0);
    assert.match(raw.stderr, /ambiguous argument/);
  } finally { r.cleanup(); }
});

test('GIT_INDEX_FILE survives the scrub, so a partial commit\'s temp index still wins over the real one', () => {
  const r = makeRepo();
  try {
    // Real index: stage a.txt.
    fs.writeFileSync(path.join(r.root, 'a.txt'), 'a\n');
    execFileSync('git', ['add', 'a.txt'], { cwd: r.root });
    // Copy that staged state into an alternate index file (stands in for git's
    // real next-index-<pid>.lock during a partial commit), then unstage a.txt
    // from the real index so the two genuinely disagree.
    const altIndex = path.join(r.root, '.git', 'alt-index');
    fs.copyFileSync(path.join(r.root, '.git', 'index'), altIndex);
    execFileSync('git', ['reset', 'a.txt'], { cwd: r.root });
    assert.equal(git(['diff', '--cached', '--name-only'], r.root).stdout, '');

    withEnv('GIT_INDEX_FILE', altIndex, () => {
      const res = git(['diff', '--cached', '--name-only'], r.root);
      assert.equal(res.code, 0, res.stderr);
      assert.equal(res.stdout, 'a.txt');
    });
  } finally { r.cleanup(); }
});
