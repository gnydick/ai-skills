# Working-copy discipline

The life of an isolated working copy: naming it, basing it, working in it,
committing from it, merging it, and taking it down. Loaded at session start.

## Creating one

- A multi-commit effort starts only on the owner's explicit go, given directly
  to whoever will run it. An authorization passed along by somebody else does
  not count.
- Name a working copy for the work it holds, not for a date and not for a ticket
  number. The name is how anyone else tells what is running in it.
- Name the branch exactly what the working copy is named, with no added prefix,
  and let the tool that creates copies enforce it rather than trusting people to
  type it.
- The creating tool strips any prefix the harness added, so the directory and
  the branch come out bare, and it refuses a request with no name, saying what
  it was handed.
- Where a new working copy branches from is a project setting, not a guess: the
  current local position, or the shared upstream default. When the upstream
  default cannot be determined, branch from the current position rather than
  fail.
- When the branch already exists, attach the new working copy to it rather than
  trying to create it a second time.
- The creating tool prints the new copy's location on its output channel and
  nothing else, sends every other message elsewhere, and aborts creation on any
  failure with its own message shown as the reason.
- First act in a fresh working copy: reset it onto the exact branch the work
  targets — everything after builds on that tree. A fresh copy is not there: it
  opens on the project's default branch, and your own copy of that branch may be
  newer than the shared one, so reset onto whichever is newer.

## Working in it

- Inside a working copy, anything above the project root is off limits unless
  you were asked to touch it.
- A working copy someone else can see is shared state. Announce temporary
  measuring code before you write it — the file, and a unique marker to find it
  by — and remove both when the measurement ends. Unannounced, live
  instrumentation is indistinguishable from unexplained drift, and the honest
  response to unexplained drift is to revert it, which destroys the measurement
  mid-run.
- Working copies share one incremental build cache and can poison it. When a
  build error contradicts what the source plainly says, clear the cache and
  rebuild before treating the error as real.
- If you are about to make a second commit on the shared copy for one continuous
  piece of work, you already needed a copy of your own. Stop and make one before
  going further. This is a backstop, not a licence for the first commit, which
  did not belong there either.
- A fixture that spawns a real subprocess strips every ambient environment variable that could redirect it outside the fixture's own directory before the first invocation, because a hook-invoked test inherits the hook's environment, not the shell's.

## Committing from it

- Every commit names the exact paths it is committing. A commit that just takes
  whatever is staged sweeps in whatever else was lying around, and that has put
  unrelated files into commits before.
- Put the message and its flags before the path separator on a commit command.
  Everything after that separator is read as a path, including a flag that
  strays there.
- Stage the named files a change touches, never a blanket add-everything, which
  quietly re-tracks ignored scratch content.
- Some tracked files are the owner's own working record and are never staged by
  an assistant, whatever else the change touches.
- An advisory backstop fires when a documentation-shaped commit also adds a
  brand-new non-documentation file, naming it without blocking. It goes silent
  only if the commit also modifies an existing non-documentation file elsewhere
  — that is an openly mixed commit, not a sweep.
- Every commit message ends with the standard trailer attributing the
  assistant's part in it.
- Credit the person by name for any idea, diagnosis, algorithm or fix that came
  from them, in the commit message and in the code comment.

## Merging and tearing down

- The merge is made locally first, into a private merge result nobody else can
  see, because the gate judges that result and it has to exist to be judged.
  Publish only when every required verification leg on it is green; a red
  result is discarded, never pushed. Passing one leg is not passing, and a
  merge that exists only locally is not yet a merge anyone has to live with —
  which is exactly what makes discarding it cheap.
- Branches kept for exploration are never merged automatically. Merging one is
  always a deliberate decision.
- Delete the working copy and its branch immediately after the merge, in the
  same session. Each copy carries its own build output, and stale ones have run
  to hundreds of gigabytes. The merge is not the end of the effort; the teardown
  is.
- Before you finish, list the working copies that exist. Anything left that is
  not active work is debt: report it, and never quietly delete someone else's.
- Never delete a working copy that has uncommitted changes without asking first.
- A working copy that some tool holds a lock on is released through that tool,
  never removed by hand while it is still in use.

<!-- rows: 5.1–5.23, 5.39–5.40 -->

## What may be merged

- Only code that is not broken and will not cause problems is merged into the shared line. A green gate is necessary and not sufficient: the gate measures tests and invariants, and this bar is about what a user can reach and what happens when they do. (Gabe, 2026-09-05, URULE.)
- Incomplete code may be merged when it is unreachable: nothing in production can call it, so nothing can go wrong. Incomplete code a user CAN reach — a control that does nothing, a default configuration that warns on every layer, a path that answers wrongly — is not mergeable until it is finished or made unreachable.
- This is the merge bar, distinct from finishing the feature (work-tracking.md § Staying inside the effort). An effort may land in pieces, each piece clearing this bar; holding a whole effort back because one reachable part is unfinished is the wrong reading, and so is landing the reachable unfinished part.
