#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Run a noisy command, keep the full output on disk, show only what matters.

Invoked by quiet_hook.py (PreToolUse rewrite) as:

    python quiet_run.py --shell bash|powershell [--mode filter|infra] <cmdfile>

`--mode infra` (git commit/push/pull, gh mutations): output is reduced to
PROOF of success — lines matching INFRA_OK (`[main abc1234] subject`,
`old..new  a -> b`, `Already up to date`, a github.com result URL) — even
when the output is short. On a non-zero exit the error/summary filter runs
instead so nothing about the failure is lost. Header states exit and the
denominator; the full log is always on disk.

<cmdfile> holds the original command verbatim (written by the hook so no
re-quoting happens). The command runs under the named shell with progress
bars and colour disabled; stdout+stderr are captured together, streamed to a
log file, and then reduced to:

  * error / failure / panic / traceback blocks (with their context),
  * final summaries (`test result:`, `Finished`, pytest `=== ... ===`, npm
    `added N packages`, pip `Successfully installed`, ...),
  * the last few lines of output.

Short output (<= PASS_THROUGH_LINES) is printed verbatim — quiet commands
are not filtered. The command's exit code is always propagated.

Standalone use works too:  python quiet_run.py --shell bash -c "cargo test"
Set FS_QUIET=0 in the environment to print everything verbatim.
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile
import time

PASS_THROUGH_LINES = 40   # at or below this, no filtering at all
TAIL_LINES = 8            # always keep the tail (summaries live there)
CONTEXT_AFTER = 2         # lines kept after a keyword hit
MAX_SHOWN = 200           # hard cap on shown lines (head+tail of the kept set)

ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07")

# A line that starts a block kept until the next blank line (rustc / cargo
# diagnostics, pytest failure sections, Python tracebacks, panics).
BLOCK_START = re.compile(
    r"^(error(\[E\d+\])?:|error:|ERROR|thread '.*' panicked|panicked at|"
    r"Traceback \(most recent call last\)|---- .* (stdout|stderr) ----|"
    r"failures:|FAILED|FAIL\b|npm ERR!|npm error|ERR!|fatal:|"
    r"\s*Caused by:|The following warnings were emitted)",
    re.IGNORECASE,
)
# Single-line keepers: errors/failures anywhere, plus final summaries.
KEYWORD = re.compile(
    r"(\berror\b|\bfailed\b|\bfailure\b|\bfailures\b|\bpanick?|\bexception\b|"
    r"\bfatal\b|\bunresolved\b|\bcould not\b|\bcannot\b|\bdenied\b|"
    r"\btimed out\b|\btimeout\b|\babort|\bsegfault|\bkilled\b|"
    r"\bFAIL\b|\bFAILED\b|\bassert)",
    re.IGNORECASE,
)
SUMMARY = re.compile(
    r"(^test result:|^\s*Finished\b|^\s*Summary\b|^={3,}.*={3,}$|"
    r"^\s*Doc-tests\b|^running \d+ tests?$|^\s*Running (unittests|tests/)|"
    r"\badded \d+ packages?\b|\bSuccessfully installed\b|\bSuccessfully built\b|"
    r"^\s*warning: .* generated \d+ warnings?|^\s*warning: build failed|"
    r"\bBuild succeeded\b|\bBUILD (SUCCESSFUL|FAILED)\b|"
    r"\b\d+ passed\b|\b\d+ failed\b|"
    # gh: check-status rows, result URLs, mutation confirmations, run summaries.
    r"^\s*[✓✔✗✘X!*-]\s|https?://github\.com/\S+|"
    r"^\s*(Merged|Created|Deleted|Closed|Reopened|Requested|Cloning|ANNOTATIONS|JOBS)\b|"
    r"\bcompleted with\b|\b(succeeded|skipped|cancelled)\b|"
    r"^Error: |^error: could not compile)",
    re.IGNORECASE,
)
# GIT_712: the ONE declared proof-line format a gate's own denominator line
# and the heartbeat contract's line both conform to -- anchored to FORMAT,
# never to an enumeration of gate names, so a fifth gate needs no filter
# edit (the design constraint the parent issue states explicitly). Two
# shapes: `HEARTBEAT <tool> <elapsed> [<progress>]`
# (docs/rules/heartbeat-contract.md), or `<snake_case_tool>[ --flag]: <text>`
# -- a gate's own name (`register_check:`, `gen_issue_rules_doc --check:`;
# GIT_708 gave every gate this prefix precisely so a format-anchored pattern
# could key on it). Requiring an underscore in the identifier is what keeps
# prose out (`remote:`, `warning:`, `hint:`, `error:` all have none) without
# enumerating tool names -- MEASURED against real bulk cargo/gh output
# (docs/rules -- see GIT_712 issue thread) to confirm it stays narrow.
# Used in BOTH select() (filter mode / infra-failure fallback) and
# select_infra() (infra-success) so a gate's success line and its own
# failure diagnostic survive by the same rule.
PROOF_LINE = re.compile(
    r"(^HEARTBEAT\s"
    r"|^[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\s+--?[\w.-]+)?:\s+\S)"
)
# infra mode: the lines that PROVE a git/gh action succeeded.
INFRA_OK = re.compile(
    r"(^\[[^\]]+ [0-9a-f]{7,}\] "                                  # git commit: [main abc1234] subject
    r"|^\s*[0-9a-f]{7,}\.\.[0-9a-f]{7,}\s+\S+\s+->\s+\S+"           # push/fetch: old..new a -> b
    r"|^\s*\+\s+[0-9a-f]{7,}\.{3}[0-9a-f]{7,}\s+\S+\s+->"           # forced update
    r"|^\s*\*\s+\[new (?:branch|tag)\]"
    r"|^\s*-\s+\[deleted\]"
    r"|^Everything up-to-date$|^Already up to date\.?$|^Fast-forward$"
    r"|^Updating [0-9a-f]{7,}\.\.[0-9a-f]{7,}$"
    r"|^\s*\d+ files? changed"
    r"|^Merge made by|^Successfully rebased|^Switched to|^HEAD is now at|^Preparing worktree"
    r"|^Cloning into|^branch '.*' set up to track"
    r"|https?://github\.com/\S+"                                   # gh: the created/merged thing
    r"|^\s*[✓✔]\s"                                                 # gh: ✓ Merged / ✓ Created
    r"|^\s*(Merged|Created|Deleted|Closed|Reopened|Logged in)\b)",
    re.IGNORECASE,
)
# Lines that are pure chatter even when they contain a keyword.
CHATTER = re.compile(
    r"^\s*(Compiling|Checking|Downloading|Downloaded|Updating|Fresh|Blocking|"
    r"Installing|Locking|Adding|Removing|Documenting|Building|Collecting|"
    r"Requirement already satisfied|Using cached|Preparing|Unpacking)\b"
    r"|^test .* \.\.\. ok$"
    r"|^\s*warning: unused"
    r"|^\s*\|"  # rustc gutter lines only matter inside kept blocks
)


def shell_argv(shell, command):
    if shell == "powershell":
        return [
            "powershell.exe", "-NoProfile", "-NonInteractive",
            "-ExecutionPolicy", "Bypass", "-Command", command,
        ]
    # bash: prefer Git Bash explicitly so a PowerShell-launched hook never
    # lands in WSL's bash.
    for cand in (
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
    ):
        if os.path.exists(cand):
            return [cand, "-lc", command]
    return ["bash", "-lc", command]


def quiet_env():
    env = dict(os.environ)
    env.update({
        "CARGO_TERM_COLOR": "never",
        "CARGO_TERM_PROGRESS_WHEN": "never",
        "NO_COLOR": "1",
        "TERM": "dumb",
        "CI": "1",
        "npm_config_progress": "false",
        "npm_config_color": "false",
        "PIP_PROGRESS_BAR": "off",
        "PIP_NO_COLOR": "1",
        "PYTHONUNBUFFERED": "1",
        "PY_COLORS": "0",
        "RUST_TEST_NOCAPTURE": env.get("RUST_TEST_NOCAPTURE", ""),
        # gh: no pager, no interactive prompts, no update nag, no colour.
        "GH_PAGER": "cat",
        "GH_NO_UPDATE_NOTIFIER": "1",
        "GH_PROMPT_DISABLED": "1",
        "CLICOLOR": "0",
        "CLICOLOR_FORCE": "0",
    })
    env.pop("FORCE_COLOR", None)
    env.pop("GH_FORCE_TTY", None)
    return env


def log_dir():
    d = os.environ.get("CLAUDE_JOB_DIR")
    d = os.path.join(d, "tmp") if d else os.path.join(tempfile.gettempdir(), "claude-quiet")
    os.makedirs(d, exist_ok=True)
    return d


def normalise(raw):
    text = raw.decode("utf-8", errors="replace").replace("\r\n", "\n")
    lines = []
    for line in text.split("\n"):
        if "\r" in line:                      # progress bar: keep final frame
            line = line.split("\r")[-1]
        lines.append(ANSI.sub("", line).rstrip())
    while lines and not lines[-1]:
        lines.pop()
    return lines


def select(lines):
    """Return the set of indices to show."""
    n = len(lines)
    keep = set()
    i = 0
    while i < n:
        line = lines[i]
        if BLOCK_START.match(line):
            j = i
            while j < n and (lines[j].strip() or j == i):
                keep.add(j)
                j += 1
            i = max(j, i + 1)
            continue
        if SUMMARY.search(line) or PROOF_LINE.search(line):
            keep.add(i)
        elif KEYWORD.search(line) and not CHATTER.match(line):
            keep.update(range(i, min(n, i + 1 + CONTEXT_AFTER)))
        i += 1
    for k in range(max(0, n - TAIL_LINES), n):
        if k == n - 1 or not CHATTER.match(lines[k]):
            keep.add(k)
    return keep


def render(lines, keep, header):
    idx = sorted(keep)
    dropped_note = None
    if len(idx) > MAX_SHOWN:
        head, tail = MAX_SHOWN * 3 // 5, MAX_SHOWN - MAX_SHOWN * 3 // 5
        dropped_note = "... [%d kept lines elided between head and tail] ..." % (len(idx) - MAX_SHOWN)
        idx = idx[:head] + [None] + idx[-tail:]
    out = [header]
    prev = -1
    for k in idx:
        if k is None:
            out.append(dropped_note)
            continue
        if prev >= 0 and k != prev + 1:
            out.append("... [%d lines omitted] ..." % (k - prev - 1))
        out.append(lines[k])
        prev = k
    return "\n".join(out)


def select_infra(lines, code):
    """Success: proof lines only (or the last line if none matched).
    Failure: the normal error/summary selection — lose nothing."""
    if code != 0:
        return select(lines)
    keep = {i for i, line in enumerate(lines) if INFRA_OK.search(line) or PROOF_LINE.search(line)}
    if not keep and lines:
        keep.add(len(lines) - 1)
    return keep


def main():
    # Windows consoles default stdout to cp1252; gh issue bodies (→, ✓, emoji)
    # and rustc diagnostics are UTF-8. Never crash on output — substitute.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--shell", choices=("bash", "powershell"), default="bash")
    ap.add_argument("--mode", choices=("filter", "infra"), default="filter",
                    help="filter: error/summary reduction; infra: proof-of-success only (git/gh actions)")
    ap.add_argument("-c", "--command", help="command text (instead of a cmdfile)")
    ap.add_argument("cmdfile", nargs="?")
    args = ap.parse_args()
    if args.command is not None:
        command = args.command
    elif args.cmdfile:
        with open(args.cmdfile, "r", encoding="utf-8") as f:
            command = f.read()
    else:
        ap.error("need a cmdfile or -c")

    d = log_dir()
    stamp = time.strftime("%Y%m%d-%H%M%S")
    fd, log_path = tempfile.mkstemp(prefix="quiet-%s-" % stamp, suffix=".log", dir=d)
    t0 = time.time()
    with os.fdopen(fd, "wb") as log:
        log.write(("$ %s\n" % command).encode("utf-8"))
        proc = subprocess.Popen(
            shell_argv(args.shell, command),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL, env=quiet_env(),
        )
        chunks = []
        for chunk in iter(lambda: proc.stdout.read(65536), b""):
            log.write(chunk)
            chunks.append(chunk)
        code = proc.wait()
    elapsed = time.time() - t0
    raw = b"".join(chunks)
    lines = normalise(raw)

    forced = os.environ.get("FS_QUIET", "1") == "0"
    verbatim = forced or (args.mode != "infra" and len(lines) <= PASS_THROUGH_LINES)
    if verbatim:
        sys.stdout.write("\n".join(lines) + ("\n" if lines else ""))
    else:
        keep = select_infra(lines, code) if args.mode == "infra" else select(lines)
        header = "[quiet:%s] exit=%d  %.1fs  %d lines -> %d shown  full log: %s" % (
            args.mode, code, elapsed, len(lines), min(len(keep), MAX_SHOWN), log_path)
        sys.stdout.write(render(lines, keep, header) + "\n")
    sys.stdout.flush()
    if args.cmdfile:
        try:
            os.remove(args.cmdfile)
        except OSError:
            pass
    return code


if __name__ == "__main__":
    sys.exit(main())
