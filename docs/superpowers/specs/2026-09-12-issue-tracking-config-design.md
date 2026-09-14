# Issue tracking configuration: asking once, and remembering the answer

Date: 2026-09-12. Branch and working copy: `issue-tracking-config`.
Owner: Gabe. Design settled in a brainstorm on 2026-09-12; this records it, question by
question, as it was decided. Revised four times on 2026-09-12: first after the owner ruled on
two of the open questions, then after a third ruling closed the last one, then after a fourth
ruling settled a consequence of the second, and then — the largest revision — after writing an
implementation plan from this document surfaced two problems and four further rulings (E–H)
changed the prompt substantially. See *The owner's rulings* and *Why this revision
exists*. Two questions this design raises are open again; see *Open questions*. Ticket #99,
companion #100.

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

## Why this revision exists

An implementation plan was written from the previous revision (unmerged, on the
`issue-tracking-plan` branch; it will be rewritten from this one). Writing it surfaced two
problems in this document, not in the plan:

- **Six of the thirteen tests had nothing to test.** Tests 3, 4, 5, 6, 8 and the second half of
  12 check what a *reader* concludes from the two files, but the previous revision named no
  reader: the decision was the model judging its own loaded rules. The plan proposed a
  precedence function that nothing in the product would call, so those tests would have passed
  against code the product never runs.
- **The illustrative prompt read as literal copy.** It contained real-looking sample values
  (`gnydick/x` in the approved shape, `acme/widgets` in the `Check:` example). Placed into
  `SKILL.md` as instructions, a model could print a sample value as though it had been
  detected.

Putting those two problems to the owner produced Rulings E, F, G and H below.

## The owner's rulings

Eight things were put to the owner with the findings behind them, and ruled on. They are
recorded here together because between them they change what the global file is *for*, how
the question is asked and how the answer is recorded, and a reader who meets only one of them
will misread the others. None of them is reopened without the owner.

**Ruling A — "Global written directly, no capture."** (Owner, 2026-09-12, closing what the
first draft recorded as open question 1.) The global answer is written straight into
`~/.claude/rules/global_issue_tracking.md` by the assistant. No `URULE:`, no inbox entry, no
intake, no commit. Still in force, unchanged by Ruling F: the global route has no inbox entry
of any kind, hand-written or captured.

**Ruling B — "Prompt — each project answers for itself."** (Owner, 2026-09-12, closing what
the first draft recorded as open question 4.) A project file saying `unanswered` fires the
prompt regardless of what the global file says. The first draft assumed the opposite reading
and its tests were written against that; both are rewritten below.

**Ruling C — "The prompt stops saying `URULE:` for the global answer."** (Owner, 2026-09-12,
closing the one open question the revision before it left.) There is no mark for the global
answer: the developer simply says it, and the assistant writes
`~/.claude/rules/global_issue_tracking.md`. **Subsumed by Ruling F**, which removes every mark
from the prompt, `PRULE:` included. Ruling C is not deleted: it is still the reason no `URULE:`
may come back, and Ruling F is the reason no `PRULE:` may. Its original text kept `PRULE:` for
the project answer; that half is what Ruling F replaced.

**Ruling D — "Leave it — keep prompting."** (Owner, 2026-09-12, settling a consequence of
Ruling B rather than a question this document left open.) The consequence was put to him in the
exact form in which it bites: **in an installed project, the global route can never stop the
prompt.** A developer who picks the global route gets `~/.claude/rules/global_issue_tracking.md`
written while that project's own file still says `unanswered` — so the prompt fires again next
session, and every session after, until someone files a `PRULE:` in that project (the form the
consequence was put in; restated below under Ruling F). Three ways out
were offered: have the global answer also write the project file; stop offering the global
route inside a seeded project; or leave it. He ruled: *"Leave it — keep prompting."* Preceded by
his own statement of the principle: *"it should always prompt if the project is unanswered."*

When Ruling D was taken, the only way to record an answer for a project was a `PRULE:` filed
there, and the previous revision said "only a `PRULE:` ever stops the asking". Ruling F removed
the mark; **the substance
of Ruling D is unchanged and is now stated as: only an answer recorded for this project stops
the asking.** A machine-wide answer still never silences a seeded project.

So the global route writes the global file and nothing else, and a seeded project keeps
prompting until its own file carries an answer. This is **a decision with a named cost, taken
with the cost in front of the owner** — not an oversight, and not something for a later change
to work around. The two rejected ways out are written down here precisely so that neither is
rediscovered as an improvement: making the global write also seed the project file is the first
of them, and it is refused. Where the cost falls is stated under *What the global file is
actually for*, *Opt-out* and *The honest limits*; what it forbids the conversation from saying
is stated under *The prompt*, point 3; test 12 asserts it.

**Ruling E — the prompt is a guided setup conversation.** (Owner, 2026-09-12, in his words:
*"No, it should something like 'Example: Use github issues to track this project.' and then
claude should ask things like are you using gh cli suggest if not. Do you have your credentials
set up, do you need help with that? etc."*) The prompt opens with a clearly labelled example of
the kind of answer wanted; then the assistant asks only what is still unknown, one question at a
time — the tool, the credentials, whether the route is reachable, and the scope. Specified under
*The prompt*. This is a conversation the assistant holds from instructions in a skill, and it is
**not** the rejected wizard; see *What this is not*.

**Ruling F — no marker in the prompt; the assistant records the answer.** (Owner, 2026-09-12:
*"I think we should remove the PRULE: part because it's prompted automatically"*, and, asked how
the answer is then saved: *"write the inbox entry and let intake file it"*.) The developer
answers in plain words, so the capture hook, which fires only on a mark, does not fire. For the
project route the assistant writes the inbox entry **by hand** — the path
`rules/rule-governance.md` § Dictating a rule already names for exactly this case: *"A rule ruled
in conversation without the marker is still written into the inbox by hand, with a note saying
why the automatic capture did not fire."* Intake then files it into `project_issue_tracking.md`
as before. The global route is unchanged (Ruling A).

**Ruling G — the precedence function decides whether to start the conversation.** (Owner,
2026-09-12: *"yes, run the function to decide"*.) The precedence table is implemented as a
function that the assistant **runs** to decide whether to begin the setup conversation, instead
of judging its own loaded rules. It reads both files and returns whether to ask and what to
pre-fill. Tests 3, 4, 5, 6, 8, 12 (second half) and 14 test that function, which is the decision the product
actually makes. Specified under *Precedence*.

**Ruling H — visible placeholders, and empty means unanswered.** (Owner, 2026-09-12: *"it's not
obvious that the example is an example"*; and, confirmed by him, an empty file is read as
`unanswered`.) Any illustration of a detected or recorded value uses placeholders that cannot be
mistaken for real values — `<tracker>`, `<project>`, `<tool>` and the like — never a plausible
sample. And **an empty file is read as `unanswered`**, consistent with the project file
deciding whenever it exists. Carried into *Three states* and *Precedence*.

## What this is not

> **Superseded in part, 2026-09-13 (owner, machinery recalibration, decisions 28 and 32):** the
> rejection of a machinery *skill* for setup is lifted — *"remove the restriction of a setup
> skill"*. A `/machinery:setup` skill runs the project setup conversation, the issue-tracking
> questions among its items, and `/machinery:setup <item>` re-runs one item. The rest of this
> section (no detection script, no bespoke writer of machinery's own) is not changed by that
> ruling. See `docs/learnings/recalibration-2026-09/STATUS.md`.
>
> **Superseded in part, 2026-09-13 (decision 34):** every reference in this spec to the setup
> conversation living in `developer-friendliness` § 3.2 and § 8 is replaced: developer-friendliness is
> tabled (*"remove it from friendliness"*), and the conversation lives in machinery's `setup` skill as
> its `issue-tracking` item. The answer is still recorded as the project rule
> `.claude/rules/project_issue_tracking.md` through the inbox and intake (decision 33).

An earlier design in the same brainstorm was replaced wholesale by the owner. It is recorded
so nobody rediscovers it and builds it.

**A detection-and-survey wizard in machinery.** Machinery would detect the project's tracker,
survey the developer through a questionnaire, write a bespoke configuration file through a
shared writer of its own, and expose a `/machinery:tracker` skill to run and re-run all of it.

**Why it was rejected (owner, 2026-09-12):** every part of it already exists. The capture hook
already takes the developer's words verbatim and makes them durable before the assistant
replies. Rule intake already decides where an inbox entry is filed and commits it. The
rules-load path already puts `~/.claude/rules/` and `<project>/.claude/rules/` into every
session's context without anything being asked to load them. A wizard, a bespoke writer and a
skill would have been a second pipeline doing what the first one does, with its own lifecycle
to keep in step — for the sake of one file containing one line.

**Ruling E's setup conversation is not that design coming back**, and a reader comparing the two
will otherwise think it has. What was rejected was machinery *code*: a detection script, a
bespoke writer of its own, and a `/machinery:tracker` skill with its own lifecycle. What Ruling E
adds is none of those. The conversation is held by the assistant, from instructions in the
`developer-friendliness` skill that already asks the question; the tool, credential and
reachability questions are asked in words, and whatever the assistant checks along the way it
checks by running the developer's own tools — git, the tracker's command-line tool — not a
machinery detector. The answer is
recorded through the two routes that already exist — an inbox entry and intake for the project,
a direct write for the global file — with no writer of machinery's own. The one piece of code
Ruling G adds is a reader of two files that returns a decision; it writes nothing and surveys
nothing.

So **none of the wizard is built.** What is built is two files, three states, one reader
function that decides whether to ask (Ruling G), one piece of routing knowledge added to intake
for the project file, and — in the skill — the setup conversation, the hand-written inbox entry
for the project answer (Ruling F), and the direct write of the global file (Ruling A).

## The mechanism

### Two files, loaded because of where they sit

| Path | Scope |
|---|---|
| `~/.claude/rules/global_issue_tracking.md` | user level, every project on this machine |
| `<project>/.claude/rules/project_issue_tracking.md` | that project only |

Neither is loaded into context by anything this design writes. They are loaded because Claude
Code already loads `~/.claude/rules/` and a project's `.claude/rules/` into every session — the
same path that carries the universal rules and a project's own rules today. There is no loader
to build and no configuration key.

**Being loaded is what carries the answer, not what decides whether to ask.** Under Ruling G the
decision is taken by a function that reads both files from disk (see *Precedence*); a session
that has both files in its context still runs the function rather than judging from what it has
loaded.

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
| empty (the file exists and has no content) | read as `unanswered` (Ruling H) | no |
| `none` | asked and answered: no issue tracking here | yes |
| anything else | the answer | yes |

**An empty file is not a fourth state.** It is read exactly as `unanswered` is, by the same
function, and nothing writes an empty file on purpose: install seeds `unanswered`. The row exists
because a file emptied by hand or truncated by accident has to mean something, and Ruling H
settles that it means nobody has answered — consistent with the project file deciding whenever
it exists, rather than an empty project file quietly handing the decision back to the global
file as though the project file were absent. An empty file and an absent file are therefore
different, and must stay different: absent defers to the global file, empty does not.

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
less: install writes the word and the precedence function reads it, and a mismatch between the
two **fails silently**. A machine where the prompt has quietly stopped firing looks exactly like
a machine where everything has been answered. Two literals in two files is precisely how that
happens, so there is one literal, in `layout.mjs`, and both sides import it. Under Ruling G the
reading side is code for the first time, so this is now a check between two units rather than
between a unit and a paragraph of prose.

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
   than a gap, so it is stated here as designed behaviour, not deferred. What a project with
   no machinery installed can actually *do* when the prompt fires there is open; see *Open
   questions*, 1.)
2. **It is the pre-fill for the prompt.** When a project prompts, the global answer is what
   the conversation offers first. A developer with twenty repositories on one tracker answers
   once and then confirms nineteen times, rather than composing the same answer twenty times.

**Answering for every project from inside a seeded project's conversation does not answer that
project.** The global answer lands in the global file alone; that project's own file still says
`unanswered`, so the same project prompts again next session, and every session after, until an
answer is recorded for that project. Taking the global route inside an installed project
therefore buys the pre-fill for next time and never silence — which is job 2 above doing its
job, not job 1 failing. (Ruling D, taken with exactly this cost stated.)

**"Global" in the filename overstates its reach, and that gap is the thing most likely to be
"fixed" wrongly later.** The plausible-looking fix — "surely a global answer should stop the
prompt; the project file is only for overrides" — is exactly the reading the owner ruled
against, **twice**: once as Ruling B, and again as Ruling D when the consequence was put back
to him in full. It is not an oversight to be tidied up. Anyone who wants to change it is
changing both rulings and needs the owner, not a refactor.

The name is kept because it is the owner's, verbatim (see *Two files* above). What is written
down instead of renaming it is this section.

### Install seeds them

- `install --machine` writes `~/.claude/rules/global_issue_tracking.md` containing
  `unanswered`, **if it is absent.**
- Project install writes `<project>/.claude/rules/project_issue_tracking.md` containing
  `unanswered`, **if it is absent.**

Seeding is idempotent in the strongest sense: **an existing file is never overwritten, whatever
it says** — an empty file included. Re-running install after a plugin update must not walk back
over an answer, and must not reset an answered file to `unanswered`. The only thing install ever
does to one of these files is create it when there is none.

The project file lands in `.claude/rules/`, which the rules index walks, so a seeded file
appears in `RULES_INDEX.md` as a row with no sections and no rules. That is correct and
expected: install already regenerates and stages the index in the same run, so the seed and the
index land together.

### Precedence

**The project file decides whenever it exists.** (Ruling B.)

| Project file | Global file | Outcome |
|---|---|---|
| `unanswered`, or empty | anything, answered or not | **ask**; the global answer, if any, is the pre-fill |
| `none` | anything | do not ask; `none` governs — this project does not track issues |
| an answer | anything | do not ask; the project's answer governs |
| absent | carries an answer | do not ask; **the global answer governs** |
| absent | `unanswered`, empty, or absent | **ask**, with no pre-fill |

So the full rule is: **the conversation starts when the governing file carries no answer, and
the governing file is the project file wherever one exists.** The global file governs exactly
one row of that table — the project file being absent, which means a project that has never
run the install.

**The table is a function, and the assistant runs it.** (Ruling G.) It lives in
`plugins/machinery/scripts/lib/`, reads both files from disk, reads the state words and file
names from `layout.mjs`, and returns two things: **whether to ask**, and **what to pre-fill** —
the global answer where the table says there is one, and nothing otherwise. It writes nothing,
detects nothing and asks nothing. The instruction in `developer-friendliness` § 3.2 and § 8 is
to run it (through a command-line entry that machinery ships) and to start the setup
conversation if and only if it says to ask; that instruction is the one place the function is
called from. Its name, its command-line entry's name and its output shape are the
implementation's to choose; which rows it implements are fixed by the table above.

Before Ruling G, the decision was the model reading a word in a file it had loaded and judging
the table from memory. That was a model judging, not a mechanism, and the tests written against
it had nothing in the product to exercise. The function is what those tests now call.

Two readings a later reader may arrive at, both wrong, both named so they are not rediscovered
as improvements:

- **"A global answer and a project `unanswered` should not prompt, because the global answer
  is an answer."** This was the first draft's reading, taken from the draft prompt wording's
  "globally **or** for this project". The owner ruled against it: each project answers for
  itself. Its cost — every newly installed project asks, even on a machine already answered
  globally, and keeps asking until that project's own file carries an answer — is real and was
  accepted, and Ruling D re-affirmed it with that second half spelled out. The pre-fill is what
  makes the cost one confirmation rather than one composition; what discharges it is an answer
  recorded for that project, and nothing else does.
- **"A global tracker and a project `none` means the global one applies, since `none` carries
  less information."** No. Precedence is about which file governs, not about which file
  carries more information. `none` is an answer, and the project's answer wins.

### The prompt

The setup conversation starts when the precedence function says to ask — see *Precedence* for
which file governs.

#### The owner's first draft, and what superseded it

His own draft of the wording, left standing here rather than quietly reworded, because it is
his sentence and a later reader comparing it with the final copy deserves to see which way the
difference runs and who decided it:

> I don't see issue tracking configured globally or for this project. File a `URULE:` for
> issue tracking global config, or a `PRULE:` for issue tracking in this project. If you would
> like to disable this prompt, issue that request in the appropriate `URULE:` or `PRULE:`.

Every clause of it has now been superseded, each by a ruling. None was overtaken by drift or by
someone's taste in wording; each was put to the owner and decided.

| The draft said | What replaces it | Why, and on whose word |
|---|---|---|
| *"File a `URULE:` for issue tracking global config"*, and *"the appropriate `URULE:`"* | No mark for the global answer. The developer states the answer; the assistant writes the file. | **Ruling C**, now subsumed by Ruling F. Ruling A had already taken the global answer out of the capture pipeline, so a prompt still asking for the mark invited an inbox entry with no home — blocking commits in the repository that holds `rulesSource()` until someone dispositioned it. |
| *"or a `PRULE:` for issue tracking in this project"*, and *"or `PRULE:`"* | No mark for the project answer either. The developer answers in plain words; the assistant writes the inbox entry by hand and intake files it. | **Ruling F.** The prompt fires automatically, so asking the developer to type a mark in reply to it was ceremony; the dated record the mark existed to produce is kept by the hand-written entry. |
| The whole of the middle sentence, as an instruction to file something | A guided setup conversation: a labelled example, then only the questions still unanswered, one at a time. | **Ruling E.** |
| *"I don't see issue tracking configured globally **or** for this project"* | *"I don't see issue tracking for this project."* The trigger is the governing file alone. | **Ruling B.** A project saying `unanswered` prompts even on a machine whose global file carries an answer, so "neither is configured" would be a false sentence in exactly the case the pre-fill exists for; the honest sentence reports the answer it found and offers it for confirmation. |
| *"If you would like to disable this prompt, issue that request…"* | Answering is the opt-out; there is no separate request (see *Opt-out*). What survives is only the sense that saying the answer is what ends the asking — for this project, never by a machine-wide answer. | **Ruling D**, and point 3 below. |

#### The shape the owner approved before Ruling E, superseded

Kept for the record, because the owner approved it and a later reader will find it in history.
**It is superseded by Rulings E, F and H, and it must not be copied into any skill:** it offers a
mark (`PRULE:`), it offers two routes as a menu rather than asking, and `gnydick/x` is a
real-looking value of exactly the kind Ruling H forbids in an illustration.

```
I don't see issue tracking for this project.
From this repo:  GitHub Issues on gnydick/x, via gh

  PRULE: <that line>     - for this project
  or just tell me        - for every project on
                           this machine

Either way, say so in the same breath to stop asking.
```

#### The conversation (Rulings E, F and H)

Quoted as the intent and the layout, not as final copy. Every value in angle brackets is a
placeholder (Ruling H): a skill that carries this illustration must carry the brackets, and the
assistant fills a bracket only from something it read or was told in this session, never from
this document. The one line not in brackets is the owner's own example, and it is labelled as
one.

```
I don't see issue tracking for this project.

  Example: "Use GitHub Issues to track this project."

[only when the precedence function returned a pre-fill]
  On this machine you already use: <tracker> <project>, via <tool>.
  Use the same here?
```

Then, one question at a time, and **only the ones whose answer is not already known** — a
question the developer has answered, or the assistant has just established by running the
tool's own read-only command, is not asked:

```
Which tracker, and which project in it?          -> <tracker>, <project>
Is <tool> installed?                              -> if not, suggest installing it
Is <tool> signed in?                              -> if not, offer to help; the developer
                                                     runs the interactive login themselves,
                                                     in Claude Code as `! <tool login command>`
Checking the route works: <read-only check>      -> say whether the read worked
Is this for this project only, or for every project on this machine?
```

What the parts are, and why each is design rather than copy:

1. **The example is labelled as an example.** Ruling E's own words open the conversation, marked
   `Example:`, so the developer sees the kind of answer wanted without being handed one. No
   detected or recorded value appears unlabelled, and every illustrated value is a placeholder
   (Ruling H).
2. **Beyond the tracker and project themselves — which the example invites and the pre-fill may
   already supply — the questions cover four things, and skip what is known.** The owner named
   the first two in his own words; reachability and scope complete the ruling as it was put to
   him.
   - **The tool.** For GitHub, is `gh` installed; if not, suggest installing it. The same shape
     applies to any tracker's tool.
   - **Credentials.** Is the tool authenticated; if not, offer to help set it up. An interactive
     login cannot be driven by the assistant, so the developer runs it themselves — in Claude
     Code, as `! gh auth login`. **None of it is written into either file**; see *What the file
     records, and what it never records*.
   - **Reachability.** The route is verified with a real read — for GitHub, listing one issue —
     rather than trusted because setup appeared to succeed. What that read may and may not do is
     stated under *The reachability read*.
   - **Scope.** Does this hold for this project only, or for every project on this machine. The
     answer picks the route under *How the answer is recorded*.
   Where the precedence function returned a pre-fill, it is offered first and labelled as what
   this machine already uses, so the common case is one confirmation.
3. **Nothing in the conversation may promise that a machine-wide answer ends the asking here.**
   A global answer does **not** silence a project whose own file says `unanswered` (Ruling B),
   and the owner was shown that consequence, offered two ways to change it, and kept the
   prompting instead (Ruling D). So this is a requirement, not a preference between readings:

   > **In this project, only an answer recorded for this project stops the asking.** The
   > conversation must not state or imply that answering for every project on this machine ends
   > the asking here — not in the scope question, not in the labels on its two answers, and not
   > in whatever the assistant says after writing the global file. Copy that reads as "tell me
   > once and I stop asking everywhere" is wrong copy.

   Saying so honestly is allowed and is the expected behaviour: after a machine-wide answer in a
   seeded project, the assistant may say that this project will ask again until it has an answer
   of its own. The superseded shape's closing line, *"Either way, say so in the same breath to
   stop asking"*, carried the overreaching reading and is not carried forward. Test 13 is the
   check.
4. **No mark is offered, for either scope.** Neither `URULE:` nor `PRULE:` appears anywhere in
   the conversation (Rulings C and F). The developer answers in plain words. Test 11 is the
   check.

This fixes no copy. What is fixed is the four points above, which the words someone eventually
writes into the skill have to satisfy.

**What the assistant checks along the way, and the boundary on it.** To ask only what is still
unknown, the assistant may establish facts cheaply before asking — the git remote, whether `gh`,
`jira` or `linear` is on `PATH` and authenticated, whether an issue-tracker MCP server is
connected — and, where the precedence function returned one, it starts from the global answer.
Detected facts never override the global pre-fill in what is offered.

The boundary is hard: **detection and checking inform the conversation and never write
anything.** No detected fact becomes the answer. Nothing is recorded until the developer states
or confirms it, because the answer is the developer's statement, not the machine's inference
about their project.

#### The reachability read

The reachability check touches the live tracker, so its limits are stated here rather than left
to the copy.

- **Allowed:** one read that proves the route works — for GitHub, listing a single issue
  (`gh issue list -R <project> -L 1`) — and the tool's own status query
  (`gh auth status`). The same shape for another tracker: the least read that returns something
  only a working route could return.
- **Never:** creating, editing, commenting on, labelling, assigning, closing or reopening
  anything on the tracker — **not even a test issue to prove write access**; changing the tool's
  authentication or configuration on the developer's behalf (the developer runs any login
  themselves); or recording anything the read returned — into either file, the inbox entry, or
  anything intake files. The developer is told whether the read worked, and that is all it
  produces.
- **What enforces it:** nothing but the instruction. The tool the assistant runs is the
  developer's own, authenticated as the developer, and it can write; no allowlist, sandbox or
  hook confines the assistant to reads. Stated again under *The honest limits*, and recorded as
  an open question because a read-only guarantee is claimed and has no mechanism.

### How the answer is recorded: two routes, deliberately different

The scope answer picks the route.

**The project answer is written into the inbox by hand, and intake files it.** (Ruling F.) The
developer answered in plain words, so the capture hook — which fires only on a mark and never
classifies intent — did not fire. The assistant therefore does what
`rules/rule-governance.md` § Dictating a rule prescribes for a rule given without the mark:

1. It writes **exactly one** inbox entry, by hand, into the project's inbox — the same inbox and
   the same entry shape the capture hook uses, which intake already parses: a heading with the
   time, the entry kind the parser expects for a project rule, and the session; the developer's
   answer quoted as they gave or confirmed it; **a note saying why the automatic capture did
   not fire** (the answer was given in plain words in the issue-tracking setup conversation,
   which asks for no mark); and a disposition line reading pending.
2. Rule intake files it into `<project>/.claude/rules/project_issue_tracking.md`, dispositions
   the entry, regenerates the index, commits — in that project's own repository — exactly as it
   did for a captured `PRULE:`.

This keeps the dated record, which was the reason the project route went through the inbox in
the first place. It keeps the backstop too, for a well-formed entry: a pending entry the session
fails to file still blocks that project's commits, exactly as a captured one does. What it does
not keep is capture's guarantee that the entry exists and is well formed; see *The honest
limits*.

If the developer types `PRULE:` anyway, out of habit, capture fires and produces the entry; the
assistant then **does not** write a second one by hand. One answer, one entry.

Intake gains **one** piece of routing knowledge and nothing else: a project issue-tracking rule
lands in that named file rather than in a rule group chosen by subject.

**The global answer is written directly by the assistant** into
`~/.claude/rules/global_issue_tracking.md` when the developer answers for every project on this
machine. No mark, no inbox entry — captured or hand-written — no intake, no index regeneration,
no commit. (Ruling A, unchanged by Ruling F.)

**And it writes that one file only.** (Ruling D.) Recording a global answer never touches
`<project>/.claude/rules/project_issue_tracking.md`, whatever that file says. A seeded project's
`unanswered` survives the global write untouched, and that project's prompt fires again next
session. Having the global write also seed the project file is one of the two fixes the owner
was offered and refused, so it is not an improvement a later change may make on its own
authority; test 12 asserts against it.

**Why the two routes differ.** The inbox-and-intake route was the first draft's answer for both
halves, on the reasoning that the inbox entry is the dated record of what the owner said and
when — an assistant that writes a rule file itself produces a file with an answer in it and no
account of who decided it, when, or in what words. That reasoning still holds for the project
half, and that is why the project half still goes through the inbox, now by a hand-written entry
rather than capture. It cannot be applied to the global half, for a reason found while checking
it:

- `~/.claude` **is not a git repository** (verified). There is nothing there to commit to.
- `intake commit --kind universal` files into `rulesSource()` — the *plugin's own* `rules/`
  directory — bumps the plugin version, and commits in the ai-skills checkout. Sending a global
  issue-tracking answer down that route would **ship one developer's tracker to everyone who
  installs machinery.**

So the inbox route's two destinations are both wrong for this file, and the direct write is
what is left.

**What the direct write costs in provenance, stated plainly because the owner accepted it
knowingly.** (Its other cost — that it leaves a seeded project still prompting — is stated
above under Ruling D.) There is **no dated record of what was said, or when, for the global
answer** — which is exactly the property the inbox route exists to provide. The global file
holds an answer and no provenance: no inbox entry quoting the developer's words, no commit, no
history, nothing that says who decided it or on what date. If the line is later found to be
wrong or stale, there is nothing to read back except the line itself. The owner was shown this
trade and took it.

### Opt-out

Answering `none` **is** the opt-out. There is no separate suppression switch, no flag, and no
"don't ask again" state distinct from the answer. Turning the prompt off and answering the
question are the same act, landing in the same file — through a hand-written inbox entry and
intake for the project file, written directly for the global one. *The prompt*, point 3, states
as a requirement the one thing the conversation must not promise about it.

Note what Ruling B does to a global `none`: it stops the prompt only in a project with no
project file. A `none` written globally does **not** silence an installed project, because
that project's own `unanswered` governs. Opting out for a project means answering `none` for
that project.

Ruling D settles that this is deliberate and permanent, with the cost stated: a developer who
answers `none` for every project in order to make an installed project stop asking **will be
asked again next session**, and every session after, until they answer `none` for that project.
The owner was offered the two ways to spare them that — the global answer also writing the
project file, and the prompt not offering the global route inside a seeded project — and took
neither.

## What the file records, and what it never records

Stated by the owner earlier in the same brainstorm and still in force; restated here because
Ruling E brings credentials into the conversation.

**Records:** the route. Which tracker, which project or repository within it, which tool reaches
it, and how to check the route works.

**Never records:** a credential. Not a token, not a password, not an API key — **and not the
name of the place a token is stored.**

**The conversation helps with credentials; the file never holds them.** Under Ruling E the
assistant asks whether the tool is authenticated and offers to help set that up, and the
developer runs any interactive login themselves. None of what that involves — the token, the
account, the credential store, the login command's output — is written into either file, into
the inbox entry, or into anything intake files. The recorded answer names the tool and the check,
and a session that later finds the check failing asks the developer to sign in again rather than
finding a credential to reuse.

The reason is structural, not stylistic. `.claude/rules` is git-tracked, so anything written
there is committed, pushed and mirrored wherever the repository goes. It is also loaded into
every session's context, so anything written there is transcribed into every transcript of
every session. A secret in one of these files is therefore a secret in the history and in the
logs, in that order, and no later edit removes it from either. The project inbox is tracked too,
and is append-only history, so a credential in a hand-written entry is worse still: it is never
edited out.

The global file is not git-tracked (`~/.claude` is not a repository), so the first half of that
reasoning does not reach it. The second half does, in full: it is loaded into every session's
context and therefore into every transcript. The rule is the same for both files.

## The `Check:` line

An answer earns a great deal by saying how to verify itself. Illustrated with placeholders
(Ruling H):

```
Issue tracking: <tracker> on `<project>`, reached with `<tool>`.
Check: `<status command>` and `<one-item read command>`.
```

For GitHub, the check is the same read the conversation used to verify reachability:
`gh auth status` and `gh issue list -R <project> -L 1`.

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
is worded. Under Ruling E the conversation has already run the check once, so the natural
recorded answer carries it; for the project file intake's wording reinforces it. It is named
here as a convention rather than as a mechanism, and the global file has no intake to reinforce
it, so there the convention rests on the conversation alone. The `Check:` line is a read, and
the limits under *The reachability read* apply to every session that runs it.

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

**What is mechanical.** The *decision* whether to ask. Under Ruling G it is taken by a function
that reads both files and implements the precedence table, and the tests exercise that function.
Two sessions on the same machine and project get the same answer from it. The previous revision
listed "the absence check" here, but what it described was a model reading a literal token from
its loaded context and applying the table from memory — a model judging, which no test could
reach. The function is what makes it mechanical, and it is the whole of what this design makes
mechanical beyond install's seeding and intake's routing.

**What is not mechanical.**

- **That the assistant runs the function at all is prose.** The skill instructs it to; nothing
  fails, blocks or reports if a session instead judges from the two files it has loaded, or
  never runs the function. The tests prove the function decides correctly, not that the product
  consults it.
- **The conversation itself is prose.** The assistant is instructed to open with the labelled
  example, ask only what is unknown, one question at a time, and never offer a mark. Nothing
  enforces any of that beyond the check tests 11 and 13 run over the copy.
- **The project entry is written by hand, and loses capture's guarantees.** The capture hook
  writes the entry before the assistant replies and survives a session that ignores its rules or
  dies part-way through. A hand-written entry has neither property: a session that ends between
  the developer's answer and the entry being written loses the answer outright, and the prompt
  fires again next session. Nothing checks that exactly one entry was written, that it carries
  the note, or that it has the shape the inbox parser requires. The two ways to get the shape
  wrong fail in opposite directions: a heading the parser does not recognise is skipped
  silently, so the entry is invisible to intake and to the commit gate and the answer is lost
  with nothing reporting it; a recognised heading with no disposition line makes the parser
  throw, and every tool that reads that inbox fails with it. No command exists for writing such
  an entry; the assistant edits the file.
- **The reachability read is read-only by instruction alone.** See *The reachability read*: the
  tool is the developer's, authenticated as them, and can write. Nothing confines the assistant
  to the read. **No test is added for reachability**, for a reason stated rather than papered
  over: the read is an act the assistant performs under instructions, not code the product runs,
  so a test against a stub tracker would exercise the stub and nothing in the product — the same
  failure this revision exists to remove. Whether the conversation actually runs a real read
  rather than trusting setup can only be observed in a live session.
- **The global answer has no provenance.** Under Ruling A it is written directly, so there is
  no inbox entry, no commit and no date — nothing recording what was said or when. This is the
  one property the inbox route exists to give, and the global half does not have it. The owner
  accepted the trade knowingly; it is a limit, not a defect to be fixed by rerouting the global
  answer through intake, which would ship one developer's tracker to everyone (see *How the
  answer is recorded*).
- **Nothing stops a developer typing `URULE:` about issue tracking anyway.** The capture hook
  fires on the mark alone and never classifies intent, by design, so a mark typed out of habit
  still produces an inbox entry that blocks commits in the repository holding `rulesSource()`,
  and Ruling A gives its content no home there. What Rulings C and F contribute is that nothing
  asks for a mark any more, and that is copy, not a mechanism. Such an entry is an ordinary
  undirected `URULE:` with no home — dismissed with a reason, exactly as
  `rules/rule-governance.md` § Dictating a rule already requires of any rule that turns out to
  have none. A `PRULE:` typed out of habit is harmless by contrast: it is the project route's
  own entry, and the only obligation it creates is that the assistant not add a second one.
- **Nothing verifies that a filed answer is still true.** The `Check:` line above is the
  mitigation and it is opt-in: a session must choose to run it. An answer naming a tracker
  that was abandoned last year reads exactly like one naming the tracker in use this morning.
- **Nothing stops the two files disagreeing in spirit.** Precedence resolves which one governs
  mechanically, so there is no ambiguity about the outcome — and under Ruling B the project
  file governs in every installed project, so a stale global line is largely inert as a
  *decision*. What it still does is pre-fill the conversation, so a global answer nobody has
  revisited will be offered, plausibly, as the suggested answer in a project it no longer fits.
  The developer is the only check on that.
- **The prompt fires once per project, by design, and that is a cost not a bug.** A developer
  with twenty repositories on one tracker is asked in each of them. The pre-fill reduces that
  to twenty confirmations rather than twenty compositions, and nothing reduces it further.
- **In an installed project, answering for every project never stops that project's prompt.**
  The global route writes the global file alone, so the project's own `unanswered` survives and
  the prompt fires again next session, and every session after, until an answer is recorded for
  that project. A developer who answers for every project, expecting to be done, is asked again
  tomorrow. Measured against `developer-friendliness` § 3.2's *"asked once, applied everywhere
  afterward"*, what this design delivers is **asked once per project, and remembered there
  afterward**; the global answer is a pre-fill, not a discharge of the question. This is the
  sharpest cost in the design, and the owner took it with the consequence in front of him
  (Ruling D), having been offered and having refused both ways out — the global write also
  seeding the project file, and the prompt not offering the global route inside a seeded
  project. It is a limit, not a defect: silencing that second prompt is a change to Ruling D and
  needs the owner.
- **A `none` answer is indistinguishable from an answer given to make the prompt stop.** That
  is acceptable — it is the developer's call either way — but it means the count of projects
  answering `none` says nothing about how many projects genuinely have no tracker.

What was listed here in the first draft and is **no longer** a limit: the seeded word and the
reading side drifting apart. Declaring `unanswered` and `none` in `layout.mjs` closes it by the
same mechanism that closes the file names, and under Ruling G the reading side is code that
imports them.

## Tests required

Tests 3, 4, 5, 6, 8, 12 (second half) and 14 call **the precedence function** directly — the
function `developer-friendliness` § 3.2 and § 8 instruct the assistant to run before starting the
setup conversation (see *Precedence*). They prove the decision the product makes; they do not
prove that a session runs it, which is a limit stated under *The honest limits*.

1. **Seeding is idempotent and never overwrites.** `install --machine` run twice creates
   `~/.claude/rules/global_issue_tracking.md` once; the second run leaves it byte-identical.
   Project install likewise for `project_issue_tracking.md`.
2. **An answered file survives install.** A file whose contents are a real answer, a file whose
   contents are `none`, and an empty file are each byte-identical after a re-run of the install
   that would seed that path. Asserted separately from test 1, because "does not create twice" and "does
   not reset an answer" are different failures and a single assertion passes on one of them.
3. **A project `unanswered` asks, whatever the global file says.** The function returns *ask*
   with the project file `unanswered`, asserted three times over — global `unanswered`, global
   `none`, global carrying a tracker line — because the third case is the one Ruling B decided
   and the one a later "simplification" will break first. A function that suppresses the ask on
   a global answer must fail this test.
4. **A project `none` does not ask, and a project answer does not ask.** Each asserted with the
   global file `unanswered` *and* with the global file carrying a different tracker line, so a
   function that consults the global file for the decision at all is caught.
5. **With no project file, the global file governs.** No `project_issue_tracking.md` present:
   a global answer means the function returns *do not ask* and that answer governs; a global
   `unanswered`, an empty global file, or no global file either, means *ask* with no pre-fill.
   This is the absent-project-file row of the precedence table and the only row where the global
   file decides anything.
6. **The global answer is the pre-fill.** Project `unanswered` with the global file carrying a
   tracker line: the function returns *ask* and its pre-fill is that answer. Asserted because
   Ruling B leaves pre-fill as one of only two jobs the global file has, and a change that made
   the global file entirely inert would otherwise pass every other test here.
7. **The two recording routes, asserted separately.**
   (a) **The project answer arrives by one hand-written entry, and intake files it.**
   (a1) A plain-words answer given to the capture hook — no mark — writes nothing to any inbox,
   so a hand-written entry is never doubled by a captured one.
   (a2) An inbox fixture holding exactly one entry in the hand-written shape — the project entry
   kind, the developer's answer, and the note that automatic capture did not fire — parses as
   one pending entry with its note intact, and intake files it into
   `<project>/.claude/rules/project_issue_tracking.md` — not into a rule group chosen by subject
   — dispositions it, and commits.
   (a3) What these cannot reach, named rather than implied: that the assistant *writes* exactly
   one such entry, with the note, is an act under skill instructions and no code performs it, so
   no unit test here asserts it. See *Open questions*, observation 2.
   (b) The global answer is written directly: recording a global answer produces no inbox
   entry, no intake run, no write anywhere under `rulesSource()`, no plugin version bump and no
   commit. Asserted as a negative over the plugin's own `rules/` directory, because the failure
   this guards against — one developer's tracker shipping to everyone who installs machinery —
   is silent at the moment it happens and visible only after publication. Like (a3), the write
   is the assistant's act and no product code records a global answer; what code can reach is
   that intake has no issue-tracking routing under `--kind universal`. See *Open questions*,
   observation 2.
8. **Positive control: the function still says ask.** A fixture whose project file says
   `unanswered` must make the function return *ask*, and the assertion must fail if the
   function is replaced by one that never asks. Without this, tests 4 and 5 pass for free on a
   function that never asks at all — a design whose failure mode is exactly permanent silence
   must prove the decision is alive before it proves it is quiet.
9. **The names and the state words have one spelling each.** A check over the plugin's source
   refuses either file name, and either of `unanswered` and `none`, written as a literal
   anywhere but `layout.mjs`. Two spellings of a file name is how the installer seeds one path
   and the function reads another; two spellings of a state word is the same failure, silent
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
11. **The conversation offers no mark, for either scope.** A check over the copy where it lives
    — `developer-friendliness` § 3.2 and § 8 — refuses both `URULE:` and `PRULE:` anywhere in
    the issue-tracking conversation. This inverts what the previous revision required (it required
    `PRULE:` on the project route); Ruling F removed that mark and Ruling C the other. Copy is
    the only artifact that carries either, and restoring one is a one-line edit nothing else
    would catch — after which the prompt invites a captured entry the conversation does not
    expect, and, for `URULE:`, one whose content has no home. One exposure the implementation
    has to settle: the same sections will also instruct the assistant how to write the project
    inbox entry, whose heading names the entry kind as `PRULE` without a colon, so the check's
    scope has to separate the copy the developer sees from the instructions the assistant
    follows. Named here rather than picked from a distance. The check ships with a case proving
    it still matches, per `rules/design-invariants.md` § One authority per switch.
12. **Answering for every project leaves a seeded project's file untouched, and that project
    still asks.** Project file `unanswered`; record a global answer; then assert both halves:
    `<project>/.claude/rules/project_issue_tracking.md` is **byte-identical** afterwards — still
    the single word `unanswered` — *and* the precedence function still returns *ask* for that
    project. Both are asserted because they are different failures and either assertion alone
    passes on the other's failure: a later change could seed the project file from the global
    write (breaking the first), or leave the file alone while adding an "answered globally just
    now" suppression somewhere else (breaking the second). This is the test that catches someone
    "helpfully" making the global write also seed the project — the exact fix the owner was
    offered and refused under Ruling D. Distinct from test 3, which asserts what the function
    concludes from a project `unanswered`; this asserts what the *global write* does to that
    file and to the decision after it. The second half calls the function; the first half, like
    7(b), has no product code performing the global write — see *Open questions*, observation 2.
13. **The conversation does not promise that a machine-wide answer stops the asking here.** A
    check over the artifact test 11 already covers refuses copy that attaches an end-of-asking
    promise to the machine-wide answer, which is the requirement stated under *The prompt*,
    point 3. Copy is the only artifact that carries it, and a well-meant rewording to "tell me
    once and I'll stop asking" is a one-line edit nothing else would catch, after which the
    conversation tells the developer something Ruling D decided is false. The requirement is
    kept from the previous revision; the wording it was fitted to no longer exists, so **its
    pattern is written against the conversation's copy at implementation time**, when there is
    copy to write it against — this document writes none. The check ships with a case proving
    it still matches, per `rules/design-invariants.md` § One authority per switch.
14. **An empty file is read as `unanswered`.** (Ruling H.) Project file empty: the function
    returns *ask*, with the global file `unanswered` and again with the global file carrying a
    tracker line, and in the second case the pre-fill is that line — the empty project file does
    not hand the decision to the global file. Global file empty with no project file: the
    function returns *ask* with no pre-fill. And an empty project file and an absent project
    file, each with the global file carrying an answer, return different decisions — *ask* and
    *do not ask* — so a function that treats empty as absent is caught.

**Not added: a test that reachability is checked by a real read.** The read is performed by the
assistant under instructions, not by product code, so no test can reach it without a live
tracker and a live session; a stub-tracker test would exercise only the stub. Stated under *The
honest limits*.

## Places in the code this touches

- **`plugins/machinery/scripts/install.mjs`** — both paths. `installMachine()` seeds the global
  file next to the `~/.claude/rules/machinery` junction it already creates; `installProject()`
  seeds the project file into the `.claude/rules` directory it already creates, and stages it
  with the rules index it already regenerates and stages.
- **`plugins/machinery/scripts/lib/` — the precedence function** (Ruling G). A new module there,
  name the implementation's to choose, that reads both files and returns whether to ask and what
  to pre-fill, importing the file names and state words from `layout.mjs`. It is the function
  tests 3, 4, 5, 6, 8, 12 (second half) and 14 call. **Plus a command-line entry in `plugins/machinery/scripts/`**
  that runs it and prints its result, because the caller is an assistant following a skill, not
  another module. It writes nothing.
- **`plugins/machinery/scripts/intake.mjs`** and
  **`plugins/machinery/skills/rule-intake/SKILL.md`** — the one piece of routing knowledge: a
  **project** issue-tracking rule has a named home rather than a home chosen by subject. The
  skill's step 2 ("decide … the rule file it joins") is where the routing is stated; the script
  is where it is enforced. The entry reaching intake is now hand-written (Ruling F); intake
  already parses an entry of the shape the capture hook writes, and the hand-written entry uses
  that shape, so no parsing change is designed here. **No global route is added.** Under
  Ruling A the global answer never reaches intake, and in particular `--kind universal` gains
  nothing for issue tracking.
- **`plugins/machinery/scripts/capture.mjs`** — **unchanged**, named so nobody changes it: it
  fires on a mark alone, and the conversation offers none, so it does not fire for the answer.
  Test 7(a1) relies on that behaviour as it stands.
- **`plugins/developer-friendliness/skills/developer-friendliness/SKILL.md` § 3.2 and § 8** —
  the two places that say "asked once, applied everywhere afterward", and now the home of the
  whole conversation. Both name where the answer is stored, what the three states mean, which
  file governs, and which of the two routes records the answer, so the instruction stops being a
  claim with no mechanism. Specifically they carry:
  - the instruction to **run the precedence function** and start the conversation if and only if
    it says to ask — the one call site for Ruling G, and a reference from this skill to a
    machinery script that the skill has not carried before (*Open questions*, 1);
  - **the setup conversation** of Ruling E, following *The prompt* — labelled example, only the
    unknown questions, one at a time, placeholders wherever a value is illustrated (Ruling H), no
    mark (test 11), no promise that a machine-wide answer ends the asking here (test 13);
  - **the reachability read's limits** as stated under *The reachability read*;
  - **the credential rule**: help the developer get signed in, write none of it anywhere;
  - **the hand-written inbox entry** for the project answer (Ruling F), including the note, the
    one-entry rule when capture already fired, and running intake afterwards;
  - **the global direct write** (Ruling A), and Ruling D's limit on it — the global file only,
    never the project one — since no script performs or enforces that write.
- **`plugins/machinery/scripts/lib/layout.mjs`** — the sole authority on machinery file names.
  Both file names **and both state words** are declared there, exactly as `RULES_INDEX`,
  `SPEC_INBOX` and the rest are, and none of the four is ever spelled at a call site.
  `layout.mjs`'s own header states the reason: *"A name spelled in two places is a name that
  can drift, so it is declared once here and both read it."* Three units now name these files
  and none can import another — the installer seeds them, the precedence function reads them,
  and intake routes to one of them — which is precisely the condition `layout.mjs` exists for.
  The state words have two of those units, install and the function, and a worse failure mode,
  since a mismatch there is silent.

## Relation to #99 / #100

Ticket #99 records the problem; companion #100 carries its pickup context. This specification
is the design for that ticket and **supersedes the "shape of the fix" recorded on it**, which
described the detection-and-survey wizard rejected above. The problem statement on #99 is
unchanged and still accurate; only the shape of the fix is replaced.

The ticket pair is not edited by this change. Bringing #99 and #100 into line with this
document is a separate, deliberate act by whoever picks the work up, and it should cite this
path rather than restate the design. The implementation plan on `issue-tracking-plan` was
written from the previous revision and is superseded by this one; it is not edited here either.

## Open questions

Two questions are open, recorded rather than resolved, followed by observations found while
revising. Neither the questions nor the observations may be settled by an implementer on their
own authority.

**1. Ruling G makes the `developer-friendliness` skill depend on machinery.** The precedence
function lives in machinery (`plugins/machinery/scripts/lib/`), but the conversation is
specified in the `developer-friendliness` skill, which ships as its own plugin and has so far
carried no reference to machinery (checked: nothing under `plugins/developer-friendliness/`
names it). The seeded files exist only where machinery is installed, so the decision was
machinery-dependent either way; but an instruction in the skill that names a machinery script
breaks outright in a project or on a machine without machinery. Open: what the skill does there
— whether it falls back to something, says the function is unavailable, or stays silent about
issue tracking. The project route has the same dependency and it is part of the same question:
the inbox, intake and the project file are all machinery's, so in a project without machinery a
developer who answers "this project only" has no inbox to write to and no intake to file it,
while the absent-project-file row of the precedence table still says to ask. The skill's
instructions for writing that entry would also spell out machinery's inbox location and entry
shape, a second reference of the same kind.

**2. The reachability read touches the live tracker, and read-only is not enforced.** *The
reachability read* states what the read may do (one read, and the tool's status query) and what
it must never do (anything that writes to the tracker, even a test issue; any change to the
tool's authentication or configuration). Nothing enforces that beyond the instruction: the tool
is the developer's own, authenticated as them, and fully able to write. Open: whether anything
should confine it, and what.

**Observations** — things this revision found that look wrong or unsettled, recorded without
redesigning:

1. **When the function is run is not specified.** The design says the assistant runs it to
   decide whether to start the conversation, but not at what moment — at session start, or when
   a record first needs a place under § 3.2. The previous revision was equally silent about when
   the prompt fired. The answer changes how often the function runs and when the developer is
   interrupted.
2. **Three assertions still have no product code to exercise.** The same problem that prompted
   this revision survives in 7(a3), 7(b) and the first half of 12: the hand-written project
   entry and the global write are both acts the assistant performs under skill instructions, so
   no code "records a global answer" or "writes exactly one entry" for a test to call. Each is
   marked at the test. What would make them testable — a command that writes the entry or the
   global file — is not designed here, because Ruling A decided the global write has no pipeline
   and Ruling F decided the entry is written by hand.
3. **The hand-written entry has to match the inbox parser exactly, and nothing helps write it.**
   The parser requires a heading of a fixed shape, with an entry kind of `PRULE`, `URULE` or
   `SPEC` (the kind for a project rule is `PRULE`), followed by a disposition line. An
   unrecognised heading is skipped silently and a recognised one without a disposition line
   throws — both stated as a limit under *The honest limits*. No command exists for appending an entry by hand — the library function
   that does it is called only by the capture hook. Separately, from inside an isolated working copy, the capture hook writes to
   the project root's inbox, and the skill's instructions for a hand-written entry have to name
   that same inbox or the entry lands where intake does not look.
4. **"Verbatim" is not well defined for an answer given across a conversation.** A captured
   `PRULE:` is one prompt, quoted word for word. Ruling E's answer is assembled over several
   turns — tracker, project, tool, check, scope — and some parts are confirmations of what the
   assistant proposed. Which words the hand-written entry quotes as the developer's is not
   settled, and the inbox is append-only history, so whatever is written stays.
5. **An answer for both scopes is not ruled on.** The scope question offers this project or
   every project on this machine. A developer who says "both" is giving two answers, which would
   be two recordings on the developer's explicit word — distinct from the global write seeding
   the project file on its own, which Ruling D refused. Whether the conversation offers or
   accepts "both" was not put to the owner.
6. **Whitespace-only files are not covered by Ruling H.** Ruling H settles an empty file. A file
   containing only whitespace or a newline, and whether the state words are compared after
   trimming, is the implementation's to state; install's own seed presumably ends with a newline,
   so the comparison cannot be byte-exact against the bare word.

How the earlier questions were closed, so a later reader does not have to reconstruct it:

| Recorded as | Closed by |
|---|---|
| 1 — should the global answer travel capture and intake | **Ruling A**: written directly, no capture |
| 2 — where the state words are declared | Decided alongside Rulings A and B: in `layout.mjs`, written up under *Three states* |
| 3 — what governs when there is no project file at all | Promoted into the mechanism as designed behaviour, under *What the global file is actually for* |
| 4 — does a global answer suppress a project `unanswered` | **Ruling B**: no; each project answers for itself |
| 5 — should detection speak up when it contradicts the answer | Moved to *Recommendations*, marked **not put to Gabe** |
| added by the second revision — what intake should do with a `URULE:` about issue tracking | **Ruling C**: the prompt stops asking for the mark; now subsumed by **Ruling F** |
| raised while checking Ruling B — is it acceptable that a developer who answers globally in a seeded project is asked again next session | **Ruling D**: yes; leave it and keep prompting. Both ways out were offered and refused |
| surfaced by the plan — six tests with no reader to test | **Ruling G**: the precedence function decides, and the tests call it |
| surfaced by the plan — the illustration read as literal copy | **Ruling H**: placeholders; and **Ruling E** replaced the illustration with a conversation |
| raised with Ruling E — how the answer is saved without a mark | **Ruling F**: the assistant writes the inbox entry by hand and intake files it |

Things that are **not** open questions, named here because each could be mistaken for one:

- **A developer can still type a mark unprompted.** Rulings C and F remove the invitation, not
  the ability. A `URULE:` about issue tracking is an ordinary undirected rule with no home, which
  `rule-governance.md` already says how to handle, and it is recorded as a limit under *The
  honest limits*; it is still not a licence to route the global answer into `rulesSource()`
  after all. A `PRULE:` is the project route's own entry, and the assistant writes no second
  one.
- **Detection speaking up when the answer contradicts what it found** is a **recommendation
  that was never put to Gabe**, not a question awaiting his answer. It sits under
  *Recommendations* and says so there. A later change may drop it without departing from any
  ruling — which is exactly what distinguishes it from the rows above that record decisions,
  none of which may be reopened without the owner.
- **What the conversation finally says.** The illustration is not copy and this document fixes
  none, so an unwritten sentence is not an open question. The behaviour behind it is decided:
  under Ruling B a machine-wide answer does not silence a project whose own file says
  `unanswered`, and under Ruling D that is deliberate and permanent. *The prompt*, point 3,
  therefore states the constraint that follows as a requirement, test 13 checks it, and the copy
  is written to it.
