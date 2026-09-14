#!/usr/bin/env node
// The tier dispatcher this repo's recorded tiers run (STATUS 53; .claude/machinery/config.json).
// `tiers.mjs fast` fills `<components>` with the names of the touched components as one string
// substitution, so config.json cannot say a different command per component: this script maps
// each name to its suite and runs the touched suites in one `node --test`.
//
//   test-tier.mjs fast <component…>   the named components' suites
//   test-tier.mjs merge               the build check, then every suite
//
// Exit codes: 0 every step passed; 1 a step failed or a name has no suite (named on stderr);
// 2 usage. Steps run in order and stop at the first failure; the count line states its
// denominator so a pass for a bad reason cannot hide behind a bare pass.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: test-tier.mjs fast <component…> | merge';

// Component name (as recorded under `components` in config.json) → the glob its suite lives at.
// scripts/test/repo-hooks.test.mjs fails when this table and the recorded components drift apart.
export const SUITES = Object.freeze({
  machinery: 'plugins/machinery/test/*.test.mjs',
  build: 'scripts/test/*.test.mjs',
});
export const CHECK = Object.freeze(['scripts/build-skills.mjs', 'check']);

// The node argument lists to run, in order.
export function plan(tier, components) {
  if (tier === 'fast') {
    if (!components.length) throw new Error('test-tier.mjs fast: no components named — tiers.mjs fills <components> with the touched components');
    const unknown = components.filter((c) => !(c in SUITES));
    if (unknown.length) throw new Error(`test-tier.mjs: unknown component(s) ${unknown.join(', ')} — known: ${Object.keys(SUITES).join(', ')}; keep SUITES in step with components in .claude/machinery/config.json`);
    return [['--test', ...components.map((c) => SUITES[c])]];
  }
  if (tier === 'merge') {
    if (components.length) throw new Error('test-tier.mjs: merge takes no components — it runs every suite');
    return [CHECK, ['--test', ...Object.values(SUITES)]];
  }
  throw new Error(USAGE);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [tier, ...components] = process.argv.slice(2);
  let steps;
  try { steps = plan(tier, components); }
  catch (e) { process.stderr.write(`${e.message}\n`); process.exit(e.message === USAGE ? 2 : 1); }
  let passed = 0;
  for (const args of steps) {
    if ((spawnSync(process.execPath, args, { cwd: REPO, stdio: 'inherit' }).status ?? 1) !== 0) break;
    passed += 1;
  }
  process.stdout.write(`test_tier: ${passed} of ${steps.length} steps passed (${tier}${components.length ? ': ' + components.join(', ') : ''})\n`);
  process.exit(passed === steps.length ? 0 : 1);
}
