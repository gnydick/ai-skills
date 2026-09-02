#!/usr/bin/env python3
"""Unit tests for quiet_hook.should_wrap and quiet_run.select/normalise.

Run:  python .claude/hooks/quiet_hook_test.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import quiet_hook  # noqa: E402
import quiet_run   # noqa: E402


class ShouldWrap(unittest.TestCase):
    def test_noisy_commands_wrap(self):
        for c in [
            "cargo build -p fs-core",
            "cargo test --workspace --no-fail-fast",
            "cd x && cargo clippy",
            "npm install",
            "pip install -r requirements.txt",
            "python -m pytest tests/",
            "pytest -q",
            "bash scripts/battery.sh",
            "CARGO_TARGET_DIR=/tmp/t cargo build",
        ]:
            self.assertTrue(quiet_hook.should_wrap(c), c)

    def test_quiet_commands_pass(self):
        for c in [
            "git status",
            "cargo --version",
            "ls -la scripts",
            "cat Cargo.toml",
            "cargo test 2>&1 | tail -30",
            "cargo build > build.log",
            'python ".claude/hooks/quiet_run.py" --shell bash x.txt',
            "",
        ]:
            self.assertFalse(quiet_hook.should_wrap(c), c)


class RunnersAndGatesWrap(unittest.TestCase):
    """GIT_ hook-coverage widening (2026-08-25): runners/gates whose payload
    is a pass/fail summary must wrap; analysis/probe/render tools whose
    stdout IS the payload must never wrap. The negative cases matter more —
    a regression here starts filtering data the caller asked to see."""

    def test_new_shell_gates_wrap(self):
        for c in [
            "bash scripts/merge-gate.sh",
            "./scripts/merge-gate.sh",
            "bash scripts/testq.sh",
            "bash scripts/testq_test.sh",
            "bash scripts/prove-gcode-identical.sh main HEAD",
        ]:
            self.assertEqual(quiet_hook.wrap_mode(c), "filter", c)

    def test_piped_gate_still_opts_out(self):
        # PIPED must still win over the new gate coverage: the user's own
        # post-processing is left alone regardless of how noisy the source is.
        self.assertIsNone(
            quiet_hook.wrap_mode("bash scripts/merge-gate.sh 2>&1 | tail -60"))

    def test_direct_python_test_runners_wrap(self):
        for c in [
            "python scripts/testq_verdict_test.py",
            "python3 scripts/register_check_test.py",
            "py scripts/arachne_topology_test.py",
            "python scripts/config_default_sources_test.py",
            "python scripts/orca_slice_test.py",
            "python scripts/pipeline_model_check_test.py",
            "python .claude/hooks/quiet_hook_test.py",
            "python ./scripts/testq_verdict_test.py",
        ]:
            self.assertEqual(quiet_hook.wrap_mode(c), "filter", c)

    def test_payload_tools_never_wrap(self):
        # These print DATA that is the whole point of running them. Wrapping
        # them would delete exactly what the reader asked for (same reasoning
        # as GH_READ). testq_verdict.py (no "_test" suffix) is gate 10's live
        # display and must not be confused with testq_verdict_test.py.
        for c in [
            "python scripts/oracle_compare.py model.stl a.ini b.ini",
            "python scripts/gcode_layer_diff.py a.gcode b.gcode",
            "python scripts/wall_endpoint_census.py out.gcode",
            "python scripts/render_layer.py out.gcode -l 40",
            "python scripts/diff_dump.py a.json b.json",
            "python scripts/testq_verdict.py render run.json",
        ]:
            self.assertIsNone(quiet_hook.wrap_mode(c), c)


class GhWrap(unittest.TestCase):
    def test_gh_chatter_is_filtered(self):
        for c in [
            "gh run view 123 --log",
            "gh run watch 123",
            "gh pr checks 45",
            "gh auth status",
            "cd x && gh run view 1 --log",
        ]:
            self.assertEqual(quiet_hook.wrap_mode(c), "filter", c)

    def test_infra_actions_show_proof_only(self):
        # Gabe 2026-08-21: push/commit/pull and the like — only what proves success.
        for c in [
            "git commit -m x -- a.rs",
            "git commit -q -F - -- a.rs",
            "git push -u origin quiet-hook-gh",
            "git pull --rebase",
            "git fetch origin",
            "git merge --no-ff feature",
            "git rebase main",
            "git worktree add .claude/worktrees/x -b x",
            "git -C sub push",
            "gh pr create --title x --body y",
            "gh pr merge 45 --squash",
            "gh issue create --title x",
            "gh issue comment 7 --body z",
            "gh issue edit 7 --add-label bughunt",
            "gh workflow run build.yml",
            "gh release create v1.0 dist/*",
            "gh repo clone foo/bar",
            "git add -- a.rs && git commit -m x -- a.rs",
        ]:
            self.assertEqual(quiet_hook.wrap_mode(c), "infra", c)

    def test_git_reads_pass(self):
        for c in ["git status", "git log --oneline -5", "git diff", "git show HEAD"]:
            self.assertIsNone(quiet_hook.wrap_mode(c), c)

    def test_infra_success_keeps_only_proof_lines(self):
        commit = ["register_check: 158 citation files, 48 groups, 0 errors (fast)",
                  "[quiet-hook-gh ff3e3f99] feat(hooks): quiet-output hook covers gh",
                  " 3 files changed, 120 insertions(+), 9 deletions(-)"]
        shown = [commit[i] for i in sorted(quiet_run.select_infra(commit, 0))]
        # GIT_712: the gate's own denominator line now survives too -- it
        # used to be silently dropped here, which is the exact defect this
        # ticket fixes (see ProofLine.test_conforming_gate_denominator_...).
        self.assertEqual(shown, commit)
        push = ["Enumerating objects: 9, done.", "Counting objects: 100% (9/9), done.",
                "Delta compression using up to 32 threads", "Compressing objects: 100% (5/5), done.",
                "Writing objects: 100% (5/5), 2.1 KiB | 2.1 MiB/s, done.",
                "Total 5 (delta 4), reused 0 (delta 0), pack-reused 0",
                "remote: Resolving deltas: 100% (4/4), completed with 4 local objects.",
                "To github.com:gnydick/ferrislicer", "   fb49e920..ff3e3f99  quiet-hook-gh -> quiet-hook-gh"]
        shown = [push[i] for i in sorted(quiet_run.select_infra(push, 0))]
        self.assertEqual(shown, [push[-1]])
        new = ["To github.com:x/y", " * [new branch]        b -> b", "branch 'b' set up to track 'origin/b'."]
        self.assertEqual(len(quiet_run.select_infra(new, 0)), 2)
        self.assertEqual(quiet_run.select_infra(["Already up to date."], 0), {0})
        self.assertEqual(quiet_run.select_infra(["something odd"], 0), {0})  # never empty

    def test_infra_failure_keeps_errors(self):
        push = ["To github.com:x/y", " ! [rejected]        main -> main (fetch first)",
                "error: failed to push some refs to 'github.com:x/y'",
                "hint: Updates were rejected because the remote contains work that you do not have locally."]
        shown = [push[i] for i in sorted(quiet_run.select_infra(push, 1))]
        self.assertIn(push[2], shown)
        self.assertIn(push[1], shown)

    def test_gh_reads_are_never_wrapped(self):
        for c in [
            "gh issue view 408",
            "gh issue view 408 --json body -q .body",
            "gh issue list --label bughunt --limit 50",
            "gh pr view 12",
            "gh pr diff 12",
            "gh pr list",
            "gh api repos/{owner}/{repo}/issues/408/comments",
            "gh api graphql -f query='...'",
            "gh search issues --repo x/y foo",
            "gh run list --limit 5",
            "gh release view v1.0",
            "GH_TOKEN=x gh api user",
            "cargo build && gh issue view 408",  # a read anywhere on the line wins
        ]:
            self.assertIsNone(quiet_hook.wrap_mode(c), c)

    def test_gh_piped_or_trivial_passes(self):
        for c in [
            "gh issue view 408 | head -40",
            "gh api repos/x/y/issues | jq '.[].title'",
            "gh --version",
            "gh issue view 408 > issue.txt",
        ]:
            self.assertIsNone(quiet_hook.wrap_mode(c), c)

    def test_gh_check_rows_and_urls_survive_filter(self):
        text = (["##[group]Run actions/checkout@v4", "Cloning into '.'..."] * 30
                + ["##[error]Process completed with exit code 1.",
                   "✓ build  1m2s  https://github.com/x/y/actions/runs/1/job/2",
                   "X test   3m4s  https://github.com/x/y/actions/runs/1/job/3",
                   "https://github.com/x/y/pull/45"])
        shown = [text[i] for i in sorted(quiet_run.select(text))]
        self.assertIn("##[error]Process completed with exit code 1.", shown)
        self.assertIn("X test   3m4s  https://github.com/x/y/actions/runs/1/job/3", shown)
        self.assertIn("https://github.com/x/y/pull/45", shown)

    def test_gh_env_disables_pager_prompts_colour(self):
        env = quiet_run.quiet_env()
        self.assertEqual(env["GH_PAGER"], "cat")
        self.assertEqual(env["GH_PROMPT_DISABLED"], "1")
        self.assertEqual(env["GH_NO_UPDATE_NOTIFIER"], "1")
        self.assertNotIn("GH_FORCE_TTY", env)


class ProofLine(unittest.TestCase):
    """GIT_712: a gate's own denominator line and the heartbeat contract's
    line survive filtering, anchored to FORMAT (not an enumeration of
    today's gate names) -- and the negative control that bulk noise is
    still dropped."""

    def test_heartbeat_survives_infra_filtering(self):
        # (a) synthetic heartbeat line survives an infra-mode run, buried
        # in chatter that would otherwise fall outside the tail window.
        lines = (["   Compiling crate%d" % i for i in range(20)]
                  + ["HEARTBEAT battery.sh 42s gate 12/18"]
                  + ["   Cleaning artifact%d" % i for i in range(20)])
        keep = quiet_run.select_infra(lines, 0)
        self.assertIn(lines.index("HEARTBEAT battery.sh 42s gate 12/18"), keep)

    def test_heartbeat_survives_filter_mode(self):
        lines = (["   Compiling crate%d" % i for i in range(20)]
                  + ["HEARTBEAT battery.sh 42s gate 12/18"]
                  + ["   Cleaning artifact%d" % i for i in range(20)])
        keep = quiet_run.select(lines)
        self.assertIn(lines.index("HEARTBEAT battery.sh 42s gate 12/18"), keep)

    def test_conforming_gate_denominator_survives_without_enumeration(self):
        # (b) a FIFTH gate, never named anywhere in quiet_run.py, with a
        # conforming `<tool>: <text>` proof line -- must survive with no
        # filter edit. This is the regression pin for "anchor to format,
        # never to an enumeration of gate names."
        commit = [
            "register_check: 159 citation files, 51 groups, 0 errors (fast)",
            "citation_creation_gate: validated 0 new citation(s) (staged)",
            "gen_issue_rules_doc --check: OK -- 109 lines rendered, byte-identical to docs/github-issue-rules.md",
            "check_ledger_tables: ok -- 18 tables, 424 rows, all cell counts match their header",
            "a_brand_new_gate_nobody_named_here: 7 widgets, 0 defects (fresh)",
            "[main abc1234] test commit",
        ]
        shown = [commit[i] for i in sorted(quiet_run.select_infra(commit, 0))]
        self.assertEqual(shown, commit)

    def test_failing_gate_denominator_survives_buried_in_noise(self):
        # A fifth gate's FAILURE denominator, carrying no error/failed/
        # unresolved keyword of its own, buried outside the 8-line tail --
        # select_infra's nonzero-exit path (which delegates to select())
        # must not drop it.
        lines = (["a_brand_new_gate_nobody_named_here: 3 problem(s)"]
                  + ["   Cleaning artifact%d" % i for i in range(15)])
        keep = quiet_run.select_infra(lines, 1)
        self.assertIn(0, keep)

    def test_bulk_noise_still_dropped(self):
        # (c) NEGATIVE CONTROL: real cargo build/test chatter (371 lines,
        # no gate-shaped or heartbeat-shaped line anywhere in it) must not
        # come back wholesale just because a proof-line pattern now exists.
        lines = ["   Compiling crate%d v0.1.0" % i for i in range(300)]
        lines += ["test result: ok. 12 passed; 0 failed; 0 ignored"]
        keep_infra = quiet_run.select_infra(lines, 0)
        keep_filter = quiet_run.select(lines)
        self.assertLess(len(keep_infra), 10, keep_infra)
        self.assertLess(len(keep_filter), 20, keep_filter)

    def test_proof_line_does_not_admit_prose_word_colon(self):
        # Deliberate check (GIT_712 item 2): plain `<word>: <text>` prose --
        # git push's `remote: ...`, rustc's `warning:`/`error:`/`note:` --
        # must NOT match PROOF_LINE. The underscore requirement is what
        # keeps these out without enumerating tool names.
        for noise in [
            "remote: Resolving deltas: 100% (4/4), completed with 4 local objects.",
            "warning: unused variable `x`",
            "note: to see this warning use RUST_BACKTRACE=1",
            "hint: Updates were rejected because the remote contains work.",
        ]:
            self.assertIsNone(quiet_run.PROOF_LINE.search(noise), noise)


class Filter(unittest.TestCase):
    def test_short_output_is_verbatim_threshold(self):
        self.assertLessEqual(10, quiet_run.PASS_THROUGH_LINES)

    def test_progress_bar_keeps_last_frame(self):
        lines = quiet_run.normalise(b"Downloading 10%\rDownloading 50%\rDownloading 100%\nok\n")
        self.assertEqual(lines, ["Downloading 100%", "ok"])

    def test_ansi_stripped(self):
        self.assertEqual(quiet_run.normalise(b"\x1b[31merror\x1b[0m: x\n"), ["error: x"])

    def test_error_block_and_summary_kept_chatter_dropped(self):
        text = (
            ["   Compiling foo v0.1.0 (/x)"] * 60
            + ["error[E0425]: cannot find value `y`", "  --> src/a.rs:1:1", "   |", "1 | y", "   | ^", ""]
            + ["   Compiling bar v0.1.0 (/x)"] * 60
            + ["error: could not compile `foo` due to 1 previous error"]
        )
        keep = quiet_run.select(text)
        shown = [text[i] for i in sorted(keep)]
        self.assertIn("error[E0425]: cannot find value `y`", shown)
        self.assertIn("1 | y", shown)
        self.assertIn("error: could not compile `foo` due to 1 previous error", shown)
        self.assertLess(len(shown), 30)

    def test_test_failure_section_kept(self):
        text = (["test a ... ok"] * 100
                + ["test b ... FAILED", "", "failures:", "", "---- b stdout ----",
                   "thread 'b' panicked at src/l.rs:3:5:", "assertion failed: x", "",
                   "failures:", "    b", "",
                   "test result: FAILED. 100 passed; 1 failed; 0 ignored"])
        shown = [text[i] for i in sorted(quiet_run.select(text))]
        self.assertIn("test b ... FAILED", shown)
        self.assertIn("assertion failed: x", shown)
        self.assertIn("test result: FAILED. 100 passed; 1 failed; 0 ignored", shown)
        self.assertNotIn("test a ... ok", shown[:-8])


if __name__ == "__main__":
    # GIT_710: this suite now runs in .githooks/pre-commit (blocking) and as
    # a scripts/merge-gate.sh backstop, same layer choice as
    # check_ledger_tables.py in b5b27d84 -- pre-commit is where the
    # consequence of a filter regression actually lands (these hooks shape
    # every tool call's local output), merge-gate.sh is the documented
    # backstop for a clone that never ran `git config core.hooksPath
    # .githooks`, and the suite runs in ~0.007s so cost is not a factor.
    #
    # unittest prints "Ran N tests" / "OK" to STDERR -- neither line matches
    # PROOF_LINE in quiet_run.py (no leading HEARTBEAT, no snake_case
    # `tool: text` shape), so both were silently eaten by quiet_run's own
    # infra filter, the exact defect GIT_712 fixed for other gates. Emit a
    # conforming proof line carrying the denominator, on STDOUT, in addition
    # to (not instead of) unittest's own report.
    program = unittest.main(exit=False, verbosity=1)
    result = program.result
    total = result.testsRun
    failures = len(result.failures) + len(result.errors)
    if failures:
        print(f"quiet_hook_test: {failures} failure(s)")
        sys.exit(1)
    print(f"quiet_hook_test: ok -- {total} tests, 0 failures")
    sys.exit(0)
