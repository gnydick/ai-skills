# Commit gate

Four cheap blocking checks and one advisory warning, run on every commit. It is
cheap on purpose. Anything heavier belongs to the merge gate: the every-commit
gate in one project had grown past an hour because different kinds of check had
bled together, and separating them by cost is the only thing that keeps a gate
this frequent affordable enough for people to leave switched on.

**When it runs:** On every commit, unconditionally, in a clone that has
activated the tracked hooks. The cheap checks are deliberately *not* gated on
the staged file list: a file-list condition is itself a judgement about where a
violation can come from, and it is silent exactly when that judgement is wrong.
The same checks run again on the hosted check when a change is pushed, so a
clone that never activated the hooks is still caught.

**What it reads:**

- The content actually being committed: the staged index, or — when it runs
  over a merge — the tip being merged. Never the working copy, because a
  half-staged file would otherwise make the gate pass or fail on bytes nobody
  is committing.
- The list of paths this commit stages, and the subset of them that are newly
  tracked.
- The register index, the rule files it cites, and the inbox.

**What it does:**

1. State itself first. The gate's own header enumerates every check it runs,
   says for each whether it blocks or only advises, names the one command that
   activates it per clone, and names its bypass. The script is where a reader
   looks first, so that is where the description lives.
2. Hold the blocking line. A mechanical check may block. A check that matches on
   the content of prose may only warn, never reject — guessing at what a
   sentence means is not something to stake a commit on.
3. **Check one, the register check, cheap mode. Blocks.** Citations resolve,
   supersession stamps are bidirectional, and the inbox is fully dispositioned
   — no entry left pending. What that check covers, what it deliberately does
   not, and which of its findings block against merely advise is stated in
   `register/INDEX.md`, not restated here. The cheap mode's one blind spot is
   the whole-register group-and-status scan; the full form runs before a filing
   is called done and at the merge gate, never on every commit.
4. **Check two, the citation-target check. Blocks.** For every citation of the
   form `path:line` appearing on a line this commit *adds*, resolved against the
   content being committed: the cited file exists; the cited line number is
   within that file; that line is not blank; and for a range, the end line is
   also within the file.
5. Validate once, at authoring time. A citation this commit did not touch is
   never re-audited, and drift afterwards is accepted rather than reported:
   line numbers moving is normal, and a check that goes red on ordinary drift
   is noise somebody eventually turns off. The commit gate is the natural home
   for a creation-time check, because the moment a commit is made is the moment
   the thing is created.
6. The check excludes itself and its own tests from its own scan. A self-test's
   fixtures are citation-shaped data, not real claims — which is found by
   running the tool against its own change on purpose.
7. It prints its own count every run, zero included, because most commits add
   no citations and that has to read as a normal pass rather than as silence
   indistinguishable from a broken diff.
8. It states in its own header what it deliberately does not check, and why:
   whether the cited line supports the claim beside it. That needs a person
   reading the fact next to the source, and a heuristic that flagged correct
   citations would get the whole check disabled — so it is left undone and said
   so.
9. **Check three, the bypass rule.** The gate names its own escape hatch in its
   own header, for a genuine emergency, and names what using it twice means:
   the second time is evidence the checker is wrong, and the fix is the
   checker, not the habit. This is a rule the header states and a person
   applies, not a step the gate executes.
10. **Check four, the activation rule.** The hooks live in a tracked directory
    in the tree and are activated once per clone by one explicit command that
    points the hooks-path setting at that directory. Never self-installing. A
    hook nobody can see in the tree is a hook nobody maintains, and one that
    installs itself silently is worse. The consequence is stated rather than
    hidden: that setting is local and per clone, and nothing in version control
    enforces it, which is why the same checks run again on the hosted check.
11. **The advisory sweep warning. Warns; never blocks; always exits zero.**
    Read the staged path list and the newly-tracked subset. Suspects are
    newly-tracked files outside the documentation set. With no suspects, stay
    silent. With no staged documentation path at all, stay silent — the commit
    is not documentation-shaped. If any staged path that is modified, deleted
    or renamed rather than newly added falls outside the documentation set,
    stay silent: that is an openly mixed commit, not a sweep. Otherwise print
    the three denominators — staged, newly tracked, suspect — and one line
    naming each suspect. A project may exempt one named tooling area from that
    disqualifying test, where its files legitimately move alongside
    documentation commits.
12. Collect the verdict. Any blocking check failing means the commit is
    rejected with a non-zero exit and a closing line saying so; advisory output
    never changes the exit status.
13. The hosted half runs the same checks over documents and is kept apart from
    the run that builds the product, needing none of the build toolchain: a
    full product build for every documentation edit teaches people to batch
    documentation edits, which is exactly how a register rots. Its triggers
    name exactly the files its gates read, plus a manual start. It runs on the
    platform where its gates were actually measured passing, because a gate
    measured somewhere else is noise wherever it ends up running. Every gate in
    it was measured passing on the commit that introduced it and has a
    demonstrated way of going red — each checker's own self-test runs as a gate
    beside it, because a gate nobody has seen fail is indistinguishable from a
    broken one.

**What the user sees:**

- Every check prints its own count line, zero included, in the declared
  proof-line format so it survives the output filter and any log redirect:

```
<check name>: <n> citation files, <m> groups, 0 errors (fast)
<check name>: validated <n> new citation(s) (staged)
```

- On a blocking failure, one line per finding, then the closing line and a
  non-zero exit:

```
FAIL: `<path>:<n>` cites a file that does not exist
FAIL: `<path>:<n>` cites a BLANK line
FAIL: `<path>:<n>` is past the end of the file (<total> line(s))
pre-commit: governance gate FAILED (see FAIL lines above). Commit rejected.
```

- On a sweep warning, never affecting the outcome:

```
ADVISORY: sweep-guard denominator: <n> staged, <m> newly-tracked, <k> non-doc suspect(s).
ADVISORY: docs commit stages a newly-tracked non-doc file: <path> — confirm not swept by a wildcard add-everything.
```

- On a clean commit: the count lines, and nothing else.

**Acceptance checks:**

- Given a commit touching nothing the gate checks — one source file, say — when
  it is made in an activated clone, then all four checks still run and each
  prints its own count line, zero included.
- Given a commit adding a citation of the form `path:line` that resolves to a
  blank line, then the gate blocks and names that citation; given the same
  citation resolving to a line with content, then it passes; given a citation
  this commit did not touch whose target line has since drifted, then nothing
  about it is reported.
- Given any inbox entry still marked pending, then the register check fails and
  the commit is rejected, whatever else the commit touches.
- Given a file staged only in part, then the checks read the staged content and
  not the working copy: a change present in the working copy but not staged
  neither passes nor fails the gate.
- Given a commit staging documentation plus one brand-new non-documentation
  file, then the guard prints its three denominators, names the file, and the
  commit still succeeds; given the same commit also modifying an existing
  non-documentation file, then the guard prints nothing.
- Given a clone that never ran the one-time activation command, then nothing
  gates locally and the same checks run on the hosted check when the change is
  pushed; and given the gate itself, then its header enumerates every check,
  marks each blocking or advisory, and names both the activation command and
  the bypass.

<!-- rows: 2.5, 2.6, 2.7, 2.23, 2.24, 2.34, 5.14, 14.1–14.9, 14.13–14.18; 14.10–14.11 carried as principle only — the specific ledger-table check is dropped by the groups 12–15 decision sheet and is not a member of this gate -->
