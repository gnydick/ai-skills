// plugins/machinery/test/slipbox-intake.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { appendEntry, pending, parseInbox, setDisposition } from '../scripts/lib/inbox.mjs';
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

// Merge review 2, F3. A subsystem name becomes a FILE NAME. `--subsystems tooling/deep` wrote
// docs/dictated-specs/structure/tooling/deep.md, which the non-recursive read model never finds,
// while subsystemsOf still reported 'tooling/deep' — leg 3 then refused every commit in the
// project with advice that cannot work, and the note is immutable. Every entry point that takes a
// subsystem refuses such a name BEFORE it writes.
test('RED CHECK: a subsystem name that is not one path segment is refused by every entry point, before anything is written', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: nested', '2026-09-19T06:00:00Z');
    const head = g(r.root, 'rev-parse', 'HEAD');
    const spec = intake(r.root, 'spec', '--stamp', '2026-09-19T06:00:00Z', '--subsystems', 'tooling/deep', '--topic', 'T', '--title', 'Nested');
    assert.equal(spec.code, 1, spec.stdout);
    assert.match(spec.stderr, /tooling\/deep/);
    assert.match(spec.stderr, /one path segment/);
    assert.equal(g(r.root, 'rev-parse', 'HEAD'), head);
    assert.equal(g(r.root, 'status', '--porcelain'), '', 'nothing was written');
    assert.equal(pending(slipboxPaths(r.root).specInbox).length, 1);

    const ref = intake(r.root, 'ref', '--subsystem', 'tooling\\deep', '--path', 'README.md');
    assert.equal(ref.code, 1, ref.stdout);
    assert.match(ref.stderr, /one path segment/);

    write(r.root, 'docs/dictated-specs/decisions/0001-x.md', '---\nkind: decision\nsubsystems: [../escape]\n---\n# ADR\n\n- **Status:** Accepted\n');
    const dec = intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0001-x.md');
    assert.equal(dec.code, 1, dec.stdout);
    assert.match(dec.stderr, /one path segment/);
    const design = 'docs/superpowers/specs/2026-09-02-hub-design.md';
    write(r.root, design, '# Hub\n\n## Decisions\n\n- one hub\n');
    const filed = intake(r.root, 'design', '--file', design, '--subsystems', 'tooling/deep');
    assert.equal(filed.code, 1, filed.stdout);
    assert.match(filed.stderr, /one path segment/);
    assert.equal(read(r.root, design), '# Hub\n\n## Decisions\n\n- one hub\n', 'no front matter was written');

    assert.equal(intake(r.root, 'design', '--file', design, '--subsystems', 'tooling').code, 0);
    assert.equal(intake(r.root, 'design', '--approve', design).code, 0);
    const emb = intake(r.root, 'design', '--embed', design, '--subsystem', 'tooling/deep', '--topic', 'T', '--heading', 'Decisions');
    assert.equal(emb.code, 1, emb.stdout);
    assert.match(emb.stderr, /one path segment/);

    assert.equal(fs.existsSync(path.join(r.root, 'docs/dictated-specs/structure')), false, 'no structure note was written by any of the five');
  } finally { r.cleanup(); }
});

// Merge review 2, F2. `spec` runs `git add` before `git commit`, so a gate refusal leaves the whole
// filing in the INDEX as well as in the tree. `git checkout -- <dirs>` restores FROM the index, so
// the documented recovery was a no-op: after both its steps the tree was byte-for-byte what it had
// been and the re-run met "a note is written once" for ever. This runs the command the skill
// actually prints and demands it take the tree and the index back to HEAD.
const SKILL_COPIES = [
  path.join(PLUGIN, 'skills', 'rule-process', 'SKILL.md'),
  path.join(PLUGIN, '..', '..', 'claude-code', 'machinery', 'rule-process', 'SKILL.md'),
];
function documentedRestore() {
  const found = SKILL_COPIES.map((f) => {
    const t = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(t, /git checkout -- docs\/dictated-specs/, `${f}: checkout restores FROM the index, which still holds the refused filing`);
    const m = /`(git restore [^`]+)`/.exec(t);
    assert.ok(m, `${f}: names no git restore that undoes a filing the gate refused`);
    return m[1];
  });
  assert.equal(found[0], found[1], 'both copies of the skill must print the same recovery command');
  return found[0].split(' ').slice(1);
}

test('RED CHECK: the recovery the skill documents really undoes a filing the gate refused, and the re-run is accepted', () => {
  const r = project();
  try {
    assert.equal(runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root }).code, 0);
    assert.equal(runScript('scripts/setup.mjs', { args: ['set', 'components', 'docs=docs'], cwd: r.root }).code, 0);
    assert.equal(runScript('scripts/setup.mjs', { args: ['set', 'tiers.fast', 'node --version <components>'], cwd: r.root }).code, 0);
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install machinery');
    const stamp = '2026-09-19T07:00:00Z';
    // Captured but not committed: an installed gate refuses a commit that carries a PENDING entry.
    appendEntry(slipboxPaths(r.root).specInbox, { marker: 'SPEC', text: 'SPEC: refused once', session: 's', stamp });
    const head = g(r.root, 'rev-parse', 'HEAD');
    // An approved design in the same subsystem, never embedded: leg 3 refuses the filing's commit.
    const poison = 'docs/superpowers/specs/2026-09-02-hub-design.md';
    write(r.root, poison, '---\nkind: design\nstatus: approved\nsubsystems: [extruders]\n---\n# Hub\n\n## Decisions\n\n- one hub\n');

    const refused = fileOne(r.root, stamp);
    assert.equal(refused.code, 1, refused.stdout);
    assert.match(refused.stderr + refused.stdout, /embeds no heading of the approved design note/);
    assert.equal(g(r.root, 'rev-parse', 'HEAD'), head, 'nothing was committed');
    assert.notEqual(g(r.root, 'diff', '--cached', '--name-only'), '', 'the refusal leaves the filing STAGED, not merely on disk');

    g(r.root, ...documentedRestore());
    // The skill's second step: delete whatever is left untracked under those two directories.
    const left = g(r.root, 'status', '--porcelain', '--', 'docs/dictated-specs', 'docs/spec-current');
    for (const l of left.split('\n').filter(Boolean)) fs.rmSync(path.join(r.root, l.slice(3).trim()), { recursive: true, force: true });
    assert.equal(g(r.root, 'status', '--porcelain', '--', 'docs/dictated-specs', 'docs/spec-current'), '', 'the tree and the index are back at HEAD');

    // The one line of the inbox entry the skill allows you to edit, and the fix the gate named.
    setDisposition(slipboxPaths(r.root).specInbox, stamp, { state: 'PENDING', detail: 'PENDING' });
    fs.rmSync(path.join(r.root, poison));
    const again = fileOne(r.root, stamp);
    assert.equal(again.code, 0, again.stderr + again.stdout);
    assert.equal(g(r.root, 'rev-list', '--count', `${head}..HEAD`), '1');
  } finally { r.cleanup(); }
});
