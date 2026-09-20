import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
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
    for (const f of ['gate.mjs', 'manifest.mjs', 'register-check.mjs', 'slipbox-check.mjs', 'spec-check.mjs', 'sweep-guard.mjs']) assert.ok(!fs.readFileSync(path.join(r.root, '.githooks/machinery', f), 'utf8').includes(PLUGIN.replace(/\\/g, '/')));
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
    assert.deepEqual(roots.slice().sort(), ['gate.mjs', 'manifest.mjs', 'register-check.mjs', 'slipbox-check.mjs', 'spec-check.mjs', 'sweep-guard.mjs', 'tiers.mjs'], 'exactly the generated CHECK_FILES, plus the runner, the manifest and the tier runner');
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

// Plan Task B5 (recalibration 14; mechanism 12): --hosted-ci turns the recorded hook commands into
// a GitHub Actions workflow — the gate and tiers.merge on push/PR, tiers.heavy on dispatch only.
test('--hosted-ci writes a workflow running the recorded gate and tier commands', () => {
  const r = makeRepo();
  try {
    install(r.root);
    assert.ok(!fs.existsSync(path.join(r.root, '.github/workflows/machinery.yml')), 'a plain install wrote a workflow');
    runScript('scripts/setup.mjs', { args: ['set', 'tiers.merge', 'node --test'], cwd: r.root });
    runScript('scripts/setup.mjs', { args: ['set', 'tiers.heavy', 'node heavy.mjs'], cwd: r.root });
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root, '--hosted-ci'], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    const wf = fs.readFileSync(path.join(r.root, '.github', 'workflows', 'machinery.yml'), 'utf8');
    assert.match(wf, /^on:\n  push: \{ branches: \[main\] \}\n  pull_request: \{\}\n  workflow_dispatch: \{\}$/m);
    assert.match(wf, /^      - run: node \.githooks\/machinery\/gate\.mjs$/m);
    assert.match(wf, /^      - run: node --test$/m);
    assert.match(wf, /^    if: github\.event_name == 'workflow_dispatch'\n(.*\n)*      - run: node heavy\.mjs$/m);
  } finally { r.cleanup(); }
});

// M518 (#110's ledger audit): the ruling "the hosted check BLOCKS: protect the branch on this job"
// lived in the header of the template the wizard replaced, and the wizard did not carry it over. A
// generated workflow that says nothing about being required reports red and merges anyway, and
// branch protection is a forge setting nothing here can read — so this sentence IS the mechanism.
// The assertion is on the generated artifact, not on the source string, so deleting the line from
// install.mjs fails this test rather than passing it silently.
test('--hosted-ci writes the branch-protection ruling into the workflow it generates', () => {
  const r = makeRepo();
  try {
    install(r.root);
    runScript('scripts/setup.mjs', { args: ['set', 'tiers.merge', 'node --test'], cwd: r.root });
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root, '--hosted-ci'], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    const wf = fs.readFileSync(path.join(r.root, '.github', 'workflows', 'machinery.yml'), 'utf8');
    assert.match(wf, /^# This check BLOCKS \(owner ruling 2026-09-02\): make this job a required status check on the protected branch\./m);
    assert.match(wf, /a red result here does not stop a merge\.$/m);
    // The reported status says the same thing, so the workflow and the line cannot disagree.
    assert.match(res.stdout, /hosted check: present — it blocks only while it is a required status check on the protected branch/);
  } finally { r.cleanup(); }
});

test('RED CHECK: --hosted-ci with no tiers recorded refuses and writes nothing', () => {
  const r = makeRepo();
  try {
    install(r.root);
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root, '--hosted-ci'], cwd: r.root });
    assert.equal(res.code, 1);
    assert.match(res.stderr, /tiers\.merge is not recorded in \.claude\/machinery\/config\.json — run \/machinery:setup tiers/);
    assert.equal(fs.existsSync(path.join(r.root, '.github')), false);
  } finally { r.cleanup(); }
});

// Recalibration 21, 37: the universal rules reach every session through the SessionStart and
// SubagentStart hooks that inject core.md; there is no ~/.claude/rules junction to create.
test('RED CHECK: --machine is refused, names what replaced it, and links nothing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  try {
    const res = runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
    assert.equal(res.code, 2);
    assert.match(res.stderr, /--machine was removed: machinery's SessionStart and SubagentStart hooks load core\.md; enable machinery per project with claude plugin install machinery@ai-skills --scope project/);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'rules')), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

// Owner, 2026-09-15: a project install seeds the user's ~/.claude/rules/universal.md with its one
// heading, so the file Claude Code loads into every session exists before the first URULE is filed
// (until now it was created on demand by that filing, and /machinery:reload named it missing).
// Never overwritten: a rule filed there survives every later install, byte for byte.
test('project install seeds ~/.claude/rules/universal.md with its heading once and never overwrites it', () => {
  const r = makeRepo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const installWithHome = () => runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: home } });
  try {
    const first = installWithHome();
    assert.equal(first.code, 0, first.stderr);
    const f = path.join(home, '.claude', 'rules', 'universal.md');
    assert.equal(fs.readFileSync(f, 'utf8'), '# Universal rules\n');
    assert.match(first.stdout, /[\\/]\.claude[\\/]rules[\\/]universal\.md: created$/m, first.stdout);
    const filed = '# Universal rules\n- a filed rule (URULE, 2026-09-15)\n';
    fs.writeFileSync(f, filed);
    const again = installWithHome();
    assert.equal(again.code, 0, again.stderr);
    assert.equal(fs.readFileSync(f, 'utf8'), filed, 'a second install walked back over a filed rule');
    assert.match(again.stdout, /[\\/]\.claude[\\/]rules[\\/]universal\.md: present, left as it is$/m, again.stdout);
  } finally { r.cleanup(); fs.rmSync(home, { recursive: true, force: true }); }
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

test('a foreign .githooks/pre-push that does not invoke the machinery tiers is not overwritten', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(r.root, '.githooks'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.githooks', 'pre-push'), '#!/bin/sh\necho a different, unrelated hook\n');
    const res = install(r.root);
    assert.notEqual(res.code, 0);
    assert.match(res.stderr, /refusing to overwrite \.githooks[\\/]pre-push: it does not already invoke the machinery tiers; move it aside and rerun/);
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks', 'pre-push'), 'utf8'), '#!/bin/sh\necho a different, unrelated hook\n');
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

// #107 (owner, 2026-09-15: "Updated installs have to handle migration"). Older plugins wrote
// generated indexes into an adopting project — .claude/machinery/INDEX.md (0.1.37–0.1.9x),
// RULES_INDEX.md and SPEC_INDEX.md there (0.1.100–0.1.114), and SPEC_INDEX.md inside
// docs/dictated-specs (0.1.100) — and the recalibration removed the index, the reindex script and
// the skill. A project installed on one of those plugins keeps the files, tracked or not. An install
// on the current plugin removes each from disk and from the git index, names every step, and a
// second run reports nothing to migrate and changes no bytes.
const OBSOLETE_INDEXES = ['.claude/machinery/INDEX.md', '.claude/machinery/RULES_INDEX.md', '.claude/machinery/SPEC_INDEX.md', 'docs/dictated-specs/SPEC_INDEX.md'];
const tree = (root) => fs.readdirSync(root, { recursive: true }).filter((p) => !p.startsWith('.git' + path.sep) && p !== '.git').sort();

test('install migrates an older layout: obsolete indexes leave disk and the git index, each step named; a second run has nothing to migrate (#107)', () => {
  const r = makeRepo();
  try {
    for (const p of OBSOLETE_INDEXES) { fs.mkdirSync(path.dirname(path.join(r.root, p)), { recursive: true }); fs.writeFileSync(path.join(r.root, p), '# Register index\n\nGenerated by machinery — do not edit; run /machinery:reindex.\n'); }
    // Two tracked, as a project that committed them; two untracked, as a project that never did.
    execFileSync('git', ['add', '--', OBSOLETE_INDEXES[0], OBSOLETE_INDEXES[1]], { cwd: r.root });
    execFileSync('git', ['commit', '-q', '-m', 'old indexes'], { cwd: r.root });
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    for (const p of OBSOLETE_INDEXES) {
      assert.equal(fs.existsSync(path.join(r.root, p)), false, `${p} is still on disk`);
      assert.match(res.stdout, new RegExp(`^migrated: removed ${p.replace(/[./]/g, '\\$&')} \\(`, 'm'), res.stdout);
    }
    const tracked = execFileSync('git', ['ls-files', '--', ...OBSOLETE_INDEXES], { cwd: r.root, encoding: 'utf8' }).trim();
    assert.equal(tracked, '', `still tracked:\n${tracked}`);
    const deletions = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=D'], { cwd: r.root, encoding: 'utf8' }).trim().split('\n').sort();
    assert.deepEqual(deletions, [OBSOLETE_INDEXES[0], OBSOLETE_INDEXES[1]], 'the tracked ones are staged as removed, nothing else');
    assert.doesNotMatch(res.stdout, /nothing to migrate/);
    const before = tree(r.root);
    const again = install(r.root);
    assert.equal(again.code, 0, again.stderr);
    assert.match(again.stdout, /^migration: nothing to migrate$/m, again.stdout);
    assert.doesNotMatch(again.stdout, /^migrated: /m);
    assert.deepEqual(tree(r.root), before, 'the second run changed the tree');
  } finally { r.cleanup(); }
});

test('a fresh install reports nothing to migrate and removes nothing (#107, no false positive)', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(r.root, '.claude', 'machinery'), { recursive: true });
    fs.writeFileSync(path.join(r.root, '.claude', 'machinery', 'notes.md'), 'the developer\'s own\n');
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /^migration: nothing to migrate$/m, res.stdout);
    assert.doesNotMatch(res.stdout, /^migrated: /m);
    assert.equal(fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'notes.md'), 'utf8'), 'the developer\'s own\n');
  } finally { r.cleanup(); }
});

// Merge review (coherence). install resolved the slip box check against the project root while
// banner.mjs resolved it against the checkout, so one session in a linked worktree could be told
// both MIGRATED and NOT MIGRATED. Both read the checkout being worked in now.
test('RED CHECK: the slip box check reads the checkout being worked in, as the banner does', () => {
  const r = makeRepo();
  try {
    const wt = addWorktree(r.root, 'feature');
    fs.mkdirSync(path.join(wt, 'docs', 'adr'), { recursive: true });
    fs.writeFileSync(path.join(wt, 'docs', 'adr', '0001-x.md'), '# ADR\n');
    const res = runScript('scripts/install.mjs', { cwd: wt });
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /^slip box: NOT MIGRATED — docs\/adr\/ \(1 file\(s\)\)/m, res.stdout);
  } finally { r.cleanup(); }
});
