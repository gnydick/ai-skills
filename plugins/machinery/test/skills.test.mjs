import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN, runScript } from './helpers/run.mjs';

const REPO = path.resolve(PLUGIN, '..', '..');
// Sources are laid out bucket/plugin/skill, so this plugin's skills sit in the
// subfolder named for the plugin itself. Taken from PLUGIN's own directory name
// rather than spelled again: a scan that quietly stops matching looks exactly
// like a codebase that complies, and the three scans below would go vacuously
// green over an empty list.
const BUCKET = path.join(REPO, 'claude-code', path.basename(PLUGIN));
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

// spec I36 CLI surface (final review C2): a skill's own worked examples are the CLI's contract —
// every --flag it shows next to a scripts/<name>.mjs invocation must exist in that script's
// source (not merely once have existed). Scoped per line: a flag token on the same line as the
// script mention is treated as belonging to it, matching how the skills actually write examples
// (the flag is often in its own backtick span, prose-adjacent, not inside the command's own).
function flagsNamedFor(line) {
  const nameMatch = line.match(/scripts\/([\w-]+)\.mjs/);
  if (!nameMatch) return null;
  return { script: nameMatch[1], flags: [...line.matchAll(/--[a-zA-Z][\w-]*/g)].map((m) => m[0]) };
}

test('every scripts/<name>.mjs --flag a skill names exists in that script (spec I36 CLI surface)', () => {
  for (const d of skills()) {
    for (const line of text(d).split('\n')) {
      const found = flagsNamedFor(line);
      if (!found) continue;
      const scriptPath = path.join(PLUGIN, 'scripts', `${found.script}.mjs`);
      if (!fs.existsSync(scriptPath)) continue; // not a machinery script — another plugin's own scripts/ dir
      const src = fs.readFileSync(scriptPath, 'utf8');
      for (const flag of found.flags) assert.ok(src.includes(flag), `${d}/SKILL.md names ${found.script}.mjs ${flag}, which does not appear in scripts/${found.script}.mjs`);
    }
  }
});

test('RED CHECK: the CLI-flag scan actually catches a mismatch', () => {
  const line = 'run `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --bogus-flag-nobody-implements`';
  const found = flagsNamedFor(line);
  assert.ok(found.flags.includes('--bogus-flag-nobody-implements'));
  const src = fs.readFileSync(path.join(PLUGIN, 'scripts', `${found.script}.mjs`), 'utf8');
  assert.ok(!src.includes('--bogus-flag-nobody-implements'));
});
