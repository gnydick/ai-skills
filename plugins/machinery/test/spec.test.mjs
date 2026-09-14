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
import { projectSpecs, projectSpecInbox } from '../scripts/lib/config.mjs';

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
    assert.match(ctx(res), /^SPEC captured verbatim to .*spec-inbox\.md \(PENDING\)\. Commits are refused until it is filed: run \/machinery:rule-process\.$/m);
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
    assert.match(ctx(res), /Commits in .* are refused until it is filed: run \/machinery:rule-process from /);
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
    assert.match(ctx(res), /\.claude[\\/]machinery[\\/]spec-inbox\.md/, ctx(res));
    assert.doesNotMatch(res.stderr, /at Object\.|node:internal/, 'a stack trace reached the user');
  } finally { r.cleanup(); }
});

test('adding a third mark leaves the two existing marks exactly as they were (#81)', () => {
  const r = installedProject();
  try {
    const p = capture('PRULE: never guess a path', r.root);
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 1);
    assert.equal(pending(projectSpecInbox(r.root)).length, 0, 'a PRULE must not reach the spec inbox');
    assert.match(ctx(p), /^PRULE captured verbatim to .*inbox\.md \(PENDING\)\. Commits are refused until it is filed: run \/machinery:rule-process\.$/m);

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

test('install creates the spec layout and stages the spec inbox (#81)', () => {
  const r = makeRepo();
  try {
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    assert.ok(fs.existsSync(projectSpecs(r.root)), 'docs/dictated-specs');
    assert.equal(fs.readFileSync(projectSpecInbox(r.root), 'utf8'), '');
    const staged = g(r.root, 'diff', '--cached', '--name-only');
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
    assert.match(red.stdout, /^commit refused: 1 pending entry in \.claude\/machinery\/spec-inbox\.md — run \/machinery:rule-process$/m);
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

test('spec intake refuses a home outside the spec area, then files and commits in one commit in the root (#81)', () => {
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

