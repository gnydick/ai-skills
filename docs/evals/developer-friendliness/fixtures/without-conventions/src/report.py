"""Summarize an imported batch for the daily ops mail."""

from src.importer import read_rows, normalize


def totals_by_memo(path):
    """Sum amounts grouped by memo text."""
    out = {}
    for row in read_rows(path):
        try:
            norm = normalize(row)
        except Exception:
            # Bad row, keep going.
            continue
        out.setdefault(norm["memo"], 0)
        out[norm["memo"]] += norm["amount"]
    return out


def daily_total(path):
    totals = totals_by_memo(path)
    if not totals:
        return 0
    return sum(totals.values())
