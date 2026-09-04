# Tool assimilation: learning how noisy a command is, and what to do about it

Date: 2026-09-04. Branch and working copy: `tool-assimilation`.
Owner: Gabe. Design settled in conversation 2026-09-04; this records it.

## The problem

`classify()` decides whether a command is wrapped in the output filter by matching a
hardcoded list of known-noisy commands. Anything it does not recognise defaults to `plain`
— unwrapped. Measured against ferrislicer's own tools:

```
noisy      cargo test --workspace
plain      bash scripts/battery.sh
plain      bash scripts/merge-gate.sh
plain      scripts/testq.sh --workspace
plain      bash scripts/perf.sh
plain      bash scripts/prove-gcode-identical.sh HEAD~1
plain      python scripts/oracle_compare.py
classify: 6 of 10 fall through as plain (unfiltered)
```

Six of the ten noisiest tools in the project are unfiltered, because the plugin is
universal and they are not. Every project will have this problem, and it grows: a project
adds a script, the plugin has never heard of it, and it is loud forever.

The default is also backwards. An unrecognised tool is treated as *quiet*, when the honest
statement is that its volume is **unknown**.

## What this is not

Two designs were explored and retracted; they are recorded so the reasoning is not
re-derived later.

**A project pattern list** — projects declare extra noisy regexes. Rejected: it only
decides *whether* to wrap, which is half the problem, and it makes every project restate
knowledge about tools that are the same everywhere.

**Project filter files** — projects author declarative filters, promoted to universal when
they generalise. Retracted by the owner. It solves the wrong half: `select()` is already
tool-agnostic, keeping errors, panics, failures, summaries, proof lines and heartbeats and
dropping chatter. It never needed to know which tool produced a line. Authoring per-tool
selection logic would have added a lifecycle, a promotion path and a review burden to
replace something that already works.

What was actually missing is narrower: **the wrap decision, and knowledge of the tool.**

## Two components, one seam

**The wrapper is generic and knows nothing about any tool.** It runs a command and records
exactly what happened: both streams, their order, their timing, the exit code.

**The assimilator holds all the opinions.** Whether a tool is off-the-shelf or bespoke,
whether it is noisy, which quieting parameters to suggest, which stream carries its
results.

Neither grows into the other. Everything the assimilator knows is derived from what the
wrapper observed; the wrapper never consults the assimilator.

## The wrapper

Today `quiet-run.mjs` does this:

```js
stdio: ['ignore', 'pipe', 'pipe']                  // separate at capture
const raw = Buffer.concat([r.stdout, r.stderr]);   // "both streams as one (step 19)"
```

`spawnSync` returns two complete buffers, so their chronological relationship is already
gone before the concatenation; the concat then also orders all of stdout ahead of all of
stderr, in the shown output *and* in the log. Four changes:

**Asynchronous spawn.** `child_process.spawn` with `'pipe'` on fd 1 and fd 2, read as
chunks arrive. This is the only way to have both the split and the order, and it needs no
dependency.

**stdout and stderr stay distinct, per line.** Never concatenated. Each line is recorded
with the stream it came from:

```
{ t: 0.412, stream: "stdout", text: "running 128 tests" }
{ t: 0.418, stream: "stderr", text: "   Compiling fs-core v0.1.0" }
{ t: 8.902, stream: "stdout", text: "test result: ok. 128 passed; 0 failed" }
```

**Timestamps, from one clock authority.** One wall-clock instant is captured at start;
every line carries a monotonic offset from it. Wall clock alone is wrong — an NTP
correction or a DST change mid-run produces negative gaps or a fake stall. Everything else
(absolute times, gaps, total elapsed) is derived from that pair, never measured a second
way.

**stdin is passed through.** `'ignore'` today is exactly what breaks an interactive command
when it is wrapped, and wrap-to-learn (below) makes that reachable for tools nobody
anticipated.

The log is written in arrival order with the stream named on every line, so the record
matches what happened:

```
$ cargo test --workspace
0.412 out  running 128 tests
0.418 err     Compiling fs-core v0.1.0
8.902 out  test result: ok. 128 passed; 0 failed
```

### Explicitly not a PTY

A pseudo-terminal is the other way to capture a terminal's-eye view, and it is wrong here
for three independent reasons. It needs a native dependency, against the dependency
policy. It has one master handle, so it **merges** stdout and stderr and destroys the split
this design exists to preserve. And tools detect a TTY and become *noisier* — progress bars
redraw, colour turns on. Pipes make tools quieter at no cost, which is already today's
behaviour.

### What timestamps buy

**Silence becomes measurable.** The heartbeat rule states that silence past one interval
means dead or hung, never "probably still working." Nothing today can distinguish them,
because the wrapper knows only total elapsed time. Per-line timestamps make *this tool
produced nothing for four minutes* an observable fact.

**Burst and drip stop looking alike.** 900 lines in two seconds is a build dumping chatter,
and a summary is the right response. 900 lines over twenty minutes is a long run reporting
progress, where the latest line and the heartbeat are what matter and a summary is nearly
useless. Same line count, opposite correct treatment. This distinction cannot exist without
time, and it is the largest single improvement to what can be learned about a tool.

## The assimilator

### Two axes, independent

**Identity** — off-the-shelf or bespoke. Decides whether a *suggestion* is available.
Universal knowledge: `cargo` behaves the same everywhere.

**Noise** — measured from real runs. Decides whether to *wrap*. Project-local: it depends
on how much this repo makes the tool emit.

They are orthogonal, which is why known software that cannot be made quiet enough is still
wrapped.

### The five states

A pure function of the command and the tool's record:

```
no observations                          → observe, unwrapped
last observation quiet                   → nothing
noisy · bespoke                          → wrap
noisy · off-the-shelf · candidates left  → suggest params, unwrapped
noisy · off-the-shelf · exhausted        → wrap
```

**A known tool's first noisy pass is suggest-only, and unwrapped.** Filtering a tool that
has a real quiet mode treats the symptom; getting it to emit less is strictly better —
less I/O, a smaller log, and nothing that *can* be wrongly eaten. Wrapping is the fallback
for tools that will not cooperate.

Unwrapped during the trial is not a convenience. Wrapping while testing parameters changes
two variables at once, so whether `--quiet` helped becomes unmeasurable. Isolate them.

**Noisy** reuses the threshold the runner already declares — `PASS_THROUGH_LINES = 40`, the
line below which output is shown verbatim. That is already this codebase's definition of
"small enough not to bother." No new number is invented.

### The ledger

The state above cannot be derived from the command alone. Reading "are the params present"
off the current invocation cannot distinguish *never tried* from *tried and insufficient*,
and it oscillates when the same tool is invoked different ways — `cargo test --workspace`
one run, `cargo test -p fs-hub` the next.

So attempts are recorded. **The ledger is keyed on the parameters, never on the command:**

```
cargo test
  identity:   off-the-shelf
  candidates: --quiet · -q --no-fail-fast · …     (finite, declared universally)
  ledger:     --quiet             insufficient
              -q --no-fail-fast   insufficient
  → exhausted → wrap
```

Keying on the invocation would fragment the ledger per command line and grow without
bound. Keying on the parameter set gives one entry per (tool, candidate), and since the
candidate list is finite and declared, **the ledger's maximum size is fixed by
construction.** Termination is structural, not a policy someone enforces.

Line counts do not appear in the ledger. They are per-invocation and vary wildly — a
workspace test emits far more than a single-crate one — so a raw count against a parameter
set would be a measurement whose scope contradicts its claim. Observations are transient
and inform the verdict; the ledger records only the verdict.

**The candidate list must be finite and declared up front.** If the assimilator may invent
a new flag combination whenever the last failed, the ledger grows forever and the loop does
not terminate, it only slows down. A written list of documented flags is also reviewable;
a generator that proposes flags on demand will eventually propose one that does something
else entirely.

Bespoke tools skip the ledger. There is nothing to look up, so they go straight to wrap on
the first noisy observation.

### Per-stream policy

Neither stream gets a blanket rule.

**stderr is never dropped wholesale.** Anything on it matching the error classes is kept
unconditionally, and a non-empty stderr on a non-zero exit is always surfaced.

**stderr is not kept wholesale either.** For cargo, npm and gradle it carries the progress
chatter — every `Compiling …` line is stderr. Keeping all of it would show the noise and
filter out `test result:`, which is stdout.

Which stream carries **results** and which carries **progress** is therefore a per-tool
fact, and an observed one: the wrapper can see which stream the error blocks and summary
lines actually landed on. Observations record the two counts separately, because the shapes
are genuinely different:

```
cargo test            stdout 812   stderr 94
scripts/battery.sh    stdout 2     stderr 1400
```

The second is a tool whose stdout *is* the answer. Filtering it like cargo would be exactly
wrong, and only separate counts make that visible.

## Where things live

```
plugin  (universal)   tool identity · finite candidate list · what each flag does
project (local)       observations · which candidates were tried · whether they sufficed here
```

Project state goes in `.claude/machinery/`, beside the inbox and index the plugin already
owns there.

### Promotion, and its limit

**The candidate list is promotable.** That a tool exists, is noisy by nature, and has these
documented quieting flags is a property of the software, true everywhere. The universal
table can only know tools someone has taught it, and projects are where new tools are met.

**The verdict is not promotable.** "`cargo test --quiet` is insufficient" was measured on a
workspace with 1218 tests; on a small crate `--quiet` may be entirely sufficient. Promoting
it would carry one repo's output volume into another as though it were a property of cargo
— a measurement whose scope is not part of its claim.

Promotion uses the rule lifecycle that already exists: the project accumulates a candidate,
the assistant **proposes** it, the owner files it into the plugin, the version bumps, and
other projects receive it on update. Automatic promotion would have an assistant writing
into shared universal state on its own judgement.

A bespoke tool never promotes — nobody else has `scripts/battery.sh`. But a tool believed
bespoke that turns out to be off-the-shelf (a wrapper around `pytest`, say) promotes as a
new table entry the moment it is recognised, and that reclassification is itself a signal.

## The nudge register

A suggestion is **advisory and never blocks** — the same register as the existing index
nudge, and consistent with warn-do-not-fail. It is a proposal, never an application: the
assistant proposes parameters and never injects them into a command the user wrote.

The idempotence matters more than a "suggested already" flag would. State is a pure
function of the command and the record, so an assistant that ignores a suggestion simply
lands back in the suggest state next run, which is where it should be. There is no flag to
drift out of step with reality, and the derived state could be deleted entirely and rebuilt
from observations.

## Measured facts this design rests on

Each was checked in session on 2026-09-04, not assumed.

- `classify()` leaves 6 of 10 of ferrislicer's own tools unwrapped (run above).
- `quiet-run.mjs` concatenates the streams; `spawnSync` has already lost their order.
- `PASS_THROUGH_LINES = 40` is the existing verbatim threshold in `filter.mjs`.
- `filter.mjs` already preserves the proof-line format —
  `PROOF_LINE = /(^HEARTBEAT\s|^[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\s+--?[\w.-]+)?:\s+\S)/` —
  so heartbeats and denominator lines survive filtering in every mode today. This design
  must not regress that.
- The plugin holds 15 tests for the quiet path (`test/quiet.test.mjs`,
  `test/quiet-run.test.mjs`).

### Why observation lives in the wrapper, not in a hook

Observing at `PostToolUse` was considered and rejected on evidence. The documented payload
carries `tool_output` as a plain string; the plugin's own recorded fixture instead shows
`tool_result: { type, content: [{ type, text }] }`. Both cannot be current. Worse, two
things needed here are undocumented: whether the hook sees **truncated** output, and the
**exit code**, which does not appear in the documented schema at all. If output arrives
truncated with no marker, "quiet" and "cut off at the limit" are indistinguishable —
precisely the judgement the ledger's *insufficient* verdict depends on.

Inside the wrapper all three are simply present: full output (`maxBuffer` 256 MB), the exit
code (`r.status`), and both streams distinct. The design does not need the hook payload,
and does not depend on an unresolved question.

## Costs, stated rather than discovered

**One wrapped-but-unfiltered run per tool.** An unknown tool must be wrapped to be
observed. It is shown verbatim, so nothing looks different — the verbatim path already
exists for output under 40 lines and `MACHINERY_QUIET=0` already forces it. Learning costs
one run.

**Wrap-to-learn can break an interactive tool.** Passing stdin through (above) removes the
common case, but a tool that needs a real TTY will behave differently under a pipe. The
`NEVER` list exempts the known cases; an unanticipated one degrades on first encounter.
This is the price of not guessing, and it is why stdin pass-through is part of the wrapper
change rather than a later refinement.

**A suggestion can be wrong.** The candidate list is written by people from documentation;
a flag that does something other than reduce output would be suggested until corrected.
Finiteness and reviewability are the mitigations, not correctness by construction.

## Verification

Declared standard: **structural**. This changes behaviour deliberately.

1. **Stream separation** — a fixture command writing known text to stdout and stderr
   produces line records with the correct `stream` on each, and the log interleaves them in
   arrival order. Positive control: swap the fixture's streams and the assertion fails.
2. **Timestamps** — a fixture that sleeps between writes produces monotonically
   non-decreasing offsets with a gap matching the sleep within tolerance. A clock that never
   advanced must fail the test.
3. **Heartbeat survival** — the existing proof-line guarantee is re-asserted against the new
   per-stream path, in every mode, with a fixture proving a synthetic heartbeat survives.
   This is a regression guard on behaviour that works today.
4. **Ledger termination** — a tool with N candidates reaches `exhausted → wrap` in at most N
   suggestions and never suggests a recorded-insufficient set again. Asserted by exhausting
   a fixture tool.
5. **Idempotence** — running the classifier twice over the same (command, record) yields the
   same state. Asserted directly, since it is the property the no-flag design rests on.
6. **The wrap decision** — the 6-of-10 fall-through above becomes 0-of-10 after observation,
   using ferrislicer's real command list as the fixture.
7. **Exit code fidelity** — a wrapped command's exit code reaches the caller unchanged, for
   zero and non-zero. Existing behaviour; guarded because the spawn change could break it.

## Open questions for the owner

- **May a project add candidates for an off-the-shelf tool**, or is that table
  universal-only? Universal-only is simpler and keeps the table reviewable in one place;
  project-local additions would let a project move faster at the cost of two sources.
- **Should a shared corpus of negative verdicts exist** — "these flags never help anyone"?
  Ruled against above because volume is project-conditioned, but a tool whose quiet flags
  are useless *everywhere* is a real category, and the owner may want it recorded once.
- **Where the observation record lives on disk** — JSON read by the hook, or markdown like
  the inbox with a generated view like the index. The first is simpler; the second matches
  the existing pattern and stays legible when someone asks why a tool is being wrapped.
