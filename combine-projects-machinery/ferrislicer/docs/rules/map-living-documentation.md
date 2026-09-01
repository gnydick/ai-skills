# CLAUDE.md § The map is living documentation — full rule

Every bug fix and every implementation updates the pipeline mapping in the same
change: the contract map (`docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md`),
and, when config keys or feature gaps moved, the alignment data
(`docs/superpowers/specs/pipeline-alignment/*.json`) and the pipeline page
(`docs/superpowers/models/preview.html`).

- "Update" means: the affected stage's section reflects the new behaviour, a
  divergence that was fixed is re-marked (divergent → aligned, with the commit),
  and a gap ticket that landed flips its status on the page.
- A fix in a stage the map has not reached at logic depth starts by mapping that
  stage (the map doc's §4.1.x template) — never by guessing at it.
- A merged change that contradicts the map makes the map wrong at exactly the
  moment someone trusts it; stale-map is treated like a failing test, not like
  missing docs.
- The design-decision register (`docs/RULES-GROUPED.md`) is living documentation
  the same way: a change that adds, changes, or supersedes a rule updates the
  register in the same commit, durable home first — the register cites, it never
  originates. Dictated rules start the prompt with `RULE:` (captured mechanically
  to `docs/rule-inbox.md`; a PENDING entry blocks every commit until filed via
  `/rule-intake` or dismissed with a reason).
