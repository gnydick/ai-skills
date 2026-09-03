# Work tracking

How work is recorded: the ticket and its companion entry, the learnings
notebook, and the one editable home a restated rule keeps. Loaded at session
start.

## A ticket and its companion

- Every new piece of work gets a ticket written so a competent stranger could
  pick it up cold, and the plans and specifications for it hang off that ticket.
- Every ticket has exactly one companion entry holding the compressed pickup
  context for an assistant starting fresh.
- The parent-and-companion relationship is reserved for that pair alone. Nothing
  else is ever filed as a child of anything.
- The link that binds a ticket to its companion must be a different kind of
  relationship from the links that express ordering or dependency between an
  effort's tickets and the work tickets under it — different enough that a query
  tells the two apart by the relationship's own type, never by remembering which
  values of a shared field mean which. The tracker then cannot confuse a
  companion with a dependency.
- A finding, a chapter of a larger effort, and a follow-up are each their own new
  ticket pair, never filed underneath the effort's ticket.
- Link a new pair to the effort at both levels — the full ticket to the effort's
  ticket, the companion entry to the effort's companion entry — so a session
  resuming the effort reaches every finding's context through companion entries
  alone, without ever opening a full ticket.
- When someone names a ticket number they mean the pair, whichever half they
  named. The reading rules still apply, and the number you were given does not
  send you somewhere else.
- Every ticket carries a label naming the working copy the work lives in, on
  both halves of the pair.
- Every commit message carries a marker naming the ticket it belongs to.
- Related defects are worked in one place. Discovering the link late means
  combining them and cleaning up, not carrying two efforts.

## Creating and shaping a pair

- Creating a ticket pair is one command, not a sequence people repeat by hand:
  it creates the ticket, creates its companion titled for the ticket, links them
  with the real relationship rather than a mention, and labels both the same.
  Done by hand it is several calls in a fixed order keyed on an identifier the
  interface never shows, so it gets done differently each time and pairs end up
  half-made.
- The same command repairs a half-made pair by linking two tickets that already
  exist. Repair goes through the pipeline too, not around it.
- A full ticket has a fixed shape: the problem, the required behaviour as
  numbered items, the design constraint, the dated decision and who made it, the
  tests required, and the exact places in the code it touches.
- A companion entry opens by saying it is the pickup context, then gives five to
  eight bullets: the ruling, today's cause with its exact location, the shape of
  the fix, the decisions, the tests, and the working copy it lives in.

## Reading it and keeping it current

- To catch up on a ticket: list the titles, fetch its one companion entry, read
  that. Nothing else, unless that turns out to be insufficient.
- Read the tracker for the fields you actually need. Read a whole ticket only
  when the short context proves insufficient, and never pull whole tickets in
  bulk.
- Keep the companion entry current as the ticket moves. A pickup context that
  describes last week is worse than none.
- Learnings are written back into the companion entry, condensed, so the next
  reader gets them at pickup cost.
- A correction from the owner updates both halves of the pair, every time.
- When a pair is blocked on the owner's decision, label both halves as blocked
  and comment on the companion entry saying exactly what input is needed. An
  unattended pass skips anything so marked.
- Close a pair in order: close the ticket with a comment naming the change that
  landed, add the condensed learnings to the companion entry, then close it too.

## The owner's own list

- An item on the owner's own list of complaints is marked fixed only when the
  owner has seen the behaviour and said so. Your own verification does not close
  it.
- Never rewrite the owner's own description of a problem. It is their record of
  what they saw, and editing it destroys the only account of the symptom that is
  not yours.

## The learnings record

- Learnings ship with the work that produced them — written in the same change,
  versioned and managed like source — so the history of the record is itself the
  record of how understanding changed.
- Every entry stands on its own: what prompted it, what was done, what was
  observed, and what is concluded.
- Every effort also keeps a running ledger: what was done, what changed, what is
  better, what got worse, whether the restructuring achieved its point, and what
  new smells appeared.
- Three records, three jobs: the tracker holds what is broken, the plans and
  specifications hold what was intended, and the notebook holds what reality
  answered. Work is fully recorded only when both intent and answer exist.
- In an effort of several tasks on one branch, the repeats each task would otherwise carry — re-marking the living maps, the invariant and register rows, the ledger prose, and the long report — are done once, in a single documentation commit after the last coding task and before the merge gate. What never waits: each task writes its test first and runs its own component's tests before committing, and its per-task report is the test-result lines and deviations only. "The same change" above means the same branch, not the same commit.

## One editable home

- A rule that gets restated elsewhere has exactly one editable home, and every
  restatement is generated from it through a template that carries no rule text
  of its own. There is then no second place a divergent copy can be typed.
- A restatement earns its place by adding what the rule text lacks: the exact
  commands that carry it out, so someone with no context can follow it.
- A generator that leaves only one copy of anything must test itself against
  that copy: disturb the real file, watch the check go red, restore it exactly,
  and prove afterwards that the working tree is unchanged. Having no spare copy
  is the point, not an obstacle.

<!-- rows: 6.1–6.21, 6.23–6.30, 6.36 -->
