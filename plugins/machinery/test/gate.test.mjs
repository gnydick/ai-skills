import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import v8 from 'node:v8';
import vm from 'node:vm';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { addedHunks, collectCitations } from '../scripts/gate/citation-target.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const RULE = '# T\n\n## S\n\n- a rule\n';
function project(root) {
  write(root, '.claude/rules/t.md', RULE);
  write(root, '.claude/machinery/inbox.md', '');
  runScript('scripts/reindex.mjs', { args: ['--rules', path.join(root, '.claude/rules'), '--out', path.join(root, '.claude/machinery/RULES_INDEX.md')] });
  g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', 'install');
}
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
// Ticket #29 (Gabe, 2026-09-05: "let's unwire citation audit and gating"): the gate no longer
// runs citation-target.mjs, but the module still ships for a future sweep, so its behaviour is
// measured through a test-only driver with the gate's old `--root` / `--merge` surface.
const cite = (root, ...extra) => runScript('test/helpers/citation-target-driver.mjs', { args: ['--root', root, ...extra], cwd: root });

test('clean commit passes and every executed check prints its denominator, zero included (spec I25)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/a.md', 'hello'); g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /^register_check: 0 of 0 pending/m);
    // The citation leg is unwired (#29): no proof line for a check that did not run, because a
    // `0 of 0` here would claim a validation nothing performed.
    assert.doesNotMatch(res.stdout, /citation_target/);
  } finally { r.cleanup(); }
});

test('RED CHECK: the gate no longer runs the citation check — a staged citation to a blank line passes, and no citation_target line is printed (#29)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'src/x.js', 'line1\n\nline3\n'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'src');
    write(r.root, 'docs/n.md', 'see `src/x.js:2`'); g(r.root, 'add', '-A');
    // Positive control: the module itself still rejects this citation, so the gate passing it is
    // the unwiring and not a citation that was never bad.
    const direct = cite(r.root);
    assert.equal(direct.code, 1, direct.stdout + direct.stderr);
    assert.match(direct.stdout, /citation_target: 1 of 1 new citations failed/);
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.doesNotMatch(res.stdout, /citation_target/, 'the gate must not print a proof line for a leg it does not run');
    assert.match(res.stdout, /^register_check: 0 of 0 pending/m, 'the register leg still runs');
  } finally { r.cleanup(); }
});

test('first commit after /machinery:install passes the gate (final review A1)', () => {
  const r = makeRepo();
  try {
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    const g0 = gate(r.root);
    assert.equal(g0.code, 0, g0.stdout + g0.stderr);
    assert.doesNotMatch(g0.stdout, /index is stale/);
    assert.doesNotMatch(g0.stdout, /index not staged/);
    assert.match(g0.stdout, /register_check: 0 of 1 index comparison\(s\) failed/, 'the passing comparison carries its denominator too (#73)');
    g(r.root, 'commit', '-q', '-m', 'install');
    assert.equal(g(r.root, 'status', '--porcelain').trim(), '');
  } finally { r.cleanup(); }
});

test('a project with no rules and no index staged at all reports nothing to check (final review A1)', () => {
  const r = makeRepo();
  try {
    write(r.root, 'docs/a.md', 'hello'); g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /register_check: 0 of 0 index rows/);
  } finally { r.cleanup(); }
});

test('an index generated but never staged is distinguished from a stale one (final review A1)', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/rules/t.md', RULE);
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(r.root, '.claude/rules'), '--out', path.join(r.root, '.claude/machinery/RULES_INDEX.md')] });
    // Rule file staged; the regenerated index was written to disk but never `git add`ed at all
    // (not tracked from an earlier commit either) — distinct from a stale, already-tracked index.
    g(r.root, 'add', '.claude/rules/t.md');
    const res = gate(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /register_check: 1 of 1 index comparison\(s\) failed — index not staged \(generated but not added\) — git add/);
    assert.doesNotMatch(res.stdout, /index is stale/);
  } finally { r.cleanup(); }
});

test('a PENDING inbox entry blocks', () => {
  const r = makeRepo();
  try {
    project(r.root);
    write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-02T00:00:00Z PRULE s\n\nPRULE: x\n\ndisposition: PENDING\n'); g(r.root, 'add', '-A');
    const res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /1 of 1 pending/);
  } finally { r.cleanup(); }
});

test('a stale (hand-edited) index blocks (spec I28)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, '.claude/machinery/RULES_INDEX.md', 'edited by hand'); g(r.root, 'add', '-A');
    const res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /index is stale/);
  } finally { r.cleanup(); }
});

test('partial staging: a staged rule edit without its regenerated (unstaged) index blocks; staging the index too passes (spec I28)', () => {
  const r = makeRepo();
  try {
    project(r.root);
    write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n- a second rule\n');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(r.root, '.claude/rules'), '--out', path.join(r.root, '.claude/machinery/RULES_INDEX.md')] });
    g(r.root, 'add', '.claude/rules/t.md');
    let res = gate(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /register_check: 1 of 1 index comparison\(s\) failed — index is stale/);
    g(r.root, 'add', '.claude/machinery/RULES_INDEX.md');
    res = gate(r.root); assert.equal(res.code, 0, res.stdout + res.stderr);
  } finally { r.cleanup(); }
});

test('register check works when --root is a subdirectory of the repo (staged paths are cwd-relative)', () => {
  const r = makeRepo();
  try {
    const sub = path.join(r.root, 'sub');
    write(sub, '.claude/rules/t.md', RULE);
    write(sub, '.claude/machinery/inbox.md', '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(sub, '.claude/rules'), '--out', path.join(sub, '.claude/machinery/RULES_INDEX.md')] });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'sub install');
    write(sub, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n- a second rule\n');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(sub, '.claude/rules'), '--out', path.join(sub, '.claude/machinery/RULES_INDEX.md')] });
    g(r.root, 'add', 'sub/.claude/rules/t.md');
    let res = runScript('scripts/gate/gate.mjs', { args: ['--root', sub], cwd: sub });
    assert.equal(res.code, 1); assert.match(res.stdout, /register_check: 1 of 1 index comparison\(s\) failed — index is stale/);
    g(r.root, 'add', 'sub/.claude/machinery/RULES_INDEX.md');
    res = runScript('scripts/gate/gate.mjs', { args: ['--root', sub], cwd: sub });
    assert.equal(res.code, 0, res.stdout + res.stderr);
  } finally { r.cleanup(); }
});

// From here to the sweep-guard case: citation-target.mjs's own behaviour, driven directly (#29).
// These fixtures stay in this file on purpose — the module excludes test/gate.test.mjs from its
// own scan (SELF_EXCLUDE), so a future sweep will not read them as real citations.
test('a new path:line citation to a blank line blocks; a real one passes (spec I26)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'src/x.js', 'line1\n\nline3\n'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'src');
    write(r.root, 'docs/n.md', 'see `src/x.js:2` and `src/x.js:3`'); g(r.root, 'add', '-A');
    const res = cite(r.root); assert.equal(res.code, 1); assert.match(res.stdout, /citation_target: 1 of 2 new citations failed/);
    write(r.root, 'docs/n.md', 'see `src/x.js:3`'); g(r.root, 'add', '-A');
    assert.equal(cite(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('a blob with leading blank lines is cited by its real line numbers, untrimmed (final review A2)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'src/x.js', '\n\nline3\nline4\n'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'src');
    write(r.root, 'docs/n.md', 'see `src/x.js:3`'); g(r.root, 'add', '-A');
    let res = cite(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /citation_target: 0 of 1/);
    write(r.root, 'docs/n.md', 'see `src/x.js:1`'); g(r.root, 'add', '-A');
    res = cite(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /citation_target: 1 of 1/);
  } finally { r.cleanup(); }
});

test('citation paths resolve against --root first, then the repo top level (final review A3)', () => {
  const r = makeRepo();
  try {
    const sub = path.join(r.root, 'sub');
    write(sub, 'rules/w.md', 'line1\nline2\nline3\n');
    write(sub, '.claude/rules/t.md', RULE);
    write(sub, '.claude/machinery/inbox.md', '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(sub, '.claude/rules'), '--out', path.join(sub, '.claude/machinery/RULES_INDEX.md')] });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'sub install');
    write(sub, 'docs/n.md', 'see `rules/w.md:2`'); g(r.root, 'add', '-A');
    const res = cite(sub);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /citation_target: 0 of 1/);
  } finally { r.cleanup(); }
});

test('a wrapped `file § Section` citation spanning two added lines is not truncated (final review A4)', () => {
  const r = makeRepo();
  try {
    project(r.root);
    write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n\n## Merging and tearing down\n\n- another\n');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(r.root, '.claude/rules'), '--out', path.join(r.root, '.claude/machinery/RULES_INDEX.md')] });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'add section');
    write(r.root, 'docs/n.md', 'see `.claude/rules/t.md` § Merging and\ntearing down\n'); g(r.root, 'add', '-A');
    let res = cite(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /citation_target: 0 of 1/);
    write(r.root, 'docs/n.md', 'see `.claude/rules/t.md` § Merging and\ntorn down\n'); g(r.root, 'add', '-A');
    res = cite(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /citation_target: 1 of 1/);
  } finally { r.cleanup(); }
});

test('a file § Section citation to a missing heading blocks; an existing one passes', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/n.md', 'see `.claude/rules/t.md` § Nope'); g(r.root, 'add', '-A');
    assert.equal(cite(r.root).code, 1);
    write(r.root, 'docs/n.md', 'see `.claude/rules/t.md` § S'); g(r.root, 'add', '-A');
    assert.equal(cite(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('old citations are never re-audited: a pre-existing bad citation does not fail a new commit\'s check', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/old.md', 'see `src/nothere.js:9`'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '--no-verify', '-m', 'old');
    write(r.root, 'docs/new.md', 'plain'); g(r.root, 'add', '-A');
    const res = cite(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /citation_target: 0 of 0/, 'the old citation was not even counted');
  } finally { r.cleanup(); }
});

test('sweep guard: docs commit adding a brand-new non-docs file warns, never blocks; modifying an existing non-docs file silences it', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'docs/a.md', 'x'); write(r.root, 'stray.tmp', 'oops'); g(r.root, 'add', '-A');
    let res = gate(r.root); assert.equal(res.code, 0); assert.match(res.stdout, /ADVISORY: sweep-guard denominator: 2 staged, 2 newly-tracked, 1 non-doc suspect/); assert.match(res.stdout, /stray\.tmp/);
    g(r.root, 'commit', '-q', '--no-verify', '-m', 'x');
    write(r.root, 'docs/a.md', 'y'); write(r.root, 'README.md', 'changed'); write(r.root, 'new.tmp', 'n'); g(r.root, 'add', '-A');
    res = gate(r.root); assert.doesNotMatch(res.stdout, /ADVISORY/);
  } finally { r.cleanup(); }
});

test('--universal runs the register check over the plugin layout', () => {
  const r = makeRepo();
  try {
    write(r.root, 'rules/t.md', RULE); write(r.root, 'inbox.md', '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(r.root, 'rules'), '--out', path.join(r.root, 'register/RULES_INDEX.md')] });
    g(r.root, 'add', '-A');
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', r.root, '--universal'], cwd: r.root }).code, 0);
  } finally { r.cleanup(); }
});

// Ticket #19 (Gabe, 2026-09-05): the merge gate's citation check could not run on a
// 1.42 MB merge diff — the sync spawn's 1 MiB buffer killed git (ENOBUFS, SIGTERM) and
// the wrapper reported a bare `git diff failed:`. The diff is streamed hunk by hunk now
// (owner: "can't we operate on a stream?"), so a diff of any size passes through, and a
// git that dies part-way is named and fails the leg rather than passing on what arrived.
const FILLER_BYTES = 1.3 * 1024 * 1024;
function filler(bytes) { const line = 'filler line of no particular interest, padding the diff past the buffer\n'; return line.repeat(Math.ceil(bytes / line.length)); }

test('RED CHECK: a staged diff over 1 MiB passes through the citation check with every citation in it found, at both ends (#19)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'src/x.js', 'line1\n\nline3\n'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'src');
    // A good citation at the top of the diff and a bad one (blank line) past the 1 MiB mark:
    // "1 of 2" proves the scan reached the far end, not merely that it survived.
    write(r.root, 'docs/big.md', 'see `src/x.js:3`\n' + filler(FILLER_BYTES) + 'and `src/x.js:2`\n'); g(r.root, 'add', '-A');
    assert.ok(fs.statSync(path.join(r.root, 'docs/big.md')).size > 1024 * 1024, 'fixture is not over 1 MiB');
    let res = cite(r.root);
    assert.doesNotMatch(res.stdout, /could not run/, res.stdout);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /citation_target: 1 of 2 new citations failed/);
    write(r.root, 'docs/big.md', 'see `src/x.js:3`\n' + filler(FILLER_BYTES) + 'and `src/x.js:1`\n'); g(r.root, 'add', '-A');
    res = cite(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /citation_target: 0 of 2 new citations failed/);
  } finally { r.cleanup(); }
});

test('a git that dies mid-stream fails the citation check by name (exit code and git\'s own words), never passes on the hunks that arrived (#19)', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, 'src/x.js', 'line1\n\nline3\n'); g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'src');
    write(r.root, 'docs/n.md', 'plain'); g(r.root, 'add', '-A');
    // GIT_EXTERNAL_DIFF makes real git emit this script's output as the diff, then die on its
    // non-zero exit ("fatal: external diff died") — a hunk carrying a VALID citation reaches
    // the gate before the death, so a leg that trusted what arrived would report 0 of 1.
    const script = path.join(r.root, '..', 'dying-diff');
    fs.writeFileSync(script, ['#!/bin/sh', 'echo "+++ b/docs/n.md"', 'echo "@@ -0,0 +1 @@"', "echo '+see `src/x.js:3`'", 'exit 1', ''].join('\n'));
    fs.chmodSync(script, 0o755);
    // git hands the value to `sh -c`, so a temp path with a space in it needs the quotes.
    const res = runScript('test/helpers/citation-target-driver.mjs', { args: ['--root', r.root], cwd: r.root, env: { GIT_EXTERNAL_DIFF: `'${script.replaceAll(path.sep, '/')}'` } });
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.doesNotMatch(res.stdout, /citation_target: \d+ of \d+/, 'a truncated diff must not produce a proof line');
    assert.match(res.stdout, /citation-target driver: the check could not run — git diff failed: .*\S/, res.stdout);
    assert.match(res.stdout, /128/, res.stdout);
    assert.match(res.stdout, /external diff died/, res.stdout);
  } finally { r.cleanup(); }
});

// The stream's consumer, driven by a fake line source so what it holds can be probed.
const fakeDiff = (hunks) => (async function* () { for (const h of hunks) { yield `+++ b/${h.file}`; yield `@@ -0,0 +1,${h.lines.length} @@`; for (const l of h.lines) yield `+${l}`; } })();

test('memory is bounded to the current hunk: every earlier hunk the parser yielded is collectable once the consumer moves on (#19)', async () => {
  // What this can see: the hunk-yielding stage itself retains nothing past the hunk it is on.
  // What it cannot see: the citations list (bounded by citation count, not diff size), the
  // child's pipe buffers, and V8's own slack. The positive control is hunk 0, held strongly.
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  const N = 300; const K = 50;
  const src = fakeDiff(Array.from({ length: N }, (_, i) => ({ file: `docs/h${i}.md`, lines: Array.from({ length: K }, (_, j) => `hunk ${i} line ${j}`) })));
  const refs = []; let control = null; let seen = 0;
  for await (const h of addedHunks(src)) { seen += 1; assert.equal(h.lines.length, K); refs.push(new WeakRef(h)); if (!control) control = h; }
  assert.equal(seen, N);
  await new Promise((res) => setImmediate(res)); // leave the job that last touched the WeakRefs
  gc();
  assert.ok(refs[0].deref() !== undefined, 'positive control: a strongly held hunk must survive the gc, or the probe sees nothing');
  const retained = refs.slice(1, N - 1).map((w, i) => (w.deref() === undefined ? null : i + 1)).filter((i) => i !== null);
  assert.deepEqual(retained, [], `hunks still retained after the consumer moved on: ${retained.join(', ')}`);
  assert.ok(control);
});

test('a wrapped `file § Section` is joined across added lines within one hunk, never across hunks (final review A4, through the stream)', async () => {
  const cites = await collectCitations(fakeDiff([
    { file: 'docs/n.md', lines: ['see `rules/t.md` § Merging and', 'tearing down'] },
    { file: 'docs/n.md', lines: ['and `src/x.js:3`'] },
    { file: 'docs/n.md', lines: ['`rules/t.md` § Other'] },
    { file: 'docs/n.md', lines: ['heading continued'] },
    { file: 'test/gate.test.mjs', lines: ['`rules/t.md` § Excluded'] },
  ]));
  assert.deepEqual(cites.map((c) => (c.kind === 'line' ? `${c.from}: ${c.path}:${c.line}` : `${c.from}: ${c.path} § ${c.section}`)), [
    'docs/n.md: rules/t.md § Merging and tearing down',
    'docs/n.md: src/x.js:3',
    'docs/n.md: rules/t.md § Other',
  ]);
});

// Ticket #23 (measured by the #19 task reviewer, 2026-09-05): in a CRLF-authored file every added
// diff line carries a trailing `\r`, so the A4 join produced `… § Merging and\r tearing down\r` and
// the heading capture stopped at the `\r`. Pre-existing on every version of the gate. The two
// lines below are the reviewer's exact two; the LF control is the same pair without the `\r`.
const REVIEWER_LINES = ['see `rules/t.md` § Merging and\r', 'tearing down\r'];

test('RED CHECK: a wrapped `file § Section` joins whole from CRLF-authored added lines, exactly as from LF ones (#23)', async () => {
  assert.ok(REVIEWER_LINES.every((l) => l.endsWith('\r')), 'the CRLF fixture really carries a \\r on every line, or this proves nothing');
  const section = async (lines) => (await collectCitations(fakeDiff([{ file: 'docs/n.md', lines }]))).map((c) => `${c.kind}:${c.path} § ${c.section}`);
  assert.deepEqual(await section(REVIEWER_LINES.map((l) => l.replace(/\r$/, ''))), ['section:rules/t.md § Merging and tearing down'], 'LF control');
  assert.deepEqual(await section(REVIEWER_LINES), ['section:rules/t.md § Merging and tearing down'], 'CRLF twin');
});

test('through real git: a CRLF-authored wrapped citation matches a CRLF-authored heading, and a `path:N` citation into a CRLF file lands on the same line with a blank line still blank (#23)', () => {
  const r = makeRepo();
  try {
    project(r.root);
    // Every fixture file is CRLF, written without the platform's own conversion in the way.
    g(r.root, 'config', 'core.autocrlf', 'false');
    write(r.root, '.claude/rules/t.md', '# T\r\n\r\n## S\r\n\r\n- a rule\r\n\r\n## Merging and tearing down\r\n\r\n- another\r\n');
    write(r.root, 'src/x.js', 'line1\r\n\r\nline3\r\n');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(r.root, '.claude/rules'), '--out', path.join(r.root, '.claude/machinery/RULES_INDEX.md')] });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'crlf fixtures');
    assert.match(g(r.root, 'show', 'HEAD:src/x.js'), /\r\n/, 'the committed blob really is CRLF, or the pin sees an LF file');
    // The line citation goes first: a `§ Heading` capture runs to the next punctuation or the end
    // of the hunk (the A4 grammar, LF and CRLF alike), so the wrapped citation ends the file.
    write(r.root, 'docs/n.md', 'and `src/x.js:3`\r\nsee `.claude/rules/t.md` § Merging and\r\ntearing down\r\n'); g(r.root, 'add', '-A');
    let res = cite(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /citation_target: 0 of 2 new citations failed/);
    // The same two facts, each made false: the heading is truncated one word early, and line 2 of
    // the CRLF file is `\r` alone — blank, not a one-character line.
    write(r.root, 'docs/n.md', 'and `src/x.js:2`\r\nsee `.claude/rules/t.md` § Merging and\r\ntorn down\r\n'); g(r.root, 'add', '-A');
    res = cite(r.root);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /citation_target: 2 of 2 new citations failed/);
    assert.match(res.stdout, /§ Merging and torn down → no such heading/);
    assert.match(res.stdout, /`src\/x\.js:2` → blank line/);
  } finally { r.cleanup(); }
});

test('a line source that fails part-way fails the collection — the citations that arrived are never reported (#19)', async () => {
  const dying = (async function* () { yield '+++ b/docs/n.md'; yield '@@ -0,0 +1 @@'; yield '+see `src/x.js:3`'; throw new Error('git diff -U0: killed by SIGTERM'); })();
  await assert.rejects(collectCitations(dying), /killed by SIGTERM/);
});

// Ticket #81: a project that has not re-run /machinery:install after the rename still has
// .claude/machinery/INDEX.md staged and no RULES_INDEX.md at all. The gate cannot write, so it
// cannot migrate — but "index not staged (generated but not added)" would send the user to
// `git add` a file the rename made obsolete. It names the rename instead.
test('the pre-#81 index name is named as a migration, not reported as a missing index (#81)', () => {
  const r = makeRepo();
  try {
    write(r.root, '.claude/rules/t.md', RULE);
    write(r.root, '.claude/machinery/inbox.md', '');
    runScript('scripts/reindex.mjs', { args: ['--rules', path.join(r.root, '.claude/rules'), '--out', path.join(r.root, '.claude/machinery/INDEX.md')] });
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    assert.equal(res.code, 1, res.stdout + res.stderr);
    assert.match(res.stdout, /register_check: 1 of 1 index comparison\(s\) failed/, 'the failure still carries its denominator');
    assert.match(res.stdout, /RULES_INDEX\.md/);
    assert.match(res.stdout, /machinery:install/, 'the remedy named is the migration, not a git add');
  } finally { r.cleanup(); }
});

test('RED CHECK: the gate is not a no-op — a pending entry really fails it', () => {
  const r = makeRepo();
  try {
    project(r.root); write(r.root, '.claude/machinery/inbox.md', '\n## PENDING 2026-09-02T00:00:00Z PRULE s\n\nx\n\ndisposition: PENDING\n'); g(r.root, 'add', '-A');
    assert.notEqual(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});
