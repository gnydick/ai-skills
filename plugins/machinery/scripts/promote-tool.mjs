#!/usr/bin/env node
// Promotes a project's own tool-catalog entry into the universal catalog.
// Story: specs/2026-09-04-tool-assimilation-design.md, Verification 7.
//
// This is the ONE gate between the machine-derived project half of the catalog and the
// human-reviewed universal half (scripts/lib/catalog.mjs states that split and says nothing
// enforces it — this script is where it gets enforced). So every refusal happens BEFORE the first
// write: the design's standard is that an entry whose fixture does not prove its outcome pattern
// survives filtering is not an entry, and the proof is the point, not the file's presence. The
// judgement itself is not made here — it is read from scripts/lib/survival.mjs, the same authority
// test/catalog.test.mjs enforces over the universal catalog, so the gate and the suite cannot
// drift apart (rules/design-invariants.md § Never re-derive a fact).
//
// Mirrors intake.mjs's shape for the version bump: bump.mjs is resolved as this script's own
// sibling and told which plugin to bump with --plugin, rather than being re-implemented here.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pluginRoot } from './lib/config.mjs';
import { survivalProblems } from './lib/survival.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const say = (s) => process.stdout.write(s + '\n');
const here = path.dirname(fileURLToPath(import.meta.url));
const die = (m) => { process.stderr.write(`promote-tool: ${m}\n`); process.exit(1); };

const id = opt('--id'), root = opt('--root'), force = argv.includes('--force');
if (!id || !root) { process.stderr.write('usage: promote-tool.mjs --id <id> --root <projectRoot> [--force]\n'); process.exit(2); }

// The id is interpolated into two filesystem paths below, so it is constrained to something that
// cannot address a directory other than the intended one — a bare `existsSync` on a joined path
// would happily follow `../..` out of the fixtures directory.
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) die(`'${id}' is not a usable catalog id: expected letters, digits, dot, dash or underscore, starting with a letter or digit`);

// The project half of this data is hand-editable, and so is the universal file. A malformed one is
// the user's input, not our invariant failing: it gets a diagnostic, never a stack trace
// (rules/design-invariants.md § External input).
function readObject(file, what) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) { return die(e.code === 'ENOENT' ? `${what} does not exist: ${file}` : `cannot read ${what} at ${file}: ${e.message}`); }
  let value;
  try { value = JSON.parse(text); }
  catch (e) { return die(`${what} at ${file} is not valid JSON: ${e.message}`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return die(`${what} at ${file} is not a JSON object`);
  return value;
}

const projectCatalogPath = path.join(root, '.claude', 'machinery', 'tool-catalog.json');
const projectCatalog = readObject(projectCatalogPath, "the project's tool catalog");
if (!(id in projectCatalog)) die(`'${id}' is not in ${projectCatalogPath}`);
const entry = projectCatalog[id];
if (!entry || typeof entry !== 'object' || Array.isArray(entry)) die(`the '${id}' entry in ${projectCatalogPath} is not a JSON object`);

// Verification 7, both halves. The file has to be there AND it has to prove something; an entry
// whose fixture proves nothing is exactly what lands a permanently red suite in the plugin.
const fixturePath = path.join(root, '.claude', 'machinery', 'fixtures', `${id}.json`);
if (!fs.existsSync(fixturePath)) die(`refusing — no fixture at ${fixturePath}; an entry with no fixture is not an entry (design Verification 7)`);
const fixture = readObject(fixturePath, `the fixture for '${id}'`);
const problems = survivalProblems(id, entry, fixture);
if (problems.length) die(`refusing — the fixture at ${fixturePath} does not prove that the outcome pattern of '${id}' survives filtering:\n  ${problems.join('\n  ')}`);

const plugin = pluginRoot();
const universalPath = path.join(plugin, 'data', 'tool-catalog.json');
const universal = readObject(universalPath, 'the universal tool catalog');
// The universal half is human-reviewed data. Silently replacing a reviewed entry is a data loss no
// one would see in a promotion's summary line, so it takes an explicit --force.
if (id in universal && !force) die(`'${id}' is already in ${universalPath}; promoting would overwrite human-reviewed data. Edit that entry directly, or re-run with --force to replace it.`);
const replaced = id in universal;

// Everything above can refuse; from here on the writes land.
universal[id] = entry;
fs.writeFileSync(universalPath, JSON.stringify(universal, null, 2) + '\n', 'utf8');

const universalFixtureDir = path.join(plugin, 'test', 'fixtures', 'tool-catalog');
fs.mkdirSync(universalFixtureDir, { recursive: true });
const universalFixturePath = path.join(universalFixtureDir, `${id}.json`);
fs.copyFileSync(fixturePath, universalFixturePath);

// loadCatalog() lays the project half OVER the universal one, so an entry left in both is shadowed
// by the project's copy forever: the promotion would be inert here, and the two copies would drift.
// One fact, one home — the project entry goes.
delete projectCatalog[id];
fs.writeFileSync(projectCatalogPath, JSON.stringify(projectCatalog, null, 2) + '\n', 'utf8');

const b = spawnSync(process.execPath, [path.join(here, 'bump.mjs'), '--plugin', plugin], { encoding: 'utf8' });
if (b.status !== 0) die(`'${id}' landed in ${universalPath} but the version bump failed — bump the plugin by hand: ${(b.stderr || '').trim()}`);

say(`promoted '${id}' into ${universalPath}${replaced ? ' (--force: replaced the entry that was there)' : ''}`);
say(`fixture copied to ${universalFixturePath}`);
say(`removed '${id}' from ${projectCatalogPath}; the project copy would otherwise shadow the universal entry`);
say(`the project fixture at ${fixturePath} was left in place`);
say(`bumped plugin version to ${b.stdout.trim()}`);
// Said, not enforced: warn and let the user judge (rules/design-invariants.md § Telling the user
// what you dropped). Every hand-authored universal entry carries a `verified` note saying which
// version was measured and how; a promoted one derived by machine usually does not.
if (typeof entry.verified !== 'string' || !entry.verified.trim()) {
  say(`warning: '${id}' carries no "verified" note. The universal catalog is the human-reviewed half — add one naming the tool version measured and what was observed.`);
}
say(`note: ${universalPath} was rewritten as canonical 2-space JSON`);
