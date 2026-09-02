# The process plugin

This is the union of two projects' assistant-process machinery: the standing
rules a session works under, the register that indexes them, the mechanisms
that enforce them, the sequences that carry out multi-step procedures, and the
briefs for the agents that are dispatched to judge work.

It is all prose, and it is platform-neutral. Nothing here is a script or
configuration for one particular assistant harness; where version control
itself is the mechanism, its commands appear as the only concrete tooling. A
mechanism is written as a story — when it runs, what it reads, what it does,
what the user sees, and the checks that say it works — so that any platform
can implement it in whatever its own hooks and gates look like. `WIRING.md`
is the bridge from these stories to a real harness.

## The map

```
plugin/
  README.md                        this file
  WIRING.md                        what a platform must provide, mechanism by
                                   mechanism, and how activation works
  Rules, the register index, and the agent briefs now live in
  `plugins/machinery/` (the running plugin); the stories and WIRING here are
  the platform-neutral spec it implements.
  hooks/
    rule-capture.md                captures a dictated rule the moment it is
                                   dictated
    rule-nudge.md                  advises when a rule-bearing document moves
                                   and the register does not
    session-banner.md              opens every session with the governance
                                   protocol
    worktree-create.md             creates an isolated working copy whose
                                   branch is named exactly what the copy is
    quiet-output.md                the filter every tool's output passes
                                   through
  gates/
    commit-gate.md                 the four fast checks at commit time — two
                                   executed, two the header states
    merge-gate.md                  the full battery, run on the merge result
    ratchets.md                    the standing-measurement leg of the merge
                                   gate
  skills/
    rule-intake/SKILL.md           the sequence that files a captured rule
    effort-lifecycle/SKILL.md      the sequence for any multi-commit effort
    refresh-diverged-branch/SKILL.md
                                   the sequence that rebuilds a long-diverged
                                   edition branch
```

## How the pieces relate

**This plugin is the shared universal-rules skill.** A rule that holds in any
project is filed here, not in a project's own tree: edit the matching
`rules/<group>.md` file, add the row that cites it to `register/INDEX.md` —
this plugin's own register indexes this plugin's own `rules/` — and reload the
skill. The plugin is installed by reference, so the file you edit is the only
copy. Project-specific rules stay out
of this plugin entirely — they live in each project's own rules directory and
go through that project's own capture-to-gate pipeline, which this plugin does
not run.

**Rules bind every session.** Each file under `rules/` is loaded at session
start, unconditionally, and it is the authority for the rules it holds. Where
a skill repeats a rule's instruction at the step that carries it out, the rule
file wins; the reason behind a rule is argued in the rule file alone, and
everything else points at the file and section where it lives.

**The register indexes the rules.** `register/INDEX.md` records what was
decided, where each decision lives, how settled it is, and what supersedes
what. It cites; it never originates, so a rule that exists only in the index
has no home. Its own check is mechanical and is described in the file.

**Skills are sequences.** A skill says what to do in what order. What must
hold, and why, belongs to a rule file: a step may state the instruction it is
carrying out, but it points at the rule file section rather than re-arguing
the reason. Every skill opens by naming the rule files it works under, and a
skill and a rule file that disagree are resolved in the rule file's favour.

**Hooks and gates are mechanisms.** They are the parts a platform implements,
so they are written as stories a platform reads rather than code it runs. A
hook fires on an event; a gate blocks a commit or a merge. Each names the rule
file whose demands it enforces, and `WIRING.md` says what the platform must
supply for each of them, plus the honest statement of where each mechanism
does *not* run.

**Agents are dispatchable briefs.** Each answers exactly one question, names
the other agents whose questions are not its own, and states its own
containment and the consequence of that containment. The conventions they
share are rules, in `rules/agent-topology.md`, and the briefs do not restate
them.

**The design skill is mandatory and is referenced, not included.** The
`cant-break-by-design` skill is invoked for every design decision and every
code path. Its enforcement ladder, its techniques and its catalog of ways a
claim outruns its mechanism are not reproduced anywhere here;
`rules/design-invariants.md` and `agents/invariant-auditor.md` point at it and
extend it.

## Installing it

**Install by reference, never by copying.** This repository is the repo of
record and the only copy: a rule is filed by editing the file here, so a second
copy elsewhere is a fork that drifts the moment anything is filed. Link the
platform's rules directory at this plugin's `rules/` in place, or point it
there by whatever configuration it offers.

**On a platform with a rules directory** — one that loads a set of instruction
files at session start, unconditionally or scoped to a path — point it at
`rules/` as it stands. That is the layout these files were written for: each
rule file loads whole, the register's citations name a file and a section
inside it, and nothing needs a summary layer. Point that platform at `skills/`
and `agents/` the same way wherever it discovers skills and agent definitions,
and implement each hook and gate story per `WIRING.md`. A platform that can
only copy must treat its copy as read-only and re-copy after each filing;
editing the copy is how the repo of record stops being the record.

**On a platform with no rules directory**, which loads one always-present
instruction document instead, inline the rule files into that document, one
section per rule file. Each rule file's own title becomes a section heading of
that document, and every heading inside it drops one level to sit under it, so
the section names the register cites survive the move. The register's
citations then name that document and those sections rather than ten separate
files, and everything else is unchanged. Do not summarise a rule file down to
a bullet and leave the full text elsewhere: a summary layer is a second copy,
and the two drift. That inlined document is itself a copy, so it falls under
the read-only rule above: it is regenerated from this plugin after each filing
and never edited in place.

## Where the verdicts came from

Every statement in this plugin is traceable to a reconciled row. The full
table of both projects' machinery, the universal form proposed for each row,
and the owner's verdict on each is `../RECONCILIATION.md`. The four most
detailed groups — standing agents, the register, commit gates, and merge gates
with their ratchets — are compacted to one line per mechanism in
`../COMPACT-12-15.md`.
Each file here ends with an HTML comment naming the rows it carries.

## What was deliberately left out

The owner ruled each of these project-specific. They stay in the
reconciliation table as the record, and they are not carried here.

- **The test-double and hands-on-acceptance discipline** — standing a stand-in
  service up per iteration, driving the change against it before reporting it
  done, and who owns tearing it down.
- **Persisted layouts and their migration discipline** — unconditional
  per-release migration, what the client discards at a version boundary, and
  which stamp owns which document.
- **Most of the reference-source rules** — which of several reference
  implementations ranks first, which is a compatibility target, and how to
  classify a disagreement between two of them. What survives is the part about
  reading rather than copying, in `rules/reference-sources.md`.
- **The configuration-field agent** — the standing agent that owned one
  configuration field across every surface it touches. The agent-wide demands
  it sat beside were kept and are in `rules/agent-topology.md`.
- **The documentation mapping pass** — the method for mapping an area of the
  system in one sitting at a uniform depth. The principle it served, that a
  derived document is generated rather than hand-maintained, stands.
- **Two commit-time checks** — the one that compared a document byte for byte
  against a fresh render of itself, and the structural check over one specific
  document's table. The principle behind the second, that a table people rely
  on is checked structurally rather than proofread, stands.

<!-- rows: the exclusion summary of RECONCILIATION.md (group 7 in full; 6.22, 6.31-6.35; 9.165-9.171; 10.6-10.14; 12.21, 12.23-12.27, 12.29-12.33; the ledger-table check) -->
