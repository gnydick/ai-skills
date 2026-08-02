# developer-friendliness — design

Date: 2026-08-02
Status: approved, pre-draft
Bucket: `pure-prose` (no tool names, no scripts, no harness assumptions)

## What it is

The third skill in the `unbreakable` set. It governs everything the assistant
produces that has to outlive the conversation: what gets filed, written down,
reported, and left behind at a session boundary.

It is **not** about the ergonomics of the code being shipped. The name reads
that way and will be misread that way; the frontmatter `description` carries the
disambiguation, because the description is what triggers the skill.

## Place in the set

| Skill | Governs | Rule |
|---|---|---|
| `cant-break-by-design` | invariants | the wrong path is impossible |
| `be-reasonable` | every non-invariant choice | the chosen path is derived |
| `developer-friendliness` | the record of the work | the developer never has to hold what could have been parked |

## Spine

The assistant changes a project faster than the person accountable for it can
track. Everything learned, decided, deferred, or broken exists first only in a
conversation that is about to end. The gap between what happened and what anyone
can account for widens with throughput — so the discipline scales with exactly
the property that makes the assistant valuable, which is why it cannot be left
to whoever remembers.

**The test:** *"If this session ended right now, what would have to be
reconstructed, and by whom?"*

## The governing tension

Budget is not a domain of this skill. It is the **governor on its
implementation**: the record is paid for out of the same budget as the work.

Both failures are fatal and opposite:

- **Under-recorded** — the thing is re-derived at full cost, or lost outright.
- **Over-recorded** — a tracker nobody triages, a notes file nobody opens, a
  status update per step. This one *feels like diligence*, which is why it
  survives, and it fails silently because nobody announces that they stopped
  reading.

A skill that warns only against under-recording reliably produces a bureaucrat.
Both directions get equal force, via the under/feels-like/over catalogue that
`be-reasonable` §5 uses.

## The filter

Three questions, in order, on anything worth keeping:

1. **Will someone need this again?** If not, say it and let it go. The signal is
   that it cost something to obtain and is not visible from the artifact.
2. **Where will they look?** The place this project already uses for this kind
   of thing. Inventing a second place is worse than not writing it: a split
   record is not trusted, and an untrusted record is not read.
3. **Is writing it cheaper than reconstructing it?** The budget question in
   local form.

## The durability ladder

| Rung | Where the fact lives | Lost when |
|---|---|---|
| 0 | the assistant's working context | the session ends |
| 1 | a message the developer read | they close the window |
| 2 | a review thread | the branch merges |
| 3 | a marker in the code | nobody searches for it; it ages into scenery |
| 4 | a commit message | only found by someone already digging |
| 5 | the project's work tracker | needs triage, but it is on the list |
| 6 | a document in the repo | found by anyone reading the repo |
| 7 | the conventions loaded every session | read without anyone choosing to |
| 8 | encoded in the code or the build | not a note — a mechanism |

Two things must be said about it explicitly:

- **Unlike the enforcement ladder, higher is not automatically better.** The rule
  is the lowest rung that survives the reader's absence. A one-off observation
  parked at rung 7 taxes every future session.
- **Rung 8 is the handoff to `cant-break-by-design`** — the best note is the one
  that was never needed, because the situation was made impossible instead.

## Domains

Each gets the house-style `| Choice | Derived answer | The asymmetry |` table.

1. **Deferred work** — found and not fixed; filed before moving on
2. **Learnings** — what surprised you or cost a command to discover
3. **Decisions** — the choice, its derivation, the rejected alternative
4. **Session continuity** — in flight, half-done, broken right now
5. **Keeping the record true** — doc drift, commit messages, stale entries
6. **No surprises** — scope cut, steps skipped, things that could not be done

## Tripwires

- **Re-deriving something known in an earlier session** → the note should have
  existed. Write it now, then continue.
- **Writing a record without being able to name its reader** → stop.

## Borrowed structure from `be-reasonable`

- The report and the record are **two masters** (§1.3): a message is read once,
  now, by someone with context; a record is read later, cold, by someone
  without. One artifact cannot serve both.
- **Say the residue** (§7.7) is the decision-recording rule, already stated
  there; cite rather than restate.
- **§6.7 context budget** supplies the governor. Cite, do not restate.

## Known overlap, deferred

`be-reasonable` §6.7 contains the row *"Durable decisions and conventions |
written into a project document | conversation is not memory; documents are"*
and the operational-tooling handoff. The working split: `be-reasonable` owns
*choosing where a decision lives*; `developer-friendliness` owns *the practice
of keeping the record*. Whether to extract or leave as-is is deferred by
agreement.

## Shape

Matches the house form: pushy enumerated frontmatter description → imperative
preamble ending "The full reference follows." → definition and one-sentence test
→ "why this is a skill and not a courtesy" → the gap → the filter → the ladder →
paying for it → domain tables → failure catalogue → the process → the
one-paragraph form. Target 400–500 lines.

## Boundary clause

Closing line, matching the pattern in both siblings: this governs the record,
never the work. It is not a reason to go slower, and never a substitute for
making the problem impossible.