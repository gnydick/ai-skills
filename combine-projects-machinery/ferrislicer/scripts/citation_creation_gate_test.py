#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Self-test for citation_creation_gate.py: proves the gate can go RED.

Builds a real temp git repo per case (the gate reads `git diff` / `git show`,
so a fixture needs an actual index and, for --base cases, real commits), runs
the gate via CITATION_CREATION_GATE_ROOT, and asserts pass/fail. A checker
that has never been seen red is indistinguishable from a broken one -- same
reasoning as register_check_test.py and citation_source_gate_test.py, whose
shape this follows.

Each case is (name, ok, out, is_red_check). is_red_check marks a case that
asserts the GATE ITSELF returns non-zero on bad input -- as opposed to a case
asserting the gate passes on good input or correctly ignores out-of-scope
input. Every case here is expected to be "ok" (this self-test passing green);
is_red_check says whether the pinned behaviour is the gate going red or
green. Fixed the "always (0 red-checks)" shape (GIT_612, commit 3c6edadd)
before it ever shipped here: this counts CASES THAT PROVE THE GATE CAN FAIL,
not this self-test's own failed assertions.
"""
import importlib.util
import io
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(HERE, "citation_creation_gate.py")


def _load_gate_module():
    """Import citation_creation_gate.py directly (not via subprocess), for
    the unit-level exclusion checks below that assert on CITATION_RE /
    find_new_citations directly rather than round-tripping through a real
    git repo.
    """
    spec = importlib.util.spec_from_file_location("citation_creation_gate", GATE)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


GATE_MOD = _load_gate_module()


def run_git(root, *args):
    p = subprocess.run(
        ["git"] + list(args),
        cwd=root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if p.returncode != 0:
        raise RuntimeError("git %s failed: %s" % (" ".join(args), p.stderr))
    return p.stdout


def write(root, rel, text):
    full = os.path.join(root, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    io.open(full, "w", encoding="utf-8", newline="").write(text)


def init_repo(root):
    run_git(root, "init", "-q", ".")
    run_git(root, "-c", "user.email=t@t", "-c", "user.name=t",
             "commit", "--allow-empty", "-qm", "init")


def commit_all(root, msg):
    run_git(root, "add", "-A")
    run_git(root, "-c", "user.email=t@t", "-c", "user.name=t",
             "commit", "-qm", msg)


def run_gate(root, *args):
    env = dict(os.environ, CITATION_CREATION_GATE_ROOT=root, PYTHONIOENCODING="utf-8")
    p = subprocess.run(
        [sys.executable, GATE] + list(args),
        capture_output=True, text=True, env=env,
    )
    return p.returncode, p.stdout + p.stderr


CITED_MD = (
    "# cited\n"
    "line one\n"
    "line two, non-blank\n"
    "\n"
    "line four, non-blank\n"
)  # line 4 is blank on purpose


def new_tmp():
    return tempfile.mkdtemp(prefix="citcreate_")


def main():
    checks = []  # (name, ok, out, is_red_check)

    # 1. GREEN: a newly staged citation to a real, non-blank line -> passes,
    #    denominator says 1.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/cited.md", CITED_MD)
        commit_all(root, "add cited.md")
        write(root, "docs/notes.md", "See `docs/cited.md:2` for the rule.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 0 and "validated 1 new citation(s) (staged)" in out
        checks.append(("valid new citation passes, denominator=1", ok, out, False))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 2. RED-CHECK: newly staged citation past end of file -> FAILS.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/cited.md", CITED_MD)
        commit_all(root, "add cited.md")
        write(root, "docs/notes.md", "See `docs/cited.md:999` for the rule.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 1 and "past the end of the file" in out
        checks.append(("citation past end of file fails", ok, out, True))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 3. RED-CHECK: newly staged citation to a BLANK line -> FAILS.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/cited.md", CITED_MD)
        commit_all(root, "add cited.md")
        write(root, "docs/notes.md", "See `docs/cited.md:4` for the rule.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 1 and "cites a BLANK line" in out
        checks.append(("citation to blank line fails", ok, out, True))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 4. RED-CHECK: newly staged citation to a file that does not exist -> FAILS.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/notes.md", "See `docs/missing.md:1` for the rule.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 1 and "does not exist" in out
        checks.append(("citation to missing file fails", ok, out, True))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 5. GREEN: a commit that adds no citations passes with denominator 0 --
    #    the common case, and it must read as a normal pass line, not silence.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/notes.md", "Nothing here cites anything.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 0 and "validated 0 new citation(s) (staged)" in out
        checks.append(("no new citations: denominator=0, still passes", ok, out, False))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 6. GREEN, proves SCOPE: a pre-existing BAD citation already in HEAD
    #    (untouched by this diff) must NOT be flagged -- the whole point of
    #    "validated once, at authoring time, never re-audited afterwards".
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/cited.md", CITED_MD)
        write(root, "docs/old.md", "A stale reference: `docs/cited.md:999` (never fixed).\n")
        commit_all(root, "pre-existing bad citation, already committed")
        write(root, "docs/unrelated.md", "Something unrelated, no citation.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = (
            rc == 0
            and "validated 0 new citation(s) (staged)" in out
            and "999" not in out
        )
        checks.append(("pre-existing bad citation is never re-audited", ok, out, False))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 7. RED-CHECK, --base mode: a citation added in a COMMITTED (not staged)
    #    change is still caught when diffing base..HEAD, the merge-gate path.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/cited.md", CITED_MD)
        commit_all(root, "add cited.md")
        base_sha = run_git(root, "rev-parse", "HEAD").strip()
        write(root, "docs/notes.md", "See `docs/cited.md:4` for the rule.\n")  # blank line
        commit_all(root, "add bad citation, committed not staged")
        rc, out = run_gate(root, "--base", base_sha)
        ok = rc == 1 and "cites a BLANK line" in out and "HEAD" in out
        checks.append(("--base mode catches a committed bad citation", ok, out, True))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 8. GREEN, --base mode: a good citation added in a committed change passes.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/cited.md", CITED_MD)
        commit_all(root, "add cited.md")
        base_sha = run_git(root, "rev-parse", "HEAD").strip()
        write(root, "docs/notes.md", "See `docs/cited.md:2` for the rule.\n")
        commit_all(root, "add good citation, committed")
        rc, out = run_gate(root, "--base", base_sha)
        ok = rc == 0 and "validated 1 new citation(s)" in out
        checks.append(("--base mode passes a good committed citation", ok, out, False))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 9. RED-CHECK: a range citation whose END is past the file -> FAILS.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/cited.md", CITED_MD)
        commit_all(root, "add cited.md")
        write(root, "docs/notes.md", "See `docs/cited.md:2-999` for the block.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 1 and "range end is out of range" in out
        checks.append(("range citation with out-of-range end fails", ok, out, True))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 10. GREEN: a valid range citation (start and end both real lines) passes.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, "docs/cited.md", CITED_MD)
        commit_all(root, "add cited.md")
        write(root, "docs/notes.md", "See `docs/cited.md:2-4` for the block.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 0 and "validated 1 new citation(s)" in out
        checks.append(("valid range citation passes", ok, out, False))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 11. GREEN, the exact GIT_624 miss: a newly staged citation to a
    #     dot-prefixed path (`.claude/hooks/quiet_hook.py`-shaped) is now
    #     recognized and validated. Before the fix, this path never even
    #     reached the regex -- `git diff` on 98a412fc against the gate's
    #     predecessor validated 0 new citations despite adding exactly this
    #     shape of citation.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, ".claude/hooks/quiet_hook.py", CITED_MD)
        commit_all(root, "add quiet_hook.py")
        write(root, "docs/notes.md", "See `.claude/hooks/quiet_hook.py:2` for it.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 0 and "validated 1 new citation(s) (staged)" in out
        checks.append(("dot-prefixed path citation is now recognized and passes", ok, out, False))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 12. RED-CHECK: the same dot-prefixed shape, but citing a line past the
    #     end of the file -- proves recognizing it did not also mean
    #     blindly accepting it; validation still applies.
    root = new_tmp()
    try:
        init_repo(root)
        write(root, ".claude/hooks/quiet_hook.py", CITED_MD)
        commit_all(root, "add quiet_hook.py")
        write(root, "docs/notes.md", "See `.claude/hooks/quiet_hook.py:999` for it.\n")
        run_git(root, "add", "-A")
        rc, out = run_gate(root)
        ok = rc == 1 and "past the end of the file" in out
        checks.append(("dot-prefixed path citation past end of file still fails", ok, out, True))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # 13. RED-CHECK, exclusion proof (not vacuous): an IP-literal that
    #     happens to carry a recognized extension (`192.168.1.py:10`) is
    #     regex-shaped -- CITATION_RE alone DOES match it -- but the
    #     filename-stem-has-a-letter filter rejects it, so it is never
    #     counted as a citation. Asserting BOTH halves is what makes this a
    #     real red-check on the exclusion: if `_looks_like_a_path` were
    #     deleted (the exclusion "removed"), `regex_matches` staying True
    #     shows find_new_citations would then wrongly report 1, not 0 --
    #     the mechanism this case exists to pin.
    regex_matches = bool(GATE_MOD.CITATION_RE.search("`192.168.1.py:10`"))
    filtered = GATE_MOD.find_new_citations(["Reachable at `192.168.1.py:10` internally.\n"])
    ok = regex_matches and filtered == []
    checks.append((
        "IP-literal-with-extension: regex matches, stem-letter filter removes it "
        "(exclusion proven, not accidental)",
        ok,
        "CITATION_RE match=%r find_new_citations=%r" % (regex_matches, filtered),
        True,
    ))

    # 14. GREEN, regression: a bare IP-literal (`127.0.0.1:8080`, no
    #     extension at all) stays excluded -- extension curation alone
    #     already rules it out, unchanged by this fix.
    out14 = GATE_MOD.find_new_citations(["Reachable at `127.0.0.1:8080` sometimes.\n"])
    ok = out14 == []
    checks.append(("bare IP-literal (no extension) stays excluded", ok, repr(out14), False))

    # 15. GREEN, regression: a version string (`1.2.3:4`) stays excluded --
    #     "4" is not a recognized extension.
    out15 = GATE_MOD.find_new_citations(["Bumped to `1.2.3:4` today.\n"])
    ok = out15 == []
    checks.append(("version string stays excluded", ok, repr(out15), False))

    # 16. GREEN, regression: a timestamp (`12:34`) stays excluded -- no dot
    #     at all, so it never reaches the regex.
    out16 = GATE_MOD.find_new_citations(["Meeting at `12:34` sharp.\n"])
    ok = out16 == []
    checks.append(("timestamp stays excluded", ok, repr(out16), False))

    # 17. GREEN, regression: a ratio (`16:9`) stays excluded, same reason.
    out17 = GATE_MOD.find_new_citations(["Aspect ratio `16:9` widescreen.\n"])
    ok = out17 == []
    checks.append(("ratio stays excluded", ok, repr(out17), False))

    # 18. GREEN, regression: a Windows drive path (`C:\Users\foo.py:10`)
    #     stays excluded -- the drive letter's colon is not in the path
    #     charset, so the pattern never reaches the `.py:10` tail.
    out18 = GATE_MOD.find_new_citations(["See `C:\\Users\\foo.py:10` for it.\n"])
    ok = out18 == []
    checks.append(("Windows drive path stays excluded", ok, repr(out18), False))

    failed = [name for name, ok, _, _ in checks if not ok]
    red_checks = sum(1 for _, _, _, is_red in checks if is_red)
    for name, ok, out, _ in checks:
        status = "PASS" if ok else "FAIL"
        print("%s: %s" % (status, name))
        if not ok:
            print(out)

    print("%d/%d cases pass (%d red-checks)" % (len(checks) - len(failed), len(checks), red_checks))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
