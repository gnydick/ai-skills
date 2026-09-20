import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const intake = (root, ...args) => runScript('scripts/intake.mjs', { args: [...args, '--root', root], cwd: root, env: env() });
// What the assistant actually runs on a branch: from inside the linked worktree, with no --root.
const intakeIn = (cwd, ...args) => runScript('scripts/intake.mjs', { args, cwd, env: env() });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const V1 = 'docs/superpowers/specs/2026-09-02-hub-design.md';
const V2 = 'docs/superpowers/specs/2026-09-15-hub-v2-design.md';
const PLAN = 'docs/superpowers/plans/2026-09-02-hub.md';
const ST = 'docs/dictated-specs/structure/config.md';
const BODY = (t) => `# ${t}\n\n## Decisions (Gabe, 2026-09-02)\n\n- ${t} decided\n\n## Files touched\n\n- hub.rs\n`;

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  return r;
}
const ok = (res) => assert.equal(res.code, 0, res.stderr + res.stdout);

test('a design is filed as a draft, approved, and embedded by one decisions heading; the flat page leaves out implementation', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config', '--ticket', '12'));
    assert.equal(read(r.root, V1), `---\nkind: design\nstatus: draft\nsubsystems: [config]\nticket: 12\n---\n${BODY('Hub')}`);
    ok(intake(r.root, 'design', '--approve', V1));
    assert.match(read(r.root, V1), /status: approved/);
    assert.equal(gate(r.root).code, 1, 'approved but not yet embedded');
    ok(intake(r.root, 'design', '--embed', V1, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    assert.match(read(r.root, ST), /## Hub\n\n!\[\[2026-09-02-hub-design#Decisions \(Gabe, 2026-09-02\)\]\]/);
    const page = read(r.root, 'docs/spec-current/config.md');
    assert.match(page, /Hub decided/);
    assert.doesNotMatch(page, /hub\.rs/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('an approved design superseded by a new one: the old file is untouched and its embed leaves the structure note', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config'));
    ok(intake(r.root, 'design', '--approve', V1));
    ok(intake(r.root, 'design', '--embed', V1, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    const v1 = read(r.root, V1);
    write(r.root, V2, BODY('Hub v2'));
    ok(intake(r.root, 'design', '--file', V2, '--subsystems', 'config', '--supersedes', '2026-09-02-hub-design'));
    ok(intake(r.root, 'design', '--approve', V2));
    ok(intake(r.root, 'design', '--embed', V2, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    assert.equal(read(r.root, V1), v1);
    assert.doesNotMatch(read(r.root, ST), /2026-09-02-hub-design#/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('a plan is filed in progress with its ticket, then closed; a map is marked and never embedded', () => {
  const r = project();
  try {
    write(r.root, PLAN, '# Plan\n\n- [ ] one\n');
    ok(intake(r.root, 'plan', '--file', PLAN, '--ticket', '12'));
    assert.match(read(r.root, PLAN), /^---\nkind: plan\nticket: 12\nstatus: in-progress\n---\n# Plan/);
    ok(intake(r.root, 'plan', '--file', PLAN, '--status', 'done'));
    assert.match(read(r.root, PLAN), /status: done/);
    write(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md', '# Map\n\n## Stage\n\n- x\n');
    ok(intake(r.root, 'map', '--file', 'docs/superpowers/specs/2026-08-09-pipeline-map.md'));
    assert.match(read(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md'), /^---\nkind: map\n---\n/);
    const refuse = intake(r.root, 'design', '--embed', 'docs/superpowers/specs/2026-08-09-pipeline-map.md', '--subsystem', 'config', '--topic', 'T', '--heading', 'Stage');
    assert.equal(refuse.code, 1);
    assert.match(refuse.stderr, /only an approved design note is embedded/);
  } finally { r.cleanup(); }
});

// Owner, 2026-09-19 (the Task 7 ruling): the writer and the checker must agree on one tree. The
// gate judges the checkout being committed (#132 § 9), so these commands resolve with checkoutRoot.
test('design --file run in a linked worktree writes that worktree, not the main checkout', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'design drafted');
    const wt = addWorktree(r.root, 'feat');
    const mainBefore = read(r.root, V1);
    const res = intakeIn(wt, 'design', '--file', V1, '--subsystems', 'config', '--ticket', '12');
    ok(res);
    assert.match(read(wt, V1), /^---\nkind: design\nstatus: draft\nsubsystems: \[config\]\nticket: 12\n---\n/);
    assert.equal(read(r.root, V1), mainBefore, 'the main checkout is untouched');
  } finally { r.cleanup(); }
});

// Measured 2026-09-19: --embed with no --subsystem and no --topic exited 0 and wrote
// structure/null.md, spec-current/null.md and a `null` row in INDEX.md. That junk subsystem then
// refuses every commit in the project, and D2 forbids deleting a structure note by hand.
test('design --embed refuses without --subsystem and --topic, before anything is written', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config'));
    ok(intake(r.root, 'design', '--approve', V1));
    const res = intake(r.root, 'design', '--embed', V1, '--heading', 'Decisions (Gabe, 2026-09-02)');
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stderr, /usage: intake design --embed <path> --subsystem <s> --topic "<t>" --heading "<h>"/);
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/structure/null.md')), 'no junk structure note');
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/spec-current/null.md')), 'no junk flat page');
    const index = path.join(r.root, 'docs/dictated-specs/INDEX.md');
    if (fs.existsSync(index)) assert.doesNotMatch(read(r.root, 'docs/dictated-specs/INDEX.md'), /null/);
  } finally { r.cleanup(); }
});

// Measured 2026-09-19: approveDesign strips the old design's heading embeds from EVERY structure
// note, so a supersede that drops a subsystem emptied that subsystem with the gate still green.
// The dictation path has guarded this since Task 5; the design path now does too.
test('a design superseding one that is also in another subsystem is refused unless it lists them all', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config,hub'));
    ok(intake(r.root, 'design', '--approve', V1));
    ok(intake(r.root, 'design', '--embed', V1, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    ok(intake(r.root, 'design', '--embed', V1, '--subsystem', 'hub', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    write(r.root, V2, BODY('Hub v2'));
    const before = read(r.root, V2);
    const res = intake(r.root, 'design', '--file', V2, '--subsystems', 'config', '--supersedes', '2026-09-02-hub-design');
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stderr, /--supersedes 2026-09-02-hub-design: that note is also in hub — list every one of its subsystems in --subsystems/);
    assert.equal(read(r.root, V2), before, 'nothing is written before the refusal');
    assert.match(read(r.root, 'docs/dictated-specs/structure/hub.md'), /!\[\[2026-09-02-hub-design#Decisions \(Gabe, 2026-09-02\)\]\]/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

// Leg 3's two design branches (slipbox-check.mjs), each by its exact refusal line.
test('the gate refuses an approved design never embedded, and a heading embed of a superseded design', () => {
  const r = project();
  try {
    // A structure note has to exist first, or leg 3 reports the missing note instead.
    write(r.root, 'docs/superpowers/models/m.html', '<p>x</p>\n');
    ok(intake(r.root, 'ref', '--subsystem', 'config', '--path', 'docs/superpowers/models/m.html'));
    write(r.root, V1, BODY('Hub'));
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config'));
    ok(intake(r.root, 'design', '--approve', V1));
    const a = gate(r.root);
    assert.equal(a.code, 1, a.stdout);
    assert.match(a.stdout, /docs\/dictated-specs\/structure\/config\.md embeds no heading of the approved design note 2026-09-02-hub-design — run intake\.mjs design --embed/, a.stdout);

    ok(intake(r.root, 'design', '--embed', V1, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    write(r.root, V2, BODY('Hub v2'));
    ok(intake(r.root, 'design', '--file', V2, '--subsystems', 'config', '--supersedes', '2026-09-02-hub-design'));
    ok(intake(r.root, 'design', '--approve', V2));
    ok(intake(r.root, 'design', '--embed', V2, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    // Put the superseded design's heading embed back by hand: what an edit by hand looks like.
    write(r.root, ST, read(r.root, ST).replace('![[2026-09-15-hub-v2-design#', '![[2026-09-02-hub-design#Decisions (Gabe, 2026-09-02)]]\n![[2026-09-15-hub-v2-design#'));
    const b = gate(r.root);
    assert.equal(b.code, 1, b.stdout);
    assert.match(b.stdout, /docs\/dictated-specs\/structure\/config\.md embeds 2026-09-02-hub-design#Decisions \(Gabe, 2026-09-02\), which is superseded or consumed — only an approved, in-force design note is embedded by heading/, b.stdout);
  } finally { r.cleanup(); }
});

test('RED CHECK: approving a non-draft, embedding a missing heading, and filing a file twice are refused', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    assert.match(intake(r.root, 'design', '--approve', V1).stderr, /is not a draft design note/);
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config'));
    assert.match(intake(r.root, 'design', '--file', V1).stderr, /is already filed as design/);
    ok(intake(r.root, 'design', '--approve', V1));
    assert.match(intake(r.root, 'design', '--embed', V1, '--subsystem', 'config', '--topic', 'T', '--heading', 'Nope').stderr, /has no heading 'Nope'/);
    write(r.root, 'docs/superpowers/plans/x.md', '# P\n');
    assert.match(intake(r.root, 'plan', '--file', 'docs/superpowers/plans/x.md', '--status', 'done').stderr, /is not an in-progress plan/);
  } finally { r.cleanup(); }
});

// Merge review (deferred, must-fix). fileRef only checked that the target existed, so a path
// outside the repository committed a `../../../..` href that resolves on this machine alone —
// gate leg 4 then refuses for everyone else who clones.
test('RED CHECK: ref refuses a path outside the repository, before writing the structure note', () => {
  const r = project();
  try {
    const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'outside-')), 'map.html');
    fs.writeFileSync(outside, '<p>x</p>\n');
    const res = intake(r.root, 'ref', '--subsystem', 'config', '--path', outside);
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stderr, /outside this repository/, res.stderr);
    assert.ok(!fs.existsSync(path.join(r.root, ST)), 'nothing was written');
  } finally { r.cleanup(); }
});
