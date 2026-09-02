import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN, runScript } from './helpers/run.mjs';

const REPO = path.resolve(PLUGIN, '..', '..');
const BUCKET = path.join(REPO, 'claude-code');
const skills = () => fs.readdirSync(BUCKET).filter((d) => fs.existsSync(path.join(BUCKET, d, 'SKILL.md')));
const text = (d) => fs.readFileSync(path.join(BUCKET, d, 'SKILL.md'), 'utf8');

test('every /machinery:<name> a skill names is a routed skill (spec I36)', () => {
  const routed = new Set(JSON.parse(fs.readFileSync(path.join(REPO, 'skills.manifest.json'), 'utf8')).targets['claude-plugin'].routes.machinery.skills);
  for (const d of skills()) for (const m of text(d).matchAll(/\/machinery:([a-z-]+)/g)) assert.ok(routed.has(m[1]), `${d} names /machinery:${m[1]} which is not routed`);
});

test('no skill restates a rule bullet verbatim (spec I37)', () => {
  const rulesDir = path.join(PLUGIN, 'rules');
  if (!fs.existsSync(rulesDir)) return; // rules land in Task 17; this test bites from then on
  const firstSentences = fs.readdirSync(rulesDir).flatMap((f) => fs.readFileSync(path.join(rulesDir, f), 'utf8').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).split(/(?<=\.)\s/)[0].trim()).filter((s) => s.length > 40));
  for (const d of skills()) { const t = text(d); for (const s of firstSentences) assert.ok(!t.includes(s), `${d} restates a rule: "${s.slice(0, 60)}…"`); }
});

test('the markers named in skills are the ones in markers.json', () => {
  const m = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'markers.json'), 'utf8'));
  for (const d of skills()) for (const tok of text(d).matchAll(/\b[A-Z]RULE:/g)) assert.ok([m.project, m.universal].includes(tok[0]), `${d} uses ${tok[0]}`);
});

test('reload prints every universal rule file as a delimited block', () => {
  const res = runScript('scripts/reload.mjs');
  assert.equal(res.code, 0);
  for (const f of fs.readdirSync(path.join(PLUGIN, 'rules'))) assert.ok(res.stdout.includes(`===== rules/${f} =====`));
});

test('RED CHECK: six skills exist', () => {
  const routed = JSON.parse(fs.readFileSync(path.join(REPO, 'skills.manifest.json'), 'utf8')).targets['claude-plugin'].routes.machinery.skills;
  assert.equal(routed.length, 6);
  for (const name of routed) assert.ok(fs.existsSync(path.join(BUCKET, name, 'SKILL.md')), `${name} has no SKILL.md`);
});
