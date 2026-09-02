#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Creation-time check: validates `path:line` citations ADDED by a change.

Gabe's ruling (#624/#625, 2026-08-27), verbatim in substance: "I only want to
test for it when it is first created, to make sure it is correct at that
time." A heavier continuous-drift design -- re-checking the register's
existing ~410 citations on every run -- was REJECTED: line numbers moving is
normal and expected, and a gate that goes red on ordinary drift is noise that
eventually gets disabled. So: a citation is validated ONCE, at authoring
time. Existing citations are never re-audited here, and drift afterwards is
accepted, not reported -- this script only ever looks at lines the diff under
test ADDS.

WHAT THIS CHECKS, for every backtick-wrapped `path.ext:N` (or `path.ext:N-M`)
token found on a line the diff ADDS:
  1. the cited file exists (resolved against the commit/index content being
     checked, never the working tree -- see "content source" below);
  2. the cited line N (or the START of an N-M range) is within that file's
     line count;
  3. that line is not blank;
  4. for a range, the END line is also within the file's line count (its
     blankness is not checked -- see "what this does not check").

WHAT THIS DELIBERATELY DOES NOT CHECK -- staying conservative, because a
check that false-positives on legitimate citations gets disabled, which is
the exact failure Gabe rejected the heavier design to avoid:
  - whether the cited line SUPPORTS the claim in the surrounding prose
    (semantic relatedness). That needs a human reading the fact next to the
    source; no automated heuristic here was found that would not risk
    flagging a correct citation as wrong. Left undone and said so, per
    CLAUDE.md "Where an expectation genuinely cannot be derived yet, say so
    ... rather than pinning ... and calling it a contract."
  - any citation NOT touched by this diff -- an existing citation whose line
    drifted is out of scope BY DESIGN (Gabe's ruling above), not an oversight.
  - a range's END line's blankness, since a legitimately cited range (e.g. a
    whole function) routinely spans blank lines internally.
  - the general-purpose scope of docs/RULES-GROUPED.md's own citation checks
    (register_check.py): those cover header/circle/stamp bookkeeping this
    script does not touch. This script is citation-content-only, and runs
    over any tracked text file, not only the register.
  - this gate's own two files (SELF_EXCLUDE, below) -- the self-test's
    fixture strings are citation-SHAPED test data, not real claims.

CONTENT SOURCE (never the working tree, so a partially-staged file cannot
make this pass or fail on the wrong bytes):
  - default (no --base): the INDEX (`git show :path`) -- the pre-commit,
    staged-changes use.
  - `--base REF`: REF..HEAD, content read at HEAD (`git show HEAD:path`) --
    the merge-gate use, catching a citation authored in a commit whose
    author never had `.githooks/pre-commit` wired in
    (`core.hooksPath` is a local, per-clone git setting; nothing in git
    itself enforces it). Two-dot diff (REF HEAD), matching
    `merge-gate.sh`'s `fmt_gate` convention, not three-dot / merge-base.

DENOMINATOR: every run prints "validated N new citation(s)", including N=0 --
most commits add no citations, and that must read as a normal pass, never as
silence indistinguishable from a broken diff (CLAUDE.md "A measurement's
scope is part of its claim").

Exit 0: every newly added citation checked out (including zero found).
Exit 1: at least one newly added citation fails, or `git diff`/`git show`
        itself could not run (never a silent pass).

Usage:
  python scripts/citation_creation_gate.py            # staged changes
  python scripts/citation_creation_gate.py --base SHA  # SHA..HEAD
"""
import os
import re
import subprocess
import sys

REPO = os.environ.get(
    "CITATION_CREATION_GATE_ROOT",
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)

# Curated extension list, not "any word after a dot" -- `HH:MM:SS`-shaped
# text and ratios (`16:9`) never carry one of these extensions and so never
# reach the regex at all.
_EXTS = (
    "rs", "py", "md", "toml", "json", "ya?ml", "sh", "ts", "tsx", "jsx?",
    "txt", "rst", "html?", "css", "cpp", "cc", "h", "hpp", "java", "kt",
    "gradle", "cfg", "ini", "proto", "sql",
)
# Path grammar: permissive on purpose. This used to require the path START
# with a letter/underscore, specifically to keep `127.0.0.1:8080` from
# reading as a citation -- but that same anchor made a dot-prefixed REAL
# path (`.claude/hooks/quiet_hook.py:59`) invisible too (GIT_624: the
# creation gate validated 0 citations on the commit that fixed exactly this
# path). A path may now start with a dot, a digit, anything -- the
# discriminator moved to `_looks_like_a_path` below, which checks the
# FILENAME STEM instead of the first character of the whole path.
CITATION_RE = re.compile(
    r"`([\w.][\w./\\-]*\.(?:%s)):(\d+)(?:-(\d+))?`" % "|".join(_EXTS)
)

_STEM_HAS_LETTER_RE = re.compile(r"[A-Za-z]")


def _basename_stem(path):
    """The filename stem: the last path segment, minus its final extension.

    `.claude/hooks/quiet_hook.py` -> `quiet_hook`. `192.168.1.py` (no
    directory) -> `1`. Directory segments are never checked -- a real
    citation's directories may be dates, version numbers, or dot-prefixes
    (`docs/uat/2026-08-21/GIT_303/...`, `.claude/...`); only the FILENAME
    has to look like a name.
    """
    base = re.split(r"[\\/]", path)[-1]
    return base.rsplit(".", 1)[0]


def _looks_like_a_path(path):
    """The discriminator: the filename stem contains at least one ASCII
    letter. `quiet_hook` (real citation) passes; `1` (the stem of
    `192.168.1.py`, an IP literal that happens to carry a valid extension)
    does not. This replaces "the path starts with a letter" -- that older
    rule also rejected legitimate dot-prefixed paths, which is the GIT_624
    regression this function exists to fix.
    """
    return bool(_STEM_HAS_LETTER_RE.search(_basename_stem(path)))


# This gate and its self-test are EXCLUDED from their own scan. The self-test
# necessarily contains citation-SHAPED string literals as fixture data (bad
# ones on purpose, to prove the gate goes red), and this gate's own docstring
# and comments cite real paths. Measuring the ruler with itself: found by
# dogfooding this gate against its own two-file commit -- it flagged its
# self-test's fixture strings (`docs/cited.md:999` etc., never real
# documentation claims) as failing new citations. Same reasoning and shape as
# citation_source_gate.py's SELF_EXCLUDE.
SELF_EXCLUDE = frozenset((
    "scripts/citation_creation_gate.py",
    "scripts/citation_creation_gate_test.py",
))


def run_git(args):
    p = subprocess.run(
        ["git"] + args,
        cwd=REPO,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return p.returncode, p.stdout, p.stderr


def added_lines(diff_args):
    """Text of every line the diff ADDS (the '+' side), across all files
    except SELF_EXCLUDE.

    -U0: zero context lines. Only additions are read (git diff's own '+'
    marker), so a citation that merely scrolled into view under more context
    would never be mistaken for one this diff added. File boundaries are
    tracked via the diff's own `+++ b/<path>` header lines -- the only place
    a per-file unified diff states which file the '+' lines beneath it
    belong to.
    """
    rc, out, err = run_git(["diff", "--no-color", "-U0"] + diff_args)
    if rc != 0:
        return None, err
    lines = []
    current_excluded = False
    for line in out.splitlines():
        if line.startswith("+++ "):
            path = line[4:]
            if path.startswith("b/"):
                path = path[2:]
            current_excluded = path in SELF_EXCLUDE
            continue
        if line.startswith("---"):
            continue
        if line.startswith("+") and not current_excluded:
            lines.append(line[1:])
    return lines, None


def find_new_citations(added):
    seen = set()
    out = []
    for line in added:
        for m in CITATION_RE.finditer(line):
            path = m.group(1).replace("\\", "/")
            if not _looks_like_a_path(path):
                # Regex-shaped but filename-stem-has-no-letter (e.g. an
                # IP literal that happens to carry a recognized extension,
                # `192.168.1.py:10`) -- not a citation, silently ignored,
                # same as before this token could even reach the regex.
                continue
            n1 = int(m.group(2))
            n2 = int(m.group(3)) if m.group(3) else None
            key = (path, n1, n2)
            if key in seen:
                continue
            seen.add(key)
            out.append(key)
    return out


def show(pathref):
    """`git show <pathref>` content, or None if it does not resolve.

    Reads from git's object store (index or a commit), never the working
    tree -- see the module docstring's "content source" note.
    """
    rc, out, _ = run_git(["show", pathref])
    if rc != 0:
        return None
    return out


def validate(path, n1, n2, ref_mode, errors):
    # Content is always read at the INDEX (staged mode) or at HEAD (--base
    # mode) -- never at the diff's base ref. `--base` only selects which
    # lines count as "newly added"; the content those lines are checked
    # against is always the tip of what is being committed/merged.
    pathref = (":%s" % path) if ref_mode == "staged" else ("HEAD:%s" % path)
    content = show(pathref)
    if content is None:
        errors.append(
            "`%s:%d%s` cites a file that does not exist (resolved as `%s`)"
            % (path, n1, ("-%d" % n2) if n2 else "", pathref)
        )
        return
    body = content.splitlines()
    total = len(body)
    if n1 < 1 or n1 > total:
        errors.append(
            "`%s:%d` is past the end of the file (%d line(s))" % (path, n1, total)
        )
        return
    if not body[n1 - 1].strip():
        errors.append("`%s:%d` cites a BLANK line" % (path, n1))
    if n2 is not None and (n2 < n1 or n2 > total):
        errors.append(
            "`%s:%d-%d` range end is out of range (%d line(s))" % (path, n1, n2, total)
        )


def main(argv):
    base = None
    if "--base" in argv:
        idx = argv.index("--base")
        if idx + 1 >= len(argv):
            print("FAIL: --base requires a ref argument")
            return 1
        base = argv[idx + 1]

    if base:
        ref_mode = "head"
        diff_args = [base, "HEAD"]
        scope_label = "against %s..HEAD" % base
    else:
        ref_mode = "staged"
        diff_args = ["--cached"]
        scope_label = "staged"

    added, err = added_lines(diff_args)
    if added is None:
        print("FAIL: git diff did not run (%s):" % scope_label)
        print(err)
        return 1

    citations = find_new_citations(added)
    errors = []
    for path, n1, n2 in citations:
        validate(path, n1, n2, ref_mode, errors)

    for e in errors:
        print("FAIL:", e)
    print(
        "citation_creation_gate: validated %d new citation(s) (%s)"
        % (len(citations), scope_label)
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
