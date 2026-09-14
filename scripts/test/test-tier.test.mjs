// Tests for scripts/test-tier.mjs — the dispatcher this repo's recorded tiers run (STATUS 53):
// `tiers.mjs fast` fills `<components>` with names, one string substitution, so a per-component
// command cannot be expressed in config.json; this script maps each name to its suite and runs
// them in one `node --test`. Every case here reads the plan; only the refusal case spawns the
// real CLI, with a name no suite has, so no suite ever runs from inside this suite.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SUITES, CHECK, plan } from '../test-tier.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'test-tier.mjs');

// The count line this file owes its own output (proof lines and denominators): node --test's
// `# pass N` summary is not the declared proof format and gets compressed away.
let registered = 0, passed = 0;
const check = (name, fn) => { registered++; test(name, async (t) => { await fn(t); passed++; }); };
after(() => console.log(`test_tier_tests: ${passed} of ${registered} test(s) passed`));

check('fast runs the named components\' suites in one node --test', () => {
  assert.deepEqual(plan('fast', ['machinery']), [['--test', SUITES.machinery]]);
  assert.deepEqual(plan('fast', ['machinery', 'build']), [['--test', SUITES.machinery, SUITES.build]]);
});

check('fast with no component refuses: tiers.mjs fills <components>, and an empty fill is a wiring fault', () => {
  assert.throws(() => plan('fast', []), /no components named/);
});

check('RED CHECK: a component no suite is mapped to is refused by name, with the known names', () => {
  assert.throws(() => plan('fast', ['machinery', 'nope']), /unknown component\(s\) nope — known: machinery, build/);
});

check('merge runs the build check first, then every suite', () => {
  assert.deepEqual(plan('merge', []), [CHECK, ['--test', ...Object.values(SUITES)]]);
  assert.throws(() => plan('merge', ['machinery']), /merge takes no components/);
});

check('an unknown tier is refused', () => {
  assert.throws(() => plan('heavy', []), /usage: test-tier\.mjs fast <component…> \| merge/);
});

check('the CLI refuses an unknown component non-zero, naming it, before any suite runs', () => {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k];
  const run = spawnSync(process.execPath, [SCRIPT, 'fast', 'nope'], { cwd: REPO, env, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /unknown component\(s\) nope/);
  assert.doesNotMatch(run.stdout, /test_tier: \d+ of \d+ steps passed/, 'it must not print a step count for steps it never planned');
});
