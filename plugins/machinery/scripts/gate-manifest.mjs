#!/usr/bin/env node
// Regenerates scripts/gate/manifest.mjs from the `declaration` each check module exports, and — with
// --check — proves the committed file is exactly that regeneration and that every claim shipped with
// a check still cites a wired one (ticket #73, invariants I43 and I44).
//
// It lives OUTSIDE scripts/gate/ on purpose: nothing under scripts/gate/ may write to the tree
// (spec I23, asserted by test/gate-purity.test.mjs), and this is a writer.
//
// Both legs print their own denominator (rules/tool-output.md § Proof lines and denominators), so a
// pass for a bad reason — an empty gate directory, an empty claims list — is visible rather than
// compressed away into a bare exit code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDeclarations, renderManifest, walkClaims, MANIFEST_FILE, NOT_A_CHECK } from './lib/manifest.mjs';
import { report } from './lib/report.mjs';

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const check = argv.includes('--check');
const gateDir = path.resolve(opt('--gate-dir', path.join(PLUGIN, 'scripts', 'gate')));
// The repository the claim paths are relative to. Passed in by the caller that knows it
// (scripts/build-skills.mjs, the test suite); the default is this plugin's own checkout.
const root = path.resolve(opt('--root', path.resolve(PLUGIN, '..', '..')));

const { declarations, problems } = await loadDeclarations(gateDir);
// The denominator is the CHECK modules considered — every .mjs under the gate directory but the
// runner and the generated manifest. A file that failed to import is counted here and missing from
// `declarations`, which is exactly the gap this leg exists to report.
const modules = fs.existsSync(gateDir) ? fs.readdirSync(gateDir).filter((f) => f.endsWith('.mjs') && !NOT_A_CHECK.includes(f)).length : 0;
for (const p of problems) process.stdout.write(`  ${p}\n`);

const fresh = renderManifest(declarations);
const file = path.join(gateDir, MANIFEST_FILE);
const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;

if (!check) {
  if (problems.length) {
    report('gate_manifest', problems.length, modules, 'gate module(s) undeclared or malformed — nothing written');
    process.exit(1);
  }
  fs.writeFileSync(file, fresh, 'utf8');
  report('gate_manifest', 0, modules, `gate module(s) undeclared or drifted — wrote ${path.relative(root, file).split(path.sep).join('/')}`);
  process.exit(0);
}

let drift = problems.length;
if (current === null) { process.stdout.write(`  ${MANIFEST_FILE} is missing — run: node plugins/machinery/scripts/gate-manifest.mjs\n`); drift += 1; }
else if (current !== fresh) { process.stdout.write(`  ${MANIFEST_FILE} is stale — it differs from a fresh regeneration; run: node plugins/machinery/scripts/gate-manifest.mjs\n`); drift += 1; }
report('gate_manifest', drift, modules, 'gate module(s) undeclared or drifted');

const { walked, failures } = walkClaims(declarations, root);
for (const f of failures) process.stdout.write(`  ${f}\n`);
report('gate_claims', failures.length, walked.length, 'claim(s) cite an unwired check or no longer exist');

process.exitCode = drift + failures.length ? 1 : 0;
