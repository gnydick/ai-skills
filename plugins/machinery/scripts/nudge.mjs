#!/usr/bin/env node
// Story: hooks/rule-nudge.md. Advisory; any failure is silence.
import path from 'node:path';
import { readPayload } from './lib/stdin.mjs';
import { context } from './lib/emit.mjs';
import { projectRoot } from './lib/root.mjs';
import { projectRules, projectIndex, projectInbox, rulesSource, universalIndex, universalInbox } from './lib/config.mjs';
import { generateIndex, readIndex } from './lib/index.mjs';

function main() {
  const p = readPayload();
  const file = p?.tool_input?.file_path;
  if (!file) return;
  const abs = path.resolve(file);
  const inside = (dir) => abs.toLowerCase().startsWith(path.resolve(dir).toLowerCase() + path.sep);
  const targets = [];
  try { const root = projectRoot(p.cwd || process.cwd()); if (inside(projectRules(root)) || abs === path.resolve(projectInbox(root))) targets.push({ rules: projectRules(root), index: projectIndex(root) }); } catch {}
  const src = rulesSource();
  if (inside(src) || abs === path.resolve(universalInbox())) targets.push({ rules: src, index: universalIndex() });
  for (const t of targets) {
    if (readIndex(t.index) !== generateIndex(t.rules)) { context(`machinery: the index is stale after editing ${file} — intake regenerates it; or run /machinery:reindex`, 'PostToolUse'); return; }
  }
}
try { main(); } catch { /* silent */ }
process.exitCode = 0;
