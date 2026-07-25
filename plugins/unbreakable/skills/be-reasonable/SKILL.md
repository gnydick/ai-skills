---
name: be-reasonable
description: Use when making any design choice that is not an invariant — precision, defaults, timeouts, retries, naming, config, logging, error text, test level, cache policy, deploy shape, output format, and who runs the tooling under a context budget; enforces four moves (derive the choice from the situation, lean toward the mistake that is cheaper to undo, split any decision serving two masters, ask the developer when two answers are genuinely defensible and offer only options that exist); includes the storage-vs-presentation worked example, how to read an asymmetry, and a domain appendix showing the method already applied
---

# Skill: derive the choice, lean toward the cheaper mistake, split two masters, ask when it's genuinely open

Four moves, in order, on every design decision that is not an invariant:

1. **Derive it.** The choice comes from the situation — the source, the
   consumer, the measured behavior, the constraint. If you cannot say what you
   derived it from, you inherited it from habit, and habit is not a design.
2. **Lean toward the cheaper mistake.** Where you are uncertain, take the option
   whose error is recoverable, loud, and paid by you rather than silent,
   permanent, and paid by someone downstream.
3. **Split what has two masters.** A single decision being pulled by two
   different concerns is two decisions wearing one name. Separate them and let
   each answer to its own.
4. **Ask when it is genuinely open.** Two defensible answers, and the difference
   is visible to whoever uses the thing: **ask the developer you are working
   with, while you are writing the code** — not the end user, not by inventing a
   setting — and offer only the options that actually exist.

And a fifth that prevents the first four from becoming a ritual: **where there
is no asymmetry, there is nothing to deliberate.** Pick, note it, move on.

This governs choices. It does not govern invariants: once a property is named an
invariant, it is enforced at the highest rung the language allows, and nothing
here is a reason to stop short of that.

The full reference follows.

# Be Reasonable

**The definition.** A choice is *reasonable* when it was **derived** rather than
inherited: when you can state what in the situation produced it, and why the
alternative is worse *here*, without appealing to what is usually done.
Reasonableness is not moderation and not a preference for less. Extreme
precision, extreme strictness, and extreme simplicity are all reasonable when
the situation produces them. What makes a choice unreasonable is not its
position on a scale — it is that the position was never derived.

The test: *"Can I say what I paid, what I bought, and what in this situation
made the exchange favorable — in one sentence, without saying 'best practice'?"*
If the justification is that this is how it is normally done, the decision has
not been made yet. It has been inherited, and inherited decisions are correct
only by coincidence.

**Why this is a skill and not a personality.** Most design choices are small,
frequent, and made quickly — a precision, a default, a timeout, a name, a log
line. Their cost is invisible individually and enormous in aggregate, and
because none of them is momentous, none of them attracts deliberation. The four
moves are cheap enough to run on a decision that does not feel worth
deliberating, which is precisely the decision this skill exists for.

---

## 1. The method

### 1.1 Derive it

The inputs to a design choice are in front of you: what the source actually
produces, what the consumer actually needs, what the measurement actually says,
what the constraint actually is. A choice is derived when it is a function of
those, and inherited when it is a function of what you typed last time.

The failure has recognizable forms:

- **The round number.** Thirty seconds, three retries, a hundred items per page.
  Round numbers are almost never measurements; they are the shape of a guess.
  A derived number is odd-looking because reality is.
- **The tutorial default.** A value that arrived with an example and was never
  reconsidered against the system it now runs in.
- **The habit.** The precision, the structure, or the pattern you always reach
  for, applied to a situation that did not ask for it.
- **Cargo cult.** A choice justified by where it came from rather than by what
  it does here. A rule that made sense at a scale, in a language, or under a
  constraint you do not have is not a rule you have.

Deriving does not require research. It requires naming the input: *"seconds,
because the source clock ticks in seconds"* is a complete derivation. The point
is not rigor, it is that an input was consulted.

### 1.2 Lean toward the cheaper mistake

You will be uncertain often; the four moves do not remove uncertainty, they
route it. Under uncertainty, take the option whose error costs less to discover
and undo. **This is not caution.** Sometimes the cheaper mistake is the
aggressive one: keeping more than you need, failing harder than feels polite,
being stricter than the caller expected. Cheapness is about recovery, not
timidity.

How to read the asymmetry — §3.

### 1.3 Split what has two masters

When one decision is being pulled in two directions, the usual instinct is to
compromise, and the compromise serves neither. Look instead for the seam: nearly
always the two pulls come from two different concerns, and once separated each
gets its correct answer at full strength rather than a blend that is wrong for
both.

The canonical seam is **storage versus presentation** (§2), where the store
answers to the source and the view answers to the reader. But the pattern
recurs everywhere: a caller's deadline versus a server's retry budget; a
metric's collection resolution versus its retention; what an error reports to a
user versus what it records for a diagnosis; the strictness of a parser at a
trust boundary versus inside it. Each of these looks like one number to tune and
is two numbers with different owners.

The tell: you find yourself saying "but then it would be too much for X." That
sentence names the second master.

### 1.4 Ask when it is genuinely open

Most choices are not open — they are derivable, and you derive them and move on.
A choice is genuinely open when **two answers are defensible after deriving**,
and **the difference is visible** to whoever uses the result. That combination
is the trigger, and both halves matter: an invisible difference is not worth a
question, and a visible difference with one defensible answer is not a question
either.

Details in §4, including who to ask and how to bound the offer.

### 1.5 Where there is no asymmetry, do not deliberate

Some choices are genuinely arbitrary: two orderings that read the same, two
names that are equally clear, two structures with identical consequences.
Deliberating them is not thoroughness, it is a tax paid to the appearance of
care. Pick one, be consistent with it, and spend the attention on a decision
that has a shape.

Consistency is itself a derivation: *"this way, because everything adjacent is
this way"* is a complete answer, and a better one than a fresh preference.

---

## 2. The worked example: storage and presentation

One example, worked fully, because it exercises all four moves and because the
underlying rule — about fidelity — recurs constantly.

**Fidelity** is the set of distinctions the source made: the resolution of a
clock, the states a form allows including "unanswered," the exact characters
someone typed, the pixels a camera captured. The question is what to keep and
what to show.

**Move 3 first: two masters.** "How precise should this be?" is not one
question. Storage answers to the source; presentation answers to the reader.
Blend them and you get a store shaped by a screen.

**Move 2: the asymmetry.** These two errors are wildly unequal. A distinction
dropped at write time is unrecoverable — no migration, no query, no later
cleverness restores a digit that was never stored. A distinction dropped at read
time is a formatting change, reversible in one edit. When the costs of the two
errors differ that much, the default is not a matter of taste.

**Move 1: derive each side.**

- *Storage derives from the source.* Keep every distinction the source made, at
  the maximum fidelity the ecosystem holds **natively, by default** — the
  strongest representation the platform and store already speak, not an exotic
  one you construct. Native and maximal, in that order: a custom type for
  digits the platform does not speak buys nothing and pays at every boundary.
- *Presentation derives from the consumer,* and there is rarely one consumer.
  A person scanning a report, a person reconstructing the order of events, a
  machine reading an interface, and an export someone will compute on are four
  readers of one field, and they want different projections. That is not a
  conflict to resolve in the schema; it is four formatters over one store.

Three corollaries fall out:

- **The arrow runs one way.** Requirements flow source → store → view, never
  view → store. "The report only shows minutes, so store minutes" is the entire
  failure in one clause: one reader, present at the moment of writing, setting
  the ceiling for every reader who comes later.
- **Claim no more than the source gave.** Padding a coarse clock with zeros
  does not add precision, it adds *false* precision — worse than coarseness,
  because downstream it is indistinguishable from the real thing.
- **Store the value, never its rendering.** A formatted string has a locale, a
  zone, and a rounding rule frozen into it, none recoverable.

**Fidelity is not only digits.** Three states do not fit in a boolean —
"unknown," "no," and "not applicable" collapse into `false` only by destroying
two of them. Absent is not empty is not zero. Case, spacing, and diacritics are
what someone typed; normalize a *derived* key for matching and never the stored
original. An instant without its zone has lost the question "what did the clock
say there." Originals are kept and derivatives generated beside them, never over
them. Raw series are aggregated on read, because pre-aggregation answers only
the questions somebody thought of in advance.

**Move 4: what remains open.** Display precision below the obvious. Seconds on a
report and full fidelity on a machine interface are derivable; sub-second
precision in a transactional system that people also read by hand is not.
Operators may need to order events inside one second, or may be drowned by six
digits of noise on every row, and which is true is a product fact you do not
have. So you ask — see §4.

**When fidelity must be reduced** for privacy, law, or a cost that is genuinely
load-bearing: do it **late** (at the edge if the edge suffices), **deliberately**
(a decision someone made, not a default nobody noticed), and **on the record**,
with the reason in the terms that motivated it, so the next person can tell a
legal obligation from an old assumption. Silent fidelity loss is the thing this
whole example exists to prevent, and a good reason does not make it quiet.

---

## 3. Reading the asymmetry

Move 2 is the one most often gotten backwards, usually because "cheaper" is read
as "smaller" rather than "easier to undo." Four questions, in priority order:

**1. Which error can be undone, by whom, at what cost?** Recoverability
dominates everything else. An error that a formatter fixes is nearly free no
matter how visible; an error that requires a migration, a coordinated deploy, or
data that no longer exists is expensive no matter how small it looks.

**2. Which error is discovered?** A loud failure is cheap almost regardless of
magnitude, because it is bounded in time — it is found, and then it is over. A
silent wrong answer has no such bound: it is believed, acted on, copied, and
built upon. Between a crash and a plausible wrong result, the crash is the
cheaper error.

**3. Which error compounds?** Some mistakes are paid once. Others accrue with
every caller, every engineer, every day: a slow build, a confusing name, a
convention that must be explained, a flaky test that teaches people to ignore
red. Compounding costs beat one-time costs even when the one-time cost is larger
today.

**4. Who pays?** A cost you pay now is worth more than a cost you export to a
caller, a reader, the person on call, or your future self. Exported costs are
systematically underweighted because the person deciding never feels them —
correct for that, deliberately.

When these four point the same way, the choice is made and there is nothing to
ask about. When they conflict, that is usually move 3 in disguise: something is
serving two masters and the seam has not been found yet.

---

## 4. Asking: who, when, and how

**Who: the developer directing the work** — not the end user of what you are
building. This distinction does real work. Turning an open question into a
runtime preference, a configuration flag, or a settings screen is inventing a
feature to avoid asking a question, which is a far larger act than the question
and leaves the question unanswered. If a runtime setting is genuinely warranted,
*that* is the thing to raise.

**When: while you are writing the code the answer shapes** — not in a design
phase before the shape is clear, and not after, as a disclosure. At that moment
the question is concrete, cheap to answer, and cheap to act on.

**How: bounded by what exists.** The menu you offer is the set of real options,
starting at the true maximum available. Offering a precision the source cannot
produce, a guarantee the system cannot make, or a mode that does not exist is a
false statement about the system, and every answer built on it is wrong before
it is given.

**Two steps, not one.** First: does this want the full/strongest/default form?
If yes, there is no second question. If no: which of the real alternatives?
Collapsing them into a single menu buries the fact that "all of it" is a
legitimate and frequently correct answer.

**Once, then applied.** The answer for a decision is usually the answer for that
decision across the whole surface. Re-asking per call site is noise, and worse,
it produces a system whose parts disagree.

**Do not ask about the derivable.** Interrupting someone over a choice you could
have derived — or discovered in a few seconds — is its own miscalibration, and
it spends the credibility you need for the questions that matter.

---

## 5. The failure catalogue

Both columns are the same failure: the choice was not derived. The middle column
is how it feels from inside, which is why intending to do better does not catch
either.

| Under-derived | Feels like | Over-derived |
|---|---|---|
| the round number, the tutorial default | speed | agonizing over two equivalent options |
| guessing a choice whose difference is visible | decisiveness | asking about something derivable in seconds |
| "we always do it this way" | experience | rejecting the local convention for a fresh preference |
| a setting to avoid a decision | flexibility | a hard-coded value where two consumers demonstrably differ |
| compromising between two masters | pragmatism | splitting a decision that only ever had one |
| exporting the cost to the caller | shipping | absorbing a cost that was correctly the caller's |
| reading a full dump to find one line | thoroughness | guessing at an interface to avoid a targeted read |
| instructions left scattered in conversation | flow | a document for a single-command tool |
| a fallback that returns a wrong answer quietly | resilience | crashing on a condition with a correct degraded mode |
| silent fidelity loss at the door | simplicity | fabricated precision the source never produced |

The bottom rows are the instructive pair: *both* are failures of the same
decision, in opposite directions, and both are defended with the same words.

---

## 6. Domain appendix

The method, already applied. This is a map, not a rulebook — the entries are
worth more as demonstrations of derivation than as things to memorize, and the
list is deliberately incomplete. When a domain is missing, run the four moves.

### 6.1 Representation

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Precision and fidelity | store the source's distinctions at the native maximum; project per reader | unstored is unrecoverable; unshown is one edit |
| Money | exact minor units or decimal, never binary floating point | drift is silent, cumulative, and audited |
| Timestamps | the instant plus its originating zone or offset | a wall-clock string cannot be ordered or converted |
| Identifiers | opaque, never reused, never carrying meaning | encoded meaning goes stale and cannot be changed once referenced |
| Interface fields | additive only; never repurposed | repurposing costs nothing today and silently redirects every old reference |
| Large integers across text formats | as strings | silent truncation past the float boundary, reported by nothing |
| Text | stored as entered; normalized only into a derived key | destructive normalization at the door renames people |

### 6.2 Behavior under stress

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Elapsed time | monotonic clock; wall clock only for "when" | wall time jumps, and durations computed from it go negative |
| Cross-machine ordering | never by timestamp | clocks disagree by more than the events do |
| Timeouts | one on everything crossing a boundary, from measured latency | "none" is a default nobody chose, failing as a hang with no diagnosis |
| Retries | idempotent operations only; backoff, jitter, cap | retrying a write duplicates it; no jitter turns a blip into a stampede |
| Queues, caches, pools, result sets | bounded | anything unbounded is a memory leak with a schedule |
| Fallbacks | only when the degraded mode is *correct*, not merely available | most fallbacks convert a loud failure into a quiet wrong answer |
| Crash safety | assume termination between any two statements | designed in once, or discovered as a corrupt store |

### 6.3 Contracts and vocabulary

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Interface surface | expose the least that satisfies the caller | widening is additive; narrowing breaks everyone |
| Naming | units in the identifier; no negated booleans; named by what it is to the caller | `disable_x = false` is misread at every call site, forever |
| Local convention | match the surrounding code over personal preference | written once, read hundreds of times |
| Dependencies | cost is transitive surface, update cadence, and removal cost — never download size | a twenty-line utility is a bad trade; cryptography, time zones, and authentication are always the right one |
| Configuration | config is what differs per environment; everything else is code | each option doubles a test matrix that nobody re-runs |
| Config validation | all of it, at startup, in one place | lazy validation fails on the uncommon path at the worst hour |
| Defaults | safe over convenient: private, off, deny, dry-run, strict | the default is what every system that did not think about it will run |

### 6.4 Visibility

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Instrumentation | record the decision and its inputs, not the narration | a field costs bytes; a missing field costs a reproduction |
| Correlation | one identifier threaded end to end | added later means adding it everywhere at once |
| Severity levels | mean something or do not exist | if everything is a warning, nothing is |
| Error text | what was expected, what was found, and where | composed once, read by everyone who ever hits it |
| Test level | where the bug would actually live, against the contract | tests of structure pin the implementation and pass while it is broken |
| Test credibility | prove it can fail | a test that cannot fail is a false claim of coverage |
| Flaky tests | a defect, fixed or deleted | tolerating one teaches people to ignore the only signal there is |
| Comments | the why; a comment explaining a name is a rename request | a stale comment is a false claim that outlives its author |

### 6.5 Motion

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Change size | small, reversible, frequent | rollback cost grows faster than change size |
| Schema and behavior | never in one step; expand, migrate, contract | a coupled change has no rollback that is not also a data decision |
| Deploys | the rollback story exists before it ships | written under calm conditions, or written during the incident |
| Automation | what is done three times, or once irreversibly | a manual runbook step is a latent outage; a script run in production *is* production code |
| Optimization | measure first, and measure the tail | the mean is a comfort; the tail is the experience |
| Caching | a correctness decision with a performance benefit, never the reverse | invalidation is the hard part and it is not a performance problem |
| Feedback loop | build and test latency is worth paying to keep short | it multiplies across every engineer and every day |

### 6.6 People

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Destructive actions | confirm, naming the target in the confirmation | "are you sure?" without the target trains a reflex, not a check |
| Output | human-readable by default, machine-readable on request | both consumers exist; only one is served by guessing |
| Data collection | the minimum, retained the shortest | deletion must reach backups and derivatives — designed in, or impossible |
| Personal data in logs | never | the most common leak, and logs outlive the policy that governs them |
| Translated text | never assembled by concatenation; no assumptions about name, address, or postcode shape | retrofitting means touching every string and every view |
| Contrast, labels, keyboard paths | correctness, not polish | the people who need them cannot report the bug through the interface that has it |

### 6.7 Working under a context budget

A **context budget** is the finite working set a reader has to hold at once in
order to do one piece of work. The reader is not necessarily a machine, and the
budget is not necessarily measured in tokens. All of these are context budgets:

- an assistant's context window over a working session
- a reviewer's attention across a single change
- an operator's attention at the worst hour of the night
- a newcomer's head during the weeks before they can contribute
- whatever a person will actually read of an error message, a document, or a
  runbook before acting
- the alerts and dashboard panels a team can genuinely watch
- the number of concepts a change forces someone to hold simultaneously in
  order to make it correctly

They are one domain because they share four properties, and the four are what
make the reasonable choice derivable:

1. **Finite and shared.** Spending the budget on one thing makes it unavailable
   for another, within the same session, review, incident, or page.
2. **Spent by volume, not by value.** A thousand lines of noise costs the same
   as a thousand lines of signal; density is the only lever.
3. **It fails by eviction and dilution, never by refusal.** Nothing errors when
   the budget is exceeded. What mattered is simply gone, or still nominally
   present but no longer attended to — and the reader cannot tell which.
4. **The cost is exported.** Whoever adds the volume is rarely the one whose
   attention it displaces, and the displacement happens later. That is the exact
   profile §3 flags as systematically underweighted.

An assistant's context window is the sharpest instance because it is metered,
measurable, and consumed by literal byte count, so the arithmetic is visible.
The discipline is the same at every scale, and the rows below apply on both
sides of the keyboard.

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Who runs a tool with large or repeated output | the developer, in their own environment; the assistant builds it and documents it | output read into a context is spent for the whole session; the same output read by a person costs nothing, and they return the three lines that matter |
| Where a large result lives | a file, with only the verdict in the conversation | a file is re-read in part, later, at no cost; a pasted corpus is paid for once and then taxes everything after it |
| Usage instructions | one consolidated document, written as the tool is built | a conversation is compacted and lost at the session boundary and then re-derived; a document survives and is read selectively |
| Verification | the invocation that returns a verdict, a count, or a status | a full dump proves the same thing at a hundred times the price |
| Reading source | search first, then read the range that matters | the file is rarely the answer; the answer is rarely the whole file |
| High-volume exploration | a separate context that reports back a conclusion | its budget is not yours, and only the conclusion crosses back |
| Durable decisions and conventions | written into a project document | conversation is not memory; documents are |
| Generated code and comments | as terse as clarity allows | written once, re-read on every future visit by both the person and the assistant |
| Narration | omitted | announcing, doing, and then recapping pays three times for one action |
| Size of a change put up for review | small enough to hold at once | review quality does not degrade gracefully past the limit — it collapses into approval |
| What an alert says and whether it exists | only what needs a human to act, tonight | every alert spends the same attention, and past the limit all of them are ignored, including the real one |
| What a dashboard shows | the few things someone would act on | forty panels means none are watched, which is worse than four |
| A runbook's length and shape | what fits in the attention available at the worst hour | written by a rested author, read by an exhausted operator |
| How much an error message says at once | the smallest thing that lets the reader act, with the rest available but not in the way | a wall of detail is skipped whole, so the one useful line is lost inside it |
| Concepts a change forces you to hold at once | reduce the coupling instead of documenting it | this budget is spent by every future reader of that code, not just the one who wrote it |

**The operational-tooling handoff.** When the work produces something the
developer will run repeatedly — a script, a diagnostic, a migration, a report
generator — the reasonable division of labor is that the **assistant builds and
documents it, the developer runs it and reports back**. Both halves fall out of
move 3: the tool's output has two masters, the developer who needs all of it and
the assistant which needs only the verdict, so the tool writes its full output
where a person can read it and the conversation carries a summary. Consolidate
the instructions into **one document as the tool is built** — how to invoke it,
what each mode does, what normal output looks like, and *which parts to bring
back if something is wrong*. That last item is what makes the loop cheap in both
directions: without it the developer returns either too little to act on or the
entire dump the split existed to avoid.

**The counter-direction is a real failure and costs more than it looks.**
Guessing at an interface to avoid a fifty-line read buys nothing: you pay for
the wrong edit, the debugging of it, and then the fifty lines anyway. Asking the
developer to run something you could have checked in one cheap call exports work
to a person in order to save a budget that was not scarce. The same false
economy has a human form: an error message too terse to act on, a runbook
missing the step everyone forgets, a deleted alert that turned out to be the one
that mattered — each spends someone's night to save a few lines.

The context budget is a constraint to derive from, not a virtue to maximize.
Spend freely on the small, dense thing that prevents an error; hoard against the
large, low-density thing that prevents nothing. Density is the lever, not
length.

---

## 7. The process

1. **State the decision** as a question with at least two answers. If it has one
   answer, it was not a decision and needs no attention.
2. **Look for two masters** first, before choosing. A blended answer to a split
   question cannot be rescued by tuning it.
3. **Derive each side** from its own input: the source, the consumer, the
   measurement, the constraint. Name the input out loud, even if the derivation
   is one clause.
4. **If uncertainty remains, read the asymmetry** — recoverability, then
   discovery, then compounding, then who pays — and lean toward the cheaper
   mistake.
5. **If two answers survive and the difference shows, ask the developer**, while
   writing the code, in two steps, with the menu bounded by what exists.
6. **If nothing survives as asymmetric, pick and be consistent** with what is
   adjacent. Do not spend judgment where there is nothing to judge.
7. **Say the residue.** What you derived it from, what you assumed, what you
   deliberately left reducible later. A derived choice that nobody can see the
   derivation of will be re-litigated or, worse, copied into a situation it does
   not fit.

---

## 8. The one-paragraph form

> Be reasonable means derive the choice, not inherit it. Ask what in this
> situation produces the answer — the source, the consumer, the measurement, the
> constraint — and if you cannot name that input, you are repeating a habit
> rather than making a decision. Where one decision is pulled two ways, it is
> two decisions: split them, and let storage answer to the source while
> presentation answers to the reader. Where uncertainty remains, lean toward the
> mistake that is cheaper to undo, remembering that cheap means recoverable and
> loud rather than small — an unstored digit is gone forever while an unshown
> one is a formatter, and a crash is cheaper than a plausible wrong answer.
> Where two answers survive and the difference is visible, ask the developer
> while you are writing the code, offering only options that exist, and never
> convert the question into a setting. Where nothing is asymmetric, pick, match
> what is adjacent, and move on. Extreme rigor is reasonable when the situation
> produces it; the only unreasonable setting is the one that was never derived.
> **This chooses among options. It never lowers the enforcement of an
> invariant.**
