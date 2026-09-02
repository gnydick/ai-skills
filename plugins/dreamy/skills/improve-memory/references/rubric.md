# Rubric — what to apply, what to flag, and how

The cost of a wrong auto-apply is a memory that is read into every future
session unexamined. The cost of a wrong flag is one checkbox the user has to
read. So the test for auto-applying is not "am I fairly sure" but "is the
evidence in the user's own words, and is the change reversible from the
overview alone." Everything else is flagged with the change fully drafted, so
the user's part is a tick.

## Dream candidates

| Dream says | Do |
|---|---|
| `high` · `new` · project-scoped | Write the memory file and index line. Applied. |
| `high` · `new` · `global` | Write into the memory of every project the evidence names. Applied. Also draft `~/.claude/rules/<topic>.md` and flag it (F-item) — a user-level rule loads into every session of every project, and that reach is the user's call. |
| `high` · `updates <name>` | Open `<name>`. If it already says it is superseded and points at the new rule, the dream is behind an edit — do nothing, note it. Otherwise rewrite `<name>` in place: new rule at the top, old rule folded into a dated "Superseded" paragraph, keep the file name so links hold. Applied. |
| `medium` (new or updates) | Draft the full memory file in the overview. Flag. |
| `low` | Draft a one-paragraph memory in the overview. Flag, and say what evidence would raise it. |
| listed under "Superseded or contradicted" without a numbered candidate | Open the named memory. If the dream's one-liner is enough to rewrite it and the reversal is in the user's words, rewrite. Otherwise flag with the dream's line quoted. |
| listed under "Needs a decision" | Flag as a decision item: both sides quoted, no recommendation unless one side is the user's later statement. |
| listed under "Also seen, weaker" | Do not act. Mention the count in the overview's scope note. They will resurface in a later dream if they matter. |

A dream candidate that names a project with no memory directory (a worktree,
a new checkout) is filed under the parent project when the inventory shows
one whose name contains it; otherwise it is flagged with the directory the
memory would need.

## Duplicates within one project

The inventory lists pairs by name-token overlap, description overlap, shared
`originSessionId`, and one name containing the other. Read both files.

- **Same fact, one is a subset of the other:** keep the superset. Move any
  sentence, link or date the subset had that the superset lacks. Repoint
  every `[[link]]` and index entry to the survivor, delete the subset.
  Applied.
- **Same fact, both add something:** merge into the one with more incoming
  links (ties: the older file, since more sessions have read that name).
  Applied.
- **Related facts, not the same:** leave both, but if the index hooks read
  the same, rewrite the hooks so a reader can tell them apart. Applied.
- **One is a campaign card for finished work and the other is the rule it
  produced:** the rule stays; the card is flagged for deletion unless the
  file itself says the work landed, in which case delete. The index ceiling
  is what these cards blow.

Keeping a file's name matters more than picking the better name: names are
link targets in other memories and in the user's head.

## Duplicates across projects

The same file in two projects' memory directories (same name, or same
`originSessionId` with a body that differs only in the project name) is
usually a fork: one project was cloned from the other and the memory came
along. The projects have diverged since, so the facts may have too. Flag,
with the diff between the two bodies shown. When the bodies are byte-identical
except for the project name and the fact is about the user rather than the
project (a `user` type memory), that is a global fact stored twice — flag it
as a candidate `~/.claude/rules/` file instead.

## Contradictions

Two live memories that cannot both be followed. The inventory surfaces
supersession markers and same-topic pairs; the dream surfaces reversals.

1. Date both sides. A dated statement in the user's words ("2026-08-24: no
   parallel agents") beats an undated one; a later one beats an earlier one.
2. If the winner is clear: rewrite the loser so its body opens with
   "**Superseded <date>** by [[winner]]" and one sentence on what changed,
   keep its frontmatter `name`, set `description` to start with
   `SUPERSEDED:`, and make sure the winner links back. Then, if the loser
   now carries nothing the winner lacks, fold it into the winner's
   "Superseded" paragraph and delete it (repointing links). Applied.
3. If both are dated and in the user's words, and the later one does not
   mention the earlier, that is a real reversal the user may not know he
   made. Apply the later one, but flag it with both quotes so he can
   confirm — the overview line says "applied, please confirm".
4. If neither is dated, or either is Claude's inference: flag with both
   quoted. No recommendation.

A memory that already says "SUPERSEDED" in its description is not a
contradiction; it is history. Leave it unless it has become a stub that
nothing links to, in which case fold it into what replaced it.

## Index hygiene

All applied, none flagged, because each is reversible from the overview line:

- Index line pointing at a missing file: remove the line. If the file was
  renamed (a file with the same `name:` exists), repoint instead.
- Memory file with no index line: add one, hook written from the
  description.
- Memory file with no frontmatter: add it, `type` inferred from the body
  (a rule the user gave is `feedback`; a fact about the repo is `project`).
- Broken `[[link]]` to a name that no longer exists: repoint to the merged
  survivor if the merge happened this run, otherwise remove the brackets so
  the text stays.
- Index over the ceiling (about 24 KB): cut task-state cards whose file
  says the work landed. Anything else over the line is flagged with the
  list of proposed cuts.
- Blank-line grouping in the index is the user's; keep it.

## Writing a promoted memory

Match what the memory system already writes, so the file is
indistinguishable from one saved mid-session:

```markdown
---
name: <kebab-case, the dream's name unless a saved memory already owns a better one>
description: "<one line: the rule and its reach, quoted if it contains a colon>"
metadata:
  type: user | feedback | project | reference
  promotedFrom: session-analysis dream <run_at>
---

<the fact or rule, two to five sentences, the user's own words where the
dream quoted them, dated>

**Why:** <the reason, from the dream's why line>

**How to apply:** <what a future session does differently>
Related: [[existing-memory]], [[other]].
```

Absolute dates only. Related links must point at names that exist; the
inventory JSON has the list. The index line is `- [Title](file.md) — hook`,
hook under fifteen words and phrased as the decision, not the topic.

## What never auto-applies

- Anything under a repository path. Proposals only.
- Deleting a memory whose content is not preserved somewhere the overview
  names.
- A rule the dream marked `medium` or `low`, however sensible it reads.
- Rewriting a memory in a project the pass was not scoped to.
- Changing the `name:` of a memory that other memories link to.
