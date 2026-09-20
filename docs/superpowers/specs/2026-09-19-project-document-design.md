---
kind: design
status: draft
subsystems: [documentation]
ticket: 136
---
# One project document, composed from the slip box

**Status:** design approved in conversation (Gabe, 2026-09-19). Not built.
**Builds on:** #132 (Move dictations to Zettelkasten notes) — the slip box is the substrate this reads.
**Why:** the slip box's per-subsystem pages read as disparate fragments. The goal was one cohesive set of documentation for the project.

## The goal, in the owner's words

- "one document that flows from spec to design to implementation with links to the decisions that went into the final form of each fact"
- "at the end of the project i'm picturing the zettelkasten results in what looks like nearly a full waterfall design, obviously slightly different"
- On keeping per-subsystem pages: "You wouldn't use the car's user manual to learn how to fix something, you'd buy a repair guide."

## What is generated

- `docs/PROJECT.md` — the manual. The whole project in waterfall order. Read to understand the system.
- `docs/subsystem/<name>.md` — the repair guide. One subsystem, same order, nothing from other subsystems. Read before working in that part, so an agent's context stays small.
- `docs/dictated-specs/INDEX.md` — unchanged, listing both.
- Retired: `docs/spec-current/<name>.md`. The repair guide replaces it, with the flow and the citations added.

## What they are made of

Two layers. There is no third.

- **Specified** — the owner's dictation notes and owner notes in force for that subsystem, in capture order. The framing the owner dictates (scope, goals, non-functional requirements) opens the manual.
- **Decided** — decision notes in force, each showing the dictations it rests on, plus the decision headings of approved design notes.

- A superseded note never appears. Its successor does; the chain is reachable from the note.
- A layer with nothing in it says so. Silence would read as "nothing was decided", which is a different claim.
- A note listing two subsystems appears in both repair guides and once in the manual.

## Why there is no implementation layer

- Ruled by the owner, 2026-09-19: "maybe implementation isn't even a thing then because everything in essence is a spec or design decision".
- Tested against the three things it would have carried:
  - a detail decided late to finish — that is a decision, and belongs in Decided;
  - an operational consequence — that belongs in the decision that caused it;
  - an assumption that proved wrong — that is evidence for a decision, and machinery already records it on the ticket.
- Consequence for decision notes: **a decision note states its consequences.** A decision that does not is under-written.
- Rejected on the way: a fifth note kind for implementation notes; evidence globs over tests and invariants; a gate leg re-matching test names on every commit.

## Where a fact lives in the code

- **The code cites the decision, not the reverse.** A marker in a comment: `spec:<note-id>`.
  - Rust: `// spec:0011-config-overrides`
  - Python: `# spec:2026-09-07T21-56-14Z`
  - Any note id: a decision, a dictation, an owner note.
- `regen` scans the repository for markers and lists, under each note, the files carrying one.
- **File paths only, never line numbers.** Editing inside a file changes nothing. Only moving a marker between files does.
- Sorted and deduplicated: one file carrying three markers for one note appears once.
- Under each note the document says "marked in: N files". A note with none says so, which reads as "nobody has pointed at this in the code yet", not "this is not implemented".

### Why this direction

- A pointer from the document into code is a pointer at a moving target: every file move needs an edit.
- A marker in the code travels with the code. Renames, moves and splits need no edit at all.
- Rejected explicitly by the owner: citations stored in the document ("then no citations to code locations… it's so much work to handle citations").

### What it costs

- Markers live in product source. Machinery's rule that citations belong in specs and research documents, never in product source, is about quoting other projects' code; the owner accepted this adjacent case.
- Coverage is whatever people mark, so the document reports partial coverage as partial.
- Moving a marked file changes the generated document, so that commit runs `regen` too. Editing inside the file costs nothing.
- The marker proves the location, never that the code there still matches the decision. Nothing cheap proves that, and the document says so.

## What the gate checks

Extensions of legs that already exist — no new failure modes:

- A marker naming a note that does not exist refuses the commit, naming the file (the link leg).
- `docs/PROJECT.md` and every `docs/subsystem/<name>.md` must equal a fresh render, scan included (the freshness leg).
- Everything the slip box already refuses is unchanged.

## Attribution

- Every sentence in the document is the owner's dictation, an owner note transcribed from the owner's own file, or a decision the owner approved.
- No sentence is written by an assistant.
- An owner note is marked as transcribed rather than captured, because nothing proves it.

## Open, to settle before building

- What defines the subsystem set, and whether the manual's subsystem order is declared or alphabetical.
- Whether the framing dictations are recognised by a subsystem name (say `project`) or by a marker of their own.
- Whether `docs/subsystem/` is the right location, given `docs/dictated-specs/structure/` already holds the per-subsystem source.
- Whether a decision note's consequences need their own heading, so the document can show them separately.

## Tests the build will need

- A dictation, a decision and an owner note compose into both views, in the right layers and the right order.
- A superseded note appears in neither view; its successor appears in both.
- An empty layer is named as empty rather than omitted.
- A marker naming an unknown note refuses the commit and names the file.
- Moving a marked file makes both views stale, and `regen` restores them.
- Editing inside a marked file changes neither view.
- A note listing two subsystems appears in both repair guides and once in the manual.

## Glossary

- **decision note** — an ADR in the slip box: what was decided, why, and what it costs. Immutable once filed.
- **dictation note** — the owner's words, captured verbatim through the `SPEC:` marker and proven against the inbox.
- **manual** — `docs/PROJECT.md`, the whole project in waterfall order.
- **marker** — `spec:<note-id>` in a source comment. The code's citation of a note.
- **owner note** — the owner's ruling transcribed from an old file rather than captured. Trusted, not proven.
- **repair guide** — `docs/subsystem/<name>.md`, one subsystem's flow, for working in that part.
- **slip box** — the notes under `docs/dictated-specs/`, the substrate both views read.
