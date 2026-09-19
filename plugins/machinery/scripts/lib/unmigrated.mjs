// Story: #132 Amendment 1 (D13; owner, 2026-09-19: "it has to happen in every repo"). What in a
// project is not yet in the slip box. Read-only. The banner, install and intake.mjs call this one
// function, so the three can never disagree about whether a project is migrated.
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { slipboxPaths, INDEX_FILE } from './layout.mjs';
import { mdFiles } from './slipbox.mjs';

export function unmigrated(root) {
  const p = slipboxPaths(root);
  const oldSpecs = mdFiles(p.specs).filter((f) => f !== INDEX_FILE);
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
