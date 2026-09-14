---
name: install
description: Load once per machine (`--machine`), once per project, after a plugin update, when the session banner names something missing, and when the owner asks to move the git-hook checks to hosted CI.
---
# /machinery:install

1. Per machine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --machine`. Per project, from any worktree: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs"`. Both are safe to re-run.
2. Show the user the installer's summary verbatim.
3. The installer prints the transcript retention (`cleanupPeriodDays`, default 30 days). Tell the user that transcripts older than that are deleted, so `/postmortem` has no evidence for older work, and ask what period they want. Change it only to their answer.
4. Hosted CI, only when the owner asks: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --hosted-ci` runs the wizard that turns the pre-commit and pre-push hook commands into GitHub Actions workflows.
