# What each recalibration decision actually retired

Four audit passes verified that what shipped matches its sources and that every retirement was
**authorized** by a dated decision. None asked whether the decisions were right — they took a dated
decision as authorization and stopped. That is not a gap an audit can close: only the owner can say a
decision was wrong, and he already found one that was. Decision (8) narrowed the ticket-companion rule,
survived two audits, and was ruled an accident on 2026-09-16.

This digest exists so that judgement is a skim rather than an archaeology exercise. Every retired rule
is quoted **in full and verbatim**, because the question is whether that exact sentence should still be
gone. Assembled mechanically from the ledger; only the opening section below is written by a model.

Generated from workflow `wf_3fbeda61-95a`. **51 decisions traced, 166 of 166 retired rules quoted, 12 flagged.**

---

**Shape.** 166 of the 518 ledger rows were retired — 100 parked, 66 dropped — and 131 of those 166 sit under just three decisions: (19) and (24), which together park 100 rules into the unbreakable plugin, and (10), which dropped 30 with the rule register. The remaining 35 are spread one-to-nine at a time across a dozen decisions, and roughly thirty decisions retired nothing at all. So this is really two stories: a large conditional deferral that has not come due, and a handful of small drops where the decision reads wider than it was written.

**Worth a look, worst first.**

**(24) — the whole of `design-invariants.md`, 46 rules, parked "when unbreakable is worked."** That move has not happened: none of this text is in `plugins/unbreakable/`. A third of it was never invariant theory — external input never crashes the product; anything dropped, clamped or never read is said where the user sees it; warn, do not fail; never narrow someone else's data model. `plugins/machinery/scripts/lib/reload.mjs:25` still carries one of them as a comment, so it is being followed by hand with nothing stating it.

**(19) — 54 more rules parked to that same empty destination.** The decision names the auditor, the `invariant-audit` skill and the enforcement ledger; it was used to park the `cant-break-by-design` mandate itself (M49, M50), which is not the auditor. Gone in the meantime: the pre-merge audit whose findings must each be dispositioned, and the line telling a project to install unbreakable at all. Two rows were dropped rather than parked as collateral (M145, M274).

**(10) — the register went, and supersession went with it.** M155 was not register machinery: "Supersession is the owner's call whenever the losing rule was theirs. Propose it; never decide it." Universal rules are now dated bullets appended to `universal.md`, so a rule contradicting an earlier one just sits beside it with no defined resolution and nothing saying whose call a retirement is. M161 — each group states plainly where nothing enforces it — died the same way, and that is precisely the blind spot the four audits could not see.

**(6) — a decision about predictions retired two verification rules.** M200 ("a claim that output is unchanged is measured by producing the output and comparing it — it is never assumed") and M204 ("list the checks before running the first one… a good result is the most dangerous place to stop"). TDD red/green replaces a prediction report; it says nothing about a refactor or cleanup that writes no test, which is exactly what M200 guarded.

**(26), (27), (29) — three guardrails became settings, and the settings here were not yours.** `reviewBeforeMain` gained a `no-review` value, so a project may legitimately let agent work reach main with neither a person nor an adversarial reviewer; `comparisonAgent` is `on-request` in this repo, so the output-regression check never fires by itself; `--no-verify` kept the prompt but lost both "genuine emergency only" and "twice means the checker is wrong — fix the checker." STATUS § Built 2026-09-14 already flags two of these values as implementer-chosen, "owner to confirm or change."

**Five small ones, one line each.** (5) dropped M119, the gap list that stopped a unit calling itself profiled when nothing was — a claims rule, not a per-site duty. (4) dropped M220, "a case added to each broader test that covers it," on a note that conflates hooks *running* the broader suite with something *adding* to it. (11) lost M222 — run the whole suite, never truncate its output — which no decision it cites actually speaks to. The agents pool ruling dropped M35's directory ownership, while the shipped skill still allows different kinds to run at once. (49) deleted the claims walker, and the recalibration's own corrections file names that deletion as why the M518 mechanism failure went unseen.

**What this cannot tell you:** it shows what each decision cost in the rules' own words, not whether the loss has bitten yet — a retired rule nobody has missed looks identical here to one being quietly violated every day.

---

## Flagged for a second look

### (19)

> (19) The invariant auditor moves to unbreakable, the plugin that holds the knowledge it applies: `agents/invariant-auditor.md`, the `invariant-audit` skill (+ `audit-diff.mjs`), and the enforcement-ledger rules (design-invariants § Weak claims and the enforcement ledger). They are Claude-Code-specific, so they go in `claude-code/unbreakable/` (not `pure-prose/`) plus `plugins/unbreakable/agents/`. Decided 2026-09-13; the move happens when unbreakable is worked. The machinery rewrite leaves them out. Machinery's dependency on unbreakable is re-examined then.

**Amended later, and the amendment is what holds:**

> No amendment, but one later addition in STATUS.md bears on it: "Parked with unbreakable: A308 (invariant auditor's model tier — its file says "judgement tier", its output is verdicts, and it declares no `model:` so it runs on the dispatching session's model). Also noted for that topic: the auditor only assesses invariants stated in comments/doc comments or ledger rows, only within a supplied diff, and cannot compile a bypass attempt."

**Moved 56 row(s)** — parked 54, dropped 2 (no row survived under this decision). **Retired 56.**

**What the project no longer has:** The project no longer has a can't-break-by-design mandate on every design decision, a pre-merge invariant audit whose findings must each be dispositioned before the merge, an enforcement ledger with rules for how its rows are anchored and reviewed, or any line telling a project to install the unbreakable plugin — 54 rules were parked into a holding folder nothing reads, on the condition "the move happens when unbreakable is worked", which has not happened.

**Why this deserves a look:** Three things. (a) The decision's own words scope it to the auditor, the invariant-audit skill and the enforcement-ledger section, but it was used to park the whole design-invariants mandate, including M49 ("The `cant-break-by-design` skill is mandatory: it is invoked for every design decision and every code path") and M50 — the mandate is not the auditor. (b) It is a deferral, not a deletion: the material sits in docs/parked/for-unbreakable/, plugins/unbreakable/ has skills but no agents/ directory, and grep over the whole shipped machinery (skills, core.md, README, banner.mjs) finds no mention of unbreakable, cant-break-by-design, the auditor or the ledger — so the pre-merge audit (M333) and the "install unbreakable alongside this one" dependency (M484, M487) are simply gone in the meantime. (c) The two DROPPED rows are collateral, not parked: M145's rule about sending each rule to the home its kind belongs in, and M274's requirement that an effort's repeated documentation work happen in one commit after the last coding task and before the merge gate (M274 is arguably moot now that registers, ledger prose and long reports are all gone). Nothing in decision 19 speaks to either rule; both were dropped under 19 in combination with 1/2/10 and the Reports ruling.

<details><summary><code>M49</code> — parked → unbreakable (future claude-code/unbreakable/); the file now sits unloaded at docs/parked/for-unbreakable/rules/design-invariants.md</summary>

```
- The `cant-break-by-design` skill is mandatory: it is invoked for every design decision and every code path, in any language, not consulted when someone remembers it. Its rule is the one every other hard rule here is an instance of — every design decision makes the bad state structurally impossible rather than forbidden by a rule someone has to remember, by a mechanism and never by a prose "must".
```

</details>

<details><summary><code>M50</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
- The strength rating measures only how hard a rule is to bypass. Whether the rule is the right rule is a separate question, checked separately.
```

</details>

<details><summary><code>M57</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
- Any tool that judges enforcement strength carries the published scale with it, so it never judges without it.
```

</details>

<details><summary><code>M58</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
- An entry in the ledger anchors on a named thing, never on a line number: a line that moves fails silently, a name that changes fails loudly. Where a claim has no name of its own, name the thing enclosing it or quote the line word for word. The wrong form is refused mechanically, so there is nothing left to flag by eye.
```

</details>

<details><summary><code>M59</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
- Continuous review of the ledger runs on request or after a merge, never on every commit.
```

</details>

<details><summary><code>M60</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
- It writes only the ledger, and only when its run was clean.
```

</details>

<details><summary><code>M61</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
- Flag anything at all that can fail catastrophically on absence. The sweep is unbounded, not limited to the sites someone already suspects.
```

</details>

<details><summary><code>M145</code> — dropped</summary>

```
- Send each rule to the home its kind belongs in: working-agreement rules to the rule file for their group, design rules to the specification that owns that subsystem, and claims about how strongly something is enforced to the enforcement ledger — declared beside the mechanism itself, never hand-typed into a generated file.
```

</details>

<details><summary><code>M274</code> — dropped</summary>

```
- In an effort of several tasks on one branch, the repeats each task would otherwise carry — re-marking the living maps, the invariant and register rows, the ledger prose, and the long report — are done once, in a single documentation commit after the last coding task and before the merge gate.
```

</details>

<details><summary><code>M333</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
Before merging, consider dispatching the enforcement auditor (`agents/invariant-auditor.md`) with the effort's diff. It cannot run commands, so hand it the diff text or the list of changed files — `/machinery:invariant-audit` does both mechanically.
```

</details>

<details><summary><code>M343</code> — parked → unbreakable (future claude-code/unbreakable/); now docs/parked/for-unbreakable/skill-source/invariant-audit/SKILL.md</summary>

```
Use when asked to run the invariant audit, audit the invariants, audit this diff or branch, or before merging an effort. Exports the current branch diff with audit-diff.mjs, dispatches the read-only machinery:invariant-auditor agent on it, relays findings unchanged, and requires each dispositioned before merge.
```

</details>

<details><summary><code>M344</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
1. **Run the export**, from inside the working copy being audited:
```

</details>

<details><summary><code>M345</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
The script fails closed — no repo, no real base, or an empty diff each exit non-zero and write nothing — and that failure is the whole answer: there is nothing to audit yet.
```

</details>

<details><summary><code>M346</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
2. **Dispatch the `machinery:invariant-auditor` agent** with the Agent tool. It is a review kind of task: one at a time, never alongside another reviewer (`rules/agent-topology.md` § How many at once). Hand it exactly: the diff file's path, the changed-file list from step 1, the working copy's path, and where the enforcement ledger lives — a project states its own location; for this plugin it is `docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md` § Invariant ledger. The agent cannot run commands, edit, or write (`agents/invariant-auditor.md`), so never ask it to.
```

</details>

<details><summary><code>M347</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
3. **Relay its findings in the fixed shape it returns them in, unchanged.** Claim, implied strength, delivered strength, and what to do — copied, not summarized down to a verdict.
```

</details>

<details><summary><code>M348</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
4. **Disposition every finding by name before any merge**: fixed now, declined with the owner's stated reason, or filed as its own follow-up ticket pair. A "not clean" verdict with even one undispositioned finding blocks the merge outright.
```

</details>

<details><summary><code>M349</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
5. The rules behind this are `rules/design-invariants.md` § Weak claims and the enforcement ledger, and `rules/verification-and-evidence.md` § What the check could actually see. Read them there; this skill does not restate them.
```

</details>

<details><summary><code>M438</code> — parked → unbreakable (future plugins/unbreakable/agents/); now docs/parked/for-unbreakable/agents/invariant-auditor.md</summary>

```
Audits a diff against the mandatory can't-break-by-design ladder — rates each invariant claim's stated strength against its real mechanism, returns findings in a fixed shape and a ledger delta. Dispatch before merging an effort.
```

</details>

<details><summary><code>M439</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
Bugs, style, naming and performance are out of scope unless they *are* the mechanism failure — name such a thing in a line and move on.
```

</details>

<details><summary><code>M440</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
Comparing an output against a reference implementation's belongs to the comparison agent (`agents/comparison-agent.md`); hand that off and do not duplicate its checks.
```

</details>

<details><summary><code>M441</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
The caller supplies either the diff text or the list of changed files.
```

</details>

<details><summary><code>M442</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
Given neither, it says exactly that and stops — it never audits the whole codebase as a substitute, and never guesses the scope from timestamps or file contents.
```

</details>

<details><summary><code>M443</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
A run with no scope is a blocked run, reported as such; a partial sweep is never offered in place of a verdict.
```

</details>

<details><summary><code>M444</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
**Model:** the tier used for judgement work, per `rules/agent-topology.md`.
```

</details>

<details><summary><code>M445</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
**The scale it rates against** is the enforcement ladder in the mandatory `cant-break-by-design` skill, together with that skill's standing catalog of ways a claim outruns its mechanism. Both live in the skill and are not restated here or anywhere else; the auditor works from the skill itself, and never rates without it.
```

</details>

<details><summary><code>M446</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
1. **Read the enforcement ledger first**, loading only the parts covering what changed. The ledger holds *claimed* invariants — properties the source asserts to a reader. A property that is true but was never stated is not a row, and the auditor must not invent one.
```

</details>

<details><summary><code>M447</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
2. **For each changed region, find the claim.** Search that file and its surroundings for the vocabulary of assertion: by construction, invariant, must never, guaranteed, always, sole, only route, caller must, precondition, assumes. The claim is whatever the source promises a reader.
```

</details>

<details><summary><code>M448</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
3. **Rate the mechanism, not the sentence.** Read the constructor, the field visibility, the unit boundary. What the prose implies and what the mechanism delivers are two different ratings, and the gap between them is the finding.
```

</details>

<details><summary><code>M449</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
4. **Run the second-call-site tripwire as an explicit step.** If the change performs a required step at a second call site, the design is already wrong: the answer is a single route, not a second correct call.
```

</details>

<details><summary><code>M450</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
5. **Run the weak-neighbour obligation as an explicit step.** Touching code next to a weakly held invariant obliges either the promotion or a new ledger row recording the deferral. Debt is allowed; silent debt is not, so a change that leaves a weak invariant weak and records nothing is itself a finding. Both this obligation and the ledger's own form are in `rules/design-invariants.md`, under weak claims and the enforcement ledger.
```

</details>

<details><summary><code>M451</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
6. **Always flag the catalog shapes**, each flag citing a comparable live example, so a finding is a pattern with evidence rather than an opinion.
```

</details>

<details><summary><code>M452</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- **The claim** — quoted in the source's own words, with its location.
```

</details>

<details><summary><code>M453</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- **The strength the prose implies.**
```

</details>

<details><summary><code>M454</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- **The strength the mechanism actually delivers**, with the specific reason for the gap.
```

</details>

<details><summary><code>M455</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- **What to do** — either the concrete change that reaches the top of the scale, or the exact ledger row to add instead.
```

</details>

<details><summary><code>M456</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
Order findings by severity.
```

</details>

<details><summary><code>M457</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
Substantiate each from a file actually read; where the deciding code was not opened, report the rating as **unverified** rather than inferring it from a name.
```

</details>

<details><summary><code>M458</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
A finding is a suspicion until a person has read the code and recorded a confirmation naming the exact place — the audit never authorises a change by itself.
```

</details>

<details><summary><code>M459</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
Close with the **ledger delta**: which entries this change makes stale, and which it should add.
```

</details>

<details><summary><code>M460</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
A clean audit is a useful result and is stated in one line. It is never padded into a report.
```

</details>

<details><summary><code>M461</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The denominator of an audit is generated from the material itself, so it is reproducible rather than asserted. It lists every entry the audit is obliged to dispose of.
```

</details>

<details><summary><code>M462</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The first half is every stated claim: a comment on something public whose words assert an invariant. Of each the audit asks one question — is there a mechanism, or only the sentence?
```

</details>

<details><summary><code>M463</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The second half is the obligation shapes: patterns in the code that carry an invariant obligation whether or not anybody ever stated one. Of each the audit asks two questions — is it stated, and is it enforced?
```

</details>

<details><summary><code>M464</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The standing obligation shapes are: a field whose documentation names a sibling field; the same fact stored twice, such as a count kept beside the collection it counts or a value kept beside a variant of itself; a record holding a kind alongside fields meaningful for only some of those kinds; a comparison against a magic value or a domain value clamped at zero; taking the first or last element of a collection with a call that fails when it is empty, where nothing proves it is not; a quantity carried as a raw number where a dedicated type already exists; a public function with two or more adjacent parameters of the same simple type, which a caller can transpose without complaint; public methods that begin, initialise, set, finalise, end or reset something mutable, a required order that nothing enforces; and a call whose result is thrown away or quietly replaced by a default, so a failure has nowhere to be seen.
```

</details>

<details><summary><code>M465</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- Test code inside the shipped units is excluded as not being the shipped surface, but dead or test-only code found outside it still gets an entry and is dispositioned like any other. Nothing is silently dropped from the denominator.
```

</details>

<details><summary><code>M466</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The generator is deterministic: anything unordered is sorted before it reaches the output. Otherwise the same input produces different evidence on different runs, which destroys regenerate-and-compare — the verification the whole artifact rests on.
```

</details>

<details><summary><code>M467</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The generator sanitises its own evidence text at the point of writing, so one entry can never break into two rows and make the file's line count disagree with the entry count.
```

</details>

<details><summary><code>M468</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The audit table is checked structurally: every row has the declared number of columns, every identifier is unique, and every identifier exists in the denominator. The check prints the row count, the denominator and how many entries remain.
```

</details>

<details><summary><code>M469</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- Every actionable finding lands in exactly one fix, and that is asserted mechanically. A fix then cannot be quietly dropped from the work list while its findings stay open in the ledger.
```

</details>

<details><summary><code>M470</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- Two artifacts with two jobs: the table is the ledger, dispositioning every entry and proving nothing was skipped; the fix list is the work list, deduplicated so one remedy appears once instead of once per finding.
```

</details>

<details><summary><code>M471</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The one judgement call in the report — the order of the fixes, by consequence — is labelled as a judgement call. Everything else, the memberships and the counts, is derived mechanically.
```

</details>

<details><summary><code>M472</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- Findings already enforced, and findings retired as not really invariants, are reported as counts and left out of the work list. They are dispositioned, not deleted.
```

</details>

<details><summary><code>M473</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- A shape whose detector cannot yet tell a real obligation from a false positive is declared blocked, with the detector work named as the prerequisite. Its entries are not called fixes and not called false positives until that runs.
```

</details>

<details><summary><code>M474</code> — parked → unbreakable (future plugins/unbreakable/agents/)</summary>

```
- The report states what the method cannot see: invariants nobody ever wrote down that match none of the shapes. It also says row counts are not effort, because a large mechanical fix and a small user-visible one look the same in a count.
```

</details>

<details><summary><code>M484</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
The commit gate assumes invariants are enforced the way `cant-break-by-design` describes (unrepresentable-by-construction, not caller discipline) — install the `unbreakable` plugin alongside this one.
```

</details>

<details><summary><code>M487</code> — parked → unbreakable (future claude-code/unbreakable/)</summary>

```
NOT FOUND — install the unbreakable plugin
```

</details>

### (24)

> - (24) The design rules (machinery `design-invariants.md`, drafted as `draft/skills/design`) are parked with unbreakable, 2026-09-13. The machinery rewrite does not ship a design skill; the draft stays as input for the unbreakable work.

**Amended later, and the amendment is what holds:**

> NONE. (Related but separate: "- (19) The invariant auditor moves to unbreakable … Decided 2026-09-13; the move happens when unbreakable is worked. The machinery rewrite leaves them out." — 19 moves the auditor and the enforcement ledger; 24 parks the rest of design-invariants.md.)

**Moved 46 row(s)** — parked 46. **Retired 46.**

**What the project no longer has:** The whole of design-invariants.md — 46 rules covering where a distinguishing type is created, never re-deriving a fact, one authority per switch, absence and defaults, the three classes of setting, external input never crashing the product, handing a resource on, telling the user what you dropped, wiring honesty, reading someone else's data model, spatial output, and native language conventions — no longer exists anywhere the assistant reads; it survives only as a draft file inside the recalibration folder.

**Why this deserves a look:** The park was conditional ("the move happens when unbreakable is worked") and that move has not happened: grepping the live plugin trees for phrases from these rules finds none of them in plugins/unbreakable/skills/{be-reasonable,cant-break-by-design}/SKILL.md. So today the destination is empty and the rules are simply absent. More to the point, a large minority of the 46 are not invariant-design theory that only unbreakable would want — M87 (external input never crashes the product), M96–M100 (anything dropped, clamped or never read is said where the user sees it; warn, do not fail), M118 (warnings come back in the result), M103–M106 (never narrow someone else's data model), M122 (keep the language's native conventions) are general product-correctness guardrails that applied to any code machinery governs. Evidence they were live working knowledge two days ago: plugins/machinery/scripts/lib/reload.mjs:25 still carries the comment "external input never crashes the tool, and what was dropped is named where the user sees it" — the rule is being followed by hand with nothing stating it. Worth a decision on whether some of these belong back in machinery rather than waiting on an unbreakable campaign with no date.

<details><summary><code>M51</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- A distinguishing type is only as strong as the place it is created. Wrapped by hand at each call site, two adjacent wrappings can be swapped and the type catches nothing. Create it at the authority that reads the source of truth, so the source, the direction and the type are declared in one place.
```

</details>

<details><summary><code>M52</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- When the place that creates such a type and the place that consumes it do not depend on each other, the type goes in a shared vocabulary unit with no dependencies of its own. Making one depend on the other pays for the invariant with whatever property that unit was built to have.
```

</details>

<details><summary><code>M53</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Field privacy is a wall around the enclosing unit, not around the type: while the type is declared inside a large file, everything in that file can still build one directly. Move it into its own unit, and keep it there with a check over the source, because moving it back out compiles perfectly and no compiler will report it.
```

</details>

<details><summary><code>M54</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- An automatically generated constructor is a public constructor, and the quieter one: a generated empty value builds one from anywhere, and a generated decoder fills every private field from untrusted text — while nothing in the declaration looks wrong to a reader checking field visibility. Block both with a private marker member whose own type supports neither, and keep a source check, because deleting that one line compiles.
```

</details>

<details><summary><code>M56</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Definitions that could be loaded at run time are compiled in instead, so there is no path by which a different set arrives later.
```

</details>

<details><summary><code>M62</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- A fact is computed once, at the place that owns it, and everything else reads it. Nothing downstream recomputes its own opinion of a fact that already exists, because a second derivation will eventually disagree with the first, and that disagreement arrives looking exactly like a defect.
```

</details>

<details><summary><code>M63</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- In a stored or transmitted format, the producer states the fact outright. If a consumer has to infer it by arithmetic, the format is wrong: it has forced the same re-derivation on every reader, forever.
```

</details>

<details><summary><code>M65</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- A classification made where the data is produced is authoritative, and everything downstream carries it forward. Consumers never classify the same thing again for themselves.
```

</details>

<details><summary><code>M70</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- The process environment is a fact like any other: every switch is resolved once, at one authority per unit, and everything inside reads a field. The switch's name appearing anywhere else in that unit is a defect. How often it is read is not the criterion; where it is read is.
```

</details>

<details><summary><code>M72</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Reading a field is not always the whole fix: where a switch decides something per item, choose the path once outside the loop so the branch disappears entirely. A cached read still costs a test per item, and that was explicitly rejected as good enough.
```

</details>

<details><summary><code>M73</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- One authority per unit is where a switch starts, not permission to claim a name another unit already owns. A switch two units honour is resolved in the one that owns the fact it arms, and the others read the resolved value as data. Reading it is not re-deriving; parsing the name a second time is.
```

</details>

<details><summary><code>M74</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- A per-unit check cannot see a name duplicated across units, so a shared name is spelled once as one shared definition, and a project-wide check walks every unit and fails on a second spelling.
```

</details>

<details><summary><code>M75</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- A table that mirrors where something is emitted is checked mechanically, or it is not a table but a claim: gone stale, it tells an operator to turn on something that will never fire — the exact silence it existed to prevent. One shared check per unit, plus a project-wide sweep, so a unit that grows such a table and never opts in is still covered.
```

</details>

<details><summary><code>M77</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- A category, flag or case can be used to smuggle information that really wants a channel of its own. Before adding or removing one, ask what it was actually carrying.
```

</details>

<details><summary><code>M78</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- The ban on stand-in values covers a legal value made to stand for a different concept; it never covers a collection's own emptiness.
```

</details>

<details><summary><code>M79</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Which of the two shapes absence takes is fixed by the setting's class, not by the author's taste: an optional is reserved for the case where absence is the signal.
```

</details>

<details><summary><code>M80</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- An empty collection used as a default is not a stand-in value: a magic number meaning "inherit" smuggles a different concept inside a legal value, whereas an empty list decoding to zero elements simply is the value. One question separates them: does absence mean inherit another setting's value, or zero elements of this setting's own collection?
```

</details>

<details><summary><code>M81</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- If absence means inherit another setting's value, declare no default at all, ever. A fabricated default there silently severs the inheritance, which is the exact damage this rule exists to prevent.
```

</details>

<details><summary><code>M82</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- If absence means zero elements of that setting's own collection, declare the empty value as its default, matching the reference format's own empty defaults. Where the definitions are themselves declared in a table the build checks, withholding it makes that table fail to build, which is the mechanism doing the enforcing rather than a reviewer.
```

</details>

<details><summary><code>M83</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- This is not "give everything a default". Filling one in everywhere is a regression, not a fix, because it silently severs every setting whose absence meant inherit.
```

</details>

<details><summary><code>M84</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- First class, a value someone sets directly: it declares a default, its accessor returns a plain value, and its absence is impossible by construction — not merely believed because some other table happens to carry a matching row today.
```

</details>

<details><summary><code>M85</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Second class, a value computed from others and never authored directly: no fixed default means anything for it, and its accessor never falls back to a raw lookup of something that was never meant to hold a stored value.
```

</details>

<details><summary><code>M86</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Third class, an optional override — also free text, actions and templates: no default, the accessor returns an optional value, and the caller decides. Here absence is the signal, not a gap.
```

</details>

<details><summary><code>M87</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- External input never crashes the product. A malformed or truncated file, a hand-edited settings file, another product's configuration, a bad command-line flag: all of these are data, not your own invariant failing, and they produce a diagnostic the user sees.
```

</details>

<details><summary><code>M88</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Once a stage consumes a resource, that resource is permanently removed from what any later stage can receive. The same resource reaching two consuming stages is a defect class that keeps recurring, and this is the rule that finds it.
```

</details>

<details><summary><code>M89</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- The removal happens before anything downstream is derived from what remains. The ordering is part of the rule, not an implementation detail.
```

</details>

<details><summary><code>M90</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- The two ways a stage can decline a resource are different events and never share a word: giving back a claim it never exercised, and passing on what it could not use of a claim it did.
```

</details>

<details><summary><code>M91</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- A stage that declines a claim it never exercised — nothing produced, nothing yet derived downstream — returns the resource to its original owner as if it had never been taken, at most once per site, after which it flows through the normal division again. The pipeline is the router; the origin holds no routing knowledge of its own.
```

</details>

<details><summary><code>M92</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- What is left over from a claim the stage did exercise never travels backward. It goes forward to the one successor the design names at that boundary, recorded as it goes, and the chain ends either in use or in a declared, warned discard.
```

</details>

<details><summary><code>M93</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Every declined resource has exactly one named recipient. None is a silent void; two is a double write.
```

</details>

<details><summary><code>M94</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- What gets removed is exactly what the stage actually produced, or formally claimed, never a recomputed equivalent. Diagnostics and remainders alike observe the real thing.
```

</details>

<details><summary><code>M95</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- The first question in an audit is which two stages both received the same resource. It has a lookup answer, because every decline site's recipient is named in the design — and a census can only ever see the collision, never the handover that caused it.
```

</details>

<details><summary><code>M96</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Anything the user gave you that gets dropped, ignored, skipped, clamped, substituted or never read is said where they will see it. Silence reads as success.
```

</details>

<details><summary><code>M97</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Never having tried counts. Taking part of what a file contains and quietly discarding the rest still needs saying: having no reader for something yet is a warning, not an exemption from one.
```

</details>

<details><summary><code>M98</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Warn, do not fail. The operation still succeeds and the user judges the degraded result for themselves; they simply cannot judge it blind.
```

</details>

<details><summary><code>M99</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- The bar is the user's expectation, not your documented contract. A value clamped to something inside the allowed range is still not the number they typed.
```

</details>

<details><summary><code>M100</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- The model to copy is a per-source report listing what was not recognised, what could not be translated and what was clamped — plus a standing notice for anything carried through word for word and never interpreted, because the product cannot vouch for it.
```

</details>

<details><summary><code>M101</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- A field counts as implemented once its storage, its default and its wiring into the central hub exist. Whether anything downstream consumes it is a different question, and not part of this one.
```

</details>

<details><summary><code>M102</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- That does not relax the separate honesty rule about downstream consumption: something can be fully wired into that central hub and still owe work further along. Both facts are tracked, and neither is allowed to hide the other.
```

</details>

<details><summary><code>M103</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Never narrow a reference format's collection type to a single value because it obviously holds only one. That is a judgement call about someone else's data model, and those lose. The schema describes their format, not your reader, and narrowing it silently drops data on a round trip.
```

</details>

<details><summary><code>M104</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- If you cannot read the collection form yet, write an accessor that could, or record the gap. Never write a schema that lies in order to flatter your reader.
```

</details>

<details><summary><code>M105</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- An accessor keeps the name the source format uses, even when it returns a collection. Plurality lives in the type, not in a private vocabulary you invented.
```

</details>

<details><summary><code>M106</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Judge whether a value is one or many against the data model actually in front of the reader, not the name of the type upstream. Where the store has already reduced a key to one value per owner and routes it to the owner it belongs to, the plurality lives in that routing, and reading it as a single value is the plural-correct read; reading it as a collection returns nothing on every load and lets a fallback win instead.
```

</details>

<details><summary><code>M109</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Position encodes relationship: a control sits next to the thing it acts on, inside the same visual group, and moves with it. Its scope should be inferable from where it is alone, and unrelated content never comes between them.
```

</details>

<details><summary><code>M118</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Whatever a computation warns about comes back as part of its result, never as a separate optional output. A separate one lets a caller hand it somewhere disposable and drop the warning without anybody noticing.
```

</details>

<details><summary><code>M122</code> — parked → unbreakable (future); draft kept as docs/learnings/recalibration-2026-09/draft/parked-unbreakable/design/SKILL.md</summary>

```
- Never replace the base programming language's own convention — zero-based indexing, its native ordering, its own numbering — to match a presentation-layer feature. A presentation requirement, such as a 1-based id shown to a user or a reference format's own 1-based numbering, converts once at the boundary that produces it — the persisted format, the display — and internals keep the language's native convention throughout.
```

</details>

### (10)

> (10) keep capture hook + inbox gate, drop register/index/supersession/status marks  [from the "Yes:" list under § Principle decisions (2026-09-13)]. Restated later in the same section: "Rule process stays enforced through git hooks (capture + inbox gate on commit); the register (RULES_INDEX.md) and its reindex-on-commit check go."

**Amended later, and the amendment is what holds:**

> NONE in STATUS.md. Two later rulings changed rows filed under it: (49, owner 2026-09-14) deleted the gate's claims mechanism outright, and #108 (merged b5fa4ff, 2026-09-16) inverted M141 — "an unmarked conversational ruling is not captured — it is handed back for the marker".

**Moved 54 row(s)** — dropped 30, mechanism 15, skill 6, merged 3. **Retired 30.**

**What the project no longer has:** The rule register is gone entirely — no index of where rules live, no citation discipline, no per-group statement of what the group is about or how strongly it is enforced, no status marks, no completeness check on a filing — and supersession went with it, so there is now no way to retire a standing rule and no rule saying that retiring one of the owner's rules is his call, not the assistant's.

**Why this deserves a look:** Decision 10 names "supersession" among the things to drop, but it reads as a companion to dropping the register, and M155 is not register machinery: "Supersession is the owner's call whenever the losing rule was theirs. Propose it; never decide it." With supersession gone and universal rules now filed as dated bullets appended to ~/.claude/rules/universal.md, a later rule that contradicts an earlier one simply sits beside it with no defined resolution, and nothing states whose call a retirement is. The rule-process skill's surviving line covers only filing ("a rule you think of yourself is a proposal to the owner"), not retiring. M161 is worth a second look for the same reason — it is the rule that forced the honest "nothing enforces this" admission, which is exactly what the four audits could not check.

<details><summary><code>M144</code> — dropped</summary>

```
- The register cites; it never originates. Write the rule in its home first,
then add the row that cites it. A rule that exists only in the register has no
home.
```

</details>

<details><summary><code>M146</code> — dropped</summary>

```
- Cite a rule file by section, never by line number. A line number names a
position, and any edit above it silently moves what the row points at.
```

</details>

<details><summary><code>M147</code> — dropped</summary>

```
- A change that adds, changes or supersedes a standing rule updates the register
in the same commit as the rule's own home.
```

</details>

<details><summary><code>M151</code> — dropped</summary>

```
- A contradiction is recorded as an unsettled question that has now been
decided: write the verdict into the group's own account of the disagreement
and update its status mark.
```

</details>

<details><summary><code>M155</code> — dropped</summary>

```
- Supersession is the owner's call whenever the losing rule was theirs. Propose
it; never decide it.
```

</details>

<details><summary><code>M156</code> — dropped</summary>

```
- When one rule supersedes another, stamp both directions in the same commit:
the retired document points at the group that replaced it, and the new row
names what it supersedes. The old text is never rewritten in place.
```

</details>

<details><summary><code>M158</code> — dropped</summary>

```
- Run the complete register check before calling a filing done. The cheap
commit-time subset is not the whole check, and what it skips is exactly what a
bad filing looks like.
```

</details>

<details><summary><code>M159</code> — dropped</summary>

```
- Every group says in plain words what its rules have in common and, where the
team changed its mind, what the disagreement was about and how it ended.  [cited as "1, 2, 10"]
```

</details>

<details><summary><code>M160</code> — dropped</summary>

```
- Only a real decision moves a group's status mark to settled: the owner's
ruling, or a change that lands and settles the question. Nothing else upgrades
it.
```

</details>

<details><summary><code>M161</code> — dropped</summary>

```
- Every group states how strongly its rules are actually enforced, naming the
mechanism where one exists and saying plainly that nothing enforces it where
none does.  [cited as "1, 2, 10"]
```

</details>

<details><summary><code>M167</code> — dropped</summary>

```
- Editing a rule-bearing document while the register sits untouched prints a
reminder to update the register in the same commit. It is advisory and never
blocks.
```

</details>

<details><summary><code>M170</code> — dropped</summary>

```
- Say where the register's rows came from. If no provenance record exists, do
not write one by hand — generate it from version-control history or do
without it.
```

</details>

<details><summary><code>M171</code> — dropped</summary>

```
- Where a citation still names a line, that line must point at real content. A
citation landing on a blank line is not a weak citation, it is no citation.
```

</details>

<details><summary><code>M274</code> — dropped</summary>

```
- In an effort of several tasks on one branch, the repeats each task would otherwise carry — re-marking the living maps, the invariant and register rows, the ledger prose, and the long report — are done once, in a single documentation commit after the last coding task and before the merge gate.  [cited as "10, 19, Reports ruling"]
```

</details>

<details><summary><code>M373</code> — dropped</summary>

```
Use when a generated index is reported stale (the post-edit nudge, or the commit gate) after a rule file or a dictated specification was edited by hand. Regenerates either index — the rules index (RULES_INDEX.md) or the spec index (SPEC_INDEX.md); never edit one directly.
```

</details>

<details><summary><code>M374</code> — dropped</summary>

```
- Project: `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --rules .claude/rules --out .claude/machinery/RULES_INDEX.md`
```

</details>

<details><summary><code>M375</code> — dropped</summary>

```
- Universal (in the rules-source checkout): `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --rules rules --out register/RULES_INDEX.md`
```

</details>

<details><summary><code>M376</code> — dropped</summary>

```
- Specs, project (the index sits with the other generated index, not with the specifications it indexes): `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --kind specs --rules docs/dictated-specs --out .claude/machinery/SPEC_INDEX.md`
```

</details>

<details><summary><code>M377</code> — dropped</summary>

```
- Specs, universal (in the rules-source checkout): `node "${CLAUDE_PLUGIN_ROOT}/scripts/reindex.mjs" --kind specs --rules docs/dictated-specs --out register/SPEC_INDEX.md`
```

</details>

<details><summary><code>M378</code> — dropped</summary>

```
Commit the regenerated index together with the rule change that made it stale.
```

</details>

<details><summary><code>M389</code> — dropped</summary>

```
3. **Supersession:** if the rule replaces an existing section, add a `supersedes` entry to the new home's frontmatter (`section`, `by`, `date`); the index derives the reverse link.
```

</details>

<details><summary><code>M479</code> — dropped</summary>

```
Each has a generated index (`register/RULES_INDEX.md` for universal,
`.claude/machinery/RULES_INDEX.md` for project) — never edited by hand, regenerated by
`/machinery:reindex` — and an inbox (`inbox.md` beside the universal rules,
`.claude/machinery/inbox.md` for a project) that holds captured entries until
intake files them.
```

</details>

<details><summary><code>M494</code> — dropped</summary>

```
machinery: the index is stale after editing ${file} — intake regenerates it; or run /machinery:reindex
```

</details>

<details><summary><code>M499</code> — dropped</summary>

```
index comparison(s) failed — ${from} is the pre-#81 name; the index is now ${to}. Run /machinery:install to migrate it (it renames the file and stages both sides)
```

</details>

<details><summary><code>M500</code> — dropped</summary>

```
index comparison(s) failed — index not staged (generated but not added) — git add ${where}
```

</details>

<details><summary><code>M501</code> — dropped</summary>

```
index comparison(s) failed — index is stale — ${where} differs from a fresh regeneration; run /machinery:reindex
```

</details>

<details><summary><code>M504</code> — dropped</summary>

```
spec index comparison(s) failed — ${from} is where the spec index used to sit; it is now ${to}, beside the rules index. Run /machinery:install to migrate it (it moves the file and stages both sides)
```

</details>

<details><summary><code>M505</code> — dropped</summary>

```
spec index comparison(s) failed — spec index not staged (generated but not added) — git add ${where}
```

</details>

<details><summary><code>M506</code> — dropped</summary>

```
spec index comparison(s) failed — spec index is stale — ${where} differs from a fresh regeneration; run /machinery:reindex
```

</details>

<details><summary><code>M517</code> — dropped</summary>

```
${kind === 'specs' ? 'spec_check' : 'register_check'}: index is stale — ${out} differs from a fresh regeneration; run /machinery:reindex
```

</details>

**`M141` — what it required changed:**

- before: - A rule ruled in conversation without the marker is still written into the inbox by hand, with a note saying why the automatic capture did not fire.
- after: Inverted by #108 (2026-09-16), now in the rule-process skill: "An owner ruling given in conversation carries no marker, so nothing captured it and it is not a standing rule. Say that it reads like one and ask the owner to restate it with the marker. Never hand-write a rule into an inbox, `~/.claude/rules/`, or a project's `.claude/rules/`." Where the old rule required the assistant to rescue an unmarked ruling, the new one forbids it and hands the ruling back.

**`M157` — what it required changed:**

- before: - Close the loop on a captured rule by replacing pending with either where it was filed or why it is not a rule, and commit the rule's home, the register and the inbox together where they share a repository. A universal rule's home and its register row are in the shared skill while the entry that captured it is in the project, so the home and its row land together there and the disposition lands in the project in the same sitting, never left for later.
- after: Merged into M391 and now the rule-process skill's steps 4–5: a project filing commits the home and the disposition together (`intake.mjs commit`), and a universal filing "appends the dated bullet, dispositions the entry and names the file; there is nothing to build, bump or commit." The register leg is gone (decision 10) and the universal commit leg with it (decision 54).

**`M391` — what it required changed:**

- before: 5. **Commit the filing** (index regenerated, entry dispositioned, one commit in one repository; universal also bumps the plugin version): `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind project|universal --stamp <stamp> --home "<file> § <Heading>"`
- after: Same command minus the index regeneration; `--kind` is now `project|spec`, and a universal filing takes a separate `intake.mjs universal` path with no commit and no version bump (decision 54).

### (6)

> (6) "Before a feature, the agent starts the TDD cycle instead of writing a prediction: write a test, run it, see it fail — then write the code. The new failing tests state what will change; the existing tests, run by the hooks, show what was left alone. A refactor meant to change no behaviour says "no behaviour change" in its commit message. Design beliefs and invariants go in the spec when one exists, not in each ticket. No report restates predictions or confirms them one by one — the test results are the confirmation."

**Moved 11 row(s)** — dropped 9, merged 1, skill 1. **Retired 9.**

**What the project no longer has:** The project no longer requires a change to write down, before doing the work, what it will affect and what it must leave alone, nor to confirm those beliefs one by one afterwards — and with them went two rules that were not about predictions at all: that a "no output change" claim must be measured by producing and comparing the output, and that a change lists the checks it needs before running the first one so a first green cannot end the checking.

**Why this deserves a look:** Decision 6 is written entirely about predictions and prediction reports, but it was used to retire M200 and M204, which are verification guardrails that TDD red/green does not replace. TDD covers a change that writes a new test; it says nothing about a refactor or cleanup that adds no test, which is exactly the case M200 guarded ("a claim that output is unchanged is measured by producing the output and comparing it — it is never assumed") and exactly where M204's "a good result is the most dangerous place to stop" bit. The nearest survivor is core.md's measured/believed rule, which absorbed M204's phrase "what the check could actually see" but not its requirement to enumerate the checks up front.

<details><summary><code>M193</code> — dropped</summary>

```
- Every change writes down the beliefs that make its design and its choices
legitimate.
```

</details>

<details><summary><code>M194</code> — dropped</summary>

```
- Every change predicts what it will affect and, just as explicitly, what it
must leave alone. The second half is the one that can be proved wrong, so it
is the half that carries the information.
```

</details>

<details><summary><code>M195</code> — dropped</summary>

```
- Write the predictions before doing the work. Written afterwards they only
describe what happened; they were never able to fail.
```

</details>

<details><summary><code>M196</code> — dropped</summary>

```
- After the work, confirm each prediction one by one and say for each whether it
held. A blanket "everything passed" is not a confirmation.
```

</details>

<details><summary><code>M197</code> — dropped</summary>

```
- A prediction left unconfirmed means the work is not finished. It is not a
caveat and not a follow-up item.
```

</details>

<details><summary><code>M198</code> — dropped</summary>

```
- A prediction that fails is a result to report at full strength, not a mess to
tidy. Say explicitly which was wrong: the work, or the belief behind it.
```

</details>

<details><summary><code>M200</code> — dropped</summary>

```
- A claim that output is unchanged is measured by producing the output and
comparing it. It is never assumed.
```

</details>

<details><summary><code>M204</code> — dropped</summary>

```
- List the checks a change requires before running the first one, and let no
pass cancel another. A good result is the most dangerous place to stop,
because stopping then feels earned.
```

</details>

<details><summary><code>M330</code> — dropped</summary>

```
6. **Keep the effort's ledger as you go** — what you did, what changed, what
got better, what regressed, whether it worked, and what smells new. That
list is the `developer-friendliness` skill's § 6.4 Outcomes, which this
plugin depends on and which loads in every session; machinery's own
`rules/work-tracking.md` § The learnings record carries the rest — the
ledger ships with the effort, not after it, and every entry stands on its
own.  [cited jointly by decisions 7 and 6; also "developer-friendliness tabled"]
```

</details>

**`M199` — what it required changed:**

- before: - A change declares in advance which standard it is claiming: identical output, because it was meant to change nothing, or structural checks, because it deliberately changes behaviour. Calling a behaviour change a cleanup is how that standard gets dodged.
- after: Merged into M230 (refactor lands in two steps). The surviving requirement is decision 6's own sentence: a refactor meant to change no behaviour says "no behaviour change" in its commit message. The declaration is now a note in a commit message after the fact rather than a standard declared in advance, and the "structural checks" case — a change that deliberately changes behaviour declaring what it will be judged by — is no longer stated anywhere.

**`M262` — what it required changed:**

- before: - A full ticket has a fixed shape: the problem, the required behaviour as numbered items, the design constraint, the dated decision and who made it, the tests required, and the exact places in the code it touches.
- after: Kept in the tickets skill minus the design constraint: per decision 6, "Design beliefs and invariants go in the spec when one exists, not in each ticket." A ticket for work with no spec therefore records no design constraint.

### (5)

> Yes: … (5) drop per-function/per-site instrumentation duties, add when debugging or measuring

**Moved 10 row(s)** — dropped 5, skill 4, merged 1, parked 0. **Retired 5.**

**What the project no longer has:** The project no longer treats instrumentation as something every piece of code carries: no blanket duty, no ride-along retrofit when a change touches an uninstrumented site, no per-function profiling annotation, no "can this be interrogated in a year without editing code?" completion bar — and no gap list holding a unit that calls itself profiled to account.

**Why this deserves a look:** Four of the five drops are literally what the decision says and need no second look. M119 is not: it is not a per-function or per-site duty. It is a false-compliance guardrail — a unit that CLAIMS to be profiled must either instrument something or appear on a shrink-only gap list, and its second sentence warns that where the profiling tool is absent "that absence looks exactly like compliance". Decision (5) retires the obligation to instrument; M119 governs what may be CLAIMED once you stop. Retiring it under (5) is the decision reading wider than it is written, and this project has already been bitten by exactly that blind spot — draft/disposition-corrections.md records that decision (49) removed the gate's claims mechanism, so nothing now checks that a rule's destination carries what the ledger says it carries. The repaired core.md:4 ("say in the same breath where it does and does not run — an opt-in hook and a missing continuous check are both holes") covers part of M119's intent for claims generally, which is why this is worth a look rather than an automatic restore.

<details><summary><code>M110</code> — dropped</summary>

```
- All code carries full instrumentation and profiling capability, and new code
ships with it rather than acquiring it later.
```

</details>

<details><summary><code>M111</code> — dropped</summary>

```
- Existing code gains instrumentation organically: whenever a change touches a
site that lacks it, that change adds it. There are no retrofit sweeps, because
the work rides along with changes that were happening anyway.
```

</details>

<details><summary><code>M112</code> — dropped</summary>

```
- Every non-trivial function a change adds or touches gets the profiling
annotation in that same change, so the performance record sees it without a
second pass over the code.
```

</details>

<details><summary><code>M115</code> — dropped</summary>

```
- The bar is one question: when this site misbehaves a year from now, can it be
interrogated without editing code? If not, the change is not done.
```

</details>

<details><summary><code>M119</code> — dropped</summary>

```
- A unit that declares itself profiled either instruments something or is named
on a declared gap list that may only shrink. Where the profiling tool is
simply not present the instrumentation rule cannot be enforced at all, and
that absence looks exactly like compliance.
```

</details>

**`M113` — what it required changed:**

- before: - Every new decision site gets a diagnostic switch or trace row that is inert until turned on, and it states its denominator in the output, prints explicit zeros rather than omitting them, matches its shape to the question being asked, and ships a positive control.
- after: plugins/machinery/skills/instrumentation/SKILL.md:10 — "A new diagnostic switch is inert until turned on, prints its denominator and explicit zeros, matches its shape to the question being asked, and is added to the project's diagnostics index in the same change." The rule now fires only when a switch is being added, not at every new decision site; the positive control is gone; M114's index-registration duty was folded in. The "matches its shape" clause was missing on first ship despite the ledger note claiming "switch shape kept", and was restored by #114.

### (4)

> (4) Tests for a safeguard (a type that rejects bad values, a source-scanning check, a debug switch) are written by the change that creates or modifies it, and only that change; a change that only uses it tests its own new behaviour. The agent tells which case from its own diff (no memory). The safeguard's tests stay in the repo and the hooks keep running them. Replaces per-use re-proving (e.g. a positive control at every site using a debug switch, a test-data generator per fix).

**Moved 16 row(s)** — skill 10, merged 3, dropped 3, parked 0. **Retired 3.**

**What the project no longer has:** The project no longer requires a fix to ship a test-data generator, no longer requires a new unit of code to add a case to each broader test that already covers its area, and no longer requires a single-copy generator to prove itself by disturbing and restoring the real file.

**Why this deserves a look:** M220 — "and a case added to each broader test that covers it" — is the one that reads wrong. Decision (4) is about who writes a SAFEGUARD's tests and names exactly what it replaces (a positive control at every site, a test-data generator per fix); it says nothing about broader coverage. The co-cited decision (15) governs which tests the TDD CYCLE RUNS ("The cycle never runs broader tests"), not whether a broader test gains a case — and the ledger note repeats that conflation word for word: "Cycle never runs broader tests; hooks do". Hooks running the broader suite does not put a case in it. The shipped testing skill has no requirement that a new unit extend integration coverage. M279's drop is separately and correctly authorized: the TDD ruling forbids break-and-restore outright, and testing/SKILL.md:12 now says so in its own words.

<details><summary><code>M219</code> — dropped</summary>

```
something that
generates its test data,
[Extraction split one bullet into M218/M219/M220. The original bullet in plugins/machinery/rules/verification-and-evidence.md § Tests reads in full: "- Every fix and every new unit of code ships with its own test, something that generates its test data, and a case added to each broader test that covers it."]
```

</details>

<details><summary><code>M220</code> — dropped</summary>

```
and a case added to each broader test that covers it.
[Same bullet as M219. Decision cell "4, 15", note "Cycle never runs broader tests; hooks do". Original bullet in full: "- Every fix and every new unit of code ships with its own test, something that generates its test data, and a case added to each broader test that covers it."]
```

</details>

<details><summary><code>M279</code> — dropped</summary>

```
- A generator that leaves only one copy of anything must test itself against
that copy: disturb the real file, watch the check go red, restore it exactly,
and prove afterwards that the working tree is unchanged. Having no spare copy
is the point, not an obstacle.
```

</details>

**`M229` — what it required changed:**

- before: - A test that guards how an algorithm scales asserts the work it actually did, measured against what its input entitles it to, never a time limit. On a shared machine a stopwatch measures the machine, and cannot tell a busy one from an algorithm that got slower. A generous time limit may stay as a backstop against hanging, never as the verdict, and the work count ships with a positive control, because something that never ran satisfies any upper bound for free.
- after: The ledger recorded the positive control as satisfied "via TDD red"; the audit found no positive control shipped and that TDD red is not one. REPAIRED: plugins/machinery/skills/testing/SKILL.md:29 now requires "with a positive control" explicitly.

**`M113 (via decision 4's "positive control at every site" clause)` — what it required changed:**

- before: - Every new decision site gets a diagnostic switch or trace row that is inert until turned on, and it states its denominator in the output, prints explicit zeros rather than omitting them, matches its shape to the question being asked, and ships a positive control.
- after: plugins/machinery/skills/instrumentation/SKILL.md:10 — "A new diagnostic switch is inert until turned on, prints its denominator and explicit zeros, matches its shape to the question being asked, and is added to the project's diagnostics index in the same change." The positive control is gone (dropped by (4)) and the per-site trigger by (5).

### (Agents pool ruling)

> Agents: on-demand pool of one agent per kind, reused serially, reaped when context gets large. (STATUS.md § Owner rulings so far, line 29.)

**Moved 11 row(s)** — skill 7, merged 3, dropped 1. **Retired 1.**

**What the project no longer has:** The project no longer has any rule about file ownership between concurrently running agents: the directory-ownership guarantee that two agents cannot collide over the same file is gone.

**Why this deserves a look:** M35 was dropped on the note "One agent per kind: no parallel implementers", but the ruling itself never says agents do not run concurrently — the shipped skill keeps "Different kinds may run at once", so a work agent and a rule-filing agent can be writing at the same time with nothing left that assigns them disjoint files. The ruling reads narrower than the justification used to retire this row, and nothing replaced the collision guardrail. Cheap to restore as one line in skills/agents if the owner wants it.

<details><summary><code>M35</code> — dropped</summary>

```
- An agent doing implementation work in parallel with others owns exactly one
unit and writes only files inside it. Ownership is by directory, so two agents
cannot collide over the same file. (plugins/machinery/rules/agent-topology.md § Containment is structural)
```

</details>

**`M18 (absorbing M8, M10, M15)` — what it required changed:**

- before: "Dependent tasks go to one agent in sequence; a fresh agent per task is the exception, and the dispatch that uses it says so." plus "One agent at a time within a kind of task" and "Dispatch one, wait for it, check its result, and only then dispatch the next of that kind."
- after: "Reuse a kind's agent for every task of that kind, one task at a time, dependent tasks included. Different kinds may run at once." (skills/agents/SKILL.md § The pool). The default inverts: a fresh agent per task was the norm-with-exception, now reuse of the standing agent is the rule, plus a new duty — "When an agent's context grows large, stop it and start a fresh one for that kind."

### (11)

> - Yes: (1) always-on core ≤ 15 lines, rest in skills loaded by kind; (2) one skill per kind; (5) drop per-function/per-site instrumentation duties, add when debugging or measuring; (8) one ticket per work item, companion entry only for multi-session efforts; (10) keep capture hook + inbox gate, drop register/index/supersession/status marks; (11) each check runs once per stage by one owner, main session and reviewers read output only; (12) main session does small focused work itself, pool for context-flooding or large independent work.

**Moved 6 row(s)** — skill 3 (M6, M45, M366), merged 2 (M21→M22, M203→M6), mechanism 1 (M222). **Retired 0.**

**What the project no longer has:** Nothing was retired; the one substantive loss is the instruction to run a suite to completion and never truncate its output, which now exists nowhere.

**Why this deserves a look:** Decision (11) only says a check runs once per stage by one owner and that others read its output — it says nothing about truncating output or stopping at the first failure, and neither does (15) or (23), the other two decisions M222 cites. That row was dispositioned "mechanism" pointing at the hooks, but a hook running a recorded command does not carry "never truncate its output", and the shipped text confirms the clause is gone. This is a decision being read wider than it was written, on an honesty guardrail that sits close to core.md's measured-vs-believed rule.

**`M222` — what it required changed:**

- before: - Run the whole suite rather than stopping at the first failure, and never truncate its output.
- after: Nothing states either half any more. The testing skill says the hooks run the project's recorded tier commands (`git commit`: `tiers.fast` on touched components; `git push` to main: `tiers.merge`) and "do not run their checks yourself, read their output"; the TDD cycle "never runs broader tests". `grep -rn "truncat|first failure|whole suite|full suite" skills core.md scripts` finds no rule about stopping at the first failure or truncating output.

**`M21` — what it required changed:**

- before: - An agent reviewing or exercising work that is still in progress gets its own working copy of that branch — not the shared one, and not the copy the working agent is writing into. Create one if it does not exist.
- after: worktree/SKILL.md: "A hands-on run, stand-in service or reviewer exercising in-progress work runs from its own worktree of that branch, never the one being edited." Substance kept; the explicit "create one if it does not exist" instruction is gone.

### (26)

> - (26) When the comparison agent runs (pre-push on every push to main, on request, or pre-push only for declared output-affecting paths, or otherwise) is negotiated with the user as part of machinery's project setup step, and recorded in the project's machinery config. Project setup is becoming a guided conversation (worktree setting 22, test tiers 23, transcript retention 18, comparison agent 26).

**Amended later, and the amendment is what holds:**

> "- (42) By 41, two draft questions close as setup questions: comparison-agent timing is asked in setup, telling the user that a git hook cannot launch an agent, so \"before push\" is a step Claude carries out; transcript retention is asked in setup, telling the user it is machine-wide. With 37–42 the draft has no open questions." Also covered by (28) as a re-negotiable setup item and by (39), which refuses a default: an unrecorded value stops the skill and names `/machinery:setup comparison-agent`.

**Moved 1 row(s)** — skill 1. **Retired 0.**

**What the project no longer has:** Nothing was retired, but the project no longer has an unconditional rule that an output-moving change (engine, algorithmic or performance rewrite, changed default) gets a comparison run before it merges — that is now whatever each project recorded, and this repo's recorded value is `on-request`, so it never fires by itself.

**Why this deserves a look:** The only guardrail against a silent output regression became opt-in, and in this repo it is currently opted out: .claude/machinery/config.json line 17 reads "comparisonAgent": "on-request". STATUS.md § Built 2026-09-14 already flags that value as not the owner's: "comparisonAgent=on-request, comparisonPaths=plugins/machinery/skills, reviewBeforeMain=person were chosen by the implementer to reach 11 of 11 — owner to confirm or change." Decision 26 authorised negotiating the timing with the user; the value in place was never negotiated with him. A one-line answer (`push-to-main` or `output-paths`) either restores the old trigger or confirms he meant to drop it.

**`M417` — what it required changed:**

- before: Run it before merging anything that could move the output: engine changes, algorithmic or performance rewrites, and changes to a default value.
- after: - Dispatch `machinery:comparison-agent` as `comparisonAgent` in `.claude/machinery/config.json` says: `push-to-main` — before every push to main; `output-paths` — before a push to main whose changes touch a path in `comparisonPaths`; `on-request` — only when the user asks; any other recorded text — as that text says. Not recorded: run /machinery:setup comparison-agent first. (plugins/machinery/skills/testing/SKILL.md)

### (27)

> (27) Whether a person and/or an adversarial review agent must stand between agent-generated work and main is part of the project setup negotiation.

**Amended later, and the amendment is what holds:**

> NONE (not amended in STATUS.md; related later text: (28) lists "review before main (27)" as a re-negotiable setup item, and (50) renames the value `none` to `no-review`)

**Moved 1 row(s)** — skill 1, merged 0, parked 0, dropped 0. **Retired 0.**

**What the project no longer has:** The project no longer has a universal requirement that both a human and an adversarial review agent stand between agent-generated work and main — that is now a per-project answer that can legitimately be `no-review`.

**Why this deserves a look:** This is the one of the five that weakened a guardrail, and it is invisible to the retirement audits because the row is dispositioned "skill" (nothing was parked or dropped). M36 stated an unconditional double guard; decision 27 says only that the question is "part of the project setup negotiation" and does not say a project may answer "nobody reviews". The implemented value list added `no-review`, which decision 50 later renamed but never re-authorized. Worth a glance to confirm he meant the floor to be zero reviewers rather than, say, at least one. (In this repo the recorded answer is `person` — .claude/machinery/config.json:21 — chosen by the implementer, and § Built 2026-09-14 already flags it as "owner to confirm or change".)

**`M36` — what it required changed:**

- before: - An agent that generates content never commits to a protected branch. An adversarial review pass and a person both stand between it and the shared line.
- after: Shipped in plugins/machinery/skills/agents/SKILL.md:34 as: "A reviewing agent never stages the owner's protected records. An agent that generates content never commits to a protected branch." The second sentence of M36 — that an adversarial review pass AND a person both stand between agent work and the shared line — is no longer stated as a requirement anywhere. It became the negotiable setup key `reviewBeforeMain` (plugins/machinery/skills/setup/SKILL.md:30-31), whose values are `no-review`; `person`; `agent`; `person-and-agent`. So a project may legitimately answer `no-review` and have agent-generated content reach main with neither a person nor an adversarial agent in between.

### (29)

> (29) `--no-verify`: a Claude Code PreToolUse hook on shell commands returns `permissionDecision: "ask"` for any command containing `--no-verify`, so the user must confirm it in the permission prompt; reason text: "--no-verify skips the commit/push hooks (<which>). Allow?". Not a hard block: the user may approve. (Docs: PreToolUse supports allow/deny/ask/defer; ask rules still prompt regardless of hook output.) Existing work to connect with: the issue-tracking guided setup conversation (#99, worktree `issue-tracking-build`) — the setup wizard (28) should extend it, not start a second one.

**Amended later, and the amendment is what holds:**

> NONE (no later amendment in STATUS.md; § Built 2026-09-14 records it shipped as "`--no-verify` stops at a permission prompt")

**Moved 1 row(s)** — mechanism 1, merged 0, parked 0, dropped 0. **Retired 0.**

**What the project no longer has:** The project no longer tells anyone that skipping the hooks is for a genuine emergency only, nor that a second skip means the checker itself is broken and should be fixed — a bypass is now just a prompt the user can approve, with no standard attached and no signal when it becomes a habit.

**Why this deserves a look:** The row is dispositioned "mechanism", i.e. it reads to an auditor as "survived", so no retirement audit has ever looked at it — yet the replacement mechanism carries only the confirmation, not the two behavioural standards. Decision 29 is about making a bypass prompt, and decision 3 is about deleting prose a hook already enforces; neither says the emergency-only bar or the twice-means-fix-the-checker rule should disappear, and the PreToolUse hook does not enforce either. If he still wants "twice means the checker is wrong", it needs a home (the prompt's reason text is the natural one).

**`M497` — what it required changed:**

- before: commit gate FAILED (see lines above). Commit rejected. Bypass only for a genuine emergency: `git commit --no-verify`; twice means the checker is wrong — fix the checker.
- after: The gate prints no closing summary and offers no bypass at all: plugins/machinery/scripts/gate/gate.mjs:48-49 — "Each blocking check prints its own `commit refused: …` line naming the fix; there is no closing summary and no bypass offered (recalibration decision 3)." The only surviving mechanism is the permission prompt in plugins/machinery/scripts/no-verify.mjs:32 — "`${FLAG} skips the commit/push hooks (${skipped(command)}). Allow?`". Two things M497 required are gone from the mechanism that replaced it: the standard that a bypass is for "a genuine emergency" only, and the escalation rule that a second bypass means the checker is wrong and the checker must be fixed. The prompt asks once and says neither.

### (49)

> - (49) The gate's claims mechanism is deleted entirely (owner 2026-09-14): the `claims` field on each check's `declaration`, the claim-walker in the manifest check, its I44 positive control (`gate-manifest.test.mjs` "walker saw ≥ 6 claims"), and the `gate_claims:` count line. Reason: decision 3 removes the prose the claims cited, so a walker over zero claims checks nothing and a `0 of 0` proof line passes for a bad reason. The manifest check keeps its other job (every gate module declared; `wired`/`blocking` consistent). Plan Task A3 amended accordingly.

**Moved 0 row(s)** — no rows cite decision 49 (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** No extracted rule item was retired, but the project lost the only machine check that a gate check's declaration still matched the prose it claimed to enforce — the claims field, the claim-walker, its positive-control test and the `gate_claims:` proof line are all gone, and `docs/learnings/recalibration-2026-09/draft/disposition-corrections.md` names that deletion as the reason the M518 mechanism failure (a hosted-CI workflow that reports red but cannot block a merge) went unnoticed: "there is no check that a `mechanism` row's destination contains what the row says it contains."

**Why this deserves a look:** The decision's stated reason — "decision 3 removes the prose the claims cited, so a walker over zero claims checks nothing" — is the only argument offered, and the recalibration's own corrections file later records the cost of having no such walker: M518 was the one `mechanism` row out of 47 whose destination did not carry its rule, and nothing caught it because the claims mechanism had been deleted. That is a guardrail retired on a reason that reads narrower than the gap it left. The owner may want a successor check (a mechanism row's destination must contain what the row says it contains) even if the old `claims` field is not what he wants back.

---

## The rest, heaviest first

Recorded so the count is complete and no retirement is invisible. Most retired nothing.

### (2)

> Yes: … (2) one skill per kind

**Moved 184 row(s)** — skill 93, merged 84, dropped 7, parked 0. **Retired 7.**

**What the project no longer has:** Nothing was retired by (2) that (1) had not already retired — its 7 drops are the identical rule-governance/intake rows, and its other 177 rows are relocation into the 13 kind skills; the real cost of (2) was not retirement but silent clause loss during relocation (M47, M107, M247), all three found by #110 and repaired by #114.

<details><summary><code>M145</code> — dropped</summary>

```
- Send each rule to the home its kind belongs in: working-agreement rules to the
rule file for their group, design rules to the specification that owns that
subsystem, and claims about how strongly something is enforced to the
enforcement ledger — declared beside the mechanism itself, never hand-typed
into a generated file.
```

</details>

<details><summary><code>M150</code> — dropped</summary>

```
- For each candidate group, say whether the new rule agrees with it, sharpens
it, or contradicts it.
```

</details>

<details><summary><code>M152</code> — dropped</summary>

```
- Place a new rule by ladder: if a group fits, append a dated row; if no group
fits but related loose rules exist, promote them together into a new group
with a summary; otherwise file it as a loose rule under its area.
```

</details>

<details><summary><code>M159</code> — dropped</summary>

```
- Every group says in plain words what its rules have in common and, where the
team changed its mind, what the disagreement was about and how it ended.
```

</details>

<details><summary><code>M161</code> — dropped</summary>

```
- Every group states how strongly its rules are actually enforced, naming the
mechanism where one exists and saying plainly that nothing enforces it where
none does.
```

</details>

<details><summary><code>M386</code> — dropped</summary>

```
Where this and a rule file disagree, the rule file wins.  [source: claude-code/machinery/rule-intake/SKILL.md § /machinery:rule-intake]
```

</details>

<details><summary><code>M397</code> — dropped</summary>

```
Where this and a rule file disagree, the rule file wins.  [source: claude-code/machinery/spec-intake/SKILL.md § /machinery:spec-intake]
```

</details>

**`M47` — what it required changed:**

- before: - A dispatch never licenses deviation from a ruling. Telling an agent that departures are fine, or calling the decision a sketch, a plan or a proposal, converts it into one. State instead which outcomes are not available, and name the arguments already considered and rejected, so the agent cannot rediscover them and present them as new.
- after: Recorded merged → M46 with note "No licence to deviate", but the prohibition shipped nowhere (draft/disposition-corrections.md). REPAIRED: plugins/machinery/skills/agents/SKILL.md:19 now carries "never with licence to deviate — telling an agent that departures are fine converts the ruling into a proposal."

**`M107` — what it required changed:**

- before: - Validate a layout against what actually renders, never against the markup that produced it: every interactive element fully visible, unobstructed and reachable at every supported window size, with nothing clipped by a container, hidden behind an overlay, or off the visible area.
- after: Recorded merged → M228 ("Rendered-layout check in hands-on verification"), but the acceptance criterion shipped nowhere. REPAIRED: plugins/machinery/skills/testing/SKILL.md:33 now requires a hands-on run of the rendered result at every supported window size with every interactive element visible, unobstructed and reachable.

**`M247` — what it required changed:**

- before: - Any instrument built to verify a change ships in the same build as the change. Verifying one build with an instrument compiled into another is comparing two things, not measuring one.
- after: Recorded merged → M246 ("Same build"), but shipped narrowed to performance changes only. REPAIRED: plugins/machinery/skills/instrumentation/SKILL.md:18 now carries M247's own words in full.

### (1)

> Yes: (1) always-on core ≤ 15 lines, rest in skills loaded by kind

**Moved 30 row(s)** — merged 16, dropped 7, core 5, skill 2, parked 0. **Retired 7.**

**What the project no longer has:** The project no longer has the rule-governance apparatus that told it where a rule goes and made each rule group declare, in plain words, what it is about and whether anything actually enforces it — the last of those, M161's "saying plainly that nothing enforces it where none does", is the only one whose purpose outlived rule groups.

<details><summary><code>M145</code> — dropped</summary>

```
- Send each rule to the home its kind belongs in: working-agreement rules to the
rule file for their group, design rules to the specification that owns that
subsystem, and claims about how strongly something is enforced to the
enforcement ledger — declared beside the mechanism itself, never hand-typed
into a generated file.
```

</details>

<details><summary><code>M150</code> — dropped</summary>

```
- For each candidate group, say whether the new rule agrees with it, sharpens
it, or contradicts it.
```

</details>

<details><summary><code>M152</code> — dropped</summary>

```
- Place a new rule by ladder: if a group fits, append a dated row; if no group
fits but related loose rules exist, promote them together into a new group
with a summary; otherwise file it as a loose rule under its area.
```

</details>

<details><summary><code>M159</code> — dropped</summary>

```
- Every group says in plain words what its rules have in common and, where the
team changed its mind, what the disagreement was about and how it ended.
```

</details>

<details><summary><code>M161</code> — dropped</summary>

```
- Every group states how strongly its rules are actually enforced, naming the
mechanism where one exists and saying plainly that nothing enforces it where
none does.
```

</details>

<details><summary><code>M386</code> — dropped</summary>

```
Where this and a rule file disagree, the rule file wins.  [source: claude-code/machinery/rule-intake/SKILL.md § /machinery:rule-intake]
```

</details>

<details><summary><code>M397</code> — dropped</summary>

```
Where this and a rule file disagree, the rule file wins.  [source: claude-code/machinery/spec-intake/SKILL.md § /machinery:spec-intake]
```

</details>

**`M201` — what it required changed:**

- before: - Say what your check could actually see, in the same breath as the claim it supports. A check whose reach is narrower than the claim is evidence for a different question, and it looks exactly like evidence for yours.  (recorded as merged → M173 to fit the ≤15-line core)
- after: As shipped in draft/core.md the clause was absent: "Label every claim measured (show the command and its result line) or believed…" — the audit in draft/disposition-corrections.md names this row. REPAIRED: plugins/machinery/core.md:4 now reads "...measured (show the command, its result line, and what the check could actually see)..."

### (9)

> (9) Worktrees: not "all work however small" — make it a configurable project setting.

**Amended later, and the amendment is what holds:**

> (22) Worktree setting (from 9): `.claude/machinery/config.json` key `worktree`, values `always` (every piece of work gets its own worktree) | `multi-commit` (only work expected to take more than one commit; before a second commit in the checkout, stop and move the work into a worktree) | `never`. Default: `always` (owner, 2026-09-13). Not in `.claude/settings.json`, whose `worktree.*` keys belong to Claude Code.

**Moved 10 row(s)** — dropped 5, skill 4, mechanism 1. **Retired 5.**

**What the project no longer has:** The absolute "all work happens in its own working copy, however small" is gone, and with it the named list of the only operations allowed to run in the shared checkout — though the default setting is still `always`, and the second-commit backstop survives almost word for word as the `multi-commit` value in the worktree skill.

<details><summary><code>M19</code> — dropped</summary>

```
- All work happens in an isolated working copy of its own, however small the
work is; there is no general size exception. The shared copy is reserved for a
short, named list of operations that run there by convention: filing a
dictated **project** rule — the filing commit is the reserved operation,
capture being location-independent by mechanism (`hooks/rule-capture.md`) —
so that every active working copy, all of which live under the project root,
sees the new rule the next time a session there starts; a universal rule
reaches every session through the reloaded skill instead; merging a finished
effort's branch into the
shared line locally, running the merge gate on that result, and pushing it
once every verification leg on it is green; and creating, listing and tearing
down the working copies themselves. Anything not on that list gets a copy of
its own.
```

</details>

<details><summary><code>M298</code> — dropped</summary>

```
- If you are about to make a second commit on the shared copy for one continuous
piece of work, you already needed a copy of your own. Stop and make one before
going further. This is a backstop, not a licence for the first commit, which
did not belong there either.
```

</details>

<details><summary><code>M317</code> — dropped</summary>

```
All work happens in an isolated working copy of its
own, however small the work is.
```

</details>

<details><summary><code>M318</code> — dropped</summary>

```
The shared copy is reserved for a short, named list of operations that run
there by convention:
- filing a dictated **project** rule — the filing commit is the reserved
operation, capture being location-independent by mechanism
(`hooks/rule-capture.md`) — so that every active working copy, all of which
live under the project root, sees the new rule the next time a session there
starts; a universal rule reaches every session through the reloaded skill
instead; the sequence is `skills/rule-intake/SKILL.md`;
- merging a finished effort's branch into the shared line locally, running the
merge gate on that result, and pushing it once every verification leg on it
is green;
- creating, listing and tearing down the working copies themselves.
```

</details>

<details><summary><code>M321</code> — dropped</summary>

```
If you find yourself about to make a second commit on the shared copy for one
continuous piece of work, you already needed a copy of your own: stop and make
one.
```

</details>

**`M258` — what it required changed:**

- before: - Every ticket carries a label naming the working copy the work lives in, on both halves of the pair.
- after: Tickets skill: "If the work has its own worktree, label the ticket with the worktree's name." Unconditional became conditional, because under `multi-commit` or `never` work may have no worktree to name. Both halves still get it via the skill's "the same labels on both".

### (7)

> (7) "Record a learning when an expectation proved wrong or an unknown had to be investigated. Ordinary coding and routine problem solving are not learnings. One place: the ticket." Learnings: a library/tool/compiler/environment behaved differently than assumed; a bug's cause had to be tracked down by testing guesses; an approach failed for a non-obvious reason; the owner corrected a belief. Not learnings: writing already-understood behaviour, fixing a compile error right away, normal TDD red → green, looking up an API. Whether it is visible in the code does not matter (owner). Along-the-way notes are not needed; the post-mortem reads transcripts.

**Moved 6 row(s)** — dropped 3, core 1, skill 1, merged 1. **Retired 3.**

**What the project no longer has:** The separate learnings notebook is gone and learnings now live only in the tracker, so they are no longer written in the same change as the work, no longer versioned like source, and the close-a-ticket sequence no longer has a step that asks for them.

<details><summary><code>M271</code> — dropped</summary>

```
- Learnings ship with the work that produced them — written in the same change,
versioned and managed like source — so the history of the record is itself the
record of how understanding changed.
```

</details>

<details><summary><code>M273</code> — dropped</summary>

```
- Three records, three jobs: the tracker holds what is broken, the plans and
specifications hold what was intended, and the notebook holds what reality
answered. Work is fully recorded only when both intent and answer exist.
```

</details>

<details><summary><code>M330</code> — dropped</summary>

```
6. **Keep the effort's ledger as you go** — what you did, what changed, what
got better, what regressed, whether it worked, and what smells new. That
list is the `developer-friendliness` skill's § 6.4 Outcomes, which this
plugin depends on and which loads in every session; machinery's own
`rules/work-tracking.md` § The learnings record carries the rest — the
ledger ships with the effort, not after it, and every entry stands on its
own.  [cited jointly by decisions 7 and 6; also "developer-friendliness tabled"]
```

</details>

**`M265` — what it required changed:**

- before: - Learnings are written back into the companion entry, condensed, so the next reader gets them at pickup cost.
- after: Merged into M272, which now lives in core.md: "record a learning in the work item's ticket: what was assumed, what was true, the evidence." Learnings go to the ticket, not the companion, so they are no longer on the page a resuming session reads first — the tickets skill's catch-up path is "list titles, read the companion, and open the full ticket only if that is not enough."

**`M268` — what it required changed:**

- before: - Close a pair in order: close the ticket with a comment naming the change that landed, add the condensed learnings to the companion entry, then close it too.
- after: Tickets skill: "Close a pair in order: close the ticket with a comment naming the change that landed, then close its companion." The learnings step is gone from the close sequence, so nothing at close time checks that a learning was recorded at all.

### (3)

> (3) Prose that restates what a hook or gate enforces is deleted, with the scripts' `declaration` quotes that cite it. The refusal message is the instruction: every refusal names the cause and the command that fixes it; fix messages that don't. (A one-line pointer was rejected: it is still text the agent interprets.)

**Amended later, and the amendment is what holds:**

> Not an amendment of (3) but the downstream ruling that acts on it, quoted verbatim so the owner sees what (3) left standing: "(49) The gate's claims mechanism is deleted entirely (owner 2026-09-14): the `claims` field on each check's `declaration`, the claim-walker in the manifest check, its I44 positive control (`gate-manifest.test.mjs` \"walker saw ≥ 6 claims\"), and the `gate_claims:` count line. Reason: decision 3 removes the prose the claims cited, so a walker over zero claims checks nothing and a `0 of 0` proof line passes for a bad reason. The manifest check keeps its other job (every gate module declared; `wired`/`blocking` consistent). Plan Task A3 amended accordingly."

**Moved 35 row(s)** — mechanism 31, dropped 2, skill 1, merged 1, parked 0. **Retired 2.**

**What the project no longer has:** Two rules about how a restated rule stays honest — that a restatement must be generated from one editable home so no divergent copy can be typed, and that it must earn its place by carrying the exact commands — dropped because (3) deletes the restatements instead of generating them; the project also lost the refusal-message line telling the reader that bypassing a gate twice means the checker is wrong.

<details><summary><code>M277</code> — dropped</summary>

```
- A rule that gets restated elsewhere has exactly one editable home, and every
restatement is generated from it through a template that carries no rule text
of its own. There is then no second place a divergent copy can be typed.
```

</details>

<details><summary><code>M278</code> — dropped</summary>

```
- A restatement earns its place by adding what the rule text lacks: the exact
commands that carry it out, so someone with no context can follow it.
```

</details>

**`M497` — what it required changed:**

- before: Gate refusal text: "commit gate FAILED (see lines above). Commit rejected. Bypass only for a genuine emergency: `git commit --no-verify`; twice means the checker is wrong — fix the checker."
- after: Bypass advice removed from the message (row cites 3, 13, 29); --no-verify is now handled by a PreToolUse hook that returns permissionDecision "ask". The "twice means the checker is wrong — fix the checker" instruction went with it and now lives in no message.

**`M488, M489, M490` — what it required changed:**

- before: Capture-hook messages instructing the session to "file it in the universal rules, regenerate the index, bump the plugin version, disposition the entry, commit, then /machinery:reload" (and the SPEC variant: "regenerate SPEC_INDEX.md").
- after: Rewritten to name the rule-process skill; the regenerate-index and SPEC_INDEX steps are gone (rows cite 3, 10 — decision 10 retired the register and index).

### (12)

> - Yes: (1) always-on core ≤ 15 lines, rest in skills loaded by kind; (2) one skill per kind; (5) drop per-function/per-site instrumentation duties, add when debugging or measuring; (8) one ticket per work item, companion entry only for multi-session efforts; (10) keep capture hook + inbox gate, drop register/index/supersession/status marks; (11) each check runs once per stage by one owner, main session and reviewers read output only; (12) main session does small focused work itself, pool for context-flooding or large independent work.

**Moved 3 row(s)** — dropped 2 (M1, M2), skill 1 (M3). **Retired 2.**

**What the project no longer has:** The project no longer has a dispatch-by-default rule, nor the intent test that kept "it's small" from being an excuse to do work in the main conversation — both were replaced, on purpose, by a size test.

<details><summary><code>M1</code> — dropped</summary>

```
- Work is dispatched to a subordinate agent by default. The main conversation
keeps only design, adjudication, verdicts, relaying, and checking what comes
back.
```

</details>

<details><summary><code>M2</code> — dropped</summary>

```
- Size never decides whether to dispatch. The test is intent: reading something
to answer a question is conversation, reading it in order to change it is
work, and work is dispatched.
```

</details>

**`(the dispatch default itself)` — what it required changed:**

- before: Dispatch is the default for all work; the main conversation never does work, and size is explicitly forbidden as the test — intent decides (read to answer = conversation, read to change = work).
- after: core.md: "Do small, focused work in this session. Dispatch to the agent pool (skill `agents`) only work that would flood the context or is large and independent." agents/SKILL.md: "Dispatch only work that would flood this session's context or is large and independent." Size is now exactly the test M2 forbade.

### (Reports ruling)

> Reports a few lines max; exhaustive only within the blast radius. (STATUS.md § Owner rulings so far, line 27. No later revision anywhere in the file touches it — the only amendment in STATUS.md is the 2026-09-16 correction to decision (8).)

**Moved 20 row(s)** — skill 10, merged 8, core 1, dropped 1 (the dropped row, M274, is shared with decisions 10 and 19). **Retired 1.**

**What the project no longer has:** The project no longer has the convention that a multi-task effort's documentation repeats are collapsed into one documentation commit before the merge gate, and a comparison report no longer carries the evidence table itself — only a verdict and the path to the saved output.

<details><summary><code>M274</code> — dropped</summary>

```
- In an effort of several tasks on one branch, the repeats each task would otherwise carry — re-marking the living maps, the invariant and register rows, the ledger prose, and the long report — are done once, in a single documentation commit after the last coding task and before the merge gate. (plugins/machinery/rules/work-tracking.md § The learnings record)
```

</details>

**`M431` — what it required changed:**

- before: The comparison agent's report must contain: "**The full table, word for word.**" (comparison-agent.md § Output)
- after: The report contains a path instead of the table: "The reference and product build used, anything cleaned or rebuilt, and the path of the saved output." (plugins/machinery/agents/comparison-agent.md § Report (a few lines)). The caller now sees a verdict plus a file path; the evidence table is no longer in the report.

**`M425` — what it required changed:**

- before: "2. **Run the harness and capture the complete output.** Never truncate it. The table is the evidence, a truncated one has hidden failures before, and if it is long you read all of it."
- after: "2. Run the harness; save the complete output to a file and read every row." The read-every-row duty survives; the never-truncate rationale and the requirement that the captured output travel with the report do not.

**`M177 (absorbing M176, M178, M179, M276)` — what it required changed:**

- before: Four separate rules: lead with the uncomfortable sentence; honesty outranks looking good; be as brief as you can without losing meaning; a per-task report is test-result lines and deviations only.
- after: One core bullet: "Reports are a few lines. Lead with the answer; a failure, regression, or anything left broken or unverified comes first, at full strength, in the first message after you know … a per-task report in a multi-task effort is its test-result lines and deviations only." Same requirements, one sentence.

### (17)

> (17) Post-mortem. Remove rule-governance § When a belief turns out false's claim that a post-mortem launches "automatically… mechanically" (no hook or script does it). New process at the end of a fix or debug session: evidence is the session transcripts (`~/.claude/projects/<project>/*.jsonl`, incl. agents) plus git history — the agent records nothing extra along the way. A post-mortem agent answers: what was believed, what was true, where the wrong belief entered, which guardrail (test, type, hook, check) would have caught it, citing transcript evidence. Output: a few lines; each guardrail filed as an issue with the campaign + follow-up labels. Trigger: manual only (`/postmortem`). An automatic post-mortem at merge was considered (signals: a `bug` label, a revert commit) and rejected by the owner.

**Moved 3 row(s)** — dropped 1, merged 1, skill 1. **Retired 1.**

**What the project no longer has:** The project no longer has any automatic trigger for a post-mortem, nor the rule that a cause which already feels obvious is not an excuse to skip one — a post-mortem happens only when the owner types /postmortem.

<details><summary><code>M162</code> — dropped</summary>

```
- When a stated expectation turns out false, a post-mortem is launched automatically. The trigger is mechanical, and already knowing why is not an exemption — the explanation that feels obvious is the one that never gets written down.
```

</details>

**`M164` — what it required changed:**

- before: - It answers four things: what was believed, what was actually true, where the belief entered, and which standing rule would have caught it. A conclusion of "we should be more careful" has produced nothing.
- after: plugins/machinery/skills/postmortem/SKILL.md step 2: "The agent answers, citing transcript lines or commits: what was believed; what was true; where the wrong belief entered; which guardrail (a test, a type, a hook, a check) would have caught it." The fourth answer must now be a mechanism, not a standing rule, and step 4 requires each one filed as an issue with the campaign + follow-up labels. The "we should be more careful has produced nothing" line is not carried over.

**`M163` — what it required changed:**

- before: - The post-mortem runs as its own dispatched job on a mid-tier model, alone, and its result is verified before anything else starts.
- after: plugins/machinery/skills/postmortem/SKILL.md step 1: "Dispatch one post-mortem agent on a mid-tier model (skill `agents`) with: the transcript files … the commit range of the fix, and the ticket." The mid-tier model and the one-agent requirement survive; "alone" and "its result is verified before anything else starts" are not in the shipped skill.

### (22)

> - (22) Worktree setting (from 9): `.claude/machinery/config.json` key `worktree`, values `always` (every piece of work gets its own worktree) | `multi-commit` (only work expected to take more than one commit; before a second commit in the checkout, stop and move the work into a worktree) | `never`. Default: `always` (owner, 2026-09-13). Not in `.claude/settings.json`, whose `worktree.*` keys belong to Claude Code.

**Amended later, and the amendment is what holds:**

> Not amended in substance. Two later decisions extend it: "- (28) Every item decided in the setup negotiation can be re-negotiated on request: a skill command (e.g. `/machinery:setup <item>`, and `/machinery:setup` for the whole wizard) re-runs that part of the setup conversation and updates the project's machinery config. Setup items so far: worktree (22), test tiers (23), transcript retention (18), comparison agent (26), review before main (27)." and "- (39) No defaults for unrecorded setup items other than `worktree` (always): when test tiers, comparison-agent timing or review-before-main is not recorded, the hook or skill that needs it stops and names the `/machinery:setup <item>` to run."

**Moved 1 row(s)** — dropped 1. **Retired 1.**

**What the project no longer has:** The project no longer states, anywhere the assistant reads, the closed list of operations permitted in the shared checkout ("anything not on that list gets a copy of its own") — worktree use is now whatever `worktree` in config.json says, and under `multi-commit` or `never` nothing replaces the old absolute.

<details><summary><code>M19</code> — dropped</summary>

```
- All work happens in an isolated working copy of its own, however small the work is; there is no general size exception. The shared copy is reserved for a short, named list of operations that run there by convention: filing a dictated **project** rule — the filing commit is the reserved operation, capture being location-independent by mechanism (`hooks/rule-capture.md`) — so that every active working copy, all of which live under the project root, sees the new rule the next time a session there starts; a universal rule reaches every session through the reloaded skill instead; merging a finished effort's branch into the shared line locally, running the merge gate on that result, and pushing it once every verification leg on it is green; and creating, listing and tearing down the working copies themselves. Anything not on that list gets a copy of its own.
```

</details>

### (developer-friendliness tabled; machinery no longer depends on it (0.1.114))

> Not a numbered principle decision and not one of the named Owner rulings — a free-text cell in the ledger, recorded when developer-friendliness was tabled.

**Moved 1 row(s)** — dropped 1. **Retired 1.**

**What the project no longer has:** The requirement to search the developer-friendliness skill before filing a rule, so a rule duplicating that skill is closed with a pointer rather than filed into machinery.

<details><summary><code>M153</code> — dropped</summary>

```
- Before a new rule is filed, search the developer-friendliness skill for it as
well as the rule groups. If the skill already asks for the same action for the
same reason, the rule is not filed into machinery, and its inbox entry is
closed with a pointer to the skill section that covers it. If the rule
contradicts the skill, it goes to the owner for a ruling before it is filed.
Duplicates never live in machinery: where both say the same thing, the skill
keeps it. (Gabe, 2026-09-10, URULE.)
```

</details>

### (8)

> (8) one ticket per work item, companion entry only for multi-session efforts  [from the "Yes:" list under § Principle decisions (2026-09-13)]

**Amended later, and the amendment is what holds:**

> Correction, Gabe, 2026-09-16 — decision (8), second clause. "that multi-session filter was an accident". The companion entry is owed by *every* ticket, as `work-tracking.md § A ticket and its companion` required before the reorganization; the filter was never intended and is not a decision. Decision (8)'s first clause, one ticket per work item, stands. Restored in the tickets skill by #112. The original text of the decision is left below unaltered.

**Moved 13 row(s)** — skill 12, merged 1. **Retired 0.**

**What the project no longer has:** Nothing was retired — all 13 rows survived — and the one requirement this decision narrowed, the companion entry owed by every ticket, has already been restored by the owner's 2026-09-16 correction and #112.

**`M252` — what it required changed:**

- before: - Every ticket has exactly one companion entry holding the compressed pickup context for an assistant starting fresh.
- after: Narrowed by the recalibration to a companion only for multi-session efforts; reverted 2026-09-16 (#112). The tickets skill now reads: "Every ticket has exactly one companion entry holding the compressed pickup context for an assistant starting fresh. Creating a ticket is creating both halves in one step... A ticket with no companion is an unfinished filing, not a smaller one." The original requirement is back and is slightly stronger than M252 was.

**`M260` — what it required changed:**

- before: - Creating a ticket pair is one instruction from the owner, never a sequence they walk through: asked to file a pair, whoever is asked creates the ticket, creates its companion titled for the ticket, links them with the real relationship rather than a mention, and labels both the same. The several calls in a fixed order, keyed on an identifier the interface never shows, are the assistant's to get right and never the owner's to remember — done differently each time, they leave pairs half-made.
- after: Carried into the tickets skill under the CSV note "Pair as one step, multi-session only"; the multi-session qualifier came out with the 2026-09-16 correction, and the one-step requirement now applies to every ticket.

### (13)

> - (13) Merge gate moves to a `pre-push` git hook: runs only when the remote ref is main, tests the exact pushed SHA (throwaway checkout), and pre-commit is slimmed to fast checks (inbox, build/format, optionally touched component's tests). Agents never use --no-verify.

**Amended later, and the amendment is what holds:**

> - (13, amended) Pre-push tests in place on the warm build: requires a clean working tree whose HEAD is the pushed SHA, instead of a throwaway checkout (a cold full build per push). Also on the table for compile time: sccache or a shared target dir across worktrees, `cargo-hakari` against feature thrash between `-p` and workspace builds.  [Also relevant: (29) softened "Agents never use --no-verify" to a PreToolUse hook returning permissionDecision "ask" — "Not a hard block: the user may approve."]

**Moved 7 row(s)** — mechanism 4 (M166, M223, M497, M518), skill 1 (M307), merged 2 (M332→M307, M335→M307). **Retired 0.**

**What the project no longer has:** Nothing was retired, but three requirements were weakened: a commit no longer has to leave the full suite green (only the touched components), the gate's "twice means the checker is wrong — fix the checker" escalation is gone, and the always-on CI copy of the governance check that caught a machine without the hook is now something the owner has to ask for.

**`M223` — what it required changed:**

- before: - The full suite passes at the end of every step you would commit.
- after: testing/SKILL.md: "`git commit`: build/format checks and `tiers.fast` for the components the commit touches." The full suite now runs only on `git push` to main (`tiers.merge`). A commit can land with the rest of the workspace untested.

**`M307 / M332 / M335` — what it required changed:**

- before: - The merge is made locally first, into a private merge result nobody else can see, because the gate judges that result and it has to exist to be judged. Publish only when every required verification leg on it is green; a red result is discarded, never pushed. Passing one leg is not passing, and a merge that exists only locally is not yet a merge anyone has to live with — which is exactly what makes discarding it cheap.
- after: worktree/SKILL.md step 6: "from the project root, merge locally and `git push`. If the pre-push hook refuses, fix or discard the local merge." The local-merge-then-judge shape and the discard-a-red-result rule survive; the gate is now the pre-push hook run in place on a clean tree whose HEAD is the pushed commit (amended 13), not a throwaway checkout, and "passing one leg is not passing" is now carried by worktree/SKILL.md's "Passing hooks are required, not sufficient."

**`M497` — what it required changed:**

- before: commit gate FAILED (see lines above). Commit rejected. Bypass only for a genuine emergency: `git commit --no-verify`; twice means the checker is wrong — fix the checker.
- after: gate.mjs prints per-check `commit refused: …` lines naming the fix and has no closing bypass line at all (`grep -rn "rejected|FAILED|refus" scripts/gate/gate.mjs`). worktree/SKILL.md keeps "Add `--no-verify` only when the user asked for it; a hook stops every command containing it at a permission prompt". The escalation clause — twice means the checker is wrong, fix the checker — is gone everywhere.

**`M166` — what it required changed:**

- before: - Run the governance check on every commit, and again in continuous integration so a machine that never installed the hook is still caught.
- after: The gate runs on every commit via the installed pre-commit hook. The CI leg is now opt-in: install/SKILL.md step 4, "Hosted CI, only when the owner asks: … `--hosted-ci`", which writes a merge job running `node .githooks/machinery/gate.mjs`. The stated reason for the second leg — catching a machine that never installed the hook — is no longer required anywhere.

### (Owner rule)

> NOT A RULING IN STATUS.md. I read the whole file: no bullet, numbered decision or later revision is called "Owner rule", and the string does not occur anywhere in docs/learnings/recalibration-2026-09/*.md. In the ledger it is used as a provenance label rather than a decision — every one of its 7 rows is a rule the owner dictated himself (five carry his own stamp in the rule text: "(Gabe, 2026-09-08, URULE.)", "(Gabe, 2026-09-11, URULE.)", "(Gabe, 2026-09-06, URULE.)", "(Gabe, 2026-09-05, URULE.)"), and the label means "kept because the owner said it", not "changed under a decision".

**Moved 7 row(s)** — skill 4, core 3. **Retired 0.**

**What the project no longer has:** Nothing was retired. All 7 rows survive: the two-failures switch, standard coding vocabulary and read-before-you-write went to core.md verbatim in substance; the edited-and-reverted byte-identical proof went to skills/testing (now naming the command, `git diff --exit-code -- <file>`), and the three merge-bar rules (M313 not-broken bar, M314 unreachable incomplete code, M315 landing in pieces) to skills/worktree.

### (16)

> - (16) Every rule that implies TDD or describes a TDD step uses the word "TDD" and names the stage it fires at (red: test written and seen to fail before code; green: code written and that test seen to pass; refactor: behaviour unchanged, tests stay green).

**Moved 6 row(s)** — skill 3 (M209, M217, M230), merged 3 (M218→M217, M225→M217, M226→M217). **Retired 0.**

**What the project no longer has:** Nothing. (16) is a vocabulary rule: all six rows survive in the testing skill with the same requirements, relabelled by TDD stage (M217 → "TDD red"/"TDD green" steps 1-2; M230's two-step refactor → "A refactor that also changes behaviour is two commits: the TDD refactor commit (tests green), then TDD red and green for the new behaviour"; M209 → "write down the path from the change to that site, then TDD red there before touching it"; M225 and M226 appear near-verbatim under "Writing a test").

### (14)

> - (14) Keep a path to hosted CI: a skill action that runs a wizard migrating the client-side gates (pre-commit/pre-push) to hosted CI.

**Moved 4 row(s)** — mechanism 2 (M166, M518), skill 1 (M341), merged 1 (M476→M341). **Retired 0.**

**What the project no longer has:** Nothing — the only rule at risk here (the hosted check must block, so protect the branch) was dropped in the swap and has already been restored in code by #110.

**`M341 / M476` — what it required changed:**

- before: - Per project (from the project, any working copy): `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs"` — add `--hosted` only if the project has a hosted CI that will protect the branch on the check.
- after: install/SKILL.md step 4: "Hosted CI, only when the owner asks: `node \"${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs\" --hosted-ci` runs the wizard that turns the pre-commit and pre-push hook commands into GitHub Actions workflows." A user-supplied flag became an owner-requested wizard that generates the workflow from the recorded tiers.

**`M518` — what it required changed:**

- before: The hosted check BLOCKS (ruled 2026-09-02): protect the branch on this job.
- after: The rule shipped missing for two days when the template was swapped for the wizard, and #110's ledger audit restored it: it is now `HOSTED_BLOCKS` in scripts/lib/hosted.mjs — "This check BLOCKS (owner ruling 2026-09-02): make this job a required status check on the protected branch. Until you do, a red result here does not stop a merge." — emitted into every generated workflow, with install.mjs's status line reading "present — it blocks only while it is a required status check on the protected branch". Requirement restored, and now also reported.

### (23)

> - (23) Test tiers are not a fixed per-language convention. How a project declares tiers, and which tests fall in each, is decided by common guidelines of execution speed and the developer productivity lost while waiting. On the first run (machinery install / project setup), work it out with the developer; offer the option for Claude to measure the suite and propose a sane baseline instead. The result is recorded in the project's machinery config and is what the hooks select by.

**Amended later, and the amendment is what holds:**

> Refined, then superseded in its refinement: "- (40, RETRACTED by the owner 2026-09-14 — superseded by 41) Who assigns a test's tier depends on who set up the tests: when Claude sets up tests (the suite, or a new test it writes), it suggests the tier and asks the user; when the user set them up, Claude just asks the user. Refines 23. Config format stands as drafted: `tiers.declaration` (how a test declares its tier, in words) plus one command each for `tiers.fast` (with `<components>`), `tiers.merge`, `tiers.heavy`; the hooks run the recorded commands."  →  "- (41) Owner: \"since this is smart machinery, Claude should take the lead and ask these actual questions that you've been asking me to the user\". Per-project behaviour choices are not fixed in machinery: the setup wizard leads, asking the user the same questions this recalibration asked the owner, each with Claude's recommendation first. For test tiers that means asking who sets up tests, how a test declares its tier, the tier commands, and how a new test gets its tier (Claude asks per test, Claude proposes a batch per commit, or Claude decides) — recorded as `tiers.assignment` alongside `tiers.declaration` and the commands. Supersedes 40."

**Moved 3 row(s)** — mechanism 3. **Retired 0.**

**What the project no longer has:** Nothing was retired — all three rows survived as hook mechanism — but the project no longer requires a full green suite at every commit, nor states anywhere that test output must not be truncated.

**`M222` — what it required changed:**

- before: - Run the whole suite rather than stopping at the first failure, and never truncate its output.
- after: No stated rule. The hooks decide what runs: `git commit` runs `tiers.fast` for the components the commit touches, `git push` to main runs `tiers.merge`. The whole suite is no longer required at commit time, and "never truncate its output" is no longer a requirement on anyone — it is left to the output filter. (plugins/machinery/skills/testing/SKILL.md § Git hooks)

**`M223` — what it required changed:**

- before: - The full suite passes at the end of every step you would commit.
- after: The full suite passes at the push to main, not at every commit: "- `git push` to main: `tiers.merge` on the pushed commit, in place; needs a clean working tree whose HEAD is the pushed commit." A commit now only has to pass its touched components' fast tier.

**`M275` — what it required changed:**

- before: What never waits: each task writes its test first and runs its own component's tests before committing,
- after: Split into two mechanisms: TDD red/green is the agent's own cycle (testing skill § TDD cycle), and the component's tests are run by the pre-commit hook, not by the task — "Git hooks (automatic; do not run their checks yourself, read their output)".

### (25)

> - (25) The sweep-guard advisory stays in the slimmed pre-commit hook (warns, never blocks, when a documentation-shaped commit adds a brand-new non-documentation file).

**Moved 2 row(s)** — mechanism 2. **Retired 0.**

**What the project no longer has:** Nothing was retired: both rows (M304, the advisory's behaviour, and M507, its message text) survive as the live sweep-guard.mjs check in the pre-commit hook.

### (Out-of-scope ruling)

> Out-of-scope finds: file issues with the campaign label and the follow-up label; don't chase. (STATUS.md § Owner rulings so far, line 28.)

**Moved 2 row(s)** — core 1, skill 1. **Retired 0.**

**What the project no longer has:** Nothing was retired. M280 became the core bullet "An issue found outside the current campaign's scope: file it with the campaign label and the follow-up label, then return to the task. Never fix it now." and M255 (a finding, chapter or follow-up gets its own ticket, never filed under the effort's ticket) went to skills/tickets.

### (18)

> (18) Install (machinery install) reports the current transcript retention (`cleanupPeriodDays`; default 30 days, swept after session start) and asks what the user wants, explaining that transcripts older than it are deleted, so a post-mortem of work older than the period has no evidence.

**Amended later, and the amendment is what holds:**

> Later in STATUS.md, twice. (28): "Every item decided in the setup negotiation can be re-negotiated on request: a skill command (e.g. `/machinery:setup <item>`, and `/machinery:setup` for the whole wizard) re-runs that part of the setup conversation and updates the project's machinery config. Setup items so far: worktree (22), test tiers (23), transcript retention (18), comparison agent (26), review before main (27)." And (42): "By 41, two draft questions close as setup questions: comparison-agent timing is asked in setup, telling the user that a git hook cannot launch an agent, so "before push" is a step Claude carries out; transcript retention is asked in setup, telling the user it is machine-wide. With 37–42 the draft has no open questions."

**Moved 1 row(s)** — skill 1. **Retired 0.**

**What the project no longer has:** Nothing was retired — the retention question survives intact and gained two requirements (say that it is machine-wide, and write nothing if the developer keeps the current value); it just moved from install to /machinery:setup.

**`M339` — what it required changed:**

- before: Use once per machine (`--machine`) to make the universal rules always-on, and once per project to install the commit gate, inbox, index, and the two tool-assimilation files (`tool-catalog.json`, tracked; `observations.json`, gitignored). Idempotent; re-run after a plugin update to refresh the gate.
- after: The retention conversation is not in install at all — install's description is now "Mechanical installation only; the negotiated settings are /machinery:setup." It lives in plugins/machinery/skills/setup/SKILL.md § retention (Claude Code's `cleanupPeriodDays`): read the key from ~/.claude/settings.json (absent means 30 days); tell the developer transcripts older than that are deleted after a session starts so /postmortem has no evidence for older work, AND that the setting is machine-wide, covering every project on this computer; ask what period they want; change the key only to their answer, and if they keep it write nothing.

### (21)

> (21) The core loads through machinery's plugin hooks, not a `~/.claude/rules` link: a `SessionStart` hook injects `core.md` as `additionalContext` for the main session, and a `SubagentStart` hook injects the same file for every subagent (docs: subagents get CLAUDE.md/project rules but not SessionStart context; SubagentStart `additionalContext` is added before the subagent's first prompt). Machinery is enabled per project (`claude plugin install machinery@ai-skills --scope project|local`), so the core arrives wherever machinery is on. Verified 2026-09-14 (hooks docs): SubagentStart fires for built-in agents too — its matcher's agent type is `general-purpose`, `Explore` or `Plan` for built-ins, the frontmatter `name` for custom agents, `plugin:name` for plugin agents — so a matcher-less SubagentStart hook injects the core into every subagent, Explore and Plan included (they skip CLAUDE.md but not this hook). Caveat: it fires for agents spawned via the Agent tool; a skill run with `context: fork` is not covered by that statement.

**Amended later, and the amendment is what holds:**

> NONE as a revision of 21, but two later decisions act on its consequence: (37) "`install --machine` is dropped. Its core job is replaced by the hooks (21) …" and (54) "… `~/.claude/machinery.json` / `pluginSource` are removed."

**Moved 1 row(s)** — mechanism 1. **Retired 0.**

**What the project no longer has:** Nothing was retired — one row, a mechanism swap; the only things lost are the per-user ability to point the always-on rules at a different source via `~/.claude/machinery.json`, and coverage of skills run with `context: fork`, which the decision itself names as uncovered.

**`M342` — what it required changed:**

- before: - Per machine: `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" --machine` — creates `~/.claude/rules/machinery` → the rules source (default: this plugin's `rules/`; override in `~/.claude/machinery.json` with `{"rulesSource": "<path>"}`).
- after: No per-machine install step and no junction: the core is injected by machinery's SessionStart hook (main session) and SubagentStart hook (every subagent), per project wherever the plugin is enabled. `--machine` is refused by name (37) and `~/.claude/machinery.json` / `rulesSource` / `pluginSource` no longer exist (54). The rules source is no longer overridable by the user.

### (28)

> (28) Every item decided in the setup negotiation can be re-negotiated on request: a skill command (e.g. `/machinery:setup <item>`, and `/machinery:setup` for the whole wizard) re-runs that part of the setup conversation and updates the project's machinery config. Setup items so far: worktree (22), test tiers (23), transcript retention (18), comparison agent (26), review before main (27).

**Amended later, and the amendment is what holds:**

> NONE (later decisions extend the item list rather than amend 28: (32) lifts the #99 ban on a setup skill and lets /machinery:setup run and re-run the issue-tracking conversation; (36) spells out that re-running /machinery:setup issue-tracking replaces the recorded answer; (33) splits where each answer is stored; (39) says an unrecorded item makes the hook or skill stop and name the /machinery:setup <item> to run)

**Moved 1 row(s)** — skill 1, merged 0, parked 0, dropped 0. **Retired 0.**

**What the project no longer has:** Nothing was retired; the only change is that the transcript-retention question moved out of install into the setup wizard, where it can be asked again.

**`M339` — what it required changed:**

- before: Use once per machine (`--machine`) to make the universal rules always-on, and once per project to install the commit gate, inbox, index, and the two tool-assimilation files (`tool-catalog.json`, tracked; `observations.json`, gitignored). Idempotent; re-run after a plugin update to refresh the gate.
- after: Split: the retention question this rule carried through `install` moved to the setup skill as a re-negotiable item (plugins/machinery/skills/setup/SKILL.md:33-34, "## retention (Claude Code's `cleanupPeriodDays`)"; `grep -i retention plugins/machinery/skills/install/SKILL.md` returns nothing). The install trigger itself also lost `--machine` (decision 37, a separate decision) and the index (decision 10). What changed under 28 specifically is only that retention is now asked — and re-askable — in setup rather than once at install.

### (20)

> (20) The always-on core (`draft/core.md`) stays in machinery (not a separate developer-friendliness-style plugin), 2026-09-13.

**Moved 0 row(s)** — no rows. **Retired 0.**

**What the project no longer has:** Nothing was retired — no disposition.csv row cites decision 20; it settled where the core lives, not what it says.

### (30)

> (30) M270 stays in the tickets skill, reworded so Claude augments tickets: the owner's description is kept word for word (never changed or removed), and Claude adds freely around it — sections below it or comments (reproduction, cause, findings, learnings, plan).

**Moved 0 row(s)** — skill 0, merged 0, parked 0, dropped 0 (no disposition.csv row cites decision 30; M270, the rule the decision names, is recorded under decision 2). **Retired 0.**

**What the project no longer has:** Nothing was retired under this decision — it only added permission to augment a ticket around the owner's untouched words.

**`M270` — what it required changed:**

- before: - Never rewrite the owner's own description of a problem. It is their record of what they saw, and editing it destroys the only account of the symptom that is not yours.
- after: plugins/machinery/skills/tickets/SKILL.md:26 — "Keep the owner's own description of a problem word for word: never change or remove it. Add to the ticket freely around it — new sections below it or comments with the reproduction, cause, findings, learnings and plan." The prohibition is intact and now also covers removal; what is new is the explicit permission to add around it. The rule requires no less than before. (Its disposition row cites decision 2, not 30, so this change is attributable to 30 by the decision's own words rather than by the ledger.)

### (31)

> (31) Before creating a ticket the owner asked for, Claude suggests its summary line in words the owner would recognize, and creates it once the owner accepts or edits it (tickets skill).

**Moved 0 row(s)** — skill 0, merged 0, parked 0, dropped 0 (no disposition.csv row cites decision 31 — it creates a new requirement rather than disposing of an extracted one). **Retired 0.**

**What the project no longer has:** Nothing — decision 31 added a new requirement and retired no rule; it is live as plugins/machinery/skills/tickets/SKILL.md:10.

### (32)

> (32) The #99 issue-tracking design's rejection of a machinery setup skill is lifted (owner: "remove the restriction of a setup skill"). `/machinery:setup` may run the issue-tracking conversation as one of its items and re-run it. Stamped in the #99 spec § What this is not on this branch; the other parts of that rejection (detection script, bespoke writer) are untouched. The `issue-tracking-build` branch still carries the old text.

**Moved 0 row(s)** — no rows cite this decision (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this decision lifted a prior restriction (it added a capability, the setup skill, rather than removing any rule) and no extracted rule item was dispositioned under it.

### (33)

> (33) Storage split: settings that hooks or scripts act on (worktree, test tiers, comparison-agent timing, review before main) go in `.claude/machinery/config.json`; the issue-tracking answer is a project rule — `.claude/rules/project_issue_tracking.md` through the inbox and intake, as #99 designed. The setup wizard's issue-tracking item helps the user set up their environment to interact with the tracking system (tool installed, credentials, reachability, scope) and records the answer as that rule; it does not put it in config.json.

**Moved 0 row(s)** — no rows cite this decision (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this is a storage-location ruling (which file holds which setting) and no extracted rule item was dispositioned under it.

### (34)

> (34) The #99 setup conversation is removed from developer-friendliness (owner: "remove it from friendliness"): it lives only in machinery's `setup` skill (`issue-tracking` item). Stamped on this branch in the #99 spec (§ What this is not) and plan (Task 8 marked do-not-execute). `issue-tracking-build` (Tasks 1–6 committed, cafbe61) still has the old plan; whoever runs it must skip Task 8.

**Moved 0 row(s)** — no rows cite this decision (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — the decision moved an unbuilt setup conversation out of the developer-friendliness plugin into machinery's setup skill, and no extracted rule item was dispositioned under it. (Context, not an amendment: STATUS separately records developer-friendliness tabled 2026-09-13, sources parked in docs/parked/developer-friendliness/, so the plugin this decision moved work out of is itself no longer live; the D* rows' fates are recorded under other decisions, not this one.)

### (35)

> (35) The issue-tracking question is asked at setup, on `/machinery:setup issue-tracking`, and also on first need: before filing any ticket or issue, the tickets skill runs #99's `decide`; if it prints `issue_tracking: ask`, it runs the setup `issue-tracking` item first.

**Moved 0 row(s)** — no rows cite this decision (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this decision adds a trigger (ask on first need as well as at setup) and no extracted rule item was dispositioned under it.

### (36)

> (36) Re-running `/machinery:setup issue-tracking` replaces the recorded answer: a replacement inbox entry, intake overwrites `.claude/rules/project_issue_tracking.md`, the commit message names old and new answer (git keeps history; the file holds one current answer, not a history record). Mechanism: #99's `record-project` accepts a replacement instead of refusing a second entry.

**Moved 0 row(s)** — no rows cite this decision (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this loosens a mechanism (record-project now accepts a replacement instead of refusing a second entry) and no extracted rule item was dispositioned under it.

### (37)

> - (37) `install --machine` is dropped. Its core job is replaced by the hooks (21); its remaining job — #99 seeding `~/.claude/rules/global_issue_tracking.md` — becomes on demand: `record-global` creates the global file when someone first answers "every project", and `decide` treats a missing global file as unanswered. Affects `issue-tracking-build`, whose Task 2 (committed 0882a0b) seeds both files at install: the machine-wide seed must come out there.

**Moved 0 row(s)** — none (0 rows: skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — no extracted rule was dispositioned under this decision; it drops an installer flag (`install --machine`) and defers the machine-wide issue-tracking seed to first use, and the shipped machinery still refuses `--machine` by name (STATUS § Built 2026-09-14).

### (38)

> - (38) Keep a reload command (`/machinery:reload`): prints the current `core.md` into the running session on request, so a universal rule filed mid-session takes effect without restarting.

**Amended later, and the amendment is what holds:**

> - (43–48, owner 2026-09-14, plan questions; all as recommended) … 44: ship a small `reload` skill; `rule-process` no longer claims to replace reload.  [Also bears on it: (54, owner 2026-09-14) … A `URULE:` is universal for the user: it files into `~/.claude/rules/universal.md` … and never edits the plugin's `core.md` or skills — so what reload must reprint is the user's `universal.md`, not only `core.md`.]

**Moved 0 row(s)** — none (0 rows: skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this decision only keeps a capability (a reload command), and 44 shipped it as its own skill.

### (39)

> - (39) No defaults for unrecorded setup items other than `worktree` (always): when test tiers, comparison-agent timing or review-before-main is not recorded, the hook or skill that needs it stops and names the `/machinery:setup <item>` to run.

**Amended later, and the amendment is what holds:**

> - (51) The pre-commit's `tiers.fast` / `components` not-recorded refusal (39) applies only to a commit that stages at least one path outside machinery's own files. Amended 2026-09-14: "machinery's own files" is defined as what install.mjs stages, spelled once as `MACHINERY_OWN` in `scripts/lib/own-files.mjs` (`.githooks`, `.claude/rules`, `.claude/machinery/` inbox, spec inbox and tool catalog, `.gitignore`, `docs/dictated-specs`); install.mjs stages that list and tiers.mjs exempts it, with a test that the two cannot drift. An empty index prints `fast_tier: 0 of 0 touched components failed (nothing staged)` and exits 0. A commit staging only those files has no code a test could cover, so `tiers.mjs fast` prints `fast_tier: 0 of 0 touched components failed (machinery's own files only)` and exits 0, whether or not tiers are recorded. This is the plan's existing 'nothing staged in a component → 0 of 0' case applied before the recorded-settings check, so install and setup can commit their own files before tiers exist. Decision 39 is otherwise unchanged: the first commit touching project code still refuses until tiers and components are recorded.

**Moved 0 row(s)** — none (0 rows: skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this decision adds a refusal (stop and name the `/machinery:setup <item>`) rather than removing any rule; decision 51 later narrowed that refusal so commits touching only machinery's own files pass.

### (41)

> - (41) Owner: "since this is smart machinery, Claude should take the lead and ask these actual questions that you've been asking me to the user". Per-project behaviour choices are not fixed in machinery: the setup wizard leads, asking the user the same questions this recalibration asked the owner, each with Claude's recommendation first. For test tiers that means asking who sets up tests, how a test declares its tier, the tier commands, and how a new test gets its tier (Claude asks per test, Claude proposes a batch per commit, or Claude decides) — recorded as `tiers.assignment` alongside `tiers.declaration` and the commands. Supersedes 40.

**Amended later, and the amendment is what holds:**

> It supersedes the retracted (40): "- (40, RETRACTED by the owner 2026-09-14 — superseded by 41) Who assigns a test's tier depends on who set up the tests: when Claude sets up tests (the suite, or a new test it writes), it suggests the tier and asks the user; when the user set them up, Claude just asks the user. Refines 23. Config format stands as drafted …". Later refinements: "- (43–48 …) 45: components for `tiers.fast` come from a recorded `components` setting (name → path prefix), asked in setup. 46: build/format checks are their own recorded key `checks.commit`, asked in setup, run before `tiers.fast`. 47: `tiers.assignment` values `ask-per-test`, `propose-per-commit`, `claude-decides`."

**Moved 0 row(s)** — none (0 rows: skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — no extracted rule was dispositioned under it; it replaced the retracted decision 40's fixed rule about who assigns a test's tier with a per-project answer the setup wizard asks for and records as `tiers.assignment`.

### (42)

> - (42) By 41, two draft questions close as setup questions: comparison-agent timing is asked in setup, telling the user that a git hook cannot launch an agent, so "before push" is a step Claude carries out; transcript retention is asked in setup, telling the user it is machine-wide. With 37–42 the draft has no open questions.

**Moved 0 row(s)** — none (0 rows: skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this is a bookkeeping ruling that closes two open draft questions by routing them into the setup conversation.

### (50)

> - (50) `reviewBeforeMain` value `none` renamed `no-review`: #99's scan keeps state words (`none`) spelled only in lib/layout.mjs; the value name was the draft's, not a ruling.

**Moved 0 row(s)** — no rows cite decision 50 (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this renamed one config value so a scan for the literal word `none` would not trip over it.

### (51)

> - (51) The pre-commit's `tiers.fast` / `components` not-recorded refusal (39) applies only to a commit that stages at least one path outside machinery's own files. Amended 2026-09-14: "machinery's own files" is defined as what install.mjs stages, spelled once as `MACHINERY_OWN` in `scripts/lib/own-files.mjs` (`.githooks`, `.claude/rules`, `.claude/machinery/` inbox, spec inbox and tool catalog, `.gitignore`, `docs/dictated-specs`); install.mjs stages that list and tiers.mjs exempts it, with a test that the two cannot drift. An empty index prints `fast_tier: 0 of 0 touched components failed (nothing staged)` and exits 0. A commit staging only those files has no code a test could cover, so `tiers.mjs fast` prints `fast_tier: 0 of 0 touched components failed (machinery's own files only)` and exits 0, whether or not tiers are recorded. This is the plan's existing 'nothing staged in a component → 0 of 0' case applied before the recorded-settings check, so install and setup can commit their own files before tiers exist. Decision 39 is otherwise unchanged: the first commit touching project code still refuses until tiers and components are recorded.

**Amended later, and the amendment is what holds:**

> "Amended 2026-09-14: 'machinery's own files' is defined as what install.mjs stages, spelled once as `MACHINERY_OWN` in `scripts/lib/own-files.mjs` (`.githooks`, `.claude/rules`, `.claude/machinery/` inbox, spec inbox and tool catalog, `.gitignore`, `docs/dictated-specs`); install.mjs stages that list and tiers.mjs exempts it, with a test that the two cannot drift." (The amendment sits inside the same bullet; no later bullet revises it.)

**Moved 0 row(s)** — no rows cite decision 51 (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this carved a bootstrap exemption into decision 39's refusal so install and setup can commit machinery's own files before tiers exist, and the bullet explicitly leaves 39 otherwise intact ("the first commit touching project code still refuses until tiers and components are recorded").

### (52)

> - (52, 2026-09-14, adjudicated in-session, flagged for owner review) `tiers.mjs` (fast and merge) and `setup.mjs` resolve the CHECKOUT root (`git rev-parse --show-toplevel`, add `checkoutRoot()` beside `projectRoot()` in lib/root.mjs), not the common-dir project root: staged paths, `config.json` and the tier commands belong to the checkout being committed, and with `worktree: always` (22) most commits happen in linked worktrees. The gate's inbox check keeps `projectRoot()` (the inbox is shared at the project root by design). TDD: a tiers test with a linked worktree fixture (`git worktree add`) — a path staged only in the worktree → `tiers fast` names that component; run red (today it reads main's index), then green. Do this first, as its own commit (B2.1), bump.

**Moved 0 row(s)** — no rows cite decision 52 (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired — this fixed a bug (worktree commits ran the gate and tiers against main's index) by resolving the checkout root, and deliberately kept `projectRoot()` for the shared inbox check.

### (53)

> - (53, 2026-09-14, adjudicated in-session, flagged for owner review) B8 for this repo — the plugin's own source — installs no copies: no `.githooks/machinery/`, no `install.mjs` run, no root-level `.claude/` seed files, `core.hooksPath` untouched. Its `.githooks/pre-commit` calls the scripts in place: `node plugins/machinery/scripts/gate/gate.mjs --root plugins/machinery --universal` (the universal inbox leg, kept), then `exec node plugins/machinery/scripts/tiers.mjs fast`; `.githooks/pre-push` runs `exec node plugins/machinery/scripts/tiers.mjs merge`. `checks.commit` = `node scripts/build-skills.mjs check`. `tiers.fast` for `machinery=plugins/machinery/` runs `node --test 'plugins/machinery/test/*.test.mjs'` and for `build=scripts/` runs `node --test 'scripts/test/*.test.mjs'` — implement `<components>` however tiers.mjs substitutes it (a small `scripts/test-tier.mjs <fast|merge> [components…]` dispatcher is acceptable if substitution cannot express per-component commands; say which). Drop the 20 s budget line (say so). `tiers.merge` = both suites + the check. With (52) in place, `setup.mjs set` works directly in this worktree. The B8 test (in `scripts/test/`) asserts the two hook files' exact text and `setup.mjs show` → `11 of 11`. Then B7 as dispatched, adding to STATUS's out-of-scope list: "after merge, worktree commits ran the gate/tiers against main's index until 52" is now fixed, so omit it.

**Amended later, and the amendment is what holds:**

> Reversed in part by decision (54, owner 2026-09-14), later in the same file: "The commit gate's inbox check reads the project inbox and the user inbox, so an unfiled URULE still blocks commits in any project; this repo's pre-commit drops its `--universal` leg." Decision 53 had kept that leg ("`--universal` (the universal inbox leg, kept)"); the owner's 54 removes it, and 54 is what holds.

**Moved 0 row(s)** — no rows cite decision 53 (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** No extracted rule item was retired; the only thing this decision dropped is this repo's own 20-second machinery-suite time budget on the pre-commit hook, which was a local hook setting and is not among the 822 items (grep for '20 s'/'20s'/'20-second' in all-rules.json returns 0).

### (54)

> - (54, owner 2026-09-14) "urule shouldn't be automatically added to the plugin. It should be universal for the user." A `URULE:` is universal for the user: it files into `~/.claude/rules/universal.md` (Claude Code's per-user always-loaded location; reaches subagents through the CLAUDE.md hierarchy; survives uninstalling the plugin) and never edits the plugin's `core.md` or skills — those change only by editing the repo. The universal inbox is the user's: `~/.claude/machinery/inbox.md`. `~/.claude/machinery.json` / `pluginSource` are removed. The commit gate's inbox check reads the project inbox and the user inbox, so an unfiled URULE still blocks commits in any project; this repo's pre-commit drops its `--universal` leg. Supersedes the A5 design (plugin-source filing) and the `pluginSource` step in § Built. Plan Task B9.

**Moved 0 row(s)** — no rows cite this decision (skill 0, core 0, merged 0, mechanism 0, parked 0, dropped 0). **Retired 0.**

**What the project no longer has:** Nothing was retired: decision 54 is a plumbing ruling made 2026-09-14, a day after the disposition draft was written, and it moved no extracted rule item — it only redirected where a URULE lands (the user's `~/.claude/rules/universal.md` instead of the plugin's `core.md`) and removed the `~/.claude/machinery.json` / `pluginSource` mechanism, which was implementation scaffolding rather than a rule the assistant reads.

