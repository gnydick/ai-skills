import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// A fixture repo must never inherit the caller's git environment. Git runs a
// pre-commit hook with GIT_DIR and GIT_INDEX_FILE exported, and from a LINKED
// WORKTREE both are absolute (from the main checkout they are empty and
// `.git/index`, which resolve harmlessly against whatever cwd a child uses).
// Inherited, those absolute values make every `git` below operate on the outer
// repository instead of the fixture: the suite's own commits then re-enter the
// outer pre-commit hook — which fails with "Cannot find module
// <fixture>/scripts/build-skills.mjs" — and `git add` writes fixture content
// into the outer index. Measured 2026-09-02: committing from a worktree left
// `# fixture` staged over this repo's README.md. Scrubbed once at import,
// because every test file that spawns git reaches git through this module, and
// execFileSync/spawnSync inherit process.env by default.
for (const k of Object.keys(process.env)) if (k.startsWith('GIT_')) delete process.env[k];

const sh = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function makeRepo({ withOrigin = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'machinery-'));
  const root = path.join(base, 'repo');
  fs.mkdirSync(root);
  sh(['init', '-q', '-b', 'main'], root);
  sh(['config', 'user.email', 't@example.com'], root);
  sh(['config', 'user.name', 'Test'], root);
  fs.writeFileSync(path.join(root, 'README.md'), '# fixture\n');
  sh(['add', 'README.md'], root);
  sh(['commit', '-q', '-m', 'init'], root);
  let origin;
  if (withOrigin) {
    origin = path.join(base, 'origin.git');
    sh(['init', '-q', '--bare', '-b', 'main', origin], base);
    sh(['remote', 'add', 'origin', origin], root);
    sh(['push', '-q', '-u', 'origin', 'main'], root);
    sh(['remote', 'set-head', 'origin', 'main'], root);
  }
  const realRoot = fs.realpathSync.native(root);
  return { root: realRoot, origin, cleanup: () => fs.rmSync(base, { recursive: true, force: true, maxRetries: 5 }) };
}

export function addWorktree(root, name) {
  const wt = path.join(root, '.claude', 'worktrees', name);
  sh(['worktree', 'add', '-q', wt, '-b', name], root);
  return fs.realpathSync.native(wt);
}

export function commitAll(root, message) {
  sh(['add', '-A'], root);
  sh(['commit', '-q', '-m', message], root);
  return sh(['rev-parse', 'HEAD'], root);
}
