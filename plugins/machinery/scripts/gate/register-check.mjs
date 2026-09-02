import path from 'node:path';
import { pending } from '../lib/inbox.mjs';
import { generateIndexFrom } from '../lib/index.mjs';
import { report } from '../lib/report.mjs';
import { git } from '../lib/git.mjs';

const toPosix = (p) => p.split(path.sep).join('/');
const posixBasename = (p) => p.split('/').pop();

// The STAGED rule files under rulesDir, read from the git index — not the working tree
// (spec I28: partial staging must not slip an index past what's actually being committed).
function stagedRuleEntries(root, rulesDir) {
  const rel = toPosix(path.relative(root, rulesDir));
  const ls = git(['ls-files', '--cached', '--', rel], root);
  if (ls.code !== 0) throw new Error(`git ls-files failed: ${ls.stderr}`);
  const files = ls.stdout.split('\n').filter((f) => f && f.endsWith('.md')).sort();
  return files.map((f) => {
    const show = git(['show', `:${f}`], root);
    if (show.code !== 0) throw new Error(`git show :${f} failed: ${show.stderr}`);
    return { name: posixBasename(f), text: show.stdout };
  });
}

// The STAGED index file's content, or null when nothing is staged there.
function stagedIndex(root, indexFile) {
  const rel = toPosix(path.relative(root, indexFile));
  const r = git(['show', `:${rel}`], root);
  return r.code === 0 ? r.stdout : null;
}

// {rulesDir, inbox, index, root} → true if it passes. Never writes (spec I23).
// The index is compared against a regeneration from the STAGED rule files, not the working
// tree (spec I28, I2): the index must never disagree with the rule files being committed.
export function registerCheck({ rulesDir, inbox, index, root }) {
  let ok = true;
  let pend = [];
  try { pend = pending(inbox); } catch (e) { report('register_check', 1, 1, `inbox malformed — ${e.message}`); return false; }
  report('register_check', pend.length, pend.length, `pending inbox entr${pend.length === 1 ? 'y' : 'ies'} (must be 0)`);
  if (pend.length) ok = false;
  let fresh;
  try { fresh = generateIndexFrom(stagedRuleEntries(root, rulesDir)).trim(); }
  catch (e) { report('register_check', 1, 1, `rule files: ${e.message}`); return false; }
  const cur = stagedIndex(root, index);
  if (cur !== fresh) { process.stdout.write(`register_check: index is stale — ${path.relative(process.cwd(), index) || index} differs from a fresh regeneration; run /machinery:reindex\n`); ok = false; }
  return ok;
}
