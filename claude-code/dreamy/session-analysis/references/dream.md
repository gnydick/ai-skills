# dream — consolidation pass

## Purpose

Sleep consolidates: the day's episodes get replayed, the ones that generalize
are kept, the rest fade. This subcommand does that for Claude Code sessions.
It reads the digest of sessions since the last run and writes an overview of
the moments worth promoting into the long-term memory bank — the per-project
`memory/` directories under `~/.claude/projects` that Claude loads at the
start of every session.

The output is a file, not a conversation. It proposes; it does not write
memories. A downstream skill (the user's planned `/improve-memory`) or the
user reads the file and decides what to apply. So this pass must never
create, edit, or delete memory files, and must never stop to ask what to do
with a candidate — the rubric decides, and anything the rubric cannot decide
is recorded as such in the file.

## Rubric: what is worth keeping

Long-term memory is expensive in the only currency that matters here: it is
loaded into every future session's context. So the bar is not "interesting"
but "future sessions will go wrong or waste time without it." Sort candidates
into the four types the memory system already uses, because the type tells
the reader how to apply the memory:

- **feedback** — the user corrected Claude, or confirmed an approach after
  Claude asked. Strongest signals in the digest: a turn marked
  `⚑interrupted` followed by a prompt that redirects; a `(queued)` prompt;
  prompts opening with "no", "don't", "stop", "not that", "I said", "again";
  words like "always", "never", "from now on", "hard rule"; the same
  correction appearing in more than one session. Capture the rule *and* the
  why, in the user's own terms where the digest shows them.
- **user** — who the user is: expertise, tooling, environment, working
  style, how they like to be talked to. Only when it surfaced from the
  user's own words or repeated behaviour, not from Claude's inference.
- **project** — goals, constraints, decisions and their reasons, cancelled
  directions, environment gotchas (build configs, tool quirks, paths) that
  cost more than one turn to discover. Not the code structure or git history
  — those are readable from the repo. Convert relative dates to absolute.
  Gotchas rarely appear in the user's words; look for turns with
  `errors×N` in the tool tally and the `~` narration lines under them,
  where the assistant admits what failed and what it did instead. A gotcha
  that recurs across sessions is worth more than one that was hit once.
- **reference** — URLs, issue and PR numbers, dashboards, external docs the
  user pointed at or that unblocked something.

Three tests every candidate must pass:

1. **Would a future session re-derive this the hard way?** A fact that took
   several turns, a failed attempt, or an interrupt to establish passes. A
   fact read from a file in one tool call does not.
2. **Is it stable?** It must still be true next month. Task state ("the
   branch is mid-rebase") is not a memory; the reason a branch exists might
   be.
3. **Is it new?** Check the `Existing long-term memories` block at the top
   of the digest. If a saved memory already covers it, drop it — or, if the
   session shows the saved memory is now wrong or superseded, record it
   under "Superseded or contradicted" naming the memory it affects.

Things that never qualify: what the assistant said it did (unless the user
confirmed it), one-off numbers, anything the repo's CLAUDE.md or code already
records, and the session's own narrative ("we then tried X").

Compaction summaries deserve extra weight. They are Claude's own distillation
of a long session, written under pressure to keep only what mattered, and
they often name decisions and constraints explicitly.

## Per-chunk subagent prompt

When Step 1 split the digest, hand each chunk to one subagent with this
prompt, filling in the paths. Run them in parallel.

```
Read <skill-dir>/references/dream.md first — it is the rubric.
Then read the session digest at <chunk-path> in full.

Extract every candidate long-term memory that passes the rubric's three
tests. Return ONLY a list in this exact format, one block per candidate,
strongest first, at most 25:

### <kebab-case-name>
- type: user | feedback | project | reference
- project: <project name from the digest header, or "global" if it applies everywhere>
- summary: <one sentence: the fact or rule>
- why: <one sentence: why future sessions need it>
- evidence: <session title> (<date>) — <a short quote or paraphrase of the user's words>
- status: new | updates <existing-memory-name>
- confidence: high | medium | low

Do not write any files. Do not propose anything already listed under
"Existing long-term memories" unless the sessions show it changed.
```

## Merging chunk results

Chunks overlap in what they see (a rule stated in one project is often
restated in another), so merge before ranking:

- Combine candidates that state the same rule; keep the strongest evidence
  from each and mark the project as `global` when it appeared in more than
  one.
- Prefer the candidate whose wording is closest to the user's own.
- Rank by evidence strength: an explicit rule in the user's words beats a
  repeated pattern beats a single inferred preference. Interrupts, queued
  corrections and repeats across sessions are the strongest signals.
- Cap the numbered list at 20 candidates, hard. The consumer of this file
  applies the obvious ones and flags the rest; a 35-item list makes every
  item look optional. When the chunks hand back more than 20, keep the ones
  with the strongest evidence and put the rest in the "also seen" list as
  one half-line each, so nothing is silently lost but the decision stays
  small. An update to an existing memory counts toward the 20.
- `confidence` is what lets a downstream consumer auto-approve: `high`
  means the user said it in so many words or it recurred across sessions;
  `medium` means one clear instance; `low` means inferred from behaviour.
  Be honest here — a wrong `high` gets written into memory unread.

## Output file

Write the overview to `~/.claude/session-analysis/dream/<YYYY-MM-DD-HHMM>.md`
(local time, the time the run started) and copy it to `latest.md` in the
same directory. Create the directory if it does not exist. Use this exact
structure so a consumer can parse it:

```
---
skill: session-analysis
subcommand: dream
run_at: <ISO timestamp>
window: <since> → <until>
sessions: <N>
projects: <M>
candidates: <count in the numbered list>
existing_memories_checked: <total>
---

# Dream — <window>, <N> sessions across <M> projects

<two or three sentences: what the window covered, anything about scope the
consumer should know — a sibling project excluded, a session counted twice
because it was resumed, a project with no memory directory yet.>

## Feedback (rules and corrections)
1. **<name>** [<type> · <project> · <confidence> · new | updates <name>]
   <the rule, one or two sentences>
   _Why:_ <reason>
   _Seen:_ <session title> (<date>), "<quote>"
...

## User
...

## Project
(group by project; give the memory directory path once per group)
...

## Reference
...

## Superseded or contradicted
- **<existing memory name>** (<project>) — <what the sessions show changed, and which candidate above replaces it>

## Needs a decision
- <anything the rubric could not settle: two sessions that contradict each
  other, a rule the user stated and later seemed to reverse. State both
  sides with evidence; do not pick.>

## Also seen, weaker
- <name>: <half-line>
```

"Also seen" is a safety net, not a second report: at most 15 entries, one
line each. If a chunk returned 100 candidates, most belong nowhere in the
file — the digest is still on disk if anyone wants to dig.

If a section has no candidates, omit it. If the whole window has nothing
worth keeping, still write the file with `candidates: 0` and a sentence
naming the sessions read — an empty result is a valid result, and a padded
one poisons the memory bank.

## Status line

After the file is written and the run is marked, reply with three or four
lines and nothing else:

```
Dream pass done: <N> sessions across <M> projects, <window>.
<count> candidates (<h> high, <m> medium, <l> low), <s> existing memories superseded, <d> need a decision.
Written to ~/.claude/session-analysis/dream/<file>.md (also latest.md).
```

Do not paste the overview into the chat. Do not ask what to do next.
