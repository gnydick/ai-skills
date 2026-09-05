import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../scripts/lib/classify.mjs';

const cases = [
  // ported from quiet_hook_test.py: test_noisy_commands_wrap / test_quiet_commands_pass
  ['cargo build', 'noisy'], ['cargo test --workspace', 'noisy'], ['npm install', 'noisy'], ['pnpm run build', 'noisy'],
  ['npx vitest', 'noisy'], ['pip install requests', 'noisy'], ['pytest -q', 'noisy'], ['make', 'noisy'],
  ['CARGO_TARGET_DIR=/tmp/t cargo build', 'noisy'],
  // Ruling C1 (owner, 2026-09-05): "Only need wrapping for output producers, not filter pipes."
  // A byte-mover is routed to 'read' and never reaches the assimilator. These three were 'plain'
  // until then, and 'plain' now means "observe once" — which is exactly the wrong thing for `cat`.
  ['ls -la', 'read'], ['cat README.md', 'read'], ['echo hi', 'read'],
  // test_direct_python_test_runners_wrap
  ['python scripts/register_check_test.py', 'noisy'], ['python .claude/hooks/quiet_hook_test.py', 'noisy'],
  // test_payload_tools_never_wrap
  ['python scripts/oracle_compare.py a b', 'plain'],
  // test_gh_chatter_is_filtered (incl. auth status + extension install|upgrade)
  ['gh run view 123', 'noisy'], ['gh pr checks', 'noisy'], ['gh auth status', 'noisy'], ['gh extension install foo/bar', 'noisy'],
  // test_infra_actions_show_proof_only (incl. -C <dir> option)
  ['git commit -m x', 'infra'], ['git push', 'infra'], ['git pull --rebase', 'infra'], ['git fetch origin', 'infra'],
  ['git -C sub push', 'infra'], ['gh pr create --fill', 'infra'], ['git worktree add .claude/worktrees/x -b x', 'infra'],
  // test_git_reads_pass — 'plain' until ruling C1; git's reporting subcommands are byte-movers too
  ['git status', 'read'], ['git log --oneline -5', 'read'], ['git diff', 'read'],
  // test_gh_reads_are_never_wrapped
  ['gh issue view 12', 'read'], ['gh pr diff 3', 'read'], ['gh api repos/x/y', 'read'],
  // test_piped_gate_still_opts_out / test_gh_piped_or_trivial_passes
  ['cargo test 2>&1 | tail -20', 'piped'], ['gh run view 1 | grep fail', 'piped'], ['gh --version', 'plain'],
  // redirect: a file redirect opts out, a bare stderr-merge does not (quiet_hook.py:105)
  ['cargo build > build.log', 'redirected'], ['cargo build 2> err.log', 'redirected'], ['cargo build 2>&1 > build.log', 'noisy'],
  // precedence: infra before noisy for commands in both sets
  ['git clone https://x/y', 'infra'],
  // never
  ['python quiet_run.py -c x', 'plain'], ['cargo --version', 'plain'], ['npm --help', 'plain'],
  ['', 'plain'],
];
for (const [cmd, want] of cases) test(`classify(${JSON.stringify(cmd)}) = ${want}`, () => assert.equal(classify(cmd), want));

// Ruling C1 (owner, 2026-09-05): byte-movers are exempt by kind. The exemption is recognised at the
// leading position of every segment, so a compound command is a byte-mover only if all of it is:
// `cargo build && echo done` still has an output producer in it and stays wrapped.
const readCases = [
  ['grep -rn line .', 'read'], ['sed -n 1,200p x.txt', 'read'], ['find . -name "*.rs"', 'read'], ['pwd', 'read'],
  ['jq .version package.json', 'read'], ['wc -l a b', 'read'], ['head -100 log.txt', 'read'], ['printf "%s\\n" hi', 'read'],
  ['env', 'read'], ['date', 'read'], ['test -f x', 'read'], ['true', 'read'], ['which node', 'read'],
  ['git show HEAD', 'read'], ['git blame f.rs', 'read'], ['git ls-files', 'read'], ['git rev-parse HEAD', 'read'],
  ['git branch', 'read'], ['git branch -a', 'read'], ['git branch --list -vv', 'read'], ['git worktree list', 'read'],
  ['git -C sub status', 'read'], ['GIT_PAGER=cat git log -3', 'read'],
  ['cd src && ls', 'read'], ['cat a; grep x b', 'read'], ['(cat a)', 'read'], ['cat a 2>&1', 'read'],
  ['mkdir -p out', 'read'], ['rm -rf target', 'read'], ['cp a b', 'read'], ['touch x', 'read'],
  // Not byte-movers: a work-doer anywhere in the command, or a name that merely starts the same way.
  ['cargo build && echo done', 'noisy'], ['echo hi && cargo build', 'noisy'], ['cargo test; echo "exit=$?"', 'noisy'],
  ['ls && bash scripts/battery.sh', 'plain'], ['git branch -d old', 'plain'], ['git branch feature', 'plain'],
  // `env VAR=x cmd` runs cmd, so it is not the byte-mover `env` alone is. It lands 'plain' rather
  // than 'noisy' because NOISY's LEAD never saw through the `env` word — measured before C1, and
  // out of this wave's scope; what C1 owes is only that it is NOT 'read'.
  ['env FOO=1 cargo build', 'plain'], ['catalog-tool --run', 'plain'], ['git worktree add x', 'infra'],
  ['git diff > out.txt', 'redirected'], ['cat x | grep y', 'piped'], ['echo "a && b"', 'plain'],
];
for (const [cmd, want] of readCases) test(`C1: classify(${JSON.stringify(cmd)}) = ${want}`, () => assert.equal(classify(cmd), want));

test('RED CHECK: the classifier is not the identity', () => assert.notEqual(classify('cargo build'), 'plain'));

// Re-review R1, measured: a trailing separator or newline left an EMPTY segment, READ.test('') is
// false, and the whole command fell to 'plain' — so `cat a;` was observed and, once long, wrapped:
// the exact C1 failure for that shape. Whitespace-only segments carry no command and are not
// counted; but a command with no segment left at all is not a read either.
const trailingCases = [
  ['cat a;', 'read'], ['cat a; ', 'read'], ['cat a\n', 'read'], ['ls\n', 'read'], ['ls -la\n\n', 'read'], ['cat a &&', 'read'],
  // The fix must not widen the exemption: a work-doer with a trailing separator is still a work-doer.
  ['cargo build;', 'noisy'], ['cargo build\n', 'noisy'],
];
for (const [cmd, want] of trailingCases) test(`R1: classify(${JSON.stringify(cmd)}) = ${want}`, () => assert.equal(classify(cmd), want));
test('R1 positive control: dropping empty segments does not drop the `every` — a non-byte-mover segment still fails it', () => {
  assert.notEqual(classify('cat a; cargo build;'), 'read');
  assert.notEqual(classify('cat a\ncargo build\n'), 'read');
});

// Re-review R2, measured: LEAD accepts a single `&` as a leading position, but the splitter did not
// split on it, so `cargo build & cat x` was one segment whose LEAD-anchored `cat` made the whole
// thing a read — a backgrounded build, unwrapped. A single `&` is a segment boundary, like LEAD says.
const ampersandCases = [
  ['cargo build & cat x', 'noisy'], ['cargo build & ls', 'noisy'],
  ['cat a & ls', 'read'], ['cat a && ls', 'read'],
  // `2>&1` is a redirect, not a boundary: splitting at its `&` would leave a `1` segment.
  ['cat a 2>&1', 'read'], ['cargo build 2>&1 > build.log', 'noisy'],
];
for (const [cmd, want] of ampersandCases) test(`R2: classify(${JSON.stringify(cmd)}) = ${want}`, () => assert.equal(classify(cmd), want));

// Ruling I1 (owner, 2026-09-05): "When a command has a verified catalog entry, that entry is the
// authority and classify() reports `plain` for it (which is the bucket that hands off to the
// assimilator); only commands the catalog has no entry for fall through to the old regex heuristic."
// The catalog is passed in by the caller that already loads it; with none, classify() is exactly the
// string-only function every case above exercises.
const CATALOG = {
  'git-commit': { match: { type: 'regex', value: '^git\\s+commit\\b' }, outcome: 'x', candidates: ['--quiet'] },
  pytest: { match: { type: 'prefix', value: 'pytest' }, outcome: 'x', candidates: ['-q'] },
  cat: { match: { type: 'prefix', value: 'cat ' }, outcome: 'x', candidates: [] },
};
test('I1: a catalog-matched command is plain — the catalog outranks INFRA and NOISY', () => {
  assert.equal(classify('git commit -m x', { catalog: CATALOG }), 'plain');
  assert.equal(classify('pytest -q tests/', { catalog: CATALOG }), 'plain');
});
test('I1: without a catalog, or for a command the catalog does not know, the regex fallback still answers', () => {
  assert.equal(classify('git commit -m x'), 'infra');
  assert.equal(classify('git commit -m x', {}), 'infra');
  assert.equal(classify('git push', { catalog: CATALOG }), 'infra');
  assert.equal(classify('cargo test', { catalog: CATALOG }), 'noisy');
});
test('I1: the read exemption (C1) runs before the catalog — a byte-mover is exempt even if someone catalogs it', () => {
  assert.equal(classify('cat big.txt', { catalog: CATALOG }), 'read');
});
test('I1: never / piped / redirected still come before the catalog', () => {
  assert.equal(classify('pytest --help', { catalog: CATALOG }), 'plain'); // NEVER's plain, not the catalog's
  assert.equal(classify('pytest | tail -5', { catalog: CATALOG }), 'piped');
  assert.equal(classify('pytest > log', { catalog: CATALOG }), 'redirected');
});
test('RED CHECK: the catalog check is load-bearing — the same command flips between infra and plain on the catalog alone', () => {
  assert.notEqual(classify('git commit -m x', { catalog: CATALOG }), classify('git commit -m x', { catalog: {} }));
});

// Re-review R4: with the catalog passed as a VALUE, quiet.mjs had to resolve the project root (a git
// spawn) and read two files for every command — the never / piped / redirected / read ones that the
// chain answers without ever looking at the catalog included. The catalog may be handed in as a
// thunk, called only when the chain actually reaches the catalog step.
const explode = () => { throw new Error('the catalog was loaded for a command that never reaches it'); };
test('R4: a catalog thunk is not called for a command the chain answers before the catalog step', () => {
  for (const c of ['cat x', 'cargo build | tail', 'cargo build > log', 'gh issue view 1', '--help']) {
    assert.doesNotThrow(() => classify(c, { catalog: explode }), c);
  }
  assert.equal(classify('cat x', { catalog: explode }), 'read');
  assert.equal(classify('cargo build | tail', { catalog: explode }), 'piped');
  assert.equal(classify('cargo build > log', { catalog: explode }), 'redirected');
  assert.equal(classify('gh issue view 1', { catalog: explode }), 'read');
  assert.equal(classify('--help', { catalog: explode }), 'plain');
});
test('R4: a catalog thunk is called exactly once for a command that reaches the catalog step, and its value is what the step uses', () => {
  for (const [c, want] of [['git commit -m x', 'plain'], ['bash scripts/x.sh', 'plain']]) {
    let calls = 0;
    const thunk = () => { calls += 1; return CATALOG; };
    assert.equal(classify(c, { catalog: thunk }), want, c);
    assert.equal(calls, 1, `${c}: the thunk was called ${calls} times`);
  }
  // The thunk's VALUE is what decides: an empty catalog from a thunk falls through to the regexes.
  assert.equal(classify('git commit -m x', { catalog: () => ({}) }), 'infra');
});

test('RED CHECK: the read exemption is not the identity either — a byte-mover with an output producer behind it is still wrapped', () => {
  assert.equal(classify('cat big.txt'), 'read');
  assert.notEqual(classify('cat big.txt && cargo build'), 'read');
});
