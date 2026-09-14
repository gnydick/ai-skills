# For unbreakable — parked

Moved out of machinery on 2026-09-14 by recalibration decisions 19 and 24 (`docs/learnings/recalibration-2026-09/STATUS.md`). They apply unbreakable's knowledge and move to unbreakable when it is worked: skills to `claude-code/unbreakable/`, agents to `plugins/unbreakable/agents/`.

- `skill-source/invariant-audit/` — was `claude-code/machinery/invariant-audit/`.
- `agents/invariant-auditor.md` — was `plugins/machinery/agents/`.
- `scripts/audit-diff.mjs`, `test/audit-diff.test.mjs` — were in `plugins/machinery/`; their `./lib/` and `./helpers/` imports still point at machinery and must be re-pointed on the move.
- The design-skill draft stays at `docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/`.

Open when worked: A308 (the auditor's model tier).
