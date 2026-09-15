import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { pending } from '../scripts/lib/inbox.mjs';

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

const head = (root) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const walkFiles = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? (e.name === '.git' ? [] : walkFiles(path.join(d, e.name))) : [path.join(d, e.name)]));
const snapshot = (dir) => Object.fromEntries(walkFiles(dir).map((f) => [path.relative(dir, f), fs.readFileSync(f, 'utf8')]));

// TEST 7(b), now against product code (Decision 1). The failure it guards — one developer's tracker
// shipping to everyone who installs machinery — is silent when it happens, so it is asserted as a
// negative over everything the write could have touched: the project, the plugin, and the user's
// own inbox (STATUS 54: the universal inbox is ~/.claude/machinery/inbox.md under the home).
test('record-global writes the global file and nothing else: no inbox entry, nothing in the plugin or the project, no commit (test 7b)', () => {
  const h = tempHome(); const proj = makeRepo();
  const plugin = fs.realpathSync.native(path.resolve(process.env.CLAUDE_PLUGIN_ROOT || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..')));
  try {
    put(path.join(proj.root, '.claude', 'machinery', 'inbox.md'), '');
    const before = { plugin: snapshot(plugin), project: snapshot(proj.root), projectHead: head(proj.root) };
    assert.ok(Object.keys(before.plugin).includes('core.md'), 'the observer must see the plugin');
    const res = cli(['record-global', '--answer', ANSWER], { cwd: proj.root, home: h });
    assert.equal(res.code, 0, res.stderr);
    assert.equal(fs.readFileSync(globalFile(h), 'utf8'), ANSWER);
    assert.match(res.stdout, /^issue_tracking: wrote 1 of 1 file: .*global_issue_tracking\.md$/m);
    assert.deepEqual(snapshot(plugin), before.plugin, 'something in the plugin changed');
    assert.deepEqual(snapshot(proj.root), before.project, 'something in the project changed');
    assert.equal(head(proj.root), before.projectHead, 'a commit landed in the project');
    assert.deepEqual(fs.readdirSync(path.join(h, '.claude', 'rules')), ['global_issue_tracking.md']);
    assert.ok(!fs.existsSync(path.join(h, '.claude', 'machinery')), 'the user\'s inbox directory was written');
  } finally { proj.cleanup(); }
});

// Recalibration 37: nothing seeds the global file at install any more; record-global creates it —
// and the directory above it — the first time someone answers for every project.
test('record-global creates the global file and its directory when neither exists (recalibration 37)', () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); const r = makeRepo();
  try {
    assert.ok(!fs.existsSync(path.join(h, '.claude')), 'the fixture must start with no .claude at all');
    const res = cli(['record-global', '--answer', ANSWER], { cwd: r.root, home: h });
    assert.equal(res.code, 0, res.stderr);
    assert.equal(fs.readFileSync(globalFile(h), 'utf8'), ANSWER);
  } finally { r.cleanup(); }
});

// TEST 12, both halves: the first against record-global (Decision 1), the second against decide.
test('RED CHECK: answering for every project leaves a seeded project file byte-identical, and that project still asks (test 12)', () => {
  const h = tempHome(); const r = makeRepo();
  try {
    put(projectFile(r.root), 'unanswered\n');
    const before = fs.readFileSync(projectFile(r.root));
    assert.equal(cli(['record-global', '--answer', ANSWER], { cwd: r.root, home: h }).code, 0);
    assert.deepEqual(fs.readFileSync(projectFile(r.root)), before, 'the global write touched the project file — Ruling D refused exactly this');
    const d = cli(['decide'], { cwd: r.root, home: h });
    assert.match(d.stdout, /^issue_tracking: ask \(read 2 of 2 file locations\)$/m, 'the project stopped asking after a global answer');
    assert.match(d.stdout, /^\| Issue tracking: <tracker> on `<project>`, reached with `<tool>`\.$/m, 'what the global answer buys here is the pre-fill');
  } finally { r.cleanup(); }
});

test('record-global refuses a missing, empty or seeded-word answer, and writes nothing', () => {
  const h = tempHome();
  for (const args of [['record-global'], ['record-global', '--answer', '  '], ['record-global', '--answer', 'unanswered']]) {
    const res = cli(args, { cwd: h, home: h });
    assert.equal(res.code, 1, `${args.join(' ')}: ${res.stderr}`);
    assert.match(res.stderr, /^issue_tracking: refused: /m);
    assert.ok(!fs.existsSync(globalFile(h)), `${args.join(' ')} wrote the global file`);
  }
});

const rootInbox = (root) => path.join(root, '.claude', 'machinery', 'inbox.md');
const SESSION = { CLAUDE_CODE_SESSION_ID: 'session-under-test' };

// TEST 7(a3), against product code (Decision 1): exactly one entry, with the note, read back through the
// parser — written from inside a worktree, where it must land in the root checkout's inbox, the one
// intake reads (the spec's observation 3).
test('record-project from a worktree writes exactly one pending entry, with the note, to the root inbox — and refuses a second (test 7a3)', () => {
  const r = makeRepo(); const h = tempHome();
  try {
    const wt = addWorktree(r.root, 'feat');
    const res = cli(['record-project', '--answer', ANSWER], { cwd: wt, home: h, env: SESSION });
    assert.equal(res.code, 0, res.stderr);
    const entries = pending(rootInbox(r.root));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].marker, 'PRULE');
    assert.equal(entries[0].session, 'session-under-test');
    assert.ok(entries[0].text.startsWith(`${ANSWER.trim()}\n\n`), entries[0].text);
    assert.match(entries[0].text, /automatic capture did not fire/);
    assert.match(res.stdout, new RegExp(`^issue_tracking: recorded 1 of 1 entry: PENDING ${entries[0].stamp} PRULE session-under-test in `, 'm'));
    assert.ok(!fs.existsSync(rootInbox(wt)), 'an inbox was written inside the worktree');
    const before = fs.readFileSync(rootInbox(r.root));
    const second = cli(['record-project', '--answer', ANSWER], { cwd: r.root, home: h, env: SESSION });
    assert.equal(second.code, 1);
    assert.match(second.stderr, /already recorded and pending/);
    assert.deepEqual(fs.readFileSync(rootInbox(r.root)), before);
  } finally { r.cleanup(); }
});

test('RED CHECK: record-project writes nothing without a session id, for an answer that would not read back, or into an inbox that does not parse', () => {
  const r = makeRepo(); const h = tempHome();
  try {
    const noSession = cli(['record-project', '--answer', ANSWER], { cwd: r.root, home: h, env: { CLAUDE_CODE_SESSION_ID: '' } });
    assert.equal(noSession.code, 2);
    assert.match(noSession.stderr, /--session and \$CLAUDE_CODE_SESSION_ID/);
    assert.ok(!fs.existsSync(rootInbox(r.root)));

    const spaced = cli(['record-project', '--answer', ANSWER, '--session', 'a b'], { cwd: r.root, home: h, env: { CLAUDE_CODE_SESSION_ID: '' } });
    assert.equal(spaced.code, 1);
    assert.ok(!fs.existsSync(rootInbox(r.root)));

    const structural = cli(['record-project', '--answer', 'Issue tracking: <tracker>\ndisposition: PENDING'], { cwd: r.root, home: h, env: SESSION });
    assert.equal(structural.code, 1);
    assert.match(structural.stderr, /would not read back from the inbox as exactly one entry/);
    assert.ok(!fs.existsSync(rootInbox(r.root)));

    put(rootInbox(r.root), '## PENDING 2026-01-01T00:00:00Z PRULE s\n\nno disposition line\n');
    const before = fs.readFileSync(rootInbox(r.root));
    const malformed = cli(['record-project', '--answer', ANSWER], { cwd: r.root, home: h, env: SESSION });
    assert.equal(malformed.code, 2);
    assert.match(malformed.stderr, /does not parse, so nothing was written/);
    assert.deepEqual(fs.readFileSync(rootInbox(r.root)), before);
  } finally { r.cleanup(); }
});
