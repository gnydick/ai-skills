// Story: shared by worktree-create.mjs (where a new copy starts) and
// audit-diff.mjs (what a branch's diff is measured against) — one project-wide
// policy read from one place (rules/design-invariants.md § One authority per
// switch), not two independently maintained copies. Moved out of
// worktree-create.mjs verbatim; no behaviour change.
import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';

export function baseRef(repo) {
  let mode = 'fresh';
  try { mode = JSON.parse(fs.readFileSync(path.join(repo, '.claude', 'settings.json'), 'utf8')).worktree?.baseRef ?? 'fresh'; } catch {}
  if (mode === 'head') return 'HEAD';
  const r = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], repo);
  return r.code === 0 && r.stdout ? r.stdout : 'HEAD';
}
