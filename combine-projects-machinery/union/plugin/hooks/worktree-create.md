# Working-copy create

Replaces the harness's own creator of isolated working copies, so that the
branch is named exactly what the copy is named rather than trusting anyone to
type it. The rules about when a separate working copy is required, and what to
do first inside one, are in `rules/worktree-discipline.md`; this is the tool
that makes it.

**When it runs:** When the assistant is asked to create a new isolated working
copy, in place of the harness's default creation step.

**What it reads:**

- The event payload: the requested name (from the primary field, falling back
  to the documented alternative), the repository the request came from, the
  parent directory that holds working copies, and an explicit base reference if
  one was supplied.
- The project's own settings file, for the base-reference mode, but only when
  the payload named no reference.
- Version control, to ask whether a branch of that name already exists.

**What it does:**

1. Read the payload and take the name from the first field present.
2. Strip a leading working-copy prefix if the harness baked one into the name,
   so the directory and the branch both come out bare.
3. If what remains is empty, abort: write a message on the error channel naming
   this hook and quoting the whole payload it was handed, and exit non-zero.
   A non-zero exit aborts creation, and that message is the reason the caller
   is shown.
4. Resolve the base reference when the payload gave none. Read the project
   setting: *current position* branches from the local head; *fresh* branches
   from the shared upstream's default branch. When the settings file is missing
   or unreadable, fall back to the documented default of *fresh*. When the
   upstream default cannot be determined, branch from the local head rather
   than fail.
5. Compute the path as the parent directory joined with the bare name, and
   create the parent directory if it does not exist.
6. Ask whether a branch of exactly that bare name already exists.
7. If it does, attach the new working copy to that existing branch rather than
   trying to create the branch a second time.
8. If it does not, create the working copy and a branch of the same bare name
   from the resolved base reference.
9. Route everything the underlying commands print to the error channel, so that
   the output channel carries only what the contract promises.
10. If creation fails, abort with a message naming the failure and the status
    it exited with. Nothing is left half-made and reported as success.
11. On success, print the created working copy's full path on the output
    channel, and nothing else.

**What the user sees:**

- On success, exactly one line on the output channel: the full path of the new
  working copy. A caller can use that line directly, with no parsing.
- On an empty name, on the error channel:
  `working-copy create: empty name; payload was: <the whole payload it was handed>`
  and creation aborts.
- On a failed creation, on the error channel:
  `working-copy create: creation failed (exit <status>)`
  and creation aborts.
- Every message the underlying commands produce appears on the error channel,
  never mixed into the path.
- What the caller must do first inside the new copy — reset it onto the exact
  branch the work targets, whichever of the local and the shared copy of that
  branch is newer — is stated in `rules/worktree-discipline.md`, because this
  tool's base-reference choice hands that obligation to the caller rather than
  discharging it.

**Acceptance checks:**

- Given a request to create a copy named `x`, when the hook runs, then a
  working-copy directory named exactly `x` exists on a branch named exactly
  `x`, with no added prefix on either.
- Given a request whose name arrives with the harness's own prefix already
  attached, when the hook runs, then the prefix is stripped and both the
  directory and the branch come out bare.
- Given a request carrying no name, when the hook runs, then nothing is
  created, the error channel carries the message and the whole payload the hook
  was handed, and creation aborts.
- Given the base-reference setting reads *current position*, then the new
  branch starts at the local head; given *fresh*, it starts at the shared
  upstream's default branch; given *fresh* with no determinable upstream
  default, it starts at the local head rather than failing.
- Given a branch of that name already exists, when the hook runs, then the new
  copy is attached to it and no second attempt is made to create the branch.
- Given any successful run, then the output channel holds exactly one line —
  the full path — and every other message produced along the way appears on the
  error channel.

<!-- rows: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6 (5.6 referenced, stated in rules/worktree-discipline.md) -->
