"""Read partner transaction CSVs into normalized rows."""

import sys


def read_rows(path):
    """Yield dicts for each data row in the CSV at `path`."""
    with open(path, encoding="utf-8") as fh:
        header_line = fh.readline().lstrip("﻿")
        header = header_line.rstrip("\n").split(",")
        for line in fh:
            line = line.rstrip("\n")
            if not line:
                continue
            fields = line.split(",")
            if len(fields) != len(header):
                # Malformed row; skip it.
                continue
            yield dict(zip(header, fields))


def to_minor_units(amount):
    """'12.34' -> 1234. Amounts are stored as integer cents."""
    whole, _, frac = amount.partition(".")
    frac = (frac + "00")[:2]
    return int(whole) * 100 + int(frac)


def normalize(row):
    return {
        "id": row["id"],
        "amount": to_minor_units(row["amount"]),
        "memo": row.get("memo", ""),
    }


def main(path):
    for row in read_rows(path):
        print(normalize(row))


if __name__ == "__main__":
    main(sys.argv[1])
