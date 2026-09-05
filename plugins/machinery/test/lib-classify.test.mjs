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

test('RED CHECK: the read exemption is not the identity either — a byte-mover with an output producer behind it is still wrapped', () => {
  assert.equal(classify('cat big.txt'), 'read');
  assert.notEqual(classify('cat big.txt && cargo build'), 'read');
});
