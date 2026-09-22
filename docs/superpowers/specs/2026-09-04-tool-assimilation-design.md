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

### The generalized command form — identity until #164, a run's shape since

Added 2026-09-07 (#87). **Superseded as identity on 2026-09-21 by the identity head (#164, the
next subsection); everything below still describes the form itself, which is now what a RUN's
shape is and what a record written before #164 is keyed on.** A record is keyed by command LINE, not by tool, and that is the
design — owner, 2026-09-07: *"command lines are unique, not tools. so there can be as many
entries for a command as there are variants."* A variant that recurs accumulates a history
and can graduate; one that never recurs was never worth learning, because a learned answer
line would have nothing to be applied to.

What that does not cover is a tool whose variants are **unbounded**. `gh issue edit 59`,
`60`, `61` — one fresh key per invocation, forever. No variant ever recurs, no history ever
forms, and an answer line identical across all of them is re-learned from scratch every
time. Measured in this repo on 2026-09-07: 60 entries, 59 seen exactly once, 7 noisy enough
to have triggered the training invitation, 0 identification picks, 0 graduations.

So a bespoke key is the command line **generalized**, in the shape the owner set out the
same day — *"command plus alphabetized list of params with values with placeholders like
`gh --a_param %d --b_param %f --c_param %s`"*:

```
gh issue edit 59 --body x        ->  gh issue edit %d --body %s
gh issue edit 60 --body y        ->  gh issue edit %d --body %s   (one record)
bash run.sh --fast               ->  bash run.sh --fast
bash run.sh --slow               ->  bash run.sh --slow           (two: a flag NAME is structure)
```

The rules, all of them heuristics on purpose:

- The command name, its subcommands and its flag NAMES are structure and survive as
  written. Only VALUES become placeholders, which is what keeps `--fast` and `--slow`
  apart — the collapse #15 named as the damaging one.
- A placeholder carries the value's TYPE and nothing else: `%d`, `%f`, `%p`, `%s`. Never
  precision or width — `%f0.2` would fragment again on the next value, which is the defect
  being fixed.
- Parameters are alphabetized, so the order the flags were typed in cannot make a second
  record. An identical parameter written twice is written once.
- A path-shaped token is `%p`. Absolute paths carrying a session-scoped temporary directory
  were the largest single source of unrepeatable keys in the measured record.
- A run of consecutive same-typed values is one placeholder: how many were passed is not
  what tells two tools apart.
- A subcommand path is taken to be at most two words deep (`gh issue edit`, `npm run
  build`); past that a bare positional reads as a value, so `gh label create <name>` is one
  record and not one per label.
- After a generic runner — `bash`, `sh`, `python`, `node`, `npx` and the like — the first
  POSITIONAL is identity and survives verbatim (#15 requirement 2). `node %p` would merge
  every script in a project into one record. A flag's operand is not that positional:
  `node -e "..."` carries a one-off script, not an identity.
- A redirect's target is a value, not a command name. `>`, `>>`, `<` and `<<` end a segment
  like any other operator, but the token after one is a FILE, so it takes the placeholder
  its own shape earns rather than heading a new segment and surviving verbatim (#162, added
  2026-09-21). The operator stays in the key — `cargo test -p %s > %p` and `cargo test -p
  %s` are genuinely two shapes — and it stays where it was written, because the order the
  redirects are in decides which stream reaches the runner's pipe (#160). A pipe is not a
  redirect: after `|` the next token really is a command name and is kept as written.
  Measured before the change, in ferrislicer's record on 2026-09-21: 28 `cargo test … >
  target` keys, 16 shapes — 12 records existed only because of the filename. Existing
  records are not migrated; they age out.

**Which way to be wrong.** The two failure modes are not symmetric. *Collapse* — two tools
at one key — surfaces as picks that never agree, so the tool never graduates and training
stays open: noisy, visible, self-limiting, and the training loop already detects it.
*Fragmentation* — one tool across many keys — produces silence: a key seen once, no picks,
nothing to notice. It went unremarked here for days and was found only by counting. So
where a token's role is unsure the derivation prefers a placeholder to preserving a
distinction of doubtful value.

This is deliberately a heuristic. Owner, 2026-09-07: *"this where heuristics are a feature,
not a replacement for something exact and deterministic."* Nothing exact is recoverable
from a command string. The invariant is not that the key is right; it is that a wrong key
cannot silently persist, which the loop already carries — a matcher that stops matching
re-opens training.

**What graduation matches on.** A generalized key holds placeholders, so it is a prefix of
no command, and a catalog entry built from it would match nothing forever. The pair
`toolKey()` makes therefore carries a third field beside the key: the literal leading run of
the command it came from, closing at the first token the derivation did not keep verbatim.
That is what `lib/graduate.mjs` writes as the entry's `match`, and it comes from the same
walk that made the key, so the two cannot disagree about where the generalization began.

**No migration.** Owner ruling, 2026-09-07: *"we haven't actually processed anything so code
changes are completely unfrozen."* Nothing had ever graduated and no pick had ever been
made, so existing records carried no evidence; they are invalidated by the new derivation
rather than translated to it.

**Known residue, not fixed here.** A runner's first positional survives verbatim by rule, so
a script invoked through an absolute path that carries a session directory or a plugin
version — `node "…/machinery/0.1.93/scripts/intake.mjs" list` — still takes a fresh key when
that path changes. Collapsing it would mean reducing the identity to a basename, which the
requirement above does not authorize.

### The key a bespoke record takes: the identity head

Added 2026-09-21 (#164), replacing the generalized form above as identity. **The identity head is
the command name plus its first positional token.** Everything after it — flags, targets,
redirects — is variation inside the tool, not a record of its own.

```
cargo test -p a                                 ->  cargo test
cargo test --locked -p b                        ->  cargo test   (one record, three runs)
cargo test --no-fail-fast -p c > out.txt 2>&1   ->  cargo test
node scripts/x.mjs check                        ->  node scripts/x.mjs
gh issue create --title t                       ->  gh issue
cd /repo && cargo test -p a                     ->  cargo test   (never `cd`)
```

Why the generalized form could not stay. It kept every flag NAME literal and the lookup was string
equality over it, so two runs of one tool shared a record only when their flags were identical.
Measured in ferrislicer's record, 2026-09-21: `cargo test` ran 27 times and became 27 keys; `cargo
fmt` 22 runs, 11 keys; 60 of 67 cargo keys were seen exactly once. Graduation needs
`GRADUATION_AGREEMENTS` = 2 consecutive agreements on ONE key, so no cargo subcommand could ever
have graduated.

Owner's ruling, 2026-09-21, verbatim: *"i meant it to be the glob, but with type correctness."*
Asked which glob: *"Loose: flags are variation."* Asked what the head is for a command with no
subcommand: *"Command + first positional."*

The rules:

- **The head is a typed glob with one open tail slot.** Matching a command against a record means
  its head is the record's head; the rest of the command fits the slots. A key written BEFORE #164
  is a full generalized form and carries typed slots of its own: it claims only the commands that
  fit them — `gh issue edit %d` claims `gh issue edit 59` and not `gh issue edit main`. Generalizing
  the command is what tests each token against a slot's type, so type correctness is the derivation
  itself rather than a second spelling of it (`keyMatches`, `recordKeyFor`, observations.mjs).
- **No migration.** Nothing writes a full-form key again, so an old record stops being reached the
  moment the head record exists, and ages out.
- **The first positional is kept as written, never typed.** That is what makes the head a literal
  leading run of the command line, which is the property graduation needs — the head IS the `prefix`
  a learned entry matches on by `startsWith`. So `bash run.sh` and `bash ../run.sh` are two heads:
  normalising the script token would produce a string no command starts with, and nothing inside the
  `%p` rules could say which of two spellings is canonical.
- **A flag closes the head.** Proposed as a departure from the ruling's letter ("the first token
  after the command that is not a flag"), then ratified by the owner on 2026-09-21 after he briefly
  ruled the other way and reversed it — *"i changed my mind, don't skip anything."* Forced by the
  invariant below and measured on `python -m pytest tests/ -q`: `-m` takes `pytest` as its operand, so the first non-flag token is `tests/` and the
  literal rule yields `python tests/` — a string the command does not start with, fragmenting the
  record by test directory. Closing at the flag gives `python`, a collapse, which is the visible
  direction. Every example the ruling names is unaffected.
- **A compound heads at its first work-doing segment.** Byte-mover segments never contribute (ruling
  C1, #87, unchanged). The byte-mover list is `classify.mjs`'s `isRead()`, asked rather than
  re-spelled, so the two readers cannot grow different lists.
- **A catalog entry still wins.** `matchTool()` is consulted first and its id claims the command.
- **`toolKey()` remains the single derivation site**, so the runner (quiet-run.mjs) and the trainer
  (train-tool.mjs) agree on the key by construction.

**The prefix invariant.** `prefix` — what a graduated catalog entry matches on — and the identity
head are ONE string, derived once and returned as both fields, so they cannot disagree. A test pins
`generalize(c).prefix === bespokeKey(c)` over a fixture of 30 realistic commands, plus that each
command really starts with its own head.

**Named risk, measured and left open for the owner.** A first positional that is a VALUE rather
than a subcommand becomes the head and fragments by it. Measured over a fixture of 37 realistic
non-byte-mover commands: 22 head at a subcommand, 8 at a runner's script (identity by design, #15),
6 at a bare command name because a flag closed the head, and **1** fragments by a value — `pytest
tests/unit --maxfail 1` heads at `pytest tests/unit`, one key per test directory. `python -` heads
at `python -` for the same reason. `echo hello` and `sed -n 5,10p file`, which the ticket names, are
byte-movers: they write no record at all, so their heads are moot. Whether the catalog should carry
a per-tool head override is the owner's to decide (#164).

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
that matches the line or lines the session identified as the tool's answer**:

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

The session reads a captured log and says *this line, and this one, and this one, are the
answer*. It does **not** invent the pattern. A run may hold several answer lines —
`cargo test` prints one `test result:` summary per target, lib, integration and doctest —
and the session identifies **every** one of them (owner, 2026-09-22, #168). Nothing
anywhere derives an answer by applying the pattern; that would make the check test itself.

Turning `test result: ok. 128 passed; 0 failed` into a matcher means finding what is stable
across runs, and that is arithmetic: the longest common prefix of the lines the session
identified, across repeated observations. After three runs there are three instances and
`test result:` falls out without anyone guessing.

The split matters because it bounds the failure. Judgement stays with the model;
generalisation stays deterministic. A matcher cannot over-reach because the model was
confident, and a single identified *line* can never graduate — there is nothing to take a
common prefix *of*. Three identified lines in one run do have a common prefix to take, so a
run the session read fully can form the matcher on its own.

It is also what keeps machine-derived patterns to prefixes and literals, as required
above: a longest-common-prefix is a prefix by construction. The rule is not a promise the
generator makes, it is a property of how the generator works.

### Graduation is shadow agreement

While a tool is in training, both the local matcher and the session select the outcome
lines, and the two selections are compared. The session's identification **agrees** when the
matcher's match set in that run **equals the identified set** — every identified line and no
other, none missing, none extra. After **K consecutive agreements** the matcher graduates
and the nudge stops firing for that tool.

Set equality is what stops a too-wide prefix graduating: `test` over a cargo run also heads
every per-test line, which nobody identified, so it disagrees and can never graduate. It is
the original exactly-one-line rule generalised to a set, and it keeps that rule's guard
while letting a tool whose answer repeats once per target — `cargo test -p fs-core` prints
three `test result:` lines — be learned at all. `AGREEMENT_MATCH_CAP` = 5 bounds the
**identified set**, not the match count: it is how many answer lines the session may name in
one run. See the 2026-09-22 decisions below (#168; #166's "among the matches" rule is
superseded).

That comparison is the only real training signal available, and it is why the model stays
in the loop until it does not. Nothing else can tell you the matcher is right, because
there is no other oracle.

### Graduation freezes a fixture

This is what makes the result checkable rather than merely trusted. At the moment a matcher
graduates, the observation that trained it is frozen as a fixture with its expected kept
lines: every line the session identified in that run, and every line it identified in each
earlier run of the window, appended. The matcher now has a regression test. The run's lines
that were **not** identified stay in the fixture as non-answers, and that is what the
survival check has left to fail on.

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

**The display cap sits above the floor, and is not the matcher's.** The floor is a property
of `select()`, which decides the kept set. `render()`, which decides what is printed, caps
the display at `MAX_SHOWN` (200) kept lines for every wrapped command whether a matcher was
involved or not: past that it prints the first 120 and the last 80 with an
`... [n kept lines elided between head and tail] ...` line between them. So on a run whose
keep set is at exactly the cap, promoting one more line moves one line into that elision. The
promotion never removes a line from the kept set — the floor holds — and the elision names
itself in the output, which is what keeps the loss visible rather than silent.
This is stated because it is measurable, not because it is desirable: `filter.mjs`'s
`render()` is a pre-existing display limit and the ruling of 2026-09-06 was to make this
description true rather than to change its slicing for a case that arises only at exactly the
cap. `test/lib-filter.test.mjs` pins the boundary through `render()`.

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
   filtered and every line or lines the session identified must appear in the kept set.
   Positive control: remove the outcome declaration and the assertion must fail, so a table
   entry cannot pass by the generic heuristic happening to catch it.
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
    frozen observation and the line or lines the session identified in it as its expected
    kept lines. Positive control: remove the fixture and graduation must be refused.
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
  `cargo build && echo done` stays wrapped. [Superseded by #13, 2026-09-05, next bullet but
  one: the every-segment rule existed because the whole compound could receive only one
  verdict. Classification is per segment now, so the exemption is simply a property of each
  segment; `cargo build && echo done` still wraps the build, and now leaves the echo alone.
  The mechanism of the exemption itself — by name, at the leading position, into `read` —
  is unchanged.] Segments are split outside quotes: a `;`, `&&`,
  `||`, single `&` or newline inside a single- or double-quoted span is data, not a boundary,
  and an unterminated quote runs to the end of the command — the span rule is the one both
  readers, `classify.mjs`'s splitter and `catalog.mjs`'s tokeniser, take from
  `scripts/lib/quotes.mjs` (#11). Rejected alongside: a stdout-only-noise heuristic
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
  literal and is unchanged when called with the string alone. Precedence as of this ruling was
  never → piped → redirected → read → catalog → infra → noisy → plain; the `piped` and
  `redirected` steps were removed on 2026-09-21 (#160, below), leaving never → read → catalog →
  infra → noisy → plain. Rejected: a second override beside
  `classify()` in the hook (two places that classify), and deleting the `git commit` /
  `npm install` / `pytest` alternatives from the regexes (loses the safe fallback for
  invocation shapes the catalog's `match` does not cover). A named consequence: `git commit`
  in a project is now observed once and, being quiet, left alone thereafter, where before it
  was always filtered as infra.
- **A compound is classified and wrapped per segment.** #13, owner 2026-09-05, verbatim: "i
  would apply the rules to inside the compound. so each outputter gets wrapped. since it's &&
  and not a pipe, it theoretically should be no problem." The final re-review had measured the
  whole-command rule's cost: the catalog's `pytest` prefix on the first segment claimed
  `pytest tests/ && cargo build` as one `plain` command, so the build ran unfiltered on its
  observe pass where alone it was `noisy → filter`. Now `classifySegments()` applies the
  precedence chain above to each `;`/`&&`/`||`/newline-joined segment on its own (a pipe is
  one unit, exactly as before), and the hook gives every segment that earns a mode its own
  cmdfile and its own runner — `pytest tests/ && cargo build` becomes
  `node … --mode suggest "f1" && node … --mode filter "f2"` — while the other segments stay
  verbatim and the separators are rejoined as written. The shell owns the control flow: each
  runner exits with its child's real code, so `&&` and `||` short-circuit on it and `;` runs
  on, unchanged from bash's own behaviour. Each runner records under its own segment's key,
  which fell out of `bespokeKey`/`matchTool` being string-in with no change. Two scope
  rules, stated in the hook's own comments: a segment followed by a lone `&` is never wrapped,
  because two concurrent runners would race on the observation record (a plain
  read-modify-write, no lock) and a backgrounded segment's output is detached anyway; and the
  PowerShell shell keeps whole-command behaviour, because 5.1 has no `&&` or `||`. This
  supersedes the "which segment owns a compound" question and the every-segment byte-mover
  rule recorded under C1 above; C1's exemption by kind and I1's precedence both hold
  unchanged, applied per segment.
  *Amended by the controller after review, 2026-09-05 (#13, fix round 1).* The ruling stands
  and is narrowed to where it is safe, because a separator outside quotes is not always a
  command boundary: the review measured `if cargo build; then echo ok; fi` cut into three
  runners and refused by bash, and a heredoc whose body lines each became a runner, so the
  file received runner invocations. (A) Per-segment applies only to a compound of simple
  commands — `classify.mjs`'s `isSimpleCommand()`/`isSimpleCompound()`, the one predicate:
  no heredoc operator (`<<`, `<<-`; the herestring `<<<` is one token and allowed), balanced
  `(` `{` `[[` and an even number of backticks counted outside quotes, no reserved word at the
  lead (`if then elif else fi for while until do done case esac in function select time
  coproc !` and the openers/closers `{ } [[ ]] (( ))`), no trailing `\`. Any segment failing
  it sends the whole compound down the whole-command path exactly as before #13 — one kind
  from `classify(command)`, one cmdfile, one runner — which is not a degradation of the
  ruling but where learning happens on the compound as a unit; pinned in the hook's tests
  against the pre-#13 hook taken from history. (B) A state-mutating segment is never wrapped:
  `export source . set unset alias unalias eval exec trap shopt ulimit umask pushd popd
  readonly declare typeset local`, and a bare assignment `NAME=value` (one or more, no command
  after them; a `$( )`, backtick or `${ }` in the value is folded to one token first). They
  are part of `read` — a second named list, `STATE`, beside `READ` in `classify.mjs`, OR-ed
  into the same every-segment test — because the hook's treatment (untouched, unobserved, no
  record) is the same and a second kind for one treatment would be a second name for one
  bucket. Measured: `export PROBE_VAR=set && node -e …` had printed `var=undefined` with both
  segments wrapped; it prints `var=set` now, and a `source`d export reaches the wrapped
  segment after it. (C) `&` backgrounds the whole AND-OR list that ends at it, not the last
  segment: a segment is backgrounded if walking forward from it over `&&`/`||` reaches a
  lone `&` before `;`, a newline or the end, and nothing in a backgrounded list is wrapped —
  `cargo build && cargo test & cargo bench` wraps only the bench, and
  `cargo build && cargo test &` is untouched entirely. Measured before the amendment: the
  build's runner ran alongside the bench's, the exact record race the rule exists to prevent.
  *Amended again by the controller after re-review, 2026-09-05 (#13, fix round 2).* Two
  regressions from `main`, both measured through real bash. (A) A `#` comment is a span, like a
  quote, in the one scanner (`quotes.mjs`): a `#` that begins a word — at the start, or after
  whitespace or a separator character, outside quotes — opens a span to the next newline, and
  nothing inside it is outside, so a separator there never splits and a word there is no token.
  Measured before: `echo "a" ; # comment && node -e …` was split inside the comment and the
  commented-out node ran; `# skip: cargo clean && rm -rf target` would have run the `rm`. Now
  the first is `echo "a"` plus a comment-only remainder, and a comment-only segment (text
  starting with `#`) is folded onto a neighbour's separator — never wrapped, never observed, no
  record keyed `#`; `echo "#not a comment" && cargo build` and `echo a#b && cargo build` still
  split, and a full-line `# note` between two real segments keeps both per-segment. (B) Leaving
  a state segment verbatim is necessary, not sufficient: only exported env, the cwd, umask and
  ulimit cross into a runner's fresh shell. Measured before: `PROBE3=assigned; node -e …
  "$PROBE3"` printed `bare=` (main: `bare=assigned`), a `$(…)` assignment printed `sub=`
  (main: `sub=sub`), `shopt -s nullglob; node … *.nomatch` gave `argc=1` (main: `argc=0`). The
  list is split by whether the effect crosses a process boundary. Crossing — `export cd pushd
  popd umask ulimit` — stays per-segment, verbatim. Not crossing — a bare `NAME=value`
  (including `$(…)` values), `source . set unset shopt alias unalias declare typeset readonly
  local eval exec trap` — makes the compound not simple, inside the same `isSimpleCommand()`
  predicate so there is still one decision point, and the whole compound takes the
  whole-command path in one shell; `VER=$(git describe); cargo build --features "$VER"` is one
  runner holding all of it, pinned against main's hook. `classify()`'s single-command answer for
  every state word is unchanged: `read`. `exec cargo build` and `eval "$(…)"` classify `read`
  alone and, in a compound, now fall back under (B).

## Decisions taken by the owner, 2026-09-21 (#160, #162, #164)

- **Every command is observed: the `piped` and `redirected` exemptions are removed.** Owner,
  verbatim: "it is redirected into a file, but i don't care to assume if something outputs or
  not. we run commands, observe them, then learn how to wrap them." Asked whether that extends
  to the pipe exemption, same day, verbatim: "cover pipes too." Two steps sat between `never`
  and `read`: `piped`, a pipe into one of `tail head grep rg wc sed awk sort uniq jq tee less
  cut python py quiet-run`, and `redirected`, a `> file` with no `2>&1` token. Both were
  assumptions about a command's output made **before it ran**, and the hook leaves a command of
  either kind alone — so it never ran under the runner, wrote no record in `observations.json`,
  and the training loop never saw it. The redirect exemption also turned on a token rather than
  a measurement: `> file 2>&1` was observed and `> file` was not. Both branches, and the `PIPED`
  and `FILE_REDIRECT` regexes behind them, are deleted; `MODES` is `read, infra, noisy, plain`;
  precedence is never → read → catalog → infra → noisy → plain.
- **A pipeline is a byte-mover only if every stage is one.** A consequence of the above that
  had to be delivered with it, not a separate choice. `READ` is recognised at a leading
  position and `|` is one of those positions, so with the `piped` step gone a pipeline reached
  the read test as one segment and the trailing filter claimed it: measured on the branch
  deletion alone, `cargo test 2>&1 | tail -20` came back `read` from its `tail`, and `cat x |
  cargo build` from its `cat` — both as unobserved as before, which is the defect the ruling
  exists to remove. `isRead()` therefore splits a segment into pipeline stages (a single `|`,
  never `||`) and requires every stage to be a byte-mover. This is ruling C1 read literally:
  "Only need wrapping for output producers, not filter pipes" — a filter pipe is exempt, the
  producer feeding one is not. Nothing else splits on `|`: `classifySegments()` still hands the
  hook a pipeline as ONE unit with one kind, so one runner wraps the whole of it and the stages
  share one record.
- **What the record says about an empty pipe is true, not a gap.** Owner, same day: a run whose
  redirect or filter left nothing for the runner to see is recorded as it measures — a 0-line
  entry and `noisy: false`. Nothing reached the session's context, and that is the honest
  observation.
- **Cost, measured before the change.** In `ferrislicer`, exactly 1 cargo key sat in the
  never-wrapped `redirected` state, and 0 of 125 wrapped cargo runs in the run logs were `>
  file` without `2>&1` — because those were never wrapped, so never logged. The `piped` set was
  uncounted: absent from both the record and the logs by construction, so its size was unknown
  until the exemption was gone. The change adds observation and removes nothing measured.

- **A bespoke record is keyed on the identity head, not on the generalized command form.** #164,
  owner 2026-09-21, verbatim: *"i meant it to be the glob, but with type correctness"*; which glob —
  *"Loose: flags are variation"*; the head of a command with no subcommand — *"Command + first
  positional."* One rule covers both: the identity head is the command name plus its first
  positional token. Flags, targets and redirects are typed slots inside the tool, so `cargo test -p
  a`, `cargo test --locked -p b` and `cargo test --no-fail-fast -p c > out.txt 2>&1` are one tool
  with three runs. The cause measured: the old key kept every flag NAME literal and the lookup was
  string equality over it, so in ferrislicer's record `cargo test` ran 27 times and became 27 keys,
  `cargo fmt` 22 runs over 11 keys, and 60 of 67 cargo keys were seen exactly once — with
  `GRADUATION_AGREEMENTS` = 2 on one key, no cargo subcommand could ever have graduated. The lookup
  in `decide()` is now a glob match: the head, or — until it ages out — a key written before #164
  whose typed slots the command fits. No migration. The full section is "The key a bespoke record
  takes: the identity head" above; it also records the one departure from the ruling's letter (a
  flag closes the head, forced by the prefix invariant and measured on `python -m pytest tests/ -q`)
  and the first-positional risk the owner has not decided, with its measurement.

- **A zero-line run is observed, but it does not decide `noisy`.** #164, owner 2026-09-21. Under
  the identity head, `cargo test > out.txt 2>&1` and a bare `cargo test` are ONE record. The
  redirected run puts 0 lines on the runner's pipes; `recordRun()` rewrote `noisy` from every bare
  run's line count, so that run marked the tool quiet, `decide()` routes a quiet record to `plain`
  — unwrapped — and the next bare `cargo test` with 300 lines reached the session in full. The
  ruling: a run with 0 lines on the runner's pipes is still recorded in the shape history (#160
  stands, every command is observed) but does NOT rewrite `noisy`. Only a run with output on the
  pipe decides. A record whose every run is 0 lines keeps whatever `noisy` it had, or stays without
  one — the "no bare measurement" state `decide()` already routes to observe. **This supersedes,
  for `noisy` only, the bullet above from #160** ("what the record says about an empty pipe is true,
  not a gap"): that reading was honest while every redirect shape had a key of its own; under the
  head it lets one run's plumbing silence another's measurement. The 0-line entry in the history is
  still the honest observation and is unchanged.
- **Proposed and withdrawn the same day: skipping a leading flag and its operand when taking the
  head.** The implementation of the head rule closes the head at the first flag, so
  `python -m pytest tests/ -q` heads at `python` and `gh --repo o/r issue create` at `gh`. The owner
  first ruled instead "skip flag and operand, take the first positional" — which would have given
  `python tests/`, `gh issue` and `make release`, and would have cost the head its literal-prefix
  property, forcing the graduation matcher to become a flag-skipping match. He then reversed it the
  same day, verbatim: *"i changed my mind, don't skip anything."* The head therefore closes at the
  first flag, `prefix` stays a literal leading run of the command line, and the graduation matcher
  stays `startsWith`. Recorded so the question is not reopened as if it were undecided.

## Decisions taken by the owner, 2026-09-22 (#168)

- **The session identifies every answer line in a run.** #168, owner 2026-09-22, verbatim:
  *"the session identifies every answer line"*, chosen among three ways a person could
  identify several answers in one run. So answers stay human-identified, as `survival.mjs`
  requires — indices a person read off the recorded runs, never found by applying the outcome
  pattern, which would make the check test itself. A run may have several; the session names
  all of them; nothing derives one.
- **Agreement is set equality**, derived from that ruling and the survival principle, not a
  separate decision: the shadow matcher agrees when its match set in the run **equals** the
  identified set — same indices, none missing, none extra. It is the original exactly-one-line
  rule generalised to a set, and it is what keeps the over-wide-prefix guard alive.
  **#166's "among the matches, at most 5" rule is superseded by this.** `AGREEMENT_MATCH_CAP`
  = 5 stays, with a new meaning: it bounds the **identified set** — `train-tool.mjs identify`
  refuses more than five `--line` numbers, naming the cap — not the match count.
- Consequences, in the same ruling: a pick records the texts of **all** lines identified in
  that run; `deriveMatcher` is the longest common prefix over every identified text in the
  window, so three identified lines in one run already form a matcher; `frozenFixture`
  declares all of this run's identified indices plus every earlier pick's identified texts,
  appended.
- Measured, at 8611947, on a synthetic fixture built to the trial's shape: under #166's rule
  the loop reached agreement and then `graduate()` was refused by `survival.mjs` — *"the
  outcome pattern also matches a non-answer line"* — which is the live trial's failure
  (ferrislicer `--local` clone, 2026-09-22, catalog `{}` after four picks). Declaring every
  matched line an answer instead would have made the guard vacuous by construction: the
  over-wide prefix `test` hit 5 lines and passed exactly like the right one.
- **Not decided**: whether 5 is enough for a workspace-wide `cargo test --workspace`. Nothing
  above three targets has been measured. If a trial hits the cap that is the owner's call,
  not a silent raise.
- Old-shape picks (a single `text`) in an existing `observations.json` read as a one-element
  identified set. No migration; they age out of `PICK_WINDOW`.

## Decisions taken by the owner, 2026-09-22 (#166, superseded by #168)

- **A pick agrees when it is among the matcher's matches, at most 5 per run.** SUPERSEDED by
  #168's set-equality rule; kept as the record of what was tried and why it fails the
  survival principle — it lets a matcher graduate over lines nobody identified, which is the
  thing `survival.mjs` refuses. #166, owner
  2026-09-22, verbatim: *"go."* The rule was `shadow.length === 1 && shadow[0] === index` —
  the matcher picking exactly this line and no other. It is now
  `shadow.length <= AGREEMENT_MATCH_CAP && shadow.includes(index)`, with
  `AGREEMENT_MATCH_CAP` = 5 named beside `GRADUATION_AGREEMENTS` in `training.mjs`.
  Measured, live trial of the #164 branch in a `--local` clone of ferrislicer, 2026-09-22,
  six `cargo test` runs: all six landed on the one head `cargo test`; run 2 formed the
  matcher `prefix "test result: ok. "`; run 3 (`--lib`, one `test result:` line) agreed.
  Runs 5 and 6 (`-p fs-slice`, `-p fs-core --no-fail-fast`) each print three `test result:`
  lines — lib, integration, doctest — so `shadow.length === 3`, the old rule disagreed, the
  streak reset, and the catalog after four identified picks was `{}`. The filter was
  already right about that run: `select()` (`filter.mjs`) keeps every match and promoted all
  three lines; only the agreement gate refused it. The cap was the assistant's proposal,
  accepted with the plan: 5 sits far below a prefix like `test` (dozens of hits) and above a
  handful of per-target summary lines. Graduation, the frozen matcher and the fixture
  `graduate()` writes are unchanged.

## Open questions

None outstanding. The three above were the last, and are decided.
