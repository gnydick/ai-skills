// plugins/machinery/test/slipbox-gate-diff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { appendEntry } from '../scripts/lib/inbox.mjs';
import { slipboxPaths } from '../scripts/lib/layout.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const NOTE = 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md';
const ADR = 'docs/dictated-specs/decisions/0001-x.md';
const DESIGN = 'docs/superpowers/specs/2026-09-02-x-design.md';
const PLAN = 'docs/superpowers/plans/2026-09-02-x.md';

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  appendEntry(slipboxPaths(r.root).specInbox, { marker: 'SPEC', text: 'SPEC: a rule', session: 's', stamp: '2026-09-01T08:00:00Z' });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'capture');
  const res = runScript('scripts/intake.mjs', { args: ['spec', '--root', r.root, '--stamp', '2026-09-01T08:00:00Z', '--subsystems', 's', '--topic', 'T', '--title', 'A rule'], cwd: r.root, env: { MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) } });
  assert.equal(res.code, 0, res.stderr + res.stdout);
  write(r.root, ADR, '# ADR 1\n\n- **Status:** Accepted\n\nWe chose x.\n');
  write(r.root, DESIGN, '---\nkind: design\nstatus: approved\n---\n# X\n\n## Decisions\n\n- x\n');
  write(r.root, PLAN, '---\nkind: plan\nticket: 7\nstatus: done\n---\n# plan\n\n- [x] one\n');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'fixtures');
  return r;
}
const refused = (res, re) => { assert.equal(res.code, 1, res.stdout); assert.match(res.stdout, re, res.stdout); };

test('editing a note, deleting a note, and renaming a note are each refused', () => {
  for (const act of ['edit', 'delete', 'rename']) {
    const r = project();
    try {
      if (act === 'edit') { write(r.root, NOTE, read(r.root, NOTE) + '\nextra\n'); g(r.root, 'add', NOTE); }
      if (act === 'delete') g(r.root, 'rm', '-q', NOTE);
      if (act === 'rename') g(r.root, 'mv', NOTE, 'docs/dictated-specs/notes/moved.md');
      refused(gate(r.root), /commit refused: docs\/dictated-specs\/notes\/2026-09-01T08-00-00Z\.md was (modified|deleted|renamed) — a note is never edited/);
    } finally { r.cleanup(); }
  }
});

test('an ADR change confined to its status line passes; any other ADR change is refused', () => {
  const r = project();
  try {
    write(r.root, ADR, read(r.root, ADR).replace('Accepted', 'Superseded by ADR-0002')); g(r.root, 'add', ADR);
    const ok = gate(r.root);
    assert.doesNotMatch(ok.stdout, /0001-x\.md was/);
    write(r.root, ADR, read(r.root, ADR).replace('We chose x.', 'We chose y.')); g(r.root, 'add', ADR);
    refused(gate(r.root), /0001-x\.md was modified beyond its status line/);
  } finally { r.cleanup(); }
});

test('an approved design and a done plan are frozen; a draft design and a live plan are not', () => {
  const r = project();
  try {
    write(r.root, DESIGN, read(r.root, DESIGN) + '\n- more\n');
    write(r.root, PLAN, read(r.root, PLAN) + '- [ ] two\n');
    g(r.root, 'add', DESIGN, PLAN);
    const res = gate(r.root);
    refused(res, /2026-09-02-x-design\.md was modified, but it was approved — write a new design note that supersedes it/);
    assert.match(res.stdout, /2026-09-02-x\.md was modified, but it was done — a finished plan is history/);
    g(r.root, 'reset', '-q', '--hard');
    write(r.root, DESIGN, read(r.root, DESIGN).replace('approved', 'draft')); write(r.root, PLAN, read(r.root, PLAN).replace('done', 'in-progress'));
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'reopen (fixture only; the fixture repo has no hooks)');
    write(r.root, DESIGN, read(r.root, DESIGN) + '\n- more\n'); write(r.root, PLAN, read(r.root, PLAN) + '- [ ] two\n');
    g(r.root, 'add', DESIGN, PLAN);
    assert.match(gate(r.root).stdout, /^slipbox_check: 0 of 2 frozen file\(s\) changed/m);
  } finally { r.cleanup(); }
});

// Measured 2026-09-19: the gate's `root` is the MAIN checkout even when the commit is made in a
// linked worktree, so a diff run there compared the worktree's index against main's HEAD and
// reported every file the branch had ever added as added by this commit.
test('a commit made in a linked worktree judges that worktree, not the main checkout', () => {
  const r = project();
  try {
    const wt = addWorktree(r.root, 'feat');
    // Added earlier on the branch, and unfiled: only a diff against the wrong HEAD would see it now.
    write(wt, 'docs/superpowers/specs/2026-09-19-earlier.md', '# earlier\n');
    g(wt, 'add', '-A'); g(wt, 'commit', '-q', '-m', 'earlier');
    write(wt, 'unrelated.md', 'x\n');
    g(wt, 'add', 'unrelated.md');
    // What the pre-commit hook of a commit made in the worktree hands the gate: that worktree's
    // index, while --root names the main checkout.
    const env = { GIT_INDEX_FILE: path.join(g(wt, 'rev-parse', '--absolute-git-dir'), 'index') };
    const res = runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: wt, env });
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^slipbox_check: 0 of 0 added superpowers file\(s\) unfiled/m, res.stdout);
  } finally { r.cleanup(); }
});

test('RED CHECK: a new superpowers file without front matter is refused, naming the command that files it', () => {
  const r = project();
  try {
    write(r.root, 'docs/superpowers/specs/2026-09-19-new-design.md', '# New\n');
    write(r.root, 'docs/superpowers/plans/2026-09-19-new.md', '# New plan\n');
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    refused(res, /docs\/superpowers\/specs\/2026-09-19-new-design\.md has no front matter — run intake\.mjs design --file/);
    assert.match(res.stdout, /docs\/superpowers\/plans\/2026-09-19-new\.md has no front matter — run intake\.mjs plan --file/);
    assert.match(res.stdout, /^slipbox_check: 2 of 2 added superpowers file\(s\) unfiled/m);
  } finally { r.cleanup(); }
});
