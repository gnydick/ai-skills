#!/usr/bin/env node
// Story: gates/commit-gate.md. Runs on EVERY commit (ruled), check-only, cheap.
//
// The check list is a closed array (spec I24): nothing can extend it at run time. Since #73 that
// array is GENERATED into ./manifest.mjs from the `declaration` each check module exports, and the
// build check regenerates and fails on drift — so a hand-edit is a stale generated file rather than
// a silent divergence, and there is still no configuration point of any kind. Every check the gate
// runs is in that one array, blocking and advisory alike: the manifest is the whole truth about
// what runs.
//
// The citation-target check is unwired (#29; owner, 2026-09-05: "let's unwire citation audit and
// gating" — citations are to anchor on a symbol name, never a line number, so the line-and-heading
// validator is the wrong mechanism, and it is removed rather than repaired). Nothing validates
// citations at commit or merge time. ./citation-target.mjs still ships in the PLUGIN for a future
// sweep tool, declared `wired: false` with that ruling, and test/gate.test.mjs keeps it measured
// through a driver — but it is no longer imported here and no longer installed into a project.
//
// `--merge` is declared surface with no reader: it is parsed and handed to every check in the
// context below, and no wired check reads it today (citation-target, unwired, was the only one).
// It stays because the merge step invokes the gate with it.
import path from 'node:path';
import { CHECKS } from './manifest.mjs';
import { projectRoot } from '../lib/root.mjs';
// File names come from the one place that spells them (#81). This module builds its own layout
// rather than importing lib/config.mjs because it ships standalone into an adopting project and
// must never point back at the plugin cache (spec I6) — but the NAMES are still declared once.
import { RULES_INDEX, LEGACY_RULES_INDEX, SPEC_INDEX, SPEC_INBOX, INBOX, RULES_DIR, DOCS_DIR, SPECS_DIR, MACHINERY_DIR, REGISTER_DIR } from '../lib/layout.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const universal = argv.includes('--universal');
const mergeMode = argv.includes('--merge');
const root = opt('--root') ? path.resolve(opt('--root')) : projectRoot(process.cwd());

// The spec half is the rule half's mirror (#81, owner ruling 2026-09-07: "make spec: work just like
// rules"): its own area, its own inbox, its own generated index, resolved the same way in both modes.
const layout = universal
  ? { rulesDir: path.join(root, RULES_DIR), inbox: path.join(root, INBOX), index: path.join(root, REGISTER_DIR, RULES_INDEX), legacyIndex: path.join(root, REGISTER_DIR, LEGACY_RULES_INDEX),
      specsDir: path.join(root, DOCS_DIR, SPECS_DIR), specInbox: path.join(root, SPEC_INBOX), specIndex: path.join(root, REGISTER_DIR, SPEC_INDEX) }
  : { rulesDir: path.join(root, '.claude', RULES_DIR), inbox: path.join(root, '.claude', MACHINERY_DIR, INBOX), index: path.join(root, '.claude', MACHINERY_DIR, RULES_INDEX), legacyIndex: path.join(root, '.claude', MACHINERY_DIR, LEGACY_RULES_INDEX),
      specsDir: path.join(root, DOCS_DIR, SPECS_DIR), specInbox: path.join(root, '.claude', MACHINERY_DIR, SPEC_INBOX), specIndex: path.join(root, '.claude', MACHINERY_DIR, SPEC_INDEX) };

// One context, handed to every check. Each check destructures what it needs, so the manifest can
// generate a uniform call and a new leg slots into the closed list without changing this loop.
const ctx = { ...layout, root, mergeMode };

let ok = true;
// The loop still awaits each check: registerCheck is sync and awaiting a plain boolean is harmless,
// and the async shape (from the #19 streaming leg) is kept so a future leg slots in unchanged.
// A NON-BLOCKING check cannot reach the exit code by any route — not by returning false, and not by
// throwing. Its failure to run is still said out loud, because silence reads as success.
for (const c of CHECKS) {
  try {
    const passed = await c.run(ctx);
    if (c.blocking && !passed) ok = false;
  } catch (e) {
    process.stdout.write(`gate: ${c.id} could not run — ${e.message}${c.blocking ? '' : ' (advisory; the commit is not blocked by it)'}\n`);
    if (c.blocking) ok = false;
  }
}
if (!ok) process.stdout.write('commit gate FAILED (see lines above). Commit rejected. Bypass only for a genuine emergency: `git commit --no-verify`; twice means the checker is wrong — fix the checker.\n');
process.exitCode = ok ? 0 : 1;
