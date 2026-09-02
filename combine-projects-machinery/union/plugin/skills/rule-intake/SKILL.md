---
name: rule-intake
description: Use the moment a dictated rule is captured, when the register check reports an undispositioned inbox entry, or when any change adds, changes or supersedes a standing rule — finds the group the rule joins or the entry it supersedes, writes its durable home, adds the index row, dispositions the inbox entry and commits all of it together.
---

# Rule intake

The rules live in `rules/rule-governance.md`; what the index is and what a row
records live in `register/INDEX.md`. This skill is the sequence, not a
restatement of either. Where this skill and a rule file disagree, the rule
file wins.

**Where this runs.** In the project root, never in an isolated working copy.
Filing is one of the few operations reserved for the shared copy, and this is
why: every active working copy lives under that root, so a rule filed there is
loaded by every session that starts in any of them at its next start. Both the
capture and the filing commit belong there.

**What this sequence is not.** It is not what keeps a rule safe. Capture and
the register check are mechanical, so a rule cannot be silently lost even if
nobody ever runs this sequence — the entry just stays visibly pending and the
check stays red. The sequence exists to do the filing well. And nothing here
adjudicates: every candidate is a proposal for the owner, including one that
arrives from a post-mortem written after a stated expectation turned out
false. An assistant never files a rule on its own authority.

## When it starts

- A dictated rule was just captured. The capture mechanism
  (`hooks/rule-capture.md`) has already written the inbox entry and told the
  session to file it now.
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

2. **Shortlist where it belongs, cheaply.** Read the index's contents list and
   the summaries of the two or three plausible rule files, then search those
   files for the rule's key words. Do not read the whole set. Put a shortlist
   of at most three in front of the owner, with one line of reasoning each.

3. **For each candidate on the shortlist from step 2, say whether the new rule
   agrees with that file's standing, sharpens it, or contradicts it.** A
   contradiction is not a problem to smooth over; it is the interesting case,
   and step 5 records it.

4. **Before folding the rule into the candidate that looks like its home, ask
   whether that group's own remedy would have produced this rule's fix.** If
   it would not, they are different rules however alike they read, and folding
   them loses the one that was not already there. A rule that bears on two
   groups is filed in the one whose trigger it actually fires on and
   cross-referenced from the other with the reason — never copied in twice.

5. **Place it by ladder, using the candidate you settled on in step 4.**
   - It fits an existing group: append a dated row there.
   - No group fits but related loose rules exist: promote those together into
     a new group, and give the new group a summary saying in plain words what
     binds its rules, a status mark, and an honest statement of how strongly
     its rules are actually enforced — naming the mechanism where one exists
     and saying plainly that nothing enforces it where none does.
   - No siblings at all: file it as a loose rule under its area, which carries
     neither a summary nor a status mark.

   If step 3 found a contradiction, write the verdict into that group's own
   account of the disagreement and update its status mark. Only a real
   decision moves a mark toward settled: the owner's ruling, or a change that
   lands and settles the question.

6. **Write the durable home first.** The index cites; it never originates, so
   a rule that exists only in the index has no home. A working-agreement rule
   goes into the rule file for its group, `rules/<group>.md`, which is loaded
   at every session start — there is no summary copy anywhere else, and
   nothing to keep a second copy in step with. A rule about one subsystem's
   design goes to the specification that owns that subsystem. A claim about
   how strongly something is enforced is declared beside the mechanism itself
   and regenerated into the enforcement ledger; this sequence never hand-edits
   that file.

7. **Add or update the index row for the home you just wrote.** A row carries
   three things and only three: when the rule was adopted, the rule in one
   sentence, and a citation to the file and section where it lives. Cite the
   section, never a line number — a line number names a position, and any edit
   above it silently moves what the row points at.

8. **If the rule supersedes another, stamp both directions in this same
   change.** The retired document gets a stamp pointing at the group that
   replaced it, and the new row names what it supersedes. The old text is
   never rewritten in place. Supersession is the owner's call whenever the
   losing rule was theirs: propose it, never presume it.

9. **Disposition the inbox entry.** Replace pending with either where the rule
   was filed — the group and its home — or why it is not a rule. Nothing is
   deleted from the inbox; it is append-only history.

10. **Run the register check in full, not the cheap commit-time subset.** What
    the cheap subset skips is exactly what a bad filing looks like.

11. **Commit the rule's home, the index and the inbox together, naming the
    exact paths.** One change, so no reader can find the rule without the row
    or the row without the rule.

## Red flags

- "I will note it in the index only." No: the home comes first, and the index
  cites it.
- "This obviously supersedes that." Supersession is the owner's call. Propose
  it.
- "The inbox entry can wait." It cannot. Never carry an undispositioned rule
  across a commit, whether or not a machine is stopping you.
- "The check is green, so the filing is good." The commit-time check is the
  cheap subset. Run the full one before calling it done.

<!-- rows: 2.5, 2.9-2.24, 2.27, 2.28; 2.29-2.31 as the entry trigger only, the post-mortem itself being rules/rule-governance.md; 13.31, 13.32; project-root filing per the 4.20 ruling. 2.32 (session banner) and 2.33 (row provenance) are not flow: the banner is hooks/session-banner.md and provenance is a register-shape rule in register/INDEX.md. -->
