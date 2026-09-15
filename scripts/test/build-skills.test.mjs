// Tests for scripts/build-skills.mjs — the claude-rules target: the per-skill
// list that decides who gets a ~/.claude/rules entry, and install()'s second
// link root.
//
// Every case runs against a FIXTURE repo in a temp directory, never this
// checkout: build-skills.mjs resolves REPO from its own location, so the fixture
// gets a byte copy of the script under its own scripts/ and becomes the repo the
// copy validates. The home root is injected through AI_SKILLS_HOME, so no test
// can reach the real ~/.claude — install() would otherwise repoint live links at
// whatever tree the suite happens to be running in.
//
// A test process must never inherit the caller's git environment: git runs a
// pre-commit hook with GIT_DIR and GIT_INDEX_FILE exported, and from a linked
// worktree both are absolute. Inherited, every `git` the script runs inside the
// fixture would operate on the outer repository instead — validateLineEndings
// would then report the outer repo's files as the fixture's. Scrubbed at spawn.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'build-skills.mjs');

// The count line this file owes its own output (rules/tool-output.md § Proof
// lines and denominators): node --test's `# pass N` summary does not match the
// declared proof format, so it would be compressed away and a pass for a bad
// reason — an empty file, a suite that registered nothing — would look exactly
// like a pass. Counted by the test bodies themselves reaching their own end.
let registered = 0, passed = 0;
const check = (name, fn) => { registered++; test(name, async (t) => { await fn(t); passed++; }); };
after(() => console.log(`build_skills_tests: ${passed} of ${registered} test(s) passed`));

const PLUGIN_JSON = (name) => JSON.stringify({
  name, description: `${name} fixture`, version: '0.1.0',
  author: { name: 'fixture', email: 'fixture@example.com' },
  homepage: 'https://example.com', repository: 'https://example.com',
  license: 'GPL-3.0', keywords: ['fixture'],
}, null, 2) + '\n';

const SKILL_MD = (name) => `---\nname: ${name}\ndescription: fixture skill ${name}\n---\n\n# ${name}\n`;

// One fixture shape for every case: three routes across the two buckets, so a
// single manifest exercises both directions — a claude-code skill that IS named
// in the rules list, a claude-code skill that is NOT, and a skill whose bucket
// does not declare the target at all.
function makeFixture(mutate = () => {}) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'build-skills-'));
  const home = path.join(root, 'home');
  const repo = path.join(root, 'repo');

  const layout = [
    ['pure-prose', 'unbreakable', 'be-reasonable'],
    ['claude-code', 'developer-friendliness', 'developer-friendliness'],
    ['claude-code', 'machinery', 'reload'],
  ];
  for (const [bucket, plugin, skill] of layout) {
    const dir = path.join(repo, bucket, plugin, skill);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), SKILL_MD(skill));
    const pj = path.join(repo, 'plugins', plugin, '.claude-plugin');
    fs.mkdirSync(pj, { recursive: true });
    fs.writeFileSync(path.join(pj, 'plugin.json'), PLUGIN_JSON(plugin));
  }

  const manifest = {
    buckets: {
      'pure-prose': { description: 'fixture', targets: ['claude-personal', 'claude-plugin'] },
      'claude-code': { description: 'fixture', targets: ['claude-personal', 'claude-plugin', 'claude-rules'] },
    },
    targets: {
      'claude-personal': { kind: 'local-install', root: '~/.claude/skills', implemented: true },
      'claude-rules': { kind: 'local-install', root: '~/.claude/rules', implemented: true, skills: ['developer-friendliness'] },
      'claude-plugin': {
        kind: 'plugin', implemented: true,
        routes: {
          unbreakable: { path: 'plugins/unbreakable', skills: ['be-reasonable'] },
          'developer-friendliness': { path: 'plugins/developer-friendliness', skills: ['developer-friendliness'] },
          machinery: { path: 'plugins/machinery', skills: ['reload'] },
        },
      },
    },
  };
  mutate(manifest);
  fs.writeFileSync(path.join(repo, 'skills.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  fs.mkdirSync(path.join(repo, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), JSON.stringify({
    name: 'fixture', owner: { name: 'fixture', email: 'fixture@example.com' },
    plugins: Object.entries(manifest.targets['claude-plugin'].routes ?? {})
      .map(([name, r]) => ({ name, source: `./${r.path}`, description: `${name} fixture` })),
  }, null, 2) + '\n');

  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(repo, 'scripts', 'build-skills.mjs'));
  // The one plugin module the script imports (the machinery layout: where the user's universal
  // rules live and their heading), at the same relative path, so the copy resolves it as the real
  // script does. layout.mjs imports only node builtins.
  const layoutModule = path.join('plugins', 'machinery', 'scripts', 'lib', 'layout.mjs');
  fs.mkdirSync(path.dirname(path.join(repo, layoutModule)), { recursive: true });
  fs.copyFileSync(path.join(REPO, layoutModule), path.join(repo, layoutModule));

  return { root, repo, home, cleanup: () => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }) };
}

// The scrubbed environment every child of a test runs in (see the header): the script under test,
// and any git the test itself runs inside the fixture. A `git init` that inherits the hook's
// GIT_DIR re-initialises the OUTER repository and leaves the fixture without one.
function scrubbedEnv(f) {
  const env = { ...process.env, AI_SKILLS_HOME: f.home };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k];
  return env;
}

function run(f, args) {
  const r = spawnSync(process.execPath, [path.join(f.repo, 'scripts', 'build-skills.mjs'), ...args], {
    cwd: f.repo, encoding: 'utf8', env: scrubbedEnv(f),
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', all: (r.stdout ?? '') + (r.stderr ?? '') };
}

const git = (f, args) => spawnSync('git', args, { cwd: f.repo, encoding: 'utf8', env: scrubbedEnv(f) });

// Detaches a link without walking into it: on Windows a junction lstats as a
// symbolic link but only rmdir detaches it; on POSIX a symlink-to-directory
// needs unlink and rmdir fails with ENOTDIR. Both are tried, not guessed.
const unlinkDir = (p) => { try { fs.rmdirSync(p); } catch { fs.unlinkSync(p); } };

const rulesEntry = (f, name) => path.join(f.home, '.claude', 'rules', name);
const skillsEntry = (f, name) => path.join(f.home, '.claude', 'skills', name);

check('install links ~/.claude/rules/<name> at the skill bucket source', () => {
  const f = makeFixture();
  try {
    const r = run(f, ['install']);
    assert.equal(r.code, 0, r.all);
    const dest = rulesEntry(f, 'developer-friendliness');
    assert.ok(fs.lstatSync(dest).isSymbolicLink(), `${dest} is not a link`);
    assert.equal(
      fs.realpathSync(dest),
      fs.realpathSync(path.join(f.repo, 'claude-code', 'developer-friendliness', 'developer-friendliness')),
    );
    // The directory holds exactly one file, so exactly that file loads.
    assert.deepEqual(fs.readdirSync(dest), ['SKILL.md']);
    // The skills link is untouched by the second root.
    assert.ok(fs.lstatSync(skillsEntry(f, 'developer-friendliness')).isSymbolicLink());
  } finally { f.cleanup(); }
});

check('install makes no rules entry for a skill the claude-rules list does not name', () => {
  const f = makeFixture();
  try {
    assert.equal(run(f, ['install']).code, 0);
    // `reload` is in the same bucket, which DOES declare claude-rules — the
    // per-skill list is what decides, never the bucket or the folder.
    assert.ok(!fs.existsSync(rulesEntry(f, 'reload')), 'a bucket-mate got a rules entry it was never listed for');
    // `be-reasonable` sits in a bucket that does not declare the target at all.
    assert.ok(!fs.existsSync(rulesEntry(f, 'be-reasonable')));
    assert.deepEqual(fs.readdirSync(path.join(f.home, '.claude', 'rules')), ['developer-friendliness']);
    // Both still get their personal-skills link.
    for (const n of ['reload', 'be-reasonable']) assert.ok(fs.lstatSync(skillsEntry(f, n)).isSymbolicLink(), n);
  } finally { f.cleanup(); }
});

check('a dangling rules link is detected and relinked', () => {
  const f = makeFixture();
  try {
    assert.equal(run(f, ['install']).code, 0);
    const dest = rulesEntry(f, 'developer-friendliness');
    const src = path.join(f.repo, 'claude-code', 'developer-friendliness', 'developer-friendliness');
    const gone = path.join(f.root, 'the-old-layout');

    // What every install looks like after a skill's source moves: the entry
    // still points at the path the source used to have. Reproduced by pointing
    // it somewhere that then disappears — the source itself must still be on
    // disk, or there would be nothing for the relink to point at, which is
    // exactly the real case. fs.existsSync reports nothing here while the name
    // is still taken, so a link that is merely skipped leaves it dangling.
    fs.mkdirSync(gone, { recursive: true });
    unlinkDir(dest);
    fs.symlinkSync(gone, dest, 'junction');
    fs.rmSync(gone, { recursive: true, force: true });
    assert.ok(fs.lstatSync(dest).isSymbolicLink() && !fs.existsSync(dest), 'the fixture did not produce a dangling link');

    const r = run(f, ['install']);
    assert.equal(r.code, 0, r.all);
    assert.match(r.stdout, /removed dangling link/);
    assert.equal(fs.realpathSync(dest), fs.realpathSync(src));
  } finally { f.cleanup(); }
});

check('claude-rules naming a skill that exists in no bucket is a hard error', () => {
  const f = makeFixture((m) => { m.targets['claude-rules'].skills = ['developer-friendliness', 'no-such-skill']; });
  try {
    const r = run(f, ['install']);
    assert.equal(r.code, 1, r.all);
    assert.match(r.all, /no-such-skill/);
    assert.match(r.all, /claude-rules/);
    assert.ok(!fs.existsSync(path.join(f.home, '.claude')), 'validation failed but the install still touched the home root');
  } finally { f.cleanup(); }
});

check('claude-rules naming a skill whose bucket does not declare the target is a hard error', () => {
  const f = makeFixture((m) => { m.targets['claude-rules'].skills = ['be-reasonable']; });
  try {
    const r = run(f, ['install']);
    assert.equal(r.code, 1, r.all);
    assert.match(r.all, /be-reasonable/);
    assert.match(r.all, /pure-prose/);
    assert.ok(!fs.existsSync(path.join(f.home, '.claude')));
  } finally { f.cleanup(); }
});

// Owner, 2026-09-14: `.claude/rules/` is a requirement at the beginning of setting this plugin up.
// /machinery:install creates it for an adopting project; this repo never runs install (its hooks
// call the scripts in place, STATUS 53), so `hooks` — the once-per-clone enablement — is where the
// same layout has to come from. Without it, the first rule filed here dies in place.mjs on ENOENT.
check('hooks creates .claude/rules and .claude/machinery in the repo before enabling the hooks', () => {
  const f = makeFixture();
  try {
    assert.equal(git(f, ['init', '-q']).status, 0, 'the fixture could not be initialised as a repository');
    assert.equal(fs.existsSync(path.join(f.repo, '.claude', 'rules')), false, 'the fixture must start without the directory');
    const r = run(f, ['hooks']);
    assert.equal(r.code, 0, r.all);
    assert.ok(fs.statSync(path.join(f.repo, '.claude', 'rules')).isDirectory(), '.claude/rules was not created');
    assert.ok(fs.statSync(path.join(f.repo, '.claude', 'machinery')).isDirectory(), '.claude/machinery was not created');
    assert.equal(git(f, ['config', 'core.hooksPath']).stdout.trim(), '.githooks');
  } finally { f.cleanup(); }
});

// Owner, 2026-09-15: the user's ~/.claude/rules/universal.md is seeded with its heading by
// /machinery:install, and by `hooks` here for the same reason as the directories above — this repo
// never runs install. Never overwritten: a filed rule survives every later run, byte for byte.
check('hooks seeds ~/.claude/rules/universal.md with its heading once and never overwrites it', () => {
  const f = makeFixture();
  try {
    assert.equal(git(f, ['init', '-q']).status, 0, 'the fixture could not be initialised as a repository');
    const first = run(f, ['hooks']);
    assert.equal(first.code, 0, first.all);
    const u = path.join(f.home, '.claude', 'rules', 'universal.md');
    assert.equal(fs.readFileSync(u, 'utf8'), '# Universal rules\n');
    assert.match(first.all, /universal\.md: created/, first.all);
    const filed = '# Universal rules\n- a filed rule (URULE, 2026-09-15)\n';
    fs.writeFileSync(u, filed);
    const again = run(f, ['hooks']);
    assert.equal(again.code, 0, again.all);
    assert.equal(fs.readFileSync(u, 'utf8'), filed, 'a second run walked back over a filed rule');
    assert.match(again.all, /universal\.md: present, left as it is/, again.all);
  } finally { f.cleanup(); }
});
