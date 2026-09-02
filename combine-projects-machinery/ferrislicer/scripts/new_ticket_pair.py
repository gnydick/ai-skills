#!/usr/bin/env python3
"""Create a ticket PAIR: a full parent spec plus its one `Context:` sub-issue.

CLAUDE.md makes this a two-part object, not two tickets that happen to be related:
every ticket has exactly ONE `Context:` sub-issue holding the compressed pickup
context, and the sub-issue relation is reserved for that pair alone. Doing it by
hand is three `gh` calls in a fixed order with a numeric id nobody can see in the
UI -- so it gets done differently each time, and a pair ends up half-made.

This is the one pipeline. It creates the parent, creates the child titled
`Context: #<parent>`, links them with the real sub-issues API (not a mention), and
applies the same labels to both.

    python scripts/new_ticket_pair.py \
        --title "..." --body parent.md --context context.md \
        --label debt --label invariant-audit-registration

Prints `<parent> <child>` on success.
"""

import argparse
import json
import subprocess
import sys

REPO = "gnydick/ferrislicer"


def gh(*args, **kw):
    r = subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8", **kw)
    if r.returncode != 0:
        print(f"gh {' '.join(args[:3])}... failed:\n{r.stderr}", file=sys.stderr)
        raise SystemExit(1)
    return r.stdout.strip()


def create_issue(title, body_file, labels):
    args = ["issue", "create", "--repo", REPO, "--title", title, "--body-file", body_file]
    for lb in labels:
        args += ["--label", lb]
    url = gh(*args)
    # `gh issue create` prints the URL; the number is its last path segment.
    return int(url.rstrip("/").rsplit("/", 1)[-1])


def rest_id(number):
    """The REST database id -- what the sub-issues API wants, NOT the issue number."""
    return json.loads(gh("api", f"repos/{REPO}/issues/{number}"))["id"]


def link(parent, child):
    """Attach an existing child as the parent's sub-issue. Repairs a half-made pair."""
    gh("api", "--method", "POST",
       f"repos/{REPO}/issues/{parent}/sub_issues",
       "-F", f"sub_issue_id={rest_id(child)}")
    print(f"{parent} {child}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--title")
    p.add_argument("--body", help="parent body file")
    p.add_argument("--context", help="context child body file")
    p.add_argument("--label", action="append", default=[])
    p.add_argument("--link", nargs=2, metavar=("PARENT", "CHILD"), type=int,
                   help="link two existing issues instead of creating a pair")
    a = p.parse_args()

    if a.link:
        link(*a.link)
        return 0

    if not (a.title and a.body and a.context):
        p.error("--title, --body and --context are required unless --link is given")

    parent = create_issue(a.title, a.body, a.label)
    child = create_issue(f"Context: #{parent}", a.context, a.label)

    # -F, not -f: the sub-issues API rejects a stringified id (HTTP 422).
    gh("api", "--method", "POST",
       f"repos/{REPO}/issues/{parent}/sub_issues",
       "-F", f"sub_issue_id={rest_id(child)}")

    print(f"{parent} {child}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
