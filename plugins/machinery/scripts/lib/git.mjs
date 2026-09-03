import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let exe = null;
// Resolved once (union: rules/tool-output.md § A check that cannot run fails
// loudly). Bare `git` is fine on every platform; the loud failure names it.
export function gitExe() {
  if (exe) return exe;
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) throw new Error('git not found; looked for: `git` on PATH');
  exe = 'git';
  return exe;
}

// Measured incident, 2026-09-02: a real `git commit` from a LINKED WORKTREE
// exports GIT_DIR (the worktree's admin dir under the main .git) to every
// hook it runs, but never GIT_WORK_TREE — and, for a partial commit (explicit
// pathspecs, this repo's own commit convention, rules/worktree-discipline.md
// § Committing from it), GIT_INDEX_FILE points at the in-flight temp index
// holding exactly that partial-commit snapshot. Inherited as-is, a spawned
// git with GIT_DIR set and GIT_WORK_TREE absent refuses any cwd-relative
// pathspec (`:./path`, used by gate/citation-target.mjs) with "ambiguous
// argument" — confirmed by reproducing it directly. Stripping GIT_DIR (and
// GIT_WORK_TREE, in case something else ever sets it inconsistently) lets git
// rediscover the real worktree from `cwd` the normal way; GIT_INDEX_FILE is
// deliberately kept, because dropping it would make `--cached` reads fall
// back to the worktree's permanent index instead of the partial commit's
// temp one — silently checking the wrong snapshot.
function spawnEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return env;
}

export function git(args, cwd) {
  const r = spawnSync(gitExe(), args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv() });
  return { code: r.status ?? 1, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
}

// Same as git(), but stdout is NOT trimmed (final review A2): a blob's leading/trailing blank
// lines are real content — trimming shifts every `path:line` citation against it.
export function gitRaw(args, cwd) {
  const r = spawnSync(gitExe(), args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv() });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: (r.stderr ?? '').trim() };
}

export function realDir(p) { return fs.existsSync(p) ? fs.realpathSync.native(p) : path.resolve(p); }
