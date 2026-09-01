# CLAUDE.md § Config fields stop at the hub — full rule

Ruled by Gabe 2026-08-26 (RULE:-dictated, retroactive): implementing a config
field means the full manifestation of storage, defaults, and wiring into the
hub. Implementation in the slicing engine is NOT required for the field to
count as implemented.

- A knob with a registry entry and no hub accessor is a light switch screwed
  to the wall with no wire behind it; whether the room lights up is the
  engine's question, not the switch's.
- This does not relax § Config — wiring honesty's definition of an
  engine-wired key (`docs/INVARIANTS.md:146`: a key counts as wired only
  when its value reaches a decision) — that question is whether the ENGINE
  consumes a key. This rule answers a different question: whether the FIELD
  counts as implemented at all. A field can be hub-complete and still carry
  engine-side debt; both facts are tracked, neither is hidden by the other.

## Evidence and history

- This REVERSED a committed decision: `5243380b` had filed 104 newly
  UI-exposed Orca keys as `NotYetWired` debt; under this rule they were not
  debt, they were fields that were never finished, and `71cb2d95` wired 103
  accessors into the hub for them instead (GIT_566).
