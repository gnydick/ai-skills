# Rule governance

How a standing rule is dictated, where it lives, and what filing it owes.
Loaded at session start. Three mechanisms are named here and specified
elsewhere: the rule-capture hook, the register-update nudge, and the commit
gate that runs the register check.

## Dictating a rule

- A dictated standing rule is marked by an agreed prefix on the prompt, and that
  mark is the only trigger for capture. Nothing guesses at phrasing and nothing
  classifies intent.
- A marked prompt is written to the inbox word for word, before the assistant
  replies. Unmarked prompts are never stored, and capture still happens if the
  session ignores the rule or dies part-way through.
- Each captured rule becomes one inbox entry: a heading with the time and the
  session it came from, the prompt verbatim, and a disposition line that starts
  as pending.
- The moment a rule is captured, the session is told to file it now and told
  exactly what will fail until it does.
- A rule ruled in conversation without the marker is still written into the
  inbox by hand, with a note saying why the automatic capture did not fire.
- The inbox is append-only history. Entries are never deleted, and a duplicate
  is kept with a note rather than tidied away.
- Never carry an undispositioned rule across a commit. File it or dismiss it
  with a reason, whether or not a machine is stopping you.

## Where a rule lives

- The register cites; it never originates. Write the rule in its home first,
  then add the row that cites it. A rule that exists only in the register has no
  home.
- Send each rule to the home its kind belongs in: working-agreement rules to the
  rule file for their group, design rules to the specification that owns that
  subsystem, and claims about how strongly something is enforced to the
  enforcement ledger — declared beside the mechanism itself, never hand-typed
  into a generated file.
- Cite a rule file by section, never by line number. A line number names a
  position, and any edit above it silently moves what the row points at.
- A change that adds, changes or supersedes a standing rule updates the register
  in the same commit as the rule's own home.
- A project-specific rule has exactly one home: the project's own rules
  directory. A universal rule — one that would hold in any project — has
  exactly one home: the shared universal-rules skill, this plugin. File it
  there through the skill's own trigger, editing the matching
  `rules/<group>.md` file and reloading the skill; it is never filed through a
  project inbox.

## Finding the group it joins

- Find where a new rule belongs cheaply: read the contents list and the
  summaries of likely groups, search for the rule's key words, then put a
  shortlist of two or three in front of the owner with one line of reasoning
  each.
- For each candidate group, say whether the new rule agrees with it, sharpens
  it, or contradicts it.
- A contradiction is recorded as an unsettled question that has now been
  decided: write the verdict into the group's own account of the disagreement
  and update its status mark.
- Place a new rule by ladder: if a group fits, append a dated row; if no group
  fits but related loose rules exist, promote them together into a new group
  with a summary; otherwise file it as a loose rule under its area.

## Filing and closing the loop

- An assistant never files or adjudicates a rule itself. Every candidate rule is
  a proposal to the owner.
- Supersession is the owner's call whenever the losing rule was theirs. Propose
  it; never decide it.
- When one rule supersedes another, stamp both directions in the same commit:
  the retired document points at the group that replaced it, and the new row
  names what it supersedes. The old text is never rewritten in place.
- Close the loop on a captured rule by replacing pending with either where it
  was filed or why it is not a rule, and commit the rule's home, the register
  and the inbox together where they share a repository. A universal rule's
  home and its register row are in the shared skill while the entry that
  captured it is in the project, so the home and its row land together there
  and the disposition lands in the project in the same sitting, never left for
  later.
- Run the complete register check before calling a filing done. The cheap
  commit-time subset is not the whole check, and what it skips is exactly what a
  bad filing looks like.
- Every group says in plain words what its rules have in common and, where the
  team changed its mind, what the disagreement was about and how it ended.
- Only a real decision moves a group's status mark to settled: the owner's
  ruling, or a change that lands and settles the question. Nothing else upgrades
  it.
- Every group states how strongly its rules are actually enforced, naming the
  mechanism where one exists and saying plainly that nothing enforces it where
  none does.

## When a belief turns out false

- When a stated expectation turns out false, a post-mortem is launched
  automatically. The trigger is mechanical, and already knowing why is not an
  exemption — the explanation that feels obvious is the one that never gets
  written down.
- The post-mortem runs as its own dispatched job on a mid-tier model, alone, and
  its result is verified before anything else starts.
- It answers four things: what was believed, what was actually true, where the
  belief entered, and which standing rule would have caught it. A conclusion of
  "we should be more careful" has produced nothing.

## Honesty about the machinery

- An undispositioned inbox entry fails the register check. Filing is not
  optional bookkeeping; the check stays red until it is done.
- Run the governance check on every commit, and again in continuous integration
  so a machine that never installed the hook is still caught.
- Editing a rule-bearing document while the register sits untouched prints a
  reminder to update the register in the same commit. It is advisory and never
  blocks.
- State exactly where the gate does and does not run, in the same breath as
  claiming it exists. An opt-in hook and a missing continuous check are both
  holes, and naming them is part of the claim.
- The filing procedure is not what keeps rules safe. Capture and the check are
  mechanical, so a rule cannot be silently lost even if nobody ever runs the
  procedure — it just stays visibly unfiled.
- Every session opens with this protocol: how to dictate a standing rule, where
  the capture lands, what stays blocked until it is filed, where the register
  lives, and that a universal rule goes through the universal-rules skill's own
  trigger rather than the project mark.
- Say where the register's rows came from. If no provenance record exists, do
  not write one by hand — generate it from version-control history or do
  without it.
- Where a citation still names a line, that line must point at real content. A
  citation landing on a blank line is not a weak citation, it is no citation,
  and it blocks.

<!-- rows: 2.1–2.34; OQ.1 (owner ruling 2026-09-02) -->
