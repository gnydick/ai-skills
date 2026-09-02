# Wiring

Where each mechanism attaches, what the platform has to provide for it, and how
a clone turns it on. The behaviour of each is in its own story under `hooks/`
and `gates/`; this document is only the attachment map.

## What a platform must provide overall

Five event kinds and one entry point. A platform missing one of them cannot run
the mechanism that hangs off it, and saying so plainly is part of claiming the
mechanism exists.

- An event when a prompt is submitted, firing before the assistant composes a
  reply, whose handler's output is folded into the turn's context.
- An event before a shell command runs, whose handler may return a *rewritten*
  tool input rather than merely observing.
- An event after a file edit or write completes, whose handler's output is
  folded into the turn.
- An event when a session starts, whose handler's output opens the session.
- A replaceable creation step for isolated working copies, where the handler's
  standard output is the contract and a non-zero exit aborts creation.
- A pre-commit entry point in version control, invoked on every commit,
  where a non-zero exit rejects the commit.

Two conventions run across all of them. Every handler is given the project root
of the checkout the session is running in, so a mechanism that writes a file
writes it in the right copy. And every handler that cannot do its job reports
success and does nothing, rather than blocking work — except the two that are
gates, whose whole purpose is to block.

## Per mechanism

### `hooks/rule-capture.md`

- **Event:** prompt submit, before the reply.
- **Ordering:** must complete before the assistant sees the prompt, so that a
  turn which dies part-way through has already produced the entry.
- **Timeout:** thirty seconds. It writes one small append and prints one line.
- **Platform must provide:** the prompt text and a session identifier in the
  payload; the project root; the handler's output folded into the turn's
  context.

### `hooks/rule-nudge.md`

- **Event:** after a file edit or write completes, matched to the edit and
  write tools only.
- **Ordering:** after the tool has run; it observes, never intercepts.
- **Timeout:** thirty seconds, with its own inner limit on the version-control
  query so that a slow repository cannot consume the whole budget.
- **Platform must provide:** the edited file's path in the payload; the project
  root; the ability to run one scoped version-control status query.

### `hooks/quiet-output.md`

- **Event:** before a shell command runs, matched to the shell-command tools.
- **Ordering:** it must be able to *replace* the tool input, and it must be the
  only handler on that event that does so — two rewriters of one command are
  two opinions of one fact.
- **Timeout:** fifteen seconds. Exceeding it must leave the command running as
  written, never blocked; the check fails open in every branch.
- **Platform must provide:** the tool name and the command text in the payload;
  a way to return a rewritten tool input; a writable temporary directory,
  ideally scoped to the session so logs are collected with it; and no
  interference with the wrapper's exit status, which is the command's own.

### `hooks/worktree-create.md`

- **Event:** the working-copy creation step, replacing the platform's default.
- **Ordering:** it *is* the creation; nothing else may create the copy.
- **Timeout:** five minutes, because it may be doing real work over a network.
- **Platform must provide:** the requested name, the repository, and the parent
  directory in the payload; the contract that the handler's standard output is
  the created path and nothing else, that other channels are ignored, and that
  a non-zero exit aborts creation with the error channel as the reason.

### `hooks/session-banner.md`

- **Event:** session start.
- **Ordering:** first, before anything else the session reads.
- **Timeout:** ten seconds. It is a fixed string and needs no lookup.
- **Platform must provide:** a session-start event whose output opens the
  session. Nothing else.

### `gates/commit-gate.md`

- **Event:** the pre-commit entry point, on every commit.
- **Ordering:** its two executable blocking checks first — the register check
  and the citation-target check — in either order, then the advisory warning,
  then the verdict. Advisory output never changes the exit status. Its other
  two checks are properties the gate's header states and a person applies (the
  bypass rule and the activation rule), so they have no run order.
- **Timeout:** none, but a hard budget instead: it must stay cheap enough that
  nobody wants it switched off. Anything that is not cheap belongs to the merge
  gate.
- **Platform must provide:** a pre-commit entry point that runs on every commit
  and rejects on a non-zero exit; a way to read the content *being committed*
  rather than the working copy; a documented bypass; and a hosted check that
  can run the same checks on push, for clones that never activated the hooks —
  blocking, as ruled in `gates/commit-gate.md`.

### `gates/merge-gate.md`

- **Event:** run by hand at merge time, against the merged result, before the
  push.
- **Ordering:** prerequisites resolved once before the first leg; legs in any
  order; the verdict last. A leg's own exit status buckets it, never a pipe's.
- **Timeout:** none. It is the expensive gate on purpose, and it is where every
  heavy check moved to.
- **Platform must provide:** an isolated build directory; both merge parents
  reachable; a committed baseline file; and a log directory the gate owns.

### `gates/ratchets.md`

- **Event:** one leg inside the merge gate.
- **Ordering:** strictly after the measuring tool's own tests, in the same leg.
  Its numbers are never read before those tests pass.
- **Timeout:** none; it runs within the merge gate's budget.
- **Platform must provide:** nothing beyond what the merge gate provides, plus
  a committed baseline file the ratchet owns.

## Activation, per clone

Wiring is tracked in the repository and activated once per clone by one
explicit command that points the hooks-path setting at the tracked hooks
directory. It never installs itself. A hook nobody can see in the tree is a
hook nobody maintains, and one that installs itself silently is worse.

The consequence has to be stated wherever the gate is claimed, not glossed
over: that setting is local and per clone, and nothing in version control
enforces it. So a clone that never ran the command is not gated locally at all,
which is why the hosted check runs the same checks on push, why the merge gate
re-runs them as a backstop, and why the session banner names both conditions
rather than claiming enforcement in general.

The same reasoning applies to the assistant-side hooks: they are configured in
a tracked settings file, and a session run without that configuration gets none
of them. That is a hole, and naming it is part of claiming the mechanism.

A check that exists but nothing runs is not enforcement. Audit for those
deliberately, and wire each one where the consequence of *its* regression
actually lands — the output filter's tests where the filter shapes every
command's output, a document-versus-code check where the document is read and
believed. Runtime is rarely the reason not to.

## Where each mechanism's rules live

Every mechanism here enforces or serves rules that are stated once, in a rule
file loaded at session start, and never restated in the mechanism. Reading the
pair together is what closes the loop: the rule says what must hold, the story
says what happens when it does not.

`hooks/rule-capture.md`, `hooks/rule-nudge.md` and `hooks/session-banner.md`
all serve `rules/rule-governance.md` — how a rule is dictated, where it lives,
who may adjudicate it, and what filing it owes. `gates/commit-gate.md` enforces
the same file's demands at commit time and defers to `register/INDEX.md` for
what the register check itself covers. `hooks/quiet-output.md` is the filter
that `rules/tool-output.md` is written against: the rules there are the
obligations the filter places on every tool it filters — a proof line, a
denominator, a heartbeat — and the story is the filter that keeps them alive.
`hooks/worktree-create.md` makes the working copy whose whole life
`rules/worktree-discipline.md` governs, and hands the caller that file's
first-act obligation rather than discharging it. `gates/merge-gate.md` is where
`rules/verification-and-evidence.md` becomes mechanical — baseline judging,
never rebaking to pass, evidence that something ran — and `gates/ratchets.md`
is the one leg of it that governs a standing measurement over time.

<!-- rows: 14.12, 14.13 -->
