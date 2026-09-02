---
name: improve-memory
description: Consolidate and restructure Claude Code's long-term memory — the per-project memory directories under ~/.claude/projects, the MEMORY.md indexes, and the CLAUDE.md / .claude/rules instruction files — by consuming the overview /session-analysis dream writes. Merges duplicate memories, resolves contradictions, promotes high-confidence session findings into memory, and proposes CLAUDE.md upgrades in the crib-sheet-plus-subfiles structure (path-scoped rules files for anything that applies to one part of a project). Auto-applies the obvious, flags the rest as checkboxes in a "Memory Improvement Overview" file, and `apply` executes what the user ticked. Use this whenever the user runs /improve-memory, says to apply or act on the dream results, asks to clean up, dedupe, merge, prune or reconcile memory files, complains that CLAUDE.md is too long or wants it split into rules files or sub files, mentions memory contradictions or stale memories, or schedules a memory maintenance pass — even without naming the skill. Not for saving a single new fact mid-session; that is the normal memory tool.
---

# improve-memory

`/session-analysis dream` reads the sessions and proposes. This skill decides
and acts. It has two halves, and one rule separates what it may do on its own
from what it must hand back:

- **The memory bank** — `~/.claude/projects/<project>/memory/*.md` and each
  `MEMORY.md` index — is Claude's own notebook, loaded into every session of
  that project. The skill edits it directly when the evidence is in the
  user's own words: merge duplicates, resolve contradictions, write promoted
  candidates, fix the index.
- **Instruction files** — `CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/*.md`
  in a project, and `~/.claude/CLAUDE.md` / `~/.claude/rules/*.md` for the
  user — are never edited in place. They are shared, git-tracked, and the
  user has ruled that a governing file is rewritten as a candidate he
  compares side by side, then swaps in himself. The skill writes a full
  proposed file plus a fidelity ledger, and flags it.

Everything the skill did or wants to do goes into one file, the **Memory
Improvement Overview**. Flagged items are checkboxes; the user ticks the ones
he agrees with and runs `/improve-memory apply`.

```
/improve-memory [--from <dream file>] [--project <substring>]... [--home <dir>]
/improve-memory apply [--home <dir>]
```

`--from` defaults to `~/.claude/session-analysis/dream/latest.md`. `--project`
restricts the pass to memory directories whose folder name contains the
substring (same matching as session-analysis, so a worktree's folder matches
its parent's name). `--home` replaces `~/.claude` — it exists so the skill can
be tested against a fixture tree; never pass it in real use. Any other first
word is not a subcommand: reply with the usage block above and stop.

## This skill runs unattended

It is built to follow a dream pass in a loop or a scheduled routine, so a run
must finish on its own. Never ask a question, never wait for approval, never
offer choices in chat. The overview file *is* the conversation with the user:
what could not be decided becomes a flagged item with both sides written out,
and the chat reply is a four-line status. If the dream file is missing, the
hygiene half (duplicates, contradictions, index, structure) still runs and
the overview says no session findings were available.

Outputs:

```
~/.claude/improve-memory/
├── Memory Improvement Overview.md      the standing file; overwritten each run
├── history/<YYYY-MM-DD-HHMM>.md        copy of each run's overview
├── proposals/<project>/…               proposed instruction files, mirroring the repo layout
└── state.json                          run counter and which dream file was last consumed
```

## Step 1: Inventory

Reading three hundred memory files by hand is how a pass ends up shallow, so
the bundled script does the mechanical part first. It parses every memory
file's frontmatter and links, checks each `MEMORY.md` against the files on
disk, resolves each project folder to its working directory (from the
transcripts' `cwd`), inventories every instruction file it finds there, and
parses the dream overview into structured candidates.

```sh
node "<skill-dir>/scripts/inventory.mjs" --out "<scratchpad>/inventory.json" --summary
```

`<skill-dir>` is the directory containing this SKILL.md. Pass through
`--home`, `--dream <path>` (from `--from`) and `--project` when given. The
summary printed to stdout is a per-project table: memory count, index bytes,
dangling and unindexed entries, broken `[[links]]`, near-duplicate pairs,
supersession markers, instruction-file sizes, and the dream candidates aimed
at that project. Read the JSON for the detail — it is the worklist.

The script finds *candidates*; it cannot tell whether two files with similar
names state the same fact, or whether "SUPERSEDED" in a description means the
file is dead or is the pointer to what replaced it. Every judgement below is
yours, made by reading the files the script pointed at.

If the summary shows more than about 120 memory files in scope, fan out: one
subagent per large project, each handed `references/rubric.md`, the JSON
slice for its project, and the dream candidates for it, returning the
per-project sections of the overview in the template's format. Merge in the
main loop. Keep the global candidates and the cross-project duplicates in the
main loop — they are exactly what a per-project agent cannot see.

## Step 2: Read the dream

`references/rubric.md` § "Dream candidates" says how each candidate maps to
an action. The short form: the dream's `confidence` was written so that this
skill can trust it — `high` means the user said it in so many words or it
recurred across sessions; `medium` is one clear instance; `low` is inferred.
`status: updates <name>` names the saved memory the candidate supersedes.
Open the named memory before acting; the dream was written from a digest
and can be a day behind an edit made in the same session.

Do not re-read the transcripts or digests. The dream already did, and its
evidence lines carry the quotes. If a candidate's evidence is too thin to act
on, that is a flag, not a research task.

## Step 3: The memory bank

Work project by project. For each, the rubric decides; the outline is:

1. **Duplicates.** Two files stating one fact become one file. Keep the name
   with the most incoming `[[links]]` and index entries, carry over anything
   the other said that this one did not, and delete the other only after
   every link and index line points at the survivor. A copy that differs
   only in the project name (one memory pasted into a sibling project's
   directory) is a duplicate *across* projects and is flagged, not merged —
   the projects may have diverged since.
2. **Contradictions.** Two live memories that cannot both be followed, or a
   dream candidate that reverses a saved one. The newer, dated statement in
   the user's own words wins. The loser is not deleted: it is rewritten into
   the winner as a "superseded" paragraph (date, what changed, why), so the
   history that explains the rule survives in one place instead of two files
   that disagree. When neither side is dated, or both are Claude's inference,
   flag it with both sides quoted.
3. **Promotions.** High-confidence dream candidates become memory files in the
   memory system's own format (frontmatter `name`, `description`, `metadata.type`;
   body with the fact, **Why:** and **How to apply:**; `[[links]]` to related
   memories). A `global` candidate is written into the memory of every
   project its evidence names, and additionally proposed as a user-level rule
   file (see Step 4). Medium and low candidates are flagged with the memory
   file already drafted in the overview, so ticking is all the user does.
4. **Index.** Every memory file has exactly one `MEMORY.md` line; every line
   points at a file that exists; the hook after the dash says what the memory
   decides, not what it is about. Keep each index under about 24 KB — it is
   loaded into every session of that project — and when one is over, the
   cut is finished campaigns and task-state cards, never rules. Cutting an entry is flagged unless the file
   itself says the work is done.

Every applied change is recorded in the overview with the file path and a
one-line diff summary, because the user reads the overview instead of the
memory directory.

Write memory files and the overview with the file-writing tool, not shell
heredocs: on Windows, Git Bash heredocs mangle unicode (the index's em
dashes, `→`, `×`) and fail outright on long bodies. The file-writing tool refuses to
overwrite a file it has not read through the file-reading tool, so read
`MEMORY.md` that way before rewriting it, even if the inventory already
showed its contents.

## Step 4: Instruction files

`references/instruction-files.md` is the target structure and the migration
procedure. The shape, in one paragraph: `CLAUDE.md` is a crib sheet — one
trigger line per rule plus a pointer to the file that holds the detail.
Detail that must be in every session's context is `@imported`; evidence,
adjudication trails and worked examples live in an archive file that is
only read on demand. A rule that applies to one part of the project goes in
`.claude/rules/<area>.md` with a `paths:` glob, so it loads only when Claude
is reading files under that path. Personal, cross-project rules go in
`~/.claude/rules/<topic>.md`, pointed at from `~/.claude/CLAUDE.md`.

For every project whose instruction files the inventory found, decide
whether they already have this shape. If not, or if the pass produced new
rules for it, write the proposal set under `proposals/<project>/` mirroring
the repo paths, and a `FIDELITY.md` beside it that lists every heading and
rule of the original and where it went — kept, moved to which file, or
dropped with the reason. The user's standing concern is losing fidelity in a
rewrite; the ledger is how he checks without reading both files end to end.

Proposals are always flagged. Never write into a repository.

## Step 5: Write the overview

Use the exact template in `references/overview-template.md`. Write it to
`~/.claude/improve-memory/Memory Improvement Overview.md`, copy it to
`history/<YYYY-MM-DD-HHMM>.md`, and update `state.json` (`runs`, `lastRunAt`,
`lastDreamConsumed`). Flagged items that were in the previous overview and
were neither ticked nor obsoleted are carried forward with their original
IDs and the run they first appeared in, so the user sees what has been
waiting; after three runs unticked they move to a "Dropped" list, one line
each, and stop being re-proposed.

Then reply with the status line from the template — four lines, no overview
pasted into chat, no question.

## `apply`

Read the standing overview. Every flagged item has an ID (`F1`, `F2`, …), a
checkbox, and an action block precise enough to execute without judgement:
the target path, and either the full file content or an exact old/new pair.
For each ticked item:

- Memory-bank items: apply as written.
- Instruction-file items: the proposal recorded the target's SHA-256 at
  proposal time. If the target still matches, copy the proposal over it. If
  it has changed since, do not overwrite — leave the item flagged with a note
  that the target moved, so the next pass re-proposes against the current
  file.
- Move the item into the overview's "Applied" section with the date, and
  leave the unticked ones where they are.

`apply` is the only path by which this skill writes into a repository, and
only because the user ticked the box.

## Files in this skill

- `scripts/inventory.mjs` — the extractor. `--help` lists options.
- `references/rubric.md` — auto-apply versus flag, per situation; how to
  merge, how to resolve, how to write a promoted memory.
- `references/instruction-files.md` — the target CLAUDE.md shape, the
  rules-file mechanism, and the migration procedure with the fidelity ledger.
- `references/overview-template.md` — the exact output file and status line.
- `evals/` — test prompts and the fixture home tree they run against.
