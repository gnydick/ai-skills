
## FILED 2026-09-03T00:47:42Z URULE session_011LX8RSYosynbzXj5ut7oL1

URULE: On a campaign branch, the per-task repeats wait until coding is done. Each coding task still writes its test first and runs its own crate's tests before committing — that never waits. Everything else that repeats per task is done ONCE, in a single docs commit after the last coding task and before the merge gate: contract-map and pipeline-page re-marking, INVARIANTS and register row updates, ledger prose, and the long agent report (per-task reports are the test-result lines and deviations only). "Same change" in § The map is living documentation means the same BRANCH, not the same commit. Dependent tasks go to one agent in sequence; a fresh agent per task is the exception and is stated when used.

disposition: filed → rules/work-tracking.md § The learnings record

## FILED 2026-09-03T06:12:18Z URULE session_01AuqV5AftLrxLNLd6jr7dBH

A fixture that spawns a real subprocess strips every ambient environment variable that could redirect it outside the fixture's own directory before the first invocation, because a hook-invoked test inherits the hook's environment, not the shell's.

(Written by hand: ruled in conversation on 2026-09-02 — Gabe: "that rule should be incorporated into machinery" — in reply to the post-mortem of the fixture GIT_* leak, without the URULE: marker, so the capture hook did not fire.)

disposition: filed → rules/worktree-discipline.md § Working in it
