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
  write(r.root, 'docs/dictated-specs/collision.md', '# Collision\n\n### A — REVERSED 2026-09-09\n\neach object has its own extruder (reworded)\n\nASSISTANT, offered so it can be struck: maybe per group\n\n### B\n\nobjects need not\n\n### C. never filed\n\ntext\n');
  write(r.root, 'docs/adr/0001-x.md', ADR);
  write(r.root, 'docs/adr/README.md', '# ADRs\n');
  write(r.root, 'docs/superpowers/specs/2026-06-21-hub-design.md', '# Hub\n\n## Decisions\n\n- one hub\n\n## Files touched\n\n- hub.rs\n');
  write(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md', '# Map\n');
  write(r.root, 'docs/superpowers/plans/2026-06-21-hub.md', '# Plan\n\n- [x] one\n');
  write(r.root, 'scripts/adr_gate.py', 'ADR_DIR = "docs/adr"\n');
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
  for (const r of p.references) Object.assign(r, { replace: [['docs/adr', 'docs/dictated-specs/decisions']], reviewed: true });
  return p;
}

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
    assert.deepEqual(p.references.map((x) => [x.path, x.mentions]), [['scripts/adr_gate.py', ['docs/adr']]]);
    assert.match(res.stdout, /2 note\(s\), 2 unsettled heading\(s\), 2 ADR file\(s\), 3 superpowers file\(s\), 1 reference file\(s\)/);
  } finally { r.cleanup(); }
});

test('--apply migrates in two commits: notes from the inbox, ADRs moved intact, references fixed, old files removed; the gate passes', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    fs.writeFileSync(out, JSON.stringify(fill(JSON.parse(fs.readFileSync(out, 'utf8')))));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
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
