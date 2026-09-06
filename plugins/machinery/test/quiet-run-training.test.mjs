// plugins/machinery/test/quiet-run-training.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript } from './helpers/run.mjs';

// The runner's training-loop seam, in a file of its own: node --test runs suite FILES concurrently,
// so a new file adds to the wall clock only what it costs on its own, where appending bash-spawning
// cases to quiet-run.test.mjs would lengthen the longest pole (the pre-commit budget).
const bash = fs.existsSync('C:/Program Files/Git/bin/bash.exe') || process.platform !== 'win32';
const repo = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); execFileSync('git', ['init', '-q'], { cwd: d }); return d; };
const seed = (root, name, data) => { const dir = path.join(root, '.claude', 'machinery'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), JSON.stringify(data)); };
const obsOf = (root) => JSON.parse(fs.readFileSync(path.join(root, '.claude', 'machinery', 'observations.json'), 'utf8'));
const run = (root, mode, cmd) => runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', mode, '-c', cmd] });
const AT = '2026-09-05T12:00:00.000Z';
// 101 lines, the answer at line 11 — far outside the tail, kept by no generic rule.
const ANSWER_RUN = `node -e "for(let i=0;i<100;i++){if(i===10)console.log('ANSWER 42');console.log('   Compiling c'+i)}"`;
const LEARNED = { node: { match: { type: 'prefix', value: 'node' }, outcome: { type: 'prefix', value: 'ANSWER ' }, candidates: [], learned: { at: AT, picks: 4 } } };

test('RED CHECK (control): without a learned entry the buried answer line is dropped by the generic contract', { skip: !bash }, () => {
  const root = repo('quiet-train-control-');
  const r = run(root, 'filter', ANSWER_RUN);
  assert.doesNotMatch(r.stdout, /ANSWER 42/);
});

test("a learned prefix entry's answer line survives filtering, applied through the same seam as a declared regex", { skip: !bash }, () => {
  const root = repo('quiet-train-learned-');
  seed(root, 'tool-catalog.json', LEARNED);
  const r = run(root, 'filter', ANSWER_RUN);
  assert.match(r.stdout, /ANSWER 42/);
  // stderr is not empty here: the first save in a fresh repository says it added the .gitignore
  // entry (pinned in quiet-run.test.mjs). What must be absent is the catalog warning.
  assert.doesNotMatch(r.stderr, /unusable tool catalog/, 'a well-formed learned entry raises no catalog warning');
});
