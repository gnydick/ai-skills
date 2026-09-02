#!/usr/bin/env python3
"""Validate docs/INVARIANTS.md's tables: cell counts, and no unresolved ticket cells.

A markdown table whose row has the wrong number of cells still renders -- it just
renders WRONG, silently dropping or merging a column. In a file whose entire purpose
is that a reader can resolve a claim to its mechanism, a silently-eaten `Mech` cell
is the same failure the ledger exists to record, so it gets a gate rather than a
proofread.

Also fails on a `TICKET-PENDING` placeholder: a row that names no ticket must say so
with an em dash, not with an IOU.

    python scripts/check_ledger_tables.py
"""

import re
import sys
from pathlib import Path

LEDGER = Path(__file__).resolve().parent.parent / "docs" / "INVARIANTS.md"


def cells(row):
    s = row.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    # A pipe escaped as \| is content, not a delimiter.
    return re.split(r"(?<!\\)\|", s)


def is_sep(line):
    s = line.strip()
    if not s.startswith("|"):
        return False
    body = s.strip("|")
    return bool(body) and "-" in body and all(c in "-:| " for c in body)


def main():
    lines = LEDGER.read_bytes().decode("utf-8").split("\n")
    problems = []
    i = 0
    tables = rows = 0

    while i < len(lines):
        if lines[i].strip().startswith("|") and i + 1 < len(lines) and is_sep(lines[i + 1]):
            width = len(cells(lines[i]))
            tables += 1
            j = i + 2
            while j < len(lines) and lines[j].strip().startswith("|") and not is_sep(lines[j]):
                got = len(cells(lines[j]))
                rows += 1
                if got != width:
                    problems.append(
                        f"INVARIANTS.md:{j + 1}: {got} cells, header has {width} "
                        f"-- {lines[j].strip()[:70]}"
                    )
                j += 1
            i = j
            continue
        i += 1

    for n, line in enumerate(lines, 1):
        if "TICKET-PENDING" in line:
            problems.append(f"INVARIANTS.md:{n}: unresolved TICKET-PENDING placeholder")

    if problems:
        for p in problems:
            print(p, file=sys.stderr)
        print(f"check_ledger_tables: {len(problems)} problem(s)", file=sys.stderr)
        return 1

    print(
        f"check_ledger_tables: ok -- {tables} tables, {rows} rows, "
        "all cell counts match their header"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
