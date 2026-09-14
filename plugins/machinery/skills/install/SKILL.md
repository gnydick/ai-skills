---
name: install
description: Load once per project, after a plugin update, when the session banner names something missing, and when the owner asks to move the git-hook checks to hosted CI. Mechanical installation only; the negotiated settings are /machinery:setup.
---
# /machinery:install

1. Per project, from any worktree: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs"`. Safe to re-run.
2. Show the user the installer's summary verbatim.
3. If `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" show` lists any item as not recorded, run /machinery:setup.
4. Hosted CI, only when the owner asks: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --hosted-ci` runs the wizard that turns the pre-commit and pre-push hook commands into GitHub Actions workflows.
