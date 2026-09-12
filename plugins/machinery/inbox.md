
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

## FILED 2026-09-10T20:34:56Z URULE session_01QWmjq8dkUBAK3phe46ScYq

Context: the plan is for developer-friendliness to become its own plugin that machinery depends on, with duplicates removed from machinery. Gabe: "you asked about rule conflicts later, so it'd be new rules added to machinery, it should check to make sure it's not a rule in friendliness already."

The assistant restated it: before a new PRULE or URULE is filed into machinery, intake checks whether developer-friendliness already says it. If it's already there (same action, same reason), it isn't filed and its inbox entry points to the skill section. If it contradicts the skill, it goes to the owner for a ruling before filing. Otherwise it's filed as normal. The assistant proposed filing it now, as a URULE, into rules/rule-governance.md § Finding the group it joins. Gabe: "file it now"

(Written by hand: ruled in conversation on 2026-09-10 — Gabe, adding a duplicate check against the developer-friendliness skill to rule intake — without the URULE: marker, so the capture hook did not fire.)

disposition: filed → rules/rule-governance.md § Finding the group it joins

## FILED 2026-09-11T22:28:00Z URULE session_01QWmjq8dkUBAK3phe46ScYq

Gabe: "i updated verification-and-evidence.md myself"

Asked what the commit should contain, he chose "Full filing" — his text stays exactly as written, plus an inbox entry, an attribution line, the regenerated index and a version bump. Gabe: "full filing"

The five bullets, as filed into rules/verification-and-evidence.md § The word you just wrote makes a check due:

> - Change only the site the change is about. Then build and run the tests. The compiler errors and test failures that
>   come back name the affected sites. That list is the evidence, and it was produced with every other site untouched.
> - Never edit a site to find out whether it needed editing. The build you just ran already answered that. An edit made to
>   see what happens is a guess wearing the clothes of evidence.
> - A site you believe is affected that neither the compiler nor a test named gets the path written down first, from the
>   change to that site, and a test that fails there before you touch it.
> - Never edit a site to make a failure elsewhere go away. Fix what the failure names.
> - If you did edit a site and then decided it wasn't needed, undoing it is not enough. Show that the file is
>   byte-identical to where it started, and say in the report that you edited and reverted it. (Gabe, 2026-09-11, URULE.)

(Written by hand: the owner wrote the five bullets into rules/verification-and-evidence.md himself, in the working tree, rather than dictating them behind the URULE: marker, so the capture hook did not fire. His text is unchanged; the only assistant edit to it is the attribution on the last bullet, which covers all five as one ruling given 2026-09-11.)

Checked against the developer-friendliness skill before filing, as rules/rule-governance.md § Finding the group it joins now requires: none of the five asks for the same action for the same reason, and none contradicts it — that skill governs the record, never how evidence is obtained. The closest neighbours are its § 2 ("The index that did not help") and § 6.6 No surprises, which ask that a tried-and-reverted attempt be disclosed; the fifth bullet agrees with them and sharpens them, but demands something they do not — proof the file is byte-identical again.

disposition: filed → rules/verification-and-evidence.md § The word you just wrote makes a check due

## FILED 2026-09-12T01:18:00Z URULE session_01Cb11bxAbN31rQdnCc9MGx1

Remove these three bullets from rules/work-tracking.md. They are duplicates of the always-loaded developer-friendliness skill, which keeps its version of each.

From § Reading it and keeping it current:

> - Read the tracker for the fields you actually need. Read a whole ticket only
>   when the short context proves insufficient, and never pull whole tickets in
>   bulk.
> - Keep the companion entry current as the ticket moves. A pickup context that
>   describes last week is worse than none.

From § The learnings record:

> - Every effort also keeps a running ledger: what was done, what changed, what is
>   better, what got worse, whether the restructuring achieved its point, and what
>   new smells appeared.

Asked "we are removing all dups from machinery, correct?", Gabe ruled on 2026-09-10: "Confirmed. Duplicates come out of machinery, and the skill keeps its version." The ruling gated these three on the plugin loading the skill without being asked (ticket #94, item 3). The gate was discharged by observation on 2026-09-11: a session in another project quoted the skill's §5.1 append-only exception — text an hour old that exists nowhere on that project's disk — with the developer never naming the skill.

(Written by hand: ruled in conversation on 2026-09-10, without the URULE: marker, so the capture hook did not fire.)

Supersession is stated here in both directions, because the register cannot carry it: lib/index.mjs accepts only a supersedes entry whose superseded side is a section of a rule file, and the replacement is a skill outside rules/. The Supersession tables therefore stay empty, exactly as they did for 91f82d8, and the retired text quoted above points at what replaced it:

- "Read the tracker for the fields you actually need…" is replaced by the skill's §5.2 Reading, bullets "Escalate; never bulk." ("The cheapest index first — titles, names, a list. Then the one compressed entry for the item. Then the full record, and only once the compressed one has actually proven insufficient.") and "Take the part, not the whole."
- "Keep the companion entry current as the ticket moves…" is replaced by the skill's §6.5 Session continuity, row "How many pickup contexts per work item | exactly one, kept current as the item moves", and its closing prose: "a summary that no longer matches its subject is worse than none, because it is consulted first and believed… Keep it current, or delete it and let readers pay full price honestly." §5.2's "Keep the cheap stop current." says the same for the compressed entry generally.
- The running-ledger bullet is replaced by the skill's §6.4 Outcomes, row "Whether the work actually worked | a ledger for the effort: what changed, what improved, what regressed, what is newly wrong, whether the restructuring achieved its point, and what new smells appeared". Its two distinctive items were merged there word for word in f227d47 precisely so this removal loses nothing.

The `developer-friendliness` skill loads in every session from `~/.claude/rules/`, and machinery declares it a dependency, so nothing that machinery's rules stopped saying has stopped reaching a session.

disposition: filed → rules/work-tracking.md — three duplicate bullets removed, two from § Reading it and keeping it current and one from § The learnings record; each is kept by the always-on developer-friendliness skill at the sections named in this entry, and the effort-lifecycle skill's step 6 was re-pointed at that skill in the same commit
