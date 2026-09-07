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

// What is STAGED under the spec area, at the spec index, and at the index's pre-move location, read
// from the git index rather than the working tree (spec I28), so partial staging cannot slip an
// index past what is actually being committed.
//
// The index no longer lives inside the spec area (owner, 2026-09-07: "just make consistency between
// where indexes live"), so it is a separate pathspec rather than a name filtered back out of the
// area's own listing. It is still ONE `ls-files` for all three paths: the overwhelmingly common case
// — a project with no specifications — costs a single git call, and the gate runs on every commit,
// so its cost is the test suite's cost too.
function stagedSpecTree(root, specsDir, specIndex, legacySpecIndex) {
  const specsRel = toPosix(path.relative(root, specsDir));
  const indexRel = toPosix(path.relative(root, specIndex));
  const legacyRel = legacySpecIndex ? toPosix(path.relative(root, legacySpecIndex)) : null;
  const ls = git(['ls-files', '--cached', '--', specsRel, indexRel, ...(legacyRel ? [legacyRel] : [])], root);
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
  //
  // Nothing is filtered out by name here, exactly as the generator filters nothing out by name: an
  // orphaned index left in the spec area by a project that has not re-run /machinery:install is a
  // file in that directory, and both readers see it as one. The migration leg below is what a
  // project in that state actually meets.
  const rootArea = specsRel === '' || specsRel === '.';
  const depth = rootArea ? 0 : specsRel.split('/').length;
  const inArea = (f) => rootArea || f.startsWith(specsRel + '/');
  const specs = listed
    .filter((f) => inArea(f) && f.endsWith('.md') && f.split('/').length === depth + 1)
    .sort().map((f) => ({ name: posixBasename(f), text: read(f) }));
  return {
    specs,
    index: listed.includes(indexRel) ? read(indexRel) : null,
    legacyIndex: legacyRel !== null && listed.includes(legacyRel) ? read(legacyRel) : null,
  };
}

// {specsDir, specInbox, specIndex, legacySpecIndex, root} → true if it passes. Never writes (spec
// I23), which is why it names a missing spec area rather than creating one.
export function specCheck({ specsDir, specInbox, specIndex, legacySpecIndex, root }) {
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
  try { tree = stagedSpecTree(root, specsDir, specIndex, legacySpecIndex); }
  catch (e) { report('spec_check', 1, 1, `spec files: ${e.message}`); return false; }
  const staged = tree.specs;
  const cur = tree.index === null ? null : tree.index.trim();
  // A project installed between #81 and the index move carries the index INSIDE the spec area. The
  // gate never writes (spec I23), so it cannot migrate — and "spec index not staged, git add it"
  // would send the user to add a file that does not exist yet while the old one sits in the spec
  // area being indexed as a specification. Name the migration instead, with the same denominator.
  // Same shape as register_check's leg for the pre-#81 rules index name.
  if (cur === null && tree.legacyIndex !== null) {
    const from = path.relative(process.cwd(), legacySpecIndex) || legacySpecIndex;
    const to = path.relative(process.cwd(), specIndex) || specIndex;
    report('spec_check', 1, 1, `spec index comparison(s) failed — ${from} is where the spec index used to sit; it is now ${to}, beside the rules index. Run /machinery:install to migrate it (it moves the file and stages both sides)`);
    return false;
  }
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
