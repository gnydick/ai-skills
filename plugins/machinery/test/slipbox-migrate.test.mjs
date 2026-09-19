import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { formatEntry } from '../scripts/lib/inbox.mjs';
import { unmigrated } from '../scripts/lib/unmigrated.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const intake = (root, ...args) => runScript('scripts/intake.mjs', { args: [...args, '--root', root], cwd: root, env: env() });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const A = '2026-09-01T08:00:00Z', B = '2026-09-09T10:00:00Z';
const filed = (stamp, text, home) => formatEntry({ stamp, marker: 'SPEC', text, session: 's' }).replace('## PENDING', '## FILED').replace('disposition: PENDING', `disposition: filed → ${home}`);
const ADR = '# ADR 1\n\n- **Status:** Accepted\n';

function oldProject() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', filed(A, 'SPEC: each object has its own extruder', 'docs/dictated-specs/collision.md § A') + filed(B, 'SPEC: objects need not have their own extruder', 'docs/dictated-specs/collision.md § B'));
  // The fenced `## ` line is not a heading: headings are read through embed.mjs's scan, like
  // everywhere else in this feature, so it is never listed as an unsettled heading.
  write(r.root, 'docs/dictated-specs/collision.md', '# Collision\n\n### A — REVERSED 2026-09-09\n\neach object has its own extruder (reworded)\n\nASSISTANT, offered so it can be struck: maybe per group\n\n### B\n\nobjects need not\n\n### C. never filed\n\ntext\n\n```\n## Not a heading\n```\n');
  write(r.root, 'docs/adr/0001-x.md', ADR);
  write(r.root, 'docs/adr/README.md', '# ADRs\n');
  write(r.root, 'docs/superpowers/specs/2026-06-21-hub-design.md', '# Hub\n\n## Decisions\n\n- one hub\n\n## Files touched\n\n- hub.rs\n');
  write(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md', '# Map\n');
  write(r.root, 'docs/superpowers/plans/2026-06-21-hub.md', '# Plan\n\n- [x] one\n');
  write(r.root, 'scripts/adr_gate.py', 'ADR_DIR = "docs/adr"\n');
  // A second mention the owner reviews and decides NOT to rewrite: it must be left untouched.
  write(r.root, 'docs/notes/adr-howto.md', '# How to\n\nADRs used to live in docs/adr.\n');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'old layout');
  return r;
}
const planFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'plan-')), 'plan.json');

function fill(p) {
  const byStamp = Object.fromEntries(p.notes.map((n) => [n.stamp, n]));
  Object.assign(byStamp[A], { title: 'Each object has its own extruder', subsystems: ['extruders'], topic: 'Defaults' });
  Object.assign(byStamp[B], { title: 'Objects need not have their own extruder', subsystems: ['extruders'], topic: 'Defaults', supersedes: ['2026-09-01T08-00-00Z'] });
  for (const u of p.unsettled) u.resolution = u.heading.startsWith('C.') ? 'not a dictation: a heading with no captured words; owner to dictate if wanted' : 'covered by its inbox entry';
  for (const s of p.superpowers) {
    if (s.path.endsWith('hub-design.md')) Object.assign(s, { status: 'approved', subsystems: ['extruders'] });
    else if (s.path.endsWith('pipeline-map.md')) Object.assign(s, { kind: 'map' });
    else Object.assign(s, { status: 'done', ticket: '3' });
  }
  p.embeds.push({ subsystem: 'extruders', topic: 'Hub', note: '2026-06-21-hub-design', heading: 'Decisions' });
  p.decisionLinks.push({ subsystem: 'extruders', decision: '0001-x' });
  p.refs.push({ subsystem: 'extruders', path: 'docs/superpowers/specs/2026-08-09-pipeline-map.md' });
  for (const r of p.references) Object.assign(r, { replace: r.path.endsWith('.py') ? [['docs/adr', 'docs/dictated-specs/decisions']] : [], reviewed: true });
  return p;
}
const filled = (out) => { fs.writeFileSync(out, JSON.stringify(fill(JSON.parse(fs.readFileSync(out, 'utf8'))))); };

test('--plan writes a skeleton listing every item, and changes nothing in the project', () => {
  const r = oldProject();
  try {
    const out = planFile();
    const res = intake(r.root, 'migrate', '--plan', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    const p = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(p.notes.map((n) => [n.stamp, n.oldHome]), [[A, 'docs/dictated-specs/collision.md § A'], [B, 'docs/dictated-specs/collision.md § B']]);
    assert.deepEqual(p.unsettled.map((u) => u.heading), ['A — REVERSED 2026-09-09', 'C. never filed']);
    assert.deepEqual(p.adr.files, ['0001-x.md', 'README.md']);
    assert.deepEqual(p.superpowers.map((s) => [s.path, s.kind]), [
      ['docs/superpowers/specs/2026-06-21-hub-design.md', 'design'],
      ['docs/superpowers/specs/2026-08-09-pipeline-map.md', 'design'],
      ['docs/superpowers/plans/2026-06-21-hub.md', 'plan'],
    ]);
    assert.deepEqual(p.references.map((x) => [x.path, x.mentions]), [['docs/notes/adr-howto.md', ['docs/adr']], ['scripts/adr_gate.py', ['docs/adr']]]);
    // The owner reads the plan, not the repository: each mention comes with its line and its text.
    assert.deepEqual(p.references.find((x) => x.path === 'scripts/adr_gate.py').matches, [{ line: 1, text: 'ADR_DIR = "docs/adr"' }]);
    assert.match(res.stdout, /2 note\(s\), 2 unsettled heading\(s\), 2 ADR file\(s\), 3 superpowers file\(s\), 2 reference file\(s\)/);
  } finally { r.cleanup(); }
});

test('--apply migrates in two commits: notes from the inbox, ADRs moved intact, references fixed, old files removed; the gate passes', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    fs.writeFileSync(out, JSON.stringify(fill(JSON.parse(fs.readFileSync(out, 'utf8')))));
    const howto = path.join(r.root, 'docs/notes/adr-howto.md');
    const untouched = fs.statSync(howto).mtimeMs;
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    // The owner sees what was rewritten, per file, and a reviewed file with no replacement is
    // not rewritten at all.
    assert.match(res.stdout, /reference scripts\/adr_gate\.py: 1 replacement\(s\)/);
    assert.match(res.stdout, /reference docs\/notes\/adr-howto\.md: 0 replacement\(s\)/);
    assert.equal(read(r.root, 'docs/notes/adr-howto.md'), '# How to\n\nADRs used to live in docs/adr.\n');
    assert.equal(fs.statSync(howto).mtimeMs, untouched, 'an unchanged reference file is not rewritten');
    assert.equal(g(r.root, 'rev-list', '--count', 'HEAD~2..HEAD'), '2');
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.match(read(r.root, 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md'), /> SPEC: each object has its own extruder\n/);
    assert.doesNotMatch(read(r.root, 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md'), /reworded/);
    assert.equal(read(r.root, 'docs/dictated-specs/decisions/0001-x.md'), ADR);
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/adr')));
    assert.equal(read(r.root, 'scripts/adr_gate.py'), 'ADR_DIR = "docs/dictated-specs/decisions"\n');
    assert.match(read(r.root, 'docs/superpowers/plans/2026-06-21-hub.md'), /^---\nkind: plan\nstatus: done\nticket: 3\n---\n/);
    assert.match(read(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md'), /^---\nkind: map\n---\n/);
    const page = read(r.root, 'docs/spec-current/extruders.md');
    assert.match(page, /SPEC: objects need not have their own extruder/);
    assert.doesNotMatch(page, /SPEC: each object has its own extruder/);
    assert.match(page, /one hub/);
    assert.doesNotMatch(page, /hub\.rs/);
    for (const f of g(r.root, 'ls-files').split('\n')) assert.doesNotMatch(read(r.root, f), /ASSISTANT, offered so it can be struck/, f);
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/collision.md')));
    assert.match(g(r.root, 'show', '--name-status', '--format=', 'HEAD'), /^D\tdocs\/dictated-specs\/collision\.md$/);
    assert.equal(unmigrated(r.root).any, false);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

// The directory itself, not just its files: unmigrated() reports fs.existsSync(docs/adr), so an
// empty leftover would keep every session in the project saying NOT MIGRATED for ever.
test('--apply removes the docs/adr directory itself, so the project reads as migrated', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    fs.writeFileSync(out, JSON.stringify(fill(JSON.parse(fs.readFileSync(out, 'utf8')))));
    assert.equal(intake(r.root, 'migrate', '--apply', out).code, 0);
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/adr')), 'the directory is gone, not merely empty');
    assert.equal(unmigrated(r.root).adr, false);
    assert.equal(g(r.root, 'ls-files', 'docs/adr'), '', 'nothing under docs/adr is tracked any more');
    const banner = runScript('scripts/banner.mjs', { stdin: JSON.stringify({ cwd: r.root, hook_event_name: 'SessionStart' }), cwd: r.root, env: env() });
    assert.doesNotMatch(JSON.parse(banner.stdout).hookSpecificOutput.additionalContext, /slip box/);
  } finally { r.cleanup(); }
});

// Measured 2026-09-19: the placement loop walked EVERY live note in the box, not just the plan's,
// and placed unconditionally with a topic only this plan's notes have. One loose .md under
// docs/dictated-specs/ makes the banner tell every session to migrate; the second --apply then
// re-placed every note already migrated and spliced a literal `## undefined` heading. The gate
// cannot see either.
test('migrating twice places nothing twice and writes no "## undefined" heading', () => {
  const r = oldProject();
  try {
    const first = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', first).code, 0);
    filled(first);
    assert.equal(intake(r.root, 'migrate', '--apply', first).code, 0);
    const before = read(r.root, 'docs/dictated-specs/structure/extruders.md');

    write(r.root, 'docs/dictated-specs/loose.md', '# Loose\n\n## Stray\n\nwords\n');
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'a loose file arrives');
    const second = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', second).code, 0);
    const p = JSON.parse(fs.readFileSync(second, 'utf8'));
    assert.deepEqual(p.notes, [], 'nothing is left to file');
    for (const u of p.unsettled) u.resolution = 'not a dictation';
    for (const x of p.references) x.reviewed = true;
    fs.writeFileSync(second, JSON.stringify(p));
    const res = intake(r.root, 'migrate', '--apply', second);
    assert.equal(res.code, 0, res.stderr + res.stdout);

    const st = read(r.root, 'docs/dictated-specs/structure/extruders.md');
    assert.doesNotMatch(st, /## undefined/);
    for (const line of new Set(st.split('\n').filter((l) => l.trim().startsWith('![[') || l.trim().startsWith('- [')))) {
      assert.equal(st.split('\n').filter((l) => l === line).length, 1, `placed twice: ${line}`);
    }
    assert.equal(st, before, 'the structure note is untouched by a second migration');
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/loose.md')));
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

// A failed migration is undone with `git checkout -- . && git clean -fd`, which would also throw
// away the user's own uncommitted work. So it refuses to start on a dirty tree.
test('--apply refuses a dirty working tree and changes nothing', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    filled(out);
    write(r.root, 'scripts/mine.py', 'my own work in progress\n');
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stderr, /the working tree is not clean/);
    assert.match(res.stderr, /scripts\/mine\.py/);
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/notes')), 'nothing was written');
    assert.equal(g(r.root, 'rev-list', '--count', 'HEAD'), '2');
  } finally { r.cleanup(); }
});

// writeOnce would throw halfway through a re-run. The plan is checked against the notes on disk
// first, so an already-applied plan refuses before anything is touched.
test('--apply refuses a plan whose notes already exist, before writing anything', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    filled(out);
    assert.equal(intake(r.root, 'migrate', '--apply', out).code, 0);
    const head = g(r.root, 'rev-parse', 'HEAD');
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stderr, /note 2026-09-01T08-00-00Z: docs\/dictated-specs\/notes\/2026-09-01T08-00-00Z\.md already exists/);
    assert.equal(g(r.root, 'rev-parse', 'HEAD'), head);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
  } finally { r.cleanup(); }
});

// The migration's own commits are ordinary commits: in an installed project they run the gate.
test('the migration commits pass the project\'s own pre-commit hook', () => {
  const r = oldProject();
  try {
    assert.equal(runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root }).code, 0);
    // The gate refuses every commit until tiers and components are recorded, so the fixture
    // records both: without them the hook never reaches the slip box legs at all.
    assert.equal(runScript('scripts/setup.mjs', { args: ['set', 'components', 'docs=docs'], cwd: r.root }).code, 0);
    assert.equal(runScript('scripts/setup.mjs', { args: ['set', 'tiers.fast', 'node --version <components>'], cwd: r.root }).code, 0);
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install machinery');
    assert.equal(g(r.root, 'config', 'core.hooksPath'), '.githooks');
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    filled(out);
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(g(r.root, 'rev-list', '--count', 'HEAD~2..HEAD'), '2');
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

// Measured 2026-09-19: the refusal named `git checkout -- . && git clean -fd`, which does not undo
// a failure past the ADR move — git mv stages the rename, so checkout restores the worktree FROM
// that index and the rename survives both commands. The tree then stays dirty and --apply refuses
// for ever. `git reset --hard` is the command that works, and the clean-tree precondition is what
// makes it safe.
test('a run that fails part-way names a recovery command that actually works, and the retry is accepted', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const p = fill(JSON.parse(fs.readFileSync(out, 'utf8')));
    // Fails in the references loop, which runs AFTER the ADR move.
    p.references.find((x) => x.path.endsWith('.py')).replace = [['NOT-IN-THIS-FILE', 'x']];
    fs.writeFileSync(out, JSON.stringify(p));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stderr, /reference scripts\/adr_gate\.py: 'NOT-IN-THIS-FILE' not found/);
    assert.match(res.stderr, /git reset --hard && git clean -fd/);
    assert.doesNotMatch(res.stderr, /git checkout -- \./);
    assert.notEqual(g(r.root, 'status', '--porcelain'), '', 'the run really did stop part-way');

    g(r.root, 'reset', '--hard'); g(r.root, 'clean', '-fd');
    assert.equal(g(r.root, 'status', '--porcelain'), '', 'the named command leaves a clean tree');
    assert.ok(fs.existsSync(path.join(r.root, 'docs/adr/0001-x.md')), 'the ADR move is undone');
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/decisions')));

    filled(out);
    const again = intake(r.root, 'migrate', '--apply', out);
    assert.equal(again.code, 0, again.stderr + again.stdout);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

// A REVERSED section is a partial change: the new dictation and the old one are consumed into one
// version note, which is what the structure note then embeds (#132 § 5).
test('a REVERSED section migrates as a version note, and the gate passes', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const p = fill(JSON.parse(fs.readFileSync(out, 'utf8')));
    p.notes.find((n) => n.stamp === B).supersedes = [];
    p.versions.push({ from: B, supersedes: '2026-09-01T08-00-00Z', subsystems: ['extruders'], topic: 'Defaults', text: 'An object has its own extruder unless its group sets one.' });
    fs.writeFileSync(out, JSON.stringify(p));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    const v = read(r.root, 'docs/dictated-specs/notes/2026-09-09T10-00-00Z-v.md');
    assert.match(v, /^---\nid: 2026-09-09T10-00-00Z-v\nkind: version\nsubsystems: \[extruders\]\nsupersedes: \[2026-09-01T08-00-00Z\]\nfrom: \[2026-09-09T10-00-00Z\]\n---\n/);
    assert.match(v, /An object has its own extruder unless its group sets one\./);
    const st = read(r.root, 'docs/dictated-specs/structure/extruders.md');
    assert.match(st, /!\[\[2026-09-09T10-00-00Z-v\]\]/);
    assert.doesNotMatch(st, /!\[\[2026-09-01T08-00-00Z\]\]/);
    assert.doesNotMatch(st, /!\[\[2026-09-09T10-00-00Z\]\]/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('RED CHECK: a version naming an id that is not a note, a FILED entry the plan omits, an unmovable docs/adr file, and a plan of the wrong version are each refused', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const base = fill(JSON.parse(fs.readFileSync(out, 'utf8')));

    const bad = JSON.parse(JSON.stringify(base));
    bad.versions.push({ from: B, supersedes: 'no-such-note', subsystems: ['extruders'], topic: 'Defaults', text: 'x' });
    fs.writeFileSync(out, JSON.stringify(bad));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /version supersedes no-such-note: no such note in this plan or in the slip box/);

    const dropped = JSON.parse(JSON.stringify(base));
    dropped.notes = dropped.notes.filter((n) => n.stamp !== B);
    fs.writeFileSync(out, JSON.stringify(dropped));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /note 2026-09-09T10:00:00Z: filed into docs\/dictated-specs\/collision\.md, which this migration removes, but no plan entry carries it/);

    const wrongVersion = JSON.parse(JSON.stringify(base));
    wrongVersion.version = 2;
    fs.writeFileSync(out, JSON.stringify(wrongVersion));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /plan: version 2 is not supported/);

    fs.writeFileSync(out, '{ not json');
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /not valid JSON/);

    write(r.root, 'docs/adr/diagram.svg', '<svg/>\n');
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'a non-markdown ADR file');
    fs.writeFileSync(out, JSON.stringify(base));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /docs\/adr holds diagram\.svg, which the migration does not move/);

    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/notes')), 'nothing was written');
  } finally { r.cleanup(); }
});

test('RED CHECK: --apply refuses an unfilled plan, lists every gap, and changes nothing', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /note 2026-09-01T08:00:00Z: title, topic and subsystems are required/);
    assert.match(res.stderr, /unsettled docs\/dictated-specs\/collision\.md § C\. never filed: no resolution/);
    assert.match(res.stderr, /superpowers docs\/superpowers\/plans\/2026-06-21-hub\.md: status is required for a plan/);
    assert.match(res.stderr, /reference scripts\/adr_gate\.py: not reviewed/);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.equal(g(r.root, 'rev-list', '--count', 'HEAD'), '2');
  } finally { r.cleanup(); }
});
