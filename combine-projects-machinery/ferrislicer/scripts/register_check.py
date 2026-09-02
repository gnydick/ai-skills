#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Machine checks for the design-decision register (docs/RULES-GROUPED.md).

NAMING NOTE (GIT_624/GIT_625 post-mortem): `check_citations` and
`check_blank_line_citations` are named as if they validate a citation. They
do not -- and never have. Both are STRUCTURAL checks only:
  - `check_citations` (#1 below): the cited FILE exists. It does not read the
    cited line at all.
  - `check_blank_line_citations` (#6 below): the cited LINE is not blank. It
    does not check that the line still says what the surrounding text claims.
Neither checks CORRECTNESS -- whether the cited line supports the claim being
made next to it. A citation whose target line shifted to different real,
non-blank content passes both checks silently, every time this file is run,
by design: Gabe's ruling (#624/#625, 2026-08-27) rejected re-validating
correctness on every run as noise that gets disabled ("I only want to test
for it when it is first created"). That one-time, creation-only correctness
check lives in scripts/citation_creation_gate.py instead, over lines a diff
newly ADDS; this file's repeated, whole-register checks stay structural only.

Blocking checks (exit 1 on any failure):
  1. Every rule-row citation (`path:line` in a table's Source column) names a file
     that exists. Line drift is tolerated; existence is the gate. Does NOT read
     the cited line -- see NAMING NOTE above.
  2. Every intent-group header carries exactly one status circle; Solo headers none.
  3. Stamp bidirectionality:
       - every `> SUPERSEDED` stamp under docs/ names a register group that exists;
       - every register `Supersedes:` line with a backticked path names an existing
         file that carries a `> SUPERSEDED` stamp pointing back at the register.
  4. Every `Enforcement: docs/INVARIANTS.md §N.M` reference resolves to a real
     `## N.M` heading in docs/INVARIANTS.md.
  5. docs/rule-inbox.md (if present) has no `Disposition: PENDING` entry.
  6. Every `path:NNN` citation's target line is not BLANK. Existence-of-content
     only -- does not compare the line's text against the claim; see NAMING NOTE.
  7. CLAUDE.md is never cited by bare line number (must cite by `§ <Section>`
     instead -- a line number is a POSITION, not a rule identity).
  8. Every `<path>` § <heading> citation resolves to a real heading in that file.

Advisory output (never affects exit code):
  - yellow/red groups without a GitHub issue reference (deferred until the
    adjudication workstream files them);
  - with --drift FILE..., rule-marker lines in those files not cited by any
    register row.

Modes: --fast skips only check 4 (INVARIANTS.md anchor resolution) and check 2's
error reporting (group headers are still parsed, silently, because check 3 needs
the group name list) -- checks 1, 3, 5, 6, 7, 8 all run under --fast too; they are
cheap string/file-existence work, which is why the pre-commit hook can afford them
on every commit. Default (no --fast) additionally runs check 4.
"""
import io
import os
import re
import sys

REPO = os.environ.get(
    "REGISTER_CHECK_ROOT",
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)
REGISTER = os.path.join(REPO, "docs", "RULES-GROUPED.md")
INVARIANTS = os.path.join(REPO, "docs", "INVARIANTS.md")
INBOX = os.path.join(REPO, "docs", "rule-inbox.md")
CIRCLES = ("\U0001F7E2", "\U0001F7E1", "\U0001F534")  # green, yellow, red
NONGREEN = ("\U0001F7E1", "\U0001F534")

CITE_RE = re.compile(r"\(`([^`]+?):(\d+)`\)|\| `([^`]+?):(\d+)` \|")
SECTION_RE = re.compile(r"§(\d+\.\d+)")
SUPERSEDES_PATH_RE = re.compile(r"^Supersedes: .*?`([^`]+)`")
STAMP_RE = re.compile(r"^> SUPERSEDED")
MARKER_RE = re.compile(r"HARD RULE|by construction|\bnever\b|\bmust\b", re.I)
# `<path>` § <heading> — the drift-proof citation form. A line number moves every
# time the cited file gains a line above it; a heading does not.
SECTION_CITE_RE = re.compile(r"`([^`\n]+?\.md)`\s*§\s*([^|\n]+)")
CLAUDE_LINE_CITE_RE = re.compile(r"`CLAUDE\.md:(\d+)`")
HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.M)
FENCE_RE = re.compile(r"^\s*(```|~~~)")
# a bare address into a doc that has its own gate: "7.2", "4.1.9a5", "8 Anchor on..."
NUMERIC_ANCHOR_RE = re.compile(r"^\d+(\.\d+)*[a-z]?\b")


def headings(text):
    """Heading texts, ignoring anything inside a fenced code block.

    `#define unscale_(val) ...` inside a C snippet is not a section, but it
    matches a markdown heading exactly. Found in docs/adr/0001 while repairing
    the blank-line citations: a citation could have "resolved" to it.
    """
    out, fenced = [], False
    for line in text.splitlines():
        if FENCE_RE.match(line):
            fenced = not fenced
            continue
        if fenced:
            continue
        m = HEADING_RE.match(line)
        if m:
            out.append(m.group(1).strip())
    return out


def read(path):
    with io.open(path, "r", encoding="utf-8") as f:
        return f.read()


def check_citations(reg_text, errors):
    seen = set()
    for m in CITE_RE.finditer(reg_text):
        path = m.group(1) or m.group(3)
        if path in seen:
            continue
        seen.add(path)
        if not os.path.isfile(os.path.join(REPO, path)):
            errors.append("citation names missing file: %s" % path)
    return len(seen)


def check_circles(reg_lines, errors):
    in_solo = False
    groups, nongreen = [], []
    for i, line in enumerate(reg_lines, 1):
        if line.startswith("# Solo rules, by area"):
            in_solo = True
            continue
        if not line.startswith("## "):
            continue
        title = line[3:].strip()
        if title in ("Contents", "Maintaining this file (the contract)"):
            continue
        n = sum(title.count(c) for c in CIRCLES)
        if in_solo:
            if n:
                errors.append("line %d: Solo header carries a circle: %s" % (i, title))
        else:
            if n != 1:
                errors.append(
                    "line %d: group header needs exactly one circle, has %d: %s"
                    % (i, n, title)
                )
            else:
                name = title
                for c in CIRCLES:
                    name = name.replace(c, "")
                groups.append(name.strip())
                if any(c in title for c in NONGREEN):
                    nongreen.append((name.strip(), title))
    return groups, nongreen


def check_stamps(reg_text, groups, errors):
    # every stamp in docs/ points at a real register group
    stamped_files = {}
    for root, dirs, files in os.walk(os.path.join(REPO, "docs")):
        for fn in files:
            if not fn.endswith(".md"):
                continue
            fp = os.path.join(root, fn)
            rel = os.path.relpath(fp, REPO).replace(os.sep, "/")
            if rel == "docs/RULES-GROUPED.md":
                continue
            for line in read(fp).splitlines():
                if STAMP_RE.match(line):
                    stamped_files.setdefault(rel, []).append(line)
    # stamps may wrap onto continuation lines; join per-file stamp blocks
    for rel, lines in stamped_files.items():
        text = read(os.path.join(REPO, rel))
        block = []
        for line in text.splitlines():
            if line.startswith("> "):
                block.append(line[2:])
            elif block:
                break
        joined = " ".join(block)
        if "docs/RULES-GROUPED.md" not in joined:
            errors.append("%s: SUPERSEDED stamp does not cite the register" % rel)
            continue
        m = re.search(r"docs/RULES-GROUPED\.md § (.+?)\s*$", joined)
        if not m:
            errors.append("%s: stamp cites register without a '§ <group>'" % rel)
        elif m.group(1).strip() not in groups:
            errors.append(
                "%s: stamp names unknown register group: %s" % (rel, m.group(1).strip())
            )
    # every backticked Supersedes path exists and carries a stamp
    for line in reg_text.splitlines():
        m = SUPERSEDES_PATH_RE.match(line)
        if not m:
            continue
        path = m.group(1)
        full = os.path.join(REPO, path)
        if not os.path.isfile(full):
            errors.append("Supersedes names missing file: %s" % path)
        elif path not in stamped_files:
            errors.append("Supersedes target lacks a SUPERSEDED stamp: %s" % path)


def check_invariant_anchors(reg_text, errors):
    if not os.path.isfile(INVARIANTS):
        errors.append("docs/INVARIANTS.md missing")
        return
    inv = read(INVARIANTS)
    headings = set(re.findall(r"^## (\d+\.\d+)\s", inv, re.M))
    for line in reg_text.splitlines():
        if not line.startswith("Enforcement:"):
            continue
        for sec in SECTION_RE.findall(line):
            if sec not in headings:
                errors.append(
                    "Enforcement cites INVARIANTS.md §%s which has no '## %s' heading"
                    % (sec, sec)
                )


def table_rows(reg_text):
    """Only the rule TABLES, never the prose around them.

    A citation lives in a row's Source column. The maintenance-contract header
    DOCUMENTS the citation format, so scanning prose makes the contract fail the
    rule it states — which is exactly how this function came to exist. Same
    shape as check_inbox requiring column 0 so the inbox header's own example
    does not read as a live entry.
    """
    return "\n".join(l for l in reg_text.splitlines() if l.lstrip().startswith("|"))


def check_claude_citations(reg_text, errors):
    """CLAUDE.md is cited by SECTION, never by line number.

    Measured 2026-08-26 across 22 bare `CLAUDE.md:NNN` rows: 4 pointed at a
    blank line and 2 named the wrong rule outright, yet all 22 passed check #1,
    which tests only that the FILE exists. A line number does not cite a rule,
    it cites a POSITION, and every insert above it silently retargets the row.

    Scoped to CLAUDE.md deliberately: it is the register's most-edited
    rule-bearing doc, and all of its rows were converted in the same commit that
    added this check, so there is nothing to grandfather. Other files keep line
    citations and get the blank-line ADVISORY below instead.
    """
    for m in CLAUDE_LINE_CITE_RE.finditer(table_rows(reg_text)):
        errors.append(
            "bare line citation `CLAUDE.md:%s` — cite the section instead: "
            "`CLAUDE.md` § <Section heading>" % m.group(1)
        )


def check_section_citations(reg_text, errors):
    """Every `<path>` § <heading> citation resolves to a real heading.

    Prefix match, not equality: a row legitimately names "Agent cost economy"
    where the heading reads "## Agent cost economy (HARD RULE)", and rows
    routinely append a ticket or prose after the heading. Numeric anchors
    (§7.2 into INVARIANTS.md, §4.1.9 into the contract map) belong to
    check_invariant_anchors and the map's own gate, so they are skipped here
    rather than half-checked.
    """
    cache = {}
    for m in SECTION_CITE_RE.finditer(table_rows(reg_text)):
        path, cited = m.group(1), m.group(2).strip()
        if not cited:
            continue
        if path not in cache:
            full = os.path.join(REPO, path)
            cache[path] = headings(read(full)) if os.path.isfile(full) else None
        heads = cache[path]
        if heads is None:
            # NOT check_citations' job any more: a file cited ONLY in section
            # form (CLAUDE.md, since this commit) never matches CITE_RE, so
            # skipping here would let its deletion pass both checks unseen.
            errors.append("section citation names missing file: %s" % path)
            continue
        if any(h.startswith(cited) or cited.startswith(h) for h in heads):
            continue
        # Resolve FIRST, skip second. A numbered heading ("2.9 Windows, both
        # sides") and a pure numeric anchor ("7.2", "4.1.9a5") both start with a
        # digit; skipping on that alone silently unchecked every numbered
        # section in the repo. Only an anchor that resolves to nothing AND looks
        # like a bare address belongs to another gate.
        if NUMERIC_ANCHOR_RE.match(cited):
            # STATED LIMITATION, not a claim of coverage: a numbered HEADING
            # ("2.9 Windows, both sides") and a bare ANCHOR ("7.2") are the same
            # shape, so a numbered citation is verified when it RESOLVES and
            # skipped when it does not. Mistype a numbered heading and nothing
            # here catches it. Fixing that needs a per-doc convention (anchors
            # only in INVARIANTS.md and the contract map), which is a bigger
            # change than this one and is not pretended to exist.
            continue
        errors.append("%s § %s names no heading in that file" % (path, cited[:60]))


def check_blank_line_citations(reg_text, errors):
    """A `path:NNN` citation landing on a BLANK line points at nothing.

    BLOCKING since 2026-08-26. It shipped ADVISORY in the same session, at 13
    occurrences, because a gate that is red on arrival teaches people to disable
    it (docs/ci.md). Those 13 were then repaired to section form, the count
    reached zero, and the check was promoted in the commit that emptied it —
    which is the only honest moment to promote one. A blank line is not a weak
    citation, it is the absence of one, so there is nothing to grandfather now.

    SCOPE (see module docstring's NAMING NOTE): this checks the line is not
    blank, nothing more. A citation whose target line drifted to different
    real, non-blank content -- still passes. Content correctness is a
    creation-time check (scripts/citation_creation_gate.py), by design.
    """
    notes, seen = [], set()
    for m in CITE_RE.finditer(reg_text):
        path = m.group(1) or m.group(3)
        n = int(m.group(2) or m.group(4))
        if (path, n) in seen or not path.endswith(".md"):
            continue
        seen.add((path, n))
        full = os.path.join(REPO, path)
        if not os.path.isfile(full):
            continue
        body = read(full).splitlines()
        if n <= len(body) and not body[n - 1].strip():
            notes.append(
                "%s:%d cites a BLANK line — point it at the rule, or better, "
                "cite `%s` § <Section>" % (path, n, path)
            )
    errors.extend(notes)


def check_inbox(errors):
    if not os.path.isfile(INBOX):
        return
    for i, line in enumerate(read(INBOX).splitlines(), 1):
        # column-0 only: the inbox header documents the format inside an
        # indented example block, which must not read as a live entry
        if line.rstrip() == "Disposition: PENDING":
            errors.append(
                "docs/rule-inbox.md:%d: undispositioned entry (file it in the "
                "register via /rule-intake, or mark 'not a rule - <reason>')" % i
            )


def advisory_nongreen(reg_text, nongreen):
    notes = []
    for name, title in nongreen:
        idx = reg_text.find(title)
        tail = reg_text[idx : idx + 2000]
        if not re.search(r"#\d{2,4}", tail):
            notes.append("non-green group without an issue reference: %s" % name)
    return notes


def advisory_drift(reg_text, files):
    cited_lines = set()
    for m in CITE_RE.finditer(reg_text):
        cited_lines.add(m.group(1) or m.group(3))
    notes = []
    for path in files:
        rel = os.path.relpath(os.path.abspath(path), REPO).replace(os.sep, "/")
        if not os.path.isfile(path) or not path.endswith(".md"):
            continue
        for i, line in enumerate(read(path).splitlines(), 1):
            if MARKER_RE.search(line) and rel not in cited_lines:
                notes.append("%s:%d: rule-marker line in uncited file" % (rel, i))
                break  # one note per file is enough
    return notes


def main(argv):
    fast = "--fast" in argv
    drift_files = []
    if "--drift" in argv:
        drift_files = argv[argv.index("--drift") + 1 :]
    if not os.path.isfile(REGISTER):
        print("FAIL: register missing: docs/RULES-GROUPED.md")
        return 1
    reg_text = read(REGISTER)
    reg_lines = reg_text.splitlines()
    errors = []
    n = check_citations(reg_text, errors)
    check_claude_citations(reg_text, errors)
    check_section_citations(reg_text, errors)
    check_blank_line_citations(reg_text, errors)
    groups, nongreen = check_circles(reg_lines, errors if not fast else [])
    check_stamps(reg_text, groups, errors)
    if not fast:
        check_invariant_anchors(reg_text, errors)
    check_inbox(errors)
    for e in errors:
        print("FAIL:", e)
    print(
        "register_check: %d citation files, %d groups, %d errors%s"
        % (n, len(groups), len(errors), " (fast)" if fast else "")
    )
    if not fast:
        for note in advisory_nongreen(reg_text, nongreen):
            print("ADVISORY:", note)
    for note in advisory_drift(reg_text, drift_files):
        print("ADVISORY:", note)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
