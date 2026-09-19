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
const intake = (root, ...args) => runScript('scripts/intake.mjs', { args: [...args, '--root', root], cwd: root, env: env() });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const D = '2026-09-01T08-00-00Z';
const ST = 'docs/dictated-specs/structure/config.md';
const adr = (n, status, extra = '') => `---\nkind: decision\nsubsystems: [config]\nrests_on: [${D}]\n---\n# ADR ${n}\n\n- **Status:** ${status}\n${extra}`;

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  appendEntry(slipboxPaths(r.root).specInbox, { marker: 'SPEC', text: 'SPEC: overrides at every level', session: 's', stamp: '2026-09-01T08:00:00Z' });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'capture');
  assert.equal(intake(r.root, 'spec', '--stamp', '2026-09-01T08:00:00Z', '--subsystems', 'config', '--topic', 'Levels', '--title', 'Overrides').code, 0);
  return r;
}

test('decision links a new ADR under "Why it is this way" and the gate passes', () => {
  const r = project();
  try {
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Accepted'));
    const res = intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-overrides.md');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.match(read(r.root, ST), /## Why it is this way\n\n- \[\[0010-overrides\]\]/);
    assert.match(read(r.root, 'docs/spec-current/config.md'), /\[ADR 10\]\(\.\.\/dictated-specs\/decisions\/0010-overrides\.md\)/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('filing a superseding ADR drops the superseded one from every "Why" section', () => {
  const r = project();
  try {
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Accepted'));
    assert.equal(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-overrides.md').code, 0);
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Superseded by ADR-0011'));
    write(r.root, 'docs/dictated-specs/decisions/0011-every-level.md', adr(11, 'Accepted'));
    assert.equal(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0011-every-level.md').code, 0);
    const st = read(r.root, ST);
    assert.match(st, /- \[\[0011-every-level\]\]/);
    assert.doesNotMatch(st, /0010-overrides/);
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('a superseded ADR still linked under "Why" is refused by the gate', () => {
  const r = project();
  try {
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Accepted'));
    assert.equal(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-overrides.md').code, 0);
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Superseded by ADR-0011'));
    const res = gate(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /links 0010-overrides under "Why it is this way", but that decision is superseded/);
  } finally { r.cleanup(); }
});

test('ref links a living map under References; the gate refuses a reference to a missing file', () => {
  const r = project();
  try {
    write(r.root, 'docs/superpowers/models/preview.html', '<title>map</title>\n');
    const res = intake(r.root, 'ref', '--subsystem', 'config', '--path', 'docs/superpowers/models/preview.html');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.match(read(r.root, ST), /## References\n\n- \[preview\.html\]\(\.\.\/\.\.\/superpowers\/models\/preview\.html\)/);
    assert.match(read(r.root, 'docs/spec-current/config.md'), /\[preview\.html\]\(\.\.\/superpowers\/models\/preview\.html\)/);
    assert.equal(gate(r.root).code, 0);
    fs.rmSync(path.join(r.root, 'docs/superpowers/models/preview.html'));
    assert.match(gate(r.root).stdout, /references \.\.\/\.\.\/superpowers\/models\/preview\.html, which does not exist/);
  } finally { r.cleanup(); }
});

test('RED CHECK: decision refuses a file outside decisions/, one without decision front matter, and a rests_on that is not a dictation', () => {
  const r = project();
  try {
    write(r.root, 'docs/adr-elsewhere/0010-x.md', adr(10, 'Accepted'));
    assert.match(intake(r.root, 'decision', '--file', 'docs/adr-elsewhere/0010-x.md').stderr, /a decision note lives at docs\/dictated-specs\/decisions\/00NN-slug\.md/);
    write(r.root, 'docs/dictated-specs/decisions/0010-x.md', '# ADR\n\n- **Status:** Accepted\n');
    assert.match(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-x.md').stderr, /needs front matter with kind: decision/);
    write(r.root, 'docs/dictated-specs/decisions/0010-x.md', adr(10, 'Accepted').replace(D, 'nope'));
    assert.match(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-x.md').stderr, /rests_on nope: not a dictation note/);
    assert.doesNotMatch(read(r.root, ST), /0010-x/);
  } finally { r.cleanup(); }
});
