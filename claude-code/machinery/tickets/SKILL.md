---
name: tickets
description: Load when creating, reading, updating, blocking or closing a ticket or issue, when resuming an effort, and when filing a finding or follow-up. Holds the ticket shape, when a companion entry exists, and how tickets close.
---
# Tickets

## Creating
- Before filing any ticket or issue, run the issue tracking command's `decide` (its path is on the session banner's `issue tracking command:` line). If it prints `issue_tracking: ask`, run the `issue-tracking` item of /machinery:setup first, then file.
- One ticket per work item, written so a competent stranger could pick it up cold: the problem; the required behaviour as numbered items; the decision, its date and who made it; the tests required; the exact places in the code it touches. Plans and specifications hang off the ticket. Design beliefs and invariants go in the spec when one exists.
- Before creating a ticket the owner asked for, suggest its summary line in words the owner would recognize (their own name for the symptom or feature), and create it once they accept or edit it.
- If the work has its own worktree, label the ticket with the worktree's name.
- A finding, a chapter of a larger effort, or a follow-up is its own new ticket linked to the effort's ticket, never its child.
- Within a campaign, finish one feature before starting the next.

## Companion entry
- Every ticket has exactly one companion entry holding the compressed pickup context for an assistant starting fresh. Creating a ticket is creating both halves in one step: the ticket, the companion titled for it, the link that binds them, and the same labels on both. A ticket with no companion is an unfinished filing, not a smaller one. A request to repair a half-made pair is the same one step.
- The link is the tracker's own parent-and-companion relationship, reserved for that pair alone; nothing else is ever filed as a child of anything. It must be a different kind of relationship from the links expressing ordering or dependency between tickets — different enough that a query tells the two apart by the relationship's own type, never by remembering which values of a shared field mean which. A title that names the other half is a mention, not a link.
- The companion opens "Pickup context for #<n>", then five to eight bullets: the ruling, today's cause with its exact location, the shape of the fix, the decisions, the tests, the worktree.
- Link a new pair in an effort at both levels: ticket to the effort's ticket, companion to the effort's companion.
- A ticket number means both halves of its pair.
- To catch up: list titles, read the companion, and open the full ticket only if that is not enough.

## Updating
- A correction from the owner updates the ticket and its companion.
- Blocked on the owner's decision: label the ticket and companion blocked and comment on the companion exactly what input is needed. Unattended passes skip it.
- Keep the owner's own description of a problem word for word: never change or remove it. Add to the ticket freely around it — new sections below it or comments with the reproduction, cause, findings, learnings and plan.

## Closing
- Close a ticket only when the feature it belongs to is usable.
- An item on the owner's own list of complaints closes only after the owner has seen the behaviour and said so.
- Close a pair in order: close the ticket with a comment naming the change that landed, then close its companion.
