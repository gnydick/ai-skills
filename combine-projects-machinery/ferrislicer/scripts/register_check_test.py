#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Self-test for register_check.py: proves every blocking check can actually fail.

Builds a minimal fixture tree in a temp dir, runs the checker via
REGISTER_CHECK_ROOT, and asserts pass/fail for each mutation. A checker that has
never been seen red is indistinguishable from a broken one.
"""
import io
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CHECKER = os.path.join(HERE, "register_check.py")
GREEN, YELLOW = "\U0001F7E2", "\U0001F7E1"

BASE_REGISTER = (
    "# Register fixture\n\n"
    "## Contents\n\n"
    "- x\n\n"
    "## %s Group one\n\n"
    "Summary.\n\n"
    "Enforcement: `docs/INVARIANTS.md` §7.1.\n\n"
    "Supersedes: `docs/old-spec.md` (fixture).\n\n"
    "| Date | Rule | Source |\n|---|---|---|\n"
    "| 2026-01-01 | A rule. | `docs/cited.md:3` |\n"
    # cites the heading by NAME while the heading carries a "(HARD RULE)"
    # suffix: the green case that pins PREFIX matching. Rewrite the check as
    # equality and this row goes red, which is the point of keeping it.
    "| 2026-01-03 | A sectioned rule. | `CLAUDE.md` § Fixture rule |\n\n"
    "# Solo rules, by area\n\n"
    "## Solo — Area\n\n"
    "| Date | Rule | Source |\n|---|---|---|\n"
    # :6 ("solo line"), not :5 — :5 is BLANK, and the blank-line check caught
    # this fixture citing nothing the moment it went blocking.
    "| 2026-01-02 | Solo rule. | `docs/cited.md:6` |\n"
) % GREEN

OLD_SPEC = (
    "# Old spec\n\n"
    "> SUPERSEDED (2026-01-01): see docs/RULES-GROUPED.md § Group one\n\n"
    "Body.\n"
)

INVARIANTS = "# Invariant ledger\n\n## 7.1 Geometry\n\nrows\n"


def build(root, register=BASE_REGISTER, old_spec=OLD_SPEC, inbox=None):
    docs = os.path.join(root, "docs")
    os.makedirs(docs)
    for name, text in (
        ("RULES-GROUPED.md", register),
        ("old-spec.md", old_spec),
        ("INVARIANTS.md", INVARIANTS),
        ("cited.md", "# cited\n\nline\nrule line\n\nsolo line\n"),
    ):
        io.open(os.path.join(docs, name), "w", encoding="utf-8", newline="").write(text)
    # CLAUDE.md lives at the REPO ROOT, not under docs/. Its heading carries a
    # decoration the citation deliberately omits.
    io.open(
        os.path.join(root, "CLAUDE.md"), "w", encoding="utf-8", newline=""
    ).write("# Fixture\n\n## Fixture rule (HARD RULE)\n\nbody\n")
    if inbox is not None:
        io.open(
            os.path.join(docs, "rule-inbox.md"), "w", encoding="utf-8", newline=""
        ).write(inbox)


def run(root, *args):
    env = dict(os.environ, REGISTER_CHECK_ROOT=root, PYTHONIOENCODING="utf-8")
    p = subprocess.run(
        [sys.executable, CHECKER] + list(args),
        capture_output=True,
        text=True,
        env=env,
    )
    return p.returncode, p.stdout + p.stderr


def case(name, expect_rc, mutate=None, args=()):
    root = tempfile.mkdtemp(prefix="regchk_")
    try:
        build(root)
        if mutate:
            mutate(root)
        rc, out = run(root, *args)
        ok = rc == expect_rc
        print("%s %s (rc=%d, want %d)" % ("PASS" if ok else "FAIL", name, rc, expect_rc))
        if not ok:
            print(out)
        return ok
    finally:
        shutil.rmtree(root, ignore_errors=True)


def edit(root, name, old, new):
    p = os.path.join(root, "docs", name)
    t = io.open(p, encoding="utf-8").read()
    assert old in t, (name, old)
    io.open(p, "w", encoding="utf-8", newline="").write(t.replace(old, new))


def main():
    results = [
        case("clean fixture passes", 0),
        case("clean fixture passes --fast", 0, args=("--fast",)),
        case(
            "missing citation file fails",
            1,
            lambda r: edit(r, "RULES-GROUPED.md", "docs/cited.md:3", "docs/gone.md:3"),
        ),
        case(
            "group header without circle fails",
            1,
            lambda r: edit(r, "RULES-GROUPED.md", "## %s Group one" % GREEN, "## Group one"),
        ),
        case(
            "solo header with circle fails",
            1,
            lambda r: edit(
                r, "RULES-GROUPED.md", "## Solo — Area", "## %s Solo — Area" % YELLOW
            ),
        ),
        case(
            "stamp naming unknown group fails",
            1,
            lambda r: edit(r, "old-spec.md", "§ Group one", "§ No such group"),
        ),
        case(
            "Supersedes target without stamp fails",
            1,
            lambda r: edit(r, "old-spec.md", "> SUPERSEDED", "SUPERSEDED-NOT"),
        ),
        case(
            "bad INVARIANTS anchor fails",
            1,
            lambda r: edit(r, "RULES-GROUPED.md", "§7.1", "§7.9"),
        ),
        case(
            "PENDING inbox entry fails",
            1,
            lambda r: io.open(
                os.path.join(r, "docs", "rule-inbox.md"), "w", encoding="utf-8", newline=""
            ).write("## 2026-01-01 sess\nRULE: x\nDisposition: PENDING\n"),
        ),
        # ── the citation-drift gate (GIT_542) ──────────────────────────────
        case(
            "bare CLAUDE.md line citation fails",
            1,
            lambda r: edit(
                r,
                "RULES-GROUPED.md",
                "`CLAUDE.md` § Fixture rule",
                "`CLAUDE.md:3`",
            ),
        ),
        case(
            "section citation naming no heading fails",
            1,
            lambda r: edit(
                r,
                "RULES-GROUPED.md",
                "§ Fixture rule",
                "§ No such heading anywhere",
            ),
        ),
        case(
            "section citation whose file is gone fails",
            1,
            lambda r: os.remove(os.path.join(r, "CLAUDE.md")),
        ),
        case(
            "citation landing on a BLANK line fails",
            1,
            # docs/cited.md is "# cited\n\nline\nrule line\n\nsolo line\n":
            # line 2 is blank, so retargeting the row there cites nothing.
            lambda r: edit(r, "RULES-GROUPED.md", "`docs/cited.md:3`", "`docs/cited.md:2`"),
        ),
        case(
            "a heading inside a code fence is not a heading",
            1,
            lambda r: (
                io.open(
                    os.path.join(r, "CLAUDE.md"), "w", encoding="utf-8", newline=""
                # title deliberately shares NO prefix with "Fixture rule":
                # matching is bidirectional, so a "# Fixture" title would
                # legitimately absorb the citation and hide the fence bug.
                ).write("# Doc\n\n```c\n## Fixture rule (HARD RULE)\n```\n")
            ),
        ),
        # A CORRECT numbered-heading citation resolves and is accepted. A WRONG
        # one is skipped, not caught — see check_section_citations' stated
        # limitation. This case pins the half that is real; claiming the other
        # half would be the "gate verified in a state it cannot survive" error.
        case(
            "numbered heading resolves when correct",
            0,
            lambda r: (
                io.open(
                    os.path.join(r, "CLAUDE.md"), "w", encoding="utf-8", newline=""
                ).write("# Fixture\n\n## 2.9 A numbered section\n\nbody\n"),
                edit(
                    r,
                    "RULES-GROUPED.md",
                    "`CLAUDE.md` § Fixture rule",
                    "`CLAUDE.md` § 2.9 A numbered section",
                ),
            ),
        ),
        case(
            "numeric section anchor is not heading-checked",
            0,
            lambda r: edit(
                r,
                "RULES-GROUPED.md",
                "`CLAUDE.md` § Fixture rule",
                "`CLAUDE.md` § 7.1 owned by another gate",
            ),
        ),
        case(
            "dispositioned inbox passes",
            0,
            lambda r: io.open(
                os.path.join(r, "docs", "rule-inbox.md"), "w", encoding="utf-8", newline=""
            ).write("## 2026-01-01 sess\nRULE: x\nDisposition: not a rule - test\n"),
        ),
    ]
    print("%d/%d cases pass" % (sum(results), len(results)))
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
