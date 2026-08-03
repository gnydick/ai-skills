"""Mechanical grading for the developer-friendliness evals.

Everything here is a fact about files, not a judgement about prose: what
changed relative to the fixture, what was added, and how long the final
message is. The judgement calls stay with the human reviewer, which is the
split the skill itself argues for.

Usage:  python grade.py <run-dir> [--fixture <fixture-dir>]

<run-dir> holds one directory per eval, each with with_skill/ and
without_skill/ beneath it. Keep it outside this repository: results
committed by accident are worse than results lost.

--fixture defaults to fixtures/without-conventions, the harder variant.
Pass fixtures/with-conventions to grade runs made against the other one;
grading against the wrong fixture silently reports every file as added.

Writes: <run>/grading.json and <run>/run-1/grading.json for every run found.
The duplicate exists because the benchmark aggregator and the output viewer
disagree about where to look; neither is worth forking the script over.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def digest(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def tree(root: Path) -> dict:
    if not root.is_dir():
        return {}
    out = {}
    for p in sorted(root.rglob("*")):
        if p.is_file() and "__pycache__" not in p.parts and not p.name.endswith(".pyc"):
            out[p.relative_to(root).as_posix()] = digest(p)
    return out


def compare(fixture: Path, work: Path) -> dict:
    base, now = tree(fixture), tree(work)
    return {
        "added": sorted(set(now) - set(base)),
        "removed": sorted(set(base) - set(now)),
        "modified": sorted(k for k in set(base) & set(now) if base[k] != now[k]),
    }


def headings(p: Path) -> int:
    return len(re.findall(r"^## ", p.read_text(encoding="utf-8"), re.M)) if p.is_file() else 0


def stale_reference_handled(work: Path) -> tuple:
    """The fixture's docs/notes.md cites tests/make_fixtures.py, which does
    not exist. Removing the claim or marking it wrong both count; silently
    leaving it standing does not."""
    p = work / "docs" / "notes.md"
    if not p.is_file():
        return False, "docs/notes.md absent"
    txt = p.read_text(encoding="utf-8")
    if "make_fixtures" not in txt:
        return True, "stale reference removed"
    # A correction may keep the name while marking it historical, so past-tense
    # and absence markers both count. Narrower wording than this scored a
    # thorough rewrite as untouched.
    if re.search(r"(does not exist|doesn't exist|no longer|missing|not present|"
                 r"stale|removed|outdated|gone|previously|used to|no setup)", txt, re.I):
        return True, "stale reference corrected in place"
    return False, "stale reference left standing"


def check(fixture: Path, work: Path, msg_path: Path, eval_name: str) -> list:
    d = compare(fixture, work)
    touched = set(d["added"]) | set(d["modified"])
    msg = msg_path.read_text(encoding="utf-8") if msg_path.is_file() else ""
    msg_lines = len([l for l in msg.splitlines() if l.strip()])

    # Derived from the fixture rather than hardcoded, so a fixture variant
    # cannot silently invalidate the assertion.
    root_allowed = {f for f in tree(fixture) if "/" not in f}
    # Only *documents* count. New root-level code is not a record at all, and
    # replacing a note with a mechanism is the behaviour this skill most wants
    # — penalising a new conftest.py would score its best move as its worst.
    DOC_SUFFIXES = (".md", ".txt", ".rst", ".adoc")
    new_root_docs = [
        f for f in d["added"]
        if "/" not in f and f not in root_allowed and f.lower().endswith(DOC_SUFFIXES)
    ]

    exp = []

    def add(text, passed, evidence):
        exp.append({"text": text, "passed": bool(passed), "evidence": evidence})

    add(
        "Adds no new top-level document; uses the places the project already has",
        not new_root_docs,
        f"new root files: {new_root_docs or 'none'}",
    )
    add("Wrote a final message to the developer", msg_lines > 0, f"{msg_lines} non-blank lines")

    if eval_name == "discovers-and-defers":
        imp = work / "src" / "importer.py"
        src = imp.read_text(encoding="utf-8") if imp.is_file() else ""
        add("Fixes quoted-comma parsing rather than hand-rolling a splitter",
            "import csv" in src,
            "uses the csv module" if "import csv" in src else "no csv module import")
        add("Adds a regression test for the quoted-comma case",
            any(f.startswith("tests/") for f in touched),
            f"tests touched: {sorted(f for f in touched if f.startswith('tests/')) or 'none'}")
        add("Files what it did not fix into the existing docs/issues.md",
            headings(work / "docs" / "issues.md") > headings(fixture / "docs" / "issues.md"),
            f"issues.md entries {headings(fixture/'docs'/'issues.md')} -> {headings(work/'docs'/'issues.md')}")
        add("Does not pad the decision log for a routine bug fix",
            headings(work / "docs" / "decisions.md") - headings(fixture / "docs" / "decisions.md") <= 1,
            f"decisions.md entries {headings(fixture/'docs'/'decisions.md')} -> {headings(work/'docs'/'decisions.md')}")
        add("Corrects the stale record it encountered", *stale_reference_handled(work))

    if eval_name == "session-boundary-handoff":
        up = work / "src" / "uploader.py"
        src = up.read_text(encoding="utf-8") if up.is_file() else ""
        add("Retry logic exists in the uploader",
            "retry" in src.lower() or "backoff" in src.lower(),
            "retry/backoff present" if "retry" in src.lower() else "none found")
        add("Does not retry 4xx",
            bool(re.search(r"4\d\d|>=\s*500|<\s*500", src)),
            "status-code discrimination present" if re.search(r"4\d\d|>=\s*500", src) else "none found")
        add("Leaves handoff state in the established place (docs/notes.md)",
            "docs/notes.md" in touched,
            f"docs/notes.md {'updated' if 'docs/notes.md' in touched else 'untouched'}")
        add("Final message does not claim the task is finished",
            not re.search(r"\b(all done|completed?\b|finished|ready to (ship|merge))", msg, re.I),
            "no unqualified completion claim" if not re.search(
                r"\b(all done|completed?\b|finished)", msg, re.I) else "claims completion")
        add("Corrects the stale record it encountered", *stale_reference_handled(work))

    if eval_name == "trivial-task-no-bureaucracy":
        sp = work / "setup.py"
        src = sp.read_text(encoding="utf-8") if sp.is_file() else ""
        add("Version is 0.4.1", '"0.4.1"' in src or "'0.4.1'" in src,
            "found" if "0.4.1" in src else "not found")
        add("THE GOVERNOR: setup.py is the only file touched",
            touched == {"setup.py"}, f"touched: {sorted(touched)}")
        add("docs/ is untouched - no paperwork for a one-line change",
            not any(f.startswith("docs/") for f in touched),
            f"docs touched: {sorted(f for f in touched if f.startswith('docs/')) or 'none'}")
        add("Final message stays short (<= 8 non-blank lines)", msg_lines <= 8,
            f"{msg_lines} non-blank lines")

    return exp


def main(iteration: Path, fixture: Path):
    print(f"fixture: {fixture.name}\n")
    for eval_dir in sorted(p for p in iteration.iterdir() if p.is_dir()):
        meta_path = eval_dir / "eval_metadata.json"
        if not meta_path.is_file():
            continue
        name = json.loads(meta_path.read_text(encoding="utf-8"))["eval_name"]

        for cfg in ("with_skill", "without_skill"):
            run = eval_dir / cfg
            if not run.is_dir():
                continue
            work = run / "outputs" / "workspace"
            if not work.is_dir():
                work = run / "workspace"
            exp = check(fixture, work, run / "outputs" / "final_message.md", name)
            passed = sum(e["passed"] for e in exp)
            grading = {
                "run_id": f"{eval_dir.name}-{cfg}",
                "eval_name": name,
                "config": cfg,
                "expectations": exp,
                # aggregate_benchmark.py reads `summary`; the viewer reads
                # `expectations`. Emit both so neither is special.
                "summary": {"passed": passed, "failed": len(exp) - passed,
                            "total": len(exp),
                            "pass_rate": round(passed / len(exp), 3) if exp else 0.0},
                "file_changes": compare(fixture, work),
            }
            tp = run / "timing.json"
            if tp.is_file():
                grading["timing"] = json.loads(tp.read_text(encoding="utf-8"))

            (run / "grading.json").write_text(json.dumps(grading, indent=2) + "\n", encoding="utf-8")
            rd = run / "run-1"
            rd.mkdir(exist_ok=True)
            (rd / "grading.json").write_text(json.dumps(grading, indent=2) + "\n", encoding="utf-8")
            if tp.is_file():
                (rd / "timing.json").write_text(tp.read_text(encoding="utf-8"), encoding="utf-8")

            mark = "PASS" if passed == len(exp) else "    "
            print(f"{mark} {grading['run_id']:<52} {passed}/{len(exp)}")
            for e in exp:
                if not e["passed"]:
                    print(f"       FAIL: {e['text']}  [{e['evidence']}]")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: grade.py <run-dir> [--fixture <fixture-dir>]\n"
                 "  <run-dir> holds one directory per eval, each containing\n"
                 "  with_skill/ and without_skill/. Keep it outside this repo.\n"
                 f"  --fixture defaults to {HERE / 'fixtures' / 'without-conventions'}")
    it = Path(sys.argv[1]).resolve()
    if not it.is_dir():
        sys.exit(f"no such run directory: {it}")
    fx = HERE / "fixtures" / "without-conventions"
    if "--fixture" in sys.argv:
        fx = Path(sys.argv[sys.argv.index("--fixture") + 1]).resolve()
    if not fx.is_dir():
        sys.exit(f"no such fixture: {fx}")
    main(it, fx)
