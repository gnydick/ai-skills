# Rule nudge

The in-conversation, non-blocking layer of the governance chain: it reminds a
session that a rule-bearing document just changed while the register sat
untouched. The rule it serves — a change that adds, changes or supersedes a
rule updates the register in the same commit — is in
`rules/rule-governance.md`. Enforcement is the commit gate's job, not this
hook's.

**When it runs:** Immediately after a file-edit or file-write tool call
completes, on every such call.

**What it reads:**

- The event payload: the path of the file that was just edited or written.
- The project root of the checkout the session is running in.
- The version-control status of the register, and of nothing else — the query
  is scoped to the register's own path.
- Its own list of rule-bearing paths, which is a literal list in the hook.

**What it does:**

1. Parse the event payload. If it cannot be parsed, do nothing and report
   success.
2. Take the edited path from the tool's input, treating a missing one as empty.
3. Express it relative to the project root, normalising path separators, so the
   comparison below is against one fixed form.
4. Compare it against the rule-bearing list: an exact match against a named
   file, or a prefix match against a named directory, where a trailing
   separator is what marks an entry as a directory. The list names the places a
   standing rule can be stated — the main working-agreement document, the
   enforcement ledger, the specification directory, and any refactor-notes
   directory the project keeps. It is adapted per project by dropping what a
   project does not have, never by inventing a path it might have.
5. If nothing matches, do nothing and report success. Version control is not
   consulted at all in this case.
6. If something matches, ask version control whether the register carries any
   pending working-tree change, scoped to the register's path, under a time
   limit.
7. If that query fails for any reason — a non-repository directory, a missing
   tool, the time limit — do nothing and report success. The hook never guesses
   at an answer it could not get.
8. If the query returns any change, the register is already being touched: say
   nothing.
9. If it returns nothing, print the reminder below.
10. Report success in every branch. This hook is advisory: it never blocks an
    edit, never rejects one, never re-runs the tool, and never changes what the
    tool returned. It matches on a path, never on the content of the edit —
    guessing at what a sentence means is not something to stake anything on.
11. Where the enforcement ledger is a generated file, this same reminder
    doubles as a did-you-mean-to-hand-edit-a-generated-file signal, because the
    path list names that file too.

**What the user sees:** one line, only when a rule-bearing document changed and
the register did not:

```
Rule-bearing doc changed (<path>) and the design-decision register <register>
is untouched. If this change adds, changes, or supersedes a rule, update the
register in the same commit (the rule-intake procedure walks the steps).
```

In every other case: nothing at all.

**Acceptance checks:**

- Given an edit to a rule-bearing document while the register has no pending
  change, when the edit completes, then exactly one advisory line naming the
  edited path is printed and the edit itself stands unchanged.
- Given the same edit while the register already carries a pending change, when
  the edit completes, then nothing is printed.
- Given an edit to any file outside the rule-bearing list, when the edit
  completes, then nothing is printed and version control is never consulted.
- Given the version-control query fails or exceeds its time limit, when the
  edit completes, then nothing is printed and the hook reports success.
- Given a rule-bearing edit that adds no rule at all, when the edit completes,
  then the advisory still prints and the edit still stands — it advises on the
  path, never on the prose, and it never blocks.
- Given a list entry naming a directory, then any file beneath it matches;
  given one naming a file, then only that exact relative path matches.

<!-- rows: 2.8 -->
