# Verification and evidence

What a change must predict, what counts as evidence for a claim, and how a
measurement is taken so that it could have come out differently. Loaded at
session start.

## Predict before you work

- Every change writes down the beliefs that make its design and its choices
  legitimate.
- Every change predicts what it will affect and, just as explicitly, what it
  must leave alone. The second half is the one that can be proved wrong, so it
  is the half that carries the information.
- Write the predictions before doing the work. Written afterwards they only
  describe what happened; they were never able to fail.
- After the work, confirm each prediction one by one and say for each whether it
  held. A blanket "everything passed" is not a confirmation.
- A prediction left unconfirmed means the work is not finished. It is not a
  caveat and not a follow-up item.
- A prediction that fails is a result to report at full strength, not a mess to
  tidy. Say explicitly which was wrong: the work, or the belief behind it.

## Declare the standard you are claiming

- A change declares in advance which standard it is claiming: identical output,
  because it was meant to change nothing, or structural checks, because it
  deliberately changes behaviour. Calling a behaviour change a cleanup is how
  that standard gets dodged.
- A claim that output is unchanged is measured by producing the output and
  comparing it. It is never assumed.

## What the check could actually see

- Say what your check could actually see, in the same breath as the claim it
  supports. A check whose reach is narrower than the claim is evidence for a
  different question, and it looks exactly like evidence for yours.
- Ask why the result looks the way it does, not merely whether it looks right.
  Green and plausible is what a wrong answer to an unasked question looks like.
- Someone else's confidence is not evidence of coverage. Verify counts yourself,
  because a complete-looking list is not proof of completeness.
- List the checks a change requires before running the first one, and let no
  pass cancel another. A good result is the most dangerous place to stop,
  because stopping then feels earned.

## The word you just wrote makes a check due

- The trigger is the word you just wrote. Writing "class", "confirmed",
  "closed", or naming what the tooling can do is what makes the matching check
  due.
- If you call a defect a class, a shape, or a pattern, you owe every instance of
  it: search the area you changed and fix or defer each one by name before
  closing. Fixing the one you were shown does not discharge a claim about a
  class.
- A diagnosis is confirmed only when you can trace the path, step by step, from
  the real observed input to the line you are blaming. Reading the end of the
  code correctly does not show that execution ever reaches it.
- When the task exists because an earlier belief was proved false, say what that
  belief assumed about its inputs, and check whether the replacement quietly
  assumes the same thing one layer down.
- A question is closed only when you can name what would have to be true, in a
  form a later reader can check and find false. If all you can write is prose,
  the question is still open.
- Before doing anything that reaches outside your own working copy, get the
  target from the environment itself, not from a document. A document copied
  from another project carries that project's addresses.
- Before claiming that some piece of tooling exists, blocks something, or would
  catch a given fault, run the check that could prove you wrong. The project's
  own documentation is the most dangerous source, because it reads as
  authoritative and goes stale silently.

## Tests

- Write the failing test first and watch it fail, then write the smallest code
  that makes it pass.
- Every fix and every new unit of code ships with its own test, something that
  generates its test data, and a case added to each broader test that covers it.
- When code moves, its tests move with it.
- Run the whole suite rather than stopping at the first failure, and never
  truncate its output.
- The full suite passes at the end of every step you would commit.
- A regression test covers the default setting, not only an unusual one, or it
  cannot fail the way real users fail.
- If a suite has no way to express a given failure, it is not coverage for that
  failure, no matter how green it is.

## What a test can honestly claim

- Asserting that something did not happen only counts if the observer was
  capable of seeing it happen. Say what would have proved the observer was
  alive.
- A test that captures output for checking reproduces the line a real user sees,
  byte for byte. A capture that renders a field its own way is not evidence
  about the output, it is evidence about itself — so the capture and the real
  renderer are one renderer, reached the same way, and the equivalence is pinned
  by running both over the same input and comparing the lines.
- Where a unit test cannot honestly reach — a layer that would have to open a
  real window — say so and verify by build, lint and a hands-on run instead of
  pretending coverage.
- A test that guards how an algorithm scales asserts the work it actually did,
  measured against what its input entitles it to, never a time limit. On a
  shared machine a stopwatch measures the machine, and cannot tell a busy one
  from an algorithm that got slower. A generous time limit may stay as a
  backstop against hanging, never as the verdict, and the work count ships with
  a positive control, because something that never ran satisfies any upper bound
  for free.
- A refactor lands in two steps, never one: move the code with no change in
  behaviour and the tests still passing, then change the behaviour. Done
  together, nothing can tell you which half broke it.

## Comparison runs and baselines

- Judge a comparison run by diffing its failure set against a known baseline,
  never by its exit code.
- When a baseline moves unexpectedly, stop and work out why. Updating the
  baseline to make the check pass is never the fix.
- A regenerated baseline proves only that the tool agrees with itself. A person
  reviews every regeneration line by line.
- A skipped case is unproven, not passed, and every one of them is named in the
  report.
- Never change the code just to make a check go green. Describe the fix and
  stop.
- Never adjust a comparison's tolerance in order to produce the finding you
  wanted.
- A comparison that does not suppress whitespace is not a comparison of the
  code: a line merely re-indented shows up as both a removal and an addition, so
  anything counting added lines counts unchanged code as new. Run it again
  ignoring whitespace; the deletions collapsing to nothing is what tells you.

## Measuring performance

- Measure first. Instrument the thing and look, instead of reasoning about where
  the boundary or the defect ought to be — the reasoning is what you are trying
  to check.
- A timer wraps the work and nothing else, never the test that decides whether
  the work runs. Otherwise a zero reading means both "it did not happen" and "it
  was too fast to see", and nothing distinguishes them.
- Never compare two performance builds by running one after the other. Build
  both first, then alternate between them and report every round: run
  sequentially, you are measuring how the machine drifted as much as what you
  changed.
- A performance measurement runs against a separate working copy, never the tree
  you are editing. There is deliberately no option for the other thing, because
  editing under the measurement is how a number becomes unattributable.
- Measure on a quiet machine. Background load — another build, most obviously —
  does not produce noisy conclusions, it produces confident and wrong ones.
- Always record and state the configuration a measurement was taken under. Which
  part dominates the cost changes with it, so the conclusion does too, and a
  number without its configuration cannot be compared with anything.
- Measuring one variable while a second one dominates the outcome measures
  nothing at all. Isolate them one at a time before you trust an effect you
  think you have measured.
- A correctness question never rides along inside a performance commit. It gets
  its own change, its own test data, and its own comparison against the
  known-good result.
- Put the instrumentation for a performance fix in the same build as the
  measurement that tests it, so a single run shows both whether it worked and
  why.
- Any instrument built to verify a change ships in the same build as the change.
  Verifying one build with an instrument compiled into another is comparing two
  things, not measuring one.
- Before reusing a technique that works by skipping work, measure what fraction
  of the inputs at the new site can actually be skipped. That fraction decides
  whether it helps, not the fact that the code looks the same shape.
- Turning on a path that has never run must not multiply the cost of the most
  expensive thing the system already does. Where it would derive the same
  expensive fact twice, collapse it to one before the path goes live.

<!-- rows: 3.1–3.50 -->
