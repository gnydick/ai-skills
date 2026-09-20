// Story: #132 Amendment 1 (D13; owner, 2026-09-19: "it has to happen in every repo"). What in a
// project is not yet in the slip box. Read-only. The banner, install and intake.mjs call this one
// function, so the three can never disagree about whether a project is migrated.
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { slipboxPaths, INDEX_FILE } from './layout.mjs';
import { mdFiles } from './slipbox.mjs';

// The old layout kept each spec as a top-level file under docs/dictated-specs/. Two names there
// are never one of those, and the distinction matters twice over: an old spec file makes a project
// read as UNMIGRATED, and commit 2 of the migration DELETES every one of them. Measured 2026-09-19
// (merge review 2, F8): a project's docs/dictated-specs/README.md was counted as an old spec, so
// the migration would have deleted it. INDEX.md is generated; README.md is the reader's own.
const NOT_AN_OLD_SPEC = new Set([INDEX_FILE, 'README.md']);

export function unmigrated(root) {
  const p = slipboxPaths(root);
  const oldSpecs = mdFiles(p.specs).filter((f) => !NOT_AN_OLD_SPEC.has(f));
  const adr = fs.existsSync(p.adr);
  const adrFiles = adr ? mdFiles(p.adr) : [];
  const bare = [];
  for (const dir of [p.spSpecs, p.spPlans]) {
    for (const f of mdFiles(dir)) {
      let kind = null;
      try { kind = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8')).data?.kind ?? null; } catch {}
      if (!kind) bare.push(path.relative(root, path.join(dir, f)).split(path.sep).join('/'));
    }
  }
  return { oldSpecs, adr, adrFiles, bare, any: oldSpecs.length > 0 || adr || bare.length > 0 };
}

export function describeUnmigrated(u) {
  const parts = [];
  if (u.oldSpecs.length) parts.push(`${u.oldSpecs.length} old spec file(s) in docs/dictated-specs/`);
  if (u.adr) parts.push(`docs/adr/ (${u.adrFiles.length} file(s))`);
  if (u.bare.length) parts.push(`${u.bare.length} superpowers file(s) without front matter`);
  return parts.join(', ');
}
