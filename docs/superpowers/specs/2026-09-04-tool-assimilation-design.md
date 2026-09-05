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

## What must survive: the preservation contract

The design so far specifies what is hidden. This states what is kept, because a system
where a machine decides what to hide is only as good as its guarantee that the answer
survives.

### The generic contract, which exists today

`select()` keeps **nothing by default** and adds on positive match — an allowlist, not a
denylist. Five things survive:

- **Result lines**, via `SUMMARY`: `^test result:`, `Finished`, `\d+ passed`,
  `BUILD SUCCESSFUL` and similar.
- **Proof lines**, via `PROOF_LINE`: heartbeats and `snake_case_tool: text` denominators.
- **Error blocks**, via `BLOCK_START`: from the opening line through to the next blank one.
- **The tail** — the last `TAIL_LINES = 8` lines unless they are chatter, and **the final
  line unconditionally**. That last clause is the strongest guarantee in the system:
  whatever a tool prints last always survives, whatever else happens.
- **A fallback**: in infra mode, if nothing matched at all, the last line is kept anyway.

`CHATTER` is the only negative rule, and it is a *veto* rather than a dropper — it cancels
a keyword match and excludes a line from the tail. It can never remove a summary, a proof
line, an error block, or the final line.

### What the generic contract cannot promise

It is a heuristic. A tool whose answer is not shaped like a summary, does not appear in the
last eight lines, and contains none of the keyword vocabulary can have its answer hidden,
and nothing would say so. That is acceptable for a tool nobody has taught the system
about. It is not acceptable for one it claims to know.

### Declared outcome patterns, per off-the-shelf tool

Every entry in the universal table declares, alongside its candidate flags, **the pattern
that matches the line that is the tool's answer**:

```
cargo test         outcome: ^test result:
merge-gate.sh      outcome: ^MERGE GATE
pytest             outcome: ^=+ .* (passed|failed|error)
```

Those lines are kept by name rather than by hoping the generic summary regex fires, and
each declaration **ships a fixture proving that line survives filtering**. That fixture is
the per-tool positive control this design otherwise lacks: a table entry that cannot
demonstrate its outcome surviving is not a table entry.

A bespoke tool has nothing to declare, so it starts on the generic contract and the
unconditional last line. It does not stay there: it **earns** an outcome pattern through
the training loop below. Until it graduates, its guarantee is the final line and whatever
the heuristics catch — no more, and that limit is real while it lasts.

### Match techniques, and which are allowed where

Everything in `filter.mjs` today is a regex. That is fine for six hand-written, reviewed
patterns. It is not fine for anything a machine derives, so the two cases are separated:

- **Machine-derived patterns are prefix or literal only.** Never regex. A generated regex
  can over-match silently or backtrack pathologically on a long line, and both failures are
  invisible at the point they matter. A prefix match can do neither, is reviewable at a
  glance, and covers nearly all real chatter — `   Compiling `, `Downloading `,
  `test … ok`. `CHATTER` is already effectively a prefix set written as a regex.
- **Regex is permitted only in the human-reviewed universal table**, where a person has
  read it and a fixture exercises it.

This is the same split as everywhere else in the design: the universal half is written by
people and reviewed; the project half is derived by machine and therefore restricted to
forms that cannot misbehave.

## How an outcome pattern is learned

An off-the-shelf tool's outcome pattern is declared by a person. A bespoke tool's is
learned, and this is the loop that learns it.

### The model in the loop is the session

Not a service the hook calls. A hook that blocks on inference is a hook nobody keeps, and
an inference budget attached to every command is a cost nobody accepts. The hook records
the observation and nudges; the assistant performs the identification during a turn it was
already having, and writes the result into the JSON record.

That also means training data is free. The wrapper already writes a full log per run, so
identification can happen over stored logs in batch, not only on the run that triggered it.

### Identification is the model's job; generalisation is not

The session reads a captured log and says *this line is the answer*. It does **not** invent
the pattern.

Turning `test result: ok. 128 passed; 0 failed` into a matcher means finding what is stable
across runs, and that is arithmetic: the longest common prefix of the identified line
across repeated observations. After three runs there are three instances and `test result:`
falls out without anyone guessing.

The split matters because it bounds the failure. Judgement stays with the model;
generalisation stays deterministic. A matcher cannot over-reach because the model was
confident, and a single observation can never graduate — there is nothing to take a common
prefix *of*.

It is also what keeps machine-derived patterns to prefixes and literals, as required
above: a longest-common-prefix is a prefix by construction. The rule is not a promise the
generator makes, it is a property of how the generator works.

### Graduation is shadow agreement

While a tool is in training, both the local matcher and the session pick the outcome line,
and the picks are compared. After **K consecutive agreements** the matcher graduates and
the nudge stops firing for that tool.

That comparison is the only real training signal available, and it is why the model stays
in the loop until it does not. Nothing else can tell you the matcher is right, because
there is no other oracle.

### Graduation freezes a fixture

This is what makes the result checkable rather than merely trusted. At the moment a matcher
graduates, the observation that trained it is frozen as a fixture with its expected kept
lines. The matcher now has a regression test.

Without it, training produces a heuristic and discards the evidence, and "the model was
wrong about this tool" becomes something you live with rather than something you can
discover. **A matcher that cannot be graduated with a fixture is not graduated.**

### Drift re-opens training

A graduated matcher that quietly stops matching is precisely the failure class this
codebase keeps finding: a check that has stopped being able to fail looks exactly like one
that passes. So graduation is not permanent, and re-entry is mechanical rather than
scheduled. Training re-opens when:

- the matcher matched **nothing** in a run,
- the exit code was **non-zero** and no error block was found, or
- the output's shape moved materially — line count distribution, or the ratio between
  stdout and stderr.

Each is a fact the wrapper already records. None requires anyone to notice anything.

### The floor stays underneath

The learned matcher only ever **promotes** a line into the kept set. It cannot remove one.
The final line survives unconditionally, error blocks survive, proof lines survive, and
none of that is subject to the matcher.

So the worst a wrong matcher can do is fail to promote a line that deserved it. It can
never hide the last thing a tool said. That bound is what makes it acceptable to let a
model train this at all.

### The honest limit

This produces a heuristic trained by a model on one project's output. It is not a proof,
and the fixture is what keeps it honest — not the soundness of the training. A tool whose
answer genuinely varies in shape run to run will never graduate, and that is the correct
outcome rather than a gap: it stays on the generic contract, which is what an
unlearnable tool deserves.

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
7. **Declared outcome survives** — for every entry in the universal table, its fixture is
   filtered and the outcome line must appear in the kept set. Positive control: remove the
   outcome declaration and the assertion must fail, so a table entry cannot pass by the
   generic heuristic happening to catch it.
8. **The final line is never dropped** — a fixture whose last line matches CHATTER is
   filtered, and the last line is still present. This is the strongest existing guarantee
   and the per-stream change must not weaken it.
9. **No machine-derived pattern is a regex** — a check over the project record refuses any
   derived pattern that is not a literal or a prefix. Asserted directly, since it is what
   keeps a generated pattern from misbehaving.
10. **Generalisation is deterministic** — the same set of observations yields the same
    prefix, and a single observation never graduates a matcher. Asserted directly; it is
    what keeps a machine-derived pattern a prefix by construction rather than by promise.
11. **Graduation requires a fixture** — a matcher cannot reach graduated state without a
    frozen observation and its expected kept lines. Positive control: remove the fixture
    and graduation must be refused.
12. **Drift re-opens training** — a graduated matcher that matches nothing in a run returns
    to training, as does a non-zero exit with no error block found. Asserted for each
    trigger separately, since a single combined test would pass on one of three.
13. **The matcher can only promote** — a fixture whose learned matcher is deliberately
    wrong still shows the final line, the error block and the proof lines. This is the
    bound that makes model-trained matching acceptable, so it is tested rather than argued.
14. **Exit code fidelity** — a wrapped command's exit code reaches the caller unchanged, for
   zero and non-zero. Existing behaviour; guarded because the spawn change could break it.

## Decisions taken by the owner, 2026-09-04

- **A project may add candidates for an off-the-shelf tool.** The point of the design is
  that projects can be quieted; making them wait on a universal table edit would defeat it.
  Promotion to plugin scope stays available for candidates that generalise.
- **No shared corpus of negative verdicts.** A verdict is project-conditioned and does not
  travel, even in aggregate.
- **The observation record is JSON**, read directly by the assimilator.

## Decisions taken by the owner, 2026-09-05 (final whole-branch review)

- **Byte-movers are out of scope, by kind.** Ruling C1, verbatim: "Only need wrapping for
  output producers, not filter pipes." The assembled system had observed `cat big.txt` on its
  first run and cut it to 8 of 120 lines on its second, because `plain` now means "observe"
  and nothing distinguished a file-reading command from a tool. The mechanism: `classify()`
  recognises the byte-movers by name at the leading position — `cat`, `grep`, `rg`, `sed`,
  `awk`, `head`, `tail`, `sort`, `uniq`, `cut`, `tr`, `wc`, `jq`, `find`, `diff`, `ls`, `pwd`,
  `echo`, `printf`, `less`, `more`, `tee`, `xargs`, `basename`, `dirname`, `realpath`, `stat`,
  `file`, `which`, `type`, `env` (alone), `printenv`, `date`, `test`, `true`, `false`, the
  silent file operations (`cd`, `mkdir`, `rmdir`, `rm`, `cp`, `mv`, `touch`, `ln`, `chmod`),
  and git's reporting subcommands (`log`, `diff`, `show`, `status`, `blame`, `ls-files`,
  `rev-parse`, `branch` when listing, `worktree list`) — and routes them to the existing `read`
  bucket, which the hook already skips, so they never reach `decide()` and generate no
  observation record. A compound command is a byte-mover only if every segment of it is:
  `cargo build && echo done` stays wrapped. Segments are split outside quotes: a `;`, `&&`,
  `||`, single `&` or newline inside a single- or double-quoted span is data, not a boundary,
  and an unterminated quote runs to the end of the command — the span rule is the one
  `catalog.mjs`'s tokeniser reads, in `scripts/lib/quotes.mjs` (#11). Rejected alongside: a stdout-only-noise heuristic
  inside `decide()`, and an allowlist of tool-shaped invocations — the owner chose an
  exemption by kind. `bespokeKey` was deliberately not changed: an exempt command writes no
  record, so its key collapse is moot.
- **The catalog outranks the regex heuristics.** Ruling I1, verbatim: "The old classifier
  consults the catalog first, before its own regex guesses. When a command has a verified
  catalog entry, that entry is the authority and classify() reports `plain` for it (which is
  the bucket that hands off to the assimilator); only commands the catalog has no entry for
  fall through to the old regex heuristic. The regex chain then becomes what it should have
  been all along — the fallback for tools nobody has characterized yet — and the catalog is
  the single authority for any tool it knows." The review had measured the hook answering
  `filter` / `filter` / `infra` for `pytest`, `npm install` and `git commit` where `decide()`
  said `suggest`: the five states above were unreachable for every tool the shipped catalog
  knew. The consequence the ruling names: `classify(command, { catalog })` is catalog-aware,
  the catalog being loaded once by the hook and passed in, so classify stays exercisable from a
  literal and is unchanged when called with the string alone. Precedence is now never → piped
  → redirected → read → catalog → infra → noisy → plain. Rejected: a second override beside
  `classify()` in the hook (two places that classify), and deleting the `git commit` /
  `npm install` / `pytest` alternatives from the regexes (loses the safe fallback for
  invocation shapes the catalog's `match` does not cover). A named consequence: `git commit`
  in a project is now observed once and, being quiet, left alone thereafter, where before it
  was always filtered as infra.

## Open questions

None outstanding. The three above were the last, and are decided.
