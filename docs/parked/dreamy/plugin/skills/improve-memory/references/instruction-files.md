# Instruction files — target shape and migration

Everything here produces proposals under
`~/.claude/improve-memory/proposals/<project>/`, never edits in a repository.

## How Claude Code loads these files

Verified against the Claude Code memory docs (code.claude.com/docs/en/memory):

- `CLAUDE.md` and `CLAUDE.local.md` are loaded from the working directory
  and every parent up to the filesystem root at launch, concatenated with
  the nearest last. A `CLAUDE.md` in a *subdirectory* is loaded on demand,
  when Claude reads a file in that subtree.
- `@path` on a line in `CLAUDE.md` imports that file into context at launch,
  relative to the importing file, up to four hops deep. A path in backticks
  is literal, not an import. So `@docs/rules/x.md` costs context every
  session; `` `docs/rules/x.md` `` costs nothing until someone opens it.
- `.claude/rules/*.md` in the project are loaded like `CLAUDE.md`, except a
  file whose frontmatter has `paths:` (a list of globs) loads only when
  Claude reads a file matching one of them. `~/.claude/rules/*.md` are the
  same for the user, loaded before project rules so project rules win.
- Block HTML comments are stripped before injection, so a maintainer's note
  inside `<!-- -->` costs nothing.

That gives four tiers, and the whole restructuring is sorting content into
them:

| Tier | Loaded | Holds |
|---|---|---|
| `CLAUDE.md` | every session | the crib sheet: one trigger line per rule, a pointer each |
| `@imported` file | every session | detail Claude must have without being told to look — short |
| `.claude/rules/<area>.md` with `paths:` | only when working under those paths | rules that apply to one part of the tree |
| archive (`docs/rules/*.md` or wherever the project already keeps them) | on demand | evidence, adjudication trails, incident write-ups, worked examples |

## The crib sheet

A rule in `CLAUDE.md` is the shape it already has in the user's best-kept
project: a heading that names the rule, two to six bullets that are the
rule's *triggers* (when it fires and what it demands), and a `Full rule:`
pointer to the archive file. The reason a rule exists, the incident that
produced it, the measurements — all of that is what the archive is for. The
user's own diagnosis was that a 55 K-character `CLAUDE.md` was "using
claude.md wrong"; the split that followed halved it with no fidelity loss,
and the crib-sheet-plus-archive shape is what it landed on.

Things that belong in the crib sheet even though they are not rules: the
project's one-line purpose, the hard constraints that drive design, the
stack decision ("already decided, do not relitigate"), and where the
registers live (`docs/RULES-GROUPED.md`, `docs/LEARNINGS.md`, the issue
conventions). Things that never do: incident narratives, measured numbers
that justify a rule, the history of how a rule changed, and task state.

Ordering: hard rules the user marked as such first, then design rules, then
verification discipline, then environment and tooling, then workflow. A
reader scanning for "what will get me corrected" finds it at the top.

## Path-scoped rules

When a section of `CLAUDE.md` is about one part of the repository — a
package, a mock server, a tooling directory, an Android build, a docs tree —
it becomes `.claude/rules/<area>.md`:

```markdown
---
paths:
  - "packages/mock-duet/**"
  - "scripts/mock*.sh"
---

# Mock server rules

- The mock moves with every iteration: a change to what the UI reads from
  the board updates `packages/mock-duet` in the same change.
- Whoever stands a mock up tears it down; confirm by port state, never exit
  code.

Full rules and the 2026-08-29 orphan incident: `docs/rules/mock.md`
```

The test for "is this path-scoped": would a session that never touches those
files be worse off for not having read it? If no, scope it. Rules about
*how the user is spoken to* or *how work is dispatched* are never
path-scoped; they apply to every session.

Globs are matched against paths Claude reads, so cover the directories the
rule is about, not the files that mention them. Brace expansion works; keep
the list short.

## User-level files

Cross-project rules — how to talk to the user, agent dispatch discipline,
Windows shell gotchas, "verify before asserting" — belong in
`~/.claude/rules/<topic>.md`, one topic per file, with `~/.claude/CLAUDE.md`
as a crib sheet pointing at them. Today the user has no `~/.claude/CLAUDE.md`
and one rules file; a global dream candidate is the usual reason to propose
one. A project rule that repeats a user rule is a duplicate: the proposal
removes it from the project's crib sheet and says so in the ledger.

## Migration procedure (per project)

1. Read the current `CLAUDE.md`, any `CLAUDE.local.md`, every
   `.claude/rules/*.md`, and the archive files the crib sheet points at, so
   the ledger can say "already in archive" rather than "moved".
2. Number every heading and every bullet under it. This is the ledger's
   left column.
3. Sort each numbered item into a tier. Rewrite nothing while sorting.
4. Write the proposal files: `CLAUDE.md`, any new `.claude/rules/<area>.md`,
   any new archive files for content that had no home. Text moves verbatim;
   only the crib-sheet lines are condensed, and a condensed line keeps the
   rule's every trigger.
5. Write `FIDELITY.md`: one row per numbered item — original location,
   disposition (`kept` / `condensed` / `moved → path` / `already in path` /
   `dropped: reason`), and for `condensed`, the words removed. A `dropped`
   row needs a reason a reader can check: superseded by a named rule, a
   number that is in the archive, task state that has landed.
6. Record the SHA-256 of each target file the proposal would replace, in
   the overview's action block, so `apply` can refuse a stale swap.
7. Size line in the overview: before and after character counts for
   `CLAUDE.md`, and the count for each new rules file.

Rules the dream promoted for this project are added in step 4 as new
crib-sheet entries with a new archive file carrying the dream's evidence
lines. They show in the ledger as `added from dream #n`.

## What the proposal must not do

- Change the meaning of a rule while condensing it. A trigger dropped is
  fidelity lost.
- Convert an on-demand archive pointer into an `@import`, or the reverse,
  without a ledger row saying why. Loading cost is the whole point.
- Invent directory globs the repository does not have. The inventory JSON
  lists top-level directories under each project's `cwd`; use those.
- Propose for a project the pass was not scoped to.
