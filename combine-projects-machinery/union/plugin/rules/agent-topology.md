# Agent topology

What gets dispatched to a subordinate agent, how many run at once, which model
each runs on, where each one works, and the conventions every standing agent
definition obeys. Loaded at session start.

## What gets dispatched

- Work is dispatched to a subordinate agent by default. The main conversation
  keeps only design, adjudication, verdicts, relaying, and checking what comes
  back.
- Size never decides whether to dispatch. The test is intent: reading something
  to answer a question is conversation, reading it in order to change it is
  work, and work is dispatched.
- What this conserves is the main conversation's own attention, not money. A
  dispatched agent absorbs the raw tool output and hands back a summary.
- Pulling a procedure's full text into the main conversation to follow it
  yourself is doing the work. Put the procedure's invocation inside the
  dispatched agent's instructions instead.

## Which model

- Use the cheapest model that can do each dispatched task. Quality is held by
  the checks on the result, never by paying for a bigger model.
- Match the model to the kind of work: the cheapest tier for enumerating and
  extracting with citations, a mid tier for synthesis and judgement, and the
  main conversation's own model only for design, adjudication and verdicts.
- When a cheap agent's work fails its spot-check, redo that batch one tier up
  and record that you did. Never re-run it silently.
- A plan says which model each kind of task runs on.

## How many at once

- One agent at a time within a kind of task. Different kinds may run at the same
  time without asking.
- The standing kinds of task are doing the work, reviewing it, and filing rules,
  and the set stays open: name a new kind when the work genuinely calls for one,
  and only the owner may name it — an agent never invents a kind in order to
  claim a second slot.
- Dispatch one, wait for it, check its result, and only then dispatch the next
  of that kind. Tasks being independent is not permission to run them together.
- Before dispatching, check what is actually running, using the view that shows
  live agents rather than a list of tasks.
- Every dispatch tells the agent it may not spawn agents of its own. An agent
  that fans out is a fan-out regardless of what kind of task it was.
- Anything that fans out by construction runs only when the user explicitly asks
  for it, never on the assistant's initiative and never floated as a suggestion.

## Batching

- A long job made of many self-contained pieces is dispatched in batches. One
  agent per piece pays the setup cost over and over; all of it in one agent
  buries the late pieces and loses everything on a single failure.
- Batching changes how much goes into one dispatch, never how many run at once.
  Batches still go one at a time, each checked before the next.
- Pieces may share a batch only if they can run on their own: no ordering
  between them and no shared state. A piece that consumes another's output is
  not independent.
- Report how many batches there were and what each covered, so a partial failure
  names exactly what did not run.

## Where an agent works

- All work happens in an isolated working copy of its own, however small the
  work is; there is no general size exception. The shared copy is reserved for a
  short, named list of operations that run there by convention: filing a
  dictated rule — both the capture and the filing commit — so that every active
  working copy, all of which live under the project root, sees the new rule the
  next time a session there starts; merging a finished effort's branch into the
  shared line once every verification leg is green, and pushing it; and
  creating, listing and tearing down the working copies themselves. Anything not
  on that list gets a copy of its own.
- At most one agent per working copy. Two agents in one copy each mistake the
  other's half-written files for the state they are reasoning about, and neither
  can tell which changes are its own. An agent's promise not to touch things is
  not a mechanism; sharing happens only when the owner asks for it.
- An agent reviewing or exercising work that is still in progress gets its own
  working copy of that branch — not the shared one, and not the copy the working
  agent is writing into. Create one if it does not exist.
- A stand-in service started for a piece of work runs from that work's own
  working copy, never the shared one and never shared between jobs, so it serves
  the code under test. This gives the process a visible owner but does not stop
  it: removing the working copy does not kill what was started from it.
- Name each agent at spawn for the kind of work and the thing it is working on.
  The tooling shows only an opaque identifier, so without the convention you
  cannot see at a glance what is already running.

## Working with the owner

- When one participant's approach to a problem has failed twice, the next
  attempt goes to the other's suggestion. The count is kept honestly and applies
  to both sides equally.
- A structural change to something several parallel lines of work depend on gets
  sign-off from those lines, through the shared record that tracks that seam,
  before it lands.

## Defining a standing agent

- Each standing agent is declared in one file: the question it answers, the
  triggers that should reach for it, the exact tools it is given, and the model
  it runs on. Nothing about it is folk knowledge.
- A standing agent answers one question and says which. Anything outside it is
  named in a line and dropped, not pursued, because an agent that widens its own
  scope stops being predictable.
- Each agent names the other agents whose questions are not its own, hands those
  off, and does not duplicate their checks.

## Containment is structural

- An agent that only judges is given no ability to run commands or write files,
  so it cannot move or damage anything. The capability is removed, not
  forbidden: a rule in the prompt is a promise.
- Removing a capability has a consequence, and the agent's own definition states
  it. An agent that cannot work out its own scope has it supplied by the caller;
  given none, it says so and stops. It never substitutes the whole codebase, and
  never guesses the scope from timestamps or file contents.
- Where a job genuinely needs to build and run things, containment is weaker and
  the definition says so, replacing it with an explicit allowlist of the build,
  test and read-only inspection commands the agent may use.
- An agent that verifies never integrates: every command that moves a reference
  or mutates the working copy is forbidden by name, not left to judgement.
- An agent that judges does not touch: no reviewer creates, moves or deletes
  branches, merges, force-resets a shared reference, or pushes.
- A reviewing agent never stages the owner's own protected working records,
  whatever else it was asked to look at.
- An agent doing implementation work in parallel with others owns exactly one
  unit and writes only files inside it. Ownership is by directory, so two agents
  cannot collide over the same file.
- An agent that generates content never commits to a protected branch. An
  adversarial review pass and a person both stand between it and the shared
  line.

## What an agent may conclude

- A scan's output is a suspicion, never a fact. A flagged candidate is acted on
  only after a person has read the code and recorded a confirmation naming the
  exact place — never because the tool said so.
- An agent owns none of the designs it works across. For each it names the
  authority and verifies against it, read fresh every time, because restating
  elsewhere a fact that lives somewhere is how that fact rots.
- Where the authority for a decision is a record that has not been ratified, its
  content is still the best available description of how the thing actually
  behaves. But any question that record itself leaves open stays genuinely open:
  reading it does not close it.
- An undecided question is filed as work and the agent stops. It is never
  blocked on, never silently resolved, and never improvised: an agent applies
  authority, it does not adjudicate design.
- Automatically generated proposals pass a verification gate before any person
  spends attention on one: whatever does not survive the build, the tests and the
  relevant checks is discarded unread. Attention is the scarce thing the gate
  protects.

<!-- rows: 4.1–4.25, 12.1–12.11, 12.22, 12.28, 12.34, 12.46–12.47 -->
