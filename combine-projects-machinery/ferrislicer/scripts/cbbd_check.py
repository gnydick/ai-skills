"""Structural check for the cbbd audit table: every finding row must carry
exactly 11 unescaped pipes (10 columns), and every id must be unique and
present in the denominator."""
import csv
import io
import re
import sys

doc = io.open("docs/audits/2026-08-14-cbbd.md", encoding="utf-8").read().split("\n")
den = {r["id"] for r in csv.DictReader(
    io.open("docs/audits/2026-08-14-cbbd-denominator.tsv", encoding="utf-8"), delimiter="\t")}

bad = []
ids = []
for line in doc:
    if not re.match(r"^\| [0-9]+ \|", line):
        continue
    ids.append(line.split("|")[1].strip())
    n = line.replace("\\|", "").count("|")
    if n != 11:
        bad.append((ids[-1], n))

dupes = {i for i in ids if ids.count(i) > 1}
orphans = [i for i in ids if i not in den]

print(f"rows: {len(ids)}  denominator: {len(den)}  remaining: {len(den) - len(ids)}")
print(f"bad pipe counts: {bad if bad else 'none'}")
print(f"duplicate ids:   {sorted(dupes) if dupes else 'none'}")
print(f"ids not in denominator: {orphans if orphans else 'none'}")
sys.exit(1 if (bad or dupes or orphans) else 0)
