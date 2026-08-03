- Related bugs share one worktree. Discover the link late? Combine and clean up.
- Every defect gets a GitHub issue. `/superpowers` plans and specs hang off those issues.
  the issue needs to be engineer-stranger compatible, full engineer spec
- Each campaign keeps a ledger of stats and changes: what we did, what changed, what
  is better, what regressed, whether the refactor worked, new smells.
- Learnings ship with the major commit or worktree, versioned like code, as the
  counterpart to plans and specs.
- Every ticket has exactly one "Context:" sub-issue: the compressed pickup context
  for an AI session. To get caught up: list issues for titles, fetch the ticket's
  one sub-issue, read its description — nothing else unless it proves insufficient.
  Goal is minimal token burn. Keep the context sub-issue current as the ticket moves.
- GitHub Issue read access is designed for minimum token consumption
    - use API to only fetch fields needed
    - allowed: list github issues to get the title then get the 1 sub-issue for that ticket.
    - allowed: read full issue if more context is needed
    - not allowed: pulling full issues
    - add learnings to the sub-issue with AI condensed context
    - when referring to issue numbers, developer may refer to the parent or child, it always means the set
      and the issue access and behavior rules still apply, the referred to issue number doesn't redirect
-  Every GH issue gets a label for the worktree it's in