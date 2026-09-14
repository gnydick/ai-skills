import './helpers/env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { componentsOf } from '../scripts/lib/components.mjs';
import { MACHINERY_OWN, isOwnFile } from '../scripts/lib/own-files.mjs';

// Plan Task B2 (recalibration 13, 15, 23; owner answers 45, 46): the installed pre-commit runs the
// recorded `checks.commit` (if any) and then `tiers.fast` once, with the components a staged path
// starts with, and refuses the commit when either fails or when nothing is recorded.

const fast = (root) => runScript('scripts/tiers.mjs', { args: ['fast'], cwd: root });
const setup = (root, ...args) => runScript('scripts/setup.mjs', { args, cwd: root });
const sh = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

// A project with the hooks installed, one component `pkg-a`, and a `check.mjs` that records what it
// was asked to run and fails only when `fail.flag` exists. The commands' own files are excluded so
// they never dirty the tree. The install is left staged, not committed: the hook it installs
// refuses every commit until tiers and components are recorded (decision 39), and these tests
// exercise exactly that state.
function fixture() {
  const r = makeRepo();
  fs.appendFileSync(path.join(r.root, '.git', 'info', 'exclude'), 'ran.txt\nmerged.txt\nchecked.txt\n*.flag\n');
  runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
  fs.mkdirSync(path.join(r.root, 'pkg-a', 'src'), { recursive: true });
  fs.writeFileSync(path.join(r.root, 'pkg-a', 'src', 'x.txt'), 'x\n');
  fs.writeFileSync(path.join(r.root, 'check.mjs'), "import fs from 'node:fs'; fs.writeFileSync('ran.txt', process.argv.slice(2).join(' ')); process.exit(fs.existsSync('fail.flag') ? 1 : 0);\n");
  fs.writeFileSync(path.join(r.root, 'checks.mjs'), "import fs from 'node:fs'; fs.writeFileSync('checked.txt', 'yes'); process.exit(fs.existsSync('checks-fail.flag') ? 1 : 0);\n");
  sh(['add', 'pkg-a/src/x.txt'], r.root);
  return r;
}
const record = (root) => {
  assert.equal(setup(root, 'set', 'components', 'pkg-a=pkg-a', 'pkg-b=pkg-b').code, 0);
  assert.equal(setup(root, 'set', 'tiers.fast', 'node check.mjs <components>').code, 0);
};

test('fast runs the recorded command once with the touched components', () => {
  const r = fixture();
  try {
    record(r.root);
    const res = fast(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.equal(fs.readFileSync(path.join(r.root, 'ran.txt'), 'utf8'), 'pkg-a');
    assert.match(res.stdout, /^fast_tier: 0 of 1 touched components failed$/m);
  } finally { r.cleanup(); }
});

test('a failing fast tier refuses the commit naming the components and the command', () => {
  const r = fixture();
  try {
    record(r.root);
    fs.writeFileSync(path.join(r.root, 'fail.flag'), '');
    const res = fast(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /^fast_tier: 1 of 1 touched components failed$/m);
    assert.match(res.stdout, /^commit refused: fast tests failed in pkg-a — run `node check\.mjs pkg-a`, fix, commit again$/m);
  } finally { r.cleanup(); }
});

test('checks.commit runs before the fast tier when recorded, and its failure refuses the commit before any tier runs (owner 46)', () => {
  const r = fixture();
  try {
    record(r.root);
    assert.equal(setup(r.root, 'set', 'checks.commit', 'node checks.mjs').code, 0);
    const ok = fast(r.root);
    assert.equal(ok.code, 0, ok.stdout + ok.stderr);
    assert.equal(fs.readFileSync(path.join(r.root, 'checked.txt'), 'utf8'), 'yes');
    assert.match(ok.stdout, /^commit_checks: 0 of 1 checks failed$/m);
    fs.rmSync(path.join(r.root, 'ran.txt'));
    fs.writeFileSync(path.join(r.root, 'checks-fail.flag'), '');
    const res = fast(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /^commit_checks: 1 of 1 checks failed$/m);
    assert.match(res.stdout, /^commit refused: checks failed — run `node checks\.mjs`, fix, commit again$/m);
    assert.equal(fs.existsSync(path.join(r.root, 'ran.txt')), false, 'the fast tier ran after the checks failed');
  } finally { r.cleanup(); }
});

test('nothing staged in a component: the tier is not run and the line says so', () => {
  const r = fixture();
  try {
    record(r.root);
    sh(['reset', '-q'], r.root);
    fs.writeFileSync(path.join(r.root, 'loose.txt'), 'x\n');
    sh(['add', 'loose.txt'], r.root);
    const res = fast(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.equal(fs.existsSync(path.join(r.root, 'ran.txt')), false);
    assert.match(res.stdout, /^fast_tier: 0 of 0 touched components failed \(nothing staged in a component\)$/m);
  } finally { r.cleanup(); }
});

test('a commit staging only machinery\'s own files (the install) passes with nothing recorded (STATUS 51)', () => {
  const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    const staged = sh(['diff', '--cached', '--name-only'], r.root);
    const res = fast(r.root);
    assert.equal(res.code, 0, `${res.stdout}${res.stderr}\nstaged:\n${staged}`);
    assert.match(res.stdout, /^fast_tier: 0 of 0 touched components failed \(machinery's own files only\)$/m);
  } finally { r.cleanup(); }
});

test('what install.mjs stages is exactly the shared MACHINERY_OWN list, so the exemption and the install cannot drift (STATUS 51)', () => {
  const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    const staged = sh(['diff', '--cached', '--name-only'], r.root).split('\n').filter(Boolean);
    assert.ok(staged.length >= 5, `the install staged ${staged.length} paths — the observer must see them`);
    assert.deepEqual(staged.filter((p) => !isOwnFile(p)), [], 'install stages a path the shared list does not name');
    const hasFiles = (p) => fs.statSync(p).isFile() || fs.readdirSync(p, { recursive: true, withFileTypes: true }).some((d) => d.isFile());
    const present = MACHINERY_OWN.filter((e) => fs.existsSync(path.join(r.root, e)) && hasFiles(path.join(r.root, e)));
    assert.deepEqual(present.filter((e) => !staged.some((p) => p === e || p.startsWith(e + '/'))), [], 'a shared-list entry install created was not staged');
  } finally { r.cleanup(); }
});

test('an empty index prints its own line and exits 0', () => {
  const r = fixture();
  try {
    sh(['reset', '-q'], r.root);
    const res = fast(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^fast_tier: 0 of 0 touched components failed \(nothing staged\)$/m);
  } finally { r.cleanup(); }
});

test('RED CHECK: with no tiers recorded the hook refuses and names /machinery:setup tiers', () => {
  const r = fixture();
  try {
    const res = fast(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /^commit refused: no tiers recorded in \.claude\/machinery\/config\.json — run \/machinery:setup tiers$/m);
  } finally { r.cleanup(); }
});

test('RED CHECK: with tiers but no components recorded the hook refuses and names /machinery:setup tiers (owner 45)', () => {
  const r = fixture();
  try {
    assert.equal(setup(r.root, 'set', 'tiers.fast', 'node check.mjs <components>').code, 0);
    const res = fast(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /^commit refused: no components recorded in \.claude\/machinery\/config\.json — run \/machinery:setup tiers$/m);
    assert.equal(fs.existsSync(path.join(r.root, 'ran.txt')), false);
  } finally { r.cleanup(); }
});

test('componentsOf names each recorded component a staged path starts with, once, by prefix not by substring', () => {
  const r = makeRepo();
  try {
    assert.equal(setup(r.root, 'set', 'components', 'a=pkg-a', 'b=pkg-b/', 'deep=libs/deep/core').code, 0);
    assert.deepEqual(componentsOf(r.root, ['pkg-a/src/x.txt', 'pkg-a/y.txt', 'pkg-b/z.txt', 'README.md']), ['a', 'b']);
    assert.deepEqual(componentsOf(r.root, ['pkg-ab/x.txt', 'libs/deep/core-x/y.txt']), []);
    assert.deepEqual(componentsOf(r.root, ['libs/deep/core/x.txt']), ['deep']);
    assert.deepEqual(componentsOf(r.root, []), []);
  } finally { r.cleanup(); }
});

test('the installed pre-commit runs the gate, then the fast tier', () => {
  const r = fixture();
  try {
    assert.equal(fs.readFileSync(path.join(r.root, '.githooks', 'pre-commit'), 'utf8'),
      '#!/bin/sh\n# Installed by /machinery:install.\nnode .githooks/machinery/gate.mjs && exec node .githooks/machinery/tiers.mjs fast\n');
  } finally { r.cleanup(); }
});
