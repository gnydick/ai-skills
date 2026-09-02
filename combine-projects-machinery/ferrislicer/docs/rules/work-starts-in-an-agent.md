# CLAUDE.md § Work starts in an agent — full rule

Ruled by Gabe 2026-08-27 (RULE:-dictated): efforts are STARTED in agents, to
conserve tokens. The default is dispatch; the main loop's own work is design,
adjudication, verdicts, and verifying a returned result — everything else is
dispatched to a subagent, running inline.

- **No size threshold decides this.** A proposal to gate dispatch on a
  threshold ("the same edit shape more than ~10 times, or any build-and-fix
  loop") was raised and rejected in the same session, 2026-08-26 — no
  threshold is needed, an effort starts in an agent.
- **The cost being conserved is main-loop CONTEXT, not model spend.**
  Hand-editing burns the main loop's own tokens on tool output (diffs, build
  errors, file reads) that a dispatched agent would have absorbed and
  returned as a summary instead.
- **This closes a gap in § Agent cost economy.** That rule picks the model
  TIER once work is dispatched, but never said work must be dispatched at
  all — the main loop could quietly do everything itself and technically
  never violate it.
- Dispatching ONE serial agent, within its class (see § Serial agents only),
  is the standing default and needs no permission; only cross-class fan-out
  beyond that allowance, or a Workflow, needs the user's ask.
- Loading a skill's full body into the main-loop context to do the work
  yourself is doing the work — put the skill invocation inside the
  dispatched agent's prompt instead.

## Evidence and history

Evidence for why this matters (2026-08-26): the main loop hand-generated 103
config accessors and rewrote a 251-row register table twice, in-loop,
corrupting the table both times; a dispatched agent caught the second
corruption on its first pass, after being handed a false premise about the
file's state, and stopped rather than improvising.
