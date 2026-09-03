#!/usr/bin/env node
// Story: hooks/worktree-create.md. Ported from create_worktree.py. Fails CLOSED.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readPayload } from './lib/stdin.mjs';
import { git, gitExe } from './lib/git.mjs';
import { baseRef } from './lib/base-ref.mjs';

const fail = (msg) => { process.stderr.write(`WorktreeCreate hook: ${msg}\n`); process.exit(1); };
function gitLoud(args, cwd) {
  const r = spawnSync(gitExe(), args, { cwd, encoding: 'utf8' });
  if (r.stdout) process.stderr.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

const home = process.env.MACHINERY_HOME || os.homedir();
try { fs.mkdirSync(path.join(home, '.claude'), { recursive: true }); fs.writeFileSync(path.join(home, '.claude', 'machinery-observed-worktree'), new Date().toISOString()); } catch {}

const p = readPayload() ?? {};
// Documented WorktreeCreate payload (Claude Code hooks reference) carries
// worktree_path (the absolute path Claude Code wants the worktree created
// at) and worktree_source — not name/worktree_name/base_path/git_ref. Read
// worktree_path first; fall back to the older name/base_path shape.
const wp = p.worktree_path ? path.resolve(p.worktree_path) : null;
const name = wp ? path.basename(wp) : (p.name || p.worktree_name || '');
const repo = p.cwd || process.cwd();
const basePath = wp ? path.dirname(wp) : (p.base_path || path.join(repo, '.claude', 'worktrees'));
const branch = name.replace(/^worktree-/, '');
if (!branch) fail(`empty worktree name; payload had name=${name === '' ? '""' : name}`);
const ref = p.git_ref || baseRef(repo);
const dest = path.join(basePath, branch);
fs.mkdirSync(basePath, { recursive: true });
const exists = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repo).code === 0;
const rc = exists ? gitLoud(['worktree', 'add', dest, branch], repo) : gitLoud(['worktree', 'add', dest, '-b', branch, ref], repo);
if (rc !== 0) fail(`git worktree add failed (exit ${rc})`);
process.stdout.write(dest + '\n');
