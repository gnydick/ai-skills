# CLAUDE.md § The environment is read once — full rule

Ruled by Gabe 2026-08-18 on finding `env::var_os` called per segment: **"call
frequency doesn't matter, it's a matter of design."**

The process environment is a FACT. Never re-derive says a fact is computed once,
at its authority, and every consumer reads it — so a `FS_*` switch is resolved in
ONE place per crate and everything inland reads a field. Ninety-seven scattered
`env::var*` calls are ninety-seven private opinions of the same environment,
re-resolved as often as each site happens to run.

- **Authority, not convenience.** One `traps` module per crate holds every switch
  the crate honours, resolved on first touch. `fs_arachne_voronoi::traps` is the
  model. A `FS_*` name appearing anywhere else in that crate is a bug.
- **Mechanically checked, not promised.** The authority ships a test that greps
  its own crate for `env::var` and fails on any site but itself
  (`traps_are_the_only_env_reader`). A doc comment does not stop the next one.
- **A field read is not the whole fix.** Where a switch gates a PER-ELEMENT
  decision, the branch must not exist in the loop either: choose the path once,
  outside, and monomorphise (`fn walk<const TRAP: bool>`), so the check compiles
  out. A cached read (`OnceLock`) still costs a branch per element and was
  explicitly rejected as sufficient.
- **Cost is the symptom, not the rule.** `chain_decision` read `FS_CHAIN_3WAY`
  once per segment against 1,664,969 segments in a single castle slice — but the
  rule would hold at one call per slice. Scattered authorities are the defect;
  the cycles are how it got noticed.

Enforcement: `docs/RULES-GROUPED.md` § Design — invariants by construction; the
per-crate `traps_are_the_only_env_reader` test; GIT_385.
