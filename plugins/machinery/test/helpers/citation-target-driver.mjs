// Test-only driver for scripts/gate/citation-target.mjs. The gate no longer runs that check
// (#29, owner ruling 2026-09-05: citations anchor on a symbol name, never a line number, so the
// line-and-heading validator is the wrong mechanism — unwired, not repaired), but the module
// still ships for a future sweep tool, so its behaviour stays measured through this entry point
// with the same `--root` / `--merge` surface the gate used to give it. Runs under runScript, so
// its stdout and exit code are what the tests read; the wrapper line is named for the driver,
// not the gate, because the gate is not what ran.
import path from 'node:path';
import { citationTarget } from '../../scripts/gate/citation-target.mjs';

const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const root = i >= 0 ? path.resolve(argv[i + 1]) : process.cwd();
const mergeMode = argv.includes('--merge');
try { process.exitCode = (await citationTarget({ root, mergeMode })) ? 0 : 1; }
catch (e) { process.stdout.write(`citation-target driver: the check could not run — ${e.message}\n`); process.exitCode = 1; }
