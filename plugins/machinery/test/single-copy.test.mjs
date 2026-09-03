import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { generateIndex } from '../scripts/lib/index.mjs';
import { pending } from '../scripts/lib/inbox.mjs';

const REPO = path.resolve(PLUGIN, '..', '..');
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : [];
const h1 = (f) => (fs.readFileSync(f, 'utf8').match(/^# (.+)$/m) || [])[1];

test('the ten rule files exist in the plugin and nowhere else in the repo (spec I1)', () => {
  const mine = fs.readdirSync(path.join(PLUGIN, 'rules')).filter((f) => f.endsWith('.md'));
  assert.equal(mine.length, 10);
  const titles = new Set(mine.map((f) => h1(path.join(PLUGIN, 'rules', f))));
  const elsewhere = walk(path.join(REPO, 'combine-projects-machinery')).filter((f) => /[\\/]rules[\\/][^\\/]+\.md$/.test(f) && !f.includes(path.join('ferrislicer', 'docs')) && !f.includes(path.join('dwc-ng', 'docs')));
  for (const f of elsewhere) assert.ok(!titles.has(h1(f)), `duplicate rule file outside the plugin: ${f}`);
});

test('the register index is exactly the generated one (spec I2)', () => {
  assert.equal(fs.readFileSync(path.join(PLUGIN, 'register', 'INDEX.md'), 'utf8'), generateIndex(path.join(PLUGIN, 'rules')));
});

test('audit procedure lives only in the auditor brief (spec I35)', () => {
  const rules = fs.readFileSync(path.join(PLUGIN, 'rules', 'design-invariants.md'), 'utf8');
  assert.doesNotMatch(rules, /^## Auditing invariants/m);
  const agent = fs.readFileSync(path.join(PLUGIN, 'agents', 'invariant-auditor.md'), 'utf8');
  assert.match(agent, /^## Procedure/m); assert.match(agent, /denominator/i);
});

test('agents carry plugin agent frontmatter', () => {
  for (const f of ['invariant-auditor.md', 'comparison-agent.md']) {
    const t = fs.readFileSync(path.join(PLUGIN, 'agents', f), 'utf8');
    assert.match(t, /^---\nname: [a-z-]+\ndescription: .+\n(tools: .+\n)?---/);
  }
});

test('RED CHECK: the universal inbox has no PENDING entries', () => assert.equal(pending(path.join(PLUGIN, 'inbox.md')).length, 0));
