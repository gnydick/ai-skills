import path from 'node:path';
import fs from 'node:fs';
import { parseInbox } from '../lib/inbox.mjs';
import { generateSpecIndexFrom } from '../lib/index.mjs';
import { report } from '../lib/report.mjs';
import { git, gitRaw } from '../lib/git.mjs';
import { filedPath, insideSpecArea } from '../lib/layout.mjs';

// Ticket #81. Before this, a specification dictated with SPEC: was captured by nothing, addressed to
// a location no code could resolve, and blocked nothing — rung 0, and the symptom the owner reported
// (other projects not treating the location as durable) is what rung 0 looks like from outside. This
// leg is the third part: a pending spec entry blocks, and a disposition naming a path outside the
// project's spec area is refused.
//
// The honest limit, restated so nobody claims more later: WHICH specification file owns a given
// subsystem is a judgement no check can make. What is mechanised here is that a filed path lives
// under the declared spec area, and that nothing stays pending.
//
// Every claim listed below is walked by the build check, which refuses to let this check be marked
// `wired: false` while any of them still stands (I44). Add a claim when you write one.
export const declaration = Object.freeze({
  id: 'spec_check',
  run: 'specCheck',
  blocking: true,
  wired: true,
  claims: Object.freeze([
    { file: 'plugins/machinery/rules/work-tracking.md', quote: 'An undispositioned spec entry blocks commits, exactly as an undispositioned rule entry does' },
    { file: 'plugins/machinery/rules/work-tracking.md', quote: 'the gate refuses a disposition naming a path outside that area' },
    { file: 'plugins/machinery/README.md', quote: 'An undispositioned spec entry blocks the commit' },
  ]),
});

const toPosix = (p) => p.split(path.sep).join('/');
const posixBasename = (p) => p.split('/').pop();

// What is STAGED under the spec area and at the spec index, read from the git index rather than the
// working tree (spec I28), so partial staging cannot slip an index past what is actually being
// committed. ONE `ls-files` covers both paths and decides whether the index is staged at all, so
// the overwhelmingly common case — a project with no specifications — costs a single git call
// rather than one per path. The gate runs on every commit; its cost is the suite's cost too.
function stagedSpecTree(root, specsDir, specIndex) {
  const specsRel = toPosix(path.relative(root, specsDir));
  const indexRel = toPosix(path.relative(root, specIndex));
  // The index lives inside the spec area, so one pathspec covers both — and this is the only git
  // call the leg makes in the overwhelmingly common case of a project with no specifications. The
  // gate runs on every commit; its cost is the test suite's cost too.
  const ls = git(['ls-files', '--cached', '--', specsRel], root);
  if (ls.code !== 0) throw new Error(`git ls-files failed: ${ls.stderr}`);
  const listed = ls.stdout.split('\n').filter(Boolean);
  const read = (f) => {
    const show = gitRaw(['show', `:./${f}`], root);
    if (show.code !== 0) throw new Error(`git show :./${f} failed: ${show.stderr}`);
    return show.stdout;
  };
  // NON-RECURSIVE, to agree exactly with generateSpecIndex()'s readdirSync — `git ls-files` walks
  // subdirectories and readdirSync does not. This is the same disagreement register-check carried
  // until #81 found it: two readers of one fact, and the one that sees more makes the check red
  // against an index no generator can produce.
  const depth = specsRel === '' || specsRel === '.' ? 0 : specsRel.split('/').length;
  const specs = listed
    .filter((f) => f !== indexRel && f.endsWith('.md') && f.split('/').length === depth + 1)
    .sort().map((f) => ({ name: posixBasename(f), text: read(f) }));
  return { specs, index: listed.includes(indexRel) ? read(indexRel) : null };
}

// {specsDir, specInbox, specIndex, root} → true if it passes. Never writes (spec I23), which is why
// it names a missing spec area rather than creating one.
export function specCheck({ specsDir, specInbox, specIndex, root }) {
  let ok = true;
  let entries = [];
  try { entries = fs.existsSync(specInbox) ? parseInbox(fs.readFileSync(specInbox, 'utf8')) : []; }
  catch (e) { report('spec_check', 1, 1, `spec inbox malformed — ${e.message}`); return false; }

  const pend = entries.filter((e) => e.state === 'PENDING');
  report('spec_check', pend.length, entries.length, `spec inbox entr${entries.length === 1 ? 'y' : 'ies'} undispositioned (must be 0)`);
  if (pend.length) ok = false;

  // There is deliberately no "spec area missing" leg. The location is FIXED and known — owner,
  // 2026-09-07: "we just need a unique location to persist those specs", then "i don't want specs
  // under .claude/rules i want docs/dicatated-specs" — so there is no declaration to be absent and
  // nothing for a project to get wrong. A docs/dictated-specs that does not exist yet is a project
  // that has filed no specification, not a misconfiguration.
  const filed = entries.filter((e) => e.state === 'FILED');
  const outside = filed.filter((e) => { const p = filedPath(e.disposition); return p === null || !insideSpecArea(root, specsDir, p); });
  report('spec_check', outside.length, filed.length, `filed spec path(s) outside ${toPosix(path.relative(root, specsDir))}/`);
  for (const e of outside) process.stdout.write(`  ${e.stamp}: ${e.disposition} — a specification is filed under ${toPosix(path.relative(root, specsDir))}/ or nowhere\n`);
  if (outside.length) ok = false;

  let tree;
  try { tree = stagedSpecTree(root, specsDir, specIndex); }
  catch (e) { report('spec_check', 1, 1, `spec files: ${e.message}`); return false; }
  const staged = tree.specs;
  const cur = tree.index === null ? null : tree.index.trim();
  if (staged.length === 0 && cur === null) {
    report('spec_check', 0, 0, 'spec index rows (nothing staged under specs or the spec index)');
    return ok;
  }
  const where = path.relative(process.cwd(), specIndex) || specIndex;
  const fresh = generateSpecIndexFrom(staged).trim();
  if (cur === null) {
    report('spec_check', 1, 1, `spec index comparison(s) failed — spec index not staged (generated but not added) — git add ${where}`);
    ok = false;
  } else if (cur !== fresh) {
    report('spec_check', 1, 1, `spec index comparison(s) failed — spec index is stale — ${where} differs from a fresh regeneration; run /machinery:reindex`);
    ok = false;
  } else {
    report('spec_check', 0, 1, 'spec index comparison(s) failed');
  }
  return ok;
}
