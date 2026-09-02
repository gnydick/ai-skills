# CLAUDE.md § Tracking work — full rule

<!-- DRIFT-GATE:BEGIN tracking-work -->
- Related bugs share one worktree. Discover the link late? Combine and clean up.
- Every new piece of work gets a GitHub issue. `/superpowers` plans and specs hang off those issues.
  the issue needs to be engineer-stranger compatible, full engineer spec.
- Each campaign keeps a ledger of stats and changes: what we did, what changed, what
  is better, what regressed, whether the refactor worked, new smells.
- Learnings ship with the major commit or worktree, versioned like code, as the
  counterpart to plans and specs.
- Pickup protocol. Every ticket has exactly one "Context:" sub-issue: the compressed
  pickup context for an AI session. To get caught up: list issues for titles, fetch
  the ticket's one sub-issue, read its description — nothing else unless it proves
  insufficient. Goal is minimal token burn. Keep the context sub-issue current as
  the ticket moves.
  - The sub-issue relation is reserved for this pair alone. Nothing else is ever a
    sub-issue of anything.
  - Campaign findings, epic chapters, follow-ups: each is its own NEW ticket pair
    (full engineer-stranger parent + its own Context child), never a sub-issue of
    the campaign.
  - Added-links mirror at both levels: the new parents are "added" tickets on the
    overall parent; the new Context children are "added" tickets on the overall
    Context child. A session resuming a campaign reaches every finding's context
    from the one campaign sub-issue, without pulling any full parent.
- GitHub Issue read access is designed for minimum token consumption
    - use API to only fetch fields needed
    - allowed: list github issues to get the title then get the 1 sub-issue for that ticket.
    - allowed: read full issue if more context is needed
    - not allowed: pulling full issues
    - add learnings to the sub-issue with AI condensed context
    - when referring to issue numbers, developer may refer to the parent or child, it always means the set
      and the issue access and behavior rules still apply, the referred to issue number doesn't redirect
- Issues are updated in the parent full spec and child context everytime there is a correction
  given by the developer
-  Every GH issue gets a label for the worktree it's in
-  Don't make sub-issues, they are only for the parent-child relationship with full detail in parent and context in 
   child. Make new ticket pairs if you want to track individual progress, then add them as "added" tickets, parents 
   to the overall parent, and sub-issues to the overal sub-issue 
   not sub-issues
- Every commit message gets a marker for the github issue that relates to it in the form if GIT_[\d]+   
<!-- DRIFT-GATE:END tracking-work -->
