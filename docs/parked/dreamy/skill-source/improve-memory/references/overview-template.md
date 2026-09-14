# Memory Improvement Overview — template

Write exactly this structure. `apply` parses the flagged items, so the
`- [ ] **F<n>**` lines and the fenced action blocks under them are load-bearing;
the prose around them is for the user.

A flagged item's box has three states, and the user sets them by editing the
file or through the review page that `/dream` publishes:

- `- [ ]` open — not decided yet; carried forward, dropped after three runs
- `- [x]` approved — `apply` executes it
- `- [-]` declined — `apply` (or the next pass) moves it to "## Declined";
  it is never re-proposed and nothing is written

```markdown
---
skill: improve-memory
run: <N>
run_at: <ISO timestamp, local offset>
dream_consumed: <path of the dream file read, or none>
dream_run_at: <the dream's run_at, or none>
projects_in_scope: <M>
memories_read: <count>
applied: <count of applied items>
flagged: <count of open F-items>
carried_forward: <count of F-items from earlier runs still open>
---

# Memory Improvement Overview — run <N>, <date>

<Two to four sentences: what was read (dream window and candidate count,
projects and memory counts), what the pass did in one line, and any scope
note — a project skipped for having no memory directory, a dream candidate
that named a worktree and was filed under its parent, a fan-out.>

## Applied

<Grouped by project. One bullet per change, past tense, with the path.
A reader who trusts the skill reads only this section.>

### <project> (`<memory dir>`)
- **Promoted** `<file>.md` from dream #<n> (<type>, high) — <hook>. Index line added.
- **Merged** `<loser>.md` into `<survivor>.md` — <what the loser added, or "subset">. <k> links repointed, loser deleted.
- **Superseded** `<old>.md` by `<new>.md` (<date of the user's ruling>) — <one line>. Old file rewritten as pointer.
- **Index:** removed <k> dangling lines, added <k> missing, <before> → <after> bytes.
- **Fixed** <k> broken links in `<file>.md`.

## Needs your approval

<Ordered: decisions first, then reversals to confirm, then medium/low
promotions, then cross-project duplicates, then instruction-file proposals.
Each item is self-contained: the user must be able to tick it from this
text alone. Every action block is executable without judgement.>

### Decisions

- [ ] **F1** · <project> · decision · since run <N>
  <Both sides, each with date and quote. No recommendation unless one side
  is the later statement, in which case say so.>
  ```action
  kind: choose
  options:
    a: <what applying side A writes — path and content or old/new>
    b: <what applying side B writes>
  ```

### Confirm a reversal already applied

- [ ] **F2** · <project> · reversal · since run <N>
  Applied: `<file>.md` now says <new>. Earlier (<date>) it said <old>.
  Tick to confirm; leave unticked to have the next pass revert.
  ```action
  kind: confirm
  revert:
    path: <memory file>
    content: |
      <the previous file content, verbatim>
  ```

### Promotions (medium / low confidence)

- [ ] **F3** · <project> · promote · <medium|low> · since run <N>
  <hook>. _Seen:_ <dream evidence line>. <For low: what would raise it.>
  ```action
  kind: write
  path: <memory dir>/<name>.md
  index_line: "- [<Title>](<name>.md) — <hook>"
  content: |
    <full memory file, frontmatter included>
  ```

### Cuts

- [ ] **F<n>** · <project> · cut · since run <N>
  `<file>.md` is <a superseded stub with no replacement | a finished campaign card | over the index ceiling>. Its content is preserved <where>. Tick to delete the file and its index line.
  ```action
  kind: delete
  path: <memory file>
  index_line: "<the exact index line to remove>"
  preserved: |
    <the file's content, so the overview alone can restore it>
  ```

### Duplicates across projects

- [ ] **F4** · <project A> ↔ <project B> · cross-duplicate · since run <N>
  `<name>.md` exists in both; bodies differ in: <diff summary or "project name only">.
  ```action
  kind: choose
  options:
    keep-both: no change
    global: write ~/.claude/rules/<topic>.md (content below) and delete both
      content: |
        <...>
  ```

### Instruction-file proposals

- [ ] **F5** · <project> · proposal · since run <N>
  `CLAUDE.md` <before> → <after> chars; new: `.claude/rules/<area>.md` (<n> chars), `docs/rules/<x>.md`.
  Ledger: `~/.claude/improve-memory/proposals/<project>/FIDELITY.md` — <k> kept, <k> condensed, <k> moved, <k> dropped.
  ```action
  kind: swap
  files:
    - target: <absolute repo path>/CLAUDE.md
      proposal: ~/.claude/improve-memory/proposals/<project>/CLAUDE.md
      target_sha256: <hex, or "new" if the target does not exist>
    - target: <absolute repo path>/.claude/rules/<area>.md
      proposal: ~/.claude/improve-memory/proposals/<project>/.claude/rules/<area>.md
      target_sha256: new
  ```

## Declined

<F-items the user marked `[-]`, one line each: original ID, the date it was
declined, what it proposed. Not re-proposed; the history file from the run
that first flagged them has the full text. A later dream that surfaces the
same fact again gets a new item, since the evidence is new.>

## Dropped

<F-items unticked for three runs, one line each with their original ID and
what they proposed. They are not re-proposed; the history file from the run
that first flagged them has the full text.>

## Not acted on

<One line each: "also seen" count from the dream, candidates aimed at a
project with no memory directory, anything the rubric said to leave.>
```

Omit a section that would be empty, except "Applied" and "Needs your
approval", which say "Nothing." so the reader knows the pass looked.

## After `apply`

Move each applied F-item's bullet into "Applied" under a heading
`### Applied from approvals, <date>` with the checkbox removed and the
action block deleted. Move each `[-]` item into "## Declined" as one line
(ID, date, what it proposed), deleting its block. Items whose target moved
stay in "Needs your approval" with a line appended: `Target changed since
proposal (sha mismatch); will be re-proposed next run.` Update the
frontmatter counts.

## Status line (chat reply)

```
Memory pass done: <memories_read> memories across <M> projects, dream of <dream_run_at or "none">.
Applied <a> (<promoted> promoted, <merged> merged, <superseded> superseded, <index> index fixes). Flagged <f> for you (<decisions> decisions, <proposals> instruction-file proposals), <c> carried forward.
Overview: ~/.claude/improve-memory/Memory Improvement Overview.md
Tick what you approve, then /improve-memory apply.
```

For `apply`:

```
Applied <k> of <ticked> ticked items; <s> skipped because the target changed since the proposal; <d> declined items filed.
Overview updated: ~/.claude/improve-memory/Memory Improvement Overview.md
```

No overview text in chat. No question.
