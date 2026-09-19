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
