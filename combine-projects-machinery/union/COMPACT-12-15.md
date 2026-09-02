# Groups 12–15, compacted

These are the four most detailed groups — standing agents, the register system,
commit gates, merge gates and ratchets — compressed so each mechanism fits in
one look and you can judge whether it worked. RECONCILIATION.md remains the
record: every statement here ends with the row ids it came from, and every
demand, trigger, blocking status, ordering and exception those 134 universal
cells carry is still derivable here — rationale, incident narrative and
cross-reference chains are what was cut.

**How to read.** A mechanism is one line in a fixed shape: **name — when it runs
— what it checks — blocks / warns / reports — what "worked" looks like**.
Everything else is one rule per line, trigger first. Bracketed ids are the source
rows; where several rows say one thing from different angles they became one
line and all their ids are listed. `⚔` marks the one genuine conflict in these
groups. No row in 12–15 is excluded from the union and none defers to the
mandatory design skill, so all 134 ids carry live statements here.

## Decision sheet (owner, 2026-09-02)

Groups 12–15 were ruled at mechanism level. This supersedes both halves of the
last sentence above: eleven group-12 rows are now `✗ not in union`, so 123 of the
134 ids carry live statements here and eleven carry the record of a drop. A `✗ `
on a line below means that line's rows are those drops — except where the line
also cites a kept row, which is called out on the line itself.

- DROP the field agent: 12.21, 12.23–12.27, 12.29–12.33. The lines carrying its
  agent-wide demands are unmarked and stand — 12.22, 12.34, 12.46, and 12.28,
  which is the opening rule of the stop-conditions line whose five conditions
  (12.29–12.33) go with the agent.
- DROP, outside these groups: the mapping-pass method (6.31–6.35) and the
  render-drift check (6.22); the principle that a derived document is generated
  rather than hand-maintained stands.
- DROP the specific ledger-table check. Its line here carries no `✗`, because
  14.10, 14.11 and 9.158 keep their rows: a table people rely on is still checked
  structurally, and only that one document's check goes.
- SIMPLIFY the parity verifier to a generic comparison agent — verdict first,
  regression told from pre-existing difference, never edits to pass, never
  rebakes — with the product-specific parity checks left in the project.
- SIMPLIFY the register to an index over `rules/` (the phase-3 shape ruling).
- SIMPLIFY the commit gate to four fast checks, run on every commit: the
  register check and the citation-target check, which the gate executes and
  rejects on; plus "bypass twice → fix the checker" and "tracked in tree,
  activated per clone", which its header states and a person applies. One
  advisory sweep warning rides beside them and never blocks. Heavy checks belong
  to the merge gate.
- KEEP as written: the enforcement auditor, the agent conventions, the register
  check, the decision records, the sweep guard, the merge gate, the ratchet and
  the doc-vs-code gates.

---

## 12. Standing agents — 47 rows

**Rules every agent obeys**

- On defining an agent: one file states its question, its triggers, its exact tools, its model — nothing folk knowledge. [12.1]
- On anything outside the agent's one question: name it in a line and drop it; never pursue it, never widen scope. [12.2]
- For an agent that only judges: remove its command, edit and write tools rather than forbidding their use, and state the consequence in its own definition — it cannot work out its own scope, so the caller supplies it. [12.3, 12.4]
- Given neither a diff nor a changed-file list: say exactly that and stop — never audit everything as a substitute, never guess scope from timestamps or file contents. [12.4]
- Where the job genuinely needs to build and run things: say in the definition that containment is weaker, and replace it with an explicit allowlist of build, test and read-only inspection commands. [12.5]
- For an agent that verifies or reviews: forbid by name every command that moves a reference or mutates the working copy — creating, moving or deleting a branch, merging, force-resetting a shared reference, pushing, checking out, resetting, rebasing, committing, stashing, adding or removing a working copy. You verify; you do not integrate. [12.6, 12.7]
- For a reviewing agent: never stage the owner's protected working records, whatever else it was asked to look at (same files protected at commit time, 5.11). [12.8]
- For agents implementing in parallel: one unit each, writing only inside its own directory, so two cannot collide over one file. [12.9]
- For an agent that generates content: never commit to a protected branch — an adversarial review pass and a person both stand in between. [12.10]
- On a scan flagging a candidate: treat the output as a suspicion, never a fact; act only after a person has read the code and recorded a confirmation naming the exact place. [12.11]
- On a question another agent owns: name that agent, hand off, and do not duplicate its checks. [12.34]
- On citing an authority record that was never ratified: its content is still the best available description of behaviour, but any question it leaves open stays genuinely open. [12.46]
- On automatically generated proposals: gate them on the build, the tests and the relevant checks before any person reads one; whatever does not survive is discarded unread. Attention is what the gate protects. [12.47]

**The three agents**

**Enforcement auditor** — runs when a change touches code that states an invariant, before a branch merges, when a new single route is introduced, and over any code whose comment claims something holds by construction — asks which stated invariant this change weakens and how strongly it is really enforced — reports only; it blocks nothing — worked when: every finding quotes the claim in the source's own words with its location, gives the strength the prose implies against the strength the mechanism delivers with the specific reason for the gap, and ends in either the concrete change that reaches the top of the scale or the exact debt row to add instead; a clean audit is one line, never padded. [12.12, 12.17, 12.19]

- Read the ledger first, loading only the parts covering what changed — it holds claimed invariants only, so a property that is true but never stated is not a row and must not be invented — then find each claim by searching the changed file and its surroundings for the vocabulary of assertion, the claim being whatever the source promises a reader. [12.13, 12.14]
- Rate the mechanism, not the sentence — constructor, visibility, unit boundary — and run the second-call-site tripwire and the obligation to strengthen or record weak neighbours as explicit steps (those rules are 9.10, 9.8, 9.78). [12.15]
- Always flag the standing catalog of ways a claim outruns its mechanism (9.49–9.75), each flag citing a comparable live example, so a finding is a pattern with evidence rather than an opinion. [12.16]
- Order findings by severity and substantiate each from a file actually read; where the deciding code was not opened, report the rating as unverified rather than inferring it from a name. [12.19, 12.20]
- Close with the ledger delta: which entries this change makes stale, which it should add. [12.18]

✗ **Field agent** — runs to add one configuration field, to audit one, to explain why a value is not reaching the product, and to review a change touching any of its surfaces — covers that field across all seven: its definition, its type, its wiring, whatever is generated from it, its inheritance and origin, its arrival from foreign inputs, and the gates over all of that — changes and reports, and stops rather than deciding — worked when: it named the authority for every layer, changed only the authority, ran the covering gates and quoted their real output, shipped a test, and either finished or filed and stopped. [12.21 dropped; 12.28's stop-and-file rule is KEPT and lives in rules/agent-topology.md — only the field-agent framing of it goes]

- It owns no layer's design: name the authority for each and verify against it, read fresh every time, because restating elsewhere a fact that lives somewhere is how that fact rots. [12.22]
- ✗ Locate the field's current state on every surface before proposing any change, naming which layers it is complete at and which it is missing from. [12.23]
- ✗ Make the change at its one authority — the hand-authored source, the wiring, or the design record — never at anything generated from them. [12.24]
- ✗ Regenerate a generated file, never hand-patch one; if the generator cannot be run, say so and stop rather than editing its output. [12.25]
- ✗ Run the gates covering what was changed and report their real output — the verdict and the count each printed, never a paraphrase; a gate reporting success with no count is not evidence (8.21). [12.26]
- ✗ Ship a test with the change; nothing is too small to be exempt (3.21). [12.27]
- Stop and file the work — never block on it, never resolve it silently, never improvise; an agent applies authority, it does not adjudicate design (6.15–6.18) — on any of: a value with no defined origin under the standing design, such as one arriving from another product's file [12.29]; two sources that could both supply a value with no stated winner [12.30]; something complete at the central wiring point but with no downstream consumer and no recognised reason for having none [12.31]; a change needing a new case in the design's own state set, which is the owner's amendment and not a per-field judgement [12.32]; a generated file that must change, whose generator cannot be run, with no safe hand-edit [12.33]. [12.28]

**Comparison agent** — runs before merging anything that could move the product's output: engine changes, default-value changes, algorithmic or performance rewrites — a change to a default value must run it, because fallbacks further down drift silently and a default change passing only the unit suite is unverified, not verified — runs the product against the known-good reference — delivers the one verdict a merge decision rests on — worked when: it led with a one-word verdict and you could tell a regression from a pre-existing difference without re-running anything. [12.35, 12.41]

- The exit status is not the verdict: the harness fails on any mismatch and one mismatch is known and expected, so reporting failure on that is a false alarm — and reporting a pass because a different row failed while the old one was fixed is worse (3.29). [12.36]
- Establish the baseline before judging — the set the caller supplied, or the recorded pre-existing one. If a difference cannot be confidently attributed, label the run unbaselined and say plainly you cannot separate a regression from something pre-existing; never resolve the ambiguity by guessing. [12.37]
- Classify every non-informational row as newly broken, already broken, or newly fixed, and report the fixes as well: an unexplained improvement usually means a tolerance or a measurement moved, not the product. [12.38]
- Rows marked informational never affect the verdict, and the definition says so, so nobody decides it case by case. [12.39]
- Never truncate the output. The table is the evidence, a truncated one has hidden failures before, and if it is long you read all of it (the general form is 3.23). [12.40]
- Tolerances are deliberate and stated per kind of row — a wide one exists to catch a fault of the wrong order of magnitude, not a cosmetic difference — and are never tightened to manufacture a finding (3.34). [12.42]
- Read the harness's own configuration — where it expects the reference, where it writes artifacts, which build of the product it compares — rather than assuming any of it. [12.43]
- Output shape: the one-word verdict, then the full table word for word, new differences with both values and the likely area responsible, expected ones named and dismissed with the reason, cases that did not run and what would enable them, and the environment actually used. [12.44]
- A missing prerequisite is reported as a blocked run naming what was missing; a partial run is never substituted for a verdict. [12.45]

*Resisted compaction: this group runs past one screen because three agents each carry their own procedure and output contract, and those are the lines you would check "did it work" against; the field agent's five stop conditions are five distinct triggers with no shared shape, so they are one line of five clauses rather than one statement.*

---

## 13. Register system — 32 rows

**The documents**

- Two documents, two jobs: one records what was decided, the other how strongly each decision is actually held in code. They cross-link and never duplicate, so every fact has exactly one home. [13.1]
- Everything else that states a rule — specifications, plans, the learnings notebook — is immutable history the register cites, never edited to reflect a later decision; rewritten history stops being evidence. [13.2]
- File rules bearing on one decision in one group, ordered by adoption date, whether they agree with it, sharpen it or contradict it, so the group reads as one argument's history. [13.3]
- Mark every group with exactly one of three statuses: settled (rules agree, or the disagreement ended in a written verdict); weakly settled (the verdict is only inferred, or a deviation is documented but never reconciled); unsettled (opposing rules both still live). [13.4]
- Label a verdict nobody actually ruled on as inferred; drop the label and cite the ruling the moment a real decision lands. [13.5]
- File a rule with no sibling in a by-area section carrying neither a summary nor a status mark — a lone rule has no disagreement to characterise. [13.6]
- Open the register with a contents list: every group by name, its status, its rule count. That list is the cheap surface a where-does-this-belong search reads first (2.13). [13.7]
- Give every row three things and only three: the adoption date, the rule in one sentence, a citation to where the rule actually lives. [13.8]
- Keep the maintenance rules inside the register itself, and have them name the check that enforces them. [13.9]
- A dated decision record is not a policy manual: once accepted its body is frozen, and only a status change or a decision-preserving correction may edit it [13.24]; on changing the decision, land a new superseding record that flips the old one's status in the same change, never an in-place edit [13.25].
- Know which kind of document you are editing: living ones are kept current with the code; a dated ruling is meant to go stale, and updating one to match today destroys the record rather than maintaining it. [13.26]
- Update the document that maps how the system behaves in the same change as the code, along with any data or page generated beside it — never as a follow-up. A map that lags is worse than none: it is read and believed. [13.27]
- "Updated" is defined, not left to taste: the section for the part you changed describes the new behaviour, a difference you closed is re-marked with the change that closed it, and an item whose work landed has its status flipped. [13.28]
- On fixing something in an area the map does not yet describe at the depth you need: map that area first, to the map's own template — never work from a guess. [13.29]
- Treat a stale map as a failing test, not a documentation gap. [13.30]
- On a rule that matters to two groups: file it in the one whose trigger it actually fires on and cross-reference from the other with the reason; never copy it in as a second row, because two copies drift and neither knows it. [13.31]
- Before folding a new rule into a group that looks like its home: ask whether that group's own remedy would have produced this rule's fix. If it would not, they are different rules however alike they read. [13.32]

**Register check** — runs in the commit gate and in the hosted check, over the register and the documents it cites — its own header enumerates what it blocks on and, separately, what it only advises — advisory output never changes the exit status — worked when: a reader of either the header or the output can tell blocking from advisory without reading the code. [13.10, 13.23]

Blocks on:

- Every row citation naming a file that exists — line numbers drifting is normal and tolerated, the file being gone is not [13.11] — and a line that is not empty [13.12]; exactly one status mark on every group heading and none on a lone-rule heading [13.13]; every section citation resolving to a real heading, matched on its leading words, so a row may name a heading that itself carries a suffix [13.15].
- Retirement in both directions: every stamp on a retired document names a group that exists, and every supersession row names a real file carrying the stamp pointing back. One direction alone is a dangling link neither side can see from where it stands. [13.14]

Deliberate limits, each stated in the tool's own header:

- The citation checks are structural only: they never check that a cited line still supports the claim beside it, so a citation whose target drifted onto different real content passes, by design — and a check whose name sounds like it validates something says in its own header exactly what it validates and what it does not. [13.12]
- It skips fenced code blocks when reading headings — a line inside a quoted snippet matches the heading pattern exactly, and a citation would resolve to something that is not a section. [13.16]
- Where two checks split a space, each covers its own half completely: a file cited only in the form one check reads is reported missing by that check, never left to the other, which will never see it. [13.17]
- It reads only the rows carrying live claims, never the prose around them; otherwise the section documenting the format fails the rule it states, and a header's example reads as a real entry. [13.18]
- It hands a case off only to a check that actually exists, and says what it handed off and what that leaves unverified. Where no such check exists the case fails rather than being skipped: a skip with nobody behind it passes forever. [13.19]
- A check that could never fail here is dropped rather than ported, with the absence and what covers that ground stated in the header. A check that can never fail proves nothing and reads exactly like one that works. [13.20]

Advises on:

- An unsettled group naming no ticket anywhere near it — an open disagreement with nowhere to follow it is how one gets forgotten. [13.21]
- On request, named files scanned for rule-shaped lines, with one note per file no row cites — the finding is that the file is uncited, not how many such lines it holds. [13.22]

Trusting it:

- Prove the check can fail before trusting it: either a self-test red-checking every blocking failure mode against fixtures, or a live falsification that introduces one real violation per check, records exactly what each mode caught, and reverts. A gate nobody has seen fail is indistinguishable from a broken one. [13.23]

*Resisted compaction: the eighteen document rules are eighteen separate obligations with separate triggers — folding any two would hide one of them — so this group lands near a line per row and slightly over one screen.*

---

## 14. Commit gates — 18 rows

**Commit gate** — runs at commit time, on every commit, once activated per clone — its own header names every check it runs, whether each blocks or only advises, how the gate is activated and how it is bypassed — mechanical checks may block; a check matching on the content of prose may only warn, never reject, because guessing at what a sentence means is not something to stake a commit on — worked when: every run printed its own count, zero included, so a normal pass never reads as silence indistinguishable from a broken check (8.21). [14.1, 14.2, 14.9]

- ⚔ On a cheap commit check: run it on every commit, not only on the commits that touch what it checks — the file-list condition is itself a judgement about where a violation can come from, and it is silent when that judgement is wrong. The overruled form gates only the commits touching the checked surface, arguing that a gate firing on every commit is one people switch off. Same ruling as 2.6, stated there for the register check. dropped nuance: the narrow form also keeps every unrelated commit fast, which is what made the check affordable to its author. [14.3]
- Validate a citation once, when it is created, over the lines the change adds. Never re-audit existing ones: their line numbers moving is normal, and a check that goes red on ordinary drift is noise somebody eventually turns off. [14.4]
- A creation-time check belongs in the commit gate: the moment a commit is made is the moment the thing is created. [14.5]
- Read content from what is actually being committed — in merge mode, from the tip being merged — never from the working copy, so a half-staged file cannot make the gate pass or fail on bytes nobody is committing. [14.6]
- State in the header what is deliberately not checked and why: judging whether a citation supports the claim beside it needs a person, and a heuristic that flagged correct ones would get the whole check disabled, so it is left undone and said so (9.96). [14.7]
- A checking tool excludes itself and its own tests from its scan, because a self-test's fixtures are check-shaped data rather than real claims. Run the tool against its own change on purpose; that is how this gets found. [14.8]

**Table-structure check** — runs at commit time over any table people rely on, which is checked structurally rather than proofread: a row with the wrong number of cells still renders, it just silently drops or merges a column, and where the document exists so a claim can be traced to its mechanism that eaten cell is exactly the failure it exists to prevent (9.158) — every row carries the header's cell count, and no row holds a placeholder standing in for a reference nobody filled in — blocks — worked when: every rendered row shows the full set of columns, and a row naming no reference shows a plain dash rather than an IOU that reads like a pending fact. [14.10, 14.11]

- Audit deliberately for checks that exist but nothing runs — a gate written and never wired is not enforcement — and wire each one where the consequence of its regression actually lands. Runtime is rarely the reason not to. [14.12]
- Track hooks in the repository and activate them per clone by one explicit command; never self-installing. A hook nobody can see in the tree is one nobody maintains, and one that installs itself silently is worse. [14.13]
- The gate names its own escape hatch for a genuine emergency, and names what using it twice means: the checker is wrong, and the fix is the checker, not the habit. [14.14]

**Hosted document checks** — triggered by exactly the files their gates read, plus a manual start — kept apart from the checks that build the product and needing none of the build toolchain, because a full build for every documentation edit teaches people to batch documentation edits, which is how a register rots — blocks (inferred: rows 14.15–14.18 state the separation, the platform and the self-tests, never the blocking status itself; read as blocking because they run the same checks the commit gate blocks on) — worked when: every gate was measured passing on the commit that introduced it, on the platform it actually runs on (a gate measured elsewhere is noise), and each has a demonstrated way of going red, its own self-test running as a gate beside it. [14.15, 14.16, 14.17, 14.18]

*Your standing note on 14.3 in the table: you suspect different kinds of check have bled together, which is what makes the every-commit form slow.*

---

## 15. Merge gates and ratchets — 37 rows

**Merge gate** — runs at merge time, locally, against the merged result and never against the branch alone, because the other side may have deleted what you call or outlawed the form you wrote since you branched — runs the full battery of legs below — blocks the merge — worked when: you confirmed the gates actually executed rather than assuming it (a hosted service can report failure for days while merges keep landing), and the verdict came from diffing the run's failure set against a committed baseline rather than from an exit status, which over a tree with a known standing red set means either ignoring the gate or never passing it (3.29). [15.1, 15.2, 15.3]

How it judges:

- Report the newly passing cases as loudly as the newly failing ones: a case that starts passing is either good news or a check that has stopped checking, and nothing in the result tells you which. [15.4]
- Build into the gate's own directory rather than one shared with the working copies; concurrent use of a shared one produces errors that contradict the source (5.16), and the gate is the worst place to diagnose that. Sharing stays available as an explicit, deliberate override. [15.5]
- The quick mode exists for iterating and is never used for a merge; what it skipped prints as skipped, never as passed. [15.6]
- Capture the exit status of the command being checked, never of something piped after it: a trailing filter reports its own status, and that has turned a red battery green more than once. [15.7]
- Resolve everything the run depends on once, before the first check; what cannot be resolved aborts the whole run loudly, naming what was looked for, rather than failing quietly later and leaving a stale artifact a subsequent check reads as a real verdict. [15.8]
- Where a check can succeed having run nothing — a name filter that stops matching, a scan that walks no files — additionally require evidence that at least one case ran. Nothing-of-nothing and a healthy pass are the same exit status. [15.9]
- A missing verdict is a hard failure, never a fall-through to whatever the last run left behind, and an unrecognised verdict is a hard failure too: only the outcomes the gate defines are allowed to pass. [15.10]
- One component owns parsing a result, checking its evidence and holding its baseline; the gate only renders that verdict in its own vocabulary. Two independent readings of one output are two opinions of one fact and will eventually disagree (9.89). [15.11]
- A check working from a list of changed files verifies that the command producing the list succeeded: swallowing its failure yields an empty list, which reads exactly like "nothing changed" — a crash wearing a pass. [15.12]
- Never trust the order of a merge's parents: compare against both, or resolve the pre-merge tip directly, and pin it with a case built the wrong way round that proves the gate goes red. [15.31]
- Pin the toolchain explicitly in the verification's own configuration — not a floating channel, not read from somewhere the build could override — so moving it is a deliberate one-line change somebody can see. [15.32]
- Fix an intermittently failing check at its cause: never a retry, a rerun-the-failures step, an ignore marker, or forcing everything to run one at a time, each of which keeps the gate green while it stops meaning anything. [15.33]
- A switch that limits what ships must not limit what gets compiled while verifying: keep it for weight in the shipped product and build everything when checking, or the code behind it is never compiled at all. [15.34]

Its legs:

- Format only the files the change actually touches, with the pinned formatter, one file at a time — never a package or directory root, which reformats siblings the change never touched and has to be reverted every time. [15.13, 15.14]
- Named parts of the tree may be exempt from formatting altogether, to preserve drift that predates the rule, and generated output is skipped; new files inside an exempt area may still be formatted individually. [15.15]
- The build is warning-free: something unused is deleted or explicitly marked as existing for the tests, never left generating a warning nobody reads — a warning always present is one nobody notices the day it means something. [15.16]
- Compile twice, not once: every optional feature on with every target included, and separately with the optional features off, because an all-on build cannot see code that breaks when something is switched off. [15.17]
- The defect-check leg runs a deliberately chosen class rather than everything available, so the gate is about defects rather than taste. [15.18]
- Comply with a new rule at the call site that owes it rather than changing shared behaviour for every caller inside a change about something else; the wider change is a decision of its own and gets its own work. [15.19]
- A tool the ordinary suite never reaches has its own tests run by the gate that consumes it, before its numbers are trusted. A check nothing runs is not enforcement. [15.20]
- A document stating a fact about the code is machine-checked against the code, so the change that moves the fact either updates the document or turns the gate red; run this in the hosted check and in the merge gate both. Where the document could instead be generated from the code, that is the stronger remedy and this is the fallback (9.63). [15.36]
- Two artifacts that must describe the same thing are checked against each other and advance together; where the full check cannot run, run the part that can rather than skipping it. Unchecked they drift quietly into two descriptions of one thing with nothing saying which is current; a generator deriving one from the other is stronger still (9.63). [15.37]

**Standing-measurement ratchet** — runs inside the merge gate, after the measuring tool's own tests (15.20) — compares each category's count against a committed baseline rather than passing or failing on absolute numbers, because the tool is a reporter that always succeeds over a large already-audited standing count and an absolute gate would be red the day it landed, which is a gate everybody learns to ignore — blocks — worked when: any count above the baseline failed as new debt [15.22]; a count that dropped was reported so the baseline was lowered in the same change that earned it, since a ratchet nobody tightens stops being one [15.23]; a category the baseline has never seen failed rather than being adopted silently, entering only by a reviewed change behind the explicit flag [15.24]; and a category that vanished from the measurement was reported for update rather than ignored, since it may mean the work is done or that the detector stopped detecting [15.25]. [15.21]

- Regenerating a baseline is deliberate, explicit and reviewed: today's failures are recorded as the accepted set only once somebody has decided that change to the failing set is correct (3.30). [15.26]
- Measure shipping code only, and print how much was skipped per category: an exclusion nobody can see is indistinguishable from a walk that missed those files, because both print a clean result. [15.27]
- On correcting a measurement's scope: rewrite the baseline from the corrected measurement in the same change; keeping the old numbers forgives real debt along with the part that was miscounted. [15.28]
- A gate that punishes compliance with another standing rule is miscalibrated, not strict: when a count turns out to be dominated by work some other rule required, the scope is what is wrong. [15.29]
- A detector that finds nothing is broken until proven otherwise, and so is a scan that read no files. Both fail rather than pass, because both look exactly like a clean result (9.104). [15.30]
- Record how big each known problem is, not merely that it exists: a census of presence alone lets a defect double in place while the gate stays green. [15.35]
