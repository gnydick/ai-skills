"""Red-check fixture for scripts/sweep_guard.sh (GIT_700).

Proves the sweep-guard advisory FIRES on the incident shape (5465f460: a
docs commit that a wildcard `git add` handed a newly-tracked non-doc file)
and stays SILENT on the three neighbouring legitimate shapes. Each case
builds a throwaway git repo under tempfile - the real repo's index is never
touched.

Cases:
  1. POSITIVE (incident replica): docs modified + scripts baseline modified
     + stray scripts file ADDED -> fires, names the stray file exactly,
     prints the denominator line.
  2. docs-only commit -> silent.
  3. docs + MODIFIED non-doc file -> silent.
  4. non-docs code commit with additions -> silent.

The positive control asserts the exact advisory message shape, so a future
edit that breaks the message (or mutes the guard) turns this red - the
same discipline as citation_source_gate_test.py's zero_files_scanned_case.

Run: python scripts/sweep_guard_test.py   (exit 0 = all cases pass)
"""

import os
import shutil
import subprocess
import sys
import tempfile

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUARD = os.path.join(REPO_ROOT, "scripts", "sweep_guard.sh")


def find_real_bash():
    """Resolve a REAL Git-Bash/MSYS bash.exe - never the WSL launcher stub
    at C:\\Windows\\System32\\bash.exe. Same rationale and shape as
    testq_verdict_test.py's resolver: shutil.which walks PATH in order
    (unlike CreateProcess's implicit search), System32/SysWOW64/WindowsApps
    candidates are rejected, well-known Git-for-Windows locations are
    fallbacks, and there is NO silent fallback - failure raises, naming
    every path checked, per CLAUDE.md section No WSL.
    """
    checked = []
    candidates = []
    override = os.environ.get("SWEEP_GUARD_TEST_BASH")
    if override:
        candidates.append(override)
    which_bash = shutil.which("bash")
    if which_bash:
        candidates.append(which_bash)
    candidates.extend(
        [
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files\Git\usr\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\usr\bin\bash.exe",
        ]
    )
    for candidate in candidates:
        checked.append(candidate)
        normalized = os.path.normcase(os.path.abspath(candidate))
        if (
            "system32" in normalized
            or "syswow64" in normalized
            or "windowsapps" in normalized
        ):
            continue
        if os.path.isfile(candidate):
            return candidate
    raise RuntimeError(
        "no usable Git-Bash found; checked and rejected/missing: %s"
        % ", ".join(checked)
    )


BASH = find_real_bash()


def run(cmd, cwd):
    p = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8"
    )
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def build_repo(root):
    """git repo with an initial commit holding docs/rules/x.md, CLAUDE.md,
    scripts/baseline.json, crates/core.rs - the shapes the cases mutate."""
    run(["git", "init", "-q"], root)
    run(["git", "config", "user.email", "t@t"], root)
    run(["git", "config", "user.name", "t"], root)
    os.makedirs(os.path.join(root, "docs", "rules"))
    os.makedirs(os.path.join(root, "scripts"))
    os.makedirs(os.path.join(root, "crates"))
    for rel, text in [
        ("CLAUDE.md", "# rules\n"),
        (os.path.join("docs", "rules", "x.md"), "evidence\n"),
        (os.path.join("scripts", "baseline.json"), "{}\n"),
        (os.path.join("crates", "core.rs"), "fn main() {}\n"),
    ]:
        with open(os.path.join(root, rel), "w", newline="\n") as f:
            f.write(text)
    run(["git", "add", "-A"], root)
    run(["git", "commit", "-q", "-m", "init"], root)


def write(root, rel, text):
    path = os.path.join(root, rel)
    d = os.path.dirname(path)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    with open(path, "w", newline="\n") as f:
        f.write(text)


def run_guard(root):
    return run([BASH, GUARD], root)


def case(name, stage_fn, expect_fire, expect_substrings=()):
    root = tempfile.mkdtemp(prefix="sweepguard_")
    try:
        build_repo(root)
        stage_fn(root)
        rc, out = run_guard(root)
        fired = "ADVISORY: sweep-guard" in out
        ok = rc == 0 and fired == expect_fire
        for s in expect_substrings:
            if s not in out:
                ok = False
        print(
            "%s %s (rc=%d fired=%s want_fire=%s)"
            % ("PASS" if ok else "FAIL", name, rc, fired, expect_fire)
        )
        if not ok:
            print(out if out.strip() else "(no output)")
        return ok
    finally:
        shutil.rmtree(root, ignore_errors=True)


def main():
    results = []

    # 1. POSITIVE - incident replica (5465f460): docs modified, baseline
    #    modified (tolerated scripts plumbing), stray scripts file ADDED.
    def incident(root):
        write(root, "CLAUDE.md", "# rules v2\n")
        write(root, os.path.join("docs", "rules", "x.md"), "evidence v2\n")
        write(root, os.path.join("scripts", "baseline.json"), '{"n":2}\n')
        write(root, os.path.join("scripts", "s7_probe.py"), "print(7)\n")
        run(["git", "add", "CLAUDE.md", "docs", "scripts"], root)

    results.append(
        case(
            "incident replica fires, names file, denominator",
            incident,
            True,
            (
                "ADVISORY: sweep-guard denominator: 4 staged, "
                "1 newly-tracked, 1 non-doc suspect(s).",
                "ADVISORY: docs commit stages a newly-tracked non-doc "
                "file: scripts/s7_probe.py - confirm not swept by a "
                "wildcard git add.",
            ),
        )
    )

    # 2. docs-only commit -> silent.
    def docs_only(root):
        write(root, os.path.join("docs", "rules", "x.md"), "evidence v2\n")
        write(root, "CLAUDE.md", "# rules v2\n")
        run(["git", "add", "CLAUDE.md", "docs"], root)

    results.append(case("docs-only commit silent", docs_only, False))

    # 3. docs + MODIFIED non-doc file -> silent (no newly-tracked suspect;
    #    also covers the baseline.json shape from GIT_698 itself).
    def docs_plus_modified(root):
        write(root, os.path.join("docs", "rules", "x.md"), "evidence v2\n")
        write(root, os.path.join("crates", "core.rs"), "fn main() { }\n")
        run(["git", "add", "docs", os.path.join("crates", "core.rs")], root)

    results.append(
        case("docs + modified non-doc silent", docs_plus_modified, False)
    )

    # 4. non-docs code commit WITH an added file -> silent (no docs staged).
    def code_commit(root):
        write(root, os.path.join("crates", "core.rs"), "fn main() { }\n")
        write(root, os.path.join("crates", "new_mod.rs"), "pub fn f() {}\n")
        run(["git", "add", "crates"], root)

    results.append(case("code commit with additions silent", code_commit, False))

    # 5. mixed commit: docs + modified non-doc non-scripts + stray added ->
    #    silent (deliberate mixed commit disqualifies docs-shape).
    def mixed(root):
        write(root, os.path.join("docs", "rules", "x.md"), "evidence v2\n")
        write(root, os.path.join("crates", "core.rs"), "fn main() { }\n")
        write(root, os.path.join("scripts", "stray.py"), "print(1)\n")
        run(["git", "add", "docs", "crates", "scripts"], root)

    results.append(case("mixed docs+code commit silent", mixed, False))

    n_pass = sum(1 for r in results if r)
    print("%d/%d cases pass" % (n_pass, len(results)))
    return 0 if n_pass == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
