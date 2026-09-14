# developer-friendliness — parked

Unpublished from the ai-skills marketplace on 2026-09-13 (Gabe: "let's table dev friendliness, i'd like to keep our analysis for it and any other info committed so we can work on it later, but unpublish it from the marketplace").

Why: the skill is mostly judgement heuristics (name the reader, least durable place, write-vs-reconstruct cost) that have to be re-interpreted at every step, which drove over-recording. Its concrete parts are being replaced by recalibration decisions (learnings #7, tickets #8, few-line reports, out-of-scope issues, manual post-mortem #17).

- `skill-source/` — was `claude-code/developer-friendliness/` (the bucket source).
- `plugin/` — was `plugins/developer-friendliness/` (the staged plugin).
- Analysis: `docs/learnings/recalibration-2026-09/` — its 103 instructions are the `D*` rows in `all-rules.json` and `all-rules-consolidation.csv`; STATUS.md holds the decisions.

To republish: move both folders back, restore its route and the `claude-rules` entry in `skills.manifest.json`, its entry in `.claude-plugin/marketplace.json`, and machinery's dependency on it; run `node scripts/build-skills.mjs check`.
