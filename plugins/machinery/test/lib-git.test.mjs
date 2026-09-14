import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { git, gitRaw, gitLines } from '../scripts/lib/git.mjs';

// Story: measured incident, 2026-09-02 (see lib/git.mjs's own comment). A
// real `git commit` from a linked worktree exports GIT_DIR to every hook it
// runs, never GIT_WORK_TREE, and — for the partial commits this repo's own
// convention requires (explicit pathspecs) — GIT_INDEX_FILE pointing at the
// in-flight temp index. Inherited as-is by a spawned git, GIT_DIR without
// GIT_WORK_TREE breaks every `:./relative` pathspec the gate's checks
// depend on; GIT_INDEX_FILE must still be honoured, or a partial commit's
// check silently reads the wrong (whole-worktree) snapshot.

function withEnv(key, value, fn) {
  const saved = process.env[key];
  process.env[key] = value;
  const restore = () => { if (saved === undefined) delete process.env[key]; else process.env[key] = saved; };
  let r;
  try { r = fn(); } catch (e) { restore(); throw e; }
  if (r && typeof r.then === 'function') return r.finally(restore); // an async body keeps the value until it settles
  restore();
  return r;
}

// The bug needs cwd to be a SUBDIRECTORY of the worktree, not the worktree
// root itself — the gate's checks always call git() with `root` set to
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

// Ticket #19 (Gabe, 2026-09-05): a 1.42 MB merge diff through the sync wrapper hit
// spawnSync's 1 MiB default buffer — Node killed git (ENOBUFS, SIGTERM) and the wrapper
// handed back code 1 with an EMPTY stderr, so the gate said `git diff failed:` and nothing.
// The owner rejected a bigger buffer in favour of streaming (gitLines, below); the sync
// wrappers stay for small queries and must at least NAME the death when it happens.
const BIG_LINES = 40_000;
const bigLine = (i) => `big line ${String(i).padStart(6, '0')} ${'x'.repeat(24)}`;
function bigRepo() {
  const r = makeRepo();
  const text = Array.from({ length: BIG_LINES }, (_, i) => bigLine(i)).join('\n') + '\n';
  fs.writeFileSync(path.join(r.root, 'big.txt'), text);
  if (fs.statSync(path.join(r.root, 'big.txt')).size <= 1024 * 1024) throw new Error('fixture is not over 1 MiB');
  // A second blob of 1-, 2-, 3- and 4-byte characters, small enough to be quick but spanning
  // several 64 KiB pipe chunks, so chunk boundaries fall inside characters and inside lines.
  fs.writeFileSync(path.join(r.root, 'multi.txt'), (MULTI + '\n').repeat(MULTI_LINES));
  execFileSync('git', ['add', 'big.txt', 'multi.txt'], { cwd: r.root });
  execFileSync('git', ['commit', '-q', '-m', 'big'], { cwd: r.root });
  return r;
}
const MULTI = 'x§é✓😀y';
const MULTI_LINES = 20_000;
// Built once (fix round 1): every test below only reads it, so they share one copy.
const big = bigRepo();
after(() => big.cleanup());

test('RED CHECK: the sync git() on an output over 1 MiB names ENOBUFS and the signal in stderr — never an empty string (#19)', () => {
  const res = git(['show', 'HEAD:big.txt'], big.root);
  assert.notEqual(res.code, 0, 'the sync wrapper has no business succeeding here: a bigger buffer was rejected, streaming is the fix');
  assert.match(res.stderr, /ENOBUFS/, `stderr was ${JSON.stringify(res.stderr)}`);
  assert.match(res.stderr, /SIGTERM/, `stderr was ${JSON.stringify(res.stderr)}`);
  const raw = gitRaw(['show', 'HEAD:big.txt'], big.root);
  assert.match(raw.stderr, /ENOBUFS/, `gitRaw stderr was ${JSON.stringify(raw.stderr)}`);
});

test('gitLines() streams that same >1 MiB blob whole, line by line, where the sync wrapper died (#19)', async () => {
  let count = 0; let first = null; let last = null;
  for await (const line of gitLines(['show', 'HEAD:big.txt'], big.root)) { if (count === 0) first = line; last = line; count += 1; }
  assert.equal(count, BIG_LINES, 'every line, and no phantom empty line after the final newline');
  assert.equal(first, bigLine(0));
  assert.equal(last, bigLine(BIG_LINES - 1));
});

test('pin: lines and multi-byte characters straddling the pipe\'s chunk boundaries arrive intact through gitLines (fix round 1)', async () => {
  // A pin, not coverage of the splitter's rule — lib-lines.test.mjs cuts at every byte. This
  // only shows the real pipe path goes through that one splitter; it passed before the move too.
  let count = 0; let bad = 0;
  for await (const line of gitLines(['show', 'HEAD:multi.txt'], big.root)) { count += 1; if (line !== MULTI) bad += 1; }
  assert.equal(count, MULTI_LINES);
  assert.equal(bad, 0);
});

test('gitLines() spawns nothing until the first next(): a handle made and never iterated leaves no git blocked on a pipe (fix round 1)', async () => {
  const stream = gitLines(['show', 'HEAD:big.txt'], big.root);
  assert.equal(stream.pid, undefined, 'pid before iteration');
  const iter = stream[Symbol.asyncIterator]();
  assert.equal(stream.pid, undefined, 'getting the iterator is not iterating');
  assert.equal((await iter.next()).value, bigLine(0));
  assert.equal(typeof stream.pid, 'number', 'pid after the first next()');
  await iter.return();
});

test('gitLines(): a second iteration of one handle throws naming it as consumed — never zero lines that read as an empty diff (fix round 1)', async () => {
  const stream = gitLines(['show', 'HEAD:big.txt'], big.root);
  let count = 0;
  for await (const _ of stream) count += 1;
  assert.equal(count, BIG_LINES, 'positive control: the first iteration saw every line');
  assert.throws(() => stream[Symbol.asyncIterator](), /already consumed/);
});

test('gitLines(): a child killed mid-stream rejects — naming the signal when killed through its handle, the exit code when killed from outside — so a truncated output can never read as a complete one (#19)', async () => {
  // After the first line the child is blocked on a full pipe with most of its 1.3 MiB still
  // unwritten, so the kill lands mid-stream by construction.
  const drain = async (iter) => { for (let n = await iter.next(); !n.done; n = await iter.next()); };
  let stream = gitLines(['show', 'HEAD:big.txt'], big.root);
  let iter = stream[Symbol.asyncIterator]();
  assert.equal((await iter.next()).value, bigLine(0));
  stream.kill();
  await assert.rejects(drain(iter), /killed by SIGTERM/);
  // Killed from outside (what a timeout or an operator does). Measured 2026-09-05: on Windows
  // this is a TerminateProcess Node reports as exit 1 with no signal; on POSIX it is a signal.
  // Either way it must reject. Observer alive: process.kill throws ESRCH if the pid is gone.
  stream = gitLines(['show', 'HEAD:big.txt'], big.root);
  iter = stream[Symbol.asyncIterator]();
  assert.equal((await iter.next()).value, bigLine(0));
  process.kill(stream.pid);
  await assert.rejects(drain(iter), /killed by SIG|exit [1-9]/);
});

test('gitLines(): a git that exits non-zero rejects naming the exit code and git\'s own words', async () => {
  const r = makeRepo();
  try {
    await assert.rejects(async () => { for await (const _ of gitLines(['show', 'HEAD:nope.txt'], r.root)); }, (e) => /exit 128/.test(e.message) && /nope\.txt/.test(e.message));
  } finally { r.cleanup(); }
});

test('git() and gitLines(): a git that cannot be spawned name ENOENT — the failure says what it looked for (rules/environment-and-platform.md § Resolving a tool)', async () => {
  const r = makeRepo();
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'machinery-nopath-'));
  try {
    assert.equal(git(['--version'], r.root).code, 0, 'warm the resolved-exe cache before the PATH goes away');
    await withEnv('PATH', emptyDir, async () => {
      const res = git(['--version'], r.root);
      assert.notEqual(res.code, 0);
      assert.match(res.stderr, /ENOENT/, `stderr was ${JSON.stringify(res.stderr)}`);
      await assert.rejects(async () => { for await (const _ of gitLines(['--version'], r.root)); }, /ENOENT/);
    });
  } finally { r.cleanup(); fs.rmSync(emptyDir, { recursive: true, force: true }); }
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
