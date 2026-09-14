// This repo's own git hooks and machinery settings — plan Task B8 (owner answer 6 / STATUS 48,
// ruled for the plugin's own source by STATUS 53): no installed copies under .githooks/machinery/,
// the hooks call the scripts in place, and every setup key is recorded in
// .claude/machinery/config.json. The hook text is pinned byte for byte, because a hook that has
// drifted from what the tier runner expects fails at the next commit, not here.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SUITES } from '../test-tier.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(REPO, ...p), 'utf8');

let registered = 0, passed = 0;
const check = (name, fn) => { registered++; test(name, async (t) => { await fn(t); passed++; }); };
after(() => console.log(`repo_hooks_tests: ${passed} of ${registered} test(s) passed`));

const HEADER = '#!/bin/sh\n# This repo is the machinery plugin\'s own source: its hooks call the scripts in place (STATUS 53).\n# Enable once per clone: node scripts/build-skills.mjs hooks\n';

check('the pre-commit runs the universal inbox gate, then the fast tier for the touched components', () => {
  assert.equal(read('.githooks', 'pre-commit'),
    `${HEADER}node plugins/machinery/scripts/gate/gate.mjs --root plugins/machinery --universal && exec node plugins/machinery/scripts/tiers.mjs fast\n`);
});

check('the pre-push runs the merge tier', () => {
  assert.equal(read('.githooks', 'pre-push'), `${HEADER}exec node plugins/machinery/scripts/tiers.mjs merge\n`);
});

check('no installed copy of the gate or tiers lives under .githooks/machinery/ (STATUS 53)', () => {
  assert.equal(fs.existsSync(path.join(REPO, '.githooks', 'machinery')), false);
});

// The real command over the real file: setup.mjs show resolves the checkout from cwd (STATUS 52).
// GIT_* is scrubbed because the pre-commit hook exports GIT_DIR and GIT_INDEX_FILE, and from a
// linked worktree both are absolute.
check('setup.mjs show reports every key recorded (11 of 11)', () => {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k];
  const run = spawnSync(process.execPath, [path.join(REPO, 'plugins', 'machinery', 'scripts', 'setup.mjs'), 'show'], { cwd: REPO, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^machinery_setup: 11 of 11 keys recorded$/m, run.stdout);
});

check('the recorded tiers run through scripts/test-tier.mjs, and every recorded component has a suite there', () => {
  const config = JSON.parse(read('.claude', 'machinery', 'config.json'));
  assert.equal(config.checks.commit, 'node scripts/build-skills.mjs check');
  assert.equal(config.tiers.fast, 'node scripts/test-tier.mjs fast <components>');
  assert.equal(config.tiers.merge, 'node scripts/test-tier.mjs merge');
  assert.deepEqual(Object.keys(config.components).filter((c) => !(c in SUITES)), [], 'a component recorded in config.json has no suite in test-tier.mjs');
  assert.deepEqual(Object.keys(SUITES).filter((c) => !(c in config.components)), [], 'test-tier.mjs maps a component config.json does not record');
});
