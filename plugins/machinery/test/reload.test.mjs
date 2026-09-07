// Story: #65 — /machinery:reload printed all ten rule files on every run (69,254 bytes,
// ~17k tokens), and the case you most want to run it in is the one where nothing changed.
// The delta is hashed per file against a manifest in the SESSION SCRATCHPAD directory:
// keyed on the path the session hands it, because a skill-invoked script gets no hook
// payload and so has no session id to read. First reload per session is a full dump, by
// construction, and that is correct — a fresh session has seen nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScript } from './helpers/run.mjs';
import { makeRepo } from './helpers/repo.mjs';
import { reloadDelta, MANIFEST_NAME } from '../scripts/lib/reload.mjs';

// Ten, so the counts the ticket names (`10 files, 0 changed`) are the counts the suite reads.
const NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((n) => `${n}.md`);
const bodyOf = (n) => `# ${n}\n\n- the body of ${n}\n`;

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'reload-'));
  const rules = path.join(base, 'rules');
  fs.mkdirSync(rules);
  for (const n of NAMES) fs.writeFileSync(path.join(rules, n), bodyOf(n));
  const home = path.join(base, 'home');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: rules }));
  const scratch = path.join(base, 'scratchpad');
  fs.mkdirSync(scratch);
  return {
    base, rules, home, scratch,
    manifest: path.join(scratch, MANIFEST_NAME),
    cleanup: () => fs.rmSync(base, { recursive: true, force: true, maxRetries: 5 }),
  };
}

const run = (f, args = [], opts = {}) =>
  runScript('scripts/reload.mjs', { env: { MACHINERY_HOME: f.home }, args: ['--scratchpad', f.scratch, ...args], ...opts });

test('ticket test 3 (positive control): with no manifest the run prints all ten and 10 files, 10 changed', () => {
  const f = fixture();
  try {
    assert.ok(!fs.existsSync(f.manifest), 'the fixture starts with no manifest');
    const r = run(f);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /machinery_reload: 10 files, 10 changed/);
    for (const n of NAMES) assert.ok(r.stdout.includes(`===== rules/${n} =====`), `${n} was not printed`);
    for (const n of NAMES) assert.ok(r.stdout.includes(`the body of ${n}`), `${n}'s text was not printed`);
    assert.ok(fs.existsSync(f.manifest), 'a successful print writes the manifest');
  } finally { f.cleanup(); }
});

test('ticket test 1: the second consecutive run prints 10 files, 0 changed and no rule text', () => {
  const f = fixture();
  try {
    const first = run(f);
    assert.match(first.stdout, /machinery_reload: 10 files, 10 changed/);
    const second = run(f);
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /machinery_reload: 10 files, 0 changed/);
    assert.ok(!second.stdout.includes('====='), `a delimited block was printed: ${second.stdout}`);
    for (const n of NAMES) assert.ok(!second.stdout.includes(`the body of ${n}`), `${n}'s text was reprinted`);
    // Exactly one line carries the denominator, and it is in the declared proof-line shape, so the
    // output filter keeps it instead of compressing away a pass (rules/tool-output.md § Proof lines
    // and denominators). The pattern is lib/filter.mjs PROOF_LINE.
    const PROOF_LINE = /(^HEARTBEAT\s|^[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\s+--?[\w.-]+)?:\s+\S)/;
    const proof = second.stdout.split('\n').filter((l) => /\d+ files, \d+ changed/.test(l));
    assert.equal(proof.length, 1, 'exactly one proof line');
    assert.match(proof[0], PROOF_LINE);
  } finally { f.cleanup(); }
});

test('ticket test 2: touching one rule file prints that file and 10 files, 1 changed', () => {
  const f = fixture();
  try {
    run(f);
    fs.writeFileSync(path.join(f.rules, 'c.md'), '# c.md\n\n- rewritten by the test\n');
    const r = run(f);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /machinery_reload: 10 files, 1 changed/);
    assert.ok(r.stdout.includes('===== rules/c.md ====='), 'the touched file was not printed');
    assert.ok(r.stdout.includes('rewritten by the test'), 'the touched file’s new text was not printed');
    for (const n of NAMES.filter((n) => n !== 'c.md')) assert.ok(!r.stdout.includes(`the body of ${n}`), `${n} was reprinted`);
  } finally { f.cleanup(); }
});

test('ticket test 5: --all prints everything with a manifest present', () => {
  const f = fixture();
  try {
    run(f);
    assert.ok(fs.existsSync(f.manifest));
    const r = run(f, ['--all']);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /machinery_reload: 10 files, 10 changed/);
    for (const n of NAMES) assert.ok(r.stdout.includes(`the body of ${n}`), `${n} was not printed under --all`);
  } finally { f.cleanup(); }
});

test('ticket test 4: an aborted print leaves the manifest untouched, so the next run still reports those files as changed', () => {
  const f = fixture();
  try {
    let calls = 0;
    const dying = () => { if (++calls === 3) throw new Error('injected write failure'); };
    assert.throws(() => reloadDelta({ dirs: [['rules', f.rules]], manifestPath: f.manifest, write: dying }), /injected write failure/);
    assert.ok(!fs.existsSync(f.manifest), 'the manifest was written despite the print dying');
    const r = run(f);
    assert.match(r.stdout, /machinery_reload: 10 files, 10 changed/);
  } finally { f.cleanup(); }
});

test('an aborted print does not overwrite a manifest an earlier run left', () => {
  const f = fixture();
  try {
    run(f);
    const before = fs.readFileSync(f.manifest, 'utf8');
    fs.writeFileSync(path.join(f.rules, 'c.md'), '# c.md\n\n- rewritten by the test\n');
    const dying = () => { throw new Error('injected write failure'); };
    assert.throws(() => reloadDelta({ dirs: [['rules', f.rules]], manifestPath: f.manifest, write: dying }));
    assert.equal(fs.readFileSync(f.manifest, 'utf8'), before, 'the manifest moved on a failed print');
  } finally { f.cleanup(); }
});

test('a corrupt manifest is data, not a crash: every file counts as changed and the run says so', () => {
  const f = fixture();
  try {
    run(f);
    fs.writeFileSync(f.manifest, '{truncated');
    const r = run(f);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /machinery_reload: 10 files, 10 changed/);
    assert.match(r.stdout, /machinery_reload: .*unreadable/);
    assert.ok(r.stdout.includes('the body of a.md'), 'the full dump did not happen');
  } finally { f.cleanup(); }
});

test('without --scratchpad the run is a full dump and says nothing is remembered', () => {
  const f = fixture();
  try {
    const r = runScript('scripts/reload.mjs', { env: { MACHINERY_HOME: f.home } });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /machinery_reload: 10 files, 10 changed/);
    assert.match(r.stdout, /machinery_reload: no session scratchpad/);
    const again = runScript('scripts/reload.mjs', { env: { MACHINERY_HOME: f.home } });
    assert.match(again.stdout, /machinery_reload: 10 files, 10 changed/);
  } finally { f.cleanup(); }
});

test('--project joins the same delta, and a later run without it does not forget the project rules', () => {
  const f = fixture();
  const repo = makeRepo();
  try {
    const pr = path.join(repo.root, '.claude', 'rules');
    fs.mkdirSync(pr, { recursive: true });
    fs.writeFileSync(path.join(pr, 'local.md'), '# local\n\n- a project rule\n');
    fs.writeFileSync(path.join(pr, 'other.md'), '# other\n\n- another project rule\n');

    const first = run(f, ['--project'], { cwd: repo.root });
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /machinery_reload: 12 files, 12 changed/);
    assert.ok(first.stdout.includes('===== .claude/rules/local.md ====='));

    const second = run(f, ['--project'], { cwd: repo.root });
    assert.match(second.stdout, /machinery_reload: 12 files, 0 changed/);

    const withoutProject = run(f, [], { cwd: repo.root });
    assert.match(withoutProject.stdout, /machinery_reload: 10 files, 0 changed/);

    const backAgain = run(f, ['--project'], { cwd: repo.root });
    assert.match(backAgain.stdout, /machinery_reload: 12 files, 0 changed/, 'dropping --project made the session forget the project rules');
  } finally { repo.cleanup(); f.cleanup(); }
});

test('RED CHECK: the “no rule text” observer can actually see rule text', () => {
  const f = fixture();
  try {
    const first = run(f);
    // The assertion the no-change case rests on is `!stdout.includes(body)`. It only counts if
    // it fails when the text IS there — otherwise a run that printed nothing at all would pass.
    assert.ok(first.stdout.includes('the body of a.md'), 'the observer is alive: it sees printed rule text');
    assert.throws(() => assert.ok(!first.stdout.includes('the body of a.md')));
    assert.throws(() => assert.match(first.stdout, /machinery_reload: 10 files, 0 changed/));
  } finally { f.cleanup(); }
});
