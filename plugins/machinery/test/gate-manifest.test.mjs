import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { loadDeclarations, renderManifest, walkClaims, NOT_A_CHECK, MANIFEST_FILE } from '../scripts/lib/manifest.mjs';

// Story: ticket #73. A check left the gate on 2026-09-05 (#29) and five claims about it survived
// intact, because the gate's composition was typed in one file and every claim about it lived in
// four others. Two invariants, both proved here:
//   I43 — the gate's composition is DERIVED from the check modules' own declarations (rung 6),
//         backed by a build-time regenerate-and-compare (rung 4).
//   I44 — a check cannot be marked `wired: false` while a claim still cites it (rung 4/6).

const REPO = path.resolve(PLUGIN, '..', '..');
const GATE = path.join(PLUGIN, 'scripts', 'gate');

// A throwaway gate directory holding two trivial check modules, mutated freely (an undeclared
// module, a hand-edited manifest) without touching the tree under test. Synthetic rather than a
// copy of scripts/gate: copying the real gate and its lib made each red check spawn a node that
// imported the whole read side, and this file alone ran 13.6 s of the pre-commit's 15 s budget.
// What that costs in coverage is nothing — the real gate directory is asserted against
// renderManifest() in process, above, and again by `node scripts/build-skills.mjs check`.
const CHECK_SRC = (fn, id, blocking) =>
  `export function ${fn}() { return true; }\n`
  + `export const declaration = Object.freeze({ id: '${id}', run: '${fn}', blocking: ${blocking}, wired: true, claims: Object.freeze([]) });\n`;

function synthGate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gatedir-'));
  fs.writeFileSync(path.join(dir, 'alpha-check.mjs'), CHECK_SRC('alphaCheck', 'alpha_check', true));
  fs.writeFileSync(path.join(dir, 'beta-check.mjs'), CHECK_SRC('betaCheck', 'beta_check', false));
  const w = runScript('scripts/gate-manifest.mjs', { args: ['--gate-dir', dir, '--root', REPO] });
  assert.equal(w.code, 0, w.stdout + w.stderr);
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }) };
}

const manifestCheck = (dir, root = REPO) => runScript('scripts/gate-manifest.mjs', { args: ['--check', '--gate-dir', dir, '--root', root] });

// ---------------------------------------------------------------- I43: composition is derived

test('every module under scripts/gate declares itself; the two structural files are the only exemptions (I43)', async () => {
  const { declarations, problems } = await loadDeclarations(GATE);
  assert.deepEqual(problems, []);
  assert.deepEqual(declarations.map((d) => d.id).sort(), ['citation_target', 'register_check', 'spec_check', 'sweep_guard']);
  assert.deepEqual([...NOT_A_CHECK], ['gate.mjs', MANIFEST_FILE]);
  const files = fs.readdirSync(GATE).filter((f) => f.endsWith('.mjs'));
  assert.equal(files.length, declarations.length + NOT_A_CHECK.length, `scripts/gate holds ${files.length} module(s): ${files.join(', ')}`);
});

test('the committed manifest is exactly the generated one (I43)', async () => {
  const { declarations } = await loadDeclarations(GATE);
  assert.equal(fs.readFileSync(path.join(GATE, MANIFEST_FILE), 'utf8'), renderManifest(declarations));
});

test('the generated manifest carries every wired check and no unwired one (I43)', async () => {
  const { CHECKS, CHECK_FILES } = await import('../scripts/gate/manifest.mjs');
  assert.deepEqual(CHECKS.map((c) => c.id), ['register_check', 'spec_check', 'sweep_guard']);
  assert.deepEqual([...CHECK_FILES], ['register-check.mjs', 'spec-check.mjs', 'sweep-guard.mjs']);
  assert.ok(Object.isFrozen(CHECKS));
  assert.deepEqual(CHECKS.map((c) => c.blocking), [true, true, false], 'sweep_guard is declared non-blocking');
  for (const c of CHECKS) assert.equal(typeof c.run, 'function', c.id);
});

test('RED CHECK: a module under the gate directory that declares nothing fails the build (I43)', () => {
  const c = synthGate();
  try {
    const green = manifestCheck(c.dir);
    assert.equal(green.code, 0, 'the untouched fixture must pass, or the red below proves nothing');
    assert.match(green.stdout, /^gate_manifest: 0 of 2 /m);
    fs.writeFileSync(path.join(c.dir, 'smuggled.mjs'), 'export function smuggled() { return true; }\n');
    const res = manifestCheck(c.dir);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /smuggled\.mjs: exports no `declaration`/);
    assert.match(res.stdout, /^gate_manifest: 1 of 3 /m, 'the failure carries its denominator');
  } finally { c.cleanup(); }
});

test('RED CHECK: a hand-edited CHECKS array is stale, and restoring it is green (I43)', () => {
  const c = synthGate();
  const file = path.join(c.dir, MANIFEST_FILE);
  const original = fs.readFileSync(file, 'utf8');
  try {
    assert.equal(manifestCheck(c.dir).code, 0, 'the untouched fixture must pass');
    fs.writeFileSync(file, original.replace("blocking: true", "blocking: false"));
    const red = manifestCheck(c.dir);
    assert.equal(red.code, 1, red.stdout + red.stderr);
    assert.match(red.stdout, /manifest\.mjs is stale/);
    assert.match(red.stdout, /gate-manifest\.mjs/, 'the failure names the regenerator');
    fs.writeFileSync(file, original);
    const green = manifestCheck(c.dir);
    assert.equal(green.code, 0, green.stdout + green.stderr);
  } finally { c.cleanup(); }
});

test('a malformed declaration is a diagnostic, never a stack trace (external input)', () => {
  // No generated manifest here on purpose: a gate directory in any state at all is DATA to the
  // loader, and a bad declaration in it must still come back as a named line.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gatedir-'));
  try {
    fs.writeFileSync(path.join(dir, 'broken.mjs'), 'export const declaration = { id: 7 };\n');
    const res = manifestCheck(dir);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /broken\.mjs: `id` must be/);
    assert.doesNotMatch(res.stdout + res.stderr, /at Object\.|at async |node:internal/, 'a stack trace reached the user');
  } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
});

// ------------------------------------------------------- I44: a cited check cannot be unwired

test('every claim in the tree cites a wired check, and the walker states its own denominator (I44)', () => {
  const res = manifestCheck(GATE);
  assert.equal(res.code, 0, res.stdout + res.stderr);
  const m = /^gate_claims: (\d+) of (\d+) /m.exec(res.stdout);
  assert.ok(m, `no gate_claims proof line in:\n${res.stdout}`);
  assert.equal(m[1], '0');
  // POSITIVE CONTROL: a walker that found nothing must be distinguishable from one that found
  // nothing wrong. The denominator is the claims actually walked, and it is not zero.
  assert.ok(Number(m[2]) >= 6, `the walker only saw ${m[2]} claim(s) — a near-empty claims list passes vacuously`);
});

test('RED CHECK: unwiring a check while a claim cites it is red; removing the claim is green (I44)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-'));
  try {
    fs.writeFileSync(path.join(tmp, 'r.md'), 'The register check\nblocks every commit.\n');
    const claim = { file: 'r.md', quote: 'The register check blocks every commit.' };
    const wired = [{ id: 'register_check', wired: true, claims: [claim] }];
    let out = walkClaims(wired, tmp);
    assert.deepEqual(out.failures, []);
    assert.equal(out.walked.length, 1, 'the walker must have actually walked the claim');

    const unwired = [{ id: 'register_check', wired: false, claims: [claim] }];
    out = walkClaims(unwired, tmp);
    assert.equal(out.failures.length, 1, 'unwiring a cited check must be red');
    assert.match(out.failures[0], /register_check is declared `wired: false`/);
    assert.match(out.failures[0], /r\.md/);

    const amended = [{ id: 'register_check', wired: false, claims: [] }];
    out = walkClaims(amended, tmp);
    assert.deepEqual(out.failures, [], 'with the claim amended away, the unwiring is allowed');
    assert.equal(out.walked.length, 0);
  } finally { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }); }
});

test('a claim whose text is gone is red — the claims list cannot rot into a list of phantoms (I44)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-'));
  try {
    fs.writeFileSync(path.join(tmp, 'r.md'), 'nothing of the sort\n');
    const out = walkClaims([{ id: 'register_check', wired: true, claims: [{ file: 'r.md', quote: 'blocks every commit' }] }], tmp);
    assert.equal(out.failures.length, 1);
    assert.match(out.failures[0], /no longer carries/);
    const gone = walkClaims([{ id: 'register_check', wired: true, claims: [{ file: 'nope.md', quote: 'x' }] }], tmp);
    assert.match(gone.failures[0], /does not exist/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }); }
});

test('the unwired citation check carries its ruling and cites nothing (#29, I44)', async () => {
  const { declarations } = await loadDeclarations(GATE);
  const d = declarations.find((x) => x.id === 'citation_target');
  assert.equal(d.wired, false);
  assert.match(d.reason, /#29/);
  assert.deepEqual([...d.claims], [], 'an unwired check must have no surviving claim');
});

// ------------------------------------------------------------------ the manifest is the whole truth

test('sweep_guard is a declared non-blocking check: it speaks, and the commit still passes (I43)', () => {
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(r.root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(r.root, 'docs', 'a.md'), 'x');
    fs.writeFileSync(path.join(r.root, 'stray.tmp'), 'oops');
    execFileSync('git', ['add', '-A'], { cwd: r.root });
    const res = runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.match(res.stdout, /ADVISORY: sweep-guard denominator: /, 'the advisory really had something to say');
    assert.equal(res.code, 0, 'a non-blocking check must not change the exit code');
  } finally { r.cleanup(); }
});
