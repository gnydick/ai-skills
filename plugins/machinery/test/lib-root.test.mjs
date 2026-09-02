import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { projectRoot, isRootSession } from '../scripts/lib/root.mjs';

test('projectRoot from the main checkout is the checkout', () => {
  const r = makeRepo();
  try { assert.equal(projectRoot(r.root), r.root); assert.equal(isRootSession(r.root), true); }
  finally { r.cleanup(); }
});

test('projectRoot from inside a worktree is the main checkout, not the worktree', () => {
  const r = makeRepo();
  try {
    const wt = addWorktree(r.root, 'feature-x');
    assert.equal(projectRoot(wt), r.root);
    assert.equal(isRootSession(wt), false);
    fs.mkdirSync(path.join(wt, 'sub'));
    assert.equal(projectRoot(path.join(wt, 'sub')), r.root);
  } finally { r.cleanup(); }
});

test('RED CHECK: a directory that is not a repo throws', () => {
  const r = makeRepo();
  try { assert.throws(() => projectRoot(path.join(r.root, '..')), /not inside a git repository/); }
  finally { r.cleanup(); }
});
