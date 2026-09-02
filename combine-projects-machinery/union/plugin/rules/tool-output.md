# Tool output

What a tool, gate or long-running job must print so that its result survives
being read — by a person, and by the output filter. Loaded at session start.
The filter itself, which rewrites noisy commands to run under a wrapper, is
specified in the quiet-output hook's own story; these are the obligations that
fall on the tools it filters.

## Proof lines and denominators

- A gate that runs sub-checks and sends their output to a log still prints each
  sub-check's own count line on its own output. Pass or fail alone is not
  enough: a failure stays visible anyway, and a pass for a bad reason is exactly
  the thing that gets compressed away.
- When a tool's own summary does not match the declared proof format, it prints
  an additional conforming line carrying its count — in addition to its usual
  report, never instead of it. Otherwise its result is silently eaten by the
  filter.
- Do not pass a tool its own quiet flag when it runs under the output filter.
  The filter already decides what is shown, and the quiet flag deletes the very
  proof line the filter was going to keep.
- A check that cannot run fails loudly, naming exactly what it could not find.
  It never skips quietly, because a skipped check reads as a pass.

## Heartbeats

- A long-running tool prints one line at a bounded, regular interval while it is
  still working, in a single shape used across every tool so one pattern
  recognizes them all. It names the tool, shows it is alive, and gives progress
  where progress is knowable, because a count beats a bare pulse.
- The heartbeat goes to the tool's own output, upstream of any redirect into a
  log. One written inside the redirect reaches nobody.
- A heartbeat survives the filter in every mode, including when it is buried in
  bulk chatter far outside the tail window, and a fixture proves it.
- Once the shape is standard, silence means something: no heartbeat within its
  interval means the job is dead or hung, not that it is probably still working.
  Watch for the pattern, and never sit waiting for a completion signal nobody
  promised you.
- A long-running tool that goes past one interval without emitting a heartbeat
  is itself a defect, on the same footing as a check that reports no count.

<!-- rows: 8.21–8.27, 8.30–8.31 -->
