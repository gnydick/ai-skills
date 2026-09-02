---
name: install
description: Use once per machine (`--machine`) to make the universal rules always-on, and once per project to install the commit gate, inbox and index. Idempotent; re-run after a plugin update to refresh the gate.
---
# /machinery:install

Run the installer and show the user its measured summary verbatim.

- Per project (from the project, any working copy): `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs"` — add `--hosted` only if the project has a hosted CI that will protect the branch on the check.
- Per machine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --machine` — creates `~/.claude/rules/machinery` → the rules source (default: this plugin's `rules/`; override in `~/.claude/machinery.json` with `{"rulesSource": "<path>"}`).

This is the only way the commit gate is activated: hooks are tracked in the project and activated per clone, never self-installing.
