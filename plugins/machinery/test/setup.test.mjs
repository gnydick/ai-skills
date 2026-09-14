import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { readSetting } from '../scripts/lib/settings.mjs';

const setup = (root, ...args) => runScript('scripts/setup.mjs', { args, cwd: root });
const CONFIG = (root) => path.join(root, '.claude', 'machinery', 'config.json');

test('set records each kind of key and show prints it; worktree shows its default until recorded', () => {
  const r = makeRepo();
  try {
    assert.match(setup(r.root, 'show').stdout, /^worktree: not recorded \(default: always\)$/m);
    assert.equal(setup(r.root, 'set', 'tiers.fast', 'node check.mjs <components>').code, 0);
    assert.equal(setup(r.root, 'set', 'reviewBeforeMain', 'person').code, 0);
    assert.equal(setup(r.root, 'set', 'comparisonPaths', 'src/render', 'src/export').code, 0);
    const shown = setup(r.root, 'show').stdout;
    assert.match(shown, /^tiers\.fast: node check\.mjs <components>$/m);
    assert.match(shown, /^comparisonPaths: src\/render, src\/export$/m);
    assert.match(shown, /^tiers\.merge: not recorded — \/machinery:setup tiers$/m);
    assert.match(shown, /^machinery_setup: 3 of 11 keys recorded$/m);
  } finally { r.cleanup(); }
});

test('components is a name=prefix mapping and checks.commit a command; tiers.assignment accepts exactly the three answers (owner 45–47)', () => {
  const r = makeRepo();
  try {
    assert.equal(setup(r.root, 'set', 'components', 'plugin=plugins/machinery', 'skills=claude-code').code, 0);
    assert.equal(setup(r.root, 'set', 'checks.commit', 'node scripts/build-skills.mjs check').code, 0);
    assert.equal(setup(r.root, 'set', 'tiers.assignment', 'propose-per-commit').code, 0);
    const shown = setup(r.root, 'show').stdout;
    assert.match(shown, /^components: plugin=plugins\/machinery, skills=claude-code$/m);
    assert.match(shown, /^checks\.commit: node scripts\/build-skills\.mjs check$/m);
    assert.match(shown, /^tiers\.assignment: propose-per-commit$/m);
    assert.deepEqual(readSetting(r.root, 'components'), { plugin: 'plugins/machinery', skills: 'claude-code' });
    const bad = setup(r.root, 'set', 'components', 'plugins/machinery');
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /^components: 'plugins\/machinery' is not <name>=<path prefix>/);
    const who = setup(r.root, 'set', 'tiers.assignment', 'ask');
    assert.equal(who.code, 1);
    assert.equal(who.stderr.trim(), "tiers.assignment: 'ask' is not accepted — use ask-per-test, propose-per-commit or claude-decides");
    // STATUS decision 50: the "no review" answer is `no-review`, never the issue-tracking state word.
    const review = setup(r.root, 'set', 'reviewBeforeMain', 'nobody');
    assert.equal(review.code, 1);
    assert.equal(review.stderr.trim(), "reviewBeforeMain: 'nobody' is not accepted — use no-review, person, agent or person-and-agent");
  } finally { r.cleanup(); }
});

test('readSetting on an unrecorded key without a default names the setup item', () => {
  const r = makeRepo();
  try {
    assert.equal(readSetting(r.root, 'worktree'), 'always');
    assert.throws(() => readSetting(r.root, 'reviewBeforeMain'), /^Error: reviewBeforeMain is not recorded in \.claude\/machinery\/config\.json — run \/machinery:setup review$/);
  } finally { r.cleanup(); }
});

test('RED CHECK: set refuses an unaccepted value, naming the accepted ones, and writes nothing', () => {
  const r = makeRepo();
  try {
    const res = setup(r.root, 'set', 'worktree', 'sometimes');
    assert.equal(res.code, 1);
    assert.equal(res.stderr.trim(), "worktree: 'sometimes' is not accepted — use always, multi-commit or never");
    const fast = setup(r.root, 'set', 'tiers.fast', 'cargo test');
    assert.equal(fast.code, 1);
    assert.match(fast.stderr, /tiers\.fast: 'cargo test' has no <components> placeholder/);
    assert.equal(fs.existsSync(CONFIG(r.root)), false);
  } finally { r.cleanup(); }
});

test('a malformed config.json is a diagnostic naming the file, not a stack trace', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.dirname(CONFIG(r.root)), { recursive: true }); fs.writeFileSync(CONFIG(r.root), '{oops');
    const res = setup(r.root, 'show');
    assert.equal(res.code, 1);
    assert.match(res.stderr, /config\.json: not valid JSON .* — fix or delete the file, then run \/machinery:setup/);
  } finally { r.cleanup(); }
});
