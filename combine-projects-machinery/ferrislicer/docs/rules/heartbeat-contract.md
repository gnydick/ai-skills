# CLAUDE.md § A long-running tool emits a heartbeat the main agent knows to look for — full rule

Ruled by Gabe 2026-08-28 (RULE:-dictated), verbatim: "i asked that all of our
tools and commands be filtered so the background agents are probably pretty
quiet. we should add a standard heartbeat across all of our tools that the
main agent knows to look for."

**Extends § A gate script echoes its sub-check's denominator, does not
duplicate it.** That rule gets a sub-check's own evidence onto the gate
script's stdout at all. This rule is about the silence WHILE the tool is
still running, between invocation and that final line — a gate that prints
its denominator once, at the end, is still indistinguishable from a hung
process for the entire run before it.

- **Format, uniform across every tool.** A long-running tool or gate (any
  invocation of `scripts/battery.sh`, `scripts/merge-gate.sh`,
  `scripts/perf.sh`, `scripts/bench-report.sh`, `scripts/testq.sh`,
  `scripts/prove-gcode-identical.sh`, or an equivalent long build/test run)
  emits one line, at a bounded, regular interval while a step is still
  running, matching a single project-wide pattern so ONE regex recognizes
  every tool's heartbeat — e.g. `HEARTBEAT <tool> <elapsed> [<progress>]`.
  It carries, at minimum: which tool, that it is alive, and progress if
  progress is knowable (`gate 12/18`, `142/510 tests`) — a heartbeat with a
  denominator is strictly better than a bare pulse, the same preference
  already ruled for a sub-check's own denominator line.
- **Reaches the caller, not just a log file.** Per the sibling rule's own
  finding, `gate()` redirects a sub-check's entire stdout+stderr to a
  per-gate log — a heartbeat emitted inside that redirect never reaches
  anyone. The heartbeat is written to the TOOL's own stdout, upstream of any
  such redirect, so it survives both the log-swallow this rule's sibling
  named and the quiet filter's line selection.
- **The consequence for the main agent.** Once the format is standard and
  the filter preserves it, silence becomes meaningful: no heartbeat within
  its interval means the job is dead or hung, not "probably still working"
  — the exact ambiguity that produced all four stalls above. An agent
  watching a background job watches for the heartbeat pattern; it does not
  sit idle waiting for a completion notification it was never promised.
- **The mechanical check.** `.claude/hooks/quiet_run.py`'s keep-patterns
  (`BLOCK_START`/`KEYWORD`/`SUMMARY`) must match the heartbeat line format —
  a red-check fixture feeds a synthetic heartbeat line through the filter
  and asserts it survives selection. A long-running tool that runs past one
  heartbeat interval without emitting one is itself a defect, on the same
  footing as a sub-check that emits no denominator (previous section).
- **Scope.** This rule states the contract and the standard shape; wiring an
  emitter into each tool and adding the filter fixture is separate
  implementation work, not completed by this filing.

## Evidence and history

- **The evidence.** Four agents stalled the same way on 2026-08-28
  (~11:37, ~13:44, 16:07, 16:33 PDT): each returned with no result while a
  background gate ran, having waited on a completion signal it had no
  contract to receive. The fourth stalled despite an explicit written
  instruction not to. One stall hid a REAL failure: GIT_614 batch 1 was
  waiting on a job that had already finished and failed, its exit code
  swallowed by `| tee` (a known trap in this environment) — the failure
  surfaced only when the agent read `target-gate/gate-logs/` directly
  instead of continuing to wait.
- **The asymmetry this closes.** `.claude/hooks/quiet_run.py`'s
  `BLOCK_START`/`KEYWORD` patterns keep a `FAIL` line and its block; a bare
  `pass` line matches neither and is dropped unless it lands in the final
  `TAIL_LINES` (8) of output (measured; same file, `.claude/hooks/quiet_run.py:41`).
  A periodic heartbeat has the same shape as that dropped `pass` line today
  — nothing here yet keeps it, so it would be filtered away exactly like the
  evidence § A gate script echoes its sub-check's denominator already found
  missing.
