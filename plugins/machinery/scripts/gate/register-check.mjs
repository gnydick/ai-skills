import path from 'node:path';
import { pending } from '../lib/inbox.mjs';
import { generateIndexFrom } from '../lib/index.mjs';
import { report } from '../lib/report.mjs';
import { git, gitRaw } from '../lib/git.mjs';

// The gate's composition is generated from this (ticket #73, I43), and every claim listed here is
// walked by the build check, which refuses to let this check be marked `wired: false` while any of
// them still stands (I44). Add a claim when you write one; amend the claim before unwiring.
export const declaration = Object.freeze({
  id: 'register_check',
  run: 'registerCheck',
  blocking: true,
  wired: true,
  claims: Object.freeze([
    { file: 'plugins/machinery/rules/rule-governance.md', quote: 'An undispositioned inbox entry fails the register check.' },
    { file: 'plugins/machinery/rules/rule-governance.md', quote: 'Run the governance check on every commit' },
    { file: 'docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md', quote: 'The index cannot be hand-edited into acceptance. | Gate compares staged index to regeneration.' },
    { file: 'docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md', quote: 'Every executed check reports a denominator.' },
    { file: 'combine-projects-machinery/union/plugin/gates/commit-gate.md', quote: '**Check one, the register check, cheap mode. Blocks.**' },
  ]),
});

const toPosix = (p) => p.split(path.sep).join('/');
const posixBasename = (p) => p.split('/').pop();

// The STAGED rule files under rulesDir, read from the git index — not the working tree
// (spec I28: partial staging must not slip an index past what's actually being committed).
function stagedRuleEntries(root, rulesDir) {
  const rel = toPosix(path.relative(root, rulesDir));
  const ls = git(['ls-files', '--cached', '--', rel], root);
  if (ls.code !== 0) throw new Error(`git ls-files failed: ${ls.stderr}`);
  // NON-RECURSIVE, to agree exactly with generateIndex()'s readdirSync (lib/index.mjs). `git
  // ls-files` walks subdirectories and readdirSync does not, and Claude Code auto-loads
  // subdirectories of .claude/rules/, so a user can put a .md in one. While the two readers
  // disagreed, that file made this check permanently red against an index no generator can produce
  // — and /machinery:reindex, the remedy the failure message names, could not fix it. One fact,
  // one derivation (rules/design-invariants.md § Never re-derive a fact).
  const depth = rel === '' || rel === '.' ? 0 : rel.split('/').length;
  const files = ls.stdout.split('\n')
    .filter((f) => f && f.endsWith('.md') && f.split('/').length === depth + 1)
    .sort();
  return files.map((f) => {
    // `:./<path>` resolves relative to cwd (root); plain `:<path>` resolves relative to the
    // git top level, which breaks when root is itself a subdirectory of the enclosing repo
    // (e.g. the universal plugin checkout nested inside a monorepo). Untrimmed (final review
    // A2): a rule file's own leading/trailing blank lines are real content for its parser.
    const show = gitRaw(['show', `:./${f}`], root);
    if (show.code !== 0) throw new Error(`git show :./${f} failed: ${show.stderr}`);
    return { name: posixBasename(f), text: show.stdout };
  });
}

// The STAGED index file's content, or null when nothing is staged there.
function stagedIndex(root, indexFile) {
  const rel = toPosix(path.relative(root, indexFile));
  const r = gitRaw(['show', `:./${rel}`], root);
  return r.code === 0 ? r.stdout : null;
}

// {rulesDir, inbox, index, root} → true if it passes. Never writes (spec I23).
// The index is compared against a regeneration from the STAGED rule files, not the working
// tree (spec I28, I2): the index must never disagree with the rule files being committed.
export function registerCheck({ rulesDir, inbox, index, legacyIndex, root }) {
  let ok = true;
  let pend = [];
  try { pend = pending(inbox); } catch (e) { report('register_check', 1, 1, `inbox malformed — ${e.message}`); return false; }
  report('register_check', pend.length, pend.length, `pending inbox entr${pend.length === 1 ? 'y' : 'ies'} (must be 0)`);
  if (pend.length) ok = false;
  let staged;
  try { staged = stagedRuleEntries(root, rulesDir); }
  catch (e) { report('register_check', 1, 1, `rule files: ${e.message}`); return false; }
  // Both sides trimmed consistently at the comparison (final review A2): gitRaw() above is
  // untrimmed for line-accurate blobs; a written index always carries a trailing newline that
  // a fresh regeneration's own .trim() would otherwise disagree with.
  const curRaw = stagedIndex(root, index);
  const cur = curRaw === null ? null : curRaw.trim();
  // #81: a project installed before the rename carries the old index name. The gate never writes
  // (spec I23), so it cannot migrate — but "index not staged, git add it" would send the user to
  // stage a file the rename made obsolete, and the register check would then be permanently red for
  // a reason its own message denies. Name the migration instead, with the same denominator.
  const legacy = legacyIndex ? stagedIndex(root, legacyIndex) : null;
  if (cur === null && legacy !== null) {
    const from = path.relative(process.cwd(), legacyIndex) || legacyIndex;
    const to = path.relative(process.cwd(), index) || index;
    report('register_check', 1, 1, `index comparison(s) failed — ${from} is the pre-#81 name; the index is now ${to}. Run /machinery:install to migrate it (it renames the file and stages both sides)`);
    return false;
  }
  if (staged.length === 0 && cur === null) {
    // Final review A1: nothing under rulesDir and no index are staged — nothing being
    // committed can disagree with anything, so there is nothing to check.
    report('register_check', 0, 0, 'index rows (nothing staged under rules or the index)');
    return ok;
  }
  const fresh = generateIndexFrom(staged).trim();
  // One index is compared, so the denominator is 1 either way. Before #73 both failure branches
  // wrote their diagnostic straight to stdout, so a gate failure could arrive with no denominator at
  // all — against rules/tool-output.md § Proof lines and denominators, and against this check's own
  // I25 claim. Every path out of here now goes through report().
  const where = path.relative(process.cwd(), index) || index;
  if (cur === null) {
    report('register_check', 1, 1, `index comparison(s) failed — index not staged (generated but not added) — git add ${where}`);
    ok = false;
  } else if (cur !== fresh) {
    report('register_check', 1, 1, `index comparison(s) failed — index is stale — ${where} differs from a fresh regeneration; run /machinery:reindex`);
    ok = false;
  } else {
    report('register_check', 0, 1, 'index comparison(s) failed');
  }
  return ok;
}
