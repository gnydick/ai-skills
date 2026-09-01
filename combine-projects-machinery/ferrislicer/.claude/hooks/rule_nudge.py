#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PostToolUse hook (Edit|Write): nudge when a rule-bearing doc changes.

Non-blocking, in-conversation layer of the governance chain. If the edited file
is a rule-bearing path and the register (docs/RULES-GROUPED.md) has no pending
working-tree change, remind the session of the same-commit register rule.
Never blocks; the pre-commit hook and register_check.py are the enforcement.
"""
import json
import os
import subprocess
import sys

RULE_BEARING = (
    "CLAUDE.md",
    "docs/INVARIANTS.md",
    "docs/superpowers/specs/",
    "docs/refactors/",
)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    path = (payload.get("tool_input") or {}).get("file_path") or ""
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    rel = os.path.relpath(os.path.abspath(path), root).replace(os.sep, "/")
    if not any(
        rel == p or (p.endswith("/") and rel.startswith(p)) for p in RULE_BEARING
    ):
        return 0
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain", "--", "docs/RULES-GROUPED.md"],
            capture_output=True,
            text=True,
            cwd=root,
            timeout=15,
        ).stdout.strip()
    except Exception:
        return 0
    if not out:
        print(
            "Rule-bearing doc changed (%s) and the design-decision register "
            "docs/RULES-GROUPED.md is untouched. If this change adds, changes, or "
            "supersedes a rule, update the register in the same commit "
            "(/rule-intake walks the steps)." % rel
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
