// plugins/machinery/test/slipbox-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { appendEntry } from '../scripts/lib/inbox.mjs';
import { slipboxPaths } from '../scripts/lib/layout.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const ST = 'docs/dictated-specs/structure/extruders.md';
const OLD = '2026-09-01T08-00-00Z', NEW = '2026-09-10T08-00-00Z';

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  return r;
}
function file(root, stamp, text, ...extra) {
  appendEntry(slipboxPaths(root).specInbox, { marker: 'SPEC', text, session: 's', stamp });
  g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', 'capture');
  const res = runScript('scripts/intake.mjs', { args: ['spec', '--root', root, '--stamp', stamp, '--subsystems', 'extruders', '--topic', 'Defaults', '--title', 'T', ...extra], cwd: root, env: env() });
  assert.equal(res.code, 0, res.stderr + res.stdout);
}
// A project with OLD superseded by NEW, all filed through intake.
function superseded() {
  const r = project();
  file(r.root, '2026-09-01T08:00:00Z', 'SPEC: old rule');
  file(r.root, '2026-09-10T08:00:00Z', 'SPEC: new rule', '--supersedes', OLD);
  return r;
}
const refused = (res, re) => { assert.equal(res.code, 1, res.stdout); assert.match(res.stdout, re, res.stdout); };

test('a slip box filed only through intake passes every leg, each printing its denominator', () => {
  const r = superseded();
  try {
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    for (const re of [/^slipbox_check: 0 of 2 dictation note\(s\) not verbatim/m, /^slipbox_check: 0 of 1 subsystem\(s\) with wrong membership/m,
      /^slipbox_check: 0 of \d+ file\(s\) with broken links/m, /^slipbox_check: 0 of 2 generated page\(s\) stale/m, /^slipbox_check: 0 of 1 superseded note\(s\) with a fork/m]) assert.match(res.stdout, re);
  } finally { r.cleanup(); }
});

test('a dictation note that no longer quotes its inbox entry is refused', () => {
  const r = superseded();
  try {
    const f = `docs/dictated-specs/notes/${NEW}.md`;
    write(r.root, f, read(r.root, f).replace('new rule', 'new rule, reworded'));
    refused(gate(r.root), /commit refused: docs\/dictated-specs\/notes\/2026-09-10T08-00-00Z\.md does not quote its inbox entry/);
  } finally { r.cleanup(); }
});

test('a superseded note still embedded is refused, and so is an in-force note left out', () => {
  const r = superseded();
  try {
    write(r.root, ST, read(r.root, ST).replace(`![[${NEW}]]`, `![[${OLD}]]`));
    const res = gate(r.root);
    refused(res, new RegExp(`commit refused: ${ST.replaceAll('/', '\\/')} embeds ${OLD}, which is superseded or consumed`));
    assert.match(res.stdout, new RegExp(`is missing the in-force note ${NEW}`));
  } finally { r.cleanup(); }
});

test('a dictation consumed by a version note, embedded, is refused', () => {
  const r = project();
  try {
    file(r.root, '2026-09-01T08:00:00Z', 'SPEC: old rule');
    const v = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v-')), 'v.md');
    fs.writeFileSync(v, 'old rule, changed\n');
    file(r.root, '2026-09-19T01:03:49Z', 'SPEC: change it', '--supersedes', OLD, '--version', v);
    assert.equal(gate(r.root).code, 0);
    write(r.root, ST, read(r.root, ST) + '![[2026-09-19T01-03-49Z]]\n');
    refused(gate(r.root), /embeds 2026-09-19T01-03-49Z, which is superseded or consumed/);
  } finally { r.cleanup(); }
});

test('a broken link and a missing heading are refused', () => {
  const r = superseded();
  try {
    write(r.root, ST, read(r.root, ST).replace('## Defaults', '## Defaults\n\nsee [[nope]] and [[2026-09-10T08-00-00Z#Nope]]'));
    const res = gate(r.root);
    refused(res, /links \[\[nope\]\], which does not exist/);
    assert.match(res.stdout, /has no heading 'Nope'/);
  } finally { r.cleanup(); }
});

test('a stale INDEX.md and a stale flat page are refused, naming intake.mjs regen', () => {
  const r = superseded();
  try {
    write(r.root, 'docs/dictated-specs/INDEX.md', 'edited\n');
    write(r.root, 'docs/spec-current/extruders.md', 'edited\n');
    write(r.root, 'docs/spec-current/orphan.md', 'x\n');
    const res = gate(r.root);
    refused(res, /commit refused: docs\/dictated-specs\/INDEX\.md is stale — run intake\.mjs regen/);
    assert.match(res.stdout, /docs\/spec-current\/extruders\.md is stale/);
    assert.match(res.stdout, /docs\/spec-current\/orphan\.md has no structure note behind it/);
  } finally { r.cleanup(); }
});

// A clone with core.autocrlf=true (the Git for Windows default) has CRLF in every file. The read
// model normalises on read, so the gate can never refuse a commit over line-ending bytes alone.
test('a CRLF checkout passes legs 2, 3 and 5', () => {
  const r = superseded();
  try {
    const crlf = (rel) => write(r.root, rel, read(r.root, rel).replace(/\r?\n/g, '\r\n'));
    crlf(`docs/dictated-specs/notes/${OLD}.md`);
    crlf(`docs/dictated-specs/notes/${NEW}.md`);
    crlf(ST);
    // The generated pages too: leg 5 compares them against a rendering that is always LF.
    crlf('docs/dictated-specs/INDEX.md');
    crlf('docs/spec-current/extruders.md');
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    for (const re of [/^slipbox_check: 0 of 2 dictation note\(s\) not verbatim/m, /^slipbox_check: 0 of 1 subsystem\(s\) with wrong membership/m,
      /^slipbox_check: 0 of 2 generated page\(s\) stale/m]) assert.match(res.stdout, re);
  } finally { r.cleanup(); }
});

test('front matter the reader cannot parse is refused in the slip box and tolerated in a superpowers file', () => {
  const r = superseded();
  try {
    const broken = '---\nid: 0010-x\n- not a key\n---\n# D\n\n- **Status:** Accepted\n';
    write(r.root, 'docs/superpowers/specs/someone-elses.md', broken);
    assert.equal(gate(r.root).code, 0, 'an unmigrated project stays committable (D13)');
    write(r.root, 'docs/dictated-specs/decisions/0010-x.md', broken);
    const res = gate(r.root);
    refused(res, /commit refused: docs\/dictated-specs\/decisions\/0010-x\.md has front matter this reader cannot read/);
    assert.match(res.stdout, /^slipbox_check: 1 of \d+ slip box file\(s\) whose front matter cannot be read/m);
    assert.doesNotMatch(res.stdout, /someone-elses/);
  } finally { r.cleanup(); }
});

// Owner ruling (Gabe, 2026-09-19): "Carry them as owner notes". A ruling the owner typed into an
// old spec file by hand was never captured, so it has NO inbox entry and leg 2 can never prove it
// verbatim. It is carried all the same: the leg skips it, and it is in force and embedded exactly
// like a dictation. A note of a kind nobody defined is still refused.
test('RED CHECK: an owner note passes the verbatim leg, is embedded like a dictation, and an unknown kind is still refused', () => {
  const r = superseded();
  try {
    const owner = 'docs/dictated-specs/notes/owner-8-a.md';
    write(r.root, owner, ['---', 'id: owner-8-a', 'kind: owner', 'subsystems: [extruders]',
      'source: docs/dictated-specs/by-object.md § 8.A — the ruling (Gabe, 2026-09-07)', '---',
      '# nozzle_height leaves ClearanceParams', '',
      '*Transcribed from docs/dictated-specs/by-object.md § 8.A — the ruling (Gabe, 2026-09-07), not captured through the SPEC: marker, so the verbatim check cannot prove it.*', '',
      'nozzle_height comes out of ClearanceParams entirely.', ''].join('\n'));
    write(r.root, ST, read(r.root, ST).replace(`![[${NEW}]]`, `![[${NEW}]]\n![[owner-8-a]]`));
    assert.equal(runScript('scripts/intake.mjs', { args: ['regen', '--root', r.root], cwd: r.root, env: env() }).code, 0);
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    // The denominator is the notes this leg can judge: the owner note is not one of them.
    assert.match(res.stdout, /^slipbox_check: 0 of 2 dictation note\(s\) not verbatim/m, res.stdout);
    assert.match(res.stdout, /^slipbox_check: 0 of 1 subsystem\(s\) with wrong membership/m, res.stdout);
    assert.match(read(r.root, 'docs/spec-current/extruders.md'), /nozzle_height comes out of ClearanceParams entirely\./);

    write(r.root, 'docs/dictated-specs/notes/sketch.md', '---\nid: sketch\nkind: sketch\nsubsystems: [extruders]\n---\n# S\n');
    refused(gate(r.root), /notes\/sketch\.md is under notes\/ but is neither a dictation, a version nor an owner note/);
  } finally { r.cleanup(); }
});

test('RED CHECK: two notes superseding one note is a fork, refused', () => {
  const r = superseded();
  try {
    write(r.root, 'docs/dictated-specs/notes/2026-09-11T08-00-00Z.md', `---\nid: 2026-09-11T08-00-00Z\nkind: dictation\nsubsystems: [extruders]\nsupersedes: [${OLD}]\n---\n# F\n\n> SPEC: fork\n`);
    refused(gate(r.root), new RegExp(`commit refused: ${OLD} is superseded by 2 notes`));
  } finally { r.cleanup(); }
});

// Merge review B1. An id clash threw out of loadSlipbox before leg 1 ran, and gate.mjs turned the
// throw into `gate check slipbox_check could not run`. That refused EVERY commit in the project —
// including the rename that cures it — and named no fix. It is a leg refusal now, with its own
// denominator; it bites unmigrated projects too, so the message says what to rename.
test('RED CHECK: two files sharing an id refuse as a leg naming the rename, not as a check that could not run', () => {
  const r = project();
  try {
    write(r.root, 'docs/superpowers/specs/dup.md', '---\nkind: design\nstatus: draft\n---\n\n# Dup\n');
    write(r.root, 'docs/superpowers/plans/dup.md', '---\nkind: plan\nstatus: in-progress\nticket: "1"\n---\n\n# Dup\n');
    const res = gate(r.root);
    assert.equal(res.code, 1, res.stdout);
    assert.match(res.stdout, /^slipbox_check: 1 of 1 slip box file\(s\) with a clashing id \(must be 0\)$/m, res.stdout);
    assert.match(res.stdout, /commit refused: the slip box cannot be read — two notes share the id dup: docs\/superpowers\/specs\/dup\.md and docs\/superpowers\/plans\/dup\.md; rename one of them/, res.stdout);
    assert.doesNotMatch(res.stdout, /could not run/, res.stdout);
  } finally { r.cleanup(); }
});

// Merge review 2, F6. Leg 5 used to build `want` inside a try and carry on with it EMPTY when
// regeneration threw: every existing generated page was then reported as "has no structure note
// behind it", and the denominator read 0 — one un-generatable page buried under a cascade with no
// count behind it. The failure is now reported as itself, and the orphan sweep does not run.
test('RED CHECK: one page that cannot be generated is reported alone, with a denominator, and no orphan cascade', () => {
  const r = project();
  try {
    file(r.root, '2026-09-01T08:00:00Z', 'SPEC: extruder rule');
    appendEntry(slipboxPaths(r.root).specInbox, { marker: 'SPEC', text: 'SPEC: plate rule', session: 's', stamp: '2026-09-02T08:00:00Z' });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'capture');
    const second = runScript('scripts/intake.mjs', { args: ['spec', '--root', r.root, '--stamp', '2026-09-02T08:00:00Z', '--subsystems', 'plates', '--topic', 'Defaults', '--title', 'P'], cwd: r.root, env: env() });
    assert.equal(second.code, 0, second.stderr + second.stdout);
    // A note that embeds itself: every link RESOLVES, so leg 4 is content, but flatten cycles — a
    // page that cannot be generated at all, which is what leg 5 used to cascade on.
    const note = 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md';
    write(r.root, note, `${read(r.root, note)}\n![[2026-09-01T08-00-00Z]]\n`);

    const out = gate(r.root).stdout;
    assert.match(out, /slipbox_check: 1 of 3 generated page\(s\) stale/, out);
    assert.match(out, /docs\/spec-current\/extruders\.md cannot be generated — embed cycle/, out);
    assert.doesNotMatch(out, /has no structure note behind it/, out);
    assert.equal(gate(r.root).code, 1);
  } finally { r.cleanup(); }
});

// #136 § "What the gate checks": a marker naming a note that does not exist refuses the commit,
// naming the file. An extension of the link leg — the same failure mode, a citation that resolves
// to nothing — so it adds no new kind of refusal.
test('a marker naming a note that does not exist refuses the commit and names the file', () => {
  const r = superseded();
  try {
    write(r.root, 'src/lib.rs', `// spec:${NEW}\nfn ok() {}\n`);
    write(r.root, 'src/bad.rs', '// spec:0099-does-not-exist\nfn bad() {}\n');
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    refused(res, /src\/bad\.rs/);
    assert.match(res.stdout, /0099-does-not-exist/, 'the unknown note id is named');
  } finally { r.cleanup(); }
});

test('a marker naming a note that exists passes the leg, which prints its denominator', () => {
  const r = superseded();
  try {
    write(r.root, 'src/lib.rs', `// spec:${NEW}\n`);
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^slipbox_check: 0 of 1 marker\(s\) naming a note that does not exist/m);
  } finally { r.cleanup(); }
});
