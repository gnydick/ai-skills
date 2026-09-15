import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

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

// STATUS 54: the universal inbox is the user's, ~/.claude/machinery/inbox.md. The same check reads
// it beside the project inbox, so an unfiled URULE blocks a commit in ANY project, and the refusal
// names whichever inbox holds the entry. The plugin-layout mode (`--universal`) is gone with it.
test('a PENDING entry in the user\'s inbox blocks the commit in any project, naming that inbox and /machinery:rule-process (STATUS 54)', () => {
  const r = makeRepo();
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const userInbox = path.join(h, '.claude', 'machinery', 'inbox.md');
  try {
    project(r.root); write(r.root, 'docs/a.md', 'hello'); g(r.root, 'add', '-A');
    // Positive control: the same project and home pass while the user's inbox is empty.
    const green = runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(green.code, 0, green.stdout + green.stderr);
    assert.match(green.stdout, /^register_check: 0 of 0 pending/m);
    fs.mkdirSync(path.dirname(userInbox), { recursive: true });
    fs.writeFileSync(userInbox, '\n## PENDING 2026-09-14T00:00:00Z URULE s\n\nURULE: x\n\ndisposition: PENDING\n');
    const red = runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(red.code, 1, red.stdout + red.stderr);
    assert.match(red.stdout, /^register_check: 1 of 1 pending/m, red.stdout);
    assert.ok(red.stdout.includes(`commit refused: 1 pending entry in ${userInbox} — run /machinery:rule-process`), red.stdout);
    assert.doesNotMatch(red.stdout, /\.claude\/machinery\/inbox\.md — run/, 'the refusal named the project inbox, which is empty');
    assert.doesNotMatch(red.stdout, /--no-verify/);
    assert.ok(!fs.readFileSync(path.join(PLUGIN, 'scripts', 'gate', 'gate.mjs'), 'utf8').includes('--universal'), 'gate.mjs still carries the plugin-layout mode');
  } finally { r.cleanup(); fs.rmSync(h, { recursive: true, force: true, maxRetries: 5 }); }
});

test('a malformed user inbox is a diagnostic naming it, not a stack trace, and it blocks (STATUS 54)', () => {
  const r = makeRepo();
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const userInbox = path.join(h, '.claude', 'machinery', 'inbox.md');
  try {
    project(r.root); g(r.root, 'add', '-A');
    fs.mkdirSync(path.dirname(userInbox), { recursive: true });
    fs.writeFileSync(userInbox, '\n## PENDING 2026-09-14T00:00:00Z URULE s\n\nno disposition line\n');
    const res = runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /^register_check: 1 of 1 .*malformed/m, res.stdout);
    assert.ok(res.stdout.includes(userInbox), res.stdout);
    assert.doesNotMatch(res.stdout + res.stderr, /at Object\.|node:internal/, 'a stack trace reached the user');
  } finally { r.cleanup(); fs.rmSync(h, { recursive: true, force: true, maxRetries: 5 }); }
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

test('a pending entry refuses the commit naming the inbox and /machinery:rule-process, with no bypass offered', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-14T00:00:00Z PRULE s\n\nPRULE: x\n\ndisposition: PENDING\n');
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /^commit refused: 1 pending entry in \.claude\/machinery\/inbox\.md — run \/machinery:rule-process$/m);
    assert.doesNotMatch(res.stdout, /--no-verify/);
  } finally { r.cleanup(); }
});

test('RED CHECK: the gate is not a no-op — a pending entry really fails it', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-02T00:00:00Z PRULE s\n\nx\n\ndisposition: PENDING\n'); g(r.root, 'add', '-A');
    assert.notEqual(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});
