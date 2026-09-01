#!/usr/bin/env python
"""WorktreeCreate hook: branch name = worktree name verbatim, no prefix.

Replaces Claude Code's default worktree creation (which names branches
"worktree-<name>"). Verified payload in this build: {session_id,
transcript_path, cwd, prompt_id, hook_event_name, name}. The documented
fields (worktree_name, base_path, git_ref) are honored as fallbacks.
Contract: stdout = full path of the created worktree (nothing else); any
non-zero exit aborts creation with stderr as the error message.
"""
import json
import os
import subprocess
import sys


def fail(msg):
    print(f"WorktreeCreate hook: {msg}", file=sys.stderr)
    sys.exit(1)


def git_quiet(args, cwd):
    return subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True
    )


def git_loud(args, cwd):
    # stdout routed to stderr so the path contract on our stdout stays clean
    return subprocess.run(
        ["git", *args], cwd=cwd, stdout=sys.stderr, stderr=sys.stderr
    ).returncode


def base_ref_from_settings(repo):
    """Honor worktree.baseRef: 'head' -> HEAD, 'fresh' -> origin/<default>."""
    mode = "fresh"  # Claude Code's documented default
    try:
        with open(os.path.join(repo, ".claude", "settings.json")) as f:
            mode = json.load(f).get("worktree", {}).get("baseRef", "fresh")
    except (OSError, json.JSONDecodeError):
        pass
    if mode == "head":
        return "HEAD"
    r = git_quiet(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repo)
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip()
    return "HEAD"  # no origin default known; branch from HEAD rather than fail


payload = json.load(sys.stdin)
name = payload.get("name") or payload.get("worktree_name") or ""
repo = payload.get("cwd") or os.getcwd()
base_path = payload.get("base_path") or os.path.join(repo, ".claude", "worktrees")
git_ref = payload.get("git_ref") or base_ref_from_settings(repo)

# The default creator names the branch "worktree-<name>"; if the harness baked
# that prefix into the name itself, strip it so branch and directory are bare.
branch = name.removeprefix("worktree-")

if not branch:
    fail(f"empty worktree name; payload was: {json.dumps(payload)}")

path = os.path.join(base_path, branch)
os.makedirs(base_path, exist_ok=True)

branch_exists = (
    git_quiet(["rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"], repo)
    .returncode == 0
)

if branch_exists:
    rc = git_loud(["worktree", "add", path, branch], cwd=repo)
else:
    rc = git_loud(["worktree", "add", path, "-b", branch, git_ref], cwd=repo)

if rc != 0:
    fail(f"git worktree add failed (exit {rc})")

print(path)
