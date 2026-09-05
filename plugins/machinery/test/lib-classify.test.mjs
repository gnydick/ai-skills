import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, classifySegments, isSimpleCommand, isSimpleCompound } from '../scripts/lib/classify.mjs';

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
  ['git diff > out.txt', 'redirected'], ['cat x | grep y', 'piped'],
  // Was pinned 'plain' here until issue #11: the splitter was not quote-aware, so this split inside
  // the quotes into `echo "a` and `b"`, neither a byte-mover. The quoted `&&` is data; see below.
  ['echo "a && b"', 'read'],
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

// Issue #11 (owner, 2026-09-05: "teach the splitter quotes"), measured: the splitter ignored quotes,
// so `echo "a && b"` split inside them, the byte-mover exemption (C1) failed, and the command was
// 'plain' — one unfiltered observe run and an observation record for an echo. A separator inside a
// single- or double-quoted span is data, and the span rule is the one catalog.mjs's tokens() reads
// (scripts/lib/quotes.mjs), so the two can no longer disagree.
const quotedCases = [
  ['echo "a && b"', 'read'], ["echo 'x; y'", 'read'], ["echo 'a & b'", 'read'], ['printf "%s\\n" "one || two"', 'read'],
  ['echo "line1\nline2"', 'read'], ['cat "a b" & ls', 'read'], [`echo "it's" && ls`, 'read'], [`echo 'say "hi"; bye' ; ls`, 'read'],
  // A quoted separator hides nothing: the work-doer outside the quotes is still seen.
  ['echo "a; b" && cargo build', 'noisy'], ['cargo build && echo "done && dusted"', 'noisy'], ['cargo build "x && y"', 'noisy'],
  ['cat a && cargo build', 'noisy'],
];
for (const [cmd, want] of quotedCases) test(`#11: classify(${JSON.stringify(cmd)}) = ${want}`, () => assert.equal(classify(cmd), want));
test('#11: an unterminated quote runs to the end of the command as data — never a throw', () => {
  for (const c of ['echo "a && b', "cat 'x; cargo build", 'cargo build "', 'echo "', '"', "'"]) assert.doesNotThrow(() => classify(c), c);
  assert.equal(classify('echo "a && b'), 'read');
  assert.equal(classify("cat 'x; cargo build"), 'read', 'the work-doer is inside the open span, so it is data');
  assert.equal(classify('cargo build "'), 'noisy');
});
test('RED CHECK: the quote is load-bearing — the same `&&` outside a span still splits', () => {
  assert.equal(classify('echo "a && b"'), 'read');
  assert.notEqual(classify('echo "a" && cargo build'), 'read');
});

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

// Issue #13 (owner, 2026-09-05: "i would apply the rules to inside the compound. so each outputter
// gets wrapped. since it's && and not a pipe, it theoretically should be no problem"). classify()
// gives ONE kind to a whole command, and the final review measured what that costs a compound: a
// catalog prefix on the first segment claimed `pytest tests/ && cargo build` as 'plain', so the
// cargo build ran unfiltered where alone it was 'noisy → filter'. classifySegments() applies the
// same precedence chain — never → piped → redirected → read → catalog → infra → noisy → plain — to
// each `;`/`&&`/`||`/`&`/newline-joined segment on its own, and hands back the separator that
// follows each so the hook can rebuild the command around the segments it wraps. classify() itself
// keeps its meaning for every case above.
const seg = (text, sep, kind) => ({ text, sep, kind });
test('#13: classifySegments classifies each segment on its own, with the separator that follows it', () => {
  assert.deepEqual(classifySegments('pytest tests/ && cargo build', { catalog: CATALOG }), [seg('pytest tests/', ' && ', 'plain'), seg('cargo build', '', 'noisy')]);
  assert.deepEqual(classifySegments('cat a && cargo build'), [seg('cat a', ' && ', 'read'), seg('cargo build', '', 'noisy')]);
  assert.deepEqual(classifySegments('cargo build; echo done'), [seg('cargo build', '; ', 'noisy'), seg('echo done', '', 'read')]);
  assert.deepEqual(classifySegments('cat a && ls'), [seg('cat a', ' && ', 'read'), seg('ls', '', 'read')]);
  assert.deepEqual(classifySegments('git push || cargo build'), [seg('git push', ' || ', 'infra'), seg('cargo build', '', 'noisy')]);
  assert.deepEqual(classifySegments('cargo build\ncargo test'), [seg('cargo build', '\n', 'noisy'), seg('cargo test', '', 'noisy')]);
  // The kind is reported for a backgrounded segment like any other; whether to wrap one is the
  // hook's decision (quiet.mjs), and it never does — two runners would race on the record.
  assert.deepEqual(classifySegments('cargo build & cat x'), [seg('cargo build', ' & ', 'noisy'), seg('cat x', '', 'read')]);
});

test('#13: a pipe is one unit — the segment is piped or redirected exactly as the whole command would be', () => {
  assert.deepEqual(classifySegments('cargo test | tail -5 && cargo build'), [seg('cargo test | tail -5', ' && ', 'piped'), seg('cargo build', '', 'noisy')]);
  assert.deepEqual(classifySegments('cargo build > log; cargo test'), [seg('cargo build > log', '; ', 'redirected'), seg('cargo test', '', 'noisy')]);
});

test('#13: the NEVER exemption is per segment: an exempt segment no longer exempts its neighbours', () => {
  assert.equal(classify('cargo --version && cargo build'), 'plain', 'whole-command: NEVER anywhere exempts everything');
  assert.deepEqual(classifySegments('cargo --version && cargo build'), [seg('cargo --version', ' && ', 'plain'), seg('cargo build', '', 'noisy')]);
});

test('#13: a whitespace-only segment names no command — it is folded into the neighbouring separator, never classified', () => {
  assert.deepEqual(classifySegments('cargo build;'), [seg('cargo build', ';', 'noisy')]);
  assert.deepEqual(classifySegments('cat a\n'), [seg('cat a', '\n', 'read')]);
  assert.deepEqual(classifySegments('cat a; \n'), [seg('cat a', '; \n', 'read')]);
  assert.deepEqual(classifySegments('\ncargo build'), [seg('\ncargo build', '', 'noisy')], 'a leading blank has no predecessor: it rides on the segment after it');
  assert.deepEqual(classifySegments(''), []);
  assert.deepEqual(classifySegments('  '), []);
  assert.deepEqual(classifySegments(';'), []);
});

test('#13: the rejoin is the identity — the segments and separators carry every byte of a command that names one', () => {
  for (const c of ['pytest tests/ && cargo build', 'cargo build;', 'cat a; \n', '\ncargo build', 'echo "a; b" && cargo build', 'cargo build 2>&1 & ls', 'a || b && c; d\ne', '  cargo build  ']) {
    assert.equal(classifySegments(c).map((s) => s.text + s.sep).join(''), c, JSON.stringify(c));
  }
});

test('#13: a single segment classifies exactly as classify() does', () => {
  for (const c of ['cargo build', 'cat a', 'git push', 'gh issue view 1', 'cargo test | tail', 'cargo build > log', '--help', 'bash x.sh', 'echo "a && b"']) {
    const s = classifySegments(c, { catalog: CATALOG });
    assert.equal(s.length, 1, c);
    assert.equal(s[0].kind, classify(c, { catalog: CATALOG }), c);
  }
});

test('#13: the catalog thunk is resolved at most once for the whole compound, and only if a segment reaches the catalog step (R4 holds per segment)', () => {
  let calls = 0;
  const thunk = () => { calls += 1; return CATALOG; };
  assert.deepEqual(classifySegments('git commit -m x && pytest -q && bash x.sh', { catalog: thunk }).map((s) => s.kind), ['plain', 'plain', 'plain']);
  assert.equal(calls, 1, `three segments reached the catalog step and the thunk was called ${calls} times`);
  assert.doesNotThrow(() => classifySegments('cat a && ls | wc -l && cargo build > log', { catalog: explode }));
});

test('RED CHECK: classifySegments is not classify() over the whole command — the compound the issue measured comes apart', () => {
  assert.equal(classify('pytest tests/ && cargo build', { catalog: CATALOG }), 'plain');
  assert.deepEqual(classifySegments('pytest tests/ && cargo build', { catalog: CATALOG }).map((s) => s.kind), ['plain', 'noisy']);
});

// Fix round 1 for #13 (controller's amendment after review, 2026-09-05). A separator outside quotes
// is not always a command boundary: the reviewer measured `if cargo build; then echo ok; fi` cut
// into three runners (`if cargo build`, `then echo ok`, `fi`) and bash refusing the result, and a
// heredoc whose body lines each became a runner — the file received runner invocations. Per-segment
// wrapping is therefore for compounds of SIMPLE commands only: no heredoc operator, no unbalanced
// `(` `{` `[[` or backtick, no reserved word at the lead, no trailing `\`. One predicate answers it,
// per segment and over the whole list; the hook falls back to the whole-command path otherwise.
const notSimple = [
  ['if cargo build; then echo ok; fi', 'if/then/fi'],
  ['for f in a b; do cargo build; done', 'for/do/done'],
  ['while true; do cargo build; done', 'while'],
  ['until false; do cargo build; done', 'until'],
  ['case x in a) cargo build;; esac', 'case/esac'],
  ['(node -e "process.exit(3)" || echo fell-through); echo "exit=$?"', 'a subshell split across segments'],
  ['{ cargo build && cargo test; }', 'a brace group split across segments'],
  ['X=$(cargo build && cargo test); echo $X', 'a command substitution split across segments'],
  ['X=`cargo build && cargo test`; echo $X', 'a backtick substitution split across segments'],
  ['[[ -f a && -f b ]] && cargo build', 'a [[ ]] conditional split across segments'],
  ['[[ -f a ]] && cargo build', 'a [[ ]] conditional at a lead is a compound command, not a simple one'],
  ['cargo build \\\n--release && cargo test', 'a line continuation'],
  ["cat > notes.md <<'EOF'\n# Title\nsome text\nEOF", 'a heredoc'],
  ["python3 - <<'EOF'\nprint(1)\nEOF", 'a heredoc feeding a tool'],
  ['cat <<-EOF\n\tx\nEOF', 'a tab-stripping heredoc'],
  ['function f { cargo build; }; f', 'a function definition'],
  ['! cargo build && echo failed', 'a negated pipeline'],
  ['time cargo build && cargo test', 'the time keyword'],
  ['coproc cargo build; cargo test', 'coproc'],
  ['select x in a b; do cargo build; done', 'select'],
];
for (const [cmd, why] of notSimple) test(`#13 fix 1: not a simple compound — ${why}: ${JSON.stringify(cmd)}`, () => {
  assert.equal(isSimpleCompound(classifySegments(cmd)), false);
});
const simple = [
  'cargo build && cargo test', 'cat a; cargo build', 'cargo build || echo failed', 'cargo build\ncargo test', 'cargo build & cargo test',
  'echo "(" && cargo build', "echo '{ if then' ; ls", 'echo "$(x" && ls', 'echo $((1+2)) && ls', 'echo ${HOME} && ls',
  'cat <<< "here string" && ls', '(cargo build) && cargo test', 'X=$(git rev-parse HEAD) && cargo build', '[ -f a ] && cargo build',
  'cargo build "a\\" && ls', 'echo "<<" && ls', 'cargo build', '',
];
for (const cmd of simple) test(`#13 fix 1: a simple compound: ${JSON.stringify(cmd)}`, () => {
  assert.equal(isSimpleCompound(classifySegments(cmd)), true);
});
test('#13 fix 1: isSimpleCommand answers per segment, and isSimpleCompound is every segment — one predicate, one place', () => {
  assert.equal(isSimpleCommand('if cargo build'), false);
  assert.equal(isSimpleCommand('then echo ok'), false);
  assert.equal(isSimpleCommand('cargo build'), true);
  assert.equal(isSimpleCommand("cat > x <<'EOF'"), false);
  assert.equal(isSimpleCommand('cat <<< x'), true, 'a herestring is one token: allowed');
  assert.equal(isSimpleCommand('cargo build \\'), false, 'a trailing continuation');
  assert.equal(isSimpleCommand('echo "if" x'), true, 'a reserved word inside quotes is data');
  assert.equal(isSimpleCommand('ifconfig && ls'), true, 'a word that merely starts like a reserved word');
  assert.equal(isSimpleCommand('done-tool --run'), true);
  assert.equal(isSimpleCompound([]), true, 'no segments: nothing violates the rule, and the hook has nothing to wrap either way');
});
test('RED CHECK: the predicate is not a constant — the same shape flips on the one construct', () => {
  assert.notEqual(isSimpleCompound(classifySegments('cargo build && cargo test')), isSimpleCompound(classifySegments('if cargo build; then cargo test; fi')));
  assert.notEqual(isSimpleCommand('(cargo build)'), isSimpleCommand('(cargo build'));
});

// Fix round 1, B: a state-mutating builtin changes the shell it runs in, so a runner of its own
// would run it in a shell nobody else sees — the reviewer measured `export PROBE_VAR=set && node -e
// …` printing `var=undefined` with both segments wrapped. These are part of `read`: the hook's
// treatment (untouched, unobserved, no record) is the same, and a second kind for one treatment
// would be a second name for one bucket. The list is its own named thing, STATE, beside READ.
const stateCases = [
  ['export X=1', 'read'], ['export X="a b" Y=2', 'read'], ['source .venv/bin/activate', 'read'], ['source ./vars.sh', 'read'],
  ['. ./env.sh', 'read'], ['set -e', 'read'], ['set -o pipefail', 'read'], ['unset X', 'read'], ['alias ll="ls -la"', 'read'],
  ['unalias ll', 'read'], ['eval "$(ssh-agent)"', 'read'], ['exec true', 'read'], ['trap cleanup EXIT', 'read'], ['shopt -s globstar', 'read'],
  // Precedence, not the list: a redirect answers at the step BEFORE read, and both are untouched.
  ['exec 3>&1', 'redirected'],
  ['ulimit -n 4096', 'read'], ['umask 022', 'read'], ['pushd src', 'read'], ['popd', 'read'], ['readonly X=1', 'read'],
  ['declare -a arr', 'read'], ['typeset -i n', 'read'], ['local x=1', 'read'],
  ['X=1', 'read'], ['X=1 Y=2', 'read'], ['X="a && b"', 'read'], ["X='a; b' Y=c", 'read'], ['CARGO_TARGET_DIR=/tmp/t', 'read'],
  ['cd x && export Y=1', 'read'], ['export A=1; X=2', 'read'],
  // Not state-mutators: a name that merely starts the same way, and an assignment that PREFIXES a command.
  ['exporter --run', 'plain'], ['setup.sh', 'plain'], ['sourcery --check', 'plain'], ['X=1 cargo build', 'noisy'], ['CARGO_TARGET_DIR=/tmp/t cargo build', 'noisy'],
  ['export X=1 && cargo build', 'noisy'], ['set -e; cargo build', 'noisy'],
];
for (const [cmd, want] of stateCases) test(`#13 fix 1 (B): classify(${JSON.stringify(cmd)}) = ${want}`, () => assert.equal(classify(cmd), want));
test('#13 fix 1 (B): per segment, the state-mutator is read and its neighbour keeps its own kind', () => {
  assert.deepEqual(classifySegments('export PROBE_VAR=set && node x.js').map((s) => s.kind), ['read', 'plain']);
  assert.deepEqual(classifySegments('source .venv/bin/activate && pytest -q', { catalog: CATALOG }).map((s) => s.kind), ['read', 'plain']);
  assert.deepEqual(classifySegments('X=1; cargo build').map((s) => s.kind), ['read', 'noisy']);
});
test('RED CHECK (B): the state list is load-bearing — an assignment prefix on a work-doer is still the work-doer', () => {
  assert.equal(classify('X=1'), 'read');
  assert.notEqual(classify('X=1 cargo build'), 'read');
});
