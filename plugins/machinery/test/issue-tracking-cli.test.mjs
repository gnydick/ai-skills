import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';

// scripts/issue-tracking.mjs end to end (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md,
// Ruling G; this plan's Decisions 1 and 3). Answers are visible placeholders (Ruling H).
const ANSWER = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.\nCheck: `<status command>` and `<one-item read command>`.\n';
const tempHome = () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(h, '.claude', 'rules'), { recursive: true });
  return h;
};
const cli = (args, { cwd, home, env = {} }) => runScript('scripts/issue-tracking.mjs', { args, cwd, env: { MACHINERY_HOME: home, ...env } });
const projectFile = (root) => path.join(root, '.claude', 'rules', 'project_issue_tracking.md');
const globalFile = (home) => path.join(home, '.claude', 'rules', 'global_issue_tracking.md');
const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

test('decide prints the verdict first, both files, and the global answer as the pre-fill', () => {
  const r = makeRepo(); const h = tempHome();
  try {
    put(projectFile(r.root), 'unanswered\n');
    put(globalFile(h), ANSWER);
    const res = cli(['decide', '--root', r.root], { cwd: r.root, home: h });
    assert.equal(res.code, 0, res.stderr);
    const lines = res.stdout.split(/\r?\n/);
    assert.equal(lines[0], 'issue_tracking: ask (read 2 of 2 file locations)');
    assert.match(res.stdout, /^issue_tracking: project file .*project_issue_tracking\.md: unanswered$/m);
    assert.match(res.stdout, /^issue_tracking: global file .*global_issue_tracking\.md: carries an answer$/m);
    assert.match(res.stdout, /^issue_tracking: pre-fill \(2 line\(s\)\):$/m);
    assert.match(res.stdout, /^\| Issue tracking: <tracker> on `<project>`, reached with `<tool>`\.$/m);
  } finally { r.cleanup(); }
});

// This plan's choice 4: from inside a worktree, decide reads the root checkout's project file — the
// same root the capture hook writes to and intake files from.
test('decide from inside a worktree reads the root checkout\'s project file', () => {
  const r = makeRepo(); const h = tempHome();
  try {
    const wt = addWorktree(r.root, 'feat');
    put(projectFile(r.root), 'none\n');
    assert.ok(!fs.existsSync(projectFile(wt)), 'the fixture must not give the worktree a file of its own');
    const res = cli(['decide'], { cwd: wt, home: h });
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /^issue_tracking: do not ask \(read 2 of 2 file locations\)$/m);
    assert.match(res.stdout, /^issue_tracking: project file .*: none$/m);
    assert.match(res.stdout, /^issue_tracking: global file .*: absent$/m);
    assert.match(res.stdout, /^issue_tracking: pre-fill: nothing to offer$/m);
  } finally { r.cleanup(); }
});

test('RED CHECK: outside a git repository decide cannot run — exit 2, the directory named, no verdict', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  const res = cli(['decide', '--root', d], { cwd: d, home: tempHome() });
  assert.equal(res.code, 2);
  assert.match(res.stderr, /^issue_tracking: CANNOT RUN: cannot resolve the project root from /m);
  assert.doesNotMatch(res.stdout, /issue_tracking: (ask|do not ask)/);
});

test('an unknown subcommand prints the usage and exits 2', () => {
  const res = cli(['decidee'], { cwd: os.tmpdir(), home: tempHome() });
  assert.equal(res.code, 2);
  assert.match(res.stderr, /usage: issue-tracking\.mjs decide/);
});
