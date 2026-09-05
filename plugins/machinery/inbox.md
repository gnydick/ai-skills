
## FILED 2026-09-03T00:47:42Z URULE session_011LX8RSYosynbzXj5ut7oL1

URULE: On a campaign branch, the per-task repeats wait until coding is done. Each coding task still writes its test first and runs its own crate's tests before committing — that never waits. Everything else that repeats per task is done ONCE, in a single docs commit after the last coding task and before the merge gate: contract-map and pipeline-page re-marking, INVARIANTS and register row updates, ledger prose, and the long agent report (per-task reports are the test-result lines and deviations only). "Same change" in § The map is living documentation means the same BRANCH, not the same commit. Dependent tasks go to one agent in sequence; a fresh agent per task is the exception and is stated when used.

disposition: filed → rules/work-tracking.md § The learnings record

## FILED 2026-09-03T06:12:18Z URULE session_01AuqV5AftLrxLNLd6jr7dBH

A fixture that spawns a real subprocess strips every ambient environment variable that could redirect it outside the fixture's own directory before the first invocation, because a hook-invoked test inherits the hook's environment, not the shell's.

(Written by hand: ruled in conversation on 2026-09-02 — Gabe: "that rule should be incorporated into machinery" — in reply to the post-mortem of the fixture GIT_* leak, without the URULE: marker, so the capture hook did not fire.)

disposition: filed → rules/worktree-discipline.md § Working in it

## 2026-09-05T00:18:39Z URULE session_01BgBtukUw8mp7b9cavY8rnR

URULE: In § Which model, "the main conversation's own model" is not a fixed reference — the owner switches which model runs the main session (just did, to Sonnet 5). Design, adjudication and verdicts go to a fixed top tier, above sonnet, not to whatever the session's own model currently is.

(Written by hand: ruled in conversation on 2026-09-04 — Gabe, correcting the § Which model wording — without the URULE: marker, so the capture hook did not fire.)

disposition: filed → rules/agent-topology.md § Which model

## 2026-09-05T00:31:18Z URULE session_01BgBtukUw8mp7b9cavY8rnR

URULE: The just-filed § Which model rule pins design, adjudication and verdicts to a fixed top tier, but says nothing about coding — a real gap, not a wording nuance, since it left this very session's coding work unpinned. Fold coding into that same top-tier bullet, alongside design, adjudication and verdicts.

(Written by hand: ruled in conversation on 2026-09-04 — Gabe, closing a gap he noticed in the rule filed minutes earlier — without the URULE: marker, so the capture hook did not fire.)

disposition: filed → rules/agent-topology.md § Which model

## FILED 2026-09-05T04:16:22Z URULE 130ad271-0bca-4f17-9037-309f86afb0e8

urule: Add your rules you just suggested

disposition: filed → rules/agent-topology.md § Handing a ruling to a dispatched agent
