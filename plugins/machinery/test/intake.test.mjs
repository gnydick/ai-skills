import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { pending, parseInbox, appendEntry } from '../scripts/lib/inbox.mjs';
import { projectInbox, universalInbox } from '../scripts/lib/config.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
// capture.mjs (Task 8) is not landed in this worktree yet — seed the inbox directly with the
// same lib/inbox.mjs primitive capture.mjs would call, writing to the same inbox file.
function withHome(h, fn) {
  const prev = process.env.MACHINERY_HOME;
  process.env.MACHINERY_HOME = h;
  try { return fn(); } finally { if (prev === undefined) delete process.env.MACHINERY_HOME; else process.env.MACHINERY_HOME = prev; }
}
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

test('place appends to core.md under its title, and into a bucket skill section; a bare rules/ file is refused', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'place-'));
  const core = path.join(d, 'plugins', 'machinery', 'core.md'); fs.mkdirSync(path.dirname(core), { recursive: true });
  fs.writeFileSync(core, '# Machinery core (always on)\n- one\n');
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', core, '--section', 'Machinery core (always on)', '--text', 'two'] }).code, 0);
  assert.equal(fs.readFileSync(core, 'utf8'), '# Machinery core (always on)\n- one\n- two\n');
  const skill = path.join(d, 'claude-code', 'machinery', 'testing', 'SKILL.md'); fs.mkdirSync(path.dirname(skill), { recursive: true });
  fs.writeFileSync(skill, '---\nname: testing\ndescription: d\n---\n# Testing\n\n## Writing a test\n- a\n\n## When something fails\n- b\n');
  assert.equal(runScript('scripts/place.mjs', { args: ['--file', skill, '--section', 'Writing a test', '--text', 'c'] }).code, 0);
  assert.match(fs.readFileSync(skill, 'utf8'), /## Writing a test\n- a\n- c\n\n## When something fails/);
  const bare = path.join(d, 'rules', 'x.md'); fs.mkdirSync(path.dirname(bare)); fs.writeFileSync(bare, '');
  const res = runScript('scripts/place.mjs', { args: ['--file', bare, '--section', 'S', '--text', 't'] });
  assert.equal(res.code, 1);
  assert.match(res.stderr, /\.claude\/rules\/<file>\.md, claude-code\/machinery\/<kind>\/SKILL\.md or plugins\/machinery\/core\.md/);
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

test('universal intake files into a bucket skill, rebuilds it, bumps, and commits in the plugin source\'s checkout; a rules/ home is refused (spec I30, I31; recalibration 1, 2)', () => {
  // A fake ai-skills checkout: the plugin (core.md, inbox.md, plugin.json), one bucket skill under
  // claude-code/machinery/, and a stub scripts/build-skills.mjs that copies the bucket into the plugin.
  const r = makeRepo(); const h = home();
  try {
    const plug = path.join(r.root, 'plugins', 'machinery');
    const skill = path.join(r.root, 'claude-code', 'machinery', 'testing', 'SKILL.md');
    const put = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
    put(path.join(plug, 'core.md'), '# Machinery core (always on)\n- one\n');
    put(path.join(plug, 'inbox.md'), '');
    put(path.join(plug, '.claude-plugin', 'plugin.json'), '{"name":"machinery","version":"0.1.0"}');
    put(skill, '---\nname: testing\ndescription: d\n---\n# Testing\n\n## Writing a test\n- a\n\n## When something fails\n- b\n');
    put(path.join(r.root, 'scripts', 'build-skills.mjs'),
      "import fs from 'node:fs';\n"
      + "if (process.argv[2] !== 'build') process.exit(2);\n"
      + "fs.mkdirSync('plugins/machinery/skills/testing', { recursive: true });\n"
      + "fs.copyFileSync('claude-code/machinery/testing/SKILL.md', 'plugins/machinery/skills/testing/SKILL.md');\n");
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'checkout');
    fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ pluginSource: plug }));
    // Appended by path, not through universalInbox(): before the green this resolves to the LIVE plugin inbox.
    appendEntry(path.join(plug, 'inbox.md'), { marker: 'URULE', text: 'URULE: say less', session: 's' });
    const stamp = pending(path.join(plug, 'inbox.md'))[0].stamp;
    const env = { MACHINERY_HOME: h };
    assert.equal(runScript('scripts/place.mjs', { args: ['--file', skill, '--section', 'Writing a test', '--text', 'c'] }).code, 0);
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'universal', '--stamp', stamp, '--home', 'claude-code/machinery/testing/SKILL.md § Writing a test'], cwd: r.root, env });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.deepEqual(g(r.root, 'show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean).sort(),
      ['claude-code/machinery/testing/SKILL.md', 'plugins/machinery/.claude-plugin/plugin.json', 'plugins/machinery/inbox.md', 'plugins/machinery/skills/testing/SKILL.md']);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.equal(JSON.parse(fs.readFileSync(path.join(plug, '.claude-plugin', 'plugin.json'), 'utf8')).version, '0.1.1');
    const bad = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'universal', '--stamp', stamp, '--home', 'plugins/machinery/rules/x.md § S'], cwd: r.root, env });
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /filed in plugins\/machinery\/core\.md or claude-code\/machinery\/<kind>\/SKILL\.md/);
  } finally { r.cleanup(); }
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
