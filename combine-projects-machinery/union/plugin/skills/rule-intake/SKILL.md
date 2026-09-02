---
name: rule-intake
description: Use the moment a dictated rule is captured, when a rule is ruled in conversation without the mark, when the register check reports an undispositioned inbox entry, or when any change adds, changes or supersedes a standing rule — finds the group the rule joins or the entry it supersedes, writes its durable home, adds the index row, dispositions the inbox entry and commits all of it together.
---

# Rule intake

The rules live in `rules/rule-governance.md`; what the index is and what a row
records live in `register/INDEX.md`. This skill is the sequence; those files
are authoritative. Where a step here repeats a rule's instruction, the rule
file wins — and the reason behind a step lives in the rule file section the
step names, not here.

**Where this runs.** In the project root, never in an isolated working copy —
the filing commit is the reserved operation (`rules/agent-topology.md` § Where
an agent works, which lists filing among the operations reserved for the shared
copy). Capture itself is location-independent by mechanism: the hook resolves
the project root and writes that root's inbox from any working copy
(`hooks/rule-capture.md`).

**What this sequence is not.** It is not what keeps a rule safe: capture and
the register check are mechanical, so if nobody ever runs this sequence the
entry stays visibly pending and the check stays red
(`rules/rule-governance.md` § Honesty about the machinery). And nothing here
adjudicates: every candidate is a proposal for the owner, including one that
arrives from a post-mortem. An assistant never files a rule on its own
authority.

## When it starts

- A dictated rule was just captured. The capture mechanism
  (`hooks/rule-capture.md`) has already written the inbox entry and told the
  session to file it now.
- A rule was ruled in conversation with no mark on the prompt. Write it into
  the inbox by hand first, with a note saying why the automatic capture did
  not fire, then run this sequence on that entry.
- The register check reports an undispositioned inbox entry. Commits are
  blocked wherever the commit gate is active (`gates/commit-gate.md`) until
  the entry is dispositioned.
- A change you are making adds, changes or supersedes a standing rule. The
  index is updated in the same change, not afterwards.
- A post-mortem proposes a candidate rule. It comes here as a proposal.

## The sequence

1. **Read the captured entry as it was written.** Its heading carries when it
   was captured and the session it came from; its body is the prompt word for
   word; its disposition reads pending. Work from that text, not from your
   memory of the conversation.

2. **Check whether the entry states a universal rule.** If the entry states a
   universal rule — one that would hold in any project — it came in through
   the project channel and its home is elsewhere: it goes to the shared
   universal-rules skill, this plugin. Set the home now, then carry on through
   this same sequence with that home in place of a project one. What a
   universal rule skips is only what belongs to the project channel: the
   project inbox beyond dispositioning this entry as moved, and the project's
   commit gate. Everything else still runs — steps 3 to 7 choose and write the
   plugin's matching `rules/<group>.md`, step 8 adds its index row, step 9
   stamps any supersession, step 11 runs the register check — all against
   `register/INDEX.md` of this plugin, which indexes this plugin's own
   `rules/`. When the change is committed, reload the skill so the rule takes
   effect without a new session (`WIRING.md` § What a platform must provide
   overall).

3. **Shortlist where it belongs, cheaply.** Read the index's contents list and
   the summaries of the two or three plausible rule files, then search those
   files for the rule's key words. Do not read the whole set. Put a shortlist
   of at most three in front of the owner, with one line of reasoning each.

4. **For each candidate on the shortlist from step 3, say whether the new rule
   agrees with that file's standing, sharpens it, or contradicts it.** A
   contradiction is not a problem to smooth over; it is the interesting case,
   and steps 6 and 8 carry it through.

5. **Before folding the rule into whichever candidate from step 4 looks most
   like its home, ask whether that group's own remedy would have produced this
   rule's fix.** If
   it would not, they are different rules however alike they read. A rule that
   bears on two groups is filed in the one whose trigger it actually fires on
   and cross-referenced from the other with the reason — never copied in twice
   (`register/INDEX.md` § Two rules that look alike).

6. **Decide its place by ladder, from the candidate you settled on in step 5.**
   This step decides only; steps 7 and 8 are what write.
   - It fits an existing group: the rule joins that group.
   - No group fits, but related loose rules exist: those and this one become a
     new group.
   - No siblings at all: it is a loose rule under its area, and a loose rule
     has neither a summary nor a status mark.

   Note here too what step 4 found. A contradiction means the group's status
   mark changes and its account of the disagreement gains a verdict, both
   written in step 8. Only a real decision moves a mark toward settled: the
   owner's ruling, or a change that lands and settles the question.

7. **Write the durable home.** The rule text is written here and only here;
   the index cites it and never originates it (`rules/rule-governance.md`
   § Where a rule lives). A working-agreement rule goes into the rule file for
   the group you chose in step 6, `rules/<group>.md`, which is loaded whole at
   every session start — there is no summary copy of the rule anywhere else. A
   rule about one subsystem's design goes to the specification that owns that
   subsystem. A claim about how strongly something is enforced is declared
   beside the mechanism itself and regenerated into the enforcement ledger;
   this sequence never hand-edits that file.

8. **Write the index entries for what step 6 decided and step 7 landed**, in
   the register of whichever home the rule went to — the project's own
   register for a project rule, this plugin's `register/INDEX.md` for a
   universal one.

   - The row: three things and only three — when the rule was adopted, the
     rule in one sentence, and a citation to the file and section where it
     lives. Cite the section, never a line number.
   - If step 6 made a new group, write that group's own furniture in the
     index: a summary saying in plain words what binds its rules, a status
     mark, and an honest statement of how strongly its rules are actually
     enforced, naming the mechanism where one exists and saying plainly that
     nothing enforces it where none does. That summary characterises a group
     of rows; it is not a second copy of any rule's text, which lives only in
     the file from step 7.
   - If step 4 found a contradiction, write the verdict into that group's
     account of the disagreement and update its status mark.

9. **If the rule supersedes another, stamp both directions in this same
   change**, in the register of whichever home the rule went to. The retired
   document gets a stamp pointing at the group that replaced it, and the new
   row names what it supersedes. The old text is
   never rewritten in place. Supersession is the owner's call whenever the
   losing rule was theirs: propose it, never presume it.

10. **Disposition the inbox entry.** Replace pending with either where the rule
    was filed — the group and its home — or why it is not a rule. Nothing is
    deleted from the inbox; it is append-only history.

11. **Run the register check in full, not the cheap commit-time subset**,
    against the register of whichever home the rule went to
    (`rules/rule-governance.md` § Filing and closing the loop, which is why —
    what the cheap subset skips is exactly what a bad filing looks like; what
    the check itself covers is `register/INDEX.md` § What the check verifies).

12. **Commit the rule's home, the index and the inbox together, naming the
    exact paths.** One change, so no reader can find the rule without the row
    or the row without the rule. A universal rule's home and index are in this
    plugin while the entry that captured it is in the project, so that is two
    commits, one per repository — the home and its row still land together,
    and the disposition lands in the same sitting, never left for later.

## Red flags

- "I will note it in the index only." No: the home comes first, and the index
  cites it.
- "This obviously supersedes that." Supersession is the owner's call. Propose
  it.
- "The inbox entry can wait." It cannot. Never carry an undispositioned rule
  across a commit, whether or not a machine is stopping you.
- "The check is green, so the filing is good." The commit-time check is the
  cheap subset. Run the full one before calling it done.

<!-- rows: 2.5, 2.9-2.24, 2.26, 2.27, 2.28; 2.29-2.31 as the entry trigger only, the post-mortem itself being rules/rule-governance.md; 13.31, 13.32; project-root filing per the 4.20 ruling. 2.32 (session banner) and 2.33 (row provenance) are not flow: the banner is hooks/session-banner.md and provenance is a register-shape rule in register/INDEX.md. -->
