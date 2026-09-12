# Issue tracking configuration: asking once, and remembering the answer

Date: 2026-09-12. Branch and working copy: `issue-tracking-config`.
Owner: Gabe. Design settled in a brainstorm on 2026-09-12; this records it, question by
question, as it was decided. Ticket #99, companion #100.

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

So **none of that machinery is built.** What is built is two files, three states, and one
piece of routing knowledge added to intake.

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

| Contents | Means | Prompt fires? |
|---|---|---|
| `unanswered` | install seeded it; nobody has been asked | yes |
| `none` | asked and answered: no issue tracking here | no |
| anything else | the answer | no |

Two states were tried first and were wrong. In that version install seeded the file with
`none`, and `none` meant "stop asking". A freshly installed machine and a deliberate "we do
not track issues here" then produce byte-identical files — so the prompt can never fire, for
anyone, ever. The seeded state and the answered-negative state must be different words, or the
whole design is inert.

This is the mistake a later reader is most likely to re-introduce, because it looks like a
simplification: two states, one fewer word, the same behaviour by inspection. It is not the
same behaviour. **`unanswered` and `none` are distinct states and neither may be merged into
the other, nor into absence of the file.**

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

When neither file carries an answer — both say `unanswered`, or are absent — the
`developer-friendliness` skill asks. The owner's own draft of the wording, quoted here as the
intent rather than as final copy:

> I don't see issue tracking configured globally or for this project. File a `URULE:` for
> issue tracking global config, or a `PRULE:` for issue tracking in this project. If you would
> like to disable this prompt, issue that request in the appropriate `URULE:` or `PRULE:`.

**Plus one addition the owner approved: the prompt offers a ready-made rule line.** It is
derived from what can be detected cheaply — the git remote, whether `gh`, `jira` or `linear`
is on `PATH` and authenticated, whether an issue-tracker MCP server is connected — so that in
the common case the developer confirms a line rather than composing one.

Detection has exactly one job, and the boundary is hard: **detection informs the suggestion and
never writes anything.** No detected fact becomes the answer. Nothing is filed until the
developer dictates it with a mark, because the answer is the developer's statement, not the
machine's inference about their project.

### The answer travels the existing pipeline

The developer answers with `URULE:` or `PRULE:`. From there nothing is new:

1. The capture hook writes the prompt to the inbox **verbatim, before the assistant replies**.
2. Rule intake files it, dispositions the entry, regenerates the index, commits.

Intake gains **one** piece of routing knowledge and nothing else: an issue-tracking rule lands
in one of these two named files rather than in a rule group chosen by subject.

**Why capture rather than the assistant writing the file directly** — an alternative the owner
considered and rejected: the inbox entry is the dated record of what the owner said and when.
An assistant that writes `project_issue_tracking.md` itself produces a file with an answer in
it and no account of who decided it, when, or in what words. The pipeline exists precisely so
that a standing decision carries its provenance; an issue-tracking answer is a standing
decision like any other and goes the same way.

### Precedence

**A project answer wins over the global one where both are set.** The global file is the
default for every project on the machine; the project file overrides it for that project.

Two combinations are worth spelling out, because each can be read two ways.

**A global tracker and a project `none`** means *this project does not track issues*, and the
prompt does not fire. Precedence is about which file governs, not about which file carries more
information.

**A global answer and a project `unanswered`** does not prompt either: `unanswered` is not an
answer, so there is nothing to override with, and the global answer applies. This follows the
owner's own draft wording — *"I don't see issue tracking configured globally **or** for this
project"* — which makes the trigger an absence of both. So the full rule is: **the prompt fires
only when neither file carries an answer; precedence decides which answer governs when both do.**
The three-state table above is per file and answers "does this file carry an answer"; this
paragraph is what combines two files into one decision. (Recorded as open question 4: the
table and the draft wording were settled separately, and this reading was taken from the
wording rather than ruled on directly.)

### Opt-out

Answering `none` **is** the opt-out. There is no separate suppression switch, no flag, and no
"don't ask again" state distinct from the answer. Turning the prompt off and answering the
question are the same act, expressed as a rule like every other answer, through the same
capture-and-intake pipeline, landing in the same file.

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

Nothing enforces that an answer carries a `Check:` line. It is a convention of how the answer
is worded, offered by the prompt's ready-made line and reinforced by intake's wording, and it
is named here as a convention rather than as a mechanism.

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
- **Nothing verifies that a filed answer is still true.** The `Check:` line above is the
  mitigation and it is opt-in: a session must choose to run it. An answer naming a tracker
  that was abandoned last year reads exactly like one naming the tracker in use this morning.
- **Nothing stops the two files disagreeing in spirit.** Precedence resolves which one governs
  mechanically, so there is no ambiguity about the outcome — but a global answer naming one
  tracker and a project answer naming another are equally plausible states of the world, and
  no check can tell a deliberate per-project override from a stale global line somebody forgot.
- **Nothing keeps the seeded word and the reading prose in step.** `unanswered` is a literal
  string written by install and matched by the skill's prose. If one changes and the other does
  not, the prompt silently stops firing — which looks exactly like a machine where everything
  has been answered. Declaring both file names in `layout.mjs` (below) fixes the *file names*;
  the *state words* are a separate spelling with the same exposure, and this design does not
  close it.
- **A `none` answer is indistinguishable from an answer given to make the prompt stop.** That
  is acceptable — it is the developer's call either way — but it means the count of projects
  answering `none` says nothing about how many projects genuinely have no tracker.

## Tests required

1. **Seeding is idempotent and never overwrites.** `install --machine` run twice creates
   `~/.claude/rules/global_issue_tracking.md` once; the second run leaves it byte-identical.
   Project install likewise for `project_issue_tracking.md`.
2. **An answered file survives install.** A file whose contents are a real answer, and a file
   whose contents are `none`, are both byte-identical after a re-run of the install that seeded
   them. Asserted separately from test 1, because "does not create twice" and "does not reset
   an answer" are different failures and a single assertion passes on one of them.
3. **`unanswered` prompts.** With both files containing `unanswered`, the prompt condition
   holds.
4. **`none` does not prompt.** With a file containing `none` and the other `unanswered`, it
   does not — asserted for the global file and for the project file separately.
5. **A real answer does not prompt.** With a file containing a tracker line and the other
   `unanswered`, it does not — again asserted for each file separately, since a detector that
   only ever reads one of the two passes a combined assertion.
6. **Project beats global.** Global naming one tracker and project naming another: the
   project's answer is what governs. Global naming a tracker and project `none`: no prompt,
   and `none` governs. Global answered and project `unanswered`: no prompt, and the global
   answer governs — `unanswered` is not an override.
7. **Intake routes an issue-tracking rule to the right file.** A captured `PRULE:` about issue
   tracking is filed into `<project>/.claude/rules/project_issue_tracking.md`, and a captured
   `URULE:` about issue tracking into `~/.claude/rules/global_issue_tracking.md` — not into a
   rule group chosen by subject.
8. **Positive control: the prompt detector still fires.** A fixture whose files both say
   `unanswered` must produce the prompt condition, and the assertion must fail if the detector
   is disabled. Without this, tests 4 and 5 pass for free on a detector that never fires at
   all — a design whose failure mode is exactly permanent silence must prove the detector is
   alive before it proves the detector is quiet.
9. **The names have one spelling.** A check over the plugin's source refuses either file name
   written as a literal anywhere but `layout.mjs`. Two spellings of a file name is how the
   installer seeds one path and the reader reads another. Prose that quotes a name — this
   specification, a skill's instructions — is not source and is not in the check's scope.
10. **The seed contains no credential-shaped content.** The seeded file's entire contents are
    the single state word. Asserted directly, so a later change that seeds a detected remote, a
    token path or an account name into the file fails rather than ships.

## Places in the code this touches

- **`plugins/machinery/scripts/install.mjs`** — both paths. `installMachine()` seeds the global
  file next to the `~/.claude/rules/machinery` junction it already creates; `installProject()`
  seeds the project file into the `.claude/rules` directory it already creates, and stages it
  with the rules index it already regenerates and stages.
- **`plugins/machinery/scripts/intake.mjs`** and
  **`plugins/machinery/skills/rule-intake/SKILL.md`** — the one piece of routing knowledge: an
  issue-tracking rule has a named home rather than a home chosen by subject. The skill's step 2
  ("decide … the rule file it joins") is where the routing is stated; the script is where it is
  enforced.
- **`plugins/developer-friendliness/skills/developer-friendliness/SKILL.md` § 3.2 and § 8** —
  the two places that say "asked once, applied everywhere afterward". Both name where the
  answer is now stored and what the three states mean, so the instruction stops being a claim
  with no mechanism.
- **`plugins/machinery/scripts/lib/layout.mjs`** — the sole authority on machinery file names.
  Both names are declared there, exactly as `RULES_INDEX`, `SPEC_INBOX` and the rest are, and
  are never spelled at a call site. `layout.mjs`'s own header states the reason: *"A name
  spelled in two places is a name that can drift, so it is declared once here and both read
  it."* Two units name these files and neither can import the other — the installer seeds them
  and the intake routes to them — which is precisely the condition `layout.mjs` exists for.

## Relation to #99 / #100

Ticket #99 records the problem; companion #100 carries its pickup context. This specification
is the design for that ticket and **supersedes the "shape of the fix" recorded on it**, which
described the detection-and-survey wizard rejected above. The problem statement on #99 is
unchanged and still accurate; only the shape of the fix is replaced.

The ticket pair is not edited by this change. Bringing #99 and #100 into line with this
document is a separate, deliberate act by whoever picks the work up, and it should cite this
path rather than restate the design.

## Open questions

Recorded, not resolved. None of them is a licence to change the design above.

1. **Where a global answer is committed, and by what.** `intake commit --kind universal` writes
   into `rulesSource()` — the plugin's own `rules/` directory — bumps the plugin version, and
   commits in the repository holding it. `~/.claude/rules/global_issue_tracking.md` is in
   neither: it is machine-local, user-specific, and normally not inside any git repository at
   all. A global issue-tracking answer must **not** go into the plugin's `rules/`, or one
   developer's tracker ships to everyone who installs the plugin. So the global route is a
   third destination that the intake's two existing kinds do not describe, and it has no commit,
   no index regeneration and no version bump to perform. Meanwhile the `URULE:` that carries the
   answer captures into the universal inbox, which *is* inside the repository holding
   `rulesSource()` and *does* block that repository's commits until dispositioned. How an entry
   in a tracked inbox is dispositioned when its filed home is an untracked file outside every
   repository is not settled by this design.
2. **Whether the state words belong in `layout.mjs` too.** The file names are declared there;
   `unanswered` and `none` are not, and they have the same drift exposure — worse, in fact,
   because a mismatch there fails silently rather than loudly. Declaring them alongside the
   names is the obvious answer and was not put to the owner.
3. **What a project with no `.claude/rules/` does.** Project install creates the directory, so
   an installed project always has one. A project that has never run the install has no seeded
   file and no `unanswered` token, which is a fourth condition — *absent* — that reads as "not
   installed", not as "answered". This design does not say what the prompt should do there, and
   the honest answer may be nothing at all.
4. **How the two files combine into one prompt decision.** The three-state table was settled as
   a property of a single file, and the prompt wording was drafted separately. They do not
   overlap on the case of a global answer with a project `unanswered`. *Precedence* above reads
   it from the draft wording's "globally **or** for this project" — the global answer applies
   and nothing prompts — because that is the owner's own sentence rather than an invention.
   The other reading, that the project file governs whenever it exists and its `unanswered`
   therefore prompts, is not absurd: it would mean every newly installed project asks once even
   on a machine that has already answered globally. This was not put to the owner as its own
   question and should be confirmed before the tests in 3–6 are written against it.
5. **Whether detection should say what it found when the developer declines.** The prompt offers
   a ready-made line from detected facts. If the developer answers something that contradicts
   the detection — `none` on a project with an authenticated `gh` and a GitHub remote — nothing
   says so, and `rules/design-invariants.md` § Telling the user what you dropped would
   ordinarily want a word about it. Not raised with the owner.
