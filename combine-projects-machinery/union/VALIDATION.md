# Union validation — 2026-09-02

Six checks over everything in `union/`, run against the phase-1 copies in
`../ferrislicer/` and `../dwc-ng/` as ground truth for the mechanisms, and
against `RECONCILIATION.md` as the record of what was ruled. Every verdict
below is followed by the evidence it rests on. Fourteen defects were found and
fixed inline; each is listed in § Inline fixes with the file and what it fixed.
Four questions needed the owner and became rows under `RECONCILIATION.md`
§ Open questions; they are listed in § Open questions below.

Nothing was weakened to make a check pass. Where a fix touched a demand, it
scoped it, cross-referenced it, or made its mechanism honest — never removed
it.

---

## 1. Coherence

### Every cross-reference resolves — scripted

Every `` `<dir>/<file>.md` `` reference in `plugin/`, with and without a
`§ <heading>` suffix, resolved against the actual files and their actual
headings (fenced code blocks excluded from heading extraction, as the union's
own register check requires):

```
FILES: 26
REFS CHECKED: 82
BAD: 0
```

All 82 name a file that exists; every one of the 11 that names a section
resolves to a real heading in that file, matched on leading words. Run after
the fixes below; the pre-fix run was 78 refs, also 0 bad.

### The named coherence pairs

**Commit gate = four cheap checks + one advisory sweep guard, everywhere.**
One contradiction found. `gates/commit-gate.md` opened "Four cheap **blocking**
checks and one advisory warning", while its own step 9 says the bypass rule
"is a rule the header states and a person applies, not a step the gate
executes" and `WIRING.md` says "its **two** executable blocking checks first".
Two of the four block nothing. **Fixed** (F1) — the opening now reads "two
checks the gate executes and rejects the commit on, and two that its header
states and a person applies". `COMPACT-12-15.md`'s decision-sheet bullet had
the same fault in a different shape and is fixed with it (F14). After the
fixes, all five places agree: `README.md` line 51, `gates/commit-gate.md` line
3, `WIRING.md` § `gates/commit-gate.md`, `hooks/quiet-output.md`'s closing
acceptance check ("the commit gate stays at its four cheap checks"), and
`COMPACT-12-15.md`'s decision sheet. `rules/rule-governance.md` § Honesty
about the machinery and `skills/rule-intake/SKILL.md` describe the gate
without a count and conflict with none of them.

**Rule filing in the project root, everywhere.** One contradiction found.
`rules/agent-topology.md` § Where an agent works reserves both the capture and
the filing commit for the shared copy; `skills/rule-intake/SKILL.md` § Where
this runs says "In the project root, never in an isolated working copy";
`skills/effort-lifecycle/SKILL.md` § Does this apply? repeats the same
by-convention list. But `hooks/rule-capture.md` step 5 asserted the opposite
workflow as normal — "a session running in an isolated working copy writes
that copy's inbox, and the entry travels with the change that the rule's home
is written in" — which is a filing path the rule file rules out. **Fixed** (F2,
F3): the mechanism fact stays (the hook writes whichever inbox the session
runs against — its acceptance check pins that, and the hook genuinely cannot
enforce a convention), but it now names the convention and the rule file that
holds it rather than asserting a competing one. **Which workflow is correct
for an entry that does land in a copy is the owner's call and is OQ.1** — the
fix removed the flat contradiction without choosing.

**All-work-in-a-copy, and the by-convention list.** No contradiction. The list
appears in exactly two places and is identical in both:
`rules/agent-topology.md` § Where an agent works and
`skills/effort-lifecycle/SKILL.md` § Does this apply? — three items in the same
order (filing a dictated rule, both capture and filing commit; merging a
finished effort once every leg is green, and pushing it; creating, listing and
tearing down the copies). `README.md` does not carry the list, so it cannot
diverge from it. Both places state the no-size-exception rule in the same
terms, and both carry the second-commit backstop with the same "not a licence
for the first commit" qualification.

**The register is an index, with no summary layer anywhere.** No contradiction.
`README.md` § How the pieces relate and § Installing it ("nothing needs a
summary layer"; "Do not summarise a rule file down to a bullet and leave the
full text elsewhere"), `register/INDEX.md` § Maintenance contract ("The index
cites; it never originates"), `rules/rule-governance.md` § Where a rule lives
("The register cites; it never originates"), and
`skills/rule-intake/SKILL.md` steps 6 and 7 ("there is no summary copy of the
rule anywhere else"; "That summary characterises a group of rows; it is not a
second copy of any rule's text") all agree. The one apparent tension — that
`rules/rule-governance.md` § Finding the group it joins and rule-intake step 2
both tell you to read "the summaries" — resolves cleanly: those are *group*
summaries characterising a disagreement, which `register/INDEX.md` § What a
row records requires, not summaries of any rule's text, which the same files
forbid. The `INDEX.md` contents table's "What it governs" column is a per-file
characterisation and is the only thing either instruction can be reading.

**`cant-break-by-design` is mandatory and never restated.** No contradiction,
and no leakage. `grep -rn "ladder\|rung"` over `plugin/` and
`COMPACT-12-15.md` returns six hits: three that reference the enforcement
ladder as living in the skill and explicitly not restated (`README.md:101`,
`rules/design-invariants.md:15`, `agents/invariant-auditor.md:40`), one row
comment saying the same, and two about an unrelated *filing* ladder in
`rules/rule-governance.md:54` and `skills/rule-intake` step 5. The catalog of
ways a claim outruns its mechanism is referenced by row range in
`COMPACT-12-15.md` (9.49–9.75) and by name in `agents/invariant-auditor.md`,
and is reproduced nowhere. The mandate itself is stated once, in
`rules/design-invariants.md` § The mandate, and pointed at from `README.md`
and the auditor brief.

### Other coherence findings

**A rule stated twice in identical words with no cross-reference.**
`rules/environment-and-platform.md` (row 11.5) and `rules/tool-output.md` (row
8.31) both closed with "It never skips quietly, because a skipped check reads
as a pass", the second sentence word for word identical. The union's own
`register/INDEX.md` § Two rules that look alike requires the split be
cross-referenced with the reason, and its own test — would that group's remedy
have produced this fix? — shows they are genuinely different rules (11.5's
remedy is resolving by explicit path; 8.31's is printing a count). **Fixed**
(F11): the cross-reference and the reason for the split are now stated, so the
pair reads as deliberate rather than as a copy.

**Two names for one thing.** `rules/design-invariants.md` § Wiring honesty said
"the central hub" (row 9.134) and then "that central point" (row 9.135) for
the same place, inherited from the table. **Fixed** (F10).

**A project-conditional consequence stated as universal.**
`rules/design-invariants.md` § Absence and defaults asserted "Withholding it
makes the definition table fail to build" as a flat universal fact; it holds
only where the definitions are declared in a table the build checks. **Fixed**
(F8) — scoped, with the mechanism named, so the demand is unchanged and the
claim is now true everywhere it is made.

**A dropped scoping clause.** Row 9.117 lost "along a Free-class path" from its
source (`ferrislicer/docs/rules/panic-on-absence.md`), and
`rules/design-invariants.md` § The three classes of setting inherited the loss,
leaving the refinement reading as though it applied to all three classes.
**Fixed** (F9).

**Register index counts.** Mechanically checked: for each of the ten rule
files, the "Rules" count in `register/INDEX.md` § Contents equals the number of
top-level bullets in that file. Ten out of ten match. For nine of the ten the
bullet count also equals the number of rows the file's own row comment claims;
`design-invariants.md` carries 99 rows in 92 bullets, so seven rows are merged
pairs. Checked that this is compaction and not loss: every one of the 99
claimed rows' distinctive vocabulary is present in the file (0 rows below a
42% keyword-coverage threshold). No silent drop.

---

## 2. Closed loops

Each step names the file that carries it. A step whose neighbour was missing is
marked and fixed.

### (a) Rule dictation → capture → inbox → intake → rule file + index → commit gate → visible to all copies

| # | Step | File carrying it |
|---|---|---|
| 1 | The session is told how to dictate, where capture lands, what stays blocked, where the register lives | `hooks/session-banner.md` steps 1–2 |
| 2 | A standing rule is dictated behind an agreed prefix; the mark is the only trigger | `rules/rule-governance.md` § Dictating a rule |
| 3 | The mark is detected before the reply; one entry is appended verbatim, disposition pending | `hooks/rule-capture.md` steps 3–7 |
| 4 | The session is told to file it now and what will fail until it does | `hooks/rule-capture.md` step 8 + *What the user sees* |
| 5 | A rule ruled without the mark is written into the inbox by hand, with a note why capture did not fire | `rules/rule-governance.md` § Dictating a rule; `skills/rule-intake/SKILL.md` § When it starts |
| 6 | Intake starts, from any of five triggers | `skills/rule-intake/SKILL.md` § When it starts |
| 7 | It runs in the project root, per the by-convention list | `skills/rule-intake/SKILL.md` § Where this runs → `rules/agent-topology.md` § Where an agent works |
| 8 | The group is found cheaply; agree/sharpen/contradict; the two-groups test | steps 2–4 → `rules/rule-governance.md` § Finding the group it joins; `register/INDEX.md` § Two rules that look alike |
| 9 | Placement by ladder | step 5 → `rules/rule-governance.md` § Finding the group it joins |
| 10 | The durable home is written first — the index never originates | step 6 → `rules/rule-governance.md` § Where a rule lives |
| 11 | The citing row is added: date, one sentence, section citation | step 7 → `register/INDEX.md` § What a row records |
| 12 | Supersession stamped in both directions, owner's call | step 8 → `rules/rule-governance.md` § Filing and closing the loop; `register/INDEX.md` § What a row records |
| 13 | The inbox entry is dispositioned; the inbox stays append-only | step 9 → `rules/rule-governance.md` § Filing and closing the loop |
| 14 | The full register check runs, not the cheap subset | step 10 → `rules/rule-governance.md` § Filing and closing the loop; `register/INDEX.md` § What the check verifies |
| 15 | Home, index and inbox commit together, paths named | step 11 → `rules/rule-governance.md` § Where a rule lives |
| 16 | The commit gate blocks on any entry still pending | `gates/commit-gate.md` step 3 + acceptance check 3 |
| 17 | A clone that never activated is caught on the hosted half; the merge gate re-runs the checks in full | `gates/commit-gate.md` steps 10 and 13; `gates/merge-gate.md` step 7 *Governance backstop*; `WIRING.md` § Activation, per clone |
| 18 | Every active copy sees the new rule at its next session start | `rules/agent-topology.md` § Where an agent works |
| 19 | Rule files load whole at session start | `README.md` § How the pieces relate; each rule file's own header |

**Defect found at step 3/7.** The capture mechanism and the filing convention
disagreed about where an entry lands when the session is inside a copy — see
§ 1. The loop is now closed for the convention-following case at every step,
and the case where the convention was not followed is named rather than
asserted, with the workflow question handed to the owner (OQ.1).

### (b) Effort: create copy → reset → work → commit by name → merge gate on the merge result → merge from root → push → teardown

| # | Step | File carrying it |
|---|---|---|
| 1 | Owner's explicit go, given directly | `skills/effort-lifecycle/SKILL.md` step 1 → `rules/worktree-discipline.md` § Creating one |
| 2 | Named for the work; branch named exactly the same, no prefix | step 2 → same section |
| 3 | Created by the tool, not by hand; one line of output is the path | step 3 → `hooks/worktree-create.md` (whole story; steps 1–11) |
| 4 | First act: reset onto the exact branch the work targets, whichever copy is newer | step 4 → `rules/worktree-discipline.md` § Creating one — **and** `hooks/worktree-create.md` *What the user sees*, which hands the caller that obligation explicitly rather than discharging it. The handoff is stated on both sides; this is the loop's tightest joint. |
| 5 | Commit by naming exact paths; no blanket add; flags before the separator; protected records never staged | step 5 → `rules/worktree-discipline.md` § Committing from it |
| 6 | The effort's running ledger, shipped with the work | step 6 → `rules/work-tracking.md` § The learnings record |
| 7 | Temporary instrumentation announced before it is written, removed after | step 7 → `rules/worktree-discipline.md` § Working in it |
| 8 | The merge is made locally in the project root; the gate judges that merged tree; every required leg green | step 8 → `gates/merge-gate.md` (whole), `gates/ratchets.md` (one leg), `agents/invariant-auditor.md` (optional dispatch), `rules/worktree-discipline.md` § Merging and tearing down |
| 9 | Push, from the project root | step 9 → `rules/agent-topology.md` § Where an agent works (merging and pushing are on the by-convention list) |
| 10 | Delete the copy and its branch immediately, same session | step 10 → `rules/worktree-discipline.md` § Merging and tearing down |
| 11 | List what is left; report debt; never delete someone else's or one with uncommitted changes; release a locked copy through its tool | step 11 → same section |

**Defect found at steps 8/9.** The sequence ordered "get green on the merge
gate, run on the merge result" (8) *before* "merge from the project root, then
push" (9) — a gate on a merge result that does not exist yet. `gates/merge-gate.md`
carries the correct shape ("against the merged result… before it is pushed")
and `rules/worktree-discipline.md` carries the bar ("Merge only after every
required verification leg has passed"). **Fixed** (F5): step 8 now makes the
merge locally and gates that tree, step 9 publishes it, and § Does this apply?'s
project-root mapping was updated to match. Both demands survive intact — the
merge is not finished while a leg is red, and nothing is published ungated.

### (c) Diverged edition: precondition → lists → bins → rebuild → graft → verify → switch

All in `skills/refresh-diverged-branch/SKILL.md`, and this is the exemplar for
check 6 — every step names what it consumes.

| # | Step | Where |
|---|---|---|
| 0 | Precondition: two parallel editions, one following the other, a common ancestor, and one of two triggers; ordinary syncing stays the default | § The premise |
| 1 | Common ancestor; each side's changes *against it*, never tip-to-tip; ends holding two lists | step 1 |
| 2 | Two bins from step 1's lists: one-sided, both-changed; why one-sided needs no decision | step 2 |
| 3 | Triage step 2's both-changed bin by direction; documentation and lock files skip the judgement; ends split in two | step 3 |
| 4 | Rebuild as a fresh copy of the primary line; re-apply step 2's one-sided bin word for word | step 4 |
| 5 | Graft the edition's intent onto both parts of step 3's split, using step 1's ancestor | step 5 |
| 6 | Re-home step 2's edition-only files into the edition's own module, not behind a switch | step 6 |
| 7 | Verify what steps 4–6 built: tests, the edition's build, hands-on where interface or engine code moved, and that the primary line's added features still carry their tests | step 7 |
| 8 | Switch over as a separate deliberate promotion of step 7's verified branch | step 8 |
| — | Conditions you may hit: no remote access, falling back to merging, reclaiming disk | § Conditions you may hit |

No defect. Every neighbour is present and every step names its input.

---

## 3. Mechanism-story fidelity

Each of the eight stories re-checked against the phase-1 script one final time —
inputs, outputs, exit codes, block versus advise.

**`hooks/rule-capture.md` — pass.** Against `ferrislicer/.claude/hooks/rule_capture.py`
and `dwc-ng/.claude/hooks/rule_capture.py` (identical in mechanism). Unparseable
payload → do nothing, exit 0 ✓. Missing prompt treated as empty ✓. `lstrip()` +
case-insensitive prefix, the sole trigger ✓. Project root from the harness
variable, else the working directory ✓. Entry shape verbatim: blank separator,
`## <UTC stamp> <session>`, prompt stripped, `Disposition: PENDING` ✓, with a
fixed placeholder when the payload carries no session ✓. Append mode, never
reads existing entries, never deduplicates ✓. Printed instruction folded into
the turn ✓. The write is deliberately outside the try/except, so a failed write
propagates rather than being swallowed — story step 11 is accurate ✓. The
story's user-visible text is *stronger* than either source: both sources claimed
commits are blocked unconditionally; the union says "wherever the commit gate is
active", which is the reconciled honest form.

**`hooks/rule-nudge.md` — pass.** Against both projects' `rule_nudge.py`. All
eleven steps match, including the scoped status query, the fail-open on any
query failure, the exact-file-or-directory-prefix matching with a trailing
separator marking a directory, and the advisory-only contract. The story's
"adapted per project by dropping what a project does not have, never by
inventing a path it might have" is exactly what the two sources' `RULE_BEARING`
tuples differ by. Step 11's generated-ledger double duty comes from the second
project's docstring ✓. The 15-second inner limit matches `timeout=15`, and
`WIRING.md`'s "thirty seconds, with its own inner limit on the version-control
query" is the correct reading of the pair.

**`hooks/session-banner.md` — pass.** Against the `SessionStart` entries in both
`.claude/settings.json` files and the reconciliation notes recording that both
banners once lied about their own gate. The story's steps 3, 4 and 6 — state
the true gating condition, say so where there is no hosted check, and move the
banner text in the same change that moves the gate — are precisely the
correction both projects needed and neither had. Fixed string, no lookup, never
blocks ✓.

**`hooks/worktree-create.md` — pass.** Against
`ferrislicer/.claude/hooks/create_worktree.py`. Name from the first field
present ✓. Prefix stripped so directory and branch come out bare ✓. Empty name
→ message naming the hook and quoting the whole payload, on the error channel,
non-zero exit ✓ (verbatim in the source). Base reference resolved only when the
payload named none ✓ (Python's short-circuit). `head` → local head, `fresh` →
the shared upstream default, unreadable settings → `fresh`, undeterminable
upstream → local head rather than failure ✓ all four. Parent directory created
✓. Existing branch → attach rather than re-create ✓. Every underlying message
routed to the error channel ✓. Failure → abort naming the exit status ✓. Success
→ the path on the output channel and nothing else ✓. The story orders the
empty-name abort before base resolution where the source computes the base
first; no behavioural difference, since it aborts either way.

**`hooks/quiet-output.md` — one defect, fixed.** Against
`ferrislicer/.claude/hooks/quiet_hook.py` and `quiet_run.py`. The decision
order (steps 1–9) matches `wrap_mode` exactly, including the two orderings the
story calls out: piping wins over everything below it, and state-changing is
tested before noisy because clone/fetch/pull appear in both. Both pattern sets,
the explicit-enumeration-versus-suffix-match distinction (step 12), the
deliberately-excluded analysis tools (step 13), and the command-position
anchoring with environment prefixes (step 14) all match. In the wrapper: forty
lines pass-through (`PASS_THROUGH_LINES = 40`) ✓; the verbatim condition
`forced or (mode != "infra" and len(lines) <= 40)` matches step 21 exactly ✓;
every one of the eleven proof-of-success shapes in step 22 maps to a branch of
`INFRA_OK`, matched case-insensitively, with the never-empty fallback and the
non-zero-exit fall-through ✓; the reducing selection's block-to-next-blank,
two-lines-of-context (`CONTEXT_AFTER = 2`) and eight-line tail (`TAIL_LINES = 8`)
✓; the two proof-line shapes and the at-least-one-underscore rule ✓; the
two-hundred cap split three-fifths/two-fifths (`200*3//5 = 120`, `200-120 = 80`)
✓; both elision markers verbatim ✓; delete the command file, exit with the
command's own status ✓.

> **Defect:** step 5 read "If the command redirects its output to a file, do
> not wrap. Merging the error stream into the normal stream is not a redirect
> and exempts nothing." The mechanism at `quiet_hook.py:105` is stronger: the
> stderr-merge token *anywhere on the line* cancels the redirect exemption
> outright, including alongside a genuine file redirect. The story mirrored the
> weaker row 8.9 and would have led a reader to expect a redirected build to
> pass through when it is in fact wrapped. **Fixed** (F4), with an acceptance
> check added pinning both halves.

One deliberate generalisation, not a defect: step 14 says "every pattern"
tolerates a repository-directory option between command and subcommand, where
only the state-changing set does today. That is the universal form prescribing
more than one source implemented; it strengthens rather than weakens, and the
acceptance check that pins it names the state-changing case, which is the one
that exists. Likewise step 24's chatter list generalises five build-tool-specific
words into the categories it already names.

**The 26 tests in `quiet_hook_test.py` against the story.** The brief said 24;
the suite carries 26 test methods and all 26 pass:

```
Ran 26 tests in 0.007s
OK
quiet_hook_test: ok -- 26 tests, 0 failures
```

Walked one by one: `noisy_commands_wrap` and `quiet_commands_pass` → steps 3,
4, 5, 8; `new_shell_gates_wrap` → step 12's enumerated arm; `piped_gate_still_opts_out`
→ step 4's "piping wins over everything below it"; `direct_python_test_runners_wrap`
→ step 12's suffix arm; `payload_tools_never_wrap` → step 13; `gh_chatter_is_filtered`
→ step 11's tracker chatter, including the sign-in-status query;
`infra_actions_show_proof_only` → step 10, including the repository-directory
option case in step 14; `git_reads_pass` → step 9's fall-through;
`infra_success_keeps_only_proof_lines` and `infra_failure_keeps_errors` → step
22, including the never-empty rule and the non-zero fall-through;
`gh_reads_are_never_wrapped` and `gh_piped_or_trivial_passes` → step 6;
`gh_check_rows_and_urls_survive_filter` → step 23's summary shapes;
`gh_env_disables_pager_prompts_colour` → step 19's environment list;
`heartbeat_survives_infra_filtering` and `heartbeat_survives_filter_mode` →
step 25's first shape plus the story's own acceptance check about a heartbeat
buried far outside the tail window; `conforming_gate_denominator_survives_without_enumeration`
→ step 25's format-anchored claim; `failing_gate_denominator_survives_buried_in_noise`
→ step 23; `bulk_noise_still_dropped` → the story's "fewer than ten in
proof-of-success mode and fewer than twenty in reducing mode" acceptance check,
which is that test's own two assertions; `proof_line_does_not_admit_prose_word_colon`
→ step 25's underscore requirement; `short_output_is_verbatim_threshold` → step
21; `progress_bar_keeps_last_frame` and `ansi_stripped` → step 20;
`error_block_and_summary_kept_chatter_dropped` and `test_failure_section_kept`
→ steps 23 and 24. Every one is represented in the story, and the story's
acceptance checks are a superset. The one test whose *placement* the union
deliberately moves is the suite itself: its footer records it running blocking
in that project's pre-commit hook, while the union runs it in the merge gate
per the four-check ruling (row 8.29). That is recorded in the file's own row
comment, in the story's closing acceptance check, and in the decision sheet —
declared, not drifted.

**`gates/commit-gate.md` — one defect, fixed (F1, § 1).** Against
`ferrislicer/.githooks/pre-commit`, `dwc-ng/.githooks/pre-commit`,
`scripts/citation_creation_gate.py`, `scripts/register_check.py` and
`scripts/sweep_guard.sh`. The register check's blocking set (citations resolve,
status marks well-formed, supersession bidirectional, no pending inbox entry)
and its fast/full split match `register_check.py`'s docstring, including that
the cheap mode's blind spot is the group-and-status scan. The citation-target
check's four conditions, its four stated non-checks, its self-exclusion and its
always-printed denominator match `citation_creation_gate.py`'s docstring
clause for clause, and the three FAIL lines and the count line in *What the
user sees* match the source strings in shape verbatim. The advisory sweep
matches `sweep_guard.sh` condition for condition — suspects are newly-tracked
non-doc files; silent with no suspects; silent with no staged doc path; silent
when a modified/deleted/renamed non-doc path is also staged; three denominators
plus one line per suspect; always exit 0 — including the source's `scripts/`
tolerance, which the union generalises to "a project may exempt one named
tooling area". Block-versus-advise is right everywhere: mechanical checks block,
prose-content matching only warns, advisory output never changes the exit
status.

**`gates/merge-gate.md` — pass.** Against `ferrislicer/scripts/merge-gate.sh`.
The runner captures the command's own exit status and never a pipe's, writes
one log per leg and buckets pass/FAIL/skipped ✓ — and the story's output block
matches the source's `printf "  %-46s"` padding and its `FAIL (exit %d, %s)`
shape. Base resolution — first parent when the head is a merge, else the merge
base with the shared default, else the previous commit — matches exactly ✓. Own
build directory ✓. Prerequisites resolved once up front with a loud abort:
`FATAL: no usable <tool> found (checked, in order: <candidates>)` matches ✓.
Baseline diffing rather than exit status, with one component owning parse,
evidence and baseline ✓ (the source says so in the same words: the extraction
and the diff "both live in ONE place now"). Hard failures on a missing verdict
and on an unrecognised category ✓ verbatim in shape. Evidence-that-something-ran
✓ verbatim in shape. Quick mode printing `skipped (--quick)` ✓. The formatting
leg's changed-file-command exit-status capture — "a crash wearing a pass" — is
the source's own phrase ✓. Closing verdict lines ✓ exact.

**`gates/ratchets.md` — pass.** Against
`ferrislicer/scripts/invariant_scan_gate.py`. All five comparison outcomes
match (above → fail; below → report; equal → nothing; new category → fail;
vanished category → report). Tool's-own-tests-first, shipping-code-only,
echo the files-parsed and skip lines, refuse a nothing result, regeneration
only behind the explicit flag, missing baseline → fail naming the file,
count line every run, non-zero only on real failures, rewrite on a corrected
scope, and the miscalibration and magnitude rules ✓. All eleven lines in *What
the user sees* match source strings in shape, including `baseline written: <n>
detectors`.

---

## 4. Best-sum per group

Measured first. Per group, how many rows carry content from each project, and
how many are excluded from the union:

```
  g name                                tot  F-only  D-only  both  excl
  1 Straight Talk                        10      10       0     0     0
  2 Rule Governance                      34       3       0    31     0
  3 Verification & Evidence              50      42       7     1     0
  4 Agent Topology & Economy             25      14       4     7     0
  5 Worktree & Campaign Discipline       40      38       0     2     0
  6 Work Tracking                        36      33       0     3     6
  7 Test Double & UAT Discipline          8       0       8     0     8
  8 Tool Output Hygiene                  32      32       0     0     0
  9 Design Invariants                   185     177       7     1     7
 10 Reference Sources                    14       8       2     4     9
 11 Environment & Platform               11       5       5     1     0
 12 Standing Agents                      47      47       0     0    11
 13 Register System                      32       9       3    20     0
 14 Commit Gates                         18      14       1     3     0
 15 Merge Gates & Ratchets               37      37       0     0     0
```

That table is the honest backdrop for what follows: in five groups the union is
substantially one project's form, and saying so is more useful than claiming a
synthesis that did not happen.

**1. Straight Talk — one project's form, and it is the right one.** All ten
rows come from one side; the other has no straight-talk section at all, its
honesty demands firing on verification instead. So there was nothing to sum.
What the union added is a boundary neither project stated: `rules/straight-talk.md`
says explicitly that it governs conversation and not the written artifacts
conversation produces, which stops the be-brief-and-avoid-jargon rules from
being read as licence to write imprecise commit messages. That scoping is the
union's own contribution, and it is what makes the group safe to load
unconditionally.

**2. Rule Governance — a genuine best-sum, the strongest in the table.**
Thirty-one of thirty-four rows have content from both projects, which is the
highest agreement anywhere here, and the union is stronger than either. Both
projects had capture, an inbox, a register and an intake procedure; both had
banners or docstrings that overclaimed their own gate, and both had that lie
found and only partly propagated. The union's § Honesty about the machinery is
where the sum shows: it states where the gate does and does not run *in the
same breath as claiming it exists*, which is the rule that would have caught
both projects' defect at source. Neither project had it as a rule; both had it
as an incident.

**3. Verification & Evidence — one project's spine, sharpened at seven joints.**
Forty-two rows from one side, seven from the other, one shared. The seven are
not decoration: they carry the confirmation discipline — a completion claim
records what was driven and observed — which is what turns the predict-before-you-work
rule from a planning ritual into something falsifiable. The combined § Predict
before you work plus § What the check could actually see is stronger than either
original, because the first supplies the prediction and the second supplies the
reason a green result is the most dangerous place to stop.

**4. Agent Topology & Economy — genuinely mixed, and better fused.** Fourteen,
four, and seven shared. One project brought serial dispatch, model tiering and
batching; the other brought the work-topology rules about which copy an agent
works in. The union merged them into one file with the standing-agent
conventions from group 12, which is the fusion that pays: `rules/agent-topology.md`
now answers *what gets dispatched, on what model, how many at once, where it
works, and what it may conclude* in one place, and the two agent briefs can
therefore state only their own question. Neither project had that separation —
in one, the conventions lived inside each agent file and were restated three
times.

**5. Worktree & Campaign Discipline — one project's form, deepened.**
Thirty-eight of forty rows from one side. The other contributes the rule that
work happens in a copy at all, which is the premise the rest hangs off. The
union's addition is structural rather than new demands: splitting the life of a
copy into creating / working / committing / merging-and-tearing-down, with the
creation tool's contract in `hooks/worktree-create.md` and the sequence in
`skills/effort-lifecycle`, so the same rules are reachable from the tool, the
sequence and the rule file without being stated three times. The teardown
demand — the merge is not the end, the teardown is — survived intact.

**6. Work Tracking — one project's form, with six rows deliberately dropped.**
Thirty-three of thirty-six from one side; the six exclusions are the mapping-pass
method and the render-drift check, both ruled project-specific. The union kept
the principle each served (a derived document is generated rather than
hand-maintained) in § One editable home, which is the stronger statement
anyway: it demands a single editable home and a generator, where the dropped
check merely detected divergence after the fact. Honest note: the ticket-and-companion
machinery is entirely one project's, and a project without that tracker shape
gets little from this group beyond § The learnings record.

**7. Test Double & UAT Discipline — not in the union at all.** All eight rows
come from one project and all eight are excluded by ruling. Recorded here so
the absence is deliberate rather than an oversight: `README.md` § What was
deliberately left out names it first. The union is *weaker* than that project
here, knowingly.

**8. Tool Output Hygiene — one project's form entirely, and it is the group
that most needed universalising.** All thirty-two rows from one side. What the
union did is split what was one body of practice into two files that face
opposite directions: `rules/tool-output.md` states the obligations on the tools
being filtered (a proof line, a denominator, a heartbeat), and
`hooks/quiet-output.md` states the filter that keeps them alive. Reading either
alone now tells you which side of the contract you are on. In the source the
two were tangled, which is why the source's own test suite had to be told to
emit a conforming line "in addition to, not instead of" its normal report — a
fix that reads as a workaround there and as a stated rule here.

**9. Design Invariants — one project's corpus, with the other's single most
important sentence.** A hundred and seventy-seven rows from one side, seven
from the other, seven excluded. But one of those seven is the by-construction
principle itself, which the second project stated as a hard rule and which was
nearly lost when its enclosing section was deleted as domain content. The union
is stronger than either because of what it *refuses* to include: the
enforcement ladder, the techniques and the anti-pattern catalog are referenced
in the mandatory skill and reproduced nowhere, so `rules/design-invariants.md`
is only what extends the skill. In the source, the ladder was restated in
places that then drifted from it. Ninety-nine rows fit in ninety-two bullets
with nothing lost (§ 1).

**10. Reference Sources — the right five kept, nine dropped.** Eight rows from
one side, two from the other, four shared, nine excluded. What went is the
ranking of several named reference implementations against each other and how
to classify a disagreement between two of them — all of it about specific
products. What stayed is the part that is a working agreement rather than a
fact about anyone's product: read it, take the understanding, write your own,
cite by file and line in specifications but never lift code, and this holds
whatever the licence permits. Five rows, and the group is stronger for the
subtraction: the kept rules apply to any project, and the dropped ones applied
to one.

**11. Environment & Platform — the most evenly split group, and a real sum.**
Five, five, one shared. One project brought platform scope and tool resolution
(the whole-layer exclusion, the same-named stub that fails looking like your
own file is broken); the other brought the dependency policy (frozen lock
file, blocked lifecycle scripts, minimum published age, the installer itself
pinned). Neither had the other's half. The union is the only place both exist,
and they belong together: they are the two ways a project's environment can
surprise you.

**12. Standing Agents — one project's, with a third of the group ruled out.**
All forty-seven rows from one side; eleven excluded with the configuration-field
agent. The union's improvement is structural and real: the thirteen
agent-wide conventions moved into `rules/agent-topology.md` and the two
surviving briefs restate none of them, so each brief is its own question,
procedure and output and nothing else. The comparison agent was also
generalised — verdict first, regression told from pre-existing difference,
never edits to pass, never rebakes — with one project's harness specifics left
behind, which is what makes it usable anywhere. Honest note: the enforcement
auditor's scale lives entirely in the mandatory skill, so this group is only as
strong as that skill is present.

**13. Register System — the second genuine best-sum.** Twenty of thirty-two
rows carry both projects. Both had the same register shape and one had ported
the checker from the other, so the agreement is real rather than coincidental —
and where they diverged, the union took the stricter reading each time
(citations by section rather than line number, generalised from one document to
all rule files). The phase-3 simplification is the union's own contribution:
the register became an index over `rules/` with no summary layer, which
dissolves the drift both projects were managing rather than managing it better.

**14. Commit Gates — one project's, cut down deliberately.** Fourteen, one,
three. The union is *smaller* than either project's gate and that is the point:
four cheap checks and one advisory, with everything heavy moved to the merge
gate, because one project's every-commit gate had grown past an hour. The
conflict at row 14.3 — every commit versus only the commits touching the
checked surface — was ruled for every commit, and the losing argument (an
always-firing gate is one people switch off) is answered by the cost cut rather
than dismissed. That is a better outcome than either project had: one had the
scope right and the cost wrong, the other the reverse.

**15. Merge Gates & Ratchets — one project's form entirely, and unaltered for
good reason.** All thirty-seven rows from one side; the other project has no
merge gate. Nothing was summed, so the honest verdict is that this group is a
faithful universalisation rather than a combination. It survives the transfer
well because almost every rule in it is about how a gate lies to you — a pipe's
exit status standing in for a command's, a filter that stopped matching, a
baseline moved to make today pass, a check that ran nothing — and none of that
is specific to any toolchain.

---

## 5. One-minute test

Per rule file section, per story, per skill: could it be explained aloud in a
minute?

**Rule files — pass, with three notes.** All ten files are sectioned so that
each section is one idea with its bullets as instances, and each section name
states the idea. Three sections run long enough to be worth naming:

- `rules/design-invariants.md` § Handing a resource on — nine bullets, the
  densest in the union. It passes on its spine, which is explainable in well
  under a minute: a stage that consumes a resource removes it before anything
  downstream is derived; there are exactly two ways to decline and they never
  share a word; every declined resource has exactly one named recipient. The
  bullets are instances of that spine, not additional ideas. Left as written.
- `rules/design-invariants.md` § Auditing invariants: the denominator — the
  standing-obligation-shapes bullet is a nine-item catalogue in one sentence
  and is not explainable in a minute. It is a reference list by nature: it *is*
  the denominator's definition, and shortening it would drop a shape, which is
  exactly the loss the section exists to prevent. Left as written, deliberately.
- `register/INDEX.md` § What the check verifies — fourteen bullets. Passes on
  the summary a reader can give in one breath: citations resolve to a file, a
  non-blank line and a real heading; status marks are well-formed; supersession
  is checked both ways; plus the limits the header must state and two
  advisories. The limits are the part worth the length.

**Stories — pass, at phase granularity.** `hooks/quiet-output.md` (27 steps)
and `gates/merge-gate.md` (15 steps plus nine legs) cannot be read aloud in a
minute end to end, and neither should be: both are already broken into labelled
phases — deciding, the sets, rewriting, running; and prerequisites, the runner,
the legs, judging, the verdict — and every phase is under a minute. The other
six stories pass whole. `gates/commit-gate.md`'s opening sentence failed the
test before F1, because a reader who counted four blocking checks and then met
step 9 had to stop and reconcile; it passes now.

**Skills — pass, after one fix.** `skills/refresh-diverged-branch` passes
outright and is the model: the premise is one paragraph, and each step is one
move naming its input. `skills/rule-intake` passes — eleven steps, each one
action. `skills/effort-lifecycle` failed on steps 8 and 9, where the order made
the sequence unexplainable without an apology ("gate the merge result, then
merge"); **fixed** (F5) and re-checked: the sequence now reads create, reset,
work, commit, merge-and-gate, push, tear down, list — sayable in a minute, and
every demand still there.

**Simplifications made for this check, and what was preserved.** Two: F1 and
F5. Neither removed a demand. F1 replaced a wrong word ("blocking") with the
distinction the gate already makes elsewhere. F5 reordered two steps and made
each name its input; the green-before-merge bar and the never-publish-ungated
bar both survive, and one of them is now cited to its rule file where before it
was only implied.

---

## 6. Each step stands alone or names its input

Checked over every numbered sequence: the three skills and the eight stories'
"What it does" lists — 11 + 11 + 8 steps in the skills, 27 + 11 + 6 + 11 + 13 +
13 + 15 + 10 in the stories.

**Two defects found, both fixed.**

- `hooks/rule-capture.md` step 5 said "resolve the inbox file under the project
  root **from step 3**". Step 3 is the mark test; it produces no project root,
  which is read in *What it reads*. A broken internal reference. **Fixed** (F2).
- `skills/rule-intake/SKILL.md` step 4 said "the candidate that looks like its
  home" without naming which step produced the candidates, while steps 3, 5, 6
  and 7 all name theirs. **Fixed** (F7).

**Everything else passes.** Notable cases where a step correctly names a
forward or backward neighbour rather than leaving it implied:
`hooks/quiet-output.md` step 6 ("the ceiling in step 26 never applies to it"),
step 16 ("that file", from step 15), step 21 ("the normalised output", from
step 20), step 27 ("the temporary command file", from step 15);
`gates/merge-gate.md` step 6 ("where that redirect swallows", from step 5),
step 7's last leg ("judged as in step 8"), step 12 ("the owning component",
from step 11); `gates/ratchets.md` steps 3 and 4 (the output and the parsed
lines from steps 2 and 3); `hooks/worktree-create.md` steps 5, 6 and 8 (the
bare name from step 2, the resolved base from step 4);
`skills/effort-lifecycle` step 3 ("The tool prints one thing on success: the
new copy's full path. Use that path"). Every step of
`skills/refresh-diverged-branch` names its input, which is why it was used as
the standard for the rest.

---

## Inline fixes

Fourteen. Each names what it fixed and which check found it. Line numbers are
pre-edit positions in the file named.

| # | File | Where | What it fixed |
|---|---|---|---|
| F1 | `plugin/gates/commit-gate.md` | line 3 | "Four cheap **blocking** checks" contradicted its own step 9 and `WIRING.md`: two of the four block nothing. Now "two the gate executes and rejects the commit on, and two that its header states and a person applies". (Check 1, check 5) |
| F2 | `plugin/hooks/rule-capture.md` | step 5, line 33 | Broken internal reference: "the project root **from step 3**" — step 3 is the mark test. Now points at *What it reads*. (Check 6) |
| F3 | `plugin/hooks/rule-capture.md` | step 5 + acceptance check 5 | Asserted a filing workflow (entry lands in the copy, travels with the change) that `rules/agent-topology.md` § Where an agent works rules out. Now states the mechanism fact and names the convention and the file holding it, without choosing a workflow. (Check 1, check 2a; raised as OQ.1) |
| F4 | `plugin/hooks/quiet-output.md` | step 5 + acceptance check 1 | Story mirrored the weaker row 8.9; `quiet_hook.py:105` cancels the redirect exemption entirely when the stderr-merge token is present, even alongside a real file redirect. Now states both halves, with an acceptance check pinning them. (Check 3) |
| F5 | `plugin/skills/effort-lifecycle/SKILL.md` | § Does this apply?, steps 8–9 | The gate on the merge result was ordered before the merge. Step 8 now makes the merge locally and gates that tree, step 9 publishes it; the project-root mapping updated to match. Both bars preserved and one now cited to its rule file. (Check 2b, check 5) |
| F6 | `plugin/skills/rule-intake/SKILL.md` | step 10 | Cited `register/INDEX.md` § What the check verifies for a rationale that lives in `rules/rule-governance.md` § Filing and closing the loop. Now cites the rule file for the demand and the index for what the check covers. (Triage) |
| F7 | `plugin/skills/rule-intake/SKILL.md` | step 4 | Did not name which step produced the candidate. Now "whichever candidate from step 3". (Check 6) |
| F8 | `plugin/rules/design-invariants.md` | § Absence and defaults | Row 9.110's project-conditional consequence ("makes the definition table fail to build") stated as a universal fact. Now scoped to where such a table exists, with the mechanism named. Demand unchanged. (Check 1, triage) |
| F9 | `plugin/rules/design-invariants.md` | § The three classes of setting | Row 9.117's dropped scoping clause restored: the refinement targets the first-class path specifically, and what it means for the other two is now said. (Check 1, triage) |
| F10 | `plugin/rules/design-invariants.md` | § Wiring honesty | Rows 9.134 and 9.135 named one place two ways ("the central hub" / "that central point"). Harmonised. (Check 1, triage) |
| F11 | `plugin/rules/environment-and-platform.md` | § Resolving a tool | Row 11.5 restated row 8.31's demand in identical words with no cross-reference, against the union's own § Two rules that look alike. Now cross-referenced to `rules/tool-output.md` with the reason for the split (two triggers, two remedies). (Check 1, triage) |
| F12 | `COMPACT-12-15.md` | decision sheet, line 21 | "all 134 ids carry live statements" left standing while only the other half of the sentence was superseded. Now supersedes both halves and states 123 live / 11 dropped. (Triage) |
| F13 | `COMPACT-12-15.md` | field-agent line | Line marked `✗` cited `[12.21, 12.28]` while 12.28 is kept. Now states 12.21 is dropped and 12.28's stop-and-file rule is kept in `rules/agent-topology.md`. (Triage) |
| F14 | `COMPACT-12-15.md` | decision sheet, commit-gate bullet | "four fast checks" followed by five items, one of which is a property not a check. Rewritten to the same two-and-two split as F1, with the advisory named. (Triage, check 1) |

Plus one labelling change, listed separately because it adds a caveat rather
than fixing an error: `COMPACT-12-15.md`'s hosted-document-checks line now
marks its blocking status **inferred** and says why, per the union's own rule
that an unruled verdict is labelled rather than asserted
(`register/INDEX.md` § What a row records). See OQ.4.

No `RECONCILIATION.md` row was modified. No feedback cell was touched.

---

## Triage

Every deferred-minor from earlier reviews, with the decision.

| Item | Decision |
|---|---|
| `rule-intake` step 10 cites `register/INDEX.md` § What the check verifies for a rationale that lives in `rules/rule-governance.md` § Filing and closing the loop | **Fixed now** (F6). The citation resolved mechanically, which is why the scripted check missed it; the heading it named does not carry the full-versus-cheap reason. |
| `quiet-output.md`: the stderr-merge token disables the redirect exemption entirely in source (`quiet_hook.py:105`); the story mirrored the weaker row 8.9 | **Fixed now** (F4), with an acceptance check. This is the one substantive mechanism-fidelity defect found in check 3. |
| `design-invariants.md`: 9.165–9.171 excluded — confirm nothing leaked | **Confirmed clean.** `grep -rniE "migrat\|version stamp\|re-seed\|upgrade notice\|persisted (state\|arrangement\|layout)\|operator's edit\|version boundary"` over `plugin/` returns two hits, both in `README.md` § What was deliberately left out, which is where the exclusion is *supposed* to be named. No normative statement anywhere carries their content. |
| `design-invariants.md`: 6.36 modal "must be" — check it survived | **Survived.** `rules/work-tracking.md` § A ticket and its companion: "The link that binds a ticket to its companion **must be** a different kind of relationship…". The modal and the query-tells-them-apart-by-type demand are both intact. |
| `COMPACT-12-15.md` preamble "all 134 ids carry live statements" half-false | **Fixed now** (F12). |
| `COMPACT-12-15.md` field-agent line carries `✗` while citing kept 12.28 | **Fixed now** (F13). |
| `COMPACT-12-15.md` "four fast checks" bullet reads as five items | **Fixed now** (F14), aligned with F1. |
| Table 9.134 "central hub" vs 9.135 "that central point" | **Inherited, fixed in the union file** (F10). Rows untouched. |
| Table 9.4 "middle two rungs" | **Not inherited.** 9.4's universal cell defers entirely to the mandatory skill (`→ cant-break-by-design § 1. The ladder`), so no union file restates it — confirmed by the ladder grep in check 1. Nothing to fix. |
| Table 9.110 project-conditional stated as universal | **Inherited, fixed in the union file** (F8). |
| Table 9.117 drops a scoping clause | **Inherited, fixed in the union file** (F9), restoring the first-class-path scope from `ferrislicer/docs/rules/panic-on-absence.md`. |
| Table 9.165 "strictly greater" | **Not inherited** — 9.165 is excluded and nothing of it reaches `plugin/` (see the leak check above). Nothing to fix. |
| Table 11.5 restates 8.31 | **Inherited, fixed in the union file** (F11) by applying the union's own two-rules-that-look-alike remedy to itself. Both rules kept; neither weakened. |
| Table 5.6 traded vagueness for some jargon | **Left, with reason.** The words at issue ("reset", "branch", "newer") are the precise ones, and `rules/straight-talk.md` § How much to say scopes the plain-analogy rule to conversation explicitly, exempting written artifacts because precision matters there. Replacing them would cost the demand its edge. Inherited in `rules/worktree-discipline.md` § Creating one and `skills/effort-lifecycle` step 4, both of which state the *why* alongside. |
| Table 14.15–14.18 blocking status inferred | **Left as a demand, labelled as inferred, and raised** (OQ.4). `COMPACT-12-15.md` now marks the status inferred and says exactly which rows do and do not carry it — which is the union's own remedy for an unruled verdict rather than a fix. |
| Six `Supersedes:` stamps point outside the copied subset | **Recorded as a known limit, and raised** (OQ.3). Both directions of those six links are unverifiable from this snapshot: the register check verifies stamp bidirectionality, and the documents the stamps point at were not copied. This is a limit of the phase-1 subset, not a defect in the union, and the union's own demand is unaffected. |
| One project's open PENDING inbox entry (captured 2026-09-01) | **Confirmed handled, and raised** (OQ.2). Traced against `skills/rule-intake/SKILL.md`: the entry is an ordinary pending entry with a heading, a verbatim body and `Disposition: PENDING`, so § When it starts trigger 3 fires on it, step 1 reads it as written, and steps 2–11 dispose of it unchanged. Nothing about it is a special case for the union's sequence. What the union cannot do is decide the rule, which is why it is an open question and not a fix. Its pre-existing presence in the source repository is recorded under § Source repositories below. |

---

## Open questions

Four, appended to `RECONCILIATION.md` under `## Open questions` in the same
five-column format, ids `OQ.1`–`OQ.4`, project cells `—`, feedback empty. They
are questions, not decisions: none changed a row, and none was resolved here.

- **OQ.1** — Where does a rule dictated from *inside* an isolated working copy
  get filed? The capture mechanism writes whichever inbox the session runs
  against; the convention reserves capture and filing for the shared copy. Two
  defensible readings; validation named the seam and did not choose.
- **OQ.2** — One project's inbox still carries an undispositioned entry (a test
  loop should not feed the agent unless something failed). The union's intake
  sequence handles it unchanged; whether it is a standing rule for the union,
  and which file it would join, is the owner's call.
- **OQ.3** — Six supersession stamps point outside the copied subset. Re-verify
  against the full source repository before promoting the plugin, or carry the
  demand forward and leave the six as a stated limit of this snapshot?
- **OQ.4** — Is a hosted document check blocking, in the universal form? Rows
  14.15–14.18 never say. The union reads it as blocking and now labels that
  reading inferred; a ruling would let the label come off.

---

## Mechanical sweep

**Cross-references** (all of `plugin/`, after the fixes):

```
FILES: 26
REFS CHECKED: 82
BAD: 0
```

**Noun check** (all of `union/`; banned: the two project names, vendor and
product names, language, toolchain, package-manager and platform nouns, ticket
and variable prefixes, hosting and query-language names). `RECONCILIATION.md`'s
project columns are exempt as the record; universal cells and everything under
`plugin/` are not.

- `plugin/` and `COMPACT-12-15.md`: **zero hits.** Confirmed by a second,
  looser grep over both:
  `grep -rniE "ferrislicer|dwc|orca|prusa|creality|rrf|duet|solidjs|\brust\b|cargo|clippy|pnpm|hotpath|github|graphql|android|npm"` → no matches.
- `RECONCILIATION.md` universal cells (column 4), all 579 rows: **zero hits.**
- `RECONCILIATION.md` elsewhere: 20 hits, all legitimate — the document title,
  the row-format legend, the reading guide, four group preambles that name
  which project a row came from, and one owner feedback cell written in the
  owner's own words. All of these *are* the record of a comparison between two
  named projects.
- This file, `VALIDATION.md`, names the two projects and the phase-1 script
  paths in fourteen places, all of them evidence citations: the sources check 3
  was run against, the source of a clause restored in F9, and the noun-check
  command line itself. It is exempt on the same ground as
  `RECONCILIATION.md`'s project columns — it is a record *of* the comparison,
  not part of the plugin being validated, and a fidelity claim that would not
  name the script it was checked against is an assertion rather than evidence.
  Nothing shipped in `plugin/` cites it.

**Table structure** (`RECONCILIATION.md`):

```
DATA ROWS: 579  OQ ROWS: 4  HEADERS: 16  SEPS: 16
MALFORMED: 0
```

579 rows across fifteen groups (10, 34, 50, 25, 40, 36, 8, 32, 185, 14, 11, 47,
32, 18, 37), no duplicate ids, every row and every header and separator carrying
exactly five cells. The four new `OQ.n` rows carry five cells too. File is
UTF-8, no BOM, LF throughout, matching `.gitattributes`.

**The filter's own suite**, run against the phase-1 copy as the fidelity
baseline for check 3:

```
Ran 26 tests in 0.007s
OK
quiet_hook_test: ok -- 26 tests, 0 failures
```

---

## Source repositories

Both untouched by this work.

**First source repository** — `git status --porcelain` shows 31 entries, **all
of them `??` untracked**, none modified, none staged, none deleted. They are
model files, rendered images, crash dumps, an experiment script, prompt drafts
and three scratch target directories — the working residue of that project's own
development. Nothing from this reconciliation appears: every file the union
drew on was *read*, and the phase-1 copies under
`../ferrislicer/` are copies, not links.

**Second source repository** — `git status --porcelain` shows two modified
files and two untracked directories:

```
 M docs/rule-inbox.md
 M docs/superpowers/specs/2026-08-28-layout-migration-design.md
?? .claude/backups/
?? .claude/design/
```

**All four are pre-existing drift, attributed as follows.** `docs/rule-inbox.md`
has a modification time of 2026-08-31 19:33 local, and its whole diff against
the last commit is the single appended entry timestamped
`2026-09-01T02:33:29Z` — the same instant in UTC, so the file was last written
by that project's own capture hook, before the phase-1 copy was taken.
`docs/superpowers/specs/2026-08-28-layout-migration-design.md` has a
modification time of 2026-08-29 20:41, two minutes before that repository's own
most recent commit (2026-08-29 20:43) and three days before this work began.
Both untracked directories are that project's local tooling state. `NOTES.md`
in `../dwc-ng/` already records the inbox entry as a pre-existing open item and
the layout-migration spec as an out-of-scope domain document, both noted on
2026-09-01. Nothing in either diff relates to the union.

---

## Verdict

The union is coherent, its loops close, its stories are faithful to the
mechanisms they describe, and every numbered step names what it consumes.
Fourteen defects were found and fixed inline — one substantive mechanism-fidelity
error, three internal contradictions, two broken step references, one
sequence-ordering error, three inherited table defects, three factual errors in
the compaction, and one missing cross-reference. Four questions were beyond what
validation may decide and are with the owner as `OQ.1`–`OQ.4`. Two exclusions
are recorded as knowing losses rather than oversights: group 7 in full, and the
six unverifiable supersession stamps.

The register index's counts are mechanically correct, no excluded content
leaked, both source repositories are untouched, and the 579-row record is
unmodified.
