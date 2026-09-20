import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';
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
  // Not an old spec file, and not a migration trigger: it must survive both commits (F8).
  write(r.root, 'docs/dictated-specs/README.md', '# Dictated specifications\n\n## How this works\n\nRead INDEX.md.\n');
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

// Owner ruling (Gabe, 2026-09-19): "Carry them as owner notes". Twelve of ferrislicer's rulings
// were typed into an old spec file by hand and never captured through `SPEC:`, so no inbox entry
// holds their words and commit 2 would have deleted them. One such section, here:
const HEADING = 'D. Ruling (Gabe, 2026-09-19)';
const RULING = 'extruder_offset is read at tool change and applied on one side only.';
const OWNER = 'owner-d-ruling-gabe-2026-09-19';
const COLLISION = 'docs/dictated-specs/collision.md';
function withRuling(r) {
  write(r.root, COLLISION, read(r.root, COLLISION) + `\n### ${HEADING}\n\n${RULING}\n`);
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'a ruling the owner typed by hand');
}
const ownerRow = (over = {}) => ({ file: COLLISION, heading: HEADING, title: 'extruder_offset is applied on one side only', subsystems: ['extruders'], topic: 'Defaults', supersedes: [], text: RULING, ...over });
// The AI moves the heading out of `unsettled` — where buildPlan leaves every uncarried heading —
// into `ownerNotes`. buildPlan cannot make that judgement itself.
function asOwnerNote(p, over = {}) {
  p.unsettled = p.unsettled.filter((u) => u.heading !== HEADING);
  p.ownerNotes.push(ownerRow(over));
  return p;
}

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
    // docs/dictated-specs/README.md is not an old spec file, so it carries no unsettled row (F8).
    assert.deepEqual(p.unsettled.map((u) => u.heading), ['A — REVERSED 2026-09-09', 'C. never filed']);
    assert.deepEqual(p.unsettled.map((u) => u.file), ['docs/dictated-specs/collision.md', 'docs/dictated-specs/collision.md']);
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
    // Commit 2 deletes every old spec file; the README is not one of them (F8).
    assert.equal(read(r.root, 'docs/dictated-specs/README.md'), '# Dictated specifications\n\n## How this works\n\nRead INDEX.md.\n');
    assert.equal(fs.existsSync(path.join(r.root, 'docs/dictated-specs/collision.md')), false);
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
    // A null status is NOT a gap (the owner's 2026-09-19 ruling): it migrates as historical.
    assert.doesNotMatch(res.stderr, /superpowers docs\/superpowers\/plans\/2026-06-21-hub\.md/);
    assert.match(res.stderr, /reference scripts\/adr_gate\.py: not reviewed/);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.equal(g(r.root, 'rev-list', '--count', 'HEAD'), '2');
  } finally { r.cleanup(); }
});

// Merge review B2. headingsOf keeps only levels 2-4, so an old spec file with a `#` title, prose
// and bullets yielded no unsettled row; with no FILED entry pointing at it, it yielded no note
// either. Commit 2 deleted it all the same, and commit 2's body is built from plan.unsettled, so
// nothing anywhere recorded that the file had existed.
test('RED CHECK: an old spec file that yields no note and no heading is listed whole as unsettled, and its resolution reaches the commit that deletes it', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/machinery/spec-inbox.md', '');
    write(r.root, 'docs/dictated-specs/orphan.md', '# Orphan\n\nsome prose nobody ever filed\n\n- a bullet\n');
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'an orphan spec file');
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const p = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(p.notes, []);
    assert.deepEqual(p.unsettled, [{ file: 'docs/dictated-specs/orphan.md', heading: null, resolution: null }]);

    // And a plan that carries neither is refused rather than deleting the file in silence.
    const bad = JSON.parse(JSON.stringify(p));
    bad.unsettled = [];
    fs.writeFileSync(out, JSON.stringify(bad));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /old spec docs\/dictated-specs\/orphan\.md: no note and no unsettled row carries it/);

    p.unsettled[0].resolution = 'prose only; nothing was ever dictated from it';
    fs.writeFileSync(out, JSON.stringify(p));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/orphan.md')));
    assert.match(g(r.root, 'log', '-1', '--format=%B'), /^docs\/dictated-specs\/orphan\.md: prose only; nothing was ever dictated from it$/m);
  } finally { r.cleanup(); }
});

// Merge review B3. planProblems pre-flighted the notes it writes but not the placements: an embed
// missing for one subsystem of an approved design, a decision link to a docs/adr file that is not
// named 00NN-slug.md (it moves byte-identical, and loadSlipbox never loads it), and a ref to a
// file that is not there each landed in a structure note that gate leg 3 or leg 4 then refused.
test('RED CHECK: an embed missing for one subsystem, a decision link the box will not hold, and a ref to a missing file are each refused', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const base = fill(JSON.parse(fs.readFileSync(out, 'utf8')));

    const twoSubs = JSON.parse(JSON.stringify(base));
    twoSubs.superpowers.find((s) => s.path.endsWith('hub-design.md')).subsystems = ['extruders', 'hubs'];
    fs.writeFileSync(out, JSON.stringify(twoSubs));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /superpowers docs\/superpowers\/specs\/2026-06-21-hub-design\.md: subsystem hubs has no heading in "embeds"/);

    const badDecision = JSON.parse(JSON.stringify(base));
    badDecision.decisionLinks.push({ subsystem: 'extruders', decision: 'README' });
    fs.writeFileSync(out, JSON.stringify(badDecision));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /decision link README: the slip box will hold no decision note with that id/);

    const badRef = JSON.parse(JSON.stringify(base));
    badRef.refs.push({ subsystem: 'extruders', path: 'docs/superpowers/models/gone.html' });
    fs.writeFileSync(out, JSON.stringify(badRef));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, /ref docs\/superpowers\/models\/gone\.html: no such file/);

    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/notes')), 'nothing was written');
  } finally { r.cleanup(); }
});

// Merge review 2, F3. A subsystem name is a file name. Caught when the plan is checked, so the
// migration never writes structure/tooling/deep.md — a file the read model cannot see, in a
// project whose every commit would then be refused with advice that cannot work.
test('RED CHECK: a subsystem name that is not one path segment is refused when the plan is checked, before anything is written', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const p = fill(JSON.parse(fs.readFileSync(out, 'utf8')));
    p.notes[0].subsystems = ['tooling/deep'];
    fs.writeFileSync(out, JSON.stringify(p));
    const head = g(r.root, 'rev-parse', 'HEAD');
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stderr, /tooling\/deep/);
    assert.match(res.stderr, /one path segment/);
    assert.equal(g(r.root, 'rev-parse', 'HEAD'), head);
    assert.equal(g(r.root, 'status', '--porcelain'), '', 'nothing was written');
  } finally { r.cleanup(); }
});

// Merge review 2, F7. planProblems guarded decisionLinks against a filename that is not an ADR,
// but not against an ADR that is already superseded. Leg 3 strips such a link from every "Why"
// section, so the migration's own commit was refused, and the advice leg 3 prints — run
// `decision --file` on the successor — refuses too, because a migrated ADR has no front matter.
test('RED CHECK: a decision link to a superseded ADR is refused when the plan is checked, and the successor is accepted', () => {
  const r = oldProject();
  try {
    write(r.root, 'docs/adr/0001-x.md', '# ADR 1\n\n- **Status:** Superseded by ADR-0002\n');
    write(r.root, 'docs/adr/0002-y.md', '# ADR 2\n\n- **Status:** Accepted\n');
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'supersede 0001');
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const p = fill(JSON.parse(fs.readFileSync(out, 'utf8')));
    fs.writeFileSync(out, JSON.stringify(p));
    const head = g(r.root, 'rev-parse', 'HEAD');
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stderr, /decision link 0001-x/);
    assert.match(res.stderr, /[Ss]uperseded/);
    assert.match(res.stderr, /successor/);
    assert.doesNotMatch(res.stderr, /intake\.mjs decision --file/, 'that command refuses on a migrated ADR: it has no front matter');
    assert.equal(g(r.root, 'rev-parse', 'HEAD'), head);
    assert.equal(g(r.root, 'status', '--porcelain'), '', 'nothing was written');

    p.decisionLinks = [{ subsystem: 'extruders', decision: '0002-y' }];
    fs.writeFileSync(out, JSON.stringify(p));
    const ok2 = intake(r.root, 'migrate', '--apply', out);
    assert.equal(ok2.code, 0, ok2.stderr + ok2.stdout);
    const st = read(r.root, 'docs/dictated-specs/structure/extruders.md');
    assert.match(st, /- \[\[0002-y\]\]/);
    assert.doesNotMatch(st, /0001-x/);
  } finally { r.cleanup(); }
});

// Merge review 2, F8. unmigrated() read every top-level .md under docs/dictated-specs except
// INDEX.md as an old spec file, and commit 2 deletes every old spec file. A project with a README
// there would have lost it, and would have been called unmigrated for ever after.
test('RED CHECK: docs/dictated-specs/README.md is neither a migration trigger nor a file the migration deletes', () => {
  const r = makeRepo();
  try {
    write(r.root, 'docs/dictated-specs/README.md', '# Dictated specifications\n\n## How this works\n\nRead INDEX.md.\n');
    const u = unmigrated(r.root);
    assert.deepEqual(u.oldSpecs, [], 'a README is not an old spec file');
    assert.equal(u.any, false, 'a README alone does not make a project unmigrated');
  } finally { r.cleanup(); }
});

// The owner ruled on 2026-09-19 that only ratified work is approved and "the rest historical".
// A plan row that leaves `status` null is therefore not a gap: it IS historical, for a design and
// for a plan alike. An explicit status still wins.
test('RED CHECK: a superpowers row with no status migrates as historical, and an explicit status is untouched', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const p = fill(JSON.parse(fs.readFileSync(out, 'utf8')));
    const design = p.superpowers.find((s) => s.path.endsWith('hub-design.md'));
    Object.assign(design, { status: null, subsystems: [] });
    p.embeds.length = 0;
    // The plan row keeps the explicit 'done' that fill() gave it.
    assert.equal(p.superpowers.find((s) => s.path.endsWith('plans/2026-06-21-hub.md')).status, 'done');
    fs.writeFileSync(out, JSON.stringify(p));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.match(read(r.root, 'docs/superpowers/specs/2026-06-21-hub-design.md'), /kind: design\nstatus: historical\n/);
    assert.match(read(r.root, 'docs/superpowers/plans/2026-06-21-hub.md'), /kind: plan\nstatus: done\n/);
  } finally { r.cleanup(); }
});

// Ferrislicer trial, ruling 1 (Gabe, 2026-09-19: "Carry them as owner notes"). The words are the
// owner's, typed into the old spec file; nothing captured them, so the verbatim leg can never
// cover them. They are carried anyway, byte for byte, saying in their own first line what could
// not be proved — and they are in force and embedded exactly like a dictation note.
test('RED CHECK: a hand-typed ruling migrates as an owner note — transcribed, in force, embedded, and the gate accepts it', () => {
  const r = oldProject();
  try {
    withRuling(r);
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const skeleton = JSON.parse(fs.readFileSync(out, 'utf8'));
    // buildPlan does NOT invent these rows: it cannot know which headings are the owner's rulings.
    assert.deepEqual(skeleton.ownerNotes, []);
    assert.ok(skeleton.unsettled.some((u) => u.heading === HEADING), 'the heading shows up as unsettled until the AI moves it');
    // It supersedes the later dictation, as ferrislicer's § 8.A reverses the note the page shows.
    fs.writeFileSync(out, JSON.stringify(asOwnerNote(fill(skeleton), { supersedes: ['2026-09-09T10-00-00Z'] })));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);

    const note = read(r.root, `docs/dictated-specs/notes/${OWNER}.md`);
    assert.match(note, new RegExp(`^---\\nid: ${OWNER}\\nkind: owner\\nsubsystems: \\[extruders\\]\\nsupersedes: \\[2026-09-09T10-00-00Z\\]\\nsource: ${COLLISION} § ${HEADING.replace(/[().]/g, '\\$&')}\\n---\\n`));
    assert.match(note, /^# extruder_offset is applied on one side only$/m);
    assert.match(note, /transcribed from/i);
    assert.match(note, /not captured through the `SPEC:` marker/);
    assert.ok(note.includes(RULING), 'the owner\'s words, byte for byte');
    assert.match(note, /Supersedes \[\[2026-09-09T10-00-00Z\]\]\./);

    const st = read(r.root, 'docs/dictated-specs/structure/extruders.md');
    assert.match(st, new RegExp(`!\\[\\[${OWNER}\\]\\]`));
    assert.doesNotMatch(st, /!\[\[2026-09-09T10-00-00Z\]\]/, 'the note it supersedes is no longer embedded');
    assert.ok(read(r.root, 'docs/spec-current/extruders.md').includes(RULING));
    // The old file is gone, and its ruling is not gone with it.
    assert.equal(fs.existsSync(path.join(r.root, COLLISION)), false);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('RED CHECK: every unfillable owner note row is refused by name, and nothing is written', () => {
  const r = oldProject();
  try {
    withRuling(r);
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const base = asOwnerNote(fill(JSON.parse(fs.readFileSync(out, 'utf8'))));
    const head = g(r.root, 'rev-parse', 'HEAD');
    const refuse = (over, re) => {
      const p = JSON.parse(JSON.stringify(base));
      Object.assign(p.ownerNotes[0], over);
      fs.writeFileSync(out, JSON.stringify(p));
      assert.match(intake(r.root, 'migrate', '--apply', out).stderr, re);
    };
    const at = `owner note ${COLLISION} § ${HEADING}`.replace(/[().]/g, '\\$&');
    refuse({ title: null }, new RegExp(`${at}: title, topic and subsystems are required`));
    refuse({ subsystems: [] }, new RegExp(`${at}: title, topic and subsystems are required`));
    refuse({ subsystems: ['tooling/deep'] }, /one path segment/);
    refuse({ text: 'words the owner never typed' }, new RegExp(`${at}: its text is not in ${COLLISION} byte for byte`));
    refuse({ heading: 'Nope' }, new RegExp(`owner note ${COLLISION} § Nope: ${COLLISION} has no heading 'Nope'`));
    refuse({ file: 'docs/dictated-specs/README.md' }, /owner note docs\/dictated-specs\/README\.md § .*: not one of the old spec files this migration removes/);
    refuse({ supersedes: ['no-such-note'] }, new RegExp(`${at}: supersedes no-such-note, which is no note in this plan or in the slip box`));
    refuse({ heading: '— —' }, /owner note .*: no id can be derived from that heading/);

    const twice = JSON.parse(JSON.stringify(base));
    // Two headings that differ only in punctuation slugify to one id, so one would silently
    // overwrite the other. `D. Ruling (Gabe, 2026-09-19)` and `D Ruling Gabe 2026 09 19` are that.
    twice.ownerNotes.push(ownerRow({ heading: 'D Ruling Gabe 2026 09 19' }));
    fs.writeFileSync(out, JSON.stringify(twice));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, new RegExp(`owner note .*: two rows would be written to the note ${OWNER}`));

    assert.equal(g(r.root, 'rev-parse', 'HEAD'), head);
    assert.equal(g(r.root, 'status', '--porcelain'), '', 'nothing was written');
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/notes')));
  } finally { r.cleanup(); }
});

// An owner note is written once, like every other note, and it is the only thing that can carry a
// file whose every heading is the owner's own ruling.
test('RED CHECK: an owner note alone carries its old spec file, and a plan already applied is refused before anything is written', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/machinery/spec-inbox.md', '');
    write(r.root, 'docs/dictated-specs/rulings.md', '# Rulings\n\n## 1. The ruling\n\nThe printhead model is the collision model.\n');
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'rulings typed by hand');
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const p = JSON.parse(fs.readFileSync(out, 'utf8'));
    p.unsettled = [];
    p.ownerNotes.push({ file: 'docs/dictated-specs/rulings.md', heading: '1. The ruling', title: 'The printhead model is the collision model', subsystems: ['collision'], topic: 'What the collision model is', supersedes: [], text: 'The printhead model is the collision model.' });
    fs.writeFileSync(out, JSON.stringify(p));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.ok(read(r.root, 'docs/dictated-specs/notes/owner-1-the-ruling.md').includes('The printhead model is the collision model.'));
    assert.equal(fs.existsSync(path.join(r.root, 'docs/dictated-specs/rulings.md')), false);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);

    const again = intake(r.root, 'migrate', '--apply', out);
    assert.equal(again.code, 1, again.stdout);
    assert.match(again.stderr, /note owner-1-the-ruling: docs\/dictated-specs\/notes\/owner-1-the-ruling\.md already exists — a note is written once/);
  } finally { r.cleanup(); }
});

// Ferrislicer trial, ruling 2. Four FILED entries name an old spec file deleted long ago.
// buildPlan filtered entries down to the files still on disk, so those four were dropped in
// silence: no note, no unsettled row, no refusal. Their words are in the inbox, so nothing is
// guessed by carrying them.
test('RED CHECK: a FILED entry whose old home is gone still becomes a note, marked, and dropping it is refused', () => {
  const r = oldProject();
  try {
    const C = '2026-09-10T09:00:00Z';
    const GONE = 'docs/dictated-specs/extruder-ownership.md';
    write(r.root, '.claude/machinery/spec-inbox.md', read(r.root, '.claude/machinery/spec-inbox.md') + filed(C, 'SPEC: a printer switch resets the plate extruder', `${GONE} § 2`));
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'an entry filed into a file since deleted');
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const p = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(p.notes.map((n) => [n.stamp, n.oldHomeMissing]), [[A, false], [B, false], [C, true]]);

    const dropped = fill(JSON.parse(JSON.stringify(p)));
    dropped.notes = dropped.notes.filter((n) => n.stamp !== C);
    fs.writeFileSync(out, JSON.stringify(dropped));
    assert.match(intake(r.root, 'migrate', '--apply', out).stderr, new RegExp(`note ${C}: filed into ${GONE.replace(/[./]/g, '\\$&')}, which no longer exists, but no plan entry carries it`));

    const good = fill(JSON.parse(JSON.stringify(p)));
    Object.assign(good.notes.find((n) => n.stamp === C), { title: 'A printer switch resets the plate extruder', subsystems: ['extruders'], topic: 'Defaults' });
    fs.writeFileSync(out, JSON.stringify(good));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.match(read(r.root, 'docs/dictated-specs/notes/2026-09-10T09-00-00Z.md'), /> SPEC: a printer switch resets the plate extruder\n/);
    assert.match(read(r.root, '.claude/machinery/spec-inbox.md'), /filed → docs\/dictated-specs\/notes\/2026-09-10T09-00-00Z\.md/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

// Ferrislicer trial, ruling 3 (Gabe, 2026-09-19: "fix the path strings"), and the map row the
// trial found buildPlan never emits. Both are instructions to the migrator, and the skill is the
// file an assistant follows: a migration that trusts the sweep breaks the project's own CI gate.
test('RED CHECK: the skill says the reference sweep is literal-only, and that owner notes and map rows are hand-filled', () => {
  const copies = [
    path.join(PLUGIN, 'skills', 'rule-process', 'SKILL.md'),
    path.join(PLUGIN, '..', '..', 'claude-code', 'machinery', 'rule-process', 'SKILL.md'),
  ].map((f) => fs.readFileSync(f, 'utf8'));
  assert.equal(copies[0], copies[1], 'both copies of the skill must say the same thing');
  for (const t of copies) {
    assert.match(t, /finds literal strings only/, 'the sweep\'s blind spot is stated plainly');
    assert.match(t, /os\.path\.join/, 'the measured example of a path built in pieces');
    assert.match(t, /`ownerNotes`/, 'the plan list the AI fills for a hand-typed ruling');
    assert.match(t, /never emits `kind: map`/, 'a living map is hand-edited into the plan');
  }
});
