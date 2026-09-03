
## FILED 2026-09-03T00:47:42Z URULE session_011LX8RSYosynbzXj5ut7oL1

URULE: On a campaign branch, the per-task repeats wait until coding is done. Each coding task still writes its test first and runs its own crate's tests before committing — that never waits. Everything else that repeats per task is done ONCE, in a single docs commit after the last coding task and before the merge gate: contract-map and pipeline-page re-marking, INVARIANTS and register row updates, ledger prose, and the long agent report (per-task reports are the test-result lines and deviations only). "Same change" in § The map is living documentation means the same BRANCH, not the same commit. Dependent tasks go to one agent in sequence; a fresh agent per task is the exception and is stated when used.

disposition: filed → rules/work-tracking.md § The learnings record
