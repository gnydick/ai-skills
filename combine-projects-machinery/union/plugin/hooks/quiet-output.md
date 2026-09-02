# Quiet output

Two pieces that work as one: a check that decides, before a shell command runs,
whether its output is worth reading in full; and a wrapper that runs the
command, keeps the whole output on disk, and shows only what matters. The
obligations this filter places on the tools it filters — proof lines,
denominators, heartbeats — are in `rules/tool-output.md`; this is the filter
itself.

**When it runs:** Before a shell command runs, on the pre-execution event for
the assistant's shell-command tools, under a fifteen-second time limit. The
wrapper then runs in the command's own place.

**What it reads:**

- The event payload: which tool is about to run, the command text, and the
  command's description.
- Its own pattern sets. Nothing about the project, the file system or the
  session.
- The wrapper additionally reads the command from a temporary file the check
  wrote, and the per-call opt-out variable from its environment.

**What it does:**

*Deciding, first match wins, in this order:*

1. If the payload cannot be parsed, do nothing and report success. The command
   runs exactly as written.
2. If the tool is not one of the shell-command tools, do nothing.
3. If the command is empty, is already running under the wrapper, or merely
   asks for a version or for help, do not wrap.
4. If the command is already piped into something that trims or consumes its
   output — a tail, a head, a line filter, a counter, a stream editor, a field
   processor, a sort, a deduplicator, a structured-data query, a tee, a pager,
   an interpreter — do not wrap. Piping wins over everything below it, however
   noisy the command is: the caller's own post-processing is never overridden.
5. If the command redirects its output to a file, do not wrap — but only when
   the line carries no token merging the error stream into the normal stream.
   That token anywhere on the line cancels this exemption outright, even
   alongside a genuine file redirect. Written before the redirect it really
   does leave the error stream on the terminal; written after, it does not.
   Telling those apart means parsing the shell's ordering, so the check is a
   deliberate blanket on the token instead: it wraps some commands whose output
   was fully redirected, which costs nothing, rather than missing the ones
   whose chatter still arrives. So a redirect alone exempts; a redirect written
   together with the merge token does not.
6. If the command line contains a content read — viewing, listing, diffing or
   statusing a ticket or change request, an interface request, a search, or a
   listing of releases, runs, repositories, labels, projects, snippets or
   workflows — never wrap it at all. Its lines are the payload the caller asked
   for. A read anywhere on the command line wins over anything noisy on the
   same line, and the ceiling in step 26 never applies to it.
7. If the command matches the state-changing set, the mode is proof-of-success.
   This is tested *before* the noisy set, because cloning, fetching and pulling
   appear in both and proving they worked is what matters.
8. Otherwise, if the command matches the noisy set, the mode is reduce.
9. Otherwise, do not wrap.

*What is in each set:*

10. State-changing: commands that change state somewhere else. Version-control
    state changes — committing, pushing, pulling, fetching, merging, rebasing,
    cloning, cherry-picking, adding, removing or pruning a working copy,
    sub-repository operations — and tracker mutations: creating, editing,
    commenting on, closing or merging a change request or ticket; running a
    workflow; creating, uploading or deleting a release; re-running or
    cancelling a run; repository and label operations; signing in.
11. Noisy: commands whose payload is a pass-or-fail verdict. Builds,
    dependency installs and updates, test runs, package and container tooling,
    toolchain updates, the project's named gate scripts, every file matching
    the project's test-runner naming suffix under its scripts and hooks
    directories, and the tracker tool's run-log and check-table chatter — which
    includes its sign-in-status query and its extension install and upgrade
    commands, whose output is progress and a verdict rather than anything the
    caller asked to read.
12. The gate scripts share no prefix, suffix or behavioural marker a pattern
    could key on, so that arm is an explicit enumeration. The test runners do
    share a real naming regularity, so that arm is a suffix match and covers
    new test files without editing the matcher again. The matcher states which
    of the two each arm is and why.
13. Deliberately excluded, even though they sit in the same directory as the
    wrapped ones: analysis, probe, render, census and diff tools. Their printed
    output is the data the caller wanted. The tests proving these stay
    unwrapped matter more than the ones proving wrapping works, because a
    mistake in this direction silently deletes what somebody asked for.
14. Every pattern anchors at a command position — the start of the line, after
    a separator, after a conditional-and, after a loop or conditional keyword —
    and tolerates environment-variable prefixes ahead of the command name. It
    also tolerates a repository-directory option sitting between the command
    and its subcommand: naming which working copy to act in does not change
    what the action is, so it must not change the match.

*Rewriting, when a mode was chosen:*

15. Write the command verbatim to a temporary file, in the session's temporary
    directory when the harness names one and a fixed shared one otherwise, so
    that nothing is re-quoted on the way through.
16. Replace the tool's command with an invocation of the wrapper naming the
    shell, the mode and that file, and append a mode label to the description
    so it is visible that filtering happened. Return the rewritten input and
    report success.
17. If the check exceeds its fifteen-second limit, the harness abandons it and
    the command runs as written. Every branch above fails open in the same
    direction: an unreadable payload, an unhandled tool, and a command matching
    nothing all leave the command exactly as it was.

*Running, in the wrapper:*

18. Reconfigure its own output stream to a full character set with substitution
    for anything it cannot represent. Never fail because of a character it
    cannot print: losing one glyph beats losing the whole output.
19. Open a timestamped log beside the command file and write the command as its
    first line. Start the command under the named shell with progress bars,
    colour, pagers, update notifiers and interactive prompts disabled by
    environment and with no input attached, capturing the normal and error
    streams together as one stream. Write every chunk to the log as it arrives
    and keep it. Wait, and capture the command's own exit status.
20. Normalise before anything is selected: decode with substitution, normalise
    line endings, reduce each line containing carriage returns to the frame
    after the last one so a progress bar collapses to its final frame, strip
    colour and cursor sequences, trim trailing spaces, and drop trailing blank
    lines.
21. Choose verbatim or reduced. Print verbatim if the per-call opt-out variable
    is set to off, or if the mode is reduce and the normalised output is at or
    below the fixed pass-through count of forty lines — a quiet command is not
    filtered at all. Proof-of-success mode reduces regardless of length,
    because that chatter is always short and still never worth reading.
22. Select, in proof-of-success mode on a zero exit status: keep only lines
    matching a proof-of-success shape or the declared proof-line format. The
    proof-of-success shapes are a fixed set, matched without regard to case,
    and every one of them is a line that could only have been printed if the
    action actually happened:
    - a commit confirmation — a bracketed branch name and short object
      identifier, followed by the subject;
    - a reference update — an old and a new short identifier separated by two
      dots, then a source name, an arrow and a destination name;
    - a forced reference update — the same with a leading plus sign and three
      dots between the identifiers;
    - a new-reference marker (`* [new branch]`, `* [new tag]`) or a
      deleted-reference marker (`- [deleted]`);
    - a nothing-to-do or fast-path line: everything up to date, already up to
      date, fast-forward;
    - an updating line naming both the old and the new identifier;
    - a files-changed count line;
    - an outcome line for a merge, rebase, checkout or working-copy
      preparation: merge made by, successfully rebased, switched to, head is
      now at, preparing working copy;
    - a clone-start line, or a tracking line saying a branch was set up to
      track a remote one;
    - a result link on the hosting service;
    - a confirmation glyph at the start of a line, or a confirmation verb
      there: merged, created, deleted, closed, reopened, logged in.

    A line that merely introduces the transfer — the "to <destination>" header
    above a reference update, say — is not a proof shape and does not survive.
    If the selection keeps nothing and there was any output, keep the last line
    — the selection is never empty. On a non-zero exit status, fall through to
    the reducing selection instead, so nothing about the failure is lost.
23. Select, in reducing mode: keep a block opened by an error, panic, traceback
    or failure-header line, from its opening line to the next blank line; keep
    any line matching the declared proof-line format or a final-summary shape;
    keep any line naming a failure plus the two lines after it, unless that
    line is pure progress chatter; and keep the last eight lines, except that a
    chatter line inside that window is dropped unless it is the very last line
    of all.
24. Drop chatter even when it contains a word like "warning" or "error", and do
    not let it fill the tail window: compiling, checking, downloading,
    updating, installing, locking, adding, removing, collecting,
    already-satisfied, using-cached, preparing and unpacking lines; a
    per-case "… ok" line; an unused-something warning; a diagnostic gutter
    line.
25. The declared proof-line format has exactly two shapes: a heartbeat line, or
    `<identifier>[ <flag>]: <text>` where the identifier is lower-case words
    joined by underscores. It is anchored to the *format*, never to a list of
    tool names, so a tool nobody named survives with no edit to the filter.
    Requiring at least one underscore is what keeps prose out — a bare word
    followed by a colon does not match — and that narrowness is measured
    against real bulk output rather than assumed.
26. Render: a header line, then the kept lines in order. Cap the shown set at
    two hundred: past that, show a leading three-fifths and a trailing
    two-fifths with an elision marker between them counting the surviving lines
    left out. Mark every gap between non-adjacent kept lines with a count of
    what was skipped, so a reader can always see that something is missing and
    how much. The ceiling applies only to output being reduced; a command the
    matcher never wrapped is never shortened.
27. Delete the temporary command file, then exit with the command's own exit
    status, unchanged.

**What the user sees:**

- Nothing at all when the command was not wrapped: it runs and prints as it
  always did.
- The mode label appended to the tool call's description, so filtering is
  visible: ` [quiet:filter]` or ` [quiet:infra]`.
- One header line above the reduced output, stating mode, exit status, elapsed
  time, the denominator, and where the whole output is:

```
[quiet:<mode>] exit=<code>  <elapsed>s  <produced> lines -> <shown> shown  full log: <path>
```

- Elision markers, verbatim, wherever something was left out:

```
... [<n> kept lines elided between head and tail] ...
... [<n> lines omitted] ...
```

- To opt one call out entirely, the caller prefixes it with the opt-out
  variable set to off, and the wrapper prints everything word for word.

**Acceptance checks:**

- Given a build, a dependency install, a test run, one of the named gate
  scripts, or a file matching the test-runner suffix under the scripts or hooks
  directory, when the pre-run check inspects it, then the mode is reduce; given
  the tracker tool's sign-in-status query, or one of its extension install or
  upgrade commands, then the mode is reduce as well; given the same gate
  script piped into a trimming command, then no mode is chosen at all; given a
  build redirected to a file, then no mode is chosen; and given the same build
  redirected to a file *and* carrying the stream-merge token, then the mode is
  reduce — the merge token cancels the redirect exemption.
- Given a commit, a push, a pull with a rebase, a fetch, a working-copy
  addition, or a ticket creation or comment, then the mode is proof-of-success;
  given a push written with a repository-directory option between the command
  and its subcommand, then the mode is still proof-of-success; given a content
  read — a ticket view, a diff, an interface request, a search — then no mode
  at all, including when the read appears at the end of a line whose first
  command is noisy.
- Given a successful proof-of-success run whose output is a gate's own count
  line, a commit confirmation and a files-changed line, then all three survive;
  given a push whose output is nine lines of object chatter ending in the
  ref-update line, then only that last line survives; given a three-line push
  result — the transfer header, a new-reference marker and a tracking line —
  then exactly two survive, the header proving nothing; given a lone
  already-up-to-date line, then it survives; given output with nothing
  recognisable in it, then the last line survives, so the result is never
  empty; and given a non-zero exit, then the error lines survive by the
  reducing selection.
- Given a heartbeat line buried in twenty lines of chatter before it and twenty
  after — far outside the tail window — then it survives in both modes; given a
  line in the proof-line format naming a tool that appears nowhere in the
  filter, then it survives with no edit to the filter; and given ordinary
  prose of the shape `<word>: <text>`, then it does not match the proof format.
- Given three hundred lines of ordinary build chatter with no proof-shaped or
  heartbeat-shaped line in it, then fewer than ten lines survive in
  proof-of-success mode and fewer than twenty in reducing mode; given an error
  block and a final summary among a hundred and twenty chatter lines, then the
  block from its opening line to the next blank line, the summary and the tail
  survive and fewer than thirty lines are shown; given a progress bar written
  with carriage returns, then only its final frame survives; and given colour
  sequences, then they are stripped.
- Given the filter's own test suite, when the merge gate runs, then it runs
  that suite before the filter's behaviour is trusted, because these two pieces
  shape every command's output and nothing else runs their tests; the commit
  gate stays at its four cheap checks and does not carry this one.

<!-- rows: 8.1–8.20, 8.28, 8.29 (its suite moved to the merge gate by the four-check commit-gate ruling), 8.32 -->
