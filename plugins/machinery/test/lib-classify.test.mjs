import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../scripts/lib/classify.mjs';

const cases = [
  // ported from quiet_hook_test.py: test_noisy_commands_wrap / test_quiet_commands_pass
  ['cargo build', 'noisy'], ['cargo test --workspace', 'noisy'], ['npm install', 'noisy'], ['pnpm run build', 'noisy'],
  ['npx vitest', 'noisy'], ['pip install requests', 'noisy'], ['pytest -q', 'noisy'], ['make', 'noisy'],
  ['CARGO_TARGET_DIR=/tmp/t cargo build', 'noisy'],
  ['ls -la', 'plain'], ['cat README.md', 'plain'], ['echo hi', 'plain'],
  // test_direct_python_test_runners_wrap
  ['python scripts/register_check_test.py', 'noisy'], ['python .claude/hooks/quiet_hook_test.py', 'noisy'],
  // test_payload_tools_never_wrap
  ['python scripts/oracle_compare.py a b', 'plain'],
  // test_gh_chatter_is_filtered (incl. auth status + extension install|upgrade)
  ['gh run view 123', 'noisy'], ['gh pr checks', 'noisy'], ['gh auth status', 'noisy'], ['gh extension install foo/bar', 'noisy'],
  // test_infra_actions_show_proof_only (incl. -C <dir> option)
  ['git commit -m x', 'infra'], ['git push', 'infra'], ['git pull --rebase', 'infra'], ['git fetch origin', 'infra'],
  ['git -C sub push', 'infra'], ['gh pr create --fill', 'infra'], ['git worktree add .claude/worktrees/x -b x', 'infra'],
  // test_git_reads_pass
  ['git status', 'plain'], ['git log --oneline -5', 'plain'], ['git diff', 'plain'],
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

test('RED CHECK: the classifier is not the identity', () => assert.notEqual(classify('cargo build'), 'plain'));
