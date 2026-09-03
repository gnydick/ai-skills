import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';

// Story: spec I34 — place.mjs is the ONLY writer of a rule bullet. This proves the sole-writer
// claim mechanically rather than by convention: no fs.write*/fs.append* call anywhere else under
// scripts/ names "rules" in its own arguments. The libs that legitimately regenerate the
// INDEX/inbox files (which read a rules directory to build their content, so "rules" appears in
// their write call's arguments too) are named exceptions, not a loophole — they never write a
// rule FILE, only the derived index/inbox beside it.
const EXEMPT = new Set(['place.mjs', path.join('lib', 'inbox.mjs'), 'reindex.mjs', 'intake.mjs', 'install.mjs']);
const WRITE_CALL = /fs\.(write|append)\w*\([^\n]*/g;

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

// Scans one directory tree for a write call whose own line mentions "rules", skipping the given
// exempt (root-relative) paths. Factored out so the RED CHECK can prove it actually fires.
function rulesPathWriters(dir, exempt) {
  const offenders = [];
  for (const f of walk(dir).filter((f) => f.endsWith('.mjs'))) {
    const rel = path.relative(dir, f);
    if (exempt.has(rel)) continue;
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(WRITE_CALL)) if (/rules/.test(m[0])) offenders.push(`${rel}: ${m[0].trim()}`);
  }
  return offenders;
}

test('no writer outside place.mjs (and the index/inbox libs) writes to a rules path (spec I34)', () => {
  assert.deepEqual(rulesPathWriters(path.join(PLUGIN, 'scripts'), EXEMPT), []);
});

test('RED CHECK: the sole-writer scan actually flags a rules-path write', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'purity-'));
  try {
    fs.writeFileSync(path.join(tmp, 'bad.mjs'), "fs.writeFileSync(path.join(dir, 'rules', name + '.md'), text);\n");
    const offenders = rulesPathWriters(tmp, new Set());
    assert.equal(offenders.length, 1);
    assert.match(offenders[0], /bad\.mjs/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }); }
});
