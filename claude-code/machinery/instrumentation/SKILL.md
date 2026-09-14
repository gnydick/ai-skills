---
name: instrumentation
description: Load when debugging by adding diagnostics, when measuring or comparing performance, when adding a diagnostic switch, trace, profiler span or diagnostic code, and when a program must print a cost or count. Instrumentation is added when debugging or measuring, never as a duty on every function or site.
---
# Instrumentation and measurement

## Adding diagnostics
- Add instrumentation when you are debugging or measuring. Measure instead of reasoning about where a boundary or defect ought to be.
- A diagnostic dump prints the values the code actually used, never a recomputed equivalent.
- A new diagnostic switch is inert until turned on, prints its denominator and explicit zeros, and is added to the project's diagnostics index in the same change.
- Temporary measuring code in a worktree others can see: announce the file and a unique marker before writing it; remove both when the measurement ends.
- Declare each diagnostic code once, in one entry holding its documentation, its external name as a literal, and its severity; generate the code list, external format and level table from it. Call sites never pass a level.

## Measuring
- A timer wraps only the work, never the condition that decides whether the work runs.
- A cost the program prints comes from its own clock, read once at the site that prints it, never from a profiler that is off by default.
- A measurement of one run is a value that run returns, carrying its counts and their total together, never a running total that outlives the run.
- Instrumentation for a performance change ships in the same build as the change.
- Measure from a separate worktree, not the one being edited, on a quiet machine (no other build running), and state the configuration with every number.
- To compare two builds: build both first, then alternate runs between them and report every round.
- Change one variable at a time.
- Before reusing a technique that works by skipping work, measure what fraction of inputs at the new site can be skipped.
- Before turning on a path that has never run, confirm it does not repeat the system's most expensive existing computation; merge any duplicate first.
