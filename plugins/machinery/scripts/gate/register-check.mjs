import fs from 'node:fs';
import path from 'node:path';
import { pending } from '../lib/inbox.mjs';
import { generateIndex, readIndex } from '../lib/index.mjs';
import { report } from '../lib/report.mjs';

// {rulesDir, inbox, index} → true if it passes. Never writes (spec I23).
export function registerCheck({ rulesDir, inbox, index }) {
  let ok = true;
  let pend = [];
  try { pend = pending(inbox); } catch (e) { report('register_check', 1, 1, `inbox malformed — ${e.message}`); return false; }
  report('register_check', pend.length, pend.length, `pending inbox entr${pend.length === 1 ? 'y' : 'ies'} (must be 0)`);
  if (pend.length) ok = false;
  let fresh;
  try { fresh = fs.existsSync(rulesDir) ? generateIndex(rulesDir) : null; }
  catch (e) { report('register_check', 1, 1, `rule files: ${e.message}`); return false; }
  const cur = readIndex(index);
  if (fresh !== null && cur !== fresh) { process.stdout.write(`register_check: index is stale — ${path.relative(process.cwd(), index) || index} differs from a fresh regeneration; run /machinery:reindex\n`); ok = false; }
  return ok;
}
