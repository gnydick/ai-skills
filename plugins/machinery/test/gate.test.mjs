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
  } finally { r.cleanup(); }
});

test('first commit after /machinery:install passes the gate (final review A1)', () => {
  const r = makeRepo();
  try {
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    const g0 = gate(r.root);
    assert.equal(g0.code, 0, g0.stdout + g0.stderr);
    assert.doesNotMatch(g0.stdout, /index/);
    g(r.root, 'commit', '-q', '-m', 'install');
    assert.equal(g(r.root, 'status', '--porcelain').trim(), '');
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
    g(r.root, 'add', '-A');
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', r.root, '--universal'], cwd: r.root }).code, 0);
  } finally { r.cleanup(); }
});

test('a staged rule file with no index anywhere passes the gate (decision 10)', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/rules/t.md', RULE); write(r.root, '.claude/machinery/inbox.md', ''); g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout);
    assert.doesNotMatch(res.stdout, /index/);
  } finally { r.cleanup(); }
});

test('RED CHECK: the gate is not a no-op — a pending entry really fails it', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-02T00:00:00Z PRULE s\n\nx\n\ndisposition: PENDING\n'); g(r.root, 'add', '-A');
    assert.notEqual(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});
