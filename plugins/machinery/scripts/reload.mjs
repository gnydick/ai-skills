#!/usr/bin/env node
// /machinery:reload — puts the rule files into the running session's context (spec I14).
import fs from 'node:fs';
import path from 'node:path';
import { rulesSource, projectRules } from './lib/config.mjs';
import { projectRoot } from './lib/root.mjs';
const dirs = [['rules', rulesSource()]];
if (process.argv.includes('--project')) { try { dirs.push(['.claude/rules', projectRules(projectRoot(process.cwd()))]); } catch {} }
for (const [label, dir] of dirs) {
  if (!fs.existsSync(dir)) { process.stdout.write(`===== ${label} ===== (missing: ${dir})\n`); continue; }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) process.stdout.write(`===== ${label}/${f} =====\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n`);
}
