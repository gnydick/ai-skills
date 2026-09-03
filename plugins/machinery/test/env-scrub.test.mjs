import './helpers/env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Story: spec I41 — a test process must never inherit the caller's git environment (the
// measured incident is written up in helpers/env.mjs). The scrub lives in ONE helper, and
// this file holds the two things that make that a mechanism rather than a claim: a scan
// proving every test file that spawns git reaches the scrub, and a positive control proving
// the scrub actually fires — with its own inverse, so the observer is known to be alive.

const TESTDIR = path.dirname(fileURLToPath(import.meta.url));
const HELPERS = path.join(TESTDIR, 'helpers');

// A file "spawns git" if it calls runScript() (which spawns a script that runs git for
// itself) or hands 'git' to execFileSync/spawnSync directly.
const SPAWNS_GIT = /runScript\s*\(|(?:execFileSync|spawnSync)\s*\(\s*(?:'git'|"git"|gitExe)/;
// Any of the three helpers reaches the scrub: env.mjs is it, and repo.mjs and run.mjs both
// import it first (asserted separately below).
const SCRUBBING_IMPORT = /['"]\.\/helpers\/(?:env|repo|run)\.mjs['"]/;

// Returns the test files in `dir` that spawn git without importing a scrubbing helper.
// Factored out so the RED CHECK can prove the scan actually fires.
function unscrubbedSpawners(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.test.mjs'))
    .filter((f) => {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      return SPAWNS_GIT.test(src) && !SCRUBBING_IMPORT.test(src);
    });
}

test('every test file that spawns git imports a GIT_*-scrubbing helper (spec I41)', () => {
  assert.deepEqual(unscrubbedSpawners(TESTDIR), []);
});

test('RED CHECK: the scan actually flags a spawning file with no scrubbing import', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'env-scrub-'));
  try {
    fs.writeFileSync(path.join(tmp, 'bad.test.mjs'), "import { spawnSync } from 'node:child_process';\nspawnSync('git', ['status'], { cwd: root });\n");
    fs.writeFileSync(path.join(tmp, 'good.test.mjs'), "import { runScript } from './helpers/run.mjs';\nrunScript('scripts/reload.mjs');\n");
    assert.deepEqual(unscrubbedSpawners(tmp), ['bad.test.mjs']);
  } finally { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }); }
});

test('both spawn helpers import the scrub before anything else', () => {
  for (const f of ['repo.mjs', 'run.mjs']) {
    const lines = fs.readFileSync(path.join(HELPERS, f), 'utf8').split('\n').filter((l) => l.trim());
    assert.equal(lines[0].trim(), "import './env.mjs';", `helpers/${f} must import './env.mjs' as its first line`);
  }
});

// Runs a child node process with GIT_DIR set, optionally importing the scrub first, and
// returns what the child saw.
function childGitDir({ scrub }) {
  const url = JSON.stringify(pathToFileURL(path.join(HELPERS, 'env.mjs')).href);
  const code = `${scrub ? `await import(${url});` : ''}console.log(process.env.GIT_DIR ?? 'scrubbed');`;
  return execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    env: { ...process.env, GIT_DIR: '/nonexistent' },
  }).trim();
}

test('POSITIVE CONTROL: importing the helper removes an inherited GIT_DIR', () => {
  assert.equal(childGitDir({ scrub: true }), 'scrubbed');
});

test('POSITIVE CONTROL inverse: without the import the child sees the inherited GIT_DIR', () => {
  assert.equal(childGitDir({ scrub: false }), '/nonexistent');
});
