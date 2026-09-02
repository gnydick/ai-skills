#!/usr/bin/env python3
"""Can't-break-by-design audit: the DENOMINATOR generator (GIT_339).

Emits every entry the audit must dispose of, so the denominator is
reproducible rather than asserted. Two parts:

  A  STATED claims   - a doc comment on a pub field/fn/type whose text claims
                       an invariant (never/must/only/always/by construction/
                       sole/guaranteed/cannot/stamped). The audit asks: is
                       there a MECHANISM, or only the sentence?
  B  OBLIGATION      - code SHAPES that carry an invariant obligation whether
     shapes            or not anyone stated one. The audit asks: is it stated,
                       and is it enforced?

      S1 coupled fields     a field's doc names a sibling field
      S2 derived data       a value stored twice (count beside a collection,
                            `x` beside `x_<suffix>`)
      S3 variant payload    struct holds an enum field plus fields that are
                            meaningful for only some variants
      S4 sentinel           == -1 / != -1 / .max(0) on a domain value
      S5 unproven non-empty first()/last()/[0] with unwrap/expect
      S6 bare primitive     a quantity field typed f64/i64 where a newtype exists
      S7 swappable args     pub fn with >=2 adjacent same-typed primitives
      S8 lifecycle order    pub fn begin_/init_/set_/finalize_/end_ on &mut self
      S9 discarded result   let _ = / .ok(); / unwrap_or_default() on a call

Inline unit tests (`#[cfg(test)]` onward) are excluded: they are not the
shipped surface. Dead/test-only code found outside those blocks still gets an
entry and must be dispositioned, never silently dropped.

Usage:  python scripts/cbbd_denominator.py [--out docs/audits/<date>-cbbd-denominator.tsv]
Output: TSV (id, part, shape, file, line, evidence) + counts on stderr.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

CLAIM = re.compile(
    r"\b(never|must|only|always|by construction|sole|invariant|guaranteed"
    r"|cannot|unrepresentable|stamped)\b",
    re.I,
)
QUANTITY = re.compile(
    r"(width|height|dist|distance|radius|length|len|angle|thickness|offset"
    r"|spacing|gap|area|volume|speed|feed|_mm|_scaled)$",
    re.I,
)
BARE_NUM = {"f64", "i64", "u64", "i32", "u32", "usize", "coord_t", "coordf_t"}
PRIMITIVE = BARE_NUM | {"bool", "f32"}
LIFECYCLE = re.compile(
    r"^\s*pub fn (begin_|init_|set_|finalize_|end_|reset_)\w*\s*\(\s*&mut self",
    re.M,
)


def source_files(root: pathlib.Path):
    for p in sorted(root.glob("crates/*/src/**/*.rs")):
        yield p


def shipped_text(p: pathlib.Path) -> str:
    """File text with inline unit-test modules removed."""
    src = p.read_text(encoding="utf-8", errors="replace")
    cut = src.find("#[cfg(test)]")
    return src[:cut] if cut > 0 else src


def line_of(src: str, idx: int) -> int:
    return src.count("\n", 0, idx) + 1


def struct_blocks(src: str):
    for m in re.finditer(r"pub struct (\w+)\s*\{(.*?)\n\}", src, re.S):
        yield m.group(1), m.group(2), m.start(2)


def fields_of(body: str):
    """(is_pub, name, type, doc_text, offset_in_body) per field."""
    doc: list[str] = []
    for m in re.finditer(r"^(.*)$", body, re.M):
        line = m.group(1)
        s = line.strip()
        if s.startswith("///"):
            doc.append(s[3:])
            continue
        fm = re.match(r"(pub )?(\w+)\s*:\s*([^,]+),?", s)
        if fm:
            yield bool(fm.group(1)), fm.group(2), fm.group(3).strip(), " ".join(doc), m.start(1)
            doc = []
            continue
        if s and not s.startswith("#["):
            doc = []


def collect(root: pathlib.Path):
    rows = []
    enum_names = set()
    for p in source_files(root):
        for m in re.finditer(r"pub enum (\w+)", shipped_text(p)):
            enum_names.add(m.group(1))

    def add(part, shape, p, line, evidence):
        # Collapse ALL whitespace: a multi-line match (S8's `\s*` can span a
        # newline on a wrapped signature) would otherwise embed a newline in the
        # evidence field and split one TSV row into two, so the file's line
        # count would disagree with the entry count. Sanitise at the writer.
        ev = " ".join(evidence.split())
        rows.append((part, shape, str(p).replace("\\", "/"), line, ev[:160]))

    for p in source_files(root):
        src = shipped_text(p)

        # ---- A: stated claims + per-struct shapes -------------------------
        for sname, body, base in struct_blocks(src):
            fnames = {n for _, n, _, _, _ in fields_of(body)}
            for is_pub, fname, ftype, doc, off in fields_of(body):
                ln = line_of(src, base + off)
                claim = CLAIM.search(doc)
                if is_pub and claim:
                    add("A", "-", p, ln, f"{sname}.{fname}: claims '{claim.group(0).lower()}'")
                # S1 coupled fields
                # sorted(): `fnames` is a set and Python randomises string
                # hashing per process, so an unsorted scan made this evidence
                # differ run to run — once even naming DIFFERENT siblings after
                # the [:2] slice. That breaks regenerate-and-diff, which is the
                # verification this artifact rests on.
                others = [
                    o
                    for o in sorted(fnames)
                    if o != fname and len(o) > 3 and re.search(rf"`?\b{o}\b`?", doc)
                ]
                if others:
                    add("B", "S1", p, ln, f"{sname}.{fname} doc names sibling {others[:2]}")
                # S6 bare primitive for a quantity
                if QUANTITY.search(fname) and ftype in BARE_NUM:
                    add("B", "S6", p, ln, f"{sname}.{fname}: {ftype} for a quantity")
            # S2 derived data: a count/len beside a collection, or x + x_suffix
            names = sorted(fnames)
            has_vec = any(
                t.startswith("Vec<") for _, _, t, _, _ in fields_of(body)
            )
            for n in names:
                if has_vec and re.search(r"(_count|_len|^n_|^num_)", n):
                    add("B", "S2", p, line_of(src, base), f"{sname}.{n} beside a collection")
                for o in names:
                    if o != n and o.startswith(n + "_"):
                        add("B", "S2", p, line_of(src, base), f"{sname}: {n} and {o}")
            # S3 variant payload: enum field + other fields
            enum_fields = [n for _, n, t, _, _ in fields_of(body) if t.split("<")[0] in enum_names]
            if enum_fields and len(fnames) > len(enum_fields):
                add(
                    "B",
                    "S3",
                    p,
                    line_of(src, base),
                    f"{sname}: enum field(s) {enum_fields[:2]} + {len(fnames) - len(enum_fields)} other field(s)",
                )

        # ---- B: statement-level shapes -----------------------------------
        for m in re.finditer(r"[^\n]*(==|!=)\s*-1\b[^\n]*", src):
            add("B", "S4", p, line_of(src, m.start()), m.group(0).strip())
        for m in re.finditer(r"[^\n]*\.max\(0\)[^\n]*", src):
            add("B", "S4", p, line_of(src, m.start()), m.group(0).strip())
        for m in re.finditer(r"[^\n]*\.(first|last)\(\)\s*\.\s*(unwrap|expect)\([^\n]*", src):
            add("B", "S5", p, line_of(src, m.start()), m.group(0).strip())
        for m in re.finditer(r"^\s*pub fn (\w+)\s*\(([^)]*)\)", src, re.M):
            params = [q.strip() for q in m.group(2).split(",") if ":" in q]
            types = [q.split(":", 1)[1].strip().lstrip("&").strip() for q in params]
            for a, b in zip(types, types[1:]):
                if a == b and a in PRIMITIVE:
                    add("B", "S7", p, line_of(src, m.start()), f"fn {m.group(1)}: adjacent {a}, {b}")
                    break
        for m in re.finditer(LIFECYCLE, src):
            add("B", "S8", p, line_of(src, m.start()), m.group(0).strip())
        for m in re.finditer(r"[^\n]*(let _ = |\.ok\(\);|unwrap_or_default\(\))[^\n]*", src):
            add("B", "S9", p, line_of(src, m.start()), m.group(0).strip())

    rows.sort(key=lambda r: (r[0], r[1], r[2], r[3]))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/audits/cbbd-denominator.tsv")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    root = pathlib.Path(args.root)
    rows = collect(root)

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="\n") as f:
        f.write("id\tpart\tshape\tfile\tline\tevidence\n")
        for i, (part, shape, file, line, ev) in enumerate(rows, 1):
            f.write(f"{i}\t{part}\t{shape}\t{file}\t{line}\t{ev}\n")

    from collections import Counter

    per_shape = Counter(f"{r[0]}{'' if r[1] == '-' else '/' + r[1]}" for r in rows)
    print(f"denominator written: {out}  ({len(rows)} entries)", file=sys.stderr)
    for k, v in sorted(per_shape.items()):
        print(f"  {k:8s} {v}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
