import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const RULE = '# T\n\n## S\n\n- a rule\n';
function project(root) {
  write(root, '.claude/rules/t.md', RULE);
  write(root, '.claude/machinery/inbox.md', '');
  runScript('scripts/reindex.mjs', { args: ['--rules', path.join(root, '.claude/rules'), '--out', path.join(root, '.claude/machinery/INDEX.md')] });
  g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', 'install');
}
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });

test('clean commit passes and every executed check prints its denominator, zero included (spec I25)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/a.md', 'hello'); g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^register_check: 0 of 0 pending/m);
    assert.match(res.stdout, /^citation_target: 0 of 0 new citations/m);
  } finally { r.cleanup(); }
});

test('a PENDING inbox entry blocks', () => {
  const r = makeRepo();
  try {
    project(r.root);
    write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-02T00:00:00Z PRULE s\n\nPRULE: x\n\ndisposition: PENDING\n'); g(r.root, 'add', '-A');
    const res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /1 of 1 pending/);
  } finally { r.cleanup(); }
});

test('a stale (hand-edited) index blocks (spec I28)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, '.claude/machinery/INDEX.md', 'edited by hand'); g(r.root, 'add', '-A');
    const res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /index is stale/);
  } finally { r.cleanup(); }
});

test('a new path:line citation to a blank line blocks; a real one passes (spec I26)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'src/x.js', 'line1\n\nline3\n'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'src');
    write(r.root, 'docs/n.md', 'see `src/x.js:2` and `src/x.js:3`'); g(r.root, 'add', '-A');
    const res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /citation_target: 1 of 2 new citations failed/);
    write(r.root, 'docs/n.md', 'see `src/x.js:3`'); g(r.root, 'add', '-A');
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('a file § Section citation to a missing heading blocks; an existing one passes', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/n.md', 'see `.claude/rules/t.md` § Nope'); g(r.root, 'add', '-A');
    assert.equal(gate(r.root).code, 1);
    write(r.root, 'docs/n.md', 'see `.claude/rules/t.md` § S'); g(r.root, 'add', '-A');
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('old citations are never re-audited: a pre-existing bad citation does not block a new commit', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/old.md', 'see `src/nothere.js:9`'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '--no-verify', '-m', 'old');
    write(r.root, 'docs/new.md', 'plain'); g(r.root, 'add', '-A');
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('sweep guard: docs commit adding a brand-new non-docs file warns, never blocks; modifying an existing non-docs file silences it', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/a.md', 'x'); write(r.root, 'stray.tmp', 'oops'); g(r.root, 'add', '-A');
    let res = gate(r.root); assert.equal(res.code, 0); assert.match(res.stdout, /ADVISORY: sweep-guard denominator: 2 staged, 2 newly-tracked, 1 non-doc suspect/); assert.match(res.stdout, /stray\.tmp/);
    g(r.root, 'commit', '-q', '--no-verify', '-m', 'x');
    write(r.root, 'docs/a.md', 'y'); write(r.root, 'README.md', 'changed'); write(r.root, 'new.tmp', 'n'); g(r.root, 'add', '-A');
    res = gate(r.root); assert.doesNotMatch(res.stdout, /ADVISORY/);
  } finally { r.cleanup(); }
});

test('--universal runs the register check over the plugin layout', () => {
  const r = makeRepo();
  try {
    write(r.root, 'rules/t.md', RULE); write(r.root, 'inbox.md', '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(r.root, 'rules'), '--out', path.join(r.root, 'register/INDEX.md')] });
    g(r.root, 'add', '-A');
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', r.root, '--universal'], cwd: r.root }).code, 0);
  } finally { r.cleanup(); }
});

test('RED CHECK: the gate is not a no-op — a pending entry really fails it', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-02T00:00:00Z PRULE s\n\nx\n\ndisposition: PENDING\n'); g(r.root, 'add', '-A');
    assert.notEqual(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});
