import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { pending } from '../scripts/lib/inbox.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/UserPromptSubmit.json'), 'utf8'));
const payload = (prompt, cwd) => JSON.stringify({ ...base, prompt, cwd });
// STATUS 54: the universal inbox is the user's, ~/.claude/machinery/inbox.md under the home. Every
// home() is a throwaway, so nothing here can see or write the real one.
const home = () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(h, '.claude'));
  return h;
};
const userInbox = (h) => path.join(h, '.claude', 'machinery', 'inbox.md');
const ctx = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
const run = (prompt, cwd, env = {}) => runScript('scripts/capture.mjs', { stdin: payload(prompt, cwd), cwd, env: { MACHINERY_HOME: home(), ...env } });

test('PRULE from the ROOT session lands in the root inbox and asks for intake now', () => {
  const r = makeRepo();
  try {
    const res = run('PRULE: never guess a path', r.root);
    const inbox = path.join(r.root, '.claude', 'machinery', 'inbox.md');
    assert.equal(pending(inbox).length, 1);
    assert.equal(pending(inbox)[0].text, 'PRULE: never guess a path');
    assert.match(ctx(res), /^PRULE captured verbatim to .*inbox\.md \(PENDING\)\. Commits are refused until it is filed: run \/machinery:rule-process\.$/m);
  } finally { r.cleanup(); }
});

test('PRULE from INSIDE A WORKTREE lands in the root inbox, not the copy, and says filing waits for a root session (spec I20, I29)', () => {
  const r = makeRepo();
  try {
    const wt = addWorktree(r.root, 'feat');
    const res = run('PRULE: x', wt);
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 1);
    assert.ok(!fs.existsSync(path.join(wt, '.claude', 'machinery', 'inbox.md')));
    assert.match(ctx(res), /Commits in .* are refused until it is filed: run \/machinery:rule-process from /);
  } finally { r.cleanup(); }
});

test('URULE lands in the user\'s inbox under the home, created on demand — never in the project, never in the plugin (STATUS 54)', () => {
  const r = makeRepo();
  const h = home();
  try {
    assert.ok(!fs.existsSync(path.join(h, '.claude', 'machinery')), 'the fixture starts with no ~/.claude/machinery');
    const res = run('urule: universal thing', r.root, { MACHINERY_HOME: h });
    assert.equal(res.code, 0, res.stderr);
    assert.equal(pending(userInbox(h)).length, 1);
    assert.equal(pending(userInbox(h))[0].text, 'urule: universal thing');
    assert.ok(!fs.existsSync(path.join(r.root, '.claude', 'machinery', 'inbox.md')), 'a project inbox was written');
    assert.ok(!fs.existsSync(path.join(PLUGIN, 'inbox.md')), 'the plugin inbox was written');
    assert.ok(ctx(res).includes(`URULE captured verbatim to ${userInbox(h)} (PENDING). Commits are refused until it is filed: run /machinery:rule-process.`), ctx(res));
  } finally { r.cleanup(); }
});

test('bare RULE: captures nothing and asks which', () => {
  const r = makeRepo();
  try {
    const res = run('RULE: ambiguous', r.root);
    assert.ok(!fs.existsSync(path.join(r.root, '.claude', 'machinery', 'inbox.md')));
    assert.match(ctx(res), /Dictate a project rule with PRULE: or a universal rule with URULE:/);
  } finally { r.cleanup(); }
});

test('an unmarked prompt with nothing pending produces no output', () => {
  const r = makeRepo();
  try { const res = run('hello', r.root); assert.equal(res.stdout, ''); assert.equal(res.code, 0); }
  finally { r.cleanup(); }
});

test('an unmarked prompt in a root session with pending entries prepends the intake nudge (spec I32)', () => {
  const r = makeRepo();
  try {
    run('PRULE: a', r.root);
    const res = run('unrelated', r.root);
    assert.match(ctx(res), /^1 rule pending in the inbox — run \/machinery:rule-process before this prompt\.$/m);
  } finally { r.cleanup(); }
});

test('fails LOUD: unwritable inbox → non-zero exit with the reason on stderr', () => {
  // Portable way to make the inbox path unwritable: make it a DIRECTORY.
  const r2 = makeRepo();
  try {
    fs.mkdirSync(path.join(r2.root, '.claude', 'machinery', 'inbox.md'), { recursive: true });
    const res = run('PRULE: x', r2.root);
    assert.notEqual(res.code, 0); assert.match(res.stderr, /inbox/);
  } finally { r2.cleanup(); }
});

test('RED CHECK: a PRULE is not silently dropped', () => {
  const r = makeRepo();
  try { run('PRULE: kept', r.root); assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 1); }
  finally { r.cleanup(); }
});

// Issue tracking, test 7(a1): the setup conversation asks for no mark, so a plain-words answer reaching
// the capture hook writes nothing to either inbox, and record-project's entry is never doubled by a
// captured one. The observer is proved alive at the end: the same hook and home, with the mark, write.
test('RED CHECK: a plain-words issue-tracking answer, with no mark, writes nothing to either inbox (issue tracking test 7a1)', () => {
  const r = makeRepo(); const h = home();
  try {
    const res = run('Use GitHub Issues to track this project, for this project only.', r.root, { MACHINERY_HOME: h });
    assert.equal(res.code, 0, res.stderr);
    assert.ok(!fs.existsSync(path.join(r.root, '.claude', 'machinery', 'inbox.md')), 'a project inbox was written');
    assert.ok(!fs.existsSync(userInbox(h)), 'a universal inbox was written');
    run('PRULE: x', r.root, { MACHINERY_HOME: h });
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 1);
  } finally { r.cleanup(); }
});
