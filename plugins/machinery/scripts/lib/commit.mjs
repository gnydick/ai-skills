// Generic: one commit of exactly the named paths (the worktree skill's commit rule). A path that
// no longer exists is staged as a removal: `git add` refuses a path that is gone from both the
// tree and the index (a `git mv` source), so those go through `git rm --cached --ignore-unmatch`.
// Absolute paths are made relative to the repository.
import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';

export function commitPaths(repo, paths, message) {
  const rel = [...new Set(paths.map((p) => (path.isAbsolute(p) ? path.relative(repo, p) : p).split(path.sep).join('/')))];
  const present = rel.filter((p) => fs.existsSync(path.join(repo, p)));
  const gone = rel.filter((p) => !fs.existsSync(path.join(repo, p)));
  const add = present.length ? git(['add', '--', ...present], repo) : { code: 0 };
  if (add.code !== 0) throw new Error(`git add failed: ${add.stderr}`);
  const rm = gone.length ? git(['rm', '-q', '--cached', '--ignore-unmatch', '--', ...gone], repo) : { code: 0 };
  if (rm.code !== 0) throw new Error(`git rm --cached failed: ${rm.stderr}`);
  const c = git(['commit', '-q', '-m', message, '--', ...rel], repo);
  if (c.code !== 0) throw new Error(`git commit failed: ${c.stderr}\n${c.stdout}`);
  return rel;
}
