import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/SessionStart.json'), 'utf8'));
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
const banner = (cwd) => JSON.parse(runScript('scripts/banner.mjs', { stdin: JSON.stringify({ ...base, cwd }), cwd, env: { MACHINERY_HOME: home() } }).stdout).hookSpecificOutput.additionalContext;
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };

function oldProject() {
  const r = makeRepo();
  write(r.root, 'docs/dictated-specs/collision-model.md', '# Collision\n\n## A\n');
  write(r.root, 'docs/dictated-specs/tooling.md', '# Tooling\n');
  write(r.root, 'docs/adr/0001-x.md', '# ADR\n');
  write(r.root, 'docs/superpowers/specs/2026-06-21-x-design.md', '# X\n');
  write(r.root, 'docs/superpowers/plans/2026-06-21-x.md', '# P\n');
  write(r.root, 'docs/superpowers/plans/2026-06-22-y.md', '---\nkind: plan\nticket: 1\nstatus: done\n---\n# P\n');
  return r;
}

test('the banner names each kind of unmigrated content with its count, with no gate installed', () => {
  const r = oldProject();
  try {
    const t = banner(r.root);
    assert.match(t, /gate: not installed/);
    assert.match(t, /slip box: NOT MIGRATED — 2 old spec file\(s\) in docs\/dictated-specs\/, docs\/adr\/ \(1 file\(s\)\), 2 superpowers file\(s\) without front matter; run node ".*intake\.mjs" migrate --plan <file>/);
  } finally { r.cleanup(); }
});

test('install prints the same line and migrates nothing', () => {
  const r = oldProject();
  try {
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /slip box: NOT MIGRATED — 2 old spec file\(s\)/);
    assert.ok(fs.existsSync(path.join(r.root, 'docs/adr/0001-x.md')), 'install moved nothing');
  } finally { r.cleanup(); }
});

test('RED CHECK: a migrated project gets no slip box line at all', () => {
  const r = makeRepo();
  try {
    write(r.root, 'docs/dictated-specs/INDEX.md', '# index\n');
    write(r.root, 'docs/superpowers/plans/2026-06-22-y.md', '---\nkind: plan\nticket: 1\nstatus: done\n---\n# P\n');
    assert.doesNotMatch(banner(r.root), /slip box/);
  } finally { r.cleanup(); }
});
