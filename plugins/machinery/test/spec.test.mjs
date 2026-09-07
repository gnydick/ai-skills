// Ticket #81 — the SPEC: mark. Three parts, all of them mechanism:
//   capture   a SPEC: prompt is written verbatim to a durable inbox before the assistant replies,
//             from an isolated working copy as readily as from the root;
//   address   the destination is docs/dictated-specs — ONE fixed, known location every project
//             shares, with no resolver, no config key and no per-project declaration;
//   gate      an undispositioned spec entry blocks, and a disposition naming a path outside the
//             spec area is refused.
//
// Two honest limits, stated so nobody claims more later. WHICH specification file owns a given
// subsystem is a judgement no hook can make: what is mechanised is the location, that a filed path
// lives under it, and that nothing stays pending. And docs/ is not under .claude/, so nothing here
// puts a filed specification into a session's context — that is #81 Part 4 and does not exist yet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';
import { pending, parseInbox, appendEntry } from '../scripts/lib/inbox.mjs';
import { projectSpecs, projectSpecInbox, projectSpecIndex } from '../scripts/lib/config.mjs';
import { generateIndex, generateSpecIndex } from '../scripts/lib/index.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/UserPromptSubmit.json'), 'utf8'));
const payload = (prompt, cwd) => JSON.stringify({ ...base, prompt, cwd });
// Every home() is a throwaway, so nothing here can read or write the live plugin inbox.
const home = () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(h, '.claude'));
  const rulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
  fs.mkdirSync(path.join(rulesDir, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: path.join(rulesDir, 'rules') }));
  return h;
};
const ctx = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
const capture = (prompt, cwd) => runScript('scripts/capture.mjs', { stdin: payload(prompt, cwd), cwd, env: { MACHINERY_HOME: home() } });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });

// Deliberately awkward: two blank-line-separated paragraphs, an em dash, a Windows path with
// backslashes, straight quotes and asterisks. Nothing here survives a normaliser intact.
const SPEC_TEXT = [
  'SPEC: the tool resolver must reject a bare command name.',
  '',
  '  - It resolves by explicit path — never by $PATH.',
  '  - It rejects the known lookalike at C:\\Windows\\System32\\bash.exe.',
  '',
  'Rationale: "a same-named stub" reads as *your* file being broken; it is not.',
].join('\n');

// The layout /machinery:install produces, written directly and committed. Deliberately NOT a call
// to install.mjs: one test below runs the real installer and asserts it produces exactly this, and
// paying for a full install — a node spawn plus a gate-directory copy — in every other case cost
// more of the suite's 15 s budget (spec I42) than it bought. The generators run in process.
function installedProject() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  fs.mkdirSync(path.join(r.root, 'docs', 'dictated-specs'), { recursive: true });
  write(r.root, '.claude/machinery/RULES_INDEX.md', generateIndex(path.join(r.root, '.claude/rules')));
  write(r.root, 'docs/dictated-specs/SPEC_INDEX.md', generateSpecIndex(path.join(r.root, 'docs/dictated-specs')));
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  return r;
}

// ------------------------------------------------------------------------------ Part 1: capture

test('a SPEC: prompt is captured to the spec inbox VERBATIM — byte for byte, newlines and punctuation included (#81)', () => {
  const r = installedProject();
  try {
    const res = capture(SPEC_TEXT, r.root);
    const inbox = projectSpecInbox(r.root);
    const entries = pending(inbox);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].marker, 'SPEC');
    assert.equal(entries[0].disposition, 'PENDING');
    // The strongest form available: the raw file carries the prompt as a literal substring.
    // A capture that re-wrapped, re-quoted or re-indented anything fails here.
    const raw = fs.readFileSync(inbox, 'utf8');
    assert.ok(raw.includes(SPEC_TEXT), `the inbox does not carry the prompt verbatim:\n${JSON.stringify(raw)}`);
    assert.equal(entries[0].text, SPEC_TEXT);
    assert.match(ctx(res), /captured verbatim to .*spec-inbox\.md/i);
  } finally { r.cleanup(); }
});

test('a SPEC: prompt from INSIDE an isolated working copy lands in the project root\'s spec inbox, and the entry says where it is filed from (#81)', () => {
  const r = installedProject();
  try {
    const wt = addWorktree(r.root, 'feat');
    const res = capture('SPEC: the merge gate judges a local merge result.', wt);
    assert.equal(pending(projectSpecInbox(r.root)).length, 1, 'the capture must reach the ROOT inbox, not the copy');
    // The copy has its own checked-out spec-inbox.md from the install commit; the point is that
    // capture did not write into it. It is still the empty file git checked out.
    assert.equal(fs.readFileSync(path.join(wt, '.claude', 'machinery', 'spec-inbox.md'), 'utf8'), '', 'nothing is written inside the working copy');
    assert.match(ctx(res), /isolated working copy/i);
    assert.match(ctx(res), /filed from a root session/i);
  } finally { r.cleanup(); }
});

test('capture in a project that has never installed still lands, and names the one fixed location (#81)', () => {
  // A git repo that never ran /machinery:install. There is nothing to declare and nothing to
  // resolve (owner, 2026-09-07: "we just need a unique location to persist those specs"), so the
  // absence of the directory is not an error state — the address holds either way.
  const r = makeRepo();
  try {
    assert.ok(!fs.existsSync(projectSpecs(r.root)), 'the fixture really has no spec directory yet');
    const res = capture('SPEC: something', r.root);
    assert.equal(res.code, 0, res.stderr);
    assert.equal(pending(projectSpecInbox(r.root)).length, 1, 'the text is durable regardless');
    assert.match(ctx(res), /docs[\\/]dictated-specs/, ctx(res));
    assert.doesNotMatch(res.stderr, /at Object\.|node:internal/, 'a stack trace reached the user');
  } finally { r.cleanup(); }
});

test('adding a third mark leaves the two existing marks exactly as they were (#81)', () => {
  const r = installedProject();
  try {
    const p = capture('PRULE: never guess a path', r.root);
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 1);
    assert.equal(pending(projectSpecInbox(r.root)).length, 0, 'a PRULE must not reach the spec inbox');
    assert.match(ctx(p), /captured verbatim to .*inbox\.md.*run the intake sequence now/i);

    const a = capture('RULE: ambiguous', r.root);
    assert.match(ctx(a), /Dictate a project rule with PRULE: or a universal rule with URULE:/);

    // The universal mark writes beside its own rules source, not into this project.
    const h = home();
    const u = runScript('scripts/capture.mjs', { stdin: payload('URULE: say less', r.root), cwd: r.root, env: { MACHINERY_HOME: h } });
    const src = JSON.parse(fs.readFileSync(path.join(h, '.claude', 'machinery.json'), 'utf8')).rulesSource;
    assert.equal(pending(path.join(path.dirname(src), 'inbox.md')).length, 1);
    assert.match(ctx(u), /captured verbatim to .*inbox\.md/i);
    assert.equal(pending(projectSpecInbox(r.root)).length, 0, 'a URULE must not reach the spec inbox either');
  } finally { r.cleanup(); }
});

// ------------------------------------------------------- the RULES_INDEX.md rename's migration
//
// A project that has not re-run /machinery:install after the rename still has
// .claude/machinery/INDEX.md staged and no RULES_INDEX.md at all. The gate cannot write, so it
// cannot migrate — but "index not staged (generated but not added)" would send the user to
// `git add` a file the rename made obsolete. It names the rename instead.
test('the pre-#81 index name is named as a migration, not reported as a missing index (#81)', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
    write(r.root, '.claude/machinery/inbox.md', '');
    write(r.root, '.claude/machinery/INDEX.md', generateIndex(path.join(r.root, '.claude/rules')));
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /register_check: 1 of 1 index comparison\(s\) failed/, 'the failure still carries its denominator');
    assert.match(res.stdout, /RULES_INDEX\.md/);
    assert.match(res.stdout, /machinery:install/, 'the remedy named is the migration, not a git add');
  } finally { r.cleanup(); }
});

// ------------------------------------------------------------------ Part 2: one fixed location

test('the spec layout is resolvable: the index sits WITH the specs, the inbox does not (#81)', () => {
  assert.equal(projectSpecs('R'), path.join('R', 'docs', 'dictated-specs'));
  // Owner, 2026-09-07: "docs/dictated-specs can't hold the actual dictated specs?" — one place, not
  // two. An index belongs next to the thing it indexes, so someone browsing the spec area sees
  // what is in it without knowing .claude/machinery exists.
  assert.equal(projectSpecIndex('R'), path.join('R', 'docs', 'dictated-specs', 'SPEC_INDEX.md'));
  // The inbox stays behind on purpose: it holds raw dictations nobody has decided anything about
  // yet, and an unfiled capture landing in the documentation tree would be wrong.
  assert.equal(projectSpecInbox('R'), path.join('R', '.claude', 'machinery', 'spec-inbox.md'));
});

test('the spec index does not index itself (#81)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'specs-'));
  try {
    fs.writeFileSync(path.join(d, 'tooling.md'), '# Tooling\n\n## Resolving a tool\n\n- x\n');
    fs.writeFileSync(path.join(d, 'SPEC_INDEX.md'), generateSpecIndex(d));
    const out = generateSpecIndex(d);
    assert.match(out, /^\| dictated-specs\/tooling\.md \|/m, out);
    assert.doesNotMatch(out, /SPEC_INDEX/, 'the generated index must not carry a row for itself');
    assert.equal(out, generateSpecIndex(d), 'and it must be a fixed point: regenerating over its own output changes nothing');
  } finally { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 }); }
});

// The spec area is outside .claude/ entirely, so a filed specification is never seen by anything
// that reads the rules directory: not the rules index, not the register check, not the nudge.
test('the spec index is generated, never authored, and a filed specification never appears among the dictated rules (#81)', () => {
  const r = installedProject();
  try {
    // Frontmatter parseRuleFile() would refuse outright, so a spec reaching the rule generator
    // would not merely produce a wrong row — it would throw.
    write(r.root, 'docs/dictated-specs/tooling.md', '---\ntitle: Tooling\n---\n# Tooling\n\n## Resolving a tool\n\n- resolve by explicit path\n');
    // Hand-edited first: the spec index is generated, never authored, and the gate says so.
    write(r.root, 'docs/dictated-specs/SPEC_INDEX.md', 'edited by hand');
    g(r.root, 'add', '-A');
    let res = gate(r.root);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /spec_check: 1 of 1 spec index comparison\(s\) failed — spec index is stale/, res.stdout);

    // Regenerated through the real script, with the --kind that picks the spec generator.
    runScript('scripts/reindex.mjs', { args: ['--kind', 'specs', '--rules', path.join(r.root, 'docs/dictated-specs'), '--out', path.join(r.root, 'docs/dictated-specs/SPEC_INDEX.md')] });
    g(r.root, 'add', 'docs/dictated-specs/SPEC_INDEX.md');
    const rulesIndex = fs.readFileSync(path.join(r.root, '.claude/machinery/RULES_INDEX.md'), 'utf8');
    assert.match(rulesIndex, /\| rules\/t\.md \|/, rulesIndex);
    assert.doesNotMatch(rulesIndex, /tooling/, 'a specification must never appear as a row among dictated rules');
    res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /register_check: 0 of 1 index comparison\(s\) failed/, res.stdout);
    assert.match(res.stdout, /spec_check: 0 of 1 spec index comparison\(s\) failed/, res.stdout);
  } finally { r.cleanup(); }
});

test('the spec index is generated from the spec files and never authored; a spec with unknown frontmatter is data, not a crash (#81)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'specs-'));
  try {
    // Frontmatter keys the rule parser has never heard of. parseRuleFile() would throw on these;
    // a specification is somebody else's document and the index still has to come out.
    fs.writeFileSync(path.join(d, 'b-tooling.md'), '---\ntitle: Tooling\nowner: nobody\n---\n# Tooling\n\n## Resolving a tool\n\n- x\n\n## Heartbeats\n\n- y\n');
    fs.writeFileSync(path.join(d, 'a-gate.md'), '# Gate\n\n## Checks\n\n```\n## not a heading, it is in a fence\n```\n');
    const out = generateSpecIndex(d);
    assert.equal(out, generateSpecIndex(d), 'the generator is deterministic');
    assert.match(out, /^\| dictated-specs\/a-gate\.md \| 1 \| Checks \|$/m, out);
    assert.match(out, /^\| dictated-specs\/b-tooling\.md \| 2 \| Resolving a tool; Heartbeats \|$/m, out);
    assert.doesNotMatch(out, /not a heading/, 'a fenced ## is not a section');
    assert.equal(generateSpecIndex(path.join(d, 'nope')), generateSpecIndex(fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'))), 'a missing spec area indexes as empty, not as a throw');
  } finally { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 }); }
});

test('install creates the spec layout and stages the spec index alongside the rules one (#81)', () => {
  const r = makeRepo();
  try {
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    assert.ok(fs.existsSync(projectSpecs(r.root)), 'docs/dictated-specs');
    assert.equal(fs.readFileSync(projectSpecInbox(r.root), 'utf8'), '');
    assert.equal(fs.readFileSync(projectSpecIndex(r.root), 'utf8'), generateSpecIndex(projectSpecs(r.root)));
    const staged = g(r.root, 'diff', '--cached', '--name-only');
    assert.match(staged, /docs\/dictated-specs\/SPEC_INDEX\.md/, staged);
    assert.match(staged, /\.claude\/machinery\/spec-inbox\.md/, staged);
  } finally { r.cleanup(); }
});

// ------------------------------------------------------------------------------- Part 3: the gate

test('RED CHECK: an undispositioned spec entry blocks the commit, and the check states its denominator (#81)', () => {
  const r = installedProject();
  try {
    // POSITIVE CONTROL: with the spec inbox empty the same check is green and still prints its
    // count, so the red below is the pending entry and not a check that fails on everything.
    write(r.root, 'docs/a.md', 'hello'); g(r.root, 'add', '-A');
    const green = gate(r.root);
    assert.equal(green.code, 0, green.stdout + green.stderr);
    assert.match(green.stdout, /^spec_check: 0 of 0 spec inbox entr/m, green.stdout);

    appendEntry(projectSpecInbox(r.root), { marker: 'SPEC', text: SPEC_TEXT, session: 's' });
    g(r.root, 'add', '.claude/machinery/spec-inbox.md');
    const red = gate(r.root);
    assert.equal(red.code, 1, red.stdout + red.stderr);
    assert.match(red.stdout, /^spec_check: 1 of 1 spec inbox entr/m, red.stdout);
  } finally { r.cleanup(); }
});

test('a disposition naming a path outside the spec area is refused, and one inside it passes (#81)', () => {
  const r = installedProject();
  try {
    const inbox = projectSpecInbox(r.root);
    appendEntry(inbox, { marker: 'SPEC', text: 'SPEC: a', session: 's' });
    const stamp = parseInbox(fs.readFileSync(inbox, 'utf8'))[0].stamp;

    // Filed somewhere the project does not keep specifications: the exact scattering this exists
    // to stop. The path check is a containment test, so it does not need the file to exist.
    let d = runScript('scripts/disposition.mjs', { args: ['--inbox', inbox, '--stamp', stamp, '--filed', 'docs/notes.md § Tooling'] });
    assert.equal(d.code, 0, d.stderr);
    g(r.root, 'add', '.claude/machinery/spec-inbox.md');
    let res = gate(r.root);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /^spec_check: 1 of 1 filed spec path\(s\) outside/m, res.stdout);
    assert.match(res.stdout, /docs\/notes\.md/, res.stdout);

    // The same entry filed under the declared spec area passes, with the denominator kept.
    d = runScript('scripts/disposition.mjs', { args: ['--inbox', inbox, '--stamp', stamp, '--filed', 'docs/dictated-specs/tooling.md § Resolving a tool'] });
    assert.equal(d.code, 0, d.stderr);
    g(r.root, 'add', '.claude/machinery/spec-inbox.md');
    res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^spec_check: 0 of 1 filed spec path\(s\) outside/m, res.stdout);
  } finally { r.cleanup(); }
});

test('a malformed spec inbox is a diagnostic, not a stack trace (external input) (#81)', () => {
  const r = installedProject();
  try {
    write(r.root, '.claude/machinery/spec-inbox.md', '\n## PENDING 2026-09-07T00:00:00Z SPEC s\n\nno disposition line follows\n');
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /spec_check: 1 of 1 .*malformed/, res.stdout);
    assert.doesNotMatch(res.stdout + res.stderr, /at Object\.|node:internal/, 'a stack trace reached the user');
  } finally { r.cleanup(); }
});

// ------------------------------------------------------------------------------------- the intake

test('spec intake refuses a home outside the spec area, then files, reindexes and commits in one commit in the root (#81)', () => {
  const r = installedProject();
  try {
    const inbox = projectSpecInbox(r.root);
    appendEntry(inbox, { marker: 'SPEC', text: SPEC_TEXT, session: 's' });
    const list = runScript('scripts/intake.mjs', { args: ['list', '--root', r.root], cwd: r.root });
    assert.match(list.stdout, /\tSPEC\t.*spec-inbox\.md\tSPEC: the tool resolver/, list.stdout);
    const stamp = list.stdout.trim().split('\n').find((l) => l.includes('\tSPEC\t')).split('\t')[0];
    write(r.root, 'docs/dictated-specs/tooling.md', '# Tooling\n\n## Resolving a tool\n\n- resolve by explicit path, never by search path\n');
    // Refused first: a home outside the spec area, so the intake cannot write the very disposition
    // the gate would then reject. The entry survives that refusal untouched and is filed below.
    const bad = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'spec', '--root', r.root, '--stamp', stamp, '--home', 'docs/notes.md § Tooling'], cwd: r.root });
    assert.notEqual(bad.code, 0);
    assert.match(bad.stderr, /docs[\\/]dictated-specs/, bad.stderr);
    assert.equal(pending(inbox).length, 1, 'the entry stays pending — nothing was filed');

    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'spec', '--root', r.root, '--stamp', stamp, '--home', 'docs/dictated-specs/tooling.md § Resolving a tool'], cwd: r.root });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(pending(inbox).length, 0);
    const [e] = parseInbox(fs.readFileSync(inbox, 'utf8'));
    assert.equal(e.state, 'FILED');
    assert.match(e.disposition, /filed → docs\/dictated-specs\/tooling\.md § Resolving a tool/);
    assert.match(g(r.root, 'log', '-1', '--format=%s'), /^spec: SPEC: the tool resolver/);
    assert.equal(g(r.root, 'status', '--porcelain').trim(), '');
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

