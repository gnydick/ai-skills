# Register index

The register is an index over the rule files in `rules/`, which are loaded at
session start. It records what was decided and where each decision lives; it
never holds the only copy of a rule.

## Contents

| Rule file | What it governs | Status | Rules |
|---|---|---|---|
| `rules/straight-talk.md` | What you claim, what you admit, how briefly | 🟢 | 10 |
| `rules/rule-governance.md` | Dictating, filing and superseding a standing rule | 🟢 | 35 |
| `rules/verification-and-evidence.md` | Predictions, evidence, tests, measurement | 🟢 | 50 |
| `rules/agent-topology.md` | Dispatch, models, containment, agent conventions | 🟢 | 41 |
| `rules/worktree-discipline.md` | The life of an isolated working copy | 🟢 | 25 |
| `rules/work-tracking.md` | Tickets, companion entries, the learnings record | 🟢 | 30 |
| `rules/design-invariants.md` | Extensions to the mandatory design skill | 🟢 | 92 |
| `rules/reference-sources.md` | Reading someone else's implementation | 🟢 | 5 |
| `rules/environment-and-platform.md` | Platform scope, tool resolution, dependencies | 🟢 | 11 |
| `rules/tool-output.md` | Proof lines, denominators, heartbeats | 🟢 | 9 |

That list is the cheap surface a search for where-does-this-belong reads first.

## What this index is, and is not

- Two documents, two jobs: this one records what was decided, the enforcement
  ledger records how strongly each decision is actually held in code. They
  cross-link and they never duplicate, so every fact has exactly one of them as
  its home.
- Everything else that states a rule — specifications, plans, the learnings
  notebook — is immutable history that this index cites. It is never edited to
  reflect a later decision, because history that gets rewritten stops being
  evidence of anything.

## What a row records

- Every row carries three things and only three: when the rule was adopted, the
  rule in one sentence, and a citation to the rule file and section where the
  rule actually lives.
- Rules that bear on the same decision live in one group, whether they agree
  with it, sharpen it or contradict it, ordered by when each was adopted, so the
  group reads as the history of one argument rather than a list.
- Every group carries one of three status marks, with fixed meanings. 🟢 settled
  — the rules agree, or the disagreement ended in a written verdict. 🟡 weakly
  settled — the verdict is only inferred, or a deviation is documented but never
  reconciled. 🔴 unsettled — opposing rules are both still live.
- A verdict nobody actually ruled on is labelled as inferred, so a reader can
  tell a reading from a decision. The label comes off, and the ruling is cited,
  the moment a real decision lands.
- A rule with no sibling is filed in a by-area section that carries neither a
  summary nor a status mark, because a lone rule has no disagreement to
  characterise and nothing to declare settled.
- Retirement is recorded in both directions: every stamp on a retired document
  names a group that exists, and every supersession row names a file that exists
  and carries the stamp pointing back. One direction alone is a dangling link
  that neither side can see from where it stands.

## What the check verifies

- The rules for maintaining this index are a section of the index itself, and
  they name the check that enforces them.
- The check's own header enumerates what it blocks on and, separately, what it
  only advises. Advisory output never changes the exit status, so a reader of
  either the header or the output can tell the two apart.
- A check whose name sounds like it validates something states in its own header
  exactly what it validates and what it does not. These check that a citation
  names a file that exists and a line that is not empty, never that the line
  still supports the claim beside it — a citation whose target drifted onto
  different real content passes, deliberately, and the header says so.
- Every citation is checked to name a file that exists. Line numbers drifting is
  normal and tolerated; the file being gone is not.
- Every citation naming a section resolves to a real heading in that file,
  matched on its leading words, so a row may name a heading while the heading
  itself carries a suffix.
- When a check reads a document's headings, it skips fenced code blocks. A line
  inside a quoted snippet can match the heading pattern exactly, and a citation
  would then resolve to something that is not a section at all.
- The status marks are checked mechanically: exactly one on every group heading,
  none on a lone-rule heading.
- Supersession stamps are checked in both directions, as above, so neither half
  of the link can go missing unnoticed.
- Where two checks split a space between them, each covers its own half
  completely. A file cited only in the form one check reads is reported missing
  by that check, never left to the other one, which will never see it.
- A check reads only the rows that carry live claims, never the prose around
  them. Otherwise the section documenting the format fails the rule it is
  stating, and the example in a header reads as a real entry.
- A check hands a case off only to another check that actually exists, and says
  in its own text what it handed off and what that leaves unverified. Where no
  such second check exists, the case fails rather than being skipped, because a
  skip with nobody behind it passes forever.
- A check that cannot fail in this project is dropped rather than carried
  across, and its absence is stated in the tool's own header along with what
  covers that ground instead. A check that can never fail proves nothing and
  reads exactly like one that works.
- Advisory: an unsettled group that names no ticket. An open disagreement with
  nowhere to follow it is how one gets forgotten.
- Advisory, on request: the check scans named files for rule-shaped lines and
  notes any file no row cites — one note per file, because the finding is that
  the file is uncited, not how many such lines it holds.
- Prove the check can fail before trusting it: either a self-test that
  red-checks every blocking failure mode against fixtures, or a live
  falsification that introduces one real violation per check, records exactly
  what each mode caught, and reverts. A gate nobody has seen fail is
  indistinguishable from a broken one.

## Decision records

- A dated decision record is not a policy manual. Once it is accepted its body
  is frozen: the only permitted edits are a change of status and a correction
  that preserves the decision exactly.
- A changed decision lands as a new record that supersedes the old one and flips
  the old one's status in the same change. It never lands as an edit to the old
  record.
- Know which kind of document you are editing. Some are living and are kept
  current with the code; a dated ruling is meant to go stale, and updating one
  to match today destroys the record rather than maintaining it.

## Living documents

- The document that maps how the system behaves is updated in the same change as
  the code, along with any data or page generated beside it. It is not a
  follow-up task, because a map that lags is worse than no map: it is read and
  believed.
- What counts as updating the map is defined rather than left to taste: the
  section for the part you changed describes the new behaviour, a difference you
  closed is re-marked with the change that closed it, and an item whose work
  landed has its status flipped.
- Fixing something in an area the map does not yet describe at the depth you
  need means mapping that area first, to the map's own template. Working from a
  guess about an unmapped area is how the map and the code start disagreeing.
- A stale map is a failing test, not a documentation gap. It is treated with the
  urgency of something broken, because that is what it is.

## Two rules that look alike

- A rule that matters to two groups is filed in the one whose trigger it
  actually fires on, and cross-referenced from the other with the reason for the
  split. It is never copied in as a second row, because two copies drift and
  neither knows it.
- Before folding a new rule into a group that looks like its home, ask whether
  that group's own remedy would have produced this one's fix. If it would not,
  they are different rules however similar they read, and folding them loses the
  one that was not already there.

## Maintenance contract

- The index cites; it never originates. Write the rule in its rule file first,
  then add the row that cites it.
- A change that adds, changes or supersedes a rule updates this index in the
  same commit as the rule file it changed.
- Citations name a file and a section, never a line number.
- A supersession is stamped in both directions in that same commit.
- Every group states how strongly its rules are actually enforced, naming the
  mechanism where one exists and saying plainly where none does.
- The check named above runs at commit time in its cheap form and in full before
  a filing is called done.

<!-- rows: 13.1–13.32; subsumes the summary-consistency rows of the phase-3 shape ruling -->
