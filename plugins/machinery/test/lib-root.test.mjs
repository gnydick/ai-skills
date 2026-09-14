import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { projectRoot, checkoutRoot, isRootSession } from '../scripts/lib/root.mjs';

// STATUS 52: the checkout root is the tree being committed — the worktree itself from inside a
// linked worktree — where projectRoot is the main checkout that owns the shared inbox.
test('checkoutRoot from inside a worktree is the worktree; from the main checkout, the checkout', () => {
  const r = makeRepo();
  try {
    assert.equal(checkoutRoot(r.root), r.root);
    const wt = addWorktree(r.root, 'feature-y');
    assert.equal(checkoutRoot(wt), wt);
    fs.mkdirSync(path.join(wt, 'sub'));
    assert.equal(checkoutRoot(path.join(wt, 'sub')), wt);
    assert.equal(projectRoot(wt), r.root);
  } finally { r.cleanup(); }
});

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
