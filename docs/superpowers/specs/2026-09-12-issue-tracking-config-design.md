# Issue tracking configuration: asking once, and remembering the answer

Date: 2026-09-12. Branch and working copy: `issue-tracking-config`.
Owner: Gabe. Design settled in a brainstorm on 2026-09-12; this records it, question by
question, as it was decided. Revised twice on 2026-09-12: first after the owner ruled on two
of the open questions, then after a third ruling closed the last one — see *The owner's
rulings*. No open question arising from this design remains. Ticket #99, companion #100.

## The problem

`developer-friendliness` § 3.2 tells the assistant where a record belongs: *"The place is a
property of the project, not a preference. Find where this project already puts this kind of
thing, and put it there."* When there is genuinely no such place, both § 3.2 and § 8 say the
same thing:

> If there is genuinely no place for something, that is worth one question to the developer
> — asked once, applied everywhere afterward, and never converted into a new convention you
> invented on their behalf.

**Nothing stores the answer.** "Asked once, applied everywhere afterward" is a claim with no
mechanism behind it. The session that asks gets an answer and uses it; the session after that
has no way to read it, so it asks again, or — worse, and more common — it guesses, files the
record somewhere it invented, and § 3.2's own warning comes true: *"Inventing a second place
is worse than writing nothing."*

The gap is narrow and specific. It is not "the assistant does not know how to use a tracker".
It is that **the developer's one answer about where issue tracking lives has nowhere durable
to sit**, and so the one question gets asked forever.

## The owner's rulings

Three things this document left open were put to the owner with the findings behind them, and
ruled on. They are recorded here together because between them they change what the global
file is *for* and what the prompt says, and a reader who meets only one of them will misread
the others.

**Ruling A — "Global written directly, no capture."** (Owner, 2026-09-12, closing what the
first draft recorded as open question 1.) The global answer is written straight into
`~/.claude/rules/global_issue_tracking.md` by the assistant. No `URULE:`, no inbox entry, no
intake, no commit. The project half is unchanged and still travels capture → intake → commit.

**Ruling B — "Prompt — each project answers for itself."** (Owner, 2026-09-12, closing what
the first draft recorded as open question 4.) A project file saying `unanswered` fires the
prompt regardless of what the global file says. The first draft assumed the opposite reading
and its tests were written against that; both are rewritten below.

**Ruling C — "The prompt stops saying `URULE:` for the global answer."** (Owner, 2026-09-12,
closing the one open question the previous revision left.) There is no mark at all for the
global answer: the developer simply says it, and the assistant writes
`~/.claude/rules/global_issue_tracking.md`. That is what Ruling A already decided happens —
the prompt now matches it. `PRULE:` stays for the project answer, unchanged: captured, taken
through intake, committed in that project. Because nothing invites a mark for the global
answer, no inbox entry is created for it and there is nothing to block a commit. The shape the
owner approved is under *The prompt*; the clauses of his own draft it supersedes are named
there too.

## What this is not

An earlier design in the same brainstorm was replaced wholesale by the owner. It is recorded
so nobody rediscovers it and builds it.

**A detection-and-survey wizard in machinery.** Machinery would detect the project's tracker,
survey the developer through a questionnaire, write a bespoke configuration file through a
shared writer of its own, and expose a `/machinery:tracker` skill to run and re-run all of it.

**Why it was rejected (owner, 2026-09-12):** every part of it already exists. The capture hook
already takes the developer's words verbatim and makes them durable before the assistant
replies. Rule intake already decides where a captured answer is filed and commits it. The
rules-load path already puts `~/.claude/rules/` and `<project>/.claude/rules/` into every
session's context without anything being asked to load them. A wizard, a bespoke writer and a
skill would have been a second pipeline doing what the first one does, with its own lifecycle
to keep in step — for the sake of one file containing one line.

So **none of that machinery is built.** What is built is two files, three states, one piece of
routing knowledge added to intake for the project file, and — under Ruling A — a direct write
of the global file by the assistant, with no pipeline at all behind it.

## The mechanism

### Two files, loaded because of where they sit

| Path | Scope |
|---|---|
| `~/.claude/rules/global_issue_tracking.md` | user level, every project on this machine |
| `<project>/.claude/rules/project_issue_tracking.md` | that project only |

Neither is loaded by anything this design writes. They are loaded because Claude Code already
loads `~/.claude/rules/` and a project's `.claude/rules/` into every session — the same path
that carries the universal rules and a project's own rules today. There is no loader to build,
no resolver, no configuration key, and nothing to remember to call.

**The names are the owner's, verbatim, underscores included.** They do not match the
kebab-case of the other rule files in `rules/` and are not to be "corrected" to match. A later
change that renames them to `global-issue-tracking.md` is a change to what the owner dictated,
not a tidy-up.

### Three states, which is the load-bearing part

The table is **per file**. It answers one question — does this file carry an answer — and it
deliberately does not answer "does the prompt fire", because that is decided by the two files
together under *Precedence* below.

| Contents | Means | Carries an answer? |
|---|---|---|
| `unanswered` | install seeded it; nobody has been asked | no |
| `none` | asked and answered: no issue tracking here | yes |
| anything else | the answer | yes |

Two states were tried first and were wrong. In that version install seeded the file with
`none`, and `none` meant "stop asking". A freshly installed machine and a deliberate "we do
not track issues here" then produce byte-identical files — so the prompt can never fire, for
anyone, ever. The seeded state and the answered-negative state must be different words, or the
whole design is inert.

This is the mistake a later reader is most likely to re-introduce, because it looks like a
simplification: two states, one fewer word, the same behaviour by inspection. It is not the
same behaviour. **`unanswered` and `none` are distinct states and neither may be merged into
the other, nor into absence of the file.**

**Both state words are declared in `layout.mjs`, alongside the two file names, and are never
spelled at a call site.** (Decided alongside Rulings A and B, closing what the first draft
recorded as open question 2. Not a ruling by the owner; recorded as decided because the
reasoning is the one already settled for the file names.) The reason is
`rules/design-invariants.md` § One authority per switch — *"a shared name is spelled once as
one shared definition"* — and it applies here more forcefully than it does to the names, not
less: install writes the word and the reading prose matches it, and a mismatch between the two
**fails silently**. A machine where the prompt has quietly stopped firing looks exactly like a
machine where everything has been answered. Two literals in two files is precisely how that
happens, so there is one literal, in `layout.mjs`, and both sides read it.

### What the global file is actually for

Read Ruling A and Ruling B together and the global file's reach is much narrower than its
name suggests. **Since a seeded project always prompts, the global answer never suppresses a
prompt in an installed project.** Project install seeds `project_issue_tracking.md` with
`unanswered`, and under Ruling B that word fires the prompt whatever the global file says. So
in any project that has run the install — which is every project machinery is set up in — the
global file does not decide anything.

It has exactly two jobs, and no others:

1. **It is the answer for a project with no project file at all.** A project that has never
   run the install has no `project_issue_tracking.md`, so there is nothing to override the
   global answer with, and the global answer governs. (This is the *absent* condition the
   first draft recorded as open question 3 and left as a gap. It is load-bearing now rather
   than a gap, so it is stated here as designed behaviour, not deferred.)
2. **It is the pre-fill for the prompt.** When a project prompts, the global answer is what
   the prompt offers as its ready-made line. A developer with twenty repositories on one
   tracker answers once and then confirms nineteen times, rather than composing the same
   answer twenty times.

**"Global" in the filename overstates its reach, and that gap is the thing most likely to be
"fixed" wrongly later.** The plausible-looking fix — "surely a global answer should stop the
prompt; the project file is only for overrides" — is exactly the reading the owner ruled
against. It is not an oversight to be tidied up. Anyone who wants to change it is changing
Ruling B and needs the owner, not a refactor.

The name is kept because it is the owner's, verbatim (see *Two files* above). What is written
down instead of renaming it is this section.

### Install seeds them

- `install --machine` writes `~/.claude/rules/global_issue_tracking.md` containing
  `unanswered`, **if it is absent.**
- Project install writes `<project>/.claude/rules/project_issue_tracking.md` containing
  `unanswered`, **if it is absent.**

Seeding is idempotent in the strongest sense: **an existing file is never overwritten, whatever
it says.** Re-running install after a plugin update must not walk back over an answer, and must
not reset an answered file to `unanswered`. The only thing install ever does to one of these
files is create it when there is none.

The project file lands in `.claude/rules/`, which the rules index walks, so a seeded file
appears in `RULES_INDEX.md` as a row with no sections and no rules. That is correct and
expected: install already regenerates and stages the index in the same run, so the seed and the
index land together.

### The prompt

The prompt fires when the governing file carries no answer — see *Precedence* for which file
that is.

#### The owner's first draft, and the two clauses a ruling superseded

His own draft of the wording, left standing here rather than quietly reworded, because it is
his sentence and a later reader comparing it with the final copy deserves to see which way the
difference runs and who decided it:

> I don't see issue tracking configured globally or for this project. File a `URULE:` for
> issue tracking global config, or a `PRULE:` for issue tracking in this project. If you would
> like to disable this prompt, issue that request in the appropriate `URULE:` or `PRULE:`.

Two of its clauses are superseded, each by a ruling. Neither was overtaken by drift or by
someone's taste in wording; each was put to the owner and decided.

| The draft said | What replaces it | Why, and on whose word |
|---|---|---|
| *"File a `URULE:` for issue tracking global config"*, and in the last sentence *"the appropriate `URULE:` or `PRULE:`"* | No mark at all for the global answer. The developer states the answer; the assistant writes the file. Both occurrences of `URULE:` go, and nothing replaces them with another mark. | **Ruling C.** Ruling A had already taken the global answer out of the capture pipeline, so a prompt still asking for the mark invited an inbox entry with no home — blocking commits in the repository that holds `rulesSource()` until someone dispositioned it. |
| *"I don't see issue tracking configured globally **or** for this project"* | *"I don't see issue tracking for this project."* The trigger is the governing file alone. | **Ruling B.** A project saying `unanswered` prompts even on a machine whose global file carries an answer, so "neither is configured" would be a false sentence in exactly the case the pre-fill exists for; the honest sentence reports the answer it found and offers it for confirmation. |

The `PRULE:` half of the draft stands unchanged, and so does the sense of its last sentence:
saying the answer is what stops the asking.

#### The shape the owner approved

Quoted as the intent and the layout rather than as final copy — exactly as his first draft
above is:

```
I don't see issue tracking for this project.
From this repo:  GitHub Issues on gnydick/x, via gh

  PRULE: <that line>     - for this project
  or just tell me        - for every project on
                           this machine

Either way, say so in the same breath to stop asking.
```

Three things in that shape are the design rather than the copy, and a later rewording keeps
them:

1. **Two routes offered side by side, and only one of them is a mark.** `PRULE:` for this
   project; for every project on this machine, plain words. No mark is offered for the global
   answer (Ruling C), and the two routes are shown together so the developer can see that the
   choice is project-or-machine rather than mark-or-no-mark.
2. **The ready-made line is shown, with its source named.** The illustration shows the
   detected variant, labelled *from this repo*. Where the global file carries an answer, that
   answer is what is offered and the label says so instead — which case is which follows from
   *What the global file is actually for*. The exact labels are not fixed here.
3. **The closing line ties the end of the asking to the developer saying the answer**, because
   answering is the opt-out and there is no separate switch to reach for (see *Opt-out*).
   What that line must not do is promise more than Ruling B delivers: a global answer does
   **not** silence a project whose own file says `unanswered`, so copy reading as "tell me
   once and I stop asking everywhere" would be false in exactly the common case — an installed
   project, answered globally, which prompts again next session. The illustration's line,
   *"Either way, say so in the same breath to stop asking"*, carries both a reading that holds
   ("saying the answer is what ends the asking, rather than some separate switch") and one
   that overreaches ("either route ends the asking in this project"). **This document does not
   pick between them**, because it does not fix copy — it fixes the constraint the copy has to
   satisfy. Ruling B has already decided the behaviour; only the sentence is unwritten.

**Where the ready-made line comes from.** The line itself is an addition the owner approved,
and point 2 above is the shape it takes on the screen; this is what it is built out of. It is
derived from what can be detected cheaply — the git remote, whether `gh`, `jira` or `linear`
is on `PATH` and authenticated, whether an issue-tracker MCP server is connected — and, where
the global file carries an answer, from that answer, so that in the common case the developer
confirms a line rather than composing one. The global answer and the detected facts are the
two sources the ready-made line is built from; detection does not override an existing global
answer in the suggestion.

Detection has exactly one job, and the boundary is hard: **detection informs the suggestion and
never writes anything.** No detected fact becomes the answer. Nothing is filed until the
developer states it, because the answer is the developer's statement, not the machine's
inference about their project.

### How the answer is recorded: two routes, deliberately different

**The project answer travels the existing pipeline.** The developer answers with `PRULE:`.
From there nothing is new:

1. The capture hook writes the prompt to the inbox **verbatim, before the assistant replies**.
2. Rule intake files it into `<project>/.claude/rules/project_issue_tracking.md`, dispositions
   the entry, regenerates the index, commits — in that project's own repository.

Intake gains **one** piece of routing knowledge and nothing else: a project issue-tracking rule
lands in that named file rather than in a rule group chosen by subject.

**The global answer is written directly by the assistant** into
`~/.claude/rules/global_issue_tracking.md` when the developer answers. No `URULE:`, no inbox
entry, no intake, no index regeneration, no commit. (Ruling A.) **And nothing on the screen
asks for a mark either:** under Ruling C the prompt offers none for the global answer, so the
direct write is not competing with an instruction telling the developer to file one (see
*The prompt*).

**Why the two routes differ.** The capture route was the first draft's answer for both halves,
on the reasoning that the inbox entry is the dated record of what the owner said and when — an
assistant that writes a rule file itself produces a file with an answer in it and no account of
who decided it, when, or in what words. That reasoning still holds for the project half, and
that is why the project half is unchanged. It cannot be applied to the global half, for a
reason found while checking it:

- `~/.claude` **is not a git repository** (verified). There is nothing there to commit to.
- `intake commit --kind universal` files into `rulesSource()` — the *plugin's own* `rules/`
  directory — bumps the plugin version, and commits in the ai-skills checkout. Sending a global
  issue-tracking answer down that route would **ship one developer's tracker to everyone who
  installs machinery.**

So the capture route's two destinations are both wrong for this file, and the direct write is
what is left.

**What the direct write costs, stated plainly because the owner accepted it knowingly.**
There is **no dated record of what was said, or when, for the global answer** — which is
exactly the property the capture route exists to provide. The global file holds an answer and
no provenance: no inbox entry quoting the developer's words, no commit, no history, nothing
that says who decided it or on what date. If the line is later found to be wrong or stale,
there is nothing to read back except the line itself. The owner was shown this trade and took
it.

### Precedence

**The project file decides whenever it exists.** (Ruling B.)

| Project file | Global file | Outcome |
|---|---|---|
| `unanswered` | anything, answered or not | **prompt fires**; the global answer, if any, pre-fills it |
| `none` | anything | no prompt; `none` governs — this project does not track issues |
| an answer | anything | no prompt; the project's answer governs |
| absent | carries an answer | no prompt; **the global answer governs** |
| absent | `unanswered`, or absent | **prompt fires** |

So the full rule is: **the prompt fires when the governing file carries no answer, and the
governing file is the project file wherever one exists.** The global file governs exactly one
row of that table — the project file being absent, which means a project that has never run
the install.

Two readings a later reader may arrive at, both wrong, both named so they are not rediscovered
as improvements:

- **"A global answer and a project `unanswered` should not prompt, because the global answer
  is an answer."** This was the first draft's reading, taken from the draft prompt wording's
  "globally **or** for this project". The owner ruled against it: each project answers for
  itself. Its cost — every newly installed project asks once, even on a machine already
  answered globally — is real and was accepted; the pre-fill is what makes that cost one
  confirmation rather than one composition.
- **"A global tracker and a project `none` means the global one applies, since `none` carries
  less information."** No. Precedence is about which file governs, not about which file
  carries more information. `none` is an answer, and the project's answer wins.

### Opt-out

Answering `none` **is** the opt-out. There is no separate suppression switch, no flag, and no
"don't ask again" state distinct from the answer. Turning the prompt off and answering the
question are the same act, landing in the same file — through capture and intake for the
project file, written directly for the global one. The approved prompt shape's closing line is
about this same act, and *The prompt* records the one thing that line must not be read as
promising.

Note what Ruling B does to a global `none`: it stops the prompt only in a project with no
project file. A `none` written globally does **not** silence an installed project, because
that project's own `unanswered` governs. Opting out for a project means answering `none` for
that project.

## What the file records, and what it never records

Stated by the owner earlier in the same brainstorm and still in force.

**Records:** the route. Which tracker, which project or repository within it, how it is
reached, and how to check the route works.

**Never records:** a credential. Not a token, not a password, not an API key — **and not the
name of the place a token is stored.**

The reason is structural, not stylistic. `.claude/rules` is git-tracked, so anything written
there is committed, pushed and mirrored wherever the repository goes. It is also loaded into
every session's context, so anything written there is transcribed into every transcript of
every session. A secret in one of these files is therefore a secret in the history and in the
logs, in that order, and no later edit removes it from either.

The global file is not git-tracked (`~/.claude` is not a repository), so the first half of that
reasoning does not reach it. The second half does, in full: it is loaded into every session's
context and therefore into every transcript. The rule is the same for both files.

## The `Check:` line

An answer earns a great deal by saying how to verify itself:

```
Issue tracking: GitHub Issues on `acme/widgets`, reached with `gh`.
Check: `gh auth status` and `gh issue list -R acme/widgets -L 1`.
```

Why this matters here specifically, more than it would in an ordinary rule: **this file is read
by a session that cannot see the developer.** Every other fact in a rules file is a standing
instruction that is true because the owner says so. This one is a claim about the state of the
world outside the repository — that a tracker exists, at that address, reachable by this
machine, right now. That claim decays without anyone editing the file: authentication expires,
a repository is renamed, a tool is uninstalled, a project migrates from one tracker to another.

Without a check, a session has two options and both are bad: trust the line and file work into
a tracker that is no longer reachable, or distrust it and ask the developer again — which is
the exact failure this whole design exists to end. With a check, the session has a third
option: run it, and find out. A failing check turns a silently wrong file into a visible,
nameable condition the session can report.

It matters most of all in the global file, which under Ruling A carries no provenance at all.
For the project file, a stale line can at least be traced back to a dated inbox entry and a
commit. For the global file the `Check:` line is the only thing that can tell a session the
line has gone stale.

Nothing enforces that an answer carries a `Check:` line. It is a convention of how the answer
is worded, offered by the prompt's ready-made line and — for the project file only — reinforced
by intake's wording, and it is named here as a convention rather than as a mechanism. The
global file has no intake to reinforce it, so there the convention rests on the prompt's
ready-made line alone.

## Recommendations

Recorded as decided or recommended rather than as open questions, but neither is a mechanism
this design builds. They are different kinds of thing and the difference is marked on each:
the first was never put to the owner, the second is decided.

**Detection should say once, quietly, when the answer contradicts what it found.** A project
answering `none` while carrying a GitHub remote and an authenticated `gh` is the shape
`rules/design-invariants.md` § Telling the user what you dropped is about: something the
machine saw and did not act on, said where the developer will see it. Once, as a note, never
as a challenge to the answer and never as a reason to re-ask — the answer is the developer's
and it stands. **Not put to Gabe.** A later change may drop this without treating it as a
departure from a ruling.

**The state words belong in `layout.mjs`.** Decided; written up under *Three states* above and
in *Places in the code this touches*, and listed as a recommendation here only so the two
items recorded alongside Rulings A and B sit together.

## The honest limits

What has no mechanism behind it, stated plainly so a later reader does not have to rediscover
it by being burned.

**What is mechanical.** The *absence* check. A session does not judge from its own context
whether issue tracking has been discussed — it reads a literal token in a file that is always
loaded. Two sessions on the same machine and project read the same word and reach the same
conclusion. That is a real improvement over a model assessing its own memory, and it is the
whole of what this design makes mechanical.

**What is not mechanical.**

- **The prompt itself is prose.** A model reads a token and is instructed to ask. Nothing
  fails, blocks or reports if it does not. This design removes the ambiguity from the input;
  it does not make the output compulsory.
- **The global answer has no provenance.** Under Ruling A it is written directly, so there is
  no inbox entry, no commit and no date — nothing recording what was said or when. This is the
  one property the capture pipeline exists to give, and the global half does not have it. The
  owner accepted the trade knowingly; it is a limit, not a defect to be fixed by rerouting the
  global answer through intake, which would ship one developer's tracker to everyone (see
  *How the answer is recorded*).
- **Nothing stops a developer typing `URULE:` about issue tracking anyway.** The capture hook
  fires on the mark alone and never classifies intent, by design, so a mark typed out of habit
  still produces an inbox entry that blocks commits in the repository holding `rulesSource()`,
  and Ruling A gives its content no home there. What Ruling C contributes is that nothing asks
  for the mark any more, and that is copy on a prompt, not a mechanism. Such an entry is an
  ordinary undirected `URULE:` with no home — dismissed with a reason, exactly as
  `rules/rule-governance.md` § Dictating a rule already requires of any rule that turns out
  to have none. It is a limit worth naming, not a question this design leaves open.
- **Nothing verifies that a filed answer is still true.** The `Check:` line above is the
  mitigation and it is opt-in: a session must choose to run it. An answer naming a tracker
  that was abandoned last year reads exactly like one naming the tracker in use this morning.
- **Nothing stops the two files disagreeing in spirit.** Precedence resolves which one governs
  mechanically, so there is no ambiguity about the outcome — and under Ruling B the project
  file governs in every installed project, so a stale global line is largely inert as a
  *decision*. What it still does is pre-fill the prompt, so a global answer nobody has
  revisited will be offered, plausibly, as the suggested line in a project it no longer fits.
  The developer is the only check on that.
- **The prompt fires once per project, by design, and that is a cost not a bug.** A developer
  with twenty repositories on one tracker is asked in each of them. The pre-fill reduces that
  to twenty confirmations rather than twenty compositions, and nothing reduces it further.
- **A `none` answer is indistinguishable from an answer given to make the prompt stop.** That
  is acceptable — it is the developer's call either way — but it means the count of projects
  answering `none` says nothing about how many projects genuinely have no tracker.

What was listed here in the first draft and is **no longer** a limit: the seeded word and the
reading prose drifting apart. Declaring `unanswered` and `none` in `layout.mjs` closes it by
the same mechanism that closes the file names.

## Tests required

1. **Seeding is idempotent and never overwrites.** `install --machine` run twice creates
   `~/.claude/rules/global_issue_tracking.md` once; the second run leaves it byte-identical.
   Project install likewise for `project_issue_tracking.md`.
2. **An answered file survives install.** A file whose contents are a real answer, and a file
   whose contents are `none`, are both byte-identical after a re-run of the install that seeded
   them. Asserted separately from test 1, because "does not create twice" and "does not reset
   an answer" are different failures and a single assertion passes on one of them.
3. **A project `unanswered` prompts, whatever the global file says.** Asserted three times over
   — global `unanswered`, global `none`, global carrying a tracker line — because the third
   case is the one Ruling B decided and the one a later "simplification" will break first. A
   detector that suppresses the prompt on a global answer must fail this test.
4. **A project `none` does not prompt, and a project answer does not prompt.** Each asserted
   with the global file `unanswered` *and* with the global file carrying a different tracker
   line, so a detector that consults the global file for the decision at all is caught.
5. **With no project file, the global file governs.** No `project_issue_tracking.md` present:
   a global answer means no prompt and that answer governs; a global `unanswered`, or no global
   file either, means the prompt fires. This is the absent-project-file row of the precedence
   table and the only row where the global file decides anything.
6. **The global answer pre-fills the prompt.** Project `unanswered` with the global file
   carrying a tracker line: the prompt's ready-made line is that answer. Asserted because
   Ruling B leaves pre-fill as one of only two jobs the global file has, and a change that made
   the global file entirely inert would otherwise pass every other test here.
7. **The two recording routes, asserted separately.**
   (a) A captured `PRULE:` about issue tracking is filed by intake into
   `<project>/.claude/rules/project_issue_tracking.md` — not into a rule group chosen by
   subject.
   (b) The global answer is written directly: recording a global answer produces no inbox
   entry, no intake run, no write anywhere under `rulesSource()`, no plugin version bump and no
   commit. Asserted as a negative over the plugin's own `rules/` directory, because the failure
   this guards against — one developer's tracker shipping to everyone who installs machinery —
   is silent at the moment it happens and visible only after publication.
8. **Positive control: the prompt detector still fires.** A fixture whose project file says
   `unanswered` must produce the prompt condition, and the assertion must fail if the detector
   is disabled. Without this, tests 4 and 5 pass for free on a detector that never fires at
   all — a design whose failure mode is exactly permanent silence must prove the detector is
   alive before it proves the detector is quiet.
9. **The names and the state words have one spelling each.** A check over the plugin's source
   refuses either file name, and either of `unanswered` and `none`, written as a literal
   anywhere but `layout.mjs`. Two spellings of a file name is how the installer seeds one path
   and the reader reads another; two spellings of a state word is the same failure, silent
   instead of loud. Prose that quotes a name or a word — this specification, a skill's
   instructions — is not source and is not in the check's scope. The check ships with a case
   proving it still matches, per `rules/design-invariants.md` § One authority per switch.
   One wrinkle the implementation has to settle and this design does not: `none` is an ordinary
   word that appears as a string literal for unrelated reasons, so the check needs a scope
   narrow enough not to fire on those and wide enough to catch a second spelling of the state
   word. Naming the exposure here rather than leaving it to be discovered when the check is
   first run, and refusing to pick the scope from a distance.
10. **The seed contains no credential-shaped content.** The seeded file's entire contents are
    the single state word. Asserted directly, so a later change that seeds a detected remote, a
    token path or an account name into the file fails rather than ships.
11. **The prompt names no mark for the global answer.** A check over the prompt copy where it
    lives — `developer-friendliness` § 3.2 and § 8 — refuses `URULE:` anywhere in the
    issue-tracking prompt, and requires `PRULE:` on the project route. This is the clause
    Ruling C struck from the owner's draft, copy is the only artifact that carries it, and
    restoring it is a one-line edit that nothing else would catch — after which the prompt
    invites an inbox entry whose content has no home. The check ships with a case proving it
    still matches, per `rules/design-invariants.md` § One authority per switch. Nothing in
    this list asserted the draft wording before Ruling C, so no test here is retracted by it;
    this one is new work the ruling creates.

## Places in the code this touches

- **`plugins/machinery/scripts/install.mjs`** — both paths. `installMachine()` seeds the global
  file next to the `~/.claude/rules/machinery` junction it already creates; `installProject()`
  seeds the project file into the `.claude/rules` directory it already creates, and stages it
  with the rules index it already regenerates and stages.
- **`plugins/machinery/scripts/intake.mjs`** and
  **`plugins/machinery/skills/rule-intake/SKILL.md`** — the one piece of routing knowledge: a
  **project** issue-tracking rule has a named home rather than a home chosen by subject. The
  skill's step 2 ("decide … the rule file it joins") is where the routing is stated; the script
  is where it is enforced. **No global route is added here.** Under Ruling A the global answer
  never reaches intake, and in particular `--kind universal` gains nothing for issue tracking.
- **`plugins/developer-friendliness/skills/developer-friendliness/SKILL.md` § 3.2 and § 8** —
  the two places that say "asked once, applied everywhere afterward". Both name where the
  answer is now stored, what the three states mean, which file governs, and which of the two
  routes records the answer, so the instruction stops being a claim with no mechanism. This is
  also where the prompt's final wording lives: it must follow the shape the owner approved
  under *The prompt* and differ from his first draft in the two ways named there, and it is
  the artifact test 11 checks. **It is where the global direct write is specified too**:
  under Ruling A no script writes that file, so the only place the behaviour can be stated is
  the skill the assistant is reading when it asks the question.
- **`plugins/machinery/scripts/lib/layout.mjs`** — the sole authority on machinery file names.
  Both file names **and both state words** are declared there, exactly as `RULES_INDEX`,
  `SPEC_INBOX` and the rest are, and none of the four is ever spelled at a call site.
  `layout.mjs`'s own header states the reason: *"A name spelled in two places is a name that
  can drift, so it is declared once here and both read it."* Two units name these files and
  neither can import the other — the installer seeds them and the intake routes to them — which
  is precisely the condition `layout.mjs` exists for. The state words have the same two units
  and a worse failure mode, since a mismatch there is silent.

## Relation to #99 / #100

Ticket #99 records the problem; companion #100 carries its pickup context. This specification
is the design for that ticket and **supersedes the "shape of the fix" recorded on it**, which
described the detection-and-survey wizard rejected above. The problem statement on #99 is
unchanged and still accurate; only the shape of the fix is replaced.

The ticket pair is not edited by this change. Bringing #99 and #100 into line with this
document is a separate, deliberate act by whoever picks the work up, and it should cite this
path rather than restate the design.

## Open questions

**None.** Every question this design raised has been answered, and this section is left short
rather than padded with questions nobody is waiting on.

How each was closed, so a later reader does not have to reconstruct it:

| Recorded as | Closed by |
|---|---|
| 1 — should the global answer travel capture and intake | **Ruling A**: written directly, no capture |
| 2 — where the state words are declared | Decided alongside Rulings A and B: in `layout.mjs`, written up under *Three states* |
| 3 — what governs when there is no project file at all | Promoted into the mechanism as designed behaviour, under *What the global file is actually for* |
| 4 — does a global answer suppress a project `unanswered` | **Ruling B**: no; each project answers for itself |
| 5 — should detection speak up when it contradicts the answer | Moved to *Recommendations*, marked **not put to Gabe** |
| added by the second revision — what intake should do with a `URULE:` about issue tracking | **Ruling C**: the prompt stops asking for the mark, so the entry this question was about is no longer created |

Two things that are **not** open questions, named here because each could be mistaken for one:

- **A developer can still type `URULE:` unprompted.** Ruling C removes the invitation, not the
  ability. What is left is an ordinary undirected rule with no home, which `rule-governance.md`
  already says how to handle, and it is recorded as a limit under *The honest limits* rather
  than as a question. It is still not a licence to route the global answer into
  `rulesSource()` after all.
- **Detection speaking up when the answer contradicts what it found** is a **recommendation
  that was never put to Gabe**, not a question awaiting his answer. It sits under
  *Recommendations* and says so there. A later change may drop it without departing from any
  ruling — which is exactly what distinguishes it from the rows above that record decisions,
  none of which may be reopened without the owner.
- **What the prompt's closing line finally says.** The approved shape is illustrative and this
  document fixes no copy, so an unwritten sentence is not an open question. The behaviour
  behind it is decided: under Ruling B a global answer does not silence a project whose own
  file says `unanswered`. *The prompt*, point 3, states the constraint that follows, and the
  copy is written to it.
