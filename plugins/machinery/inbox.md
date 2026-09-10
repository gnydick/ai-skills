
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

## FILED 2026-09-05T21:00:02Z URULE 130ad271-0bca-4f17-9037-309f86afb0e8

URULE: work on campaigns, don't get distracted by new issues outside of the campaign. multiple-object support is a large campaign. once within a campaign, work one feature to completion a feature may take multiple tickets

disposition: filed → rules/work-tracking.md § Staying inside the effort

## FILED 2026-09-05T21:12:33Z URULE 130ad271-0bca-4f17-9037-309f86afb0e8

URULE: i only want to merge code that is not broken and will not cause problems like if it's incomplete, but unreachable

disposition: filed → rules/worktree-discipline.md § What may be merged

## FILED 2026-09-06T23:12:58Z URULE a97f7197-5a7f-48f0-9778-fea87343b4a4

URULE: anything starting with SPEC: is a specification to be implemented, not a behavior. expect it to be framed in the context of discussed or currently in flight work, feature, or campaign.  expect to find associated tickets with them. a specification is analogous to what your principal architect would give you. it is authoritative.

disposition: filed → rules/work-tracking.md § A specification handed down

## FILED 2026-09-07T06:38:52Z URULE 5696552d-b37b-4476-a0b7-089391e2f6b6

URULE: when designing, coding, or building anything that must interface with existing resources, no implementation details can be delivered from memory alone unless it's part of a spec loaded with the project. read the resource you are directly interfacing with before coming to a conclusion on how to do your job

disposition: filed → rules/verification-and-evidence.md § Before you write code

## FILED 2026-09-08T23:27:24Z URULE a2af19dc-f7ad-45a6-be61-a545a97ff88e

URULE: never replace base programming language convention to match a presentation layer feature

disposition: filed → rules/design-invariants.md § The base language's own convention

## FILED 2026-09-09T03:17:23Z URULE c78c894c-93d1-435b-9800-f9c55f70b251

URULE: don't speak in idioms unless negotiated with the user. always speak in terms of typical coding and tech terms. examples: this is a method of that. A is a sublass of B. the method we're speaking about is public when it should be private.

disposition: filed → rules/straight-talk.md § The words you use

## FILED 2026-09-10T19:42:18Z URULE session_01QWmjq8dkUBAK3phe46ScYq

Remove this bullet from rules/work-tracking.md § A ticket and its companion, and do not move or replace it:

> - Related defects are worked in one place. Discovering the link late means
>   combining them and cleaning up, not carrying two efforts.

The assistant proposed "the related-items rule, removed from machinery". Gabe: "yes, remove related items from machinery, that causes explosive scope creep"

(Written by hand: ruled in conversation on 2026-09-10 — Gabe, removing the rule because the rule itself causes scope creep — without the URULE: marker, so the capture hook did not fire.)

disposition: filed → rules/work-tracking.md § A ticket and its companion — bullet "Related defects are worked in one place" removed, not moved or replaced; owner ruled the rule itself causes explosive scope creep
