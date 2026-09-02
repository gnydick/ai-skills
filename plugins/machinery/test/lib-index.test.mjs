import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRuleFile } from '../scripts/lib/frontmatter.mjs';
import { generateIndex } from '../scripts/lib/index.mjs';
import { runScript } from './helpers/run.mjs';

const rulesDir = (files) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(d, n), t);
  return d;
};
const A = `---\nstatus: 🟢\nsupersedes:\n  - section: Old way\n    by: b.md § New way\n    date: 2026-09-02\n---\n# A\n\n## One\n\n- rule 1\n- rule 2\n  continued\n\n## Two\n\n- rule 3\n\n## Old way\n\n- rule 4\n`;
const B = `# B\n\n## New way\n\n- rule x\n\n## Old way\n\n- rule y\n`;

test('parseRuleFile: status default, sections and rule counts', () => {
  const p = parseRuleFile(B, 'b.md');
  assert.equal(p.status, '🟢'); assert.equal(p.rules, 2);
  assert.deepEqual(p.sections.map((s) => s.heading), ['New way', 'Old way']);
});

test('parseRuleFile: frontmatter status and supersedes', () => {
  const p = parseRuleFile(A, 'a.md');
  assert.equal(p.rules, 4);
  assert.deepEqual(p.supersedes, [{ section: 'Old way', by: 'b.md § New way', date: '2026-09-02' }]);
});

test('generateIndex is deterministic and derives the reverse links (spec I2, I13)', () => {
  const d = rulesDir({ 'a.md': A, 'b.md': B });
  const out = generateIndex(d);
  assert.equal(out, generateIndex(d));
  assert.ok(out.includes('| rules/a.md | 🟢 | 4 | One; Two; Old way |'));
  assert.ok(out.includes('| rules/a.md § Old way | b.md § New way | 2026-09-02 |'));
  assert.ok(out.includes('## Superseded by (derived)'));
  assert.ok(out.includes('| b.md § New way | rules/a.md § Old way | 2026-09-02 |'));
});

test('reindex --check exits 1 when the file is stale and 0 after --out (spec I28)', () => {
  const d = rulesDir({ 'a.md': A });
  const out = path.join(path.dirname(d), 'INDEX.md');
  fs.writeFileSync(out, 'stale');
  assert.equal(runScript('scripts/reindex.mjs', { args: ['--rules', d, '--out', out, '--check'] }).code, 1);
  assert.equal(runScript('scripts/reindex.mjs', { args: ['--rules', d, '--out', out] }).code, 0);
  assert.equal(runScript('scripts/reindex.mjs', { args: ['--rules', d, '--out', out, '--check'] }).code, 0);
});

test('RED CHECK: an unknown status is refused (spec I16)', () => {
  assert.throws(() => parseRuleFile('---\nstatus: 🟠\n---\n# x\n', 'x.md'), /status/);
});

test('RED CHECK: a supersession naming a missing section is refused by the generator', () => {
  const d = rulesDir({ 'a.md': A.replace('section: Old way', 'section: Nope') });
  assert.throws(() => generateIndex(d), /Nope/);
});
