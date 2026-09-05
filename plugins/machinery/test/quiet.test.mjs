import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript, PLUGIN } from './helpers/run.mjs';

const fixture = (name, command) => {
  const p = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/', `${name}.json`), 'utf8'));
  p.tool_input = { ...p.tool_input, command, description: 'd' };
  return JSON.stringify(p);
};
const out = (stdout) => JSON.parse(stdout).hookSpecificOutput;

test('noisy bash command is rewritten to run through quiet-run in filter mode', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /^node "[^"]*quiet-run\.mjs" --shell bash --mode filter "[^"]+"$/);
  assert.equal(u.description, 'd [quiet:filter]');
  const cmdfile = u.command.match(/"([^"]+)"$/)[1];
  assert.equal(fs.readFileSync(cmdfile, 'utf8'), 'cargo test');
});

test('infra powershell command gets the powershell wrapper and exit passthrough', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-PowerShell', 'git push') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /--shell powershell --mode infra .*; exit \$LASTEXITCODE$/);
});

// `ls` was the fourth entry here until Task 7. It is `plain`, and `plain` no longer means
// untouched — an unseen tool's volume is unknown, so it is observed once
// (specs/2026-09-04-tool-assimilation-design.md, "The five states"). The untouched half of that
// behaviour is now covered below, in the state where it is actually true: a recorded-quiet tool.
test('read / piped / redirected commands are untouched', () => {
  for (const c of ['gh issue view 1', 'cargo test | tail -5', 'cargo build > log']) {
    const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c); assert.equal(r.code, 0);
  }
});

// Ruling C1 (owner, 2026-09-05): "Only need wrapping for output producers, not filter pipes." The
// final review measured `cat big.txt` observed on run 1 and cut to 8 of 120 lines on run 2; these
// are its exact commands, through the hook, in a real repository with no history. A byte-mover
// never reaches the assimilator, so it is untouched with or without a record.
test('a byte-mover is never wrapped, never observed: the exemption is by kind, not by record', () => {
  const root = project({ cat: { identity: 'bespoke', noisy: true, lines: 120, stdoutLines: 120, stderrLines: 0, ledger: {} } });
  // Four spawns, not the whole list: the rest of the set is covered per command in
  // lib-classify.test.mjs, and every hook spawn here costs the pre-commit budget ~150 ms.
  for (const c of ['cat big.txt', 'sed -n 1,200p x', 'grep -rn line .', 'git log --oneline -50']) {
    const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c); assert.equal(r.code, 0, c);
  }
});

test('a non-shell tool is untouched', () => {
  const p = JSON.parse(fixture('PreToolUse-Bash', 'cargo test')); p.tool_name = 'Read';
  const r = runScript('scripts/quiet.mjs', { stdin: JSON.stringify(p) });
  assert.equal(r.stdout, '');
});

test('fails OPEN: garbage stdin → no output, exit 0 (spec I17)', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: '{not json' });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('fails OPEN: unwritable temp dir → no output, exit 0 (spec I17)', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test'), env: { CLAUDE_JOB_DIR: 'Z:\\nonexistent\\dir\\for\\quiet' } });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('RED CHECK: the rewrite is not the identity', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test') });
  assert.notEqual(out(r.stdout).updatedInput.command, 'cargo test');
});

// ---- Task 7: what happens to a command classify() has no opinion on ----
// `plain` used to mean "leave it alone". It now means "ask the assimilator", and the two new
// facts it can come back with — this project has never seen this tool, and this project has
// seen it and it was loud — are what the rest of this file exercises.

// A REAL repository. projectRoot() answers by asking git for the common dir, so a bare `.git`
// directory is not a repository: it throws, quiet.mjs fails open, and a test built on one would
// pass or fail for reasons that have nothing to do with the assimilator. One repo for the whole
// file (tests in a file run in order), re-seeded per test, because `git init` is not free.
let PROJECT = null;
function project(obs, cat) {
  if (!PROJECT) {
    PROJECT = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-assimilate-'));
    execFileSync('git', ['init', '-q'], { cwd: PROJECT });
  }
  const dir = path.join(PROJECT, '.claude', 'machinery');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, data] of [['observations.json', obs], ['tool-catalog.json', cat]]) {
    const f = path.join(dir, name);
    if (data) fs.writeFileSync(f, JSON.stringify(data)); else fs.rmSync(f, { force: true });
  }
  return PROJECT;
}

// A project-declared off-the-shelf tool, for the overlay path. The universal entries are exercised
// separately below (ruling I1): until then `pytest` and `npm install` were NOISY and `git commit`
// INFRA before the assimilator was ever consulted, so the catalog branch of decide() was reachable
// from quiet.mjs only through the project's own overlay — the final review's I1.
const TESTQ = { testq: { match: { type: 'prefix', value: 'scripts/testq.sh' }, outcome: '^MERGE GATE', candidates: ['--quiet'] } };

// Ruling I1 (owner, 2026-09-05): a verified catalog entry is the authority, and classify() reports
// plain for it. The final review MEASURED the hook answering filter / filter / infra for these three
// with a record saying each is noisy and its candidate untried, while decide() on the same inputs
// said suggest. This is that reproduction: the spec's central claim — "a known tool's first noisy
// pass is suggest-only, and unwrapped" — has to hold for the tools the shipped catalog knows.
test("I1: the universal catalog's suggest state is reachable from the hook", () => {
  const noisyUntried = (id) => ({ [id]: { identity: 'catalog', noisy: true, lines: 900, ledger: {} } });
  for (const [id, c] of [['pytest', 'pytest tests/'], ['npm-install', 'npm install'], ['git-commit', 'git commit -m x']]) {
    const root = project(noisyUntried(id));
    const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) });
    const u = out(r.stdout).updatedInput;
    assert.match(u.command, /--mode suggest/, c);
    assert.equal(u.description, 'd [quiet:suggest]', c);
  }
});

test('a plain-classified command with no observation history is wrapped in observe mode', () => {
  const root = project(null, TESTQ);
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'scripts/testq.sh --workspace') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /--mode observe/);
  assert.equal(u.description, 'd [quiet:observe]');
});

test('an unrecognised bespoke command with no history is observed too — unknown volume is not quiet', () => {
  const root = project(null);
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.match(out(r.stdout).updatedInput.command, /--mode observe/);
});

test('a command whose own record says it is quiet is left untouched', () => {
  const root = project({ 'bash scripts/battery.sh': { identity: 'bespoke', noisy: false, lines: 3, ledger: {} } });
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('a bespoke command recorded noisy is wrapped in filter mode', () => {
  const root = project({ 'bash scripts/battery.sh': { identity: 'bespoke', noisy: true, lines: 1400, ledger: {} } });
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.match(out(r.stdout).updatedInput.command, /--mode filter/);
});

test('an off-the-shelf tool recorded noisy with an untried candidate is wrapped in suggest mode', () => {
  const root = project({ testq: { identity: 'catalog', noisy: true, lines: 900, ledger: {} } }, TESTQ);
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'scripts/testq.sh --workspace') });
  assert.match(out(r.stdout).updatedInput.command, /--mode suggest/);
});

test('RED CHECK: the NEVER exemption survives plain no longer meaning untouched', () => {
  // classify() returns 'plain' for a NEVER-listed command exactly as it does for an unrecognised
  // one, so routing every 'plain' to the assimilator would put `--version` in the observation
  // record and wrap an already-wrapped command in a second wrapper — the precise failure the
  // NEVER list exists to prevent, and one no test above could see.
  const root = project(null);
  for (const c of ['cargo --version', 'pytest --help', 'node "C:/x/quiet-run.mjs" --shell bash --mode observe "C:/x/cmd.txt"']) {
    const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c);
  }
});
