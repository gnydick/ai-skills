import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo, addWorktree, commitAll } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';

// Story: claude-code/machinery/invariant-audit/SKILL.md step 1. The stdout
// contract is: the diff file's absolute path on line 1, then one
// repo-relative changed-file path per line. This parser is what a caller of
// the script (the skill, or this test) uses to read it back — it fails on a
// line that violates the contract instead of silently accepting it.
function parseAuditDiffOutput(stdout) {
  const lines = stdout.split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('audit-diff produced no output');
  const [diffPath, ...files] = lines;
  if (!path.isAbsolute(diffPath)) throw new Error(`line 1 is not an absolute diff-file path: ${diffPath}`);
  for (const f of files) {
    if (path.isAbsolute(f)) throw new Error(`changed-file line is absolute, not repo-relative: ${f}`);
  }
  return { diffPath, files };
}

test('RED CHECK: the stdout parser rejects a malformed line', () => {
  assert.throws(() => parseAuditDiffOutput('relative/not-absolute.diff\nfoo.txt'), /not an absolute diff-file path/);
  assert.throws(() => parseAuditDiffOutput('/tmp/x.diff\n/abs/not/repo/relative.txt'), /is absolute, not repo-relative/);
});

// One shared repo+origin fixture for every case below that needs a real base
// to diff against — `git init` plus a bare origin and a push are the
// expensive part (rules/verification-and-evidence.md leans against padding
// the suite); `addWorktree` off the same repo is cheap per case and each case
// still gets its own branch, so nothing shares mutable state across tests.
let shared;
before(() => { shared = makeRepo({ withOrigin: true }); });
after(() => { shared.cleanup(); });

test('a repo with a base branch and a feature commit: diff file exists, contains the change, stdout matches the contract; default --out path also works', () => {
  const wt = addWorktree(shared.root, 'feature-x');
  fs.writeFileSync(path.join(wt, 'new-file.txt'), 'invariant audit content\n');
  commitAll(wt, 'add new-file.txt');

  const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-out-')), 'out.diff');
  const res = runScript('scripts/audit-diff.mjs', { cwd: wt, args: ['--out', outPath] });
  assert.equal(res.code, 0, res.stderr);
  const { diffPath, files } = parseAuditDiffOutput(res.stdout);
  assert.equal(diffPath, outPath);
  assert.deepEqual(files, ['new-file.txt']);
  assert.ok(fs.existsSync(outPath));
  const diffText = fs.readFileSync(outPath, 'utf8');
  assert.match(diffText, /new-file\.txt/);
  assert.match(diffText, /invariant audit content/);

  // Same branch, no --out: the default path is <tmpdir>/machinery-audit/<branch>.diff.
  const defRes = runScript('scripts/audit-diff.mjs', { cwd: wt });
  assert.equal(defRes.code, 0, defRes.stderr);
  const defaultPath = path.join(os.tmpdir(), 'machinery-audit', 'feature-x.diff');
  assert.equal(parseAuditDiffOutput(defRes.stdout).diffPath, defaultPath);
  assert.ok(fs.existsSync(defaultPath));
  fs.rmSync(defaultPath, { force: true });
});

test('fails CLOSED: an empty diff against the base exits non-zero and writes no file', () => {
  const wt = addWorktree(shared.root, 'feature-empty');
  const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-out-')), 'out.diff');
  const res = runScript('scripts/audit-diff.mjs', { cwd: wt, args: ['--out', outPath] });
  assert.notEqual(res.code, 0);
  assert.equal(res.stdout, '');
  assert.match(res.stderr, /empty/i);
  assert.ok(!fs.existsSync(outPath));
});

test('fails CLOSED: outside a git repository exits non-zero and writes no file', () => {
  const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
  try {
    const outPath = path.join(notARepo, 'out.diff');
    const res = runScript('scripts/audit-diff.mjs', { cwd: notARepo, args: ['--out', outPath] });
    assert.notEqual(res.code, 0);
    assert.equal(res.stdout, '');
    assert.match(res.stderr, /not inside a git repository/);
    assert.ok(!fs.existsSync(outPath));
  } finally { fs.rmSync(notARepo, { recursive: true, force: true }); }
});

test('fails CLOSED: base resolves to the literal HEAD (worktree.baseRef "head", no real base) exits non-zero and writes no file', () => {
  const settingsPath = path.join(shared.root, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, '{"worktree":{"baseRef":"head"}}');
  try {
    const wt = addWorktree(shared.root, 'feature-head-base');
    fs.writeFileSync(path.join(wt, 'z.txt'), 'z\n');
    commitAll(wt, 'add z.txt');
    const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-out-')), 'out.diff');
    const res = runScript('scripts/audit-diff.mjs', { cwd: wt, args: ['--out', outPath] });
    assert.notEqual(res.code, 0);
    assert.equal(res.stdout, '');
    assert.match(res.stderr, /HEAD/);
    assert.ok(!fs.existsSync(outPath));
  } finally { fs.rmSync(settingsPath, { force: true }); }
});
