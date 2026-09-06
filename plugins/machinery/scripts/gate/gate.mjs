#!/usr/bin/env node
// Story: gates/commit-gate.md. Runs on EVERY commit (ruled), check-only, cheap.
// The check list is a closed array (spec I24): nothing can extend it.
// The citation-target check is unwired (#29; owner, 2026-09-05: "let's unwire citation audit and
// gating" — citations are to anchor on a symbol name, never a line number, so the line-and-heading
// validator is the wrong mechanism, and it is removed rather than repaired). Nothing validates
// citations at commit or merge time. ./citation-target.mjs still ships beside this file, imported by
// nothing here, for a future sweep tool; test/gate.test.mjs keeps it measured through a driver.
import path from 'node:path';
import { registerCheck } from './register-check.mjs';
import { sweepGuard } from './sweep-guard.mjs';
import { projectRoot } from '../lib/root.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const universal = argv.includes('--universal');
const mergeMode = argv.includes('--merge');
const root = opt('--root') ? path.resolve(opt('--root')) : projectRoot(process.cwd());

const layout = universal
  ? { rulesDir: path.join(root, 'rules'), inbox: path.join(root, 'inbox.md'), index: path.join(root, 'register', 'INDEX.md') }
  : { rulesDir: path.join(root, '.claude', 'rules'), inbox: path.join(root, '.claude', 'machinery', 'inbox.md'), index: path.join(root, '.claude', 'machinery', 'INDEX.md') };

const CHECKS = Object.freeze([
  () => registerCheck({ ...layout, root }),
]);
let ok = true;
// The loop still awaits each check: registerCheck is sync and awaiting a plain boolean is harmless,
// and the async shape (from the #19 streaming leg) is kept so a future leg slots into the closed list
// without changing the loop. `--merge` is still parsed above for the same reason: the only leg that
// read mergeMode is unwired, and the flag stays part of the gate's surface for the merge step.
for (const check of CHECKS) { try { if (!(await check())) ok = false; } catch (e) { process.stdout.write(`gate: a check could not run — ${e.message}\n`); ok = false; } }
sweepGuard({ root });
if (!ok) process.stdout.write('commit gate FAILED (see lines above). Commit rejected. Bypass only for a genuine emergency: `git commit --no-verify`; twice means the checker is wrong — fix the checker.\n');
process.exitCode = ok ? 0 : 1;
