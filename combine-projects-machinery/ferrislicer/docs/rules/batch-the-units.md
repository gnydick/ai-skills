# CLAUDE.md § Batch the units — full rule

Ruled by Gabe 2026-08-25 (RULE:-dictated): **a long task made of many units that
can each stand alone is dispatched in BATCHES** — never one agent per unit, never
every unit crammed into one agent. The batch size is chosen to balance token cost
against dispatch overhead.

- **Both extremes are the failure.** One agent per unit pays the full launch and
  context-priming cost N times for work that is often seconds each. All N units in
  one agent grows that agent's context until the late units are reasoned about
  through a haystack of the early ones — and one failure loses the whole run.
- **This is a GRANULARITY rule; it does not touch concurrency.** § Serial agents
  only still holds without exception WITHIN A CLASS (a batch is one task's units,
  one class throughout): the batches are dispatched ONE AT A TIME, each verified
  before the next. Batching reduces the NUMBER of serial dispatches within that
  class; it never licenses running two at once there, and it says nothing about a
  different class running concurrently.
- **"Can run on their own" is the test for what may share a batch.** Units with no
  ordering constraint and no shared state between them. A unit whose input is
  another unit's output is not independent and does not get batched with it.
- **Size the batch to the unit, and say what the batching was.** Report the batch
  count and what each batch covered, so a partial failure names the units that did
  not run rather than hiding inside "the agent failed."
