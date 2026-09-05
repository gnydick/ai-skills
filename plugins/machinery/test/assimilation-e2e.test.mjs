// End-to-end proof for the tool-assimilation plan: the measurement that opened the design spec
// (docs/superpowers/specs/2026-09-04-tool-assimilation-design.md, "The problem") is reproduced
// here, then taken again with decide() behind classify()'s 'plain' result, exactly as quiet.mjs
// wires it. The spec measured 6 of 10 silently unfiltered; this file asserts that number as the
// "before" and 0 as the "after", so the closing proof cannot pass vacuously.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../scripts/lib/classify.mjs';
import { decide } from '../scripts/lib/assimilate.mjs';

// The exact ten commands the spec measured, verbatim and in its order.
const COMMANDS = [
  'cargo test --workspace',
  'bash scripts/battery.sh',
  'bash scripts/merge-gate.sh',
  'scripts/testq.sh --workspace',
  'bash scripts/perf.sh',
  'bash scripts/prove-gcode-identical.sh HEAD~1',
  'python scripts/oracle_compare.py',
  'python scripts/register_check_test.py',
  'gh issue view 854',
  'git commit -m x',
];

// The spec's own list of the six that fell through. This is the expectation side: it comes from
// the spec's measurement, not from running classify() today.
const SPEC_PLAIN = [
  'bash scripts/battery.sh',
  'bash scripts/merge-gate.sh',
  'scripts/testq.sh --workspace',
  'bash scripts/perf.sh',
  'bash scripts/prove-gcode-identical.sh HEAD~1',
  'python scripts/oracle_compare.py',
];

// Mirrors quiet.mjs main(): decide() is consulted for exactly one classify() result, 'plain'.
// 'infra' and 'noisy' were wrapped before this plan existed, and 'read' (like 'piped' and
// 'redirected') never reaches the assimilator there either. Gating on anything wider would
// exercise a path the hook does not have.
function silentlyUnobserved(observations) {
  const rows = [];
  for (const cmd of COMMANDS) {
    const kind = classify(cmd);
    if (kind !== 'plain') { rows.push({ cmd, kind, decided: null }); continue; }
    const d = decide(cmd, { catalog: {}, observations });
    rows.push({ cmd, kind, decided: d });
  }
  const silent = rows.filter((r) => r.decided && r.decided.mode === 'plain');
  return { rows, silent };
}

test('before: classify() alone leaves exactly the six the spec measured as plain (unfiltered)', () => {
  const plain = COMMANDS.filter((cmd) => classify(cmd) === 'plain');
  console.log(`classify: ${plain.length} of ${COMMANDS.length} fall through as plain (unfiltered)`);
  assert.deepEqual(plain, SPEC_PLAIN);
  // The other four land where the pre-plan classifier put them; none of these ever reach decide().
  assert.equal(classify('cargo test --workspace'), 'noisy');
  assert.equal(classify('python scripts/register_check_test.py'), 'noisy');
  assert.equal(classify('gh issue view 854'), 'read');
  assert.equal(classify('git commit -m x'), 'infra');
});

test('after: nothing plain-classified is left silently unobserved once the assimilator is consulted', () => {
  // Empty catalog and empty observations: none of the ten is a catalog tool, so this proves the
  // BESPOKE floor (an unknown tool is observed, never assumed quiet), not suggestion behaviour.
  const { rows, silent } = silentlyUnobserved({});
  for (const r of rows) console.log(`  ${r.kind.padEnd(6)} ${r.decided ? `-> ${r.decided.mode}/${r.decided.identity}` : '   (not consulted)'}  ${r.cmd}`);
  console.log(`assimilation_coverage: ${silent.length} of ${COMMANDS.length} commands still silently unobserved (must be 0)`);
  assert.equal(silent.length, 0);
  // Not merely "not plain": with no record the only honest state is observe, and each is bespoke.
  const consulted = rows.filter((r) => r.decided);
  assert.deepEqual(consulted.map((r) => r.cmd), SPEC_PLAIN);
  for (const r of consulted) {
    assert.equal(r.decided.mode, 'observe', r.cmd);
    assert.equal(r.decided.identity, 'bespoke', r.cmd);
  }
});

test('RED CHECK: the counter can see a silent one', () => {
  // A record saying the tool was watched here and was quiet is decide()'s legitimate 'plain' state
  // ("seen here, and it was quiet"). It is used only to prove the instrument counts a 'plain' from
  // decide(): a counter that read 0 above because it could never read anything else is no proof.
  const { silent } = silentlyUnobserved({ 'bash scripts/perf.sh': { noisy: false, ledger: {} } });
  assert.equal(silent.length, 1);
  assert.equal(silent[0].cmd, 'bash scripts/perf.sh');
});
