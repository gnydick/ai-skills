import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript as spawnScript } from './helpers/run.mjs';
import { decide } from '../scripts/lib/assimilate.mjs';

// A "command" that prints N lines of chatter plus one error and exits with a code — via node so it is shell-agnostic.
const gen = (n, code) => `node -e "for(let i=0;i<${n};i++)console.log('   Compiling c'+i);console.log('error: boom');process.exit(${code})"`;
const bash = fs.existsSync('C:/Program Files/Git/bin/bash.exe') || process.platform !== 'win32';

// The runner now WRITES an observation record for the project it is run in, and helpers/run.mjs
// defaults cwd to this checkout — so an unqualified case here would deposit its `node -e` fixture
// keys in the developer's own project record. MEASURED: the first run of these tests created
// `<checkout>/.claude/machinery/observations.json`. Every case that does not name a repository of
// its own therefore gets a scratch directory outside any repository, which is also the degradation
// path (projectRoot() throws, nothing is recorded, the command still prints) — so the legacy cases
// below exercise it for free. A case that passes its own cwd still wins.
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-run-scratch-'));
const runScript = (script, opts = {}) => spawnScript(script, { cwd: SCRATCH, ...opts });

test('short output is verbatim in filter mode (test_short_output_is_verbatim_threshold)', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(5, 0)] });
  assert.equal(r.code, 0);
  assert.ok(!r.stdout.startsWith('[quiet:'));
  assert.equal(r.stdout.trim().split('\n').length, 6);
});

test('long output is filtered, header states counts, exit status preserved', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(100, 3)] });
  assert.equal(r.code, 3);
  const [header, ...rest] = r.stdout.trim().split('\n');
  assert.match(header, /^\[quiet:filter\] exit=3 {2}\d+\.\ds {2}101 lines -> \d+ shown {2}full log: /);
  assert.ok(rest.some((l) => l === 'error: boom'));
  assert.ok(rest.length < 20);
});

test('infra mode on success shows proof lines only; the log file has everything', { skip: !bash }, () => {
  const cmd = `node -e "console.log('remote: chatter');console.log('Already up to date.')"`;
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'infra', '-c', cmd] });
  const [header, ...rest] = r.stdout.trim().split('\n');
  assert.deepEqual(rest, ['Already up to date.']);
  const log = header.split('full log: ')[1];
  assert.ok(fs.readFileSync(log, 'utf8').includes('remote: chatter'));
});

test('opt-out env prints verbatim', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(100, 0)], env: { MACHINERY_QUIET: '0' } });
  assert.equal(r.stdout.trim().split('\n').length, 101);
});

test('cmdfile form is read then deleted', { skip: !bash }, () => {
  const f = path.join(os.tmpdir(), `cmd-${Date.now()}.txt`);
  fs.writeFileSync(f, gen(2, 0));
  runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', f] });
  assert.ok(!fs.existsSync(f));
});

test('a missing cmdfile is refused with a reason on stderr, not a stack trace (final review E)', () => {
  const f = path.join(os.tmpdir(), `cmd-does-not-exist-${Date.now()}.txt`);
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', f] });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /quiet-run: cannot read/);
  assert.doesNotMatch(r.stderr, /at Object\.readFileSync/); // no raw stack trace leaking to stderr
});

test('RED CHECK: an unknown shell is refused (spec I21)', () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'zsh', '--mode', 'filter', '-c', 'echo x'] });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /shell/);
});

test('an unwritable log directory does not swallow output or exit status (failure-open)', { skip: !bash }, () => {
  // Point CLAUDE_JOB_DIR at a temp dir whose "tmp" entry is a regular FILE, so the
  // log directory can never be created — the wrapper must still print the filtered
  // output and preserve the command's own exit status.
  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-run-nodir-'));
  fs.writeFileSync(path.join(jobDir, 'tmp'), 'not a directory');
  const r = runScript('scripts/quiet-run.mjs', {
    args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(100, 3)],
    env: { CLAUDE_JOB_DIR: jobDir },
  });
  assert.equal(r.code, 3);
  const [header, ...rest] = r.stdout.trim().split('\n');
  assert.match(header, /^\[quiet:filter\]/);
  assert.match(header, /full log: \(unavailable:/);
  assert.ok(rest.some((l) => l === 'error: boom'));
  fs.rmSync(jobDir, { recursive: true, force: true });
});

// ---- Task 2: capture via lib/capture.mjs (stream separation, always-verbatim modes) ----

test('stderr and stdout both reach the log, each tagged, in real arrival order', { skip: !bash }, () => {
  // Spaced writes: the point of the record log is arrival order, and only writes the parent
  // has demonstrably drained between can prove ordering rather than poll-readiness luck.
  const cmd = `node -e "console.error('e1');setTimeout(()=>{console.log('o1');setTimeout(()=>console.error('e2'),150)},150)"`;
  // infra mode is never verbatim, so a header (and with it the log path) always exists.
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'infra', '-c', cmd] });
  const log = r.stdout.trim().split('\n')[0].split('full log: ')[1];
  const body = fs.readFileSync(log, 'utf8').trim().split('\n').slice(1); // drop the "$ cmd" line
  assert.deepEqual(body.map((l) => l.replace(/^\d+\.\d+ /, '')), ['err  e1', 'out  o1', 'err  e2']);
});

test('observe mode is always verbatim regardless of line count', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'observe', '-c', gen(100, 0)] });
  assert.equal(r.stdout.trim().split('\n').length, 101); // 100 chatter + 1 error line from gen()
});

test('RED CHECK: suggest mode is verbatim even over threshold — a trial run must never be filtered', { skip: !bash }, () => {
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'suggest', '-c', gen(100, 0)] });
  // 100 chatter lines + 1 error line from gen() = 101; verbatim means all 101 appear, not a
  // filtered ~10-line render. This is the exact case the backwards verbatim condition broke.
  // Task 7 appends exactly one suggestion line after them, so the total is 102 and the split is
  // asserted rather than the total: the 101 are still checked for being verbatim, not summarised.
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines.length, 102);
  assert.match(lines[101], /^\[quiet:suggest\]/);
  assert.ok(!lines.slice(0, 101).some((l) => l.startsWith('[quiet:')), 'the output itself is untouched');
});

test('RED CHECK: displayed lines still go through normalise — ANSI stripped, CR-overwrite collapsed', { skip: !bash }, () => {
  // Guards the deviation reported in task-2-report.md: the brief's sample fed records[].text
  // straight to the display path, silently dropping filter.mjs's normalise() and with it ANSI
  // stripping, CR-overwrite collapsing and trailing-whitespace trimming.
  // Built from char codes so no backslash escape has to survive JS -> bash -> node -e intact.
  const cmd = `node -e "const E=String.fromCharCode(27),CR=String.fromCharCode(13),NL=String.fromCharCode(10);process.stdout.write(E+'[32mgreen'+E+'[0m'+NL);process.stdout.write('a'+CR+'b   '+NL)"`;
  const r = runScript('scripts/quiet-run.mjs', { args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd] });
  assert.deepEqual(r.stdout.trim().split('\n'), ['green', 'b']);
});

// ---- Task 7: the run records what it saw, keeps the tool's declared answer, and suggests ----

// A real repository per test: projectRoot() answers by asking git for the common dir, so the
// record's location is resolved exactly the way it is in production rather than through a
// test-only environment override that only one of the two hook scripts would honour.
const repo = (prefix) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execFileSync('git', ['init', '-q'], { cwd: d });
  return d;
};
const seed = (root, name, data) => {
  const dir = path.join(root, '.claude', 'machinery');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data));
};
const obsOf = (root) => JSON.parse(fs.readFileSync(path.join(root, '.claude', 'machinery', 'observations.json'), 'utf8'));

test('a run records its observation under the bespoke key derived from the command itself', { skip: !bash }, () => {
  // matchTool()/bespokeKey() operate on the command TEXT, and a `node -e "..."` fixture is not a
  // real off-the-shelf invocation: it resolves as bespoke, keyed by its own leading non-flag
  // token. The assertion is on that real key, not on a catalog id the fixture never matches.
  const root = repo('quiet-run-record-');
  const cmd = `node -e "for(let i=0;i<80;i++)console.log('noise');console.log('done')"`;
  runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd] });
  const obs = obsOf(root);
  assert.equal(obs['node'].identity, 'bespoke');
  assert.equal(obs['node'].noisy, true); // 81 lines > PASS_THROUGH_LINES (40)
  assert.equal(obs['node'].lines, 81);
  assert.ok(obs['node'].stdoutLines > 0);
});

test('suggest mode prints the recommendation after verbatim output', { skip: !bash }, () => {
  const root = repo('quiet-run-suggest-');
  const r = runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'suggest', '-c', 'echo real-output'] });
  assert.match(r.stdout, /^real-output\n\[quiet:suggest\]/);
});

test('RED CHECK: the suggested flag is the one decide() picked, not one already in the command', { skip: !bash }, () => {
  // matchedCandidate() answers "which candidate is ALREADY present in this command". In the
  // suggest state that is null by construction — decide() routes a command that carries a
  // candidate to observe instead — so sourcing the recommendation from it prints an empty
  // suggestion on every single suggest run, and no line-count assertion would ever notice.
  const root = repo('quiet-run-flag-');
  seed(root, 'tool-catalog.json', { echoer: { match: { type: 'prefix', value: 'echo ' }, outcome: '^real-output$', candidates: ['--quiet'] } });
  seed(root, 'observations.json', { echoer: { identity: 'catalog', noisy: true, lines: 900, ledger: {} } });
  const r = runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'suggest', '-c', 'echo real-output'] });
  assert.match(r.stdout, /^real-output\n\[quiet:suggest\] echoer .*--quiet\n$/);
});

test("RED CHECK: a catalog tool's declared outcome line survives filtering the generic rules would drop", { skip: !bash }, () => {
  // Design verification item 7, at the wiring seam rather than inside select(): the pattern has to
  // actually reach select() from the catalog. `ANSWER 42` matches no SUMMARY, KEYWORD or
  // PROOF_LINE rule and sits at line 11 of 101, far outside the tail — so the positive control
  // below (same command, no catalog entry) proves the generic contract really does lose it.
  const cmd = `node -e "for(let i=0;i<100;i++){if(i===10)console.log('ANSWER 42');console.log('   Compiling c'+i)}"`;
  const control = repo('quiet-run-outcome-control-');
  const c = runScript('scripts/quiet-run.mjs', { cwd: control, args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd] });
  assert.doesNotMatch(c.stdout, /ANSWER 42/, 'positive control: without a declared outcome the line is dropped');
  const root = repo('quiet-run-outcome-keep-');
  seed(root, 'tool-catalog.json', { probe: { match: { type: 'prefix', value: 'node ' }, outcome: '^ANSWER 42$', candidates: [] } });
  const r = runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd] });
  assert.match(r.stdout, /ANSWER 42/);
});

test('RED CHECK: a real git-commit --quiet trial is recorded insufficient — it drops the outcome line entirely', { skip: !bash }, () => {
  // Real repo, real git, real --quiet — not a simulated line count. This is the exact measured
  // case from Task 4's report: `git commit --quiet` prints NOTHING, so a line-count-only
  // sufficiency check would wrongly call it sufficient forever.
  const root = repo('quiet-run-commit-');
  // The identity goes in the repo config, NOT on the command line: `git -c user.email=... commit`
  // does not match the catalog's `^git\s+commit\b`, so a -c form would resolve as the bespoke
  // key `git` and never touch the git-commit ledger this test is about.
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'seed'], { cwd: root });
  fs.writeFileSync(path.join(root, 'a.txt'), 'x');
  execFileSync('git', ['add', 'a.txt'], { cwd: root });
  runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'observe', '-c', 'git commit -m bare'] });
  const bare = obsOf(root)['git-commit'];
  assert.equal(bare.identity, 'catalog');
  assert.ok(bare.lines > 0, 'a bare commit prints its own summary');
  fs.writeFileSync(path.join(root, 'b.txt'), 'y');
  execFileSync('git', ['add', 'b.txt'], { cwd: root });
  runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'observe', '-c', 'git commit --quiet -m quiet'] });
  const obs = obsOf(root);
  assert.equal(obs['git-commit'].ledger['--quiet'], 'insufficient', 'a flag that deletes the outcome line must never be marked sufficient');
  assert.equal(obs['git-commit'].lines, bare.lines, "a trial run must not overwrite the bare tool's own measurement");
});

test('RED CHECK: a candidate hiding inside another argument is not a trial, and a trial before any bare run fabricates nothing (final review I3)', { skip: !bash }, () => {
  // The review's exact reproduction: candidates ['-q'], command carrying `x-quality` — substring
  // matching called it a trial of -q and wrote {noisy:false, ledger:{'-q':'sufficient'}} for a flag
  // never applied, parking the tool in plain forever. Now it is what it is: a bare run.
  const root = repo('quiet-run-substring-');
  seed(root, 'tool-catalog.json', { q: { match: { type: 'prefix', value: 'node ' }, outcome: '^x-quality$', candidates: ['-q'] } });
  runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'observe', '-c', `node -e "console.log('x-quality')"`] });
  const bare = obsOf(root).q;
  assert.deepEqual(bare.ledger, {}, 'no verdict for a flag that was never on the command');
  assert.equal(bare.noisy, false, 'a bare run measures the bare tool');
  assert.equal(bare.lines, 1);
  // A genuine trial with no bare run before it: the verdict is recorded, the measurement is not invented.
  const trial = repo('quiet-run-trialfirst-');
  seed(trial, 'tool-catalog.json', { e: { match: { type: 'prefix', value: 'echo ' }, outcome: '^x-quality', candidates: ['-n'] } });
  runScript('scripts/quiet-run.mjs', { cwd: trial, args: ['--shell', 'bash', '--mode', 'observe', '-c', 'echo -n x-quality'] });
  const rec = obsOf(trial).e;
  assert.equal(rec.ledger['-n'], 'sufficient');
  assert.ok(!('noisy' in rec), `noisy must be absent, got ${JSON.stringify(rec.noisy)}`);
  assert.equal(decide('echo x-quality', { catalog: { e: { match: { type: 'prefix', value: 'echo ' }, candidates: ['-n'] } }, observations: obsOf(trial) }).mode, 'observe', 'unseen until a bare run lands');
});

test('the first wrapped run in a repository that was never installed leaves observations.json gitignored (final review I6)', { skip: !bash }, () => {
  // saveObservations() is the site that creates the file, so it is the site that ensures the ignore
  // entry — install.mjs only ever ran in projects someone installed, and the file appears in every
  // project the moment the plugin updates. Ruling 2026-09-05: per-machine measurement, never tracked.
  const root = repo('quiet-run-ignore-');
  const r1 = runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'observe', '-c', 'echo one'] });
  assert.equal(r1.code, 0);
  const ignored = execFileSync('git', ['check-ignore', '.claude/machinery/observations.json'], { cwd: root, encoding: 'utf8' });
  assert.match(ignored, /observations\.json/);
  assert.match(r1.stderr, /observations\.json .*\.gitignore/, 'the first run says it added the ignore entry');
  const r2 = runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'observe', '-c', 'echo two'] });
  assert.equal(r2.stderr, '', 'RED CHECK: said once, on creation, not on every run');
  assert.equal(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), '.claude/machinery/observations.json\n', 'one line, once');
});

test('RED CHECK: outside a git checkout the command still prints and still returns its exit code', { skip: !bash }, () => {
  // projectRoot() throws when cwd is not inside a repository, and that is data, not a broken
  // invariant. Resolving it before the output is written turns "no observation record available"
  // into "the command produced nothing and exited 1" — losing both the output and the exit
  // status the wrapper exists to pass through.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-run-norepo-'));
  const r = runScript('scripts/quiet-run.mjs', { cwd: dir, args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(5, 3)] });
  assert.equal(r.code, 3);
  assert.equal(r.stdout.trim().split('\n').length, 6);
  assert.ok(!fs.existsSync(path.join(dir, '.claude')));
});

test('RED CHECK: an unusable catalog entry warns and degrades, it does not eat the output', { skip: !bash }, () => {
  // A project catalog is machine-written and hand-editable, so both a malformed pattern and a
  // missing `outcome` are reachable. The first throws out of `new RegExp`; the second would become
  // `new RegExp(undefined)` — that is /undefined/, which quietly keeps any line with that word in
  // it. Neither may cost the command its output or its exit status, and the first is SAID.
  const root = repo('quiet-run-badcatalog-');
  seed(root, 'tool-catalog.json', { broken: { match: { type: 'prefix', value: 'node ' }, outcome: '^(unclosed', candidates: ['--quiet'] } });
  const r = runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'filter', '-c', gen(5, 3)] });
  assert.equal(r.code, 3);
  assert.equal(r.stdout.trim().split('\n').length, 6);
  assert.match(r.stderr, /quiet-run: unusable tool catalog/);
  assert.equal(obsOf(root)['node'].identity, 'bespoke', 'an unusable entry is not a tool this run knows anything about');

  const noOutcome = repo('quiet-run-nooutcome-');
  seed(noOutcome, 'tool-catalog.json', { silent: { match: { type: 'prefix', value: 'node ' }, candidates: [] } });
  const cmd = `node -e "for(let i=0;i<60;i++)console.log('   Compiling undefined c'+i);console.log('done')"`;
  const n = runScript('scripts/quiet-run.mjs', { cwd: noOutcome, args: ['--shell', 'bash', '--mode', 'filter', '-c', cmd] });
  const shown = n.stdout.trim().split('\n');
  assert.match(shown[0], /61 lines -> \d+ shown/);
  assert.ok(shown.length < 10, `a missing outcome must not turn into /undefined/ and keep 60 chatter lines (kept ${shown.length})`);
});

test('RED CHECK: a corrupt observation record cannot cost a suggest run its output or its exit code', { skip: !bash }, () => {
  // observations.mjs promises in its own header that "a missing, truncated or hand-edited record is
  // data, not a broken invariant" — which only holds if every reader of that record agrees. A
  // hand-edited `ledger` that is a string rather than an object reached assimilate.mjs's
  // `!(c in ledger)` and threw `Cannot use 'in' operator`; the measured cost was total: the wrapped
  // command's real output vanished and its exit 7 came back as 1. The runner's fail-open caught
  // that; the final review (I2) then hardened the reader itself, so a string ledger now reads as
  // "no recorded attempts" and the run suggests the untried flag rather than warning. The try/catch
  // in the runner stays as the backstop for whatever else a hand edit can do.
  const root = repo('quiet-run-badrecord-');
  seed(root, 'tool-catalog.json', { runner: { match: { type: 'prefix', value: 'node ' }, outcome: '^real-output$', candidates: ['--quiet'] } });
  seed(root, 'observations.json', { runner: { identity: 'catalog', noisy: true, lines: 900, ledger: 'hand-edited-garbage' } });
  const cmd = `node -e "console.log('real-output');process.exit(7)"`;
  const r = runScript('scripts/quiet-run.mjs', { cwd: root, args: ['--shell', 'bash', '--mode', 'suggest', '-c', cmd] });
  assert.equal(r.code, 7, 'the command’s own exit status survives an unreadable record');
  assert.match(r.stdout, /^real-output\n\[quiet:suggest\] runner .*--quiet\n$/, 'the output survives, and the untried flag is suggested: the string ledger read as empty');
  assert.doesNotMatch(r.stderr, /unusable observation record/, 'hardened at the source: nothing threw, so nothing was caught');
});
