import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { pending, parseInbox, appendEntry } from '../scripts/lib/inbox.mjs';
import { projectInbox } from '../scripts/lib/config.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
// The inbox is seeded directly with the same lib/inbox.mjs primitive capture.mjs calls, writing
// to the same inbox file.
function projectWithPending(h) {
  const r = makeRepo();
  runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  appendEntry(projectInbox(r.root), { marker: 'PRULE', text: 'PRULE: never guess a path', session: 's' });
  return r;
}

test('place appends a bullet under an existing heading and creates a missing one', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')); const f = path.join(d, '.claude', 'rules', 'a.md'); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, '# A\n\n## One\n\n- old\n');
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'One', '--text', 'new rule'] }).code, 0);
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'Two', '--text', 'another'] }).code, 0);
  assert.equal(fs.readFileSync(f, 'utf8'), '# A\n\n## One\n\n- old\n- new rule\n\n## Two\n\n- another\n');
});

// STATUS 54: a rule bullet goes in a .claude/rules/<file>.md — the project's, or the user's
// ~/.claude/rules/universal.md. The plugin's core.md and the bucket skills change only by editing
// the repo, so the one bullet writer refuses them by name, as it refuses a bare rules/ file.
test('place appends to a title-only universal.md under its title; core.md, a bucket skill and a bare rules/ file are refused', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'place-'));
  const universal = path.join(d, '.claude', 'rules', 'universal.md'); fs.mkdirSync(path.dirname(universal), { recursive: true });
  fs.writeFileSync(universal, '# Universal rules\n- one\n');
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', universal, '--section', 'Universal rules', '--text', 'two'] }).code, 0);
  assert.equal(fs.readFileSync(universal, 'utf8'), '# Universal rules\n- one\n- two\n');
  const core = path.join(d, 'plugins', 'machinery', 'core.md'); fs.mkdirSync(path.dirname(core), { recursive: true });
  fs.writeFileSync(core, '# Machinery core (always on)\n- one\n');
  const skill = path.join(d, 'claude-code', 'machinery', 'testing', 'SKILL.md'); fs.mkdirSync(path.dirname(skill), { recursive: true });
  fs.writeFileSync(skill, '---\nname: testing\ndescription: d\n---\n# Testing\n\n## Writing a test\n- a\n');
  const bare = path.join(d, 'rules', 'x.md'); fs.mkdirSync(path.dirname(bare)); fs.writeFileSync(bare, '');
  for (const [file, section] of [[core, 'Machinery core (always on)'], [skill, 'Writing a test'], [bare, 'S']]) {
    const before = fs.readFileSync(file, 'utf8');
    const res = runScript('scripts/place.mjs', { args: ['--file', file, '--section', section, '--text', 't'] });
    assert.equal(res.code, 1, file);
    assert.match(res.stderr, /a rule goes in \.claude\/rules\/<file>\.md \(the project's, or the user's universal\.md\)/, file);
    assert.equal(fs.readFileSync(file, 'utf8'), before, `${file} was written despite the refusal`);
  }
});

test('place refuses a file outside a rules directory (spec I34)', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'x-')), 'notes.md'); fs.writeFileSync(f, '');
  assert.notEqual(runScript('scripts/place.mjs', { args: ['--file', f, '--section', 'S', '--text', 't'] }).code, 0);
});

test('bump patch-increments plugin.json', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-')); fs.mkdirSync(path.join(d, '.claude-plugin'));
  fs.writeFileSync(path.join(d, '.claude-plugin', 'plugin.json'), '{\n  "name": "x",\n  "version": "0.1.9"\n}\n');
  const res = runScript('scripts/bump.mjs', { args: ['--plugin', d] });
  assert.equal(res.stdout.trim(), '0.1.10');
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, '.claude-plugin', 'plugin.json'), 'utf8')).version, '0.1.10');
});

test('intake list shows pending project entries; commit files, dispositions, commits in the root (spec I29, I30)', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const list = runScript('scripts/intake.mjs', { args: ['list', '--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.match(list.stdout, /\tPRULE\t.*inbox\.md\tPRULE: never guess a path/);
    const stamp = list.stdout.trim().split('\t')[0];
    const rf = path.join(r.root, '.claude', 'rules', 'straight-talk.md');
    runScript('scripts/place.mjs', { args: ['--file', rf, '--section', 'Claims', '--text', 'Never guess a path; resolve it.'] });
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', stamp, '--home', '.claude/rules/straight-talk.md § Claims'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 0);
    const [e] = parseInbox(fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'inbox.md'), 'utf8'));
    assert.equal(e.state, 'FILED'); assert.match(e.disposition, /filed → \.claude\/rules\/straight-talk\.md § Claims/);
    assert.match(g(r.root, 'log', '-1', '--format=%s'), /^rule: PRULE: never guess a path/);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root }).code, 0);
  } finally { r.cleanup(); }
});

test('intake commit --kind project refuses from inside a worktree (spec I29)', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const wt = addWorktree(r.root, 'feat');
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', wt, '--stamp', 'x', '--home', 'y'], cwd: wt, env: { MACHINERY_HOME: h } });
    assert.notEqual(res.code, 0); assert.match(res.stderr, /root session/);
    assert.ok(res.stderr.includes(`run /machinery:rule-process from ${r.root}`), res.stderr);
  } finally { r.cleanup(); }
});

// STATUS 54: a URULE is universal for the USER. Filing it appends one dated bullet to
// ~/.claude/rules/universal.md (created on demand with its one-line heading) and dispositions the
// user's inbox entry. The home is not a repository, so nothing is bumped, built or committed —
// the plugin's core.md and skills are never touched; those change only by editing the repo.
const userInbox = (h) => path.join(h, '.claude', 'machinery', 'inbox.md');
const userRules = (h) => path.join(h, '.claude', 'rules', 'universal.md');
const today = () => new Date().toISOString().slice(0, 10);

test('a URULE files as one dated bullet in the user\'s universal.md, created on demand, and dispositions the entry; nothing is bumped, built or committed (STATUS 54)', () => {
  const h = home();
  const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  const env = { MACHINERY_HOME: h };
  // Explicit stamps: two entries appended in the same second would share one, and intake addresses
  // an entry by its stamp.
  const stamp = '2026-09-14T00:00:01Z', stamp2 = '2026-09-14T00:00:02Z';
  appendEntry(userInbox(h), { marker: 'URULE', text: 'URULE: say less', session: 's', stamp });
  assert.ok(!fs.existsSync(path.join(h, '.claude', 'rules')), 'the fixture starts with no ~/.claude/rules');
  const res = runScript('scripts/intake.mjs', { args: ['universal', '--stamp', stamp, '--text', 'Say less.'], cwd: notARepo, env });
  assert.equal(res.code, 0, res.stderr + res.stdout);
  assert.equal(fs.readFileSync(userRules(h), 'utf8'), `# Universal rules\n- Say less. (URULE, ${today()})\n`);
  assert.equal(pending(userInbox(h)).length, 0);
  const [e] = parseInbox(fs.readFileSync(userInbox(h), 'utf8'));
  assert.equal(e.state, 'FILED'); assert.equal(e.disposition, `filed → ${userRules(h)}`);
  assert.ok(res.stdout.includes(`filed → ${userRules(h)}`), res.stdout);
  assert.doesNotMatch(res.stdout + res.stderr, /bumped|build-skills|committed/);
  assert.ok(!fs.existsSync(path.join(h, '.git')), 'the home was turned into a repository');
  assert.ok(!fs.existsSync(path.join(PLUGIN, 'inbox.md')), 'the plugin inbox was written');
  // A second filing appends below the first; the heading is written once.
  appendEntry(userInbox(h), { marker: 'URULE', text: 'URULE: two', session: 's', stamp: stamp2 });
  const again = runScript('scripts/intake.mjs', { args: ['universal', '--stamp', stamp2, '--text', 'Two.'], cwd: notARepo, env });
  assert.equal(again.code, 0, again.stderr + again.stdout);
  assert.equal(fs.readFileSync(userRules(h), 'utf8'), `# Universal rules\n- Say less. (URULE, ${today()})\n- Two. (URULE, ${today()})\n`);
  assert.equal(pending(userInbox(h)).length, 0);
});

test('RED CHECK: intake universal with an unknown stamp or no text files nothing, and commit no longer takes --kind universal (STATUS 54)', () => {
  const h = home();
  const env = { MACHINERY_HOME: h };
  appendEntry(userInbox(h), { marker: 'URULE', text: 'URULE: kept', session: 's' });
  const stamp = pending(userInbox(h))[0].stamp;
  const unknown = runScript('scripts/intake.mjs', { args: ['universal', '--stamp', 'nope', '--text', 't'], env });
  assert.equal(unknown.code, 1); assert.match(unknown.stderr, /no PENDING entry with stamp nope/);
  const noText = runScript('scripts/intake.mjs', { args: ['universal', '--stamp', stamp], env });
  assert.equal(noText.code, 1); assert.match(noText.stderr, /usage: intake universal --stamp <stamp> --text "<rule>"/);
  const old = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'universal', '--stamp', stamp, '--home', 'x'], env });
  assert.equal(old.code, 1); assert.match(old.stderr, /usage: intake commit --kind project\|spec/);
  assert.ok(!fs.existsSync(userRules(h)), 'universal.md was written despite the refusals');
  assert.equal(pending(userInbox(h)).length, 1, 'the entry was dispositioned despite the refusals');
});

test('intake list shows a pending user-inbox entry from any directory, a repository or not (STATUS 54)', () => {
  const h = home();
  appendEntry(userInbox(h), { marker: 'URULE', text: 'URULE: listed', session: 's' });
  const list = runScript('scripts/intake.mjs', { args: ['list'], cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-')), env: { MACHINERY_HOME: h } });
  assert.equal(list.code, 0, list.stderr);
  assert.ok(list.stdout.includes(`\tURULE\t${userInbox(h)}\tURULE: listed`), list.stdout);
});

test('install and project intake write no index, and the filing commit is the rule file and the inbox (decision 10)', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    for (const f of ['RULES_INDEX.md', 'SPEC_INDEX.md']) assert.equal(fs.existsSync(path.join(r.root, '.claude', 'machinery', f)), false, f);
    const stamp = runScript('scripts/intake.mjs', { args: ['list', '--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } }).stdout.trim().split('\t')[0];
    runScript('scripts/place.mjs', { args: ['--file', path.join(r.root, '.claude', 'rules', 'straight-talk.md'), '--section', 'Claims', '--text', 'Never guess a path.'] });
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', stamp, '--home', '.claude/rules/straight-talk.md § Claims'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(g(r.root, 'show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean).sort(), ['.claude/machinery/inbox.md', '.claude/rules/straight-talk.md']);
  } finally { r.cleanup(); }
});

// Plan Task B6 (recalibration 33, 36; #99 Task 7): the issue-tracking answer is a project rule that
// replaces the whole project file, and a re-run replaces the answer with a commit naming old and new.
const ANSWER_1 = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.';
const ANSWER_2 = 'Issue tracking: <other tracker> on `<project>`, reached with `<other tool>`.';
const recordProject = (root, h, answer) => runScript('scripts/issue-tracking.mjs', { args: ['record-project', '--answer', answer, '--root', root], cwd: root, env: { MACHINERY_HOME: h, CLAUDE_CODE_SESSION_ID: 's' } });
// record-project stamps entries to the second and refuses a second stamp in the same second, so two
// records in one test are separated by a wait for the clock to tick.
const nextSecond = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000 - (Date.now() % 1000) + 1);

test('an issue-tracking entry is filed as the whole project file, and a re-run replaces it naming old and new', () => {
  const h = home(); const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
    const file = path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md');
    for (const [answer, old] of [[ANSWER_1, 'unanswered'], [ANSWER_2, ANSWER_1]]) {
      if (old !== 'unanswered') nextSecond();
      const rec = recordProject(r.root, h, answer);
      assert.equal(rec.code, 0, rec.stderr);
      const [entry] = pending(projectInbox(r.root));
      const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', entry.stamp, '--home', '.claude/rules/project_issue_tracking.md § Issue tracking'], cwd: r.root, env: { MACHINERY_HOME: h } });
      assert.equal(res.code, 0, res.stderr + res.stdout);
      assert.equal(fs.readFileSync(file, 'utf8'), `${answer}\n`);
      assert.equal(g(r.root, 'log', '-1', '--format=%s'), `rule: issue tracking: ${old.slice(0, 40)} → ${answer.slice(0, 40)}`);
      assert.equal(g(r.root, 'status', '--porcelain'), '');
    }
  } finally { r.cleanup(); }
});

test('RED CHECK: an issue-tracking entry with any other home is refused, naming the home', () => {
  const h = home(); const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
    assert.equal(recordProject(r.root, h, ANSWER_1).code, 0);
    const [entry] = pending(projectInbox(r.root));
    const before = g(r.root, 'rev-parse', 'HEAD');
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', entry.stamp, '--home', '.claude/rules/a.md § S'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 1);
    assert.match(res.stderr, /an issue-tracking entry is filed only to \.claude\/rules\/project_issue_tracking\.md — run again with --home "\.claude\/rules\/project_issue_tracking\.md"/);
    assert.equal(g(r.root, 'rev-parse', 'HEAD'), before);
    assert.equal(pending(projectInbox(r.root)).length, 1, 'the entry was dispositioned despite the refusal');
  } finally { r.cleanup(); }
});

test('RED CHECK: intake commit with an unknown stamp fails and commits nothing', () => {
  const h = home(); const r = projectWithPending(h);
  try {
    const before = g(r.root, 'rev-parse', 'HEAD');
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--root', r.root, '--stamp', 'nope', '--home', 'x'], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.notEqual(res.code, 0); assert.equal(g(r.root, 'rev-parse', 'HEAD'), before);
  } finally { r.cleanup(); }
});
