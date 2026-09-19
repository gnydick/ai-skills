// plugins/machinery/test/slipbox-intake.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { appendEntry, pending, parseInbox } from '../scripts/lib/inbox.mjs';
import { slipboxPaths } from '../scripts/lib/layout.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const intake = (root, ...args) => runScript('scripts/intake.mjs', { args: [...args, '--root', root], cwd: root, env: env() });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const DICTATION = 'SPEC: objects on plates don\'t have to have their own extruder. by default the first\nextruder is the default.\n\n  - plates can get their own — "assigned" extruder at C:\\x';

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  fs.mkdirSync(path.join(r.root, 'docs', 'dictated-specs'), { recursive: true });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  return r;
}
function capture(root, text, stamp) {
  appendEntry(slipboxPaths(root).specInbox, { marker: 'SPEC', text, session: 's', stamp });
  g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', 'capture');
}
const fileOne = (root, stamp, ...extra) => intake(root, 'spec', '--stamp', stamp, '--subsystems', 'extruders', '--topic', 'Defaults', '--title', 'Objects need not have their own extruder', ...extra);

test('filing one SPEC creates exactly one note, quoting the inbox entry byte for byte, and commits the full dictation', () => {
  const r = project();
  try {
    capture(r.root, DICTATION, '2026-09-19T01:03:49Z');
    const res = fileOne(r.root, '2026-09-19T01:03:49Z');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    const changed = g(r.root, 'show', '--name-status', '--format=', 'HEAD').split('\n').sort();
    assert.deepEqual(changed, [
      'A\tdocs/dictated-specs/INDEX.md',
      'A\tdocs/dictated-specs/notes/2026-09-19T01-03-49Z.md',
      'A\tdocs/dictated-specs/structure/extruders.md',
      'A\tdocs/spec-current/extruders.md',
      'M\t.claude/machinery/spec-inbox.md',
    ].sort());
    const note = read(r.root, 'docs/dictated-specs/notes/2026-09-19T01-03-49Z.md');
    assert.ok(note.includes(DICTATION.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')), note);
    assert.match(read(r.root, 'docs/dictated-specs/structure/extruders.md'), /## Defaults\n\n!\[\[2026-09-19T01-03-49Z\]\]/);
    const msg = g(r.root, 'log', '-1', '--format=%B');
    assert.match(msg, /^spec: Objects need not have their own extruder\n/);
    assert.ok(msg.includes(DICTATION), 'the commit message carries the full dictation');
    const [e] = parseInbox(read(r.root, '.claude/machinery/spec-inbox.md'));
    assert.equal(e.disposition, 'filed → docs/dictated-specs/notes/2026-09-19T01-03-49Z.md');
    assert.match(res.stdout, /subsystems: extruders \(new\)/);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
  } finally { r.cleanup(); }
});

test('a full supersede leaves the old note byte-identical and swaps exactly one structure line', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: old rule', '2026-09-01T08:00:00Z');
    assert.equal(fileOne(r.root, '2026-09-01T08:00:00Z').code, 0);
    const oldNote = read(r.root, 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md');
    capture(r.root, 'SPEC: new rule', '2026-09-10T08:00:00Z');
    const res = fileOne(r.root, '2026-09-10T08:00:00Z', '--supersedes', '2026-09-01T08-00-00Z');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(read(r.root, 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md'), oldNote);
    const diff = g(r.root, 'diff', 'HEAD~1', 'HEAD', '--unified=0', '--', 'docs/dictated-specs/structure/extruders.md').split('\n').filter((l) => /^[-+][^-+]/.test(l));
    assert.deepEqual(diff, ['-![[2026-09-01T08-00-00Z]]', '+![[2026-09-10T08-00-00Z]]']);
    assert.match(read(r.root, 'docs/dictated-specs/notes/2026-09-10T08-00-00Z.md'), /supersedes: \[2026-09-01T08-00-00Z\][\s\S]*Supersedes \[\[2026-09-01T08-00-00Z\]\]\./);
    const page = read(r.root, 'docs/spec-current/extruders.md');
    assert.match(page, /SPEC: new rule/);
    assert.doesNotMatch(page, /SPEC: old rule/);
  } finally { r.cleanup(); }
});

test('a partial change writes the dictation and a version note; the version supersedes, the dictation is not embedded', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: each object has its own extruder. members never override.', '2026-09-01T08:00:00Z');
    assert.equal(fileOne(r.root, '2026-09-01T08:00:00Z').code, 0);
    capture(r.root, 'SPEC: members can override', '2026-09-19T01:03:49Z');
    const v = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v-')), 'v.md');
    fs.writeFileSync(v, 'Each object has its own extruder. Members can override.\n');
    const res = fileOne(r.root, '2026-09-19T01:03:49Z', '--supersedes', '2026-09-01T08-00-00Z', '--version', v);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    const version = read(r.root, 'docs/dictated-specs/notes/2026-09-19T01-03-49Z-v.md');
    assert.match(version, /kind: version\nsubsystems: \[extruders\]\nsupersedes: \[2026-09-01T08-00-00Z\]\nfrom: \[2026-09-19T01-03-49Z\]/);
    assert.match(version, /Composed by the assistant from \[\[2026-09-01T08-00-00Z\]\] and \[\[2026-09-19T01-03-49Z\]\]/);
    const st = read(r.root, 'docs/dictated-specs/structure/extruders.md');
    assert.match(st, /!\[\[2026-09-19T01-03-49Z-v\]\]/);
    assert.doesNotMatch(st, /!\[\[2026-09-19T01-03-49Z\]\]/);
    assert.doesNotMatch(st, /!\[\[2026-09-01T08-00-00Z\]\]/);
    assert.match(res.stdout, /Members can override\./, 'the report prints the version text');
  } finally { r.cleanup(); }
});

test('subsystems a,b embeds the note in both structure notes', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: shared', '2026-09-19T02:00:00Z');
    const res = intake(r.root, 'spec', '--stamp', '2026-09-19T02:00:00Z', '--subsystems', 'a,b', '--topic', 'T', '--title', 'Shared');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    for (const s of ['a', 'b']) assert.match(read(r.root, `docs/dictated-specs/structure/${s}.md`), /!\[\[2026-09-19T02-00-00Z\]\]/);
    assert.match(read(r.root, 'docs/dictated-specs/notes/2026-09-19T02-00-00Z.md'), /subsystems: \[a, b\]/);
  } finally { r.cleanup(); }
});

test('RED CHECK: an existing note is never overwritten, and an unmigrated project refuses filing', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: x', '2026-09-19T03:00:00Z');
    write(r.root, 'docs/dictated-specs/notes/2026-09-19T03-00-00Z.md', 'already here\n');
    const clash = fileOne(r.root, '2026-09-19T03:00:00Z');
    assert.equal(clash.code, 1);
    assert.match(clash.stderr, /refusing to overwrite docs\/dictated-specs\/notes\/2026-09-19T03-00-00Z\.md/);
    assert.equal(read(r.root, 'docs/dictated-specs/notes/2026-09-19T03-00-00Z.md'), 'already here\n');
    assert.equal(pending(slipboxPaths(r.root).specInbox).length, 1);

    fs.rmSync(path.join(r.root, 'docs/dictated-specs/notes'), { recursive: true });
    write(r.root, 'docs/adr/0001-x.md', '# ADR\n');
    const old = fileOne(r.root, '2026-09-19T03:00:00Z');
    assert.equal(old.code, 1);
    assert.match(old.stderr, /not migrated to the slip box — docs\/adr\/ \(1 file\(s\)\)/);
  } finally { r.cleanup(); }
});

test('RED CHECK: a supersede that leaves out a subsystem of the old note is refused before anything is written', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: old shared rule', '2026-09-01T08:00:00Z');
    assert.equal(intake(r.root, 'spec', '--stamp', '2026-09-01T08:00:00Z', '--subsystems', 'a,b', '--topic', 'T', '--title', 'Old').code, 0);
    capture(r.root, 'SPEC: new rule for a only', '2026-09-10T08:00:00Z');
    const head = g(r.root, 'rev-parse', 'HEAD');
    const res = intake(r.root, 'spec', '--stamp', '2026-09-10T08:00:00Z', '--subsystems', 'a', '--topic', 'T', '--title', 'New', '--supersedes', '2026-09-01T08-00-00Z');
    assert.equal(res.code, 1, res.stderr + res.stdout);
    assert.match(res.stderr, /\bb\b/);
    assert.match(res.stderr, /--subsystems/);
    assert.equal(g(r.root, 'rev-parse', 'HEAD'), head);
    assert.equal(g(r.root, 'status', '--porcelain'), '', 'nothing was written');
    assert.equal(pending(slipboxPaths(r.root).specInbox).length, 1);
  } finally { r.cleanup(); }
});

test('the commit message carries the dictation byte for byte: blank-line runs, trailing spaces and # lines survive', () => {
  const r = project();
  try {
    const text = 'SPEC: first line\n\n\nafter two blank lines\ntrailing space here \n# not a comment';
    capture(r.root, text, '2026-09-19T05:00:00Z');
    const res = fileOne(r.root, '2026-09-19T05:00:00Z');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    const msg = execFileSync('git', ['log', '-1', '--format=%B'], { cwd: r.root, encoding: 'utf8' });
    assert.ok(msg.includes(`\n\n${text}\n\n`), msg);
  } finally { r.cleanup(); }
});

test('regen rewrites a stale page and the gate-facing files match afterwards', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: y', '2026-09-19T04:00:00Z');
    assert.equal(fileOne(r.root, '2026-09-19T04:00:00Z').code, 0);
    write(r.root, 'docs/spec-current/extruders.md', 'hand edit\n');
    const res = intake(r.root, 'regen');
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /regenerated docs\/spec-current\/extruders\.md/);
    assert.match(read(r.root, 'docs/spec-current/extruders.md'), /SPEC: y/);
  } finally { r.cleanup(); }
});
