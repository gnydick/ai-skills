# Merge gate

The full battery, run on the merged result before it is pushed. Everything the
commit gate is too frequent to afford lives here. The standing-measurement
ratchet is one of its legs and has its own story in `gates/ratchets.md`; the
merge bar it enforces — every required leg green before a merge starts — is in
`rules/worktree-discipline.md`.

**When it runs:** At merge time, locally, against the merged result and never
against the branch alone. A branch that passes tells you nothing about the tree
you are about to push: the other side may have deleted what you call, or
outlawed the form you wrote, since you branched. These legs live wherever they
actually execute — when the hosted checks are absent, or turn out not to be
running, they move locally to merge time. Confirm they ran rather than assume
it: a hosted service can fail in a way that reports failure for days while
everything keeps landing.

**What it reads:**

- The merged tree, in its own build directory.
- A committed baseline of the known standing failure set.
- The pre-merge tip, for the legs that work from a changed-file list: the
  merge's first parent when the head is a merge, else the merge base with the
  shared default branch, else the previous commit — and never the parent order
  alone.
- Its own log directory, one log per leg.

**What it does:**

1. Resolve everything the run depends on once, up front, before the first leg.
   Anything unresolvable aborts the whole run loudly on the error channel,
   naming exactly what was looked for and in what order. Never a quiet skip: a
   leg that cannot run its own parser must not read as a pass, and a quiet
   failure later can leave a stale artifact that a subsequent leg reads as a
   real verdict.
2. Build in the gate's own directory, never one shared with the working copies.
   Concurrent builds into a shared directory poison the cache and produce
   errors that contradict the source, and the gate is the worst place to be
   diagnosing that. Sharing stays available behind an explicit, deliberate
   override.
3. Resolve the base reference without trusting the order of a merge's parents:
   compare against both, or resolve the pre-merge tip directly. Keep a case
   built the wrong way round as a fixture that asserts the gate goes red.
4. Pin the toolchain explicitly in the gate's own configuration — not a
   floating channel, and not read from somewhere the build could override — so
   that moving it is a deliberate one-line change somebody can see.
5. Run every leg through one runner that prints the leg's name, runs it with
   its output redirected to that leg's own log, captures the *command's* own
   exit status and never a pipe's, and buckets the leg as passed, failed or
   skipped. A trailing filter reports its own status, and that has turned a red
   battery green more than once.
6. Where that redirect swallows a leg's own count line, comply at the call site
   that owes the rule: re-read the log the leg just wrote and echo its one
   count line to the gate's own output, pass or fail. Do not change the shared
   runner's behaviour for every leg inside a change that was about something
   else — that wider change is a decision of its own and gets its own work.
7. Run the legs. Each is stated here as one generalised example; the specific
   set is the project's.
   - **Compile twice, not once.** Once with every optional feature on and every
     target included, and separately with the optional features off — a build
     with everything switched on cannot see the code that breaks when something
     is switched off. A switch that limits what *ships* must not also limit
     what gets *compiled* while verifying, or the code behind it is never
     compiled at all.
   - **Warning-free.** Something unused is deleted, or explicitly marked as
     existing for the tests, never left generating a warning nobody reads. A
     warning that is always present is one nobody notices the day it means
     something.
   - **Defect checks, a chosen class.** The lint leg runs a deliberately chosen
     class rather than everything available, so the gate is about defects
     rather than taste.
   - **Formatting, changed files only.** With the pinned formatter, invoked one
     file at a time, never handed a package or directory root — that reformats
     siblings the change never touched and has to be reverted every time.
     Generated output is skipped; named parts of the tree may be exempt
     altogether to preserve drift that predates the rule, and new files inside
     an exempt area may still be formatted individually. The leg captures the
     exit status of the command producing the changed-file list and requires it
     to be zero before trusting an empty list: swallowing its failure yields an
     empty list, which reads exactly like "nothing changed" — a crash wearing a
     pass.
   - **Evidence that something ran.** Any leg whose command can exit
     successfully having matched zero cases — a name filter that stopped
     matching, a scan that walked no files — additionally requires evidence
     from its own summary that at least one case actually ran. Nothing-of-
     nothing and a healthy pass are the same exit status.
   - **Governance backstop.** The commit gate's own checks re-run here, in
     their full rather than cheap form, as the backstop for a clone that never
     activated the hooks, with each checker's own self-test beside it.
   - **Tests the ordinary suite never reaches.** A tool nothing else exercises
     has its own tests run by the leg that consumes it, before its numbers or
     its behaviour are trusted. A check nothing runs is not enforcement.
   - **Document against code.** A document that states a fact about the code is
     parsed alongside the code and the leg fails if they disagree, so the
     change that moves the fact either updates the document or turns the gate
     red. Where the document could instead be generated from the code, that is
     the stronger remedy and this leg is the fallback for where it cannot be.
   - **Artifact against artifact.** Two artifacts that must describe the same
     thing are checked against each other and advance together. Unchecked they
     drift quietly, and you end up with two descriptions of one thing several
     changes apart with nothing saying which is current. Where the full check
     cannot run in this environment, run the part that can rather than skipping
     it.
   - **The whole test battery**, judged as in step 8.
8. Judge the battery by diffing its failure set against the committed baseline,
   never by its exit status. Over a tree with a known standing red set, an
   exit-status gate means either ignoring the gate or never passing it. Fail
   only on failures not in the baseline.
9. Report the newly *passing* cases as loudly as the newly failing ones. A case
   that starts passing is either good news or a check that has stopped
   checking, and nothing in the result itself tells you which.
10. Keep one owner. One component owns parsing the run's output, checking its
    evidence and holding the baseline; the gate only renders that verdict in
    its own pass/fail/skip vocabulary. Two independent readings of one output
    are two opinions of one fact, and they will eventually disagree.
11. Treat a missing verdict as a hard failure, never a fall-through to whatever
    the last run left behind. If the owning component wrote no verdict, that is
    a hard failure; if it wrote a category the gate does not define, that is a
    hard failure too. Only the outcomes the gate defines are allowed to pass.
12. Offer a quick mode that skips the expensive sweep, for iterating, and never
    use it for a merge. What it skipped prints as skipped, never as passed.
13. Fix an intermittently failing leg at its cause. Never a retry, never a
    rerun-the-failures step, never an ignore marker, and never forcing
    everything to run one at a time — each of those keeps the gate green while
    it stops meaning anything.
14. Close with the verdict: on a clean run, the count of legs passed and
    skipped and a zero exit; otherwise the count of legs failed out of the legs
    run, each failed leg named, the log directory, and a non-zero exit.

**What the user sees:**

- A header naming the tree being gated, the base it resolved, and the build
  directory it is using.
- One line per leg, name padded to a fixed column, then its outcome:

```
  <leg name>                                  pass
  <leg name>                                  FAIL (exit <n>, <log path>)
  <leg name>                                  skipped (--quick)
```

- Each echoed count line indented beneath its leg, in the declared proof-line
  format so it survives the filter.
- The closing verdict:

```
MERGE GATE PASSED  <n> gates, <m> skipped
MERGE GATE FAILED  <n> of <m> gates
```

  followed on a failure by one line per failed leg and the log directory.
- On an unresolvable prerequisite, on the error channel and with an exit status
  distinct from a gate failure:

```
FATAL: no usable <tool> found (checked, in order: <candidates>). Refusing to
run the merge gate rather than silently skipping a leg and letting the run read
as a pass.
```

- The hard-failure lines, verbatim in shape:

```
GATE: <renderer> produced no verdict — treating as a hard failure
GATE: <renderer> wrote an unrecognised category '<x>' — treating as a hard failure
GATE: 0 cases matched the <filter> filter — no evidence the invariant actually ran
```

**Acceptance checks:**

- Given a branch that passes every leg on its own, when it is merged into a
  tree whose other side deleted something the branch calls, then the gate run
  on the merge result goes red — proving a run on the branch alone proves
  nothing.
- Given a tree with a known standing failure set recorded in the baseline, when
  the run reproduces exactly that set, then the gate passes despite the suite's
  own non-zero exit status; when the run adds one failure, the gate fails
  naming only the new one; and when one baseline failure now passes, that is
  reported loudly rather than absorbed.
- Given a leg piped into a trimming command, then what buckets the leg is the
  leg's own exit status and not the filter's; and given the changed-file
  command itself failing, then the leg fails rather than reporting that no
  files changed.
- Given a name filter that matches zero cases, then the leg fails for lack of
  evidence that anything ran, even though its command exited successfully.
- Given the verdict absent, or carrying a category the gate does not define,
  then the run is a hard failure and never a pass; and given a prerequisite
  that cannot be resolved, then the whole run aborts before the first leg with
  a message naming what was looked for.
- Given quick mode, then what it skipped prints as skipped and never as passed;
  and given a merge, then quick mode is not used at all.

<!-- rows: 15.1–15.20, 15.31, 15.32, 15.33, 15.34, 15.36, 15.37 -->
