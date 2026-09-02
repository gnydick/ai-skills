#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CI ratchet over fs-invariant-scan: no detector count may rise.

fs-invariant-scan (crates/fs-invariant-scan, standalone crate) is a REPORTER -
it prints per-detector finding counts and always exits 0. Its findings are a
large, audited standing baseline (the 2026-08-14 cbbd audit dispositioned all
783 entries; the residue is recorded debt, docs/audits/2026-08-14-cbbd-fixes.md).
A pass/fail gate over the absolute counts would be red on arrival, which
docs/ci.md forbids. So this is a RATCHET:

  - any detector count ABOVE the committed baseline -> exit 1 (new debt);
  - counts at or below baseline -> exit 0, with a note when a count dropped so
    the baseline can be ratcheted down in the same change that earned it.

Baseline: scripts/invariant_scan_baseline.json. Regenerate deliberately with
--write-baseline (a reviewed commit, never automatic).

WHAT IT MEASURES: shipping code only. The scanner skips Cargo's non-shipping
siblings of `src/` -- `tests/`, `benches/`, `examples/`, `build.rs` -- and prints
per-category SKIPPED counts, which this gate echoes. Before that scope fix
(2026-08-24, GIT_CI) the ratchet counted integration tests as production debt:
842 of 1298 "panic in shipping code" findings were `.unwrap()`/`.expect()` calls
under `crates/fs-integration/tests`, against ONE in that crate's 2,176 lines of
`src`. CLAUDE.md mandates a unit test, a fixture generator and integration
coverage per fix, so the gate was penalising compliance with the test mandate.
The baseline was rewritten off the corrected scan in the same commit -- NOT off
the old numbers, which would have forgiven real debt along with the miscounted.
"""
import io
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATE = os.path.join(REPO, "crates", "fs-invariant-scan")
BASELINE = os.path.join(REPO, "scripts", "invariant_scan_baseline.json")
COUNT_RE = re.compile(r"^=== (.+?) — (\d+)")


def run_scan():
    p = subprocess.run(
        ["cargo", "run", "--release", "--quiet", "--", os.path.join(REPO, "crates")],
        cwd=CRATE,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if p.returncode != 0:
        print("FAIL: fs-invariant-scan did not run:")
        print(p.stderr[-2000:])
        return None
    counts = {}
    parsed = None
    skipped = []
    for line in p.stdout.splitlines():
        m = COUNT_RE.match(line)
        if m:
            counts[m.group(1)] = int(m.group(2))
        if "files parsed" in line:
            parsed = line.strip()
        # Echoed so the gate's own log says how much was excluded and why. An
        # exclusion nobody can see is indistinguishable from a walk that missed
        # the files; both print a clean result.
        if line.strip().startswith("SKIPPED "):
            skipped.append(line.rstrip())
    # A detector that returns zero findings is broken until proven otherwise -
    # and so is a scan that parsed nothing (running from the wrong CWD yields
    # exactly this shape).
    if not counts or parsed is None or " 0 files parsed" in (" " + parsed):
        print("FAIL: scan produced no counts / parsed no files (%s)" % parsed)
        return None
    print(parsed)
    for line in skipped:
        print(line)
    return counts


def main(argv):
    counts = run_scan()
    if counts is None:
        return 1
    if "--write-baseline" in argv:
        with io.open(BASELINE, "w", encoding="utf-8", newline="") as f:
            json.dump(counts, f, indent=2, sort_keys=True)
            f.write("\n")
        print("baseline written: %d detectors" % len(counts))
        return 0
    if not os.path.isfile(BASELINE):
        print("FAIL: baseline missing (scripts/invariant_scan_baseline.json); "
              "generate with --write-baseline in a reviewed commit")
        return 1
    with io.open(BASELINE, encoding="utf-8") as f:
        base = json.load(f)
    fail = 0
    for name, n in sorted(counts.items()):
        b = base.get(name)
        if b is None:
            print("FAIL: new detector '%s' (%d) not in baseline - add it "
                  "deliberately with --write-baseline" % (name, n))
            fail = 1
        elif n > b:
            print("FAIL: %s rose %d -> %d (new by-construction debt)" % (name, b, n))
            fail = 1
        elif n < b:
            print("RATCHET: %s dropped %d -> %d - lower the baseline in this "
                  "change" % (name, b, n))
    for name in sorted(set(base) - set(counts)):
        print("RATCHET: detector '%s' vanished - update baseline" % name)
    print("invariant_scan_gate: %d detectors, %s" % (len(counts), "FAIL" if fail else "OK"))
    return fail


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
