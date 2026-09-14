import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const version = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8')).version;
const install = (root, ...args) => runScript('scripts/install.mjs', { args: ['--root', root, ...args], cwd: root });

test('project install creates the layout, copies the gate, sets hooksPath, stamps the version (spec I6, I7)', () => {
  const r = makeRepo();
  try {
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    for (const f of ['.claude/rules', '.claude/machinery/inbox.md', '.githooks/pre-commit', '.githooks/machinery/gate.mjs', '.githooks/machinery/lib/inbox.mjs', '.githooks/machinery/VERSION'])
      assert.ok(fs.existsSync(path.join(r.root, f)), f);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks/machinery/VERSION'), 'utf8').trim(), version);
    assert.equal(execFileSync('git', ['config', 'core.hooksPath'], { cwd: r.root, encoding: 'utf8' }).trim(), '.githooks');
    assert.match(fs.readFileSync(path.join(r.root, '.githooks/pre-commit'), 'utf8'), /node \.githooks\/machinery\/gate\.mjs/);
    assert.match(res.stdout, /core\.hooksPath: \.githooks/);
  } finally { r.cleanup(); }
});

test('the installed gate runs standalone from the project (no plugin path baked in)', () => {
  const r = makeRepo();
  try {
    install(r.root);
    for (const f of ['gate.mjs', 'manifest.mjs', 'register-check.mjs', 'spec-check.mjs', 'sweep-guard.mjs']) assert.ok(!fs.readFileSync(path.join(r.root, '.githooks/machinery', f), 'utf8').includes(PLUGIN.replace(/\\/g, '/')));
    fs.writeFileSync(path.join(r.root, 'docs.md', ), 'x'); execFileSync('git', ['add', '-A'], { cwd: r.root });
    const g = execFileSync(process.execPath, [path.join(r.root, '.githooks/machinery/gate.mjs')], { cwd: r.root, encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' } });
    assert.match(g, /register_check: 0 of 0/);
  } finally { r.cleanup(); }
});

// #19 fix round 1: install.mjs copies a hand-kept list of lib files beside the gate. A lib import
// added to git.mjs (lines.mjs) and not to that list installs a gate that dies at import — this
// walks every relative import reachable from the installed gate and names the first that does
// not resolve, so the list is checked mechanically rather than remembered. The walk starts from
// every file in the installed gate directory rather than gate.mjs alone, so nothing that ships
// there goes unwalked.
//
// #73: WHAT ships is now derived from the generated manifest's CHECK_FILES, so an unwired module
// cannot reach a project at all. An unwired check was copied into every adopting project from
// 2026-09-05 to 2026-09-06 with nothing importing it — a dead payload that this very test used to
// hold in place. The assertion below is that claim reversed, not deleted.
test('every relative import reachable from any installed gate file resolves inside .githooks/machinery', () => {
  const r = makeRepo();
  try {
    install(r.root);
    const dir = path.join(r.root, '.githooks', 'machinery');
    const seen = new Set(); const missing = [];
    const walk = (file) => {
      if (seen.has(file)) return; seen.add(file);
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
        const dep = path.resolve(path.dirname(file), m[1]);
        if (fs.existsSync(dep)) walk(dep); else missing.push(`${path.relative(dir, file)} → ${m[1]}`);
      }
    };
    const roots = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
    for (const f of roots) walk(path.join(dir, f));
    assert.deepEqual(roots.slice().sort(), ['gate.mjs', 'manifest.mjs', 'register-check.mjs', 'spec-check.mjs', 'sweep-guard.mjs'], 'exactly the generated CHECK_FILES, plus the runner and the manifest');
    assert.ok(seen.size >= 5,`the walk saw ${seen.size} files — the observer must see the gate's own imports`);
    assert.deepEqual(missing, []);
  } finally { r.cleanup(); }
});

test('install is idempotent and refreshes the stamp', () => {
  const r = makeRepo();
  try {
    install(r.root); fs.writeFileSync(path.join(r.root, '.githooks/machinery/VERSION'), '0.0.0');
    const res = install(r.root); assert.equal(res.code, 0);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks/machinery/VERSION'), 'utf8').trim(), version);
    assert.equal(fs.readFileSync(path.join(r.root, '.claude/machinery/inbox.md'), 'utf8'), '');
  } finally { r.cleanup(); }
});

test('--hosted writes the workflow template; default does not', () => {
  const r = makeRepo();
  try {
    install(r.root); assert.ok(!fs.existsSync(path.join(r.root, '.github/workflows/machinery.yml')));
    install(r.root, '--hosted'); assert.ok(fs.existsSync(path.join(r.root, '.github/workflows/machinery.yml')));
  } finally { r.cleanup(); }
});

test('--machine creates the junction ~/.claude/rules/machinery → rules source (spec I11)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const tempPlug = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-')); const tempRules = path.join(tempPlug, 'rules'); fs.mkdirSync(tempRules);
  try {
    fs.writeFileSync(path.join(tempRules, 't.md'), '# T\n\n## One\n\n- rule 1\n');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ pluginSource: tempPlug }));
    const res = runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
    assert.equal(res.code, 0, res.stderr);
    const link = path.join(home, '.claude', 'rules', 'machinery');
    assert.equal(fs.realpathSync.native(link), fs.realpathSync.native(tempRules));
    assert.equal(runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } }).code, 0); // idempotent
  } finally {
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(tempPlug, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('--machine refuses to replace a real directory sitting at the junction path', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const tempPlug = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-')); const tempRules = path.join(tempPlug, 'rules'); fs.mkdirSync(tempRules);
  try {
    fs.writeFileSync(path.join(tempRules, 't.md'), '# T\n\n## One\n\n- rule 1\n');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ pluginSource: tempPlug }));
    const link = path.join(home, '.claude', 'rules', 'machinery');
    fs.mkdirSync(link, { recursive: true });
    fs.writeFileSync(path.join(link, 'keep.md'), 'do not delete me\n');
    const res = runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
    assert.notEqual(res.code, 0);
    assert.ok(fs.existsSync(link));
    assert.ok(fs.existsSync(path.join(link, 'keep.md')));
    assert.equal(fs.readFileSync(path.join(link, 'keep.md'), 'utf8'), 'do not delete me\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(tempPlug, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('a foreign .githooks/pre-commit that does not invoke the machinery gate is not overwritten (final review F)', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(r.root, '.githooks'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.githooks', 'pre-commit'), '#!/bin/sh\necho a different, unrelated hook\n');
    const res = install(r.root);
    assert.notEqual(res.code, 0);
    assert.match(res.stderr, /\.githooks[\\/]pre-commit/);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks', 'pre-commit'), 'utf8'), '#!/bin/sh\necho a different, unrelated hook\n');
  } finally { r.cleanup(); }
});

test('an existing pre-commit that already invokes the machinery gate is rewritten (idempotent)', () => {
  const r = makeRepo();
  try {
    install(r.root); // first install writes a gate-invoking pre-commit
    const res = install(r.root); // second install must not refuse its own file
    assert.equal(res.code, 0, res.stderr);
    assert.match(fs.readFileSync(path.join(r.root, '.githooks/pre-commit'), 'utf8'), /machinery\/gate\.mjs/);
  } finally { r.cleanup(); }
});

test('core.hooksPath already pointed elsewhere is not silently repointed (final review F)', () => {
  const r = makeRepo();
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.some-other-hooks'], { cwd: r.root });
    const res = install(r.root);
    assert.notEqual(res.code, 0);
    assert.match(res.stderr, /\.some-other-hooks/);
    assert.equal(execFileSync('git', ['config', 'core.hooksPath'], { cwd: r.root, encoding: 'utf8' }).trim(), '.some-other-hooks');
  } finally { r.cleanup(); }
});

test('RED CHECK: outside a git repository the project install refuses', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  const res = runScript('scripts/install.mjs', { args: ['--root', d], cwd: d });
  assert.notEqual(res.code, 0); assert.match(res.stderr, /git repository/);
});

// Task 9: the two tool-assimilation project files. Ruling (2026-09-05): tool-catalog.json is a team
// decision and is tracked like inbox.md; observations.json is per-machine measurement and
// is gitignored, never staged.
test('install creates an empty project tool catalog and observation record', () => {
  const r = makeRepo();
  try {
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'tool-catalog.json'), 'utf8')), {});
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'observations.json'), 'utf8')), {});
    assert.match(res.stdout, /created \.claude[\\/]machinery[\\/]tool-catalog\.json/);
    assert.match(res.stdout, /created \.claude[\\/]machinery[\\/]observations\.json/);
  } finally { r.cleanup(); }
});

test('RED CHECK: tool-catalog.json is staged, observations.json is gitignored, not staged', () => {
  const r = makeRepo();
  try {
    install(r.root);
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: r.root, encoding: 'utf8' });
    assert.match(staged, /\.claude\/machinery\/tool-catalog\.json/, 'the shared catalog overlay must be staged');
    assert.doesNotMatch(staged, /\.claude\/machinery\/observations\.json/, 'per-machine measurement must never be staged');
    assert.match(staged, /^\.gitignore$/m, 'the ignore entry travels with the install');
    const ignored = execFileSync('git', ['check-ignore', '.claude/machinery/observations.json'], { cwd: r.root, encoding: 'utf8' });
    assert.match(ignored, /observations\.json/, 'observations.json must actually be gitignored, not merely unstaged this once');
    // The observer is alive: the tracked sibling is NOT reported ignored by the same query.
    assert.throws(() => execFileSync('git', ['check-ignore', '.claude/machinery/tool-catalog.json'], { cwd: r.root, encoding: 'utf8', stdio: 'pipe' }));
  } finally { r.cleanup(); }
});

test('the .gitignore entry is appended once, after existing content, even when that content is CRLF with no trailing newline', () => {
  const r = makeRepo();
  try {
    fs.writeFileSync(path.join(r.root, '.gitignore'), 'node_modules/\r\ndist/');
    install(r.root);
    const first = fs.readFileSync(path.join(r.root, '.gitignore'), 'utf8');
    assert.equal(first, 'node_modules/\r\ndist/\n.claude/machinery/observations.json\n');
    install(r.root); // idempotent: no second line, whatever the line endings already in the file
    assert.equal(fs.readFileSync(path.join(r.root, '.gitignore'), 'utf8'), first);
    fs.writeFileSync(path.join(r.root, '.gitignore'), 'node_modules/\r\n.claude/machinery/observations.json\r\n');
    const res = install(r.root);
    assert.equal(fs.readFileSync(path.join(r.root, '.gitignore'), 'utf8'), 'node_modules/\r\n.claude/machinery/observations.json\r\n');
    assert.doesNotMatch(res.stdout, /added .*observations\.json to \.gitignore/);
  } finally { r.cleanup(); }
});

test('an observations.json already tracked from before the ruling is named, not silently left tracked', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(r.root, '.claude', 'machinery'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.claude', 'machinery', 'observations.json'), '{}\n');
    execFileSync('git', ['add', '.claude/machinery/observations.json'], { cwd: r.root });
    execFileSync('git', ['commit', '-q', '-m', 'tracked before the ruling'], { cwd: r.root });
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stderr, /observations\.json is tracked/);
    assert.match(res.stderr, /git rm --cached/);
  } finally { r.cleanup(); }
});

// Issue tracking configuration (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md,
// "Install seeds them", tests 1, 2 and 10). Fixture answers use visible placeholders (Ruling H).
const TRACKING_ANSWER = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.\nCheck: `<status command>` and `<one-item read command>`.\n';

test('project install seeds the project issue-tracking file once, stages it, and the gate passes (test 1)', () => {
  const r = makeRepo();
  try {
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    const f = path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md');
    assert.equal(fs.readFileSync(f, 'utf8'), 'unanswered\n');
    assert.match(res.stdout, /\.claude[\\/]rules[\\/]project_issue_tracking\.md: created/);
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: r.root, encoding: 'utf8' });
    assert.match(staged, /^\.claude\/rules\/project_issue_tracking\.md$/m, staged);
    const gate = runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(gate.code, 0, gate.stdout + gate.stderr);
    const before = fs.readFileSync(f);
    const again = install(r.root);
    assert.equal(again.code, 0, again.stderr);
    assert.deepEqual(fs.readFileSync(f), before, 'the second run changed the seeded file');
    assert.match(again.stdout, /\.claude[\\/]rules[\\/]project_issue_tracking\.md: present, left as it is/);
  } finally { r.cleanup(); }
});

// Asserted apart from test 1: "does not create twice" and "does not reset an answer" are different
// failures, and one assertion passes on either.
test('RED CHECK: an answered, a declined and an empty project file each survive a re-run of install byte-identical (test 2)', () => {
  const r = makeRepo();
  try {
    install(r.root);
    const f = path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md');
    for (const contents of [TRACKING_ANSWER, 'none\n', '']) {
      fs.writeFileSync(f, contents);
      const res = install(r.root);
      assert.equal(res.code, 0, res.stderr);
      assert.equal(fs.readFileSync(f, 'utf8'), contents, `install walked back over ${JSON.stringify(contents)}`);
    }
  } finally { r.cleanup(); }
});

// Test 10: the whole seed is the single state word, so a later change that seeds a detected remote, a
// token path or an account name fails rather than ships. The fixture HAS a remote, so there is
// something for such a change to leak.
test('the seed is the single state word and nothing detected about the repository (test 10)', () => {
  const r = makeRepo({ withOrigin: true });
  try {
    install(r.root);
    const contents = fs.readFileSync(path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md'), 'utf8');
    assert.equal(contents, 'unanswered\n');
    assert.equal(contents.trim().split(/\s+/).length, 1);
    assert.ok(!contents.includes(path.basename(r.origin)), 'the fixture remote reached the seed');
  } finally { r.cleanup(); }
});

test('--machine seeds the global issue-tracking file once and never overwrites an answer, a declined or an empty file (tests 1, 2)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const tempPlug = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-')); const tempRules = path.join(tempPlug, 'rules'); fs.mkdirSync(tempRules);
  try {
    fs.writeFileSync(path.join(tempRules, 't.md'), '# T\n\n## One\n\n- rule 1\n');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ pluginSource: tempPlug }));
    const machine = () => runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
    const first = machine();
    assert.equal(first.code, 0, first.stderr);
    const f = path.join(home, '.claude', 'rules', 'global_issue_tracking.md');
    assert.equal(fs.readFileSync(f, 'utf8'), 'unanswered\n');
    assert.match(first.stdout, /global_issue_tracking\.md: created/);
    const second = machine();
    assert.equal(fs.readFileSync(f, 'utf8'), 'unanswered\n');
    assert.match(second.stdout, /global_issue_tracking\.md: present, left as it is/);
    for (const contents of [TRACKING_ANSWER, 'none\n', '']) {
      fs.writeFileSync(f, contents);
      assert.equal(machine().code, 0);
      assert.equal(fs.readFileSync(f, 'utf8'), contents, `--machine walked back over ${JSON.stringify(contents)}`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(tempPlug, { recursive: true, force: true, maxRetries: 5 });
  }
});
