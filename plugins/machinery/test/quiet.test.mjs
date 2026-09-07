import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runScript, PLUGIN } from './helpers/run.mjs';

const fixture = (name, command) => {
  const p = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/', `${name}.json`), 'utf8'));
  p.tool_input = { ...p.tool_input, command, description: 'd' };
  return JSON.stringify(p);
};
const out = (stdout) => JSON.parse(stdout).hookSpecificOutput;

test('noisy bash command is rewritten to run through quiet-run in filter mode', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /^node "[^"]*quiet-run\.mjs" --shell bash --mode filter "[^"]+"$/);
  assert.equal(u.description, 'd [quiet:filter]');
  const cmdfile = u.command.match(/"([^"]+)"$/)[1];
  assert.equal(fs.readFileSync(cmdfile, 'utf8'), 'cargo test');
});

test('infra powershell command gets the powershell wrapper and exit passthrough', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-PowerShell', 'git push') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /--shell powershell --mode infra .*; exit \$LASTEXITCODE$/);
});

// `ls` was the fourth entry here until Task 7. It is `plain`, and `plain` no longer means
// untouched — an unseen tool's volume is unknown, so it is observed once
// (specs/2026-09-04-tool-assimilation-design.md, "The five states"). The untouched half of that
// behaviour is now covered below, in the state where it is actually true: a recorded-quiet tool.
test('read / piped / redirected commands are untouched', () => {
  for (const c of ['gh issue view 1', 'cargo test | tail -5', 'cargo build > log']) {
    const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c); assert.equal(r.code, 0);
  }
});

// Ruling C1 (owner, 2026-09-05): "Only need wrapping for output producers, not filter pipes." The
// final review measured `cat big.txt` observed on run 1 and cut to 8 of 120 lines on run 2; these
// are its exact commands, through the hook, in a real repository with no history. A byte-mover
// never reaches the assimilator, so it is untouched with or without a record.
test('a byte-mover is never wrapped, never observed: the exemption is by kind, not by record', () => {
  const root = project({ cat: { identity: 'bespoke', noisy: true, lines: 120, stdoutLines: 120, stderrLines: 0, ledger: {} } });
  // Four spawns, not the whole list: the rest of the set is covered per command in
  // lib-classify.test.mjs, and every hook spawn here costs the pre-commit budget ~150 ms.
  for (const c of ['cat big.txt', 'sed -n 1,200p x', 'grep -rn line .', 'git log --oneline -50']) {
    const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c); assert.equal(r.code, 0, c);
  }
});

test('a non-shell tool is untouched', () => {
  const p = JSON.parse(fixture('PreToolUse-Bash', 'cargo test')); p.tool_name = 'Read';
  const r = runScript('scripts/quiet.mjs', { stdin: JSON.stringify(p) });
  assert.equal(r.stdout, '');
});

test('fails OPEN: garbage stdin → no output, exit 0 (spec I17)', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: '{not json' });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('fails OPEN: unwritable temp dir → no output, exit 0 (spec I17) — and says what it swallowed (final review I2)', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test'), env: { CLAUDE_JOB_DIR: 'Z:\\nonexistent\\dir\\for\\quiet' } });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
  // Fail open is the posture; fail SILENT was the defect. One line, naming the error, on stderr.
  assert.match(r.stderr, /^quiet: .*unfiltered/);
  assert.equal(r.stderr.trim().split('\n').length, 1);
});

test('RED CHECK: the rewrite is not the identity', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test') });
  assert.notEqual(out(r.stdout).updatedInput.command, 'cargo test');
});

// ---- Task 7: what happens to a command classify() has no opinion on ----
// `plain` used to mean "leave it alone". It now means "ask the assimilator", and the two new
// facts it can come back with — this project has never seen this tool, and this project has
// seen it and it was loud — are what the rest of this file exercises.

// A REAL repository. projectRoot() answers by asking git for the common dir, so a bare `.git`
// directory is not a repository: it throws, quiet.mjs fails open, and a test built on one would
// pass or fail for reasons that have nothing to do with the assimilator. One repo for the whole
// file (tests in a file run in order), re-seeded per test, because `git init` is not free.
let PROJECT = null;
function project(obs, cat) {
  if (!PROJECT) {
    PROJECT = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-assimilate-'));
    execFileSync('git', ['init', '-q'], { cwd: PROJECT });
  }
  const dir = path.join(PROJECT, '.claude', 'machinery');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, data] of [['observations.json', obs], ['tool-catalog.json', cat]]) {
    const f = path.join(dir, name);
    if (data) fs.writeFileSync(f, JSON.stringify(data)); else fs.rmSync(f, { force: true });
  }
  return PROJECT;
}

// A project-declared off-the-shelf tool, for the overlay path. The universal entries are exercised
// separately below (ruling I1): until then `pytest` and `npm install` were NOISY and `git commit`
// INFRA before the assimilator was ever consulted, so the catalog branch of decide() was reachable
// from quiet.mjs only through the project's own overlay — the final review's I1.
const TESTQ = { testq: { match: { type: 'prefix', value: 'scripts/testq.sh' }, outcome: '^MERGE GATE', candidates: ['--quiet'] } };

// Ruling I1 (owner, 2026-09-05): a verified catalog entry is the authority, and classify() reports
// plain for it. The final review MEASURED the hook answering filter / filter / infra for these three
// with a record saying each is noisy and its candidate untried, while decide() on the same inputs
// said suggest. This is that reproduction: the spec's central claim — "a known tool's first noisy
// pass is suggest-only, and unwrapped" — has to hold for the tools the shipped catalog knows.
test("I1: the universal catalog's suggest state is reachable from the hook", () => {
  const noisyUntried = (id) => ({ [id]: { identity: 'catalog', noisy: true, lines: 900, ledger: {} } });
  for (const [id, c] of [['pytest', 'pytest tests/'], ['npm-install', 'npm install'], ['git-commit', 'git commit -m x']]) {
    const root = project(noisyUntried(id));
    const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) });
    const u = out(r.stdout).updatedInput;
    assert.match(u.command, /--mode suggest/, c);
    assert.equal(u.description, 'd [quiet:suggest]', c);
  }
});

test('a plain-classified command with no observation history is wrapped in observe mode', () => {
  const root = project(null, TESTQ);
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'scripts/testq.sh --workspace') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /--mode observe/);
  assert.equal(u.description, 'd [quiet:observe]');
});

test('an unrecognised bespoke command with no history is observed too — unknown volume is not quiet', () => {
  const root = project(null);
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.match(out(r.stdout).updatedInput.command, /--mode observe/);
});

test('a command whose own record says it is quiet is left untouched', () => {
  const root = project({ 'bash scripts/battery.sh': { identity: 'bespoke', noisy: false, lines: 3, ledger: {} } });
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('a bespoke command recorded noisy is wrapped in filter mode', () => {
  const root = project({ 'bash scripts/battery.sh': { identity: 'bespoke', noisy: true, lines: 1400, ledger: {} } });
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.match(out(r.stdout).updatedInput.command, /--mode filter/);
});

test('an off-the-shelf tool recorded noisy with an untried candidate is wrapped in suggest mode', () => {
  const root = project({ testq: { identity: 'catalog', noisy: true, lines: 900, ledger: {} } }, TESTQ);
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'scripts/testq.sh --workspace') });
  assert.match(out(r.stdout).updatedInput.command, /--mode suggest/);
});

// Final review I2, both measured reproductions. A project catalog entry with no `match`, and a
// record whose `ledger` is a string, each took the hook down: empty stdout, empty stderr, exit 0 —
// not observed, not warned, and every command in the project lost assimilation until someone
// noticed. Hardened at the source: the entry is dropped and NAMED, the ledger reads as empty.
test('a malformed project catalog entry disables only itself, and is named on stderr (final review I2)', () => {
  const root = project(null, { testq: { outcome: '^MERGE GATE', candidates: ['--quiet'] } });
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.match(out(r.stdout).updatedInput.command, /--mode observe/, 'the command is still observed');
  assert.match(r.stderr, /testq/);
  assert.equal(r.stderr.trim().split('\n').length, 1, 'exactly one line');
});

// Re-review R4: the hook loaded the catalog (a git spawn and two file reads) for EVERY command,
// before classify() had said whether the catalog would be consulted at all. The load is lazy now:
// a command the chain answers before the catalog step never loads it. The observable, through the
// hook, is the I2 warning line above — it is printed by the load itself, so it appears for a
// command that reaches the catalog and not for one that does not; and "exactly one line" for the
// plain command is the proof the memoised load happens once, not once for classify() and again
// for the assimilator.
test('the catalog is loaded lazily: a read / piped / redirected / never command never loads it, a plain one loads it once (re-review R4)', () => {
  const root = project(null, { testq: { outcome: '^MERGE GATE', candidates: ['--quiet'] } });
  for (const c of ['cat big.txt', 'cargo build | tail -5', 'cargo build > log', 'pytest --help']) {
    const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c);
    assert.equal(r.stderr, '', `${c}: the malformed-entry line means the catalog was loaded for a command that never reaches it`);
  }
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'bash scripts/battery.sh') });
  assert.match(out(r.stdout).updatedInput.command, /--mode observe/);
  assert.match(r.stderr, /testq/, 'positive control: the same catalog IS loaded, and named, for a command that reaches it');
  assert.equal(r.stderr.trim().split('\n').length, 1, 'loaded once per hook run — classify() and the assimilator share the load');
});

test('a hand-edited ledger that is not an object is data: the tool is still suggested to', () => {
  const root = project({ testq: { identity: 'catalog', noisy: true, lines: 900, ledger: 'hand-edited' } }, TESTQ);
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'scripts/testq.sh --workspace') });
  assert.match(out(r.stdout).updatedInput.command, /--mode suggest/);
});

test('RED CHECK: a clean run prints nothing on stderr — the warning line is not always there', () => {
  const root = project(null, TESTQ);
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'scripts/testq.sh --workspace') });
  assert.match(out(r.stdout).updatedInput.command, /--mode observe/);
  assert.equal(r.stderr, '');
});

// ---- Issue #13: a compound is classified and wrapped per segment ----
// Owner, 2026-09-05: "i would apply the rules to inside the compound. so each outputter gets
// wrapped. since it's && and not a pipe, it theoretically should be no problem." The final review
// measured the whole-command rule's cost: the catalog's `pytest` prefix claimed `pytest tests/ &&
// cargo build` as one plain command, so the build ran unfiltered on the observe pass. Now every
// segment with a mode gets its own runner and its own cmdfile, the segments without one stay
// verbatim, and the separators are rejoined exactly as written — bash then runs its own `&&`, `||`
// and `;` over the runners, each of which exits with its child's real code.
const RUNNER = /node "[^"]*quiet-run\.mjs" --shell bash --mode (\w+) "([^"]+)"/g;
// The rewritten command with each runner reduced to `<mode>`, and the runners in order with what
// each one's cmdfile holds — the expectations are the input's own segments, not the hook's answer.
const skeleton = (cmd) => cmd.replace(RUNNER, '<$1>');
const runners = (cmd) => [...cmd.matchAll(RUNNER)].map((m) => ({ mode: m[1], text: fs.readFileSync(m[2], 'utf8') }));

test('#13: each output producer in a compound gets its own runner, in its own mode, joined as written', () => {
  const root = project({ pytest: { identity: 'catalog', noisy: true, lines: 900, ledger: {} } });
  const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', 'pytest tests/ && cargo build') });
  const u = out(r.stdout).updatedInput;
  assert.equal(skeleton(u.command), '<suggest> && <filter>');
  assert.deepEqual(runners(u.command), [{ mode: 'suggest', text: 'pytest tests/' }, { mode: 'filter', text: 'cargo build' }]);
  assert.equal(u.description, 'd [quiet:suggest,filter]');
});

test('#13: a byte-mover segment stays verbatim beside a wrapped one, and the separator keeps its spelling', () => {
  for (const [c, want, texts] of [
    ['cat a && cargo build', 'cat a && <filter>', ['cargo build']],
    ['cargo build; echo done', '<filter>; echo done', ['cargo build']],
    ['cargo build  ||  echo failed', '<filter>  ||  echo failed', ['cargo build']],
  ]) {
    const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', c) });
    const u = out(r.stdout).updatedInput;
    assert.equal(skeleton(u.command), want, c);
    assert.deepEqual(runners(u.command).map((x) => x.text), texts, c);
    assert.equal(u.description, 'd [quiet:filter]', c);
  }
});

test('#13: a pipe is one unit and stays untouched; the segment after it is still wrapped', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo test | tail -5 && cargo build') });
  const u = out(r.stdout).updatedInput;
  assert.equal(skeleton(u.command), 'cargo test | tail -5 && <filter>');
  assert.deepEqual(runners(u.command).map((x) => x.text), ['cargo build']);
});

test('#13: a compound in which no segment earns a mode is untouched — nothing is emitted', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cat a && ls') });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
});

test('#13: a backgrounded segment is never wrapped — two runners would race on the observation record', () => {
  // `cargo build & cat x`: the build is followed by a lone `&`, so it is left alone, and `cat x` is
  // a byte-mover — nothing to wrap, nothing emitted. The positive control beside it proves the `&`
  // is what spared the build, not the compound: the same build followed by `&&` is wrapped.
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo build & cat x') });
  assert.equal(r.stdout, ''); assert.equal(r.code, 0);
  const p = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo build & cargo test') });
  const u = out(p.stdout).updatedInput;
  assert.equal(skeleton(u.command), 'cargo build & <filter>', 'the foreground segment after a backgrounded one is still wrapped');
  assert.deepEqual(runners(u.command).map((x) => x.text), ['cargo test']);
});

test('#13: the PowerShell shell keeps whole-command behaviour — 5.1 has no && or ||', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-PowerShell', 'cargo build; echo done') });
  const u = out(r.stdout).updatedInput;
  assert.match(u.command, /^node "[^"]*quiet-run\.mjs" --shell powershell --mode filter "[^"]+"; exit \$LASTEXITCODE$/);
  assert.equal(fs.readFileSync(u.command.match(/"([^"]+)"; exit/)[1], 'utf8'), 'cargo build; echo done', 'one cmdfile, holding the whole command');
  assert.equal(u.description, 'd [quiet:filter]');
});

// Through real bash: a wrapped segment's exit code is what the shell's own `&&` and `||` see.
// `node -e` is bespoke; a record saying it is noisy makes the hook wrap it in filter mode, and the
// runner then exits with the child's real code — 7 here — because each runner is one segment.
// Both rewrites are taken BEFORE either runs: the first real run records `node` as quiet (0 lines),
// which is the assimilator doing its job, and a hook call after it would rightly leave the second
// compound alone. One non-login shell runs both, echoing the `&&` list's status between them — a
// second shell start would be paid for nothing (pre-commit budget).
const BASH = ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find((b) => fs.existsSync(b)) ?? (process.platform !== 'win32' ? 'bash' : null);
// A skipped run of a real-bash test is unproven, not passed: the name says so where the skip shows.
const unproven = (name) => (BASH ? name : `UNPROVEN (no bash on this machine, skipped): ${name}`);
const rewriteIn = (root, c) => out(runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) }).stdout).updatedInput.command;
// Keyed by the generalized form of the command below (#87): the runner, its flag name, and the
// one-off script as a value.
const NOISY_NODE = { 'node -e %s': { identity: 'bespoke', noisy: true, lines: 1400, ledger: {} } };
test(unproven('#13: the compound keeps its control flow — && short-circuits on the wrapped segment\'s real exit code, || takes it'), { skip: !BASH }, () => {
  const root = project(NOISY_NODE);
  const rewrite = (c) => rewriteIn(root, c);
  const and = rewrite('node -e "process.exit(7)" && echo never');
  const or = rewrite('node -e "process.exit(7)" || echo fallback');
  assert.equal(skeleton(and), '<filter> && echo never');
  assert.equal(skeleton(or), '<filter> || echo fallback');
  const r = execFileSync(BASH, ['-c', `${and}; echo "and=$?"; ${or}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(r, 'and=7\nfallback\n', 'the && list exits 7 and never ran its second segment; the || list ran its fallback');
});

test('RED CHECK: two wrapped segments get two different cmdfiles, each holding only its own segment', () => {
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo build && cargo test') });
  const u = out(r.stdout).updatedInput;
  const files = [...u.command.matchAll(RUNNER)].map((m) => m[2]);
  assert.equal(files.length, 2);
  assert.notEqual(files[0], files[1]);
  assert.deepEqual(files.map((f) => fs.readFileSync(f, 'utf8')), ['cargo build', 'cargo test']);
  assert.equal(u.description, 'd [quiet:filter,filter]');
});

// ---- Fix round 1 for #13 (controller's amendment after review, 2026-09-05) ----

// A. Per-segment applies only to a compound of simple commands; anything else takes the whole-command
// path exactly as `main` does it. The reviewer measured these through the hook: three runners for
// `if cargo build; then echo ok; fi` and a syntax error from bash; a heredoc whose body lines each
// became a runner, so the file received runner invocations. Pinned against main's own hook: the
// pre-#13 quiet.mjs is taken from history, its lib imports pointed at the live lib, and run on the
// same payloads; the rewritten shapes must be equal modulo cmdfile names.
const MAIN_HOOK = (() => {
  const src = execFileSync('git', ['show', 'dd229c0:plugins/machinery/scripts/quiet.mjs'], { cwd: PLUGIN, encoding: 'utf8' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-main-hook-'));
  const f = path.join(dir, 'quiet-main.mjs');
  fs.writeFileSync(f, src.replace(/'\.\/lib\//g, `'${pathToFileURL(path.join(PLUGIN, 'scripts', 'lib')).href}/`));
  return f;
})();
const shapeOf = (stdout) => {
  if (stdout === '') return '';
  const u = out(stdout).updatedInput;
  const command = u.command.replace(/"([^"]*cmd-[^"]*)"/g, (_, f) => `<CMDFILE:${JSON.stringify(fs.readFileSync(f, 'utf8'))}>`).replace(/"[^"]*quiet[^"]*\.mjs"/g, '<RUNNER>');
  return `${command} :: ${u.description}`;
};
const hookShape = (script, root, c) => {
  const r = spawnSync(process.execPath, [script], { cwd: root, input: fixture('PreToolUse-Bash', c), encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN } });
  return shapeOf(r.stdout);
};
const LIVE_HOOK = path.join(PLUGIN, 'scripts', 'quiet.mjs');
const NOT_SIMPLE = [
  'if cargo build; then echo ok; fi',
  'for f in a b; do cargo build; done',
  '(node -e "process.exit(3)" || echo fell-through); echo "exit=$?"',
  '{ cargo build && cargo test; }',
  'X=$(cargo build && cargo test); echo $X',
  '[[ -f a && -f b ]] && cargo build',
  'cargo build \\\n--release && cargo test',
  "cat > notes.md <<'EOF'\n# Title\nsome text\nEOF",
  "python3 - <<'EOF'\nprint(1)\nEOF",
];
test('#13 fix 1 (A): a compound that is not made of simple commands takes the whole-command path — the exact shape main produces', () => {
  const root = project(null);
  for (const c of NOT_SIMPLE) {
    const want = hookShape(MAIN_HOOK, root, c);
    assert.equal(hookShape(LIVE_HOOK, root, c), want, c);
    assert.doesNotMatch(want, /<CMDFILE:[^>]*>.*<CMDFILE:/, `${c}: main wraps at most once, so the pin is against one runner`);
  }
});
test('RED CHECK (A): the pin is live — main and the per-segment hook disagree on a simple compound', () => {
  const root = project(null);
  const c = 'cat a && cargo build';
  assert.notEqual(hookShape(MAIN_HOOK, root, c), hookShape(LIVE_HOOK, root, c));
  assert.equal(hookShape(LIVE_HOOK, root, c), 'cat a && node <RUNNER> --shell bash --mode filter <CMDFILE:"cargo build"> :: d [quiet:filter]');
});

// B. A state-mutating segment whose effect crosses a process boundary (`export`) is left verbatim,
// so its effect lands in the shell that runs the segment after it. Measured by the reviewer with
// both wrapped: `var=undefined`. Fix round 2 narrowed this: `source` does NOT cross (the sourced
// file's exports only reach a child of the shell that sourced it), so a compound carrying it takes
// the whole-command path — one runner, one shell — and the effect still arrives, as on main.
test(unproven('#13 fix 1 (B): export stays verbatim per segment, source sends the compound down the whole-command path; both effects reach the node after them'), { skip: !BASH }, () => {
  const root = project(NOISY_NODE);
  fs.writeFileSync(path.join(root, 'vars.sh'), 'export PROBE2=fromfile\n');
  const a = rewriteIn(root, 'export PROBE_VAR=set && node -e "console.log(\'var=\' + process.env.PROBE_VAR)"');
  const b = rewriteIn(root, 'source ./vars.sh && node -e "console.log(\'file=\' + process.env.PROBE2)"');
  assert.equal(skeleton(a), 'export PROBE_VAR=set && <filter>');
  assert.equal(skeleton(b), '<observe>', 'fix round 2: one runner for the whole compound');
  assert.deepEqual(runners(b).map((x) => x.text), ['source ./vars.sh && node -e "console.log(\'file=\' + process.env.PROBE2)"'], 'holding all of it');
  const r = execFileSync(BASH, ['-c', `${a}; ${b}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(r, 'var=set\nfile=fromfile\n');
});

// C. `&` backgrounds the whole AND-OR list that ends at it, not the last segment. Measured by the
// reviewer: `cargo build && cargo test & cargo bench` wrapped the build, which then ran alongside
// the bench's runner — the exact record race the rule exists to prevent.
test('#13 fix 1 (C): nothing in a backgrounded AND-OR list is wrapped; the list after the & still is', () => {
  for (const [c, want, texts] of [
    ['cargo build && cargo test & cargo bench', 'cargo build && cargo test & <filter>', ['cargo bench']],
    ['cargo build || cargo test & cargo bench', 'cargo build || cargo test & <filter>', ['cargo bench']],
    ['cargo build; cargo test &', '<filter>; cargo test &', ['cargo build']],
  ]) {
    const u = out(runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', c) }).stdout).updatedInput;
    assert.equal(skeleton(u.command), want, c);
    assert.deepEqual(runners(u.command).map((x) => x.text), texts, c);
  }
  const r = runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', 'cargo build && cargo test &') });
  assert.equal(r.stdout, '', 'a whole list backgrounded: untouched entirely');
});

// ---- Fix round 2 for #13 (controller's amendment after re-review, 2026-09-05) ----

// A. A `#` comment is a span: separators inside it are data. Measured by the reviewer:
// `echo "a" ; # comment && node -e …` printed `a` and then ran the node from inside the comment.
test('#13 fix 2 (A): a comment-only remainder is never wrapped, and a separator inside a comment never splits', () => {
  const root = project(NOISY_NODE);
  for (const c of ['echo "a" ; # comment && node -e "console.log(\'ran-from-comment\')"', '# skip: cargo clean && rm -rf target']) {
    const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c); assert.equal(r.code, 0, c);
  }
  for (const [c, want] of [
    ['echo "#not a comment" && cargo build', 'echo "#not a comment" && <filter>'],
    ['echo a#b && cargo build', 'echo a#b && <filter>'],
    ['cargo build\n# note\ncargo test', '<filter>\n# note\n<filter>'],
  ]) {
    const u = out(runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) }).stdout).updatedInput;
    assert.equal(skeleton(u.command), want, c);
  }
});

// B. Only exported env, cwd, umask and ulimit cross into a runner's fresh shell. A bare assignment,
// `source`, `set`, `shopt`, … do not, so a compound carrying one takes the whole-command path — one
// runner, one shell — pinned against main's hook like the constructs above. Measured by the
// reviewer with the segments apart: `bare=`, `sub=`, `argc=1` where main gives `bare=assigned`,
// `sub=sub`, `argc=0`.
const LOCAL_STATE = [
  'PROBE3=assigned; node -e "console.log(\'bare=\' + process.argv[1])" "$PROBE3"',
  'PROBE4=$(node -e "process.stdout.write(\'sub\')") && node -e "console.log(\'sub=\' + process.argv[1])" "$PROBE4"',
  'shopt -s nullglob; node -e "console.log(\'argc=\' + (process.argv.length - 1))" *.nomatch',
  'VER=$(git describe); cargo build --features "$VER"',
];
test('#13 fix 2 (B): a non-crossing state segment sends the whole compound down main\'s path — one runner holding all of it', () => {
  const root = project(NOISY_NODE);
  for (const c of LOCAL_STATE) {
    const want = hookShape(MAIN_HOOK, root, c);
    assert.equal(hookShape(LIVE_HOOK, root, c), want, c);
    assert.match(want, /^node <RUNNER> --shell bash --mode \w+ <CMDFILE:"[^]*"> :: d \[quiet:\w+\]$/, `${c}: one runner, the whole compound in its cmdfile`);
  }
});
test(unproven('#13 fix 2 (B): through real bash, a bare assignment, a substitution and shopt reach the command after them, as on main'), { skip: !BASH }, () => {
  const root = project(NOISY_NODE);
  const cmds = LOCAL_STATE.slice(0, 3).map((c) => rewriteIn(root, c));
  const r = execFileSync(BASH, ['-c', cmds.join('; ')], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(r, 'bare=assigned\nsub=sub\nargc=0\n');
});

// ---- Fix round 3 for #13 (controller's ruling after re-review of round 2, 2026-09-05) ----
// A leading comment was folded onto the first segment's text, and the predicate judged the
// prefixed text: the comment masks to FILL, `\s` does not match it, and the local-state lead was
// never seen. Measured: `# first\nX=1; node … "$X"` went per-segment and printed `x=`.
const LED_LOCAL = '# first\nX=1; node -e "console.log(\'x=\' + process.argv[1])" "$X"';
test('#13 fix 3: a leading comment does not hide a local-state lead — the compound takes main\'s path, pinned', () => {
  const root = project(NOISY_NODE);
  const want = hookShape(MAIN_HOOK, root, LED_LOCAL);
  assert.equal(hookShape(LIVE_HOOK, root, LED_LOCAL), want);
  assert.match(want, /^node <RUNNER> --shell bash --mode \w+ <CMDFILE:"# first\\nX=1; /, 'one runner, the comment and the assignment inside its cmdfile');
});
test(unproven('#13 fix 3: through real bash, the led assignment reaches the node after it'), { skip: !BASH }, () => {
  const root = project(NOISY_NODE);
  const r = execFileSync(BASH, ['-c', rewriteIn(root, LED_LOCAL)], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(r, 'x=1\n');
});
test('#13 fix 3: the lead is preserved where it was — a leading comment line is emitted verbatim before the first runner', () => {
  const u = out(runScript('scripts/quiet.mjs', { stdin: fixture('PreToolUse-Bash', '# first\ncargo build && cargo test') }).stdout).updatedInput;
  assert.equal(skeleton(u.command), '# first\n<filter> && <filter>');
  assert.deepEqual(runners(u.command).map((x) => x.text), ['cargo build', 'cargo test'], 'neither cmdfile carries the comment');
});

test('RED CHECK: the NEVER exemption survives plain no longer meaning untouched', () => {
  // classify() returns 'plain' for a NEVER-listed command exactly as it does for an unrecognised
  // one, so routing every 'plain' to the assimilator would put `--version` in the observation
  // record and wrap an already-wrapped command in a second wrapper — the precise failure the
  // NEVER list exists to prevent, and one no test above could see.
  const root = project(null);
  for (const c of ['cargo --version', 'pytest --help', 'node "C:/x/quiet-run.mjs" --shell bash --mode observe "C:/x/cmd.txt"']) {
    const r = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture('PreToolUse-Bash', c) });
    assert.equal(r.stdout, '', c);
  }
});
