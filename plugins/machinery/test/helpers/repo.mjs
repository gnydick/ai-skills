import './env.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// GIT_* is scrubbed at import by ./env.mjs — the one place, with the incident it came from.
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
