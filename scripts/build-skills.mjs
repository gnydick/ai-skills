#!/usr/bin/env node
// Single pipeline from compatibility buckets to distribution targets.
//
// Buckets (pure-prose/, ...) are compatibility classes. Nothing installs from
// them directly: every target is produced here, so there is no second place a
// skill can be copied from and no way for the flat layout to disagree with the
// source. Adding a bucket without declaring it in skills.manifest.json is a
// hard error rather than a silently-skipped directory.
//
//   build    stage buckets flat into skills/   (committed; plugins clone, they don't build)
//   check    fail if skills/ has drifted from the buckets
//   install  link ~/.claude/skills/<name> back to its bucket source

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(REPO, 'skills.manifest.json');
const MARKER = '.generated';
let STAGE;   // <plugin dir>/skills — resolved from the manifest, never hardcoded
let PREFIX;  // plugin.json name — the trigger prefix skills are exposed under
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const fail = (msg) => { console.error(`\x1b[31merror\x1b[0m  ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`);

// Frontmatter is only read to validate identity, so a minimal parser beats a
// YAML dependency here. Folded/continued values are joined onto their key.
function frontmatter(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  if (lines[0].trim() !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const out = {};
  let key = null;
  for (const line of lines.slice(1, end)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) { key = m[1]; out[key] = m[2].trim(); }
    else if (key && line.trim()) out[key] += ' ' + line.trim();
  }
  return out;
}

function loadManifest() {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const [bucket, cfg] of Object.entries(m.buckets)) {
    for (const t of cfg.targets) {
      if (!m.targets[t]) fail(`bucket "${bucket}" declares unknown target "${t}"`);
    }
  }

  // The plugin directory is declared, and its manifest is the sole source of
  // the trigger prefix — reading it here means the build can report the real
  // installed names instead of guessing them from a path.
  const plugin = m.targets['claude-plugin'];
  if (!plugin?.path) { fail('targets["claude-plugin"].path is required'); return m; }
  STAGE = path.join(REPO, plugin.path, 'skills');

  const pluginJson = path.join(REPO, plugin.path, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginJson)) {
    fail(`${plugin.path}/.claude-plugin/plugin.json is missing — the plugin has no name to publish under`);
    return m;
  }
  const pj = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
  if (!pj.name) fail(`${plugin.path}/.claude-plugin/plugin.json has no "name"`);
  else if (!SKILL_NAME.test(pj.name)) fail(`plugin name "${pj.name}" must be lowercase-with-hyphens`);
  PREFIX = pj.name;
  return m;
}

// Git silently skips hooks that are not executable, so a hook committed as
// 100644 is a guard that looks present and does nothing. Windows does not
// track the exec bit, which means this regresses invisibly on the machine most
// likely to introduce it. Checked over the whole directory rather than one
// filename so a later pre-push hook is covered without editing this.
function validateHooks() {
  if (!fs.existsSync(path.join(REPO, '.githooks'))) return;

  let listing;
  try {
    listing = execFileSync('git', ['ls-files', '-s', '--', '.githooks'], { cwd: REPO, encoding: 'utf8' });
  } catch {
    return; // no git available, or not a work tree — nothing to assert against
  }

  for (const line of listing.split('\n').filter(Boolean)) {
    const m = /^(\d{6})\s+\S+\s+\d+\t(.+)$/.exec(line);
    if (!m) continue;
    const [, mode, file] = m;
    if (mode !== '100755') {
      fail(`${file} is mode ${mode} in the index — git silently skips non-executable hooks. `
         + `Fix: git update-index --chmod=+x ${file}`);
    }
  }
}

// A marketplace entry name is what users type to install; plugin.json name is
// what they type afterwards as a trigger prefix. Nothing in the tooling keeps
// those two in step, so if this repo publishes a marketplace, they get checked
// here rather than left to whoever edits one file and not the other.
function validateMarketplace() {
  const file = path.join(REPO, '.claude-plugin', 'marketplace.json');
  if (!fs.existsSync(file)) return;

  const mp = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!mp.name) fail('marketplace.json has no "name"');
  if (!Array.isArray(mp.plugins) || mp.plugins.length === 0) { fail('marketplace.json lists no plugins'); return; }

  for (const entry of mp.plugins) {
    // Remote sources are objects (git-subdir/url/github); only local paths are ours to verify.
    if (typeof entry.source !== 'string') continue;

    const pj = path.join(REPO, entry.source, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(pj)) {
      fail(`marketplace entry "${entry.name}" points at ${entry.source}, which has no .claude-plugin/plugin.json`);
      continue;
    }
    const declared = JSON.parse(fs.readFileSync(pj, 'utf8')).name;
    if (declared !== entry.name) {
      fail(`marketplace lists "${entry.name}" but ${entry.source}/.claude-plugin/plugin.json says "${declared}" — `
         + `users would install one name and get "${declared}:" as their trigger prefix`);
    }
  }
}

// Every skill in the repo, with the checks that make a flat namespace safe.
function collect(manifest) {
  const declared = Object.keys(manifest.buckets);

  const onDisk = fs.readdirSync(REPO, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .filter((n) => !['plugins', 'scripts', 'dist', 'docs', 'node_modules'].includes(n));

  for (const dir of onDisk) {
    if (!declared.includes(dir)) {
      fail(`directory "${dir}/" is not declared in skills.manifest.json — declare it or move it under an existing bucket`);
    }
  }
  for (const bucket of declared) {
    if (!fs.existsSync(path.join(REPO, bucket))) fail(`bucket "${bucket}" is declared but missing on disk`);
  }

  const skills = [];
  const seen = new Map();
  for (const bucket of declared.filter((b) => fs.existsSync(path.join(REPO, b)))) {
    for (const entry of fs.readdirSync(path.join(REPO, bucket), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = path.join(REPO, bucket, entry.name);
      const skillMd = path.join(src, 'SKILL.md');

      if (!fs.existsSync(skillMd)) { fail(`${bucket}/${entry.name}/ has no SKILL.md`); continue; }
      if (!SKILL_NAME.test(entry.name)) { fail(`${bucket}/${entry.name}: directory name must be lowercase-with-hyphens`); continue; }

      const fm = frontmatter(skillMd);
      if (!fm) { fail(`${bucket}/${entry.name}/SKILL.md: missing YAML frontmatter`); continue; }
      if (!fm.name) fail(`${bucket}/${entry.name}/SKILL.md: frontmatter has no "name"`);
      if (!fm.description) fail(`${bucket}/${entry.name}/SKILL.md: frontmatter has no "description"`);
      if (fm.name && fm.name !== entry.name) {
        fail(`${bucket}/${entry.name}/SKILL.md: frontmatter name "${fm.name}" does not match its directory`);
      }

      // Flattening is only safe if names are unique across every bucket.
      if (seen.has(entry.name)) {
        fail(`skill "${entry.name}" exists in both ${seen.get(entry.name)}/ and ${bucket}/ — names share one flat namespace`);
        continue;
      }
      seen.set(entry.name, bucket);
      skills.push({ name: entry.name, bucket, src, targets: manifest.buckets[bucket].targets });
    }
  }
  return skills;
}

// Identifiers that must never reach a published skill — internal project
// names, codenames, customers. Stored as hashes: a denylist that spelled them
// out would publish, in the repo, exactly what it exists to keep out of the
// repo. Neither this function nor its failure message ever echoes a match,
// because CI logs are as public as the file would have been.
//
// Honest limit: a SHA-256 of a single guessable word confirms a guess, it does
// not hide the word from someone determined to brute-force it. This stops
// accidental publication, which is the actual failure mode.
const DENYLIST = path.join(REPO, 'scripts', 'denylist.json');
const hashTerm = (s) => createHash('sha256').update(s.toLowerCase(), 'utf8').digest('hex');

function loadDenylist() {
  if (!fs.existsSync(DENYLIST)) return null;
  const d = JSON.parse(fs.readFileSync(DENYLIST, 'utf8'));
  return Array.isArray(d.terms) && d.terms.length ? new Set(d.terms) : null;
}

// The publishable surface is the entire repo — it is public, so a README, a
// commit-worthy note, or a new manifest leaks exactly as well as a SKILL.md.
// An enumerated list would be the wrong shape: a newly added file simply would
// not be on it. Everything tracked is scanned, plus skill sources not yet added.
function publishableFiles(skills) {
  const files = new Set();
  try {
    // --others --exclude-standard includes files not yet added: a brand-new
    // README is exactly as publishable as a tracked one, and waiting for
    // `git add` to start checking it means `check` lies right up until commit.
    const out = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: REPO, encoding: 'utf8' },
    );
    for (const f of out.split('\0').filter(Boolean)) files.add(path.join(REPO, f));
  } catch { /* not a work tree — fall back to skill sources alone */ }
  for (const s of skills) {
    for (const rel of treeOf(s.src).keys()) files.add(path.join(s.src, rel));
  }
  return [...files].filter((f) => fs.existsSync(f));
}

function validateDenylist(skills) {
  const denied = loadDenylist();
  if (!denied) return;

  for (const file of publishableFiles(skills)) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('\u0000')) continue; // binary
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const word of new Set(line.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])) {
        if (denied.has(hashTerm(word))) {
          fail(`${path.relative(REPO, file).replace(/\\/g, '/')}:${i + 1} contains a denied identifier `
             + `— it must not ship in a published skill (term withheld; grep locally)`);
          return;
        }
      }
    });
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function treeOf(dir) {
  const out = [];
  const walk = (cur, rel) => {
    for (const e of fs.readdirSync(cur, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (rel === '' && e.name === MARKER) continue;
      const next = path.join(cur, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      e.isDirectory() ? walk(next, r) : out.push([r, fs.readFileSync(next)]);
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return new Map(out);
}

function build(skills) {
  if (fs.existsSync(STAGE) && !fs.existsSync(path.join(STAGE, MARKER))) {
    const contents = fs.readdirSync(STAGE);
    if (contents.length) {
      fail(`skills/ exists but has no ${MARKER} marker — refusing to overwrite a hand-authored directory`);
      return;
    }
  }
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });
  fs.writeFileSync(path.join(STAGE, MARKER), 'Generated by scripts/build-skills.mjs. Edit the bucket source, not this.\n');

  const staged = skills.filter((s) => s.targets.includes('claude-plugin'));
  for (const s of staged) copyDir(s.src, path.join(STAGE, s.name));
  ok(`staged ${staged.length} skill(s) into ${path.relative(REPO, STAGE).replace(/\\/g, '/')}/`);
  for (const s of staged) console.log(`    ${s.bucket}/${s.name} → ${PREFIX}:${s.name}`);
}

function check(skills) {
  const expected = new Map();
  for (const s of skills.filter((x) => x.targets.includes('claude-plugin'))) {
    for (const [rel, buf] of treeOf(s.src)) expected.set(`${s.name}/${rel}`, buf);
  }
  const actual = treeOf(STAGE);
  const at = path.relative(REPO, STAGE).replace(/\\/g, '/');

  let drift = 0;
  for (const [rel, buf] of expected) {
    if (!actual.has(rel)) { fail(`${at}/${rel} is missing — run: node scripts/build-skills.mjs build`); drift++; }
    else if (!actual.get(rel).equals(buf)) { fail(`${at}/${rel} differs from its bucket source`); drift++; }
  }
  for (const rel of actual.keys()) {
    if (!expected.has(rel)) { fail(`${at}/${rel} is stale — no longer in any bucket`); drift++; }
  }
  if (!drift) ok(`${at}/ matches source (${expected.size} file(s))`);
}

function link(target, source) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (process.platform === 'win32') {
    // Directory junctions need no elevation; symlinks do.
    execFileSync('cmd', ['/c', 'mklink', '/J', target, source], { stdio: 'pipe' });
  } else {
    fs.symlinkSync(source, target, 'dir');
  }
}

function install(skills, force) {
  const root = path.join(os.homedir(), '.claude', 'skills');
  for (const s of skills.filter((x) => x.targets.includes('claude-personal'))) {
    const dest = path.join(root, s.name);
    const stat = fs.existsSync(dest) ? fs.lstatSync(dest) : null;

    if (stat?.isSymbolicLink() || stat?.isDirectory()) {
      const isLink = stat.isSymbolicLink() || (() => {
        try { return fs.realpathSync(dest) !== dest && fs.realpathSync(dest) === fs.realpathSync(s.src); }
        catch { return false; }
      })();
      if (isLink) { ok(`${s.name} already linked`); continue; }

      // A plain copy is only safe to replace when it has nothing unique in it.
      const same = [...treeOf(s.src)].every(([rel, buf]) => {
        const f = path.join(dest, rel);
        return fs.existsSync(f) && fs.readFileSync(f).equals(buf);
      });
      if (!same && !force) {
        fail(`${dest} differs from ${s.bucket}/${s.name} — inspect it, then re-run with --force`);
        continue;
      }
      fs.rmSync(dest, { recursive: true, force: true });
      console.log(`    replaced copy at ${dest}`);
    }
    link(dest, s.src);
    ok(`${s.name} → ${path.relative(REPO, s.src)}`);
  }
}

// Adds a term without ever writing it, echoing it, or logging it.
function deny(term) {
  if (!term) { console.error('usage: build-skills.mjs deny <term>'); process.exit(2); }
  const d = fs.existsSync(DENYLIST)
    ? JSON.parse(fs.readFileSync(DENYLIST, 'utf8'))
    : { $comment: '', algorithm: 'sha256', terms: [] };
  const h = hashTerm(term);
  if (d.terms.includes(h)) { ok('already denied'); return; }
  d.terms = [...d.terms, h].sort();
  fs.writeFileSync(DENYLIST, JSON.stringify(d, null, 2) + '\n');
  ok(`denied — ${d.terms.length} term(s) on the list`);
}

const cmd = process.argv[2] ?? 'build';
const force = process.argv.includes('--force');

// Handled before validation, so a term can still be added while the repo is
// failing the very check that term is meant to drive.
if (cmd === 'deny') { deny(process.argv[3]); process.exit(process.exitCode ?? 0); }

const manifest = loadManifest();
validateHooks();
validateMarketplace();
const skills = collect(manifest);
validateDenylist(skills);
if (process.exitCode) { console.error('\nvalidation failed; no changes made'); process.exit(1); }

if (cmd === 'build') build(skills);
else if (cmd === 'check') check(skills);
else if (cmd === 'install') install(skills, force);
else if (cmd === 'hooks') {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: REPO, stdio: 'pipe' });
  ok('hooks enabled — .githooks/pre-commit runs `check` before every commit');
} else {
  console.error('usage: build-skills.mjs [build|check|install|hooks|deny <term>] [--force]');
  process.exit(2);
}
