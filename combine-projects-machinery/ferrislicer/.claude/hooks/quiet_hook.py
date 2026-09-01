#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PreToolUse hook (Bash|PowerShell): route noisy commands through quiet_run.py.

Builds, installs, test runs and anything with a progress bar flood the
context window with chatter. When the command about to run matches a
known-noisy shape, this hook rewrites the tool input so the command runs
under quiet_run.py, which logs everything to disk and returns only errors,
failures and final summaries (exit code preserved). Short/quiet commands,
explicit pipelines (`... | tail`), and already-wrapped commands pass through
untouched.

Three shapes (Gabe, 2026-08-21):
  * filter — builds/tests and gh chatter (run logs, checks): error blocks +
    summaries + tail.
  * infra  — git commit/push/pull/fetch/merge/rebase/clone and gh mutations
    (pr create/merge, issue create/edit/comment, release, workflow run):
    show ONLY what proves success (the `[branch sha]` line, the `a -> b`
    push line, the result URL) — or the error blocks on failure. Applies
    even to short output; push/commit chatter is always short.
  * none   — gh content reads (issue/pr view, list, diff, api, search) are
    NEVER wrapped: their lines are the payload, never capped, never filtered.

Opt out for one call: prefix the command with `FS_QUIET=0 ` (bash) or
`$env:FS_QUIET='0'; ` (PowerShell) — quiet_run.py then prints verbatim.
"""
import json
import os
import re
import sys
import tempfile

NOISY = re.compile(
    r"(?:^|[;&|(]\s*|\bthen\s+|\bdo\s+|&&\s*)\s*"
    r"(?:\w+=\S*\s+)*"  # env-var prefixes: CARGO_TARGET_DIR=x cargo build
    r"(?:"
    r"cargo\s+(?:\+\S+\s+)?(?:build|b|test|t|check|c|clippy|run|r|bench|doc|"
    r"install|update|fetch|clean|nextest|fmt|llvm-cov|tarpaulin|xtask)\b"
    r"|(?:npm|pnpm|yarn|bun)\s+(?:install|i|ci|add|run|test|build|update|up|exec|create)\b"
    r"|npx\s+\S+"
    r"|pip3?\s+(?:install|download|wheel|uninstall)\b"
    r"|uv\s+(?:pip|sync|run|tool|add)\b"
    r"|(?:python3?|py)\s+-m\s+(?:pip|pytest|build|venv|unittest)\b"
    r"|pytest\b|tox\b|maturin\b|poetry\s+(?:install|run|build|update)\b"
    r"|(?:cmake\s+--build|make\b|ninja\b|msbuild\b|dotnet\s+(?:build|test|restore|run)|gradle\w*\b|mvn\b)"
    r"|docker\s+(?:build|pull|compose|push)\b"
    r"|git\s+(?:clone|fetch|pull)\b"  # also in INFRA; INFRA is checked first
    r"|rustup\s+(?:update|install|toolchain|component)\b"
    # RUNNERS/GATES (Gabe, 2026-08-25): scripts whose payload is a pass/fail
    # summary, not their raw output. No naming regularity holds across this
    # set (battery/perf/measure/bench-report/merge-gate/testq/prove-gcode-
    # identical share no common prefix, suffix, or behavioural marker a regex
    # could key on that wouldn't also catch an analysis tool) so this is an
    # explicit enumeration, same shape as the pre-existing four. Deliberately
    # NOT here: any *.py analysis/probe/render/census/diff tool (oracle_compare,
    # gcode_layer_diff, gcode_width_audit, render_layer, layer_svg,
    # wall_endpoint_census, diff_dump, profile_report, testq_verdict.py, ...)
    # — their stdout is the payload the caller asked for, never chatter.
    r"|(?:\./|bash\s+|sh\s+)?scripts/(?:battery|perf|measure|bench-report|merge-gate|testq|testq_test|prove-gcode-identical)\.sh\b"
    # Direct-script test runners (as opposed to `-m unittest`/`pytest`, already
    # matched above): every `*_test.py` in scripts/ and .claude/hooks/ IS a
    # test runner by this repo's naming convention (verified: arachne_topology,
    # config_default_sources, orca_slice, pipeline_model_check, register_check,
    # testq_verdict, quiet_hook — all unittest.main()/pass-fail-tally scripts,
    # none of them a data-payload tool) — a real regularity, unlike the shell
    # gates above, so this arm is a suffix match rather than an enumeration and
    # will cover new test files without editing this hook again.
    r"|(?:python3?|py)\s+(?:-\S+\s+)*(?:\./|\.\./)?(?:scripts|\.claude/hooks)/\S*_test\.py\b"
    r"|sccache\s+--start-server\b"
    # gh chatter: run logs and check tables.
    r"|gh\s+(?:run\s+(?:view|watch|download)|pr\s+checks|auth\s+status|extension\s+(?:install|upgrade))\b"
    r")"
)
# Infrastructure actions: the only thing worth reading is proof of success
# (or the error). git commit/push/pull and gh mutations.
INFRA = re.compile(
    r"(?:^|[;&|(]\s*|\bthen\s+|\bdo\s+|&&\s*)\s*(?:\w+=\S*\s+)*"
    r"(?:git\s+(?:-C\s+\S+\s+)?(?:commit|push|pull|fetch|merge|rebase|clone|cherry-pick|worktree\s+(?:add|remove|prune)|submodule)\b"
    r"|gh\s+(?:pr\s+(?:create|merge|close|ready|review|comment|edit)|"
    r"issue\s+(?:create|edit|comment|close|reopen|transfer|pin|unpin|develop)|"
    r"workflow\s+(?:run|enable|disable)|release\s+(?:create|upload|delete)|run\s+(?:rerun|cancel)|"
    r"repo\s+(?:clone|fork|sync|create)|label\s+(?:create|clone|delete)|auth\s+(?:login|refresh|setup-git))\b)"
)
# gh commands whose OUTPUT is the payload (issue bodies, PR diffs, API JSON).
# Filtering would delete exactly what the reader asked for, so a command
# line containing one of these is never wrapped (ruled: no cap on reads).
GH_READ = re.compile(
    r"(?:^|[;&|(]\s*|\bthen\s+|\bdo\s+|&&\s*)\s*(?:\w+=\S*\s+)*"
    r"gh\s+(?:issue\s+(?:view|list|status)|pr\s+(?:view|list|diff|status)|api\b|search\b|"
    r"release\s+(?:view|list)|run\s+list|repo\s+(?:view|list)|label\s+list|"
    r"project\b|gist\s+(?:view|list)|workflow\s+(?:view|list))\b"
)
# Leave the user's own post-processing alone.
PIPED = re.compile(r"\|\s*(?:tail|head|grep|rg|wc|sed|awk|sort|uniq|jq|tee|less|cut|python|py|quiet_run)\b")
NEVER = re.compile(r"quiet_run\.py|--version\b|-V\b|--help\b")


def wrap_mode(command):
    """None (pass through), "infra" (proof-of-success only), or "filter"
    (error/summary reduction)."""
    if not command or NEVER.search(command):
        return None
    if PIPED.search(command):
        return None
    if ">" in command and re.search(r"\d?>\s*\S", command) and "2>&1" not in command:
        return None  # output already redirected to a file
    if GH_READ.search(command):
        return None  # issue/PR reads are the payload: never filtered, never capped
    if INFRA.search(command):
        return "infra"
    if NOISY.search(command):
        return "filter"
    return None


def should_wrap(command):
    return wrap_mode(command) is not None


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    tool = payload.get("tool_name") or ""
    if tool not in ("Bash", "PowerShell"):
        return 0
    tool_input = payload.get("tool_input") or {}
    command = tool_input.get("command") or ""
    mode = wrap_mode(command)
    if mode is None:
        return 0

    shell = "powershell" if tool == "PowerShell" else "bash"
    hooks_dir = os.path.dirname(os.path.abspath(__file__))
    runner = os.path.join(hooks_dir, "quiet_run.py")
    job = os.environ.get("CLAUDE_JOB_DIR")
    d = os.path.join(job, "tmp") if job else os.path.join(tempfile.gettempdir(), "claude-quiet")
    os.makedirs(d, exist_ok=True)
    fd, cmdfile = tempfile.mkstemp(prefix="cmd-", suffix=".txt", dir=d)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(command)

    if shell == "bash":
        runner, cmdfile = runner.replace("\\", "/"), cmdfile.replace("\\", "/")
        new_cmd = 'python "%s" --shell bash --mode %s "%s"' % (runner, mode, cmdfile)
    else:
        new_cmd = 'python "%s" --shell powershell --mode %s "%s"; exit $LASTEXITCODE' % (runner, mode, cmdfile)

    new_input = dict(tool_input)
    new_input["command"] = new_cmd
    desc = tool_input.get("description") or ""
    new_input["description"] = (desc + " [quiet:%s]" % mode).strip()
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "updatedInput": new_input,
        }
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
