---
kind: design
status: draft
subsystems: [documentation]
ticket: 136
---
# One project document, composed from the slip box

**Status:** design approved in conversation (Gabe, 2026-09-19), revised 2026-09-20 to the waterfall organisation and approved for build the same day. Not built.
**Builds on:** #132 (Move dictations to Zettelkasten notes) — the slip box is the substrate this reads.
**Why:** the slip box's per-subsystem pages read as disparate fragments. The goal was one cohesive set of documentation for the project.

## The goal, in the owner's words

- "one document that flows from spec to design to implementation with links to the decisions that went into the final form of each fact"
- "at the end of the project i'm picturing the zettelkasten results in what looks like nearly a full waterfall design, obviously slightly different"
- On keeping per-subsystem pages: "You wouldn't use the car's user manual to learn how to fix something, you'd buy a repair guide."
- On the manual's order (2026-09-20): "dependency order"
- On location (2026-09-20): "location: docs/zk"
- On framing (2026-09-20): "framing seems very specialized and not intuintive to discern while working. i would expect SPEC to cover both and up to agent to determine where it goes"
- On the shape of this revision (2026-09-20): "reconsider this effort in terms of what the waterfall organization of the docs looks like. i feel like i'm answering too many questions"

## What a waterfall document is

- A waterfall document set is one document per phase, in phase order.
- The phases: system specification, requirements specification, design specification, traceability.
- Each phase traces to the one before it. Design cites requirements; code cites design.
- The system specification sits **above** the subsystem specifications, not among them. It is scope, goals and constraints for the whole thing.
- Order inside a phase is dependency order: what others rest on is stated first.
- Order **between** phases is fixed. It is never dependency order.
- There are no back-edges. A waterfall document asserts a chain, so a cycle in it is a defect in the record.

## The manual's sections

- `docs/zk/PROJECT.md` has four sections, in this order.
- **§ 1 System specification** — the framing notes. Scope, goals, non-functional requirements.
- **§ 2 Specified** — every other subsystem's notes in force, subsystems in dependency order.
- **§ 3 Decided** — decision notes in force and approved design notes' headings, subsystems in the same order.
- **§ 4 Traceability** — each note, and the files whose code cites it.
- The manual is phase-major. All of Specified, then all of Decided. This is the owner's "flows from spec to design" read literally.

## The two views

- The manual is `docs/zk/PROJECT.md`. Read to understand the system.
- A repair guide is `docs/zk/<subsystem>.md`. Read before working in that part, so an agent's context stays small.
- **A repair guide is the manual filtered to one subsystem.** One renderer, one filter. They cannot disagree.
- A repair guide has the same four sections, and no § 1 unless it is the framing subsystem's own guide.
- A superseded note never appears. Its successor does; the chain is reachable from the note.
- A layer with nothing in it says so. Silence would read as "nothing was decided", which is a different claim.
- A note listing two subsystems appears in both repair guides and once in the manual.

## Framing: where it lands, and how it is recognised

- Framing is recognised by **the subsystem the assistant filed the note under**, chosen under #132's D5.
- `SPEC:` covers framing and subsystem work alike. Nothing about capture changes.
- The framing subsystem is a reserved name: `system`.
- **The reserved name may not be `project`.** `docs/zk/PROJECT.md` and `docs/zk/project.md` are one file on Windows (measured 2026-09-20).
- The manual **hoists** the framing subsystem's notes to § 1, and § 2 skips that subsystem.
- Hoisting is the only special case, and it is waterfall's own: the system specification sits above the subsystem specifications.
- Decisions filed under the framing subsystem are **not** hoisted. They are design-phase material and belong in § 3, first in the order.
- `docs/zk/system.md` exists like any other repair guide. No exception.
- `checkSubsystem` refuses a subsystem name that matches the manual's basename case-insensitively. It is the entry point that already refuses names Windows cannot create.

## Dependency order

- The edge: **subsystem A precedes subsystem B when a decision note in B has `rests_on` naming a dictation note in A**, and A is not B.
- `rests_on` is waterfall's design→requirement trace. It is the only dependency the slip box records, and the gate already checks it.
- `supersedes` is succession, not dependency. `subsystems` is membership, not dependency. Neither becomes an edge.
- No new field is declared. No `[[link]]` becomes an edge.
- The order: condense strongly connected components, topologically sort the condensation, break every tie by the subsystem's birth stamp, then by subsystem name.
- **A subsystem's birth stamp is the earliest capture stamp of any note ever filed under it, superseded notes included.** It never changes once the subsystem exists, so a revision never moves a subsystem. Only a `rests_on` edge does.
- The order is total and deterministic. The freshness leg requires that.
- An owner note carries no stamp. A subsystem whose notes are all owner notes has no birth stamp and sorts after every subsystem that has one, by name.
- The framing subsystem is not in the graph. It is § 1.
- **Where no edge exists, the whole set is one tie and the order is birth-stamp order.** Nothing is undefined and nothing is asked of the owner.
- Measured: the trial corpus yields zero edges, so the manual there orders by birth stamp.

## A cycle

- A cycle is rendered, never refused.
- Its members are ordered among themselves by the tiebreak.
- A generated line at that point in the manual names the members of the cycle.
- Reason: waterfall has no back-edges, so a cycle is a defect in the record, and the document's job is to report the record as it is.
- Reason it is not a commit refusal: a new failure mode was excluded, and a cycle is curable only by writing another decision note, which a refusal would block.
- This is the same stance the design already takes on an empty layer and on partial marker coverage.

## Decided, and consequences

- **`## Consequences` is structure, not body.**
- § 3 renders each decision note as: its title, the dictations it rests on as links, its `## Decision`, its `## Consequences`.
- Both are embedded by heading. That is #132's D9 mechanism, unchanged: a file too detailed to embed whole is embedded by named heading.
- `## Context` is linked, not embedded. It is rationale, and the structure note's "Why it is this way" already links the decision.
- A decision note with no `## Consequences` renders with a generated line saying its consequences are unstated.
- `intake.mjs decision --file` refuses a decision note with no `## Consequences` heading. It is the entry point that already refuses one with no `kind: decision` and no subsystems.
- That refusal is at filing time, not at commit time. No gate leg is added.
- A decision that does not state its consequences is under-written. This is why.

## Why there is no implementation layer

- Ruled by the owner, 2026-09-19: "maybe implementation isn't even a thing then because everything in essence is a spec or design decision".
- Tested against the three things it would have carried:
  - a detail decided late to finish — that is a decision, and belongs in Decided;
  - an operational consequence — that belongs in the decision that caused it;
  - an assumption that proved wrong — that is evidence for a decision, and machinery already records it on the ticket.
- Waterfall agrees: the phase after design is traceability, which is § 4, not a fourth layer of prose.
- Rejected on the way: a fifth note kind for implementation notes; evidence globs over tests and invariants; a gate leg re-matching test names on every commit.

## § 4 Traceability: where a fact lives in the code

- **The code cites the decision, not the reverse.** A marker in a comment: `spec:<note-id>`.
  - Rust: `// spec:0011-config-overrides`
  - Python: `# spec:2026-09-07T21-56-14Z`
  - Any note id: a decision, a dictation, an owner note.
- `regen` scans the repository for markers and lists, under each note, the files carrying one.
- **File paths only, never line numbers.** Editing inside a file changes nothing. Only moving a marker between files does.
- Sorted and deduplicated: one file carrying three markers for one note appears once.
- A note with no marker is listed as unmarked. Omitting it would read as "this note has no code", which is a different claim.
- "marked in: N files" reads as "nobody has pointed at this in the code yet", not "this is not implemented".

### Why this direction

- A pointer from the document into code is a pointer at a moving target: every file move needs an edit.
- A marker in the code travels with the code. Renames, moves and splits need no edit at all.
- Rejected explicitly by the owner: citations stored in the document ("then no citations to code locations… it's so much work to handle citations").

### What it costs

- Markers live in product source. Machinery's rule that citations belong in specs and research documents, never in product source, is about quoting other projects' code; the owner accepted this adjacent case.
- Coverage is whatever people mark, so the document reports partial coverage as partial.
- Moving a marked file changes the generated document, so that commit runs `regen` too. Editing inside the file costs nothing.
- The marker proves the location, never that the code there still matches the decision. Nothing cheap proves that, and the document says so.

## File layout

- `docs/zk/PROJECT.md` — the manual.
- `docs/zk/<subsystem>.md` — one repair guide per subsystem, `docs/zk/system.md` included.
- `docs/dictated-specs/` — unchanged. `notes/`, `structure/`, `decisions/`, `INDEX.md`. It stays the source.
- `docs/dictated-specs/INDEX.md` — regenerated, linking the manual and every repair guide.
- `docs/spec-current/` — **deleted.** Not left stale.

## What changes in the code

- `layout.mjs`: `CURRENT_DIR = 'spec-current'` becomes `ZK_DIR = 'zk'`; `slipboxPaths` returns it.
- `layout.mjs`: `checkSubsystem` also refuses a name colliding with the manual's basename, case-insensitively.
- `slipbox.mjs`: `renderIndex` links `../zk/` and the manual.
- `slipbox.mjs`: `regenerate` emits the manual plus one page per subsystem; `staleGenerated` sweeps `docs/zk`.
- `slipbox-file.mjs`: `fileDecision` requires a `## Consequences` heading.
- The migration deletes `docs/spec-current/` once.

## What the gate checks

Extensions of legs that already exist — no new failure modes:

- A marker naming a note that does not exist refuses the commit, naming the file (leg 4b, already shipped).
- `docs/zk/PROJECT.md` and every `docs/zk/<name>.md` must equal a fresh render, scan included (leg 5).
- A file left under `docs/zk` with no structure note behind it refuses the commit (leg 5's orphan sweep).
- Everything the slip box already refuses is unchanged.

## Attribution

- Every sentence in the document is the owner's dictation, an owner note transcribed from the owner's own file, or a decision the owner approved.
- No sentence is written by an assistant.
- A **generated label** is not a sentence: `*Source: …*`, "marked in: N files", "nothing is in force here", "these subsystems depend on each other". These are the renderer speaking about the record, never about the subject.
- An owner note is marked as transcribed rather than captured, because nothing proves it.

## Measured on the trial corpus

Measured 2026-09-20 against `K:\ferrislicer-zettel-copy`, through this repository's own read model.

- 26 notes under `notes/`: 14 dictation, 12 owner. 5 structure notes. 12 ADR files, `0001`–`0012`.
- 216 notes load in total: the 26, plus 12 decisions, 93 design notes and 85 plans from `docs/superpowers/`.
- All 12 ADRs carry exactly `## Context`, `## Decision`, `## Consequences`. `decisions/README.md` is the 13th file in that directory and is not a decision note — `ADR_FILE` excludes it.
- **0 notes carry `rests_on`.** The dependency graph has no edges.
- **0 notes carry `kind: decision` front matter.** `expected().decisions` is 0 for all 5 subsystems, so § 3 renders empty.
- All 93 design notes are `historical` and none carries `subsystems`. `expected().designs` is 0 for all 5 subsystems.
- **0 markers** match the marker regex in the checkout. § 4 renders empty.
- 0 notes belong to more than one subsystem.
- Birth-stamp order of the 5 subsystems: `by-object-collision-model`, `grouped-object-addressing-and-overrides`, `reactive-gui-and-config-dependency-propagation`, `extruder-ownership-and-assignment`, `infill-classification-and-pattern-selection`.
- Embedding ADRs by heading costs 1155 lines against 1764 whole. `0008`'s `## Decision` alone is 422 lines — an over-written ADR, which the renderer does not fix.
- **The empty § 3 is a #132 migration gap, not a flaw in this design.** The migration moved ADRs into `decisions/` without front matter. It has its own ticket.

## Assumptions — accepted by the owner, 2026-09-20

- **A1** — the reserved framing subsystem is named `system`; derivation fixes only that it cannot be `project`.
- **A2** — the ordering tiebreak is the subsystem's birth stamp (earliest ever, superseded included), then subsystem name; the alternative was a declared order in project config.
- **A3** — § 3 links `## Context` rather than embedding it, at a saving of 256 lines.

## Tests the build will need

- A dictation, a decision and an owner note compose into both views, in the right sections and the right order.
- A superseded note appears in neither view; its successor appears in both.
- An empty layer is named as empty rather than omitted.
- A marker naming an unknown note refuses the commit and names the file.
- Moving a marked file makes both views stale, and `regen` restores them.
- Editing inside a marked file changes neither view.
- A note listing two subsystems appears in both repair guides and once in the manual.
- A decision in B resting on a dictation in A puts A before B in the manual.
- Two subsystems with no edge between them are ordered by birth stamp, then by name.
- Superseding a subsystem's first note does not move that subsystem in the manual.
- A subsystem whose only notes are owner notes sorts after every subsystem with a stamped note.
- A cycle of two subsystems renders both, in tiebreak order, under a generated line naming the cycle, and refuses nothing.
- A note filed under the framing subsystem opens the manual and does not appear in § 2.
- A decision filed under the framing subsystem appears in § 3, not in § 1.
- A subsystem named so as to collide with the manual's basename is refused before anything is written.
- A decision note's `## Consequences` renders as its own part of § 3; a decision note without one renders with its consequences named as unstated.
- Filing a decision note with no `## Consequences` is refused by `intake.mjs decision --file`.
- A repair guide equals the manual filtered to that subsystem.
- A leftover file under `docs/zk` with no structure note behind it refuses the commit.
- After migration, `docs/spec-current/` does not exist.

## Glossary

- **birth stamp** — a subsystem's earliest capture stamp ever, superseded notes included. It is the tiebreak, and it is fixed, so revising a subsystem never moves it.
- **cycle** — two subsystems that each rest on the other. It has no order, so the manual names it and orders its members by the tiebreak.
- **decision note** — an ADR in the slip box: what was decided, why, and what it costs. Immutable once filed. Supplies § 3.
- **dictation note** — the owner's words, captured verbatim through the `SPEC:` marker and proven against the inbox. Supplies § 1 and § 2.
- **framing subsystem** — the reserved subsystem `system`, whose notes are hoisted to § 1. It is how the manual knows what is scope rather than a part.
- **manual** — `docs/zk/PROJECT.md`, the whole project in the four waterfall sections.
- **marker** — `spec:<note-id>` in a source comment. The code's citation of a note. It is what § 4 is built from.
- **owner note** — the owner's ruling transcribed from an old file rather than captured. Trusted, not proven. Carries no capture stamp, which is why it sorts last.
- **phase-major** — all of Specified before any of Decided. It is what makes the document read as a flow rather than as per-subsystem chapters.
- **repair guide** — `docs/zk/<subsystem>.md`, the manual filtered to one subsystem, so an agent's context stays small.
- **rests_on** — a decision note's list of the dictation notes it came from. Aggregated to subsystems, it is the only dependency edge the manual sorts by.
- **slip box** — the notes under `docs/dictated-specs/`, the substrate both views read.
- **strongly connected component** — the set of subsystems that all reach each other. Condensing it is what lets a graph with a cycle still be sorted.
- **traceability** — § 4: note to the files whose code cites it. It is waterfall's last phase, and it replaces the implementation layer this design does not have.
