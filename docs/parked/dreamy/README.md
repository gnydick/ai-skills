# dreamy — parked

Unpublished from the ai-skills marketplace on 2026-09-13 (Gabe: "uninstall it and table dreamy too"). It had already been uninstalled locally earlier that day ("ignore dreamy also, i never use it"), and its `~/.claude/skills` links and eval workspaces were deleted.

- `skill-source/` — was `claude-code/dreamy/` (the bucket source: dream, improve-memory, send-results, session-analysis).
- `plugin/` — was `plugins/dreamy/` (the staged plugin).

To republish: move both folders back, restore its route in `skills.manifest.json` and its entry in `.claude-plugin/marketplace.json`, restore its README.md section; run `node scripts/build-skills.mjs check`.
