---
name: session-analysis
description: Analyze the user's own Claude Code conversation history — the JSONL session transcripts Claude Code saves under ~/.claude/projects — driven by a subcommand argument, autonomously and without asking questions. `dream` reads the sessions since its last run and writes an overview of which lessons, preferences, corrections and project facts deserve promotion into the long-term memory bank, as a file a downstream skill such as /improve-memory can consume. Use this whenever the user runs /session-analysis, schedules or loops it, asks what they should remember from recent sessions, wants a memory consolidation or "dream" pass, asks "what did I learn / decide / keep correcting this week", or wants any cross-session analysis of their history (time spent, recurring patterns, which projects got attention) — even when they do not name the skill or mention transcripts.
---

# Session analysis

This skill is a dispatcher over the user's session history. The first word of
the argument names a subcommand; everything after it is options. Each
subcommand has its own reference file that says what to look for and what to
write. The transcript extraction is shared, so new subcommands only have to
describe an analysis, not re-learn the transcript format.

```
/session-analysis <subcommand> [--since last|14d|7d|all|<ISO date>] [--project <substring>]...
```

| Subcommand | What it does | Read |
|---|---|---|
| `dream` | Consolidation pass: which moments in the sessions since the last run are worth keeping as long-term memories | `references/dream.md` |

An argument that matches no row in this table is not a request to improvise.
Reply with the table above, say the subcommand does not exist yet, and stop.
The user is building this skill up incrementally and would rather add the
subcommand properly than get a guess dressed up as an analysis. A missing
argument gets the same reply.

## This skill runs unattended

It is meant for continuous use — `/loop 4h /session-analysis dream`, a
scheduled routine, or a habit at the end of the day — so a run must finish on
its own. Never ask the user a question, never wait for approval, never offer
choices. Every decision the analysis needs is made by the rubric in the
reference file, and every result goes to a file. The chat reply is a status
line, not the deliverable. If something is genuinely undecidable, write it
into the output file under a "needs a decision" heading and move on.

Outputs live under `~/.claude/session-analysis/`:

```
~/.claude/session-analysis/
├── state.json              when each subcommand last ran (managed by the script)
└── dream/
    ├── 2026-09-01-1230.md  one file per run
    └── latest.md           copy of the newest run
```

## Step 1: Build the digest

Raw transcripts are far too large to read (a few months of daily use runs
past a gigabyte of JSONL, most of it tool output and hook noise). The bundled
`scripts/digest.mjs` distills each session into what a reader actually needs:
the user's prompts (including ones typed while Claude was busy, which the
transcript stores separately), the assistant's final reply per turn,
compaction summaries, interrupt markers, tool tallies and error counts, files
touched, timing, and the list of memories already saved for each project. It
needs only Node.

Always measure before extracting, because the answer decides whether you can
read the digest yourself or must fan it out:

```sh
node "<skill-dir>/scripts/digest.mjs" --since last:dream --stats
```

`<skill-dir>` is the directory containing this SKILL.md. `--since last:dream`
covers everything since the previous dream run finished, which is what keeps
a loop from re-reading the same sessions; with no previous run it falls back
to 14 days. Pass through a `--since` or `--project` the user gave instead.
`--since all` is allowed but expect millions of characters.

`--project` is a substring match on the project folder name, which is what
makes one filter cover a project and all its worktrees. It also means
`ai-skills` matches `private-ai-skills`. The stats output names every folder
that matched; when a sibling project sneaked in, filter again with a longer,
folder-specific substring, or keep it and say so in the output file.

The stats print one line per project with a `digest_chars` column and a
TOTAL. Then:

- **Total under ~150K chars:** one digest, read it directly.
  ```sh
  node "<skill-dir>/scripts/digest.mjs" --since last:dream --out "<scratchpad>/digest.md"
  ```
- **Total larger than that:** one digest per project (or per group of small
  projects), then one subagent per chunk. Aim for chunks of 100K–300K chars;
  a single very long session can be its own chunk.
  ```sh
  node "<skill-dir>/scripts/digest.mjs" --since last:dream --project ferrislicer --out "<scratchpad>/digest-ferrislicer.md"
  ```
- **Total is zero sessions:** nothing new since the last run. Write nothing,
  do not mark the run, and reply with one line saying so.

Write digests to the session scratchpad, never into a project tree. Run
`node "<skill-dir>/scripts/digest.mjs" --help` for the full option list.

## Step 2: Run the subcommand

Open the reference file for the subcommand and follow it. Each reference
file states its purpose, the rubric, the exact per-chunk prompt to hand a
subagent when the digest was split, how to merge chunk results, the output
file template, and the status line to reply with.

## Step 3: Record the run

After the output file is written — and only then — record the run so the
next pass starts where this one ended:

```sh
node "<skill-dir>/scripts/digest.mjs" --mark-run dream
```

If the run was scoped with an explicit `--since` or `--project`, do not mark
it: a partial pass must not advance the loop's watermark past sessions it
never read.

## Reading the digest

Conventions the digest uses, so you can skim it fast:

- `## <project>` groups sessions; `### <project> — <title>` starts a session
  with its time span, active minutes, prompt count, branch and PR links.
- `**U <time>:**` is a user prompt. `⚑interrupted` on it means the user hit
  Escape during the turn that followed — almost always a correction in
  progress, so read the next prompt closely. `(queued)` means the user typed
  it while Claude was still working; these are often the sharpest
  corrections ("do not do it", "stop") and are easy to miss in raw
  transcripts.
- `_[Bash×19 Edit×7 · errors×2 · Skill:x · files: … · 13m]_` is what the
  assistant did in reply: tool tallies, tool-error count, skills and agents
  invoked, files written, wall time.
- `~ …` lines under that are mid-turn assistant narration mentioning a
  failure or workaround — the usual home of environment gotchas.
- `**A:**` is the assistant's final message for that turn, truncated.
- `**[compaction summary]**` is Claude's own summary of everything before
  that point — dense and reliable, worth reading in full.
- The `## Existing long-term memories` block at the top lists what is already
  saved per project, with the memory directory path.

## Adding a subcommand

1. Write `references/<name>.md` with the same sections `dream.md` has:
   purpose, rubric, per-chunk subagent prompt, merge rules, output file
   template, status line.
2. Add a row to the table above, and give the subcommand its own directory
   under `~/.claude/session-analysis/`.
3. Use `--since last:<name>` and `--mark-run <name>` so it is loop-safe from
   the start.
4. If the analysis needs data the digest does not carry, extend
   `scripts/digest.mjs` rather than parsing transcripts a second way — one
   extractor keeps every subcommand's view of a session consistent. The
   script header documents the transcript record types it already handles.
   Timing fields (session span, active minutes, per-turn wall time) are
   already emitted, so a `time-analysis` subcommand needs no script change.
