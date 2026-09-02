# CLAUDE.md

## Be straightforward (HARD RULE)

Gabe 2026-08-14. Outranks looking competent.

- **"I don't know"**: said the moment true — reportable state, never
  papered over with a plausible plan.
- **Every claim carries status**: measured (command/output) or believed
  (labeled + what would verify it). "Fixed"/"improved"/"safe" without
  evidence in the same message = violation.
- **Attribution only after isolation**: "X caused Y" requires the isolating
  bisect/toggle; otherwise "not yet isolated."
- **Deviations announced BEFORE they happen**, never discovered later —
  stop, say so first. Told-one-thing-done-another = the target failure
  mode.
- **Failures/regressions reported immediately**, full strength — never
  softened, never buried under progress.
- **Uncomfortable sentence first.**

Full rule: docs/rules/be-straightforward.md

## Be concise, and explain with analogies (HARD RULE)

Gabe 2026-08-26, RULE:-dictated: maximally concise, no meaning lost; plain
analogy over technical vocabulary — no computational-geometry terms
(Voronoi, medial axis, offset arithmetic, winding), no other esoterica in
user-facing text.

- Lead with the answer; cut preamble, recaps, hedging.
- Scope: chat only. Commits/issues/code comments keep technical vocabulary
  — precision matters there.

Full rule: docs/rules/be-concise-analogies.md

## Tests

Every bug fix, feature, function, class, and method ships with a unit test, a
fixture generator, and coverage in every related integration test.

## Every change states its assumptions and its blast radius (HARD RULE)

Gabe 2026-08-25, RULE:-dictated: **change ships with ASSUMPTIONS COMPILED +
EXPECTED BLAST RADIUS (what SHOULD change + what SHOULD NOT); coding done
-> every assumption + expected truth CONFIRMED.**

- Both halves stated; "should not change" = the falsifiable half carrying
  the information.
- Written BEFORE coding, confirmed AFTER: each item named, reported HELD /
  DID NOT HOLD — never blanket "tests pass."
- Unconfirmed expectation = UNFINISHED change. Not a caveat, not a
  follow-up ticket.
- Violated expectation = REPORTABLE RESULT, full strength (§ Be
  straightforward); change-wrong vs assumption-wrong = explicit finding.
- Change DECLARES its output bar in advance: byte-identity (value-neutral)
  vs structural parity + invariants (deliberate algorithmic work) — §
  Verification, `docs/RULES-GROUPED.md`. Mislabelling a behaviour change as
  a refactor = how the bar gets dodged.

Full rule: docs/rules/assumptions-and-blast-radius.md

## A ledger mismatch launches a post-mortem agent (HARD RULE)

Gabe 2026-08-25, RULE:-dictated: **stated assumption not held / expected
truth moved / "should not change" changed -> SONNET post-mortem agent: WHY,
in a form new rules can be written from.**

- Trigger MECHANICAL, not discretionary: any VIOLATED verdict in a ledger's
  confirmation pass. "I already know why" != exemption.
- Sonnet (§ Agent cost economy), serial (§ Serial agents only): dispatched
  alone, RESULT verified, before anything else runs.
- Output rule-shaped, never narrative: what was believed / what was true /
  WHERE the belief entered / which standing rule would have caught it. "We
  should be careful" = produced nothing.
- Candidate rule -> `/rule-intake`, a proposal to Gabe — never self-filed;
  agents do not adjudicate.
- Mismatch = the asset: a failed prediction located a real gap.

Full rule: docs/rules/ledger-mismatch-post-mortem.md

## A measurement's scope is part of its claim (HARD RULE)

Gabe 2026-08-26. State what the measurement COULD see in the same breath as
the claim: scope != claim -> evidence for a DIFFERENT question, reading
exactly like evidence for yours.

- Ask WHY the result looks like that, not WHETHER — the green, plausible
  answer to a question nobody asked = the trap.
- Subagent confidence != scope: verify counts independently; a
  complete-looking table != evidence of completeness.
- General form of probe shape/denominator (`docs/dev/traps.md`) + gate
  integrity (`docs/ci.md`).
- Subset-computing gate prints its own denominator every run; merge gate
  never trusts merge-parent order alone — diff both parents or resolve the
  pre-merge tip; covered by a wrong-direction merge fixture asserting the
  gate goes RED.
- **A clean check does not shorten the list** (Gabe 2026-08-29): required
  checks enumerated BEFORE the first check runs; a pass on one never
  cancels another. Positive result = the most dangerous place to stop —
  stopping feels earned. Mechanical test: list written before or after the
  first check ran — answerable; "did you feel diligent" is not.

Full rule: docs/rules/measurement-scope.md

## A gate script echoes its sub-check's denominator (HARD RULE)

Gabe 2026-08-28, RULE:-dictated: merge/CI gate script redirecting a
sub-check's output to a log echoes at minimum that sub-check's own
denominator line to its own stdout — not only pass/FAIL. Distinct from § A
measurement's scope: this = gate output plumbing discarding evidence the
sub-check already produced.

Full rule: docs/rules/gate-echoes-denominator.md

## A long-running tool emits a heartbeat the main agent knows to look for (HARD RULE)

Gabe 2026-08-28, RULE:-dictated. Extends § A gate script echoes its
sub-check's denominator: that rule = sub-check evidence onto stdout at all;
this = the silence WHILE a tool still runs.

- One line, bounded regular interval, single project-wide pattern (ONE
  regex), e.g. `HEARTBEAT <tool> <elapsed> [<progress>]` — minimum: which tool,
  alive, progress if knowable (denominator beats bare pulse). Applies:
  `scripts/battery.sh`, `scripts/merge-gate.sh`, `scripts/perf.sh`,
  `scripts/bench-report.sh`, `scripts/testq.sh`,
  `scripts/prove-gcode-identical.sh`, equivalent long build/test runs.
- Written to the TOOL's own stdout, UPSTREAM of any log redirect — a
  heartbeat inside a swallowed redirect reaches no one.
- Silence past one interval = dead or hung, never "probably still working."
  An agent watching a background job watches for the pattern; never
  idle-waits for a completion signal it was never promised.
- Mechanical check: `.claude/hooks/quiet_run.py` keep-patterns match the
  format; a red-check fixture proves a synthetic heartbeat survives
  filtering. Tool past one interval without emitting one = itself a defect.
- Scope: contract + standard shape only; wiring emitters + the filter
  fixture = separate implementation work.

Full rule: docs/rules/heartbeat-contract.md

## The map is living documentation (HARD RULE)

Every bug fix and implementation updates the pipeline mapping in the SAME
change: contract map
(`docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md`); config
keys or feature gaps moved -> also the alignment data
(`docs/superpowers/specs/pipeline-alignment/*.json`) + pipeline page
(`docs/superpowers/models/preview.html`).

- "Update" = affected stage's section reflects the new behaviour; a fixed
  divergence re-marked with the commit; a landed gap ticket flips status on
  the page.
- Fix in a stage unmapped at logic depth: map that stage first (map doc
  §4.1.x template) — never guess.
- Stale map = failing test, not missing docs.
- Register (`docs/RULES-GROUPED.md`) = living documentation the same way:
  rule added/changed/superseded -> register updated in the same commit,
  durable home first — the register cites, never originates. Dictated rules
  start the prompt with `RULE:` (captured mechanically to
  `docs/rule-inbox.md`; a PENDING entry blocks every commit in a clone with
  `core.hooksPath` set to `.githooks`, or on CI push, until `/rule-intake`
  or dismissed with a reason).

Full rule: docs/rules/map-living-documentation.md

## Design
### Code
- enforce cant-break-by-design for every decisions

### GUI
- Layout validated against the RENDERED result, never assumed from markup:
  every interactive element fully visible, unobstructed, within reach at
  all supported viewport sizes — nothing clipped by a container, occluded
  by an overlay/fixed element, or outside the visible area.
- Spatial output (UI, diagrams, print layout): reason about the final
  rendered geometry; plausible-looking source != usable result.
- Position encodes relationship: controls adjacent to their target, same
  visual group, move with it; a control's scope inferable from location
  alone (page-level actions at page level, region-level attached to the
  region); never separated from target by unrelated content or independent
  layout flow.

Full rule: docs/rules/design.md

## Instrumentation is not optional

All code carries full instrumentation + flame-chart tracing. New code ships
with it; old code gains it ORGANICALLY — a change touching a site that
lacks it adds it. No active retrofit scans.

- Tracing: `#[hotpath::measure]` on every non-trivial function a change
  adds or touches — perf ledger + flame charts see it without a second
  pass.
- Diagnostics: every new decision site -> default-inert `FS_*` trap or
  stage-trace row per `docs/dev/traps.md` conventions — denominator stated
  in output, explicit zeros, probe shape matched to the question, a
  positive control; new trap registers in the traps.md index, same change.
- Bar: misbehaving a year from now, interrogable without editing code? No
  -> the change is not done.

Full rule: docs/rules/instrumentation.md

## Never re-derive

Fact computed ONCE, at its authority; every consumer READS it — no stage,
emitter, parser, or probe recomputes a private opinion of an existing fact.
A second derivation WILL disagree; the disagreement wears a defect's face.

- Pipeline: stages read the authority's table (`SolidLadder`,
  `ExposedSurfaces`, the wall pass's deposited footprints).
- Formats: producer states the fact explicitly (`;WIPE_START` /
  `;WIPE_END`); consumer-inferred-from-arithmetic encoding = re-derivation
  forced on every reader forever = the format is wrong.
- Probes dump the binding the pipeline ACTUALLY uses; a recomputed
  "equivalent": never.
- Generation-time classification authoritative (thin sections, overhangs,
  bridges); annotations flow from it; consumers never re-classify.

**PRODUCTION-path rule; INVERTS in a test's expected value** (Gabe
2026-08-17): MEASUREMENT <- engine (`path.width`, `loop.role`, deposited
footprints), never reconstructed from coordinates or E. EXPECTATION <-
non-engine source: the config the axis states, the dimension the fixture
states, the mesh's own cross section, arithmetic
(`E/mm = bead area x flow / filament area`). Both sides from the engine =
self-consistency; a uniform error passes it. Probe-literal expectation =
REGRESSION PIN — legitimate on a deterministic engine, labelled as a pin,
never counted as coverage. A genuinely underivable expectation: said at the
assertion site, left undone — never pinned and called a contract.

Full rule: docs/rules/never-re-derive.md

## Claimed ground is excised ground

Pipeline step cookie-cutters geometry -> PERMANENT excise from the layer.
Cutter claims ground -> no later step may receive it; same geometry
reaching two excising steps = a repeatedly-found bug class. Excise BEFORE
any downstream ground is derived; ordering = part of the rule.

- RETRACTION vs RESIDUE — two decline events, never one word. Claim not
  exercised (nothing deposited, nothing derived downstream yet) -> RETRACT:
  ground -> THE ORIGINAL OWNER as if never cut, at most once per site,
  flows the normal partition — pipeline = router; origin holds no routing
  knowledge. Unfillable remainder of an EXERCISED claim = RESIDUE: never
  backward; forward to the ONE successor the design names at that boundary,
  witnessed; the chain terminates in a deposit or a declared, warned scrap.
  Culled ground, no recipient = void; re-reachable by two recipients =
  double-write.
- Ownership of DEPOSIT ground, not single-touch: re-PROCESSING fine
  (ironing over a top skin).
- The excising subtraction = the set the cutter ACTUALLY deposited (or
  formally claimed) — never a recomputed equivalent.
- Audit question #1: "which two steps both received this ground?" — a
  static lookup; every decline site's recipient is named in the design.

Full rule: docs/rules/claimed-ground.md

## Warn loudly

Anything the user gave us that we drop, ignore, skip, clamp, substitute, or
fail to import: SAY SO where they will see it. Silence reads as success.

- "We never tried" counts: "no importer yet" = a warning, not an exemption.
- Warn, do not fail: loading succeeds; the user judges the degraded result
  — they just cannot judge it blind.
- Bar = THEIR expectation, not our contract: a clamp inside the declared
  range still != the number they typed.
- Model: the G-code config import report (unknown keys, untranslatable
  keys, clamps, per preset + the permanent "REVIEW BEFORE PRINTING: custom
  G-code is carried verbatim, not interpreted").

Full rule: docs/rules/warn-loudly.md

## Follow Orca for plurals

Never scalarise an Orca vector type because it "obviously" holds one value
— a judgement call on someone else's data model; those lose.

- The schema describes Orca's format, not our reader; scalarising eats data
  on round trip (read `0.3|0.5`, write `0.3`).
- Cannot read as a vector yet -> vector-aware accessor, or a recorded gap —
  never a schema that lies to flatter the reader.
- Accessors keep the KEY's name (`flush_multiplier` -> `Vec<f64>`, never
  `flush_multipliers`); plurality lives in the type, not a private
  vocabulary.
- Scalar-representation swap can be right (`outer_wall_line_width` ->
  `String` for the `Nx` form `FloatOrPercent` cannot hold) — not a
  plurality call.

Full rule: docs/rules/follow-orca-for-plurals.md

## Config fields stop at the hub (HARD RULE)

Gabe 2026-08-26, RULE:-dictated, retroactive: config field implemented =
full manifestation of storage, defaults, and hub wiring; engine
implementation NOT required for the field to count as implemented.

- Does not relax § Config — wiring honesty (`docs/INVARIANTS.md:146`: a key
  counts as ENGINE-wired only when its value reaches a decision). That
  question = does the engine consume the key; this rule = does the FIELD
  count as implemented at all. Hub-complete + engine-side debt coexist —
  both facts tracked, neither hides the other.

Full rule: docs/rules/config-fields-stop-at-the-hub.md

## No in-band sentinels

A number means that number. Never `-1`/`0`/`""`/`9999` for
unset/auto/inherit/disabled. Absence = `Option<T>` or an absent key; auto =
an enum variant or its own bool; numeric fields hold numbers. An upstream
format forcing a sentinel -> convert at the boundary, ONCE — never inland.

- **Empty-collection default != sentinel.** `-1` for "inherit the fill
  angle" smuggles a DIFFERENT CONCEPT inside a legal value — forbidden;
  `default = ""` on a list-shaped key decoding to "zero elements" IS the
  value. One question tells the two patterns apart: **does absence mean
  "inherit ANOTHER key's value," or "zero elements of THIS key's own
  collection"?**
  - **Inherits another key → declare NO default, ever.**
  - **Zero elements of its own collection → declare the empty value AS the
    default**, matching Orca's own empty defaults (MEASURED: 2 of the
    registry's 7 `Points`-typed keys declare it; evidence: full rule).
  - Backwards in either direction it breaks differently: a fabricated
    default on an override key silently severs inheritance (the exact
    damage this rule exists to stop); a withheld default on a UI-exposed
    Free-class key panics the registry BUILD
    (`crates/fs-config/src/generated.rs:583`,
    `crates/fs-config/src/generated.rs:595-599`).
  - Per § An accessor that can panic on absence is broken by design: a
    Pattern-2 accessor = **Free** — plain value, empty allowed — never
    `Option`; `Option` "absence is the signal" reserved for
    `overrides.is_some()` keys (Pattern 1).

Full rule: docs/rules/no-in-band-sentinels.md

## An accessor that can panic on absence is broken by design (HARD RULE)

Gabe 2026-08-27, RULE:-dictated, verbatim: **"flag anything that
can panic on absence — literally anything. that's cant-break-by-design."**

- **Not "give everything a default."** A fabricated default silently severs
  inherit-style override keys (absence there means "inherit the
  base/extruder value") — reproducing exactly the failure § No in-band
  sentinels prevents. Every registry key is exactly ONE of three classes
  (giving teeth to the register's Free/Derived/Enable honesty states,
  `docs/RULES-GROUPED.md` § Config — absent values):
  - **Free** — a real, directly-set preset value (`overrides.is_none()`,
    not computed, not text/CLI/g-code): must declare a registry default;
    the accessor returns a plain value; absence must be impossible BY
    CONSTRUCTION, not merely believed because a UI-layout row happens to
    exist today.
  - **Derived / dynamic** — computed by a registered hub relation, never
    authored directly (`crates/fs-hub/src/lib.rs:52-100`,
    `register_slicer_relations`): no static default is meaningful; the
    accessor must never fall through to a raw registry read.
  - **Override / optional** (`overrides.is_some()` on `ConfigOptionDef`,
    `crates/fs-config/src/defs.rs:58`; also CLI actions, free text, g-code
    templates): no default; the accessor returns `Option`, the caller
    decides; absence IS the signal, not a gap.
  In every class a panic is the same defect: a return type that claims
  "always present" without a mechanism that makes that true.
- **REFINES the register's no-defaults panic rule (`docs/RULES-GROUPED.md`
  § Config — absent values), does not supersede:** inventing a value for a
  key that should have one stays forbidden. This rule's target = absence
  merely BELIEVED (contingent on a UI-layout row nobody re-derives against)
  rather than ENFORCED at registry-build time or in the return type; a Free
  accessor panicking when its guaranteed construction is bypassed = a
  legitimate bug report, not this rule's target.
- **Proof, not hypothetical:** `gradual_start_density`
  (`crates/fs-hub/src/config.rs:891`) panicked when GIT_566's UI-layout
  regeneration dropped its key's sole GUI row; 463/510 `validate_on_load`
  keys (91%) shared the one-row exposure (incident + census: full rule).
- **External input never panics.** Malformed/truncated `.3mf`, hand-edited
  preset, foreign slicer config (Orca/Prusa/CrealityPrint/SanityPrint
  import, #608/#610), bad CLI flag = DATA, not our own invariant failing ->
  a diagnostic the user sees (§ Warn loudly), never a crash. The boundary
  resolves absence into a value, a typed absence, or a reported rejection
  (§ No in-band sentinels: "convert at the boundary, once"); inland code
  needs no panic guard — the unrepresentable state cannot reach it.

Full rule: docs/rules/panic-on-absence.md

## The environment is read once

Gabe 2026-08-18: **"call frequency doesn't matter, it's a matter of
design."** The process environment = a FACT (§ Never re-derive): every
`FS_*` switch resolved in ONE `traps` module per crate
(`fs_arachne_voronoi::traps` = the model); everything inland reads a field.
An `FS_*` name anywhere else in the crate = a bug.

- Mechanically checked, not promised: each authority ships a test grepping
  its own crate for `env::var`, failing on any site but itself
  (`traps_are_the_only_env_reader`). A doc comment stops nobody.
- A field read != the whole fix: a switch gating a PER-ELEMENT decision ->
  chosen once, outside the loop, monomorphised
  (`fn walk<const TRAP: bool>`) so the branch compiles out. A cached
  `OnceLock` read still costs a branch per element — explicitly rejected as
  sufficient.
- Cost = the symptom, not the rule: scattered authorities = the defect; the
  rule would hold at one call per slice.

Enforcement: `docs/RULES-GROUPED.md` § Design — invariants by construction;
the per-crate `traps_are_the_only_env_reader` test; GIT_385.

Full rule: docs/rules/environment-read-once.md

## Work starts in an agent (HARD RULE)

Gabe 2026-08-27, RULE:-dictated: efforts START in agents. The main loop's
own work = design, adjudication, verdicts, verifying a returned result;
everything else -> a dispatched subagent.

- NO size threshold decides this (a threshold proposal was rejected
  2026-08-26): an effort starts in an agent.
- The cost conserved = main-loop CONTEXT, not model spend — tool output the
  agent absorbs, returned as a summary.
- ONE serial agent within its class (§ Serial agents only) = the standing
  default, no permission needed; only cross-class fan-out beyond that
  allowance, or a Workflow, needs the user's ask.
- Loading a skill's full body into main-loop context to do the work
  yourself IS doing the work — the skill invocation goes inside the
  dispatched agent's prompt.

Full rule: docs/rules/work-starts-in-an-agent.md

## Agent cost economy (HARD RULE)

Ruled by Gabe 2026-08-15 (RULE:-dictated): cheapest capable model per subagent
task; quality is held by verification gates (citation spot-checks, coverage
counts, red-checks), never by model tier. Default assignments: haiku for
enumerative extraction with citations, sonnet for synthesis/judgement subagent
work, main-loop model only for design, adjudication, and verdicts. A cheap
agent whose spot-check fails gets its batch redone one tier up — recorded,
never silent. Campaign plans state the model per task type.

## Serial agents only (HARD RULE)

Gabe 2026-08-24, narrowed 2026-08-27, both RULE:-dictated: exactly ONE
subagent at a time PER TASK CLASS — classes = task kind (*effort*,
*review*, *rule-intake*, others as one gets named). WITHIN a class: one at
a time, never fan out. ACROSS classes: parallel IS allowed, no asking.

- Dispatch one per class -> wait -> verify its RESULT -> only then the next
  in that same class. "Independent tasks within a class" != a licence to
  parallelise them.
- Every dispatch prompt forbids the agent spawning its own subagents or
  using the Agent/Workflow tools — an agent that fans out is a fan-out,
  regardless of class.
- `ListAgents` (not TaskList) shows which agents are actually live, across
  every class; any doubt -> check before dispatching.
- Workflows fan out by construction: never started without the user
  explicitly asking first — never on the agent's own initiative, even
  proposed as a question.

Full rule: docs/rules/serial-agents-only.md

## Batch the units (HARD RULE)

Gabe 2026-08-25, RULE:-dictated: **a long task of many stand-alone units ->
dispatched in BATCHES** — never one agent per unit, never every unit in one
agent; batch size balances token cost against dispatch overhead. Both
extremes = the failure.

- A GRANULARITY rule only; does not touch concurrency: batches dispatch ONE
  AT A TIME within a class (§ Serial agents only), each verified before the
  next; says nothing about a different class running concurrently.
- The batch-sharing test = "can run on their own": no ordering constraint,
  no shared state. A unit whose input is another unit's output !=
  independent.
- Report the batch count + what each batch covered — a partial failure
  names the units that did not run.

Full rule: docs/rules/batch-the-units.md

## Worktrees

One per campaign (any multi-commit engine or feature effort); one-commit
fixes + docs/preset tweaks run on `main`.

- Branch name = the worktree name VERBATIM, no prefix:
  `git worktree add .claude/worktrees/<name> -b <name>` (the WorktreeCreate
  hook in `.claude/settings.json` enforces this for tool-created
  worktrees).
- Lifecycle: create -> commit there -> merge to `main` once green on the
  full battery (workspace tests, goldens, oracle) -> delete worktree AND
  branch immediately (stale ones have reached ~230 GB).
- Commit with explicit pathspecs (`git commit -- <paths>`) — the shared
  index has swept unrelated files before. Mechanical backstop (GIT_700):
  pre-commit ADVISORY (`scripts/sweep_guard.sh`) when a docs-shaped commit
  stages a newly-tracked non-doc file — the wildcard-add sweep signature.
- Agent/isolation worktrees branch from `origin/<default>`, not local HEAD;
  `main` leads origin -> reset onto local `main` first.
- Inside a worktree: anything above the repo root = off limits unless
  asked.
- A shared worktree = SHARED STATE: temporary instrumentation announced
  (the file + a unique marker string) BEFORE writing; both removed when the
  measurement ends. Unannounced, a live probe reads as unexplained drift ->
  reverted mid-measurement.

Full rule: docs/rules/worktrees.md

## Tracking work

- Related bugs share one worktree; a late-discovered link -> combine, clean
  up.
- Every new piece of work -> a GitHub issue, full engineer-stranger spec;
  `/superpowers` plans and specs hang off it.
- Each campaign keeps a ledger (did / changed / better / regressed /
  worked? / new smells); learnings ship with the major commit or worktree,
  versioned like code.
- Pickup protocol: every ticket has exactly ONE "Context:" sub-issue = the
  compressed AI pickup context, kept current as the ticket moves. Catching
  up = list titles -> fetch the ticket's one sub-issue -> read its
  description — nothing else unless that proves insufficient.
  - The sub-issue relation is RESERVED for this pair alone. Campaign
    findings, epic chapters, follow-ups = each a NEW ticket pair, never a
    sub-issue of the campaign — added-linked at both levels (new parents on
    the overall parent, new Context children on the overall Context child).
- Issue reads = minimum-token: API for only the fields needed; a full issue
  read only when more context is needed; never pull full issues wholesale.
  A referred issue number ALWAYS = the SET (parent+child); the access rules still
  apply.
- Developer corrections -> update the parent spec AND the Context child,
  every time.
- Every issue gets a label for its worktree.
- Every commit message carries its issue marker, `GIT_\d+`.

Full rule: docs/rules/tracking-work.md

## Build cache

Worktrees (`.claude/worktrees/*`, `.codex/worktrees/*`) share and poison Cargo's
incremental cache; branch switches and merges rewrite mtimes, defeat fingerprinting,
and leave stale `.rlib`s.

- Symptom: errors that contradict the source. A `pub` symbol "not found", a signature
  mismatch whose reported definition line is not the real `fn`, new methods missing
  while old ones on the same type resolve. Cargo is linking a stale dependency build.
- Fix: `cargo clean`, rebuild. Do that before believing any such error is real.

## No WSL

Gabe 2026-08-25, RULE:-dictated: **no WSL in this project until otherwise
stated** — literal: a scope decision Gabe can lift, not a claim that WSL is
unusable. The POSIX shell = Git Bash
(`C:\Program Files\Git\usr\bin\bash.exe`); Windows-native tooling + Git
Bash = the whole toolchain; nothing invokes `wsl.exe`.

- Bare `bash` != Git Bash: PATH lookup can land on the Windows WSL launcher
  stub (`C:\Windows\System32\bash.exe`) — UTF-16 noise, exit 1.
- Resolve a real bash — reject candidates under `System32`, `SysWOW64`,
  `WindowsApps`; a tool that cannot find one FAILS LOUDLY, naming what it
  looked for — never skips quietly (a skipped check reads as a pass, § Warn
  loudly).

Full rule: docs/rules/no-wsl.md

## Reference sources

`G:\CLionProjects\` : `OrcaSlicer`, `PrusaSlicer`, `CrealityPrint`, `SanityPrint`

All four legitimate. Cite the tree a fact ACTUALLY came from; lead with the
one that owns it.

- **OrcaSlicer = FIRST PASS** — primary reference, correctness target, base
  of the config dialect; a parity question is answered against Orca.
- **CrealityPrint = COMPATIBILITY TARGET, not first pass.** Not banned,
  never erased: some fields/features exist only in CP; CP profile migration
  intended. Cite CP where the thing is CP-only; lineage/compatibility lines
  keep CP named, Orca leads.
- **SanityPrint** (Gabe's fork of CrealityPrint) = a reference source in
  its own right, cited DIRECTLY where it is the actual source; it DIVERGES
  from CP (measured 2026-08-26; evidence: full rule).
- **PrusaSlicer** = the ancestry the others descend from.
- Citation naming the wrong tree = a defect even when the symbol exists in
  several trees: it sends the next reader to a file that does not contain
  the value.
- Reading a reference != porting it. No verbatim porting from any tree:
  source = behavioural contract only, the design is owned; C++ file/line
  citations belong in specs and research docs, never in Ferrislicer code.

Full rule: docs/rules/reference-sources.md

