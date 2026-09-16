// The regression guard's own tests (#110). Tier: fast.
//
// The load-bearing ones are the RED CHECKS. A guard that cannot be made to fail is not a guard, and
// this whole campaign began because a check reported a clean pass over a population that excluded
// the failure — so the first thing proven here is that this one goes red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verify, load, proofLine, report, LEDGER } from '../rule-ledger.mjs';

// A throwaway tree, so every red check runs against a fixture rather than against this repository.
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-ledger-'));
  for (const [rel, body] of Object.entries(files)) {
    const f = path.join(root, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body, 'utf8');
  }
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('every protected requirement in the shipped ledger is still present', () => {
  const result = verify();
  assert.deepEqual(result.failures, [], report(result).join('\n'));
  assert.equal(proofLine(result), `rule_ledger: 0 of ${result.checked} protected requirement(s) missing or inverted`);
});

test('the ledger is not empty, and its denominator is every entry', () => {
  const ledger = load();
  assert.ok(ledger.entries.length >= 40, `expected the 2026-09 restorations to be protected, got ${ledger.entries.length}`);
  assert.equal(verify().checked, ledger.entries.length, 'the check must report every entry as its denominator');
});

test('every entry names a file that exists and carries at least one assertion', () => {
  for (const e of load().entries) {
    assert.ok(e.id, 'an entry has no id');
    assert.ok(e.must || e.mustNot, `${e.id} asserts nothing — it would pass vacuously`);
    assert.ok(e.why, `${e.id} has no reason recorded; a future reader cannot judge whether a change is legitimate`);
    assert.ok(fs.existsSync(path.join(path.dirname(LEDGER), '..', e.file)), `${e.id} points at a file that does not exist: ${e.file}`);
  }
});

test('RED CHECK: deleting a protected requirement fails, and the message names it', () => {
  const f = fixture({ 'rules.md': 'nothing of interest here' });
  try {
    const ledger = { entries: [{ id: 'X1', file: 'rules.md', must: 'honesty wins', why: 'the tie-break' }] };
    const result = verify({ root: f.root, ledger });
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].kind, 'requirement-gone');
    assert.match(report(result).join('\n'), /X1 — rules\.md no longer contains: "honesty wins"/);
    assert.match(report(result).join('\n'), /why it is protected: the tie-break/);
    assert.match(report(result).join('\n'), /edit scripts\/rule-ledger\.json in this commit/);
  } finally { f.cleanup(); }
});

test('RED CHECK: an inversion returning fails even though the required phrase is present', () => {
  // The case a naive presence check cannot see, and the one that actually happened: core.md kept the
  // word "cite" while an inserted "only" forbade the venue its source permits.
  const f = fixture({ 'rules.md': 'cite it only in specs, and in research documents' });
  try {
    const ledger = { entries: [{ id: 'X2', file: 'rules.md', must: 'research documents', mustNot: 'cite it only in specs', why: 'an inserted only inverted the rule' }] };
    const result = verify({ root: f.root, ledger });
    assert.equal(result.failures.length, 1, 'the must matched, so only the mustNot should fail');
    assert.equal(result.failures[0].kind, 'inversion-returned');
    assert.match(report(result).join('\n'), /contains the forbidden form/);
  } finally { f.cleanup(); }
});

test('RED CHECK: a protected file that disappears fails as its own kind', () => {
  const f = fixture({ 'other.md': 'x' });
  try {
    const result = verify({ root: f.root, ledger: { entries: [{ id: 'X3', file: 'gone.md', must: 'anything', why: 'w' }] } });
    assert.equal(result.failures[0].kind, 'file-missing');
  } finally { f.cleanup(); }
});

test('RED CHECK: an empty ledger refuses instead of passing vacuously', () => {
  const f = fixture({ 'ledger.json': JSON.stringify({ entries: [] }) });
  try {
    assert.throws(() => load(path.join(f.root, 'ledger.json')), /not a passing check/);
  } finally { f.cleanup(); }
});
