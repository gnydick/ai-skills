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

test('RED CHECK: two notes superseding one note is a fork, refused', () => {
  const r = superseded();
  try {
    write(r.root, 'docs/dictated-specs/notes/2026-09-11T08-00-00Z.md', `---\nid: 2026-09-11T08-00-00Z\nkind: dictation\nsubsystems: [extruders]\nsupersedes: [${OLD}]\n---\n# F\n\n> SPEC: fork\n`);
    refused(gate(r.root), new RegExp(`commit refused: ${OLD} is superseded by 2 notes`));
  } finally { r.cleanup(); }
});
