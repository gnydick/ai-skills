# Test-rule sweep v2 — coverage ledger

Source: `I:IdeaProjectsai-skills` at 9587907. Batch A = 13 files swept here; Batch B = rows MB40–MB63 copied from v1.

**Unit of an "item".** One bullet, one numbered item, one table body row, or one sentence of prose (headings, table header rows, code fences and HTML `<!-- rows: -->` register markers excluded; 10 such markers). Item ids are `<FILE>.<section#>.<n>` in document order, with section# counting every heading in the file.

**Dispositions.** ROW → produced ≥1 row in test-rules-v2.json (a row of mode `shape` is the HOW-NOT-WHETHER bucket: recorded as a row, counted in the "shape" column). NOT-TESTING → no obligation to write, run or check a test/verification. DUPLICATE-OF <id> → the same obligation already has a row.

**File codes.** AT agent-topology · DI design-invariants · EP environment-and-platform · RS reference-sources · RG rule-governance · ST straight-talk · TO tool-output · VE verification-and-evidence · WT work-tracking · WD worktree-discipline (all plugins/machinery/rules/) · CB unbreakable/skills/cant-break-by-design · BR unbreakable/skills/be-reasonable · DF developer-friendliness/skills/developer-friendliness.

## Per-section table

| file | section | items examined | items → rows | rows (of which shape) | NOT-TESTING | DUPLICATE-OF |
|---|---|---|---|---|---|---|
| AT | Agent topology | 2 | 0 | 0 (0) | 2 | 0 |
| AT | What gets dispatched | 4 | 0 | 0 (0) | 4 | 0 |
| AT | Which model | 4 | 2 | 2 (1) | 2 | 0 |
| AT | How many at once | 6 | 2 | 2 (0) | 4 | 0 |
| AT | Batching | 5 | 1 | 1 (0) | 4 | 0 |
| AT | Where an agent works | 5 | 2 | 2 (2) | 3 | 0 |
| AT | Working with the owner | 2 | 0 | 0 (0) | 2 | 0 |
| AT | Defining a standing agent | 3 | 0 | 0 (0) | 3 | 0 |
| AT | Containment is structural | 8 | 4 | 4 (3) | 4 | 0 |
| AT | Aiming a fan-out | 6 | 3 | 3 (1) | 3 | 0 |
| AT | What an agent may conclude | 5 | 3 | 3 (0) | 2 | 0 |
| AT | Handing a ruling to a dispatched agent | 3 | 0 | 0 (0) | 3 | 0 |
| **AT total** | | **53** | **17** | **17 (7)** | **36** | **0** |
| DI | Design invariants | 2 | 0 | 0 (0) | 2 | 0 |
| DI | The mandate | 3 | 1 | 1 (1) | 2 | 0 |
| DI | Where a distinguishing type is created | 6 | 3 | 5 (0) | 3 | 0 |
| DI | Weak claims and the enforcement ledger | 5 | 5 | 5 (2) | 0 | 0 |
| DI | Never re-derive a fact | 4 | 1 | 1 (1) | 3 | 0 |
| DI | Measurement and expectation | 4 | 4 | 4 (4) | 0 | 0 |
| DI | One authority per switch | 8 | 4 | 5 (0) | 4 | 0 |
| DI | Absence and defaults | 7 | 1 | 1 (1) | 6 | 0 |
| DI | The three classes of setting | 4 | 0 | 0 (0) | 4 | 0 |
| DI | External input | 1 | 0 | 0 (0) | 1 | 0 |
| DI | Handing a resource on | 9 | 1 | 1 (1) | 8 | 0 |
| DI | Telling the user what you dropped | 5 | 0 | 0 (0) | 5 | 0 |
| DI | Wiring honesty | 2 | 0 | 0 (0) | 2 | 0 |
| DI | Reading someone else's data model | 5 | 0 | 0 (0) | 5 | 0 |
| DI | Spatial output | 3 | 2 | 2 (1) | 1 | 0 |
| DI | Carrying instrumentation | 6 | 2 | 3 (1) | 4 | 0 |
| DI | What a diagnostic and a measurement may claim | 6 | 4 | 4 (3) | 2 | 0 |
| DI | The base language's own convention | 1 | 0 | 0 (0) | 1 | 0 |
| **DI total** | | **81** | **28** | **32 (15)** | **53** | **0** |
| EP | Environment and platform | 2 | 0 | 0 (0) | 2 | 0 |
| EP | Platform scope | 2 | 0 | 0 (0) | 2 | 0 |
| EP | Resolving a tool | 3 | 1 | 1 (1) | 2 | 0 |
| EP | Dependencies | 6 | 0 | 0 (0) | 6 | 0 |
| **EP total** | | **13** | **1** | **1 (1)** | **12** | **0** |
| RS | Reference sources | 2 | 0 | 0 (0) | 2 | 0 |
| RS | Reference only | 5 | 0 | 0 (0) | 5 | 0 |
| **RS total** | | **7** | **0** | **0 (0)** | **7** | **0** |
| RG | Rule governance | 3 | 0 | 0 (0) | 3 | 0 |
| RG | Dictating a rule | 7 | 1 | 1 (0) | 6 | 0 |
| RG | Where a rule lives | 5 | 0 | 0 (0) | 5 | 0 |
| RG | Finding the group it joins | 5 | 0 | 0 (0) | 5 | 0 |
| RG | Filing and closing the loop | 8 | 1 | 1 (0) | 7 | 0 |
| RG | When a belief turns out false | 3 | 3 | 3 (1) | 0 | 0 |
| RG | Honesty about the machinery | 8 | 3 | 3 (0) | 3 | 2 (RG.7.1→MB58, RG.7.2→MB63) |
| **RG total** | | **39** | **8** | **8 (1)** | **29** | **2** |
| ST | Straight talk | 2 | 0 | 0 (0) | 2 | 0 |
| ST | Saying what you know | 3 | 2 | 2 (0) | 1 | 0 |
| ST | Bad news first | 4 | 1 | 1 (0) | 3 | 0 |
| ST | How much to say | 3 | 0 | 0 (0) | 3 | 0 |
| ST | The words you use | 1 | 0 | 0 (0) | 1 | 0 |
| **ST total** | | **13** | **3** | **3 (0)** | **10** | **0** |
| TO | Tool output | 3 | 0 | 0 (0) | 3 | 0 |
| TO | Proof lines and denominators | 4 | 4 | 4 (1) | 0 | 0 |
| TO | Heartbeats | 6 | 1 | 1 (0) | 5 | 0 |
| **TO total** | | **13** | **5** | **5 (1)** | **8** | **0** |
| VE | Verification and evidence | 2 | 0 | 0 (0) | 2 | 0 |
| VE | Predict before you work | 6 | 6 | 6 (1) | 0 | 0 |
| VE | Declare the standard you are claiming | 2 | 2 | 2 (0) | 0 | 0 |
| VE | What the check could actually see | 4 | 4 | 4 (1) | 0 | 0 |
| VE | The word you just wrote makes a check due | 12 | 12 | 12 (2) | 0 | 0 |
| VE | Tests | 7 | 7 | 9 (1) | 0 | 0 |
| VE | What a test can honestly claim | 5 | 5 | 7 (0) | 0 | 0 |
| VE | Comparison runs and baselines | 7 | 7 | 7 (2) | 0 | 0 |
| VE | Measuring performance | 12 | 12 | 12 (4) | 0 | 0 |
| VE | Before you write code | 1 | 1 | 1 (0) | 0 | 0 |
| **VE total** | | **58** | **56** | **60 (11)** | **2** | **0** |
| WT | Work tracking | 2 | 0 | 0 (0) | 2 | 0 |
| WT | A ticket and its companion | 9 | 0 | 0 (0) | 9 | 0 |
| WT | Creating and shaping a pair | 4 | 2 | 2 (2) | 2 | 0 |
| WT | Reading it and keeping it current | 5 | 0 | 0 (0) | 5 | 0 |
| WT | The owner's own list | 2 | 1 | 1 (0) | 1 | 0 |
| WT | The learnings record | 4 | 1 | 3 (1) | 3 | 0 |
| WT | One editable home | 3 | 1 | 1 (0) | 2 | 0 |
| WT | Staying inside the effort | 3 | 1 | 1 (1) | 2 | 0 |
| WT | A specification handed down | 3 | 0 | 0 (0) | 1 | 2 (WT.9.2→MB60, WT.9.3→MB61) |
| **WT total** | | **35** | **6** | **8 (4)** | **27** | **2** |
| WD | Working-copy discipline | 2 | 0 | 0 (0) | 2 | 0 |
| WD | Creating one | 8 | 0 | 0 (0) | 8 | 0 |
| WD | Working in it | 5 | 3 | 3 (0) | 2 | 0 |
| WD | Committing from it | 7 | 0 | 0 (0) | 6 | 1 (WD.4.5→MB62) |
| WD | Merging and tearing down | 6 | 1 | 1 (0) | 5 | 0 |
| WD | What may be merged | 3 | 2 | 3 (0) | 1 | 0 |
| **WD total** | | **31** | **6** | **7 (0)** | **24** | **1** |
| CB | Skill: apply can't-break-by-design to everything you write | 9 | 2 | 2 (0) | 5 | 2 (CB.1.2→U7, CB.1.8→U10) |
| CB | Can't Break By Design | 4 | 0 | 0 (0) | 3 | 1 (CB.2.3→U3) |
| CB | 1. The ladder | 19 | 1 | 1 (1) | 18 | 0 |
| CB | 2. Techniques | 15 | 0 | 0 (0) | 15 | 0 |
| CB | 3. Strongest tool per language | 12 | 1 | 1 (0) | 11 | 0 |
| CB | 4. The process | 12 | 7 | 8 (1) | 5 | 0 |
| CB | 5. Anti-patterns | 29 | 3 | 3 (2) | 26 | 0 |
| CB | Red-flag phrases | 2 | 0 | 0 (0) | 2 | 0 |
| CB | 6. Continuous review | 7 | 5 | 5 (2) | 2 | 0 |
| **CB total** | | **109** | **19** | **20 (6)** | **87** | **3** |
| BR | Skill: derive the choice, lean toward the cheaper mistake, split two masters, ask when it's genuinely open | 10 | 0 | 0 (0) | 10 | 0 |
| BR | Be Reasonable | 12 | 0 | 0 (0) | 12 | 0 |
| BR | 1.1 Derive it | 10 | 0 | 0 (0) | 10 | 0 |
| BR | 1.2 Lean toward the cheaper mistake | 6 | 0 | 0 (0) | 6 | 0 |
| BR | 1.3 Split what has two masters | 7 | 0 | 0 (0) | 7 | 0 |
| BR | 1.4 Ask when it is genuinely open | 4 | 0 | 0 (0) | 4 | 0 |
| BR | 1.5 Where there is no asymmetry, do not deliberate | 4 | 0 | 0 (0) | 4 | 0 |
| BR | 2. The worked example: storage and presentation | 33 | 0 | 0 (0) | 33 | 0 |
| BR | 3. Reading the asymmetry | 18 | 0 | 0 (0) | 18 | 0 |
| BR | 4. Asking: who, when, and how | 19 | 0 | 0 (0) | 19 | 0 |
| BR | 5. The failure catalogue | 13 | 0 | 0 (0) | 13 | 0 |
| BR | 6. Domain appendix | 3 | 0 | 0 (0) | 3 | 0 |
| BR | 6.1 Representation | 7 | 0 | 0 (0) | 7 | 0 |
| BR | 6.2 Behavior under stress | 7 | 0 | 0 (0) | 7 | 0 |
| BR | 6.3 Contracts and vocabulary | 7 | 0 | 0 (0) | 7 | 0 |
| BR | 6.4 Visibility | 8 | 3 | 3 (1) | 5 | 0 |
| BR | 6.5 Motion | 7 | 1 | 1 (0) | 6 | 0 |
| BR | 6.6 People | 6 | 0 | 0 (0) | 6 | 0 |
| BR | 6.7 Working under a context budget | 44 | 2 | 2 (2) | 41 | 1 (BR.20.40→U25) |
| BR | 6.8 Artifacts, runs, and workspace layout | 17 | 3 | 3 (3) | 14 | 0 |
| BR | 7. The process | 7 | 0 | 0 (0) | 7 | 0 |
| BR | 8. The one-paragraph form | 9 | 0 | 0 (0) | 9 | 0 |
| **BR total** | | **258** | **9** | **9 (6)** | **248** | **1** |
| DF | Skill: park what will be needed again, where it will be looked for, and nothing else | 20 | 0 | 0 (0) | 20 | 0 |
| DF | Developer Friendliness | 10 | 0 | 0 (0) | 10 | 0 |
| DF | 1. What falls into the gap | 6 | 0 | 0 (0) | 6 | 0 |
| DF | 2. A session, worked | 45 | 1 | 1 (0) | 43 | 1 (DF.4.43→D2) |
| DF | 3.1 Will someone need this again? | 5 | 0 | 0 (0) | 5 | 0 |
| DF | 3.2 Where will they look for it? | 6 | 0 | 0 (0) | 6 | 0 |
| DF | 3.3 Is writing it cheaper than reconstructing it? | 4 | 0 | 0 (0) | 4 | 0 |
| DF | 4. The durability ladder | 15 | 0 | 0 (0) | 15 | 0 |
| DF | 5. Paying for it | 1 | 0 | 0 (0) | 1 | 0 |
| DF | 5.1 Writing | 6 | 0 | 0 (0) | 6 | 0 |
| DF | 5.2 Reading | 6 | 0 | 0 (0) | 6 | 0 |
| DF | 6. Domains | 2 | 0 | 0 (0) | 2 | 0 |
| DF | 6.1 Deferred work | 10 | 1 | 1 (0) | 9 | 0 |
| DF | 6.2 Learnings | 5 | 0 | 0 (0) | 5 | 0 |
| DF | 6.3 Decisions | 5 | 0 | 0 (0) | 5 | 0 |
| DF | 6.4 Outcomes | 5 | 3 | 3 (1) | 2 | 0 |
| DF | 6.5 Session continuity | 7 | 1 | 1 (0) | 6 | 0 |
| DF | 6.6 No surprises | 12 | 2 | 2 (0) | 10 | 0 |
| DF | 6.7 Keeping the record true | 5 | 0 | 0 (0) | 5 | 0 |
| DF | 7. The failure catalogue | 16 | 0 | 0 (0) | 16 | 0 |
| DF | Red-flag phrases | 11 | 0 | 0 (0) | 11 | 0 |
| DF | 8. Arriving at a record that is already bad | 7 | 0 | 0 (0) | 7 | 0 |
| DF | 9. The process | 9 | 1 | 1 (0) | 8 | 0 |
| DF | 10. The one-paragraph form | 10 | 0 | 0 (0) | 10 | 0 |
| **DF total** | | **228** | **9** | **9 (1)** | **218** | **1** |
| **ALL Batch A** | | **938** | **167** | **179 (53)** | **761** | **10** |

Rows are counted once per section even when one row cites several items. Batch B adds 24 rows (MB40–MB63) that were not re-examined.

## Item-level dispositions (every section that has at least one ROW or DUPLICATE-OF)

Sections absent from this list are entirely NOT-TESTING; the table above gives their counts.

### AT § Which model

- AT.3.1 — "Use the cheapest model that can do each dispatched…" → ROW M1(shape)
- AT.3.2 — "Match the model to the kind of work: the…" → NOT-TESTING
- AT.3.3 — "When a cheap agent's work fails its spot-check, redo…" → ROW M2
- AT.3.4 — "A plan says which model each kind of task…" → NOT-TESTING

### AT § How many at once

- AT.4.1 — "One agent at a time within a kind of…" → NOT-TESTING
- AT.4.2 — "The standing kinds of task are doing the work,…" → NOT-TESTING
- AT.4.3 — "Dispatch one, wait for it, check its result, and…" → ROW M3
- AT.4.4 — "Before dispatching, check what is actually running, using the…" → ROW M4
- AT.4.5 — "Every dispatch tells the agent it may not spawn…" → NOT-TESTING
- AT.4.6 — "Anything that fans out by construction runs only when…" → NOT-TESTING

### AT § Batching

- AT.5.1 — "A long job made of many self-contained pieces is…" → NOT-TESTING
- AT.5.2 — "Batching changes how much goes into one dispatch, never…" → NOT-TESTING
- AT.5.3 — "Pieces may share a batch only if they can…" → NOT-TESTING
- AT.5.4 — "Report how many batches there were and what each…" → ROW M5
- AT.5.5 — "Dependent tasks go to one agent in sequence; a…" → NOT-TESTING

### AT § Where an agent works

- AT.6.1 — "All work happens in an isolated working copy of…" → NOT-TESTING
- AT.6.2 — "At most one agent per working copy. Two agents…" → NOT-TESTING
- AT.6.3 — "An agent reviewing or exercising work that is still…" → ROW M6(shape)
- AT.6.4 — "A stand-in service started for a piece of work…" → ROW M7(shape)
- AT.6.5 — "Name each agent at spawn for the kind of…" → NOT-TESTING

### AT § Containment is structural

- AT.9.1 — "An agent that only judges is given no ability…" → NOT-TESTING
- AT.9.2 — "Removing a capability has a consequence, and the agent's…" → NOT-TESTING
- AT.9.3 — "Where a job genuinely needs to build and run…" → ROW M8(shape)
- AT.9.4 — "An agent that verifies never integrates: every command that…" → ROW M9(shape)
- AT.9.5 — "An agent that judges does not touch: no reviewer…" → ROW M10(shape)
- AT.9.6 — "A reviewing agent never stages the owner's own protected…" → NOT-TESTING
- AT.9.7 — "An agent doing implementation work in parallel with others…" → NOT-TESTING
- AT.9.8 — "An agent that generates content never commits to a…" → ROW M11

### AT § Aiming a fan-out

- AT.10.1 — "Fan-out removes the cost constraint on spending agents; it…" → NOT-TESTING
- AT.10.2 — "A triage gate sits between whatever harvests candidates —…" → ROW M12
- AT.10.3 — "The number kept is never the test. "Keep the…" → ROW M13(shape)
- AT.10.4 — "The gate reports what it dropped, by category, on…" → ROW M14
- AT.10.5 — "This is the same shape of gate as the…" → NOT-TESTING
- AT.10.6 — "A different axis from how many at once and…" → NOT-TESTING

### AT § What an agent may conclude

- AT.11.1 — "A scan's output is a suspicion, never a fact.…" → ROW M15
- AT.11.2 — "An agent owns none of the designs it works…" → ROW M16
- AT.11.3 — "Where the authority for a decision is a record…" → NOT-TESTING
- AT.11.4 — "An undecided question is filed as work and the…" → NOT-TESTING
- AT.11.5 — "Automatically generated proposals pass a verification gate before any…" → ROW M17

### DI § The mandate

- DI.2.1 — "The cant-break-by-design skill is mandatory: it is invoked for…" → NOT-TESTING
- DI.2.2 — "The rules below extend that skill and never substitute…" → NOT-TESTING
- DI.2.3 — "The strength rating measures only how hard a rule…" → ROW M18(shape)

### DI § Where a distinguishing type is created

- DI.3.1 — "A distinguishing type is only as strong as the…" → NOT-TESTING
- DI.3.2 — "When the place that creates such a type and…" → NOT-TESTING
- DI.3.3 — "Field privacy is a wall around the enclosing unit,…" → ROW M19
- DI.3.4 — "An automatically generated constructor is a public constructor, and…" → ROW M20
- DI.3.5 — "Where a claim rests on a type's fields being…" → ROW M21, M22, M23
- DI.3.6 — "Definitions that could be loaded at run time are…" → NOT-TESTING

### DI § Weak claims and the enforcement ledger

- DI.4.1 — "Any tool that judges enforcement strength carries the published…" → ROW M24(shape)
- DI.4.2 — "An entry in the ledger anchors on a named…" → ROW M25
- DI.4.3 — "Continuous review of the ledger runs on request or…" → ROW M26
- DI.4.4 — "It writes only the ledger, and only when its…" → ROW M27(shape)
- DI.4.5 — "Flag anything at all that can fail catastrophically on…" → ROW M28

### DI § Never re-derive a fact

- DI.5.1 — "A fact is computed once, at the place that…" → NOT-TESTING
- DI.5.2 — "In a stored or transmitted format, the producer states…" → NOT-TESTING
- DI.5.3 — "A diagnostic dump shows the values the system actually…" → ROW M29(shape)
- DI.5.4 — "A classification made where the data is produced is…" → NOT-TESTING

### DI § Measurement and expectation

- DI.6.1 — "The rule against a second opinion governs the working…" → ROW M30(shape)
- DI.6.2 — "Take the measurement from the system under test, and…" → ROW M31(shape)
- DI.6.3 — "A number copied out of a diagnostic run is…" → ROW M32(shape)
- DI.6.4 — "Where an expectation genuinely cannot be derived yet, say…" → ROW M33(shape)

### DI § One authority per switch

- DI.7.1 — "The process environment is a fact like any other:…" → NOT-TESTING
- DI.7.2 — "The single authority is checked mechanically: it ships a…" → ROW M34
- DI.7.3 — "Reading a field is not always the whole fix:…" → NOT-TESTING
- DI.7.4 — "Cost is how this gets noticed, not what the…" → NOT-TESTING
- DI.7.5 — "One authority per unit is where a switch starts,…" → NOT-TESTING
- DI.7.6 — "A per-unit check cannot see a name duplicated across…" → ROW M35
- DI.7.7 — "A table that mirrors where something is emitted is…" → ROW M36, M37
- DI.7.8 — "A check built on searching always ships a case…" → ROW M38

### DI § Absence and defaults

- DI.8.1 — "A category, flag or case can be used to…" → NOT-TESTING
- DI.8.2 — "The ban on stand-in values covers a legal value…" → NOT-TESTING
- DI.8.3 — "Which of the two shapes absence takes is fixed…" → NOT-TESTING
- DI.8.4 — "An empty collection used as a default is not…" → NOT-TESTING
- DI.8.5 — "If absence means inherit another setting's value, declare no…" → NOT-TESTING
- DI.8.6 — "If absence means zero elements of that setting's own…" → ROW M39(shape)
- DI.8.7 — "This is not "give everything a default". Filling one…" → NOT-TESTING

### DI § Handing a resource on

- DI.11.1 — "Once a stage consumes a resource, that resource is…" → NOT-TESTING
- DI.11.2 — "The removal happens before anything downstream is derived from…" → NOT-TESTING
- DI.11.3 — "The two ways a stage can decline a resource…" → NOT-TESTING
- DI.11.4 — "A stage that declines a claim it never exercised…" → NOT-TESTING
- DI.11.5 — "What is left over from a claim the stage…" → NOT-TESTING
- DI.11.6 — "Every declined resource has exactly one named recipient. None…" → NOT-TESTING
- DI.11.7 — "The rule is about who consumes a resource, not…" → NOT-TESTING
- DI.11.8 — "What gets removed is exactly what the stage actually…" → NOT-TESTING
- DI.11.9 — "The first question in an audit is which two…" → ROW M40(shape)

### DI § Spatial output

- DI.15.1 — "Validate a layout against what actually renders, never against…" → ROW M41
- DI.15.2 — "Where the output is spatial, reason about the final…" → ROW M42(shape)
- DI.15.3 — "Position encodes relationship: a control sits next to the…" → NOT-TESTING

### DI § Carrying instrumentation

- DI.16.1 — "All code carries full instrumentation and profiling capability, and…" → NOT-TESTING
- DI.16.2 — "Existing code gains instrumentation organically: whenever a change touches…" → NOT-TESTING
- DI.16.3 — "Every non-trivial function a change adds or touches gets…" → NOT-TESTING
- DI.16.4 — "Every new decision site gets a diagnostic switch or…" → ROW M43, M44
- DI.16.5 — "A new diagnostic switch is registered in the diagnostics…" → NOT-TESTING
- DI.16.6 — "The bar is one question: when this site misbehaves…" → ROW M45(shape)

### DI § What a diagnostic and a measurement may claim

- DI.17.1 — "How serious a diagnostic is gets decided once, for…" → NOT-TESTING
- DI.17.2 — "Each diagnostic code is declared once, in a single…" → ROW M46(shape)
- DI.17.3 — "Whatever a computation warns about comes back as part…" → NOT-TESTING
- DI.17.4 — "A unit that declares itself profiled either instruments something…" → ROW M47
- DI.17.5 — "A profiler that is off by default can never…" → ROW M48(shape)
- DI.17.6 — "A measurement of one run is a value that…" → ROW M49(shape)

### EP § Resolving a tool

- EP.3.1 — "A bare command name is not the tool you…" → NOT-TESTING
- EP.3.2 — "Resolve the real tool by explicit path, and reject…" → NOT-TESTING
- EP.3.3 — "A tool that cannot resolve what it needs fails…" → ROW M50(shape)

### RG § Dictating a rule

- RG.2.1 — "A dictated standing rule is marked by an agreed…" → NOT-TESTING
- RG.2.2 — "A marked prompt is written to the inbox word…" → NOT-TESTING
- RG.2.3 — "Each captured rule becomes one inbox entry: a heading…" → NOT-TESTING
- RG.2.4 — "The moment a rule is captured, the session is…" → NOT-TESTING
- RG.2.5 — "A rule ruled in conversation without the marker is…" → NOT-TESTING
- RG.2.6 — "The inbox is append-only history. Entries are never deleted,…" → NOT-TESTING
- RG.2.7 — "Never carry an undispositioned rule across a commit. File…" → ROW M51

### RG § Filing and closing the loop

- RG.5.1 — "An assistant never files or adjudicates a rule itself.…" → NOT-TESTING
- RG.5.2 — "Supersession is the owner's call whenever the losing rule…" → NOT-TESTING
- RG.5.3 — "When one rule supersedes another, stamp both directions in…" → NOT-TESTING
- RG.5.4 — "Close the loop on a captured rule by replacing…" → NOT-TESTING
- RG.5.5 — "Run the complete register check before calling a filing…" → ROW M52
- RG.5.6 — "Every group says in plain words what its rules…" → NOT-TESTING
- RG.5.7 — "Only a real decision moves a group's status mark…" → NOT-TESTING
- RG.5.8 — "Every group states how strongly its rules are actually…" → NOT-TESTING

### RG § When a belief turns out false

- RG.6.1 — "When a stated expectation turns out false, a post-mortem…" → ROW M53
- RG.6.2 — "The post-mortem runs as its own dispatched job on…" → ROW M54
- RG.6.3 — "It answers four things: what was believed, what was…" → ROW M55(shape)

### RG § Honesty about the machinery

- RG.7.1 — "An undispositioned inbox entry fails the register check. Filing…" → DUPLICATE-OF MB58
- RG.7.2 — "Run the governance check on every commit, and again…" → DUPLICATE-OF MB63
- RG.7.3 — "Editing a rule-bearing document while the register sits untouched…" → ROW M56
- RG.7.4 — "State exactly where the gate does and does not…" → ROW M57
- RG.7.5 — "The filing procedure is not what keeps rules safe.…" → NOT-TESTING
- RG.7.6 — "Every session opens with this protocol: how to dictate…" → NOT-TESTING
- RG.7.7 — "Say where the register's rows came from. If no…" → NOT-TESTING
- RG.7.8 — "Where a citation still names a line, that line…" → ROW M58

### ST § Saying what you know

- ST.2.1 — "Say "I don't know" the moment it is true.…" → NOT-TESTING
- ST.2.2 — "Every claim says whether it is measured or believed.…" → ROW M59
- ST.2.3 — "Name a cause only once you have run the…" → ROW M60

### ST § Bad news first

- ST.3.1 — "If what you are about to do differs from…" → NOT-TESTING
- ST.3.2 — "Report a failure or a regression in the first…" → ROW M61
- ST.3.3 — "Lead with the uncomfortable sentence. If the honest summary…" → NOT-TESTING
- ST.3.4 — "When honesty costs you the appearance of competence, honesty…" → NOT-TESTING

### TO § Proof lines and denominators

- TO.2.1 — "A gate that runs sub-checks and sends their output…" → ROW M62
- TO.2.2 — "When a tool's own summary does not match the…" → ROW M63
- TO.2.3 — "Do not pass a tool its own quiet flag…" → ROW M64(shape)
- TO.2.4 — "A check that cannot run fails loudly, naming exactly…" → ROW M65

### TO § Heartbeats

- TO.3.1 — "A long-running tool prints one line at a bounded,…" → NOT-TESTING
- TO.3.2 — "The shape: a single line beginning with a fixed…" → NOT-TESTING
- TO.3.3 — "The heartbeat goes to the tool's own output, upstream…" → NOT-TESTING
- TO.3.4 — "A heartbeat survives the filter in every mode, including…" → ROW M66
- TO.3.5 — "Once the shape is standard, silence means something: no…" → NOT-TESTING
- TO.3.6 — "A long-running tool that goes past one interval without…" → NOT-TESTING

### VE § Predict before you work

- VE.2.1 — "Every change writes down the beliefs that make its…" → ROW M67
- VE.2.2 — "Every change predicts what it will affect and, just…" → ROW M68
- VE.2.3 — "Write the predictions before doing the work. Written afterwards…" → ROW M69(shape)
- VE.2.4 — "After the work, confirm each prediction one by one…" → ROW M70
- VE.2.5 — "A prediction left unconfirmed means the work is not…" → ROW M71
- VE.2.6 — "A prediction that fails is a result to report…" → ROW M72

### VE § Declare the standard you are claiming

- VE.3.1 — "A change declares in advance which standard it is…" → ROW M73
- VE.3.2 — "A claim that output is unchanged is measured by…" → ROW M74

### VE § What the check could actually see

- VE.4.1 — "Say what your check could actually see, in the…" → ROW M75
- VE.4.2 — "Ask why the result looks the way it does,…" → ROW M76(shape)
- VE.4.3 — "Someone else's confidence is not evidence of coverage. Verify…" → ROW M77
- VE.4.4 — "List the checks a change requires before running the…" → ROW M78

### VE § The word you just wrote makes a check due

- VE.5.1 — "The trigger is the word you just wrote. Writing…" → ROW M79
- VE.5.2 — "If you call a defect a class, a shape,…" → ROW M80
- VE.5.3 — "Change only the site the change is about. Then…" → ROW M81
- VE.5.4 — "Never edit a site to find out whether it…" → ROW M82(shape)
- VE.5.5 — "A site you believe is affected that neither the…" → ROW M83
- VE.5.6 — "Never edit a site to make a failure elsewhere…" → ROW M84(shape)
- VE.5.7 — "If you did edit a site and then decided…" → ROW M85
- VE.5.8 — "A diagnosis is confirmed only when you can trace…" → ROW M86
- VE.5.9 — "When the task exists because an earlier belief was…" → ROW M87
- VE.5.10 — "A question is closed only when you can name…" → ROW M88
- VE.5.11 — "Before doing anything that reaches outside your own working…" → ROW M89
- VE.5.12 — "Before claiming that some piece of tooling exists, blocks…" → ROW M90

### VE § Tests

- VE.6.1 — "Write the failing test first and watch it fail,…" → ROW M91
- VE.6.2 — "Every fix and every new unit of code ships…" → ROW M92, M93, M94
- VE.6.3 — "When code moves, its tests move with it.…" → ROW M95
- VE.6.4 — "Run the whole suite rather than stopping at the…" → ROW M96
- VE.6.5 — "The full suite passes at the end of every…" → ROW M97
- VE.6.6 — "A regression test covers the default setting, not only…" → ROW M98
- VE.6.7 — "If a suite has no way to express a…" → ROW M99(shape)

### VE § What a test can honestly claim

- VE.7.1 — "Asserting that something did not happen only counts if…" → ROW M100
- VE.7.2 — "A test that captures output for checking reproduces the…" → ROW M101
- VE.7.3 — "Where a unit test cannot honestly reach — a…" → ROW M102, M103
- VE.7.4 — "A test that guards how an algorithm scales asserts…" → ROW M104, M105
- VE.7.5 — "A refactor lands in two steps, never one: move…" → ROW M106

### VE § Comparison runs and baselines

- VE.8.1 — "Judge a comparison run by diffing its failure set…" → ROW M107
- VE.8.2 — "When a baseline moves unexpectedly, stop and work out…" → ROW M108
- VE.8.3 — "A regenerated baseline proves only that the tool agrees…" → ROW M109
- VE.8.4 — "A skipped case is unproven, not passed, and every…" → ROW M110
- VE.8.5 — "Never change the code just to make a check…" → ROW M111(shape)
- VE.8.6 — "Never adjust a comparison's tolerance in order to produce…" → ROW M112(shape)
- VE.8.7 — "A comparison that does not suppress whitespace is not…" → ROW M113

### VE § Measuring performance

- VE.9.1 — "Measure first. Instrument the thing and look, instead of…" → ROW M114
- VE.9.2 — "A timer wraps the work and nothing else, never…" → ROW M115(shape)
- VE.9.3 — "Never compare two performance builds by running one after…" → ROW M116
- VE.9.4 — "A performance measurement runs against a separate working copy,…" → ROW M117(shape)
- VE.9.5 — "Measure on a quiet machine. Background load — another…" → ROW M118(shape)
- VE.9.6 — "Always record and state the configuration a measurement was…" → ROW M119
- VE.9.7 — "Measuring one variable while a second one dominates the…" → ROW M120(shape)
- VE.9.8 — "A correctness question never rides along inside a performance…" → ROW M121
- VE.9.9 — "Put the instrumentation for a performance fix in the…" → ROW M122
- VE.9.10 — "Any instrument built to verify a change ships in…" → ROW M123
- VE.9.11 — "Before reusing a technique that works by skipping work,…" → ROW M124
- VE.9.12 — "Turning on a path that has never run must…" → ROW M125

### VE § Before you write code

- VE.10.1 — "Before you write code, make sure your design intent…" → ROW M126

### WT § Creating and shaping a pair

- WT.3.1 — "Creating a ticket pair is one instruction from the…" → NOT-TESTING
- WT.3.2 — "Repairing a half-made pair is the same one instruction:…" → NOT-TESTING
- WT.3.3 — "A full ticket has a fixed shape: the problem,…" → ROW M127(shape)
- WT.3.4 — "A companion entry opens by saying it is the…" → ROW M128(shape)

### WT § The owner's own list

- WT.5.1 — "An item on the owner's own list of complaints…" → ROW M129
- WT.5.2 — "Never rewrite the owner's own description of a problem.…" → NOT-TESTING

### WT § The learnings record

- WT.6.1 — "Learnings ship with the work that produced them —…" → NOT-TESTING
- WT.6.2 — "Every entry stands on its own: what prompted it,…" → NOT-TESTING
- WT.6.3 — "Three records, three jobs: the tracker holds what is…" → NOT-TESTING
- WT.6.4 — "In an effort of several tasks on one branch,…" → ROW M130, M131, M132(shape)

### WT § One editable home

- WT.7.1 — "A rule that gets restated elsewhere has exactly one…" → NOT-TESTING
- WT.7.2 — "A restatement earns its place by adding what the…" → NOT-TESTING
- WT.7.3 — "A generator that leaves only one copy of anything…" → ROW M133

### WT § Staying inside the effort

- WT.8.1 — "Work happens inside a campaign, and a campaign is…" → NOT-TESTING
- WT.8.2 — "Within a campaign, one feature is worked to completion…" → NOT-TESTING
- WT.8.3 — "A feature may take several tickets. Completion is judged…" → ROW M134(shape)

### WT § A specification handed down

- WT.9.1 — "A prompt beginning SPEC: carries a specification to implement,…" → NOT-TESTING
- WT.9.2 — "The SPEC: mark is captured word for word to…" → DUPLICATE-OF MB60
- WT.9.3 — "Dictated specifications persist under docs/dictated-specs — one fixed, known…" → DUPLICATE-OF MB61

### WD § Working in it

- WD.3.1 — "Inside a working copy, anything above the project root…" → NOT-TESTING
- WD.3.2 — "A working copy someone else can see is shared…" → ROW M135
- WD.3.3 — "Working copies share one incremental build cache and can…" → ROW M136
- WD.3.4 — "If you are about to make a second commit…" → NOT-TESTING
- WD.3.5 — "A fixture that spawns a real subprocess strips every…" → ROW M137

### WD § Committing from it

- WD.4.1 — "Every commit names the exact paths it is committing.…" → NOT-TESTING
- WD.4.2 — "Put the message and its flags before the path…" → NOT-TESTING
- WD.4.3 — "Stage the named files a change touches, never a…" → NOT-TESTING
- WD.4.4 — "Some tracked files are the owner's own working record…" → NOT-TESTING
- WD.4.5 — "An advisory backstop fires when a documentation-shaped commit also…" → DUPLICATE-OF MB62
- WD.4.6 — "Every commit message ends with the standard trailer attributing…" → NOT-TESTING
- WD.4.7 — "Credit the person by name for any idea, diagnosis,…" → NOT-TESTING

### WD § Merging and tearing down

- WD.5.1 — "The merge is made locally first, into a private…" → ROW M138
- WD.5.2 — "Branches kept for exploration are never merged automatically. Merging…" → NOT-TESTING
- WD.5.3 — "Delete the working copy and its branch immediately after…" → NOT-TESTING
- WD.5.4 — "Before you finish, list the working copies that exist.…" → NOT-TESTING
- WD.5.5 — "Never delete a working copy that has uncommitted changes…" → NOT-TESTING
- WD.5.6 — "A working copy that some tool holds a lock…" → NOT-TESTING

### WD § What may be merged

- WD.6.1 — "Only code that is not broken and will not…" → ROW M139, M140
- WD.6.2 — "Incomplete code may be merged when it is unreachable:…" → ROW M141
- WD.6.3 — "This is the merge bar, distinct from finishing the…" → NOT-TESTING

### CB § Skill: apply can't-break-by-design to everything you write

- CB.1.1 — "You do not have the choice to design any…" → NOT-TESTING
- CB.1.2 — "Before writing a new code path: (1) name the…" → DUPLICATE-OF U7
- CB.1.3 — "New paths get an A/B regression test proving the…" → ROW U1
- CB.1.4 — "A shared helper is the weakest acceptable form and…" → NOT-TESTING
- CB.1.5 — "Before writing the doc comment, check §5.…" → ROW U4
- CB.1.6 — "A sentence that sounds like an invariant usually is…" → NOT-TESTING
- CB.1.7 — "If you are about to write "construct via X"…" → NOT-TESTING
- CB.1.8 — "Assign the rung from the mechanism you can point…" → DUPLICATE-OF U10
- CB.1.9 — "The full reference follows.…" → NOT-TESTING

### CB § Can't Break By Design

- CB.2.1 — "A property is enforced by design when violating it…" → NOT-TESTING
- CB.2.2 — "Not caught at runtime, not covered by a test,…" → NOT-TESTING
- CB.2.3 — "The test: would a new call site, added by…" → DUPLICATE-OF U3
- CB.2.4 — "If the answer depends on them noticing something, it…" → NOT-TESTING

### CB § 1. The ladder

- CB.3.1 — "Every invariant must sit as high as the language…" → NOT-TESTING
- CB.3.2 — "Touching code near a low-rung invariant means promoting it.…" → NOT-TESTING
- CB.3.3 — "0 Comment / documentation anyone doesn't read it…" → NOT-TESTING
- CB.3.4 — "1 Convention & review reviewer blinks…" → NOT-TESTING
- CB.3.5 — "2 Runtime assert only after shipping the bad path…" → NOT-TESTING
- CB.3.6 — "3 Tests the new path isn't the tested path…" → NOT-TESTING
- CB.3.7 — "4 Lint / static analysis rule gaps, suppressions…" → NOT-TESTING
- CB.3.8 — "5 Shared helper a call site doesn't call it…" → NOT-TESTING
- CB.3.9 — "6 Choke-point (sole route) a new bypass route is…" → NOT-TESTING
- CB.3.10 — "7 Sole-constructor type bypass = compile error…" → NOT-TESTING
- CB.3.11 — "8 Illegal state unrepresentable nothing left to break…" → NOT-TESTING
- CB.3.12 — "7–8 is the target. 5–6 is the weakest acceptable…" → ROW U5(shape)
- CB.3.13 — "Rung 0 is worthless as enforcement.…" → NOT-TESTING
- CB.3.14 — "That is not a claim about its worth as…" → NOT-TESTING
- CB.3.15 — "It is simply not the thing standing between a…" → NOT-TESTING
- CB.3.16 — "The ledger row, referenced throughout this skill: the invariant…" → NOT-TESTING
- CB.3.17 — "Two things it is not.…" → NOT-TESTING
- CB.3.18 — "It is not a note that something is pending…" → NOT-TESTING
- CB.3.19 — "And it is not a private list: put the…" → NOT-TESTING

### CB § 3. Strongest tool per language

- CB.5.1 — "Where the language is weak, move the invariant to…" → NOT-TESTING
- CB.5.2 — "Rust enums + exhaustive match, ownership, newtypes, private fields…" → NOT-TESTING
- CB.5.3 — "Haskell / OCaml / F# ADTs & GADTs, phantom…" → NOT-TESTING
- CB.5.4 — "TypeScript discriminated unions + never exhaustiveness, branded types, readonly,…" → NOT-TESTING
- CB.5.5 — "Kotlin / C# / Java sealed classes + exhaustive…" → NOT-TESTING
- CB.5.6 — "C++ RAII, strong typedefs, deleted/explicit ctors, const, [[nodiscard]], std::variant…" → NOT-TESTING
- CB.5.7 — "Go unexported types + constructor functions, interfaces as capabilities,…" → NOT-TESTING
- CB.5.8 — "Python @dataclass(frozen=True), Enum, NewType, Protocol, __slots__, factory-only modules, assert_never,…" → ROW U6
- CB.5.9 — "C opaque pointers, static linkage, handle tables with generation…" → NOT-TESTING
- CB.5.10 — "SQL / schemas NOT NULL, CHECK, foreign keys, UNIQUE,…" → NOT-TESTING
- CB.5.11 — "Shell / YAML / config none — generate from…" → NOT-TESTING
- CB.5.12 — "FFI / wire typed wrappers generated from the IDL,…" → NOT-TESTING

### CB § 4. The process

- CB.6.1 — "Name the invariant before writing the path. If you…" → NOT-TESTING
- CB.6.2 — "Pick the highest rung the language allows. Shared helper…" → NOT-TESTING
- CB.6.3 — "Tripwire: duplicating a processing step at a second call…" → ROW U7
- CB.6.4 — "Stranger test: would a call site added by someone…" → ROW U3
- CB.6.5 — "New path ⇒ invariant test. An A/B test proving…" → ROW U1, U2
- CB.6.6 — "Grandfathering: touching code near a rung ≤5 invariant obligates…" → NOT-TESTING
- CB.6.7 — "When the language can't: shrink the trusted surface to…" → ROW U8
- CB.6.8 — "Both directions. Enumerate the invariants the feature TOUCHES and…" → ROW U9
- CB.6.9 — "Assign the rung from the mechanism, never the wording.…" → ROW U10(shape)
- CB.6.10 — "State the invariant and file its row in the…" → NOT-TESTING
- CB.6.11 — "Declare the release behaviour of every profile-dependent guard.…" → NOT-TESTING
- CB.6.12 — "Offer continuous review; do not assume it. Ask; take…" → ROW U11

### CB § 5. Anti-patterns

- CB.7.1 — "Sentences that sound like invariants and are not.…" → NOT-TESTING
- CB.7.2 — "(inverts N) names the technique that fixes it.…" → NOT-TESTING
- CB.7.3 — "Claim vs mechanism…" → NOT-TESTING
- CB.7.4 — "A5.1 Sole-constructor claims need private fields. (3) "Construct via…" → NOT-TESTING
- CB.7.5 — "A5.2 Naming is not prevention. (7) A constructor that…" → NOT-TESTING
- CB.7.6 — "A5.3 Co-location is not a mechanism. (8) "Kept beside…" → NOT-TESTING
- CB.7.7 — "A5.4 "Should" is not a rule. (4) If a…" → NOT-TESTING
- CB.7.8 — "Preconditions…" → NOT-TESTING
- CB.7.9 — "A5.5 A caller precondition is a type, not a…" → NOT-TESTING
- CB.7.10 — "A5.6 "Enforcement is the caller's job" means this module…" → NOT-TESTING
- CB.7.11 — "Duplication…" → NOT-TESTING
- CB.7.12 — "A5.7 A bound may exist in exactly one place.…" → NOT-TESTING
- CB.7.13 — "A5.8 A mirror needs a generator, not a drift…" → ROW U12(shape)
- CB.7.14 — "A5.9 Clamping in every setter is the tripwire. (3)…" → NOT-TESTING
- CB.7.15 — "Tests standing in for construction…" → NOT-TESTING
- CB.7.16 — "A5.10 A hand-maintained exception list is debt, and must…" → NOT-TESTING
- CB.7.17 — "A5.11 "By construction, pinned by a test" is rung…" → ROW U13(shape)
- CB.7.18 — "Build-profile divergence…" → NOT-TESTING
- CB.7.19 — "A5.12 debug_assert is not enforcement. (1) Rung 2 in…" → NOT-TESTING
- CB.7.20 — "A5.13 Fault isolation must state the profile it works…" → NOT-TESTING
- CB.7.21 — "A5.14 Prefer identical debug and release behaviour. A bug…" → NOT-TESTING
- CB.7.22 — "Panics wearing guarantees…" → NOT-TESTING
- CB.7.23 — "A5.15 "Cannot fail in practice" + .expect is a…" → NOT-TESTING
- CB.7.24 — "A5.16 A silent bounded degrade must publish its divergence…" → ROW U14
- CB.7.25 — "Inert code…" → NOT-TESTING
- CB.7.26 — "A5.17 An invariant on code that cannot run must…" → NOT-TESTING
- CB.7.27 — "A5.18 Delete the alternative, don't leave it unused. (1)…" → NOT-TESTING
- CB.7.28 — "Run-scoped state…" → NOT-TESTING
- CB.7.29 — "A5.19 A run-global is rung 2 whenever tests share…" → NOT-TESTING

### CB § 6. Continuous review

- CB.9.1 — "A ledger goes stale on the next commit that…" → NOT-TESTING
- CB.9.2 — "If a background agent maintains it:…" → NOT-TESTING
- CB.9.3 — "Scope is recently changed code — the diff since…" → ROW U15
- CB.9.4 — "Read-only over source. It proposes; it does not promote.…" → ROW U16(shape)
- CB.9.5 — "Report the mechanism, not the verdict. "Rung 3 —…" → ROW U17(shape)
- CB.9.6 — "A deleted claim is a finding. Removed prose the…" → ROW U18
- CB.9.7 — "Escalate a dropped rung immediately — a sole-constructor type…" → ROW U19

### BR § 6.4 Visibility

- BR.17.1 — "Instrumentation record the decision and its inputs, not the…" → NOT-TESTING
- BR.17.2 — "Correlation one identifier threaded end to end added later…" → NOT-TESTING
- BR.17.3 — "Severity levels mean something or do not exist if…" → NOT-TESTING
- BR.17.4 — "Error text what was expected, what was found, and…" → NOT-TESTING
- BR.17.5 — "Test level where the bug would actually live, against…" → ROW U20(shape)
- BR.17.6 — "Test credibility prove it can fail a test that…" → ROW U21
- BR.17.7 — "Flaky tests a defect, fixed or deleted tolerating one…" → ROW U22
- BR.17.8 — "Comments the why; a comment explaining a name is…" → NOT-TESTING

### BR § 6.5 Motion

- BR.18.1 — "Change size small, reversible, frequent rollback cost grows faster…" → NOT-TESTING
- BR.18.2 — "Schema and behavior never in one step; expand, migrate,…" → NOT-TESTING
- BR.18.3 — "Deploys the rollback story exists before it ships written…" → NOT-TESTING
- BR.18.4 — "Automation what is done three times, or once irreversibly…" → NOT-TESTING
- BR.18.5 — "Optimization measure first, and measure the tail the mean…" → ROW U23
- BR.18.6 — "Caching a correctness decision with a performance benefit, never…" → NOT-TESTING
- BR.18.7 — "Feedback loop build and test latency is worth paying…" → NOT-TESTING

### BR § 6.7 Working under a context budget

- BR.20.1 — "A context budget is the finite working set a…" → NOT-TESTING
- BR.20.2 — "The reader is not necessarily a machine, and the…" → NOT-TESTING
- BR.20.3 — "All of these are context budgets:…" → NOT-TESTING
- BR.20.4 — "an assistant's context window over a working session…" → NOT-TESTING
- BR.20.5 — "a reviewer's attention across a single change…" → NOT-TESTING
- BR.20.6 — "an operator's attention at the worst hour of the…" → NOT-TESTING
- BR.20.7 — "a newcomer's head during the weeks before they can…" → NOT-TESTING
- BR.20.8 — "whatever a person will actually read of an error…" → NOT-TESTING
- BR.20.9 — "the alerts and dashboard panels a team can genuinely…" → NOT-TESTING
- BR.20.10 — "the number of concepts a change forces someone to…" → NOT-TESTING
- BR.20.11 — "They are one domain because they share four properties,…" → NOT-TESTING
- BR.20.12 — "Finite and shared. Spending the budget on one thing…" → NOT-TESTING
- BR.20.13 — "Spent by volume, not by value. A thousand lines…" → NOT-TESTING
- BR.20.14 — "It fails by eviction and dilution, never by refusal.…" → NOT-TESTING
- BR.20.15 — "The cost is exported. Whoever adds the volume is…" → NOT-TESTING
- BR.20.16 — "An assistant's context window is the sharpest instance because…" → NOT-TESTING
- BR.20.17 — "The discipline is the same at every scale, and…" → NOT-TESTING
- BR.20.18 — "Who runs a tool with large or repeated output…" → ROW U25(shape)
- BR.20.19 — "Where a large result lives a file, with only…" → NOT-TESTING
- BR.20.20 — "Usage instructions one consolidated document, written as the tool…" → NOT-TESTING
- BR.20.21 — "Verification the invocation that returns a verdict, a count,…" → ROW U24(shape)
- BR.20.22 — "Reading source search first, then read the range that…" → NOT-TESTING
- BR.20.23 — "High-volume exploration a separate context that reports back a…" → NOT-TESTING
- BR.20.24 — "Durable decisions and conventions written down, in the least…" → NOT-TESTING
- BR.20.25 — "Generated code and comments as terse as clarity allows…" → NOT-TESTING
- BR.20.26 — "Narration omitted — but disclosure is not narration announcing,…" → NOT-TESTING
- BR.20.27 — "Size of a change put up for review small…" → NOT-TESTING
- BR.20.28 — "What an alert says and whether it exists only…" → NOT-TESTING
- BR.20.29 — "What a dashboard shows the few things someone would…" → NOT-TESTING
- BR.20.30 — "A runbook's length and shape what fits in the…" → NOT-TESTING
- BR.20.31 — "How much an error message says at once the…" → NOT-TESTING
- BR.20.32 — "Concepts a change forces you to hold at once…" → NOT-TESTING
- BR.20.33 — "The operational-tooling handoff.…" → NOT-TESTING
- BR.20.34 — "When the work produces something the developer will run…" → NOT-TESTING
- BR.20.35 — "Both halves fall out of move 3: the tool's…" → NOT-TESTING
- BR.20.36 — "Consolidate the instructions into one document as the tool…" → NOT-TESTING
- BR.20.37 — "That last item is what makes the loop cheap…" → NOT-TESTING
- BR.20.38 — "The counter-direction is a real failure and costs more…" → NOT-TESTING
- BR.20.39 — "Guessing at an interface to avoid a fifty-line read…" → NOT-TESTING
- BR.20.40 — "Asking the developer to run something you could have…" → DUPLICATE-OF U25
- BR.20.41 — "The same false economy has a human form: an…" → NOT-TESTING
- BR.20.42 — "The context budget is a constraint to derive from,…" → NOT-TESTING
- BR.20.43 — "Spend freely on the small, dense thing that prevents…" → NOT-TESTING
- BR.20.44 — "Density is the lever, not length.…" → NOT-TESTING

### BR § 6.8 Artifacts, runs, and workspace layout

- BR.21.1 — "Work that produces output for comparison — before and…" → NOT-TESTING
- BR.21.2 — "The governing case is which axis carries the discriminator,…" → NOT-TESTING
- BR.21.3 — "A name like report-prod is a single string serving…" → NOT-TESTING
- BR.21.4 — "Blended, it serves neither — the artifact no longer…" → NOT-TESTING
- BR.21.5 — "Split them, and the answer falls out: the directory…" → NOT-TESTING
- BR.21.6 — "Which axis discriminates comparable runs the directory; filenames stay…" → ROW U26(shape)
- BR.21.7 — "Who knows which slot this is only the caller,…" → NOT-TESTING
- BR.21.8 — "Re-running write a new run directory; never overwrite an…" → ROW U27(shape)
- BR.21.9 — ""Latest" a pointer to a run, never a copy…" → NOT-TESTING
- BR.21.10 — "Timestamped directory names zero-padded, largest unit first any other…" → NOT-TESTING
- BR.21.11 — "Where results live outside the source tree results inside…" → NOT-TESTING
- BR.21.12 — "Unit of archive and deletion the run directory a…" → NOT-TESTING
- BR.21.13 — "Run metadata — inputs, versions, parameters a file inside…" → ROW U28(shape)
- BR.21.14 — "The tell that the discriminator is on the wrong…" → NOT-TESTING
- BR.21.15 — "That is the duplicated-step tripwire, arriving in a layout…" → NOT-TESTING
- BR.21.16 — "The asymmetry across the whole section is one-directional: a…" → NOT-TESTING
- BR.21.17 — "Encoded names un-flatten only by renaming every artifact and…" → NOT-TESTING

### DF § 2. A session, worked

- DF.4.1 — "One session, worked fully, because the ratio matters more…" → NOT-TESTING
- DF.4.2 — "What happened.…" → NOT-TESTING
- DF.4.3 — "You were asked to fix a slow report query.…" → NOT-TESTING
- DF.4.4 — "Over ninety minutes you read the schema, added an…" → NOT-TESTING
- DF.4.5 — "Six things happened.…" → NOT-TESTING
- DF.4.6 — "Run the filter on each.…" → NOT-TESTING
- DF.4.7 — "The index that did not help.…" → NOT-TESTING
- DF.4.8 — "Needed again?…" → NOT-TESTING
- DF.4.9 — "Yes — the next person to look at this…" → NOT-TESTING
- DF.4.10 — "Not visible from the artifact: the index is gone,…" → NOT-TESTING
- DF.4.11 — "Where?…" → NOT-TESTING
- DF.4.12 — "It is a rejected alternative, so it belongs with…" → NOT-TESTING
- DF.4.13 — "One line: tried a covering index on these columns;…" → NOT-TESTING
- DF.4.14 — "The real cause.…" → NOT-TESTING
- DF.4.15 — "The change itself is in the diff, but the…" → NOT-TESTING
- DF.4.16 — "Someone reading it later will assume the constraint was…" → NOT-TESTING
- DF.4.17 — "Record the diagnosis with the change.…" → NOT-TESTING
- DF.4.18 — "The same gap on two other tables.…" → NOT-TESTING
- DF.4.19 — "Deferred work, filed before you move on.…" → NOT-TESTING
- DF.4.20 — "One entry, not two: it is one cause with…" → NOT-TESTING
- DF.4.21 — "Say what is wrong, how you noticed, and what…" → NOT-TESTING
- DF.4.22 — "The one you did not test.…" → NOT-TESTING
- DF.4.23 — "This is the item most likely to be lost,…" → NOT-TESTING
- DF.4.24 — "It goes in the handoff, plainly and first, and…" → ROW D2
- DF.4.25 — "An untested change that is reported as done is…" → NOT-TESTING
- DF.4.26 — "The collation difference.…" → NOT-TESTING
- DF.4.27 — "Needed again?…" → NOT-TESTING
- DF.4.28 — "Certainly — it will break the next reproduction attempt…" → NOT-TESTING
- DF.4.29 — "Surprised you, cost you a failed reproduction to find,…" → NOT-TESTING
- DF.4.30 — "This one is not about the change, so it…" → NOT-TESTING
- DF.4.31 — "Everything else.…" → NOT-TESTING
- DF.4.32 — "The schema you read, the file you opened and…" → NOT-TESTING
- DF.4.33 — "Scaffolding.…" → NOT-TESTING
- DF.4.34 — "Say nothing.…" → NOT-TESTING
- DF.4.35 — "It is most of the session.…" → NOT-TESTING
- DF.4.36 — "The result.…" → NOT-TESTING
- DF.4.37 — "Ninety minutes of work produced four short records and…" → NOT-TESTING
- DF.4.38 — "That ratio is the point: the filter is not…" → NOT-TESTING
- DF.4.39 — "A session that produces fifteen records has not been…" → NOT-TESTING
- DF.4.40 — "And notice what the ladder did.…" → NOT-TESTING
- DF.4.41 — "The rejected index and the diagnosis travelled with the…" → NOT-TESTING
- DF.4.42 — "The deferred work went to the tracker, because whoever…" → NOT-TESTING
- DF.4.43 — "The untested item went into both the handoff and…" → DUPLICATE-OF D2
- DF.4.44 — "The collation quirk went to the project's setup knowledge,…" → NOT-TESTING
- DF.4.45 — "Four items, four different places, each chosen by asking…" → NOT-TESTING

### DF § 6.1 Deferred work

- DF.14.1 — "Something found and not fixed filed before you move…" → NOT-TESTING
- DF.14.2 — "Where it goes the tracker, not a marker in…" → NOT-TESTING
- DF.14.3 — "What it says what is wrong, how you noticed,…" → NOT-TESTING
- DF.14.4 — "How much what someone would actually schedule a hundred…" → NOT-TESTING
- DF.14.5 — "Related items one entry and one workspace, each recording…" → NOT-TESTING
- DF.14.6 — "A link discovered late combine them and clean up;…" → NOT-TESTING
- DF.14.7 — "Deferred on instruction filed anyway, marked deliberate in three…" → NOT-TESTING
- DF.14.8 — "Something you broke to progress filed before the session…" → NOT-TESTING
- DF.14.9 — "A fix you doubt filed with what would confirm…" → ROW D3
- DF.14.10 — "Work deferred on a rule the code was meant…" → NOT-TESTING

### DF § 6.4 Outcomes

- DF.17.1 — "The domain most often skipped, because by the time…" → NOT-TESTING
- DF.17.2 — "Whether the work actually worked a ledger for the…" → ROW D4
- DF.17.3 — "When to write it when the result is measurable,…" → ROW D5(shape)
- DF.17.4 — "A regression you caused and accepted recorded as accepted,…" → ROW D6
- DF.17.5 — "Work that did not achieve its goal recorded plainly…" → NOT-TESTING

### DF § 6.5 Session continuity

- DF.18.1 — "State at a boundary what is half-done, what is…" → NOT-TESTING
- DF.18.2 — "When to write it before the boundary, unasked after…" → NOT-TESTING
- DF.18.3 — "How many pickup contexts per work item exactly one,…" → NOT-TESTING
- DF.18.4 — "Left not building or running said plainly and first…" → ROW D7
- DF.18.5 — "The pickup context is the one thing in this…" → NOT-TESTING
- DF.18.6 — "It earns the risk only because deciding what matters…" → NOT-TESTING
- DF.18.7 — "Keep it current, or delete it and let readers…" → NOT-TESTING

### DF § 6.6 No surprises

- DF.19.1 — "Scope you cut said at the time, unsoftened a…" → NOT-TESTING
- DF.19.2 — "A step skipped named, with why an unnamed skip…" → ROW D8
- DF.19.3 — "What you could not do named, with what you…" → NOT-TESTING
- DF.19.4 — "Work beyond what was asked named, or not done…" → NOT-TESTING
- DF.19.5 — "What you did not verify stated as unverified an…" → ROW D1
- DF.19.6 — "Hard-to-reverse actions confirmed first, naming the target asking costs…" → NOT-TESTING
- DF.19.7 — "None of this is narration.…" → NOT-TESTING
- DF.19.8 — "Announcing each step as you take it costs the…" → NOT-TESTING
- DF.19.9 — "These rows are about the result — what is…" → NOT-TESTING
- DF.19.10 — "Narration describes your process to someone who did not…" → NOT-TESTING
- DF.19.11 — "Trust is what is being spent here, and it…" → NOT-TESTING
- DF.19.12 — "One surprise converts every future summary into something to…" → NOT-TESTING

### DF § 9. The process

- DF.24.1 — "Notice the moment. Something happens that will outlive the…" → NOT-TESTING
- DF.24.2 — "Ask whether anyone needs it again. If not, say…" → NOT-TESTING
- DF.24.3 — "Name the reader and when they will want it.…" → NOT-TESTING
- DF.24.4 — "Find the place the project already uses. Do not…" → NOT-TESTING
- DF.24.5 — "Pick the lowest rung that survives your absence —…" → NOT-TESTING
- DF.24.6 — "Write it now, in the fewest lines a cold…" → NOT-TESTING
- DF.24.7 — "When you need something back, escalate rather than bulk-read…" → NOT-TESTING
- DF.24.8 — "When you catch yourself re-deriving, write the note that…" → NOT-TESTING
- DF.24.9 — "Before the session ends, spend one pass on what…" → ROW D9
