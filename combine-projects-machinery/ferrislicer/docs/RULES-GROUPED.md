# Design and Implementation Rules, Grouped by Intent

**This is the project's design-decision register — the living authority on WHAT was
decided.** Its sibling, `docs/INVARIANTS.md`, is the enforcement ledger — the living
authority on HOW STRONGLY code holds each invariant (rungs 0–8). One job per doc;
they cross-link, they never duplicate. Everything else that states a rule
(superpowers specs/plans, refactor docs, LEARNINGS.md) is immutable history that
this register cites.

The 432 rules of `docs/RULES.md` (a dated extraction snapshot, not maintained),
regrouped. Rules that bear on the same design decision - agreeing, refining, or
disagreeing - share a table, sorted by the blame dates of the flat list. Each group
summary states what binds the rules and, where the project wobbled, what the wobble
argued about and where it ended. Verdicts marked *(inferred)* are read from the
latest-dated rule and current docs, not separately adjudicated. Rules related to
nothing else appear in the final Solo section, grouped by area with no common-thread
summary. Seeded by extraction 2026-08-15; hand-maintained ever since.

Each group header carries a status circle: 🟢 the design came to a conclusive
end (agreeing rules, or a wobble with a clear written verdict); 🟡 weak agreement
(the standing verdict is only inferred, or a deviation is documented but never
reconciled); 🔴 no conclusive end - opposing rules are both still live.

## Maintaining this file (the contract)

Machine-checked by `scripts/register_check.py` (pre-commit `--fast`, full in CI).

- **Same commit.** A change that adds, changes, or supersedes a rule updates this
  register in the same commit as the durable-home edit. The register CITES, it never
  ORIGINATES: every row's citation points at where the rule actually lives
  (CLAUDE.md, a spec, INVARIANTS.md) — write it there first.
- **Adding a rule.** Find candidate groups via Contents + group summaries; agreeing
  or refining → append a row (date = today, cite the durable home). Contradicting →
  that is a wobble: record "The wobble / Where it ended" with the adjudicated
  verdict and set the circle accordingly. No fitting group but siblings exist →
  promote them into a new group with a summary. No siblings → row in the matching
  Solo area; no fitting area → new Solo area. The `/rule-intake` skill walks these
  steps; prompts beginning `RULE:` are captured to `docs/rule-inbox.md` by hook and
  block commits until dispositioned here or dismissed with a reason.
- **Superseding.** The old doc gets, as its first body line:
  `> SUPERSEDED (YYYY-MM-DD): see docs/RULES-GROUPED.md § <group>` — and the group
  gets a `Supersedes:` line citing that doc. Both directions, same commit,
  checker-enforced. Old bodies are never rewritten.
- **Flipping a circle.** Only an adjudication (Gabe's ruling, or a landed change
  that settles the question) flips 🟡/🔴 → 🟢; drop *(inferred)* when it happens
  and cite the ruling.
- **Citations name a SECTION, never a line, for CLAUDE.md.** `` `CLAUDE.md` § <heading> ``
  — a line number cites a POSITION, and every insert above it silently retargets the
  row. Measured 2026-08-26 before the conversion: of 22 bare `CLAUDE.md:NNN` rows, 4
  pointed at a blank line and 2 named the wrong rule, and all 22 passed the checker,
  which tested only that the file existed. Blocking for CLAUDE.md (checker-enforced,
  red-checked); the heading is matched by PREFIX, so citing "Agent cost economy" against
  `## Agent cost economy (HARD RULE)` is correct and intended. Other files may still cite
  by line, but a citation landing on a BLANK line is BLOCKING everywhere: it shipped
  advisory at 13 occurrences, those 13 were repaired to section form, and it was promoted
  in the commit that emptied it. A blank line is not a weak citation, it is no citation.
- **Cross-links.** A group whose rules are enforced in code lists its
  `docs/INVARIANTS.md` §7 anchors; keep them resolving (checker-enforced).

## Contents

- 🟢 [Engine — determinism](#engine-determinism) (9 rules)
- 🟢 [Engine — GPU and SIMD scope](#engine-gpu-and-simd-scope) (3 rules)
- 🟡 [Verification — what "correct output" means](#verification-what-correct-output-means) (7 rules)
- 🟢 [Verification — golden and oracle handling](#verification-golden-and-oracle-handling) (11 rules)
- 🟢 [fs-hub — live reads vs snapshots](#fs-hub-live-reads-vs-snapshots) (16 rules)
- 🟢 [GUI — reslice trigger](#gui-reslice-trigger) (2 rules)
- 🟢 [Config — provenance](#config-provenance) (7 rules)
- 🟡 [Config — absent values: no defaults, no sentinels, strict vs tolerant](#config-absent-values:-no-defaults-no-sentinels-strict-vs-tolerant) (14 rules)
- 🟢 [fs-config — registry codegen source](#fs-config-registry-codegen-source) (9 rules)
- 🟢 [fs-config — what is (and is not) a config key](#fs-config-what-is-and-is-not-a-config-key) (4 rules)
- 🟢 [Config — objects, not index tables; plurals stay plural](#config-objects-not-index-tables;-plurals-stay-plural) (11 rules)
- 🟢 [Config — preset mutation and override resolution](#config-preset-mutation-and-override-resolution) (5 rules)
- 🟢 [Config — per-instance membership as data](#config-per-instance-membership-as-data) (3 rules)
- 🟢 [Config — wiring honesty](#config-wiring-honesty) (11 rules)
- 🟢 [Config — relation graph](#config-relation-graph) (6 rules)
- 🟢 [Engine — reslice cache membership](#engine-reslice-cache-membership) (2 rules)
- 🟢 [Cross-cutting — single authority, never re-derive](#cross-cutting-single-authority-never-re-derive) (10 rules)
- 🟢 [Fill — claimed ground and containment](#fill-claimed-ground-and-containment) (9 rules)
- 🟡 [Deposition — same-layer overlap scope](#deposition-same-layer-overlap-scope) (4 rules)
- 🟢 [Engine — overhang and bridge classification](#engine-overhang-and-bridge-classification) (11 rules)
- 🟢 [User-facing — warn loudly](#user-facing-warn-loudly) (11 rules)
- 🟢 [G-code — custom G-code and templates](#g-code-custom-g-code-and-templates) (14 rules)
- 🟢 [Reference sources — porting policy](#reference-sources-porting-policy) (7 rules)
- 🟢 [Verification — testing discipline](#verification-testing-discipline) (18 rules)
- 🟢 [Design — invariants by construction](#design-invariants-by-construction) (25 rules)
- 🟢 [Design — enforcement ladder](#design-enforcement-ladder) (12 rules)
- 🟢 [Design — invariant anti-patterns](#design-invariant-anti-patterns) (22 rules)
- 🟢 [Design — invariant ledger](#design-invariant-ledger) (11 rules)
- 🟢 [Process — worktrees, commits, staging](#process-worktrees-commits-staging) (14 rules)
- 🟢 [Process — shared-worktree coordination](#process-shared-worktree-coordination) (4 rules)
- 🟢 [Process — formatting scope](#process-formatting-scope) (3 rules)
- 🟢 [Process — agent orchestration](#process-agent-orchestration) (5 rules)
- 🟢 [Process — review and audit agents](#process-review-and-audit-agents) (6 rules)
- 🟢 [Performance — measurement method](#performance-measurement-method) (13 rules)
- 🟢 [Geometry kernel — coordinates and numeric exactness](#geometry-kernel-coordinates-and-numeric-exactness) (8 rules)
- 🔴 [Cross-cutting — process globals vs carried values](#cross-cutting-process-globals-vs-carried-values) (2 rules)
- 🟢 [Diagnostics — probes and traps](#diagnostics-probes-and-traps) (16 rules)
- 🟢 [fs-meshbool / mesh repair — kernel robustness](#fs-meshbool-mesh-repair-kernel-robustness) (10 rules)
- 🟢 [Platforms — per-platform crate split](#platforms-per-platform-crate-split) (8 rules)
- 🟢 [Platforms — Android line sync](#platforms-android-line-sync) (3 rules)
- 🟡 [fs-arachne-voronoi / walls — bead generation](#fs-arachne-voronoi-walls-bead-generation) (5 rules)
- 🟢 [Safety — forbid unsafe](#safety-forbid-unsafe) (2 rules)
- 🟢 [Infill — connected pattern behavior](#infill-connected-pattern-behavior) (4 rules)
- 🟢 [Engine — speed clamp ordering](#engine-speed-clamp-ordering) (2 rules)
- 🟢 [docs/learning — course authoring](#docslearning-course-authoring) (6 rules)
- 🟢 [docs — mapping passes](#docs-mapping-passes) (6 rules)
- 🟢 [Process — issue tracking](#process-issue-tracking) (2 rules)
- 🟢 [Process — user-audit handling](#process-user-audit-handling) (2 rules)
- 🟢 [Verification — a measurement's scope is part of its claim](#verification-a-measurements-scope-is-part-of-its-claim) (4 rules)
- 🟢 [CI — gate integrity](#ci-gate-integrity) (8 rules)
- 🟢 [Governance — decision records](#governance-decision-records) (1 rule)
- [Solo rules, by area](#solo-rules-by-area) (47 rules)

## 🟢 Engine — determinism

Every rule here serves one goal: the engine is a pure, deterministic function of mesh and config. No RNG, no clock, no hash-map iteration order, byte-deterministic containers, and the parallel build asserted byte-identical to serial — even Android pins target-cpu so cross-machine output matches.

Determinism is the precondition the whole verification strategy rests on.

| Date | Rule | Source |
|---|---|---|
| 2026-06-17 | Per-layer and per-object parallelism uses rayon gated behind a `parallel` feature so single-thread builds stay bit-reproducible for parity testing. | `docs/adr/0002-parallelism-simd-gpu.md:17` |
| 2026-06-18 | The core slicing engine must stay CPU-only and deterministic (so parity tests remain valid); parallelism is provided only via rayon. | `README.md:117` |
| 2026-06-18 | The `parallel` build must be asserted byte-identical to the serial build so parallelism can never silently change output. | `docs/adr/0005-verification-strategy.md:50` |
| 2026-06-20 | Z-bucketing, multicore, AABB trees, and edge-id chaining are treated as parity-restoration (matching what the reference engine already does), not as divergence from parity. | `docs/adr/0006-slicing-performance-roadmap.md:58` |
| 2026-06-28 | A binary output container must be byte-deterministic: no embedded timestamps, a fixed CRC32 over stable bytes, and all multi-byte integers written little-endian. | `docs/superpowers/plans/2026-06-28-binary-gcode-and-output.md:27` |
| 2026-06-28 | Generative geometry algorithms must be deterministic: no random-number generation or nondeterministic parallelism, and ties are broken by a fixed, documented order. | `docs/superpowers/plans/2026-06-28-lightning-infill-distance-field.md:15` |
| 2026-06-28 | Every engine pass must be a pure, deterministic function of mesh and config only, with no RNG or clock dependency, preserving the engine's determinism guarantee. | `docs/superpowers/specs/2026-06-28-overhang-quality-design.md:403` |
| 2026-07-08 | Cross-layer bead-count stabilization must be a pure, symmetric Z-window pre-pass computed before any wall generation — order-free with no directional carry — to preserve parallel==serial determinism. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:444` |
| 2026-07-18 | Android build targets must pin target-cpu=generic so sliced G-code stays byte-identical with the desktop build. | `docs/BUILDING.md:58` |

## 🟢 Engine — GPU and SIMD scope

Three rules drawing the same line: acceleration must never threaten parity. SIMD only where data is wide and float-heavy, GPU never in the core engine.

GPU is rendering/preview or an opt-in experiment only; the parity-safe CPU levers were measured sufficient.

| Date | Rule | Source |
|---|---|---|
| 2026-06-17 | SIMD is applied only where data is wide and float-heavy (e.g. 3D mesh transforms), never as a blanket optimization. | `docs/adr/0002-parallelism-simd-gpu.md:29` |
| 2026-06-17 | GPU acceleration is rejected for the core slicing engine (determinism/parity); GPU is only for rendering/preview or an opt-in non-reference experiment, never the parity reference. | `docs/adr/0002-parallelism-simd-gpu.md:39` |
| 2026-06-20 | Do not build a GPU/CUDA backend for the core slicing engine; the parity-safe CPU levers (binning, multicore, compile flags) already reach the target speedup without forfeiting the bit-exact parity oracle. | `docs/perf/slicing-acceleration-roadmap.md:453` |

## 🟡 Verification — what "correct output" means

**The wobble:** what "correct" means — matching the C++ reference byte-for-byte, or satisfying Ferrislicer's own invariants with the reference as evidence. The 2026-06-18 fixture policy compared structural metrics within tolerance; the rewrite roadmap (2026-06-20) then made byte-for-byte G-code parity with the C++ reference the only definition of done; by July the project had moved again: algorithmic changes may move G-code when verified by structural parity plus determinism checks, and the Arachne rewrite is explicitly never judged against Orca output at all — property assertions plus self-golden determinism gates.

**Where it ended (inferred):** byte-identity is the bar for value-neutral changes; deliberate algorithmic/innovating work is judged by structural parity, invariants, and self-goldens — the reference is evidence, not the oracle.

| Date | Rule | Source |
|---|---|---|
| 2026-06-18 | Golden fixtures compare structural metrics within tolerance against reference output, never assert byte-for-byte file equality. | `docs/adr/0005-verification-strategy.md:18` |
| 2026-06-20 | The rewrite roadmap's pivotal sequencing rule: the headless CLI slicer must ship at phase 4, proving engine parity via a golden-fixture harness, before any GUI work begins. | `docs/superpowers/specs/2026-06-17-ferrislicer-rewrite-roadmap.md:7` |
| 2026-06-20 | G-code output parity versus the C++ reference is the only definition of done for the rewrite; floating-point order, integer rounding, and tie-breaking must not diverge silently. | `docs/superpowers/specs/2026-06-17-ferrislicer-rewrite-roadmap.md:70` |
| 2026-06-25 | A read-path migration/refactor must introduce no new behavior and no new config keys; it may only change how existing values are read. | `docs/superpowers/plans/2026-06-25-m1-writer-reads-sliceconfig.md:15` |
| 2026-07-02 | Algorithmic changes may move G-code output when verified by structural parity, self-golden comparison, and a parallel==serial determinism check. | `docs/superpowers/specs/2026-07-02-independent-support-layer-height-design.md:69` |
| 2026-07-08 | The new Arachne wall generator's output must never be tested against Orca output or a checked-in golden as a correctness oracle; acceptance is by property/invariant assertions plus a self-golden determinism gate (byte-identical run-to-run and parallel==serial), since Ferrislicer's Arachne implementation deliberately innovates and legitimately differs from any reference. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:418` |
| 2026-07-09 | A claim of byte-identical output must be measured by building and diffing the golden suite, never assumed. | `docs/superpowers/specs/2026-07-09-arachne-flow-single-source.md:39` |

## 🟢 Verification — golden and oracle handling

One agreeing family about how the golden oracle is read and maintained: verdicts come from diffing the mismatch set against a known baseline (never the exit code), a rebaked golden proves only self-consistency, unexpected toolpath drift means stop-and-reconcile (never re-baseline), tolerances are never tuned to manufacture findings, skipped cases are unproven, output is never truncated, source is never edited just to make a row pass, and gating runs on the real preset stack.

Each rule closes a distinct way of fooling the oracle.

| Date | Rule | Source |
|---|---|---|
| 2026-06-22 | Any change that can affect sliced output must leave default output byte-identical unless it is a deliberate, called-out correctness fix, verified by keeping the golden oracle comparison at its established baseline after every task that can affect sliced output. | `docs/superpowers/plans/2026-06-22-config-honesty-mechanism.md:13` |
| 2026-06-28 | When a supposedly value-neutral change moves the oracle result, the fix is to correct the accessor's fallback value, never to re-baseline or regenerate the golden to mask the discrepancy. | `docs/superpowers/specs/2026-06-28-slicing-core-corner-cases-design.md:329` |
| 2026-07-10 | A golden update must never be used to paper over unintended toolpath drift; if a toolpath golden moves unexpectedly, stop and reconcile rather than regenerate. | `docs/superpowers/specs/2026-07-10-one-flow-source-of-truth.md:79` |
| 2026-07-22 | Every golden regeneration must be diff-reviewed by a human: rebaked goldens prove self-consistency, never parity, so only config-dump comment lines may change — if any G0/G1 toolpath line moves, stop and investigate. | `docs/superpowers/plans/2026-07-22-registry-orca-vocabulary.md:16` |
| 2026-07-26 | Golden-oracle parity verdicts must be judged by diffing the mismatch set against a known baseline, never by the harness's exit code, since one mismatch is pre-existing. | `.claude/agents/parity-verifier.md:11` |
| 2026-07-26 | Any change to a config schema default must be run through the oracle_compare.py parity harness, since getter-level fallbacks can drift silently. | `.claude/agents/parity-verifier.md:24` |
| 2026-07-26 | Never tighten an oracle-comparison tolerance just to manufacture a finding. | `.claude/agents/parity-verifier.md:42` |
| 2026-07-26 | An oracle test case marked SKIPPED is unproven, not passed, and every skipped case must be listed in the report. | `.claude/agents/parity-verifier.md:53` |
| 2026-07-26 | Never pipe the oracle harness's output through head/tail/Select-Object or any other truncation; the full row table must be read. | `.claude/agents/parity-verifier.md:67` |
| 2026-07-26 | Never edit source code just to make an oracle-comparison row pass; describe the fix and stop instead. | `.claude/agents/parity-verifier.md:93` |
| 2026-08-01 | Gate verification on the real user preset stack, never on CLI defaults. | `docs/LEARNINGS.md:221` |

## 🟢 fs-hub — live reads vs snapshots

**The wobble:** whether a consumer may hold a snapshot of config, or must read the live hub. Early designs built snapshot structs (EngineConfig, SliceParams); the unified-live-hub design then ruled a rebuildable snapshot is a second source of truth that can drift, and every parallel representation was ordered deleted. The frozen snapshot survived with exactly two sanctioned uses: cross-thread slice-worker handoff, and tests (which must call hub.freeze()).

**Where it ended:** one live hub, all mutation through the single setter, consumers read typed accessors live; freeze() only for the off-thread handoff and tests. The snapshot-consumer pattern is dead.

Enforcement: `docs/INVARIANTS.md` §7.7.

Supersedes: `docs/superpowers/plans/2026-06-23-unified-live-hub-config.md` (SP2–SP5 roadmap, consolidated into the finish-hub-migration design).

| Date | Rule | Source |
|---|---|---|
| 2026-06-20 | Profile editors must operate on the full DynamicConfig plus provenance, never on the flattened EngineConfig. | `docs/superpowers/specs/2026-06-20-profile-editor-redesign-design.md:82` |
| 2026-06-21 | A field view must borrow the existing single source-of-truth config store rather than duplicating or owning a copy of it. | `docs/superpowers/plans/2026-06-21-provenancable-field-model-foundation.md:14` |
| 2026-06-21 | Mutation of config state stays routed through the single setter keyed by field name; never mutate through a borrowed reference obtained from a read-only leaf/form view. | `docs/superpowers/plans/2026-06-21-provenance-phase1-editor-honesty.md:14` |
| 2026-06-21 | All config mutation must flow through the single config hub, with no out-of-band write path, so field provenance is correct by construction and can never go stale. | `docs/superpowers/specs/2026-06-21-config-hub-architecture-design.md` § 1. The Hub — single source of truth for state + mutation + provenance |
| 2026-06-21 | The engine must consume only an immutable frozen snapshot of resolved config at slice time, never reading the live mutating config hub directly. | `docs/superpowers/specs/2026-06-21-config-hub-architecture-design.md:87` |
| 2026-06-21 | Do not rewrite the engine to be untyped; keep EngineConfig typed and bind each leaf's value to it individually. | `docs/superpowers/specs/2026-06-21-provenancable-field-model-design.md:136` |
| 2026-06-21 | Keep the flat DynamicConfig as the persistence/inheritance substrate; leaves are views over it, never a competing source of truth. | `docs/superpowers/specs/2026-06-21-provenancable-field-model-design.md` § Non-goals / constraints |
| 2026-06-22 | Everything flows through the config hub as the single source of truth, and feature toggles together with their sub-options must themselves be modeled as config options, not ad hoc code flags. | `docs/superpowers/plans/2026-06-22-config-hub-remaining-work.md:32` |
| 2026-06-22 | The config hub must be the single source of truth for configuration, with the engine consuming it through the hub and both the GUI and CLI building a hub rather than reading config another way. | `docs/superpowers/specs/2026-06-22-config-honesty-redesign-design.md:106` |
| 2026-06-23 | The config hub is the single source of truth; no consumer may hold a standing copy of config state, and the frozen/immutable snapshot exists only for the off-thread slicing handoff, never for the live read path. | `docs/superpowers/plans/2026-06-23-unified-live-hub-config.md:15` |
| 2026-06-23 | Config accessor reads must be bound into a local variable once at region/layer entry, never called per-point, so a relation is not recomputed inside the inner loop. | `docs/superpowers/specs/2026-06-23-sp2-engine-reads-sliceconfig-design.md:49` |
| 2026-06-23 | A config snapshot that must be rebuilt on every change is not a cache but a second source of truth that can drift, so the read path must never hold such a snapshot; config must be read live instead. | `docs/superpowers/specs/2026-06-23-unified-live-hub-config-design.md:30` |
| 2026-06-23 | Consumers must never build their own config snapshot structs (like SliceParams or EngineConfig); they must read the ConfigHub live through typed accessors instead. | `docs/superpowers/specs/2026-06-23-unified-live-hub-config-design.md:37` |
| 2026-06-23 | The config hub's frozen-snapshot capability must never be used as the consumer read interface; it exists only for cross-thread slice-worker handoff and future versioning. | `docs/superpowers/specs/2026-06-23-unified-live-hub-config-design.md:46` |
| 2026-06-25 | ConfigHub must be the single, live configuration object for the whole application (engine, G-code writer, CLI, GUI); every derived or parallel config representation (EngineConfig snapshot, SliceParams, ActivePreset) must be deleted so no snapshot can drift from the truth. | `docs/superpowers/specs/2026-06-25-finish-hub-migration-design.md:9` |
| 2026-07-02 | Tests must always call hub.freeze() to get a frozen config rather than reading the live, mutating hub. | `docs/superpowers/plans/2026-07-02-independent-support-layer-height.md:17` |

## 🟢 GUI — reslice trigger

**The wobble:** does an edit re-slice automatically, or only the user. The live-hub design (2026-06-23) had the GUI re-slice whenever the hub's change-generation counter moved; three days later the GUI rules pinned reslicing to the explicit user action, twice, even when the counter is available.

**Where it ended:** manual reslice won — the Slice button is the only trigger.

Enforcement: `docs/INVARIANTS.md` §7.8.

| Date | Rule | Source |
|---|---|---|
| 2026-06-23 | The GUI must cache no config state; it must re-slice only when the hub's change-generation counter changes. | `docs/superpowers/specs/2026-06-23-unified-live-hub-config-design.md:44` |
| 2026-06-26 | Reslicing stays manual, triggered only by the explicit user action; edits to config must never trigger automatic re-slicing, even when a change-generation counter is available. | `docs/superpowers/plans/2026-06-26-m3-gui-holds-hub.md:8` |

## 🟢 Config — provenance

Agreeing refinements of one model: provenance is a property of the leaf value itself, computed on demand from where it was set (never cached beside the value), never implemented by an aggregating container, with serialization defined by provenance state and schema defaults resolved as values with provenance.

**Standing:** leaf-only, on-demand, value-owned.

Supersedes: `docs/superpowers/specs/2026-06-21-provenancable-field-model-design.md` (absorbed by the config-hub architecture; its leaf-provenance rules live on here).

| Date | Rule | Source |
|---|---|---|
| 2026-06-20 | A config value's provenance (origin) must be computed on demand from where it was set, never cached as a stored field alongside the value itself. | `docs/superpowers/plans/2026-06-20-profile-editors-phase2b-workspace-core.md:14` |
| 2026-06-21 | Provenance is leaf-only: a provenance trait is implemented by individual leaf values, never by an aggregating container, since a container has no single origin. | `docs/superpowers/plans/2026-06-21-provenancable-field-model-foundation.md:13` |
| 2026-06-21 | A leaf's serialize behavior is defined in terms of its provenance: an inherited leaf persists nothing, while an overridden or session-modified leaf persists its effective value. | `docs/superpowers/plans/2026-06-21-provenancable-field-model-foundation.md:15` |
| 2026-06-21 | The aggregating Form container must never be made provenancable. | `docs/superpowers/specs/2026-06-21-provenancable-field-model-design.md` § Non-goals / constraints |
| 2026-06-21 | Provenance must be a property owned by the value itself, not bolted onto the editing interface. | `docs/superpowers/specs/2026-06-21-provenancable-field-model-design.md` § Core idea |
| 2026-06-21 | Only individual leaf values may implement the Provenancable trait; a container (a form) must never implement it, since asking a whole form for its origin is a category error. | `docs/superpowers/specs/2026-06-21-provenancable-field-model-design.md:36` |
| 2026-08-01 | A schema default is a value with provenance, not a placeholder dash; resolve it through the provenance mechanism. | `docs/LEARNINGS.md:245` |
| 2026-08-28 | The provenance state set (7 states), the inheritance chain, and the precedence order between them are durably recorded here, not restated in code comments -- `Provenance` and the two `provenance()` functions in `hub.rs` keep a one-line summary and a pointer. | `docs/adr/0008-config-provenance-and-inheritance.md` § Decision |
| 2026-08-29 | An object/group override is TERMINAL and per-project: it replaces what the chain resolved for the keys it names, is not a chain level, is not a preset fork, and nothing inherits from it. Picks up the volume-over-object-over-global ladder ADR 0008 §2a explicitly placed outside its scope. | `docs/adr/0010-object-and-group-config-overrides.md` § 1-2 |
| 2026-08-29 | An object's override source is exactly one of own / its group's / none, and holding both must be UNREPRESENTABLE (a sum type, a compile error) -- a validator that merely detects the illegal pair does not satisfy this. | `docs/adr/0010-object-and-group-config-overrides.md` § 3 |
| 2026-08-29 | Joining a group DROPS the object's own overrides (loudly, undoably); splitting out of a group KEEPS the group's overrides as the object's own, as an independent copy. The round trip is deliberately not the identity, and is pinned by test so a later "fix" cannot reintroduce interop. | `docs/adr/0010-object-and-group-config-overrides.md` § 4-6 |

## 🟢 Config — absent values: no defaults, no sentinels, strict vs tolerant

**The wobble:** what happens when a config key is absent — panic, or fall back. No value is invented anywhere (a missing engine-read value panics rather than substituting a default) and no in-band sentinel ever means unset/auto/inherit — every field is honestly Free, Derived, or Enable. But the feature-spec era added the counterweight: keys that may be absent from a bundled preset must be read tolerantly with a behavior-preserving fallback, precisely so the no-defaults panic never fires on an optional key.

**Where it ended:** Gabe adjudicated the wobble directly, 2026-08-27 (`CLAUDE.md` § An accessor that can panic on absence is broken by design) — **nothing may panic on a value's absence, period.** This REFINES the split above rather than replacing it: "no value is invented anywhere" and "no in-band sentinel" both still stand exactly as stated. What was missing is the third leg — absence must be TYPED, never fatal. Every field is exactly one of the three honest states the 2026-06-22 row below already names, and its accessor's return type must now tell the truth about which: **Free** declares a default and returns a plain value, absence impossible by construction; **Derived/dynamic** is computed at runtime with no static default; **Override/optional** (`overrides.is_some()`) returns `Option`, absence being the meaningful signal that replaced the `-1` sentinel — so "give every key a default" is explicitly rejected, since default-filling an override key severs the inheritance it encodes. A second, independent leg: **external input never panics** — a malformed `.3mf`, hand-edited preset, foreign slicer config, or bad CLI flag yields a diagnostic (§ Warn loudly), never a crash; the boundary resolves absence once, inland the bad state is unrepresentable. Proof this was live, not hypothetical: `gradual_start_density` (`crates/fs-hub/src/config.rs:891`) panicked on `tpms_start_infill_density` when a GUI-layout regen dropped its one supporting row (measured, `.claude/worktrees/GIT_566/target-gate/gate-logs/battery.log:3594`) — see `docs/INVARIANTS.md` § 7.7 Config and issues [#614](https://github.com/gnydick/ferrislicer/issues/614)/[#615](https://github.com/gnydick/ferrislicer/issues/615) (root-cause: `validate_on_load` derived from GUI presence, not engine consumption) plus the new pair filed for the general accessor-return-shape gate.

| Date | Rule | Source |
|---|---|---|
| 2026-06-22 | There must be no implicit inheritance between config fields; a "0 means follow another field" sentinel must become an independent, explicit value instead. | `docs/superpowers/specs/2026-06-22-config-honesty-redesign-design.md:103` |
| 2026-06-22 | Every config field must be exactly one of three honest states (Free, Derived, or Enable): no sentinels, no implicit inheritance, no heuristics. | `docs/superpowers/specs/2026-06-22-config-honesty-redesign-design.md:89` |
| 2026-06-23 | No defaults are invented anywhere in the config model: every engine-read value must come from an explicit preset value reached through the hub, and a missing value must panic rather than silently substitute a default. | `docs/superpowers/plans/2026-06-23-unified-live-hub-config.md` § Global Constraints |
| 2026-06-27 | Inherit-vs-override state is represented by key presence or absence alone; no nil sentinel value and no nullable flag may survive on a scalar field. | `docs/superpowers/plans/2026-06-27-inc3-config-parity.md:21` |
| 2026-06-27 | Correctness must be preferred over approximation: use the real upstream subset of enum labels, true nil/inherit semantics for nullable overrides rather than a fake default, and real upstream default values, fixing pre-existing approximations found in the blast radius. | `docs/superpowers/specs/2026-06-27-inc3-config-parity-design.md:27` |
| 2026-06-27 | No defaults: every newly-registered config key must carry its real upstream default value, never a fabricated placeholder. | `docs/superpowers/specs/2026-06-27-inc3-config-parity-design.md:31` |
| 2026-06-28 | A config accessor for a key that may be absent from the bundled preset must use a tolerant read with a fallback matching prior behavior, never a strict/panicking read, because the engine reads every configured key unconditionally. | `docs/superpowers/plans/2026-06-28-adaptive-ironing-adhesion.md:12` |
| 2026-06-28 | Every new config key must default to a no-op/off state and every accessor must be tolerant of an absent key, preserving prior behavior when unset. | `docs/superpowers/specs/2026-06-28-surface-mold-spiral-design.md:262` |
| 2026-07-02 | Under the no-defaults model, real presets must carry explicit values for keys the feature depends on rather than relying on implicit defaults. | `docs/superpowers/specs/2026-07-02-independent-support-layer-height-design.md:151` |
| 2026-07-09 | Under the no-defaults config model, no silent default pattern may be introduced; every code path must be selected by an explicit value already present in the schema. | `docs/superpowers/specs/2026-07-09-support-pattern-completion.md:162` |
| 2026-07-22 | Under the no-defaults config model, an imported preset must carry explicit real values or the key is left absent and reported — never a fabricated default. | `docs/superpowers/specs/2026-07-22-3mf-printer-import-design.md:80` |
| 2026-07-31 | A mode/state value must be an enum, never a bool and never a numeric sentinel, per the no-in-band-sentinels rule. | `docs/superpowers/specs/2026-07-31-gui-redesign-design.md:100` |
| 2026-08-02 | Never use an in-band sentinel value (-1, 0, "", 9999) to mean unset/auto/inherit/disabled; absence must be modeled as Option<T> or an enum variant, converting at the format boundary exactly once. | `CLAUDE.md` § No in-band sentinels |
| 2026-08-09 | A value that falls back to another value when <= 0.0 is an in-band sentinel and violates the project's no-in-band-sentinels rule, even when the fallback behavior seems reasonable. | `docs/superpowers/specs/2026-08-09-pipeline-signature-sweep.md:227` |
| 2026-08-22 | Two spellings of one quantity are ONE setting: the canonical key declares the legacy name as its alias, the two may not carry different defaults, and an alias is never schema-filled. Enforced at registry construction, so a registry holding two defaults for one quantity cannot be built. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.8.1; `fs_config::generated::check_alias_invariant` |
| 2026-08-22 | A legacy spelling is converted at the CONFIG BOUNDARY and never travels inland: load-time validation folds it onto the canonical key and erases it BEFORE any schema default is filled, and an edit naming the alias is routed to the canonical key. Filling first shadows the value a preset actually set, which is a silent drop, not a divergence. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.8.1; `ConfigHub::resolve_aliases` (GIT_303) |
| 2026-08-22 | An Orca default is read from the shipped PROFILE stack, not from `PrintConfig.cpp`'s bare option default — no user slices with the option table. A defaults-alignment row comparing the two layers reports a divergence that does not exist; judge it against the oracle. | `docs/superpowers/specs/pipeline-alignment/defaults_alignment.json` (`reclassified`); GIT_303 |
| 2026-08-27 | Nothing may panic on a value's absence: every registry key is exactly one of Free (declares a default, plain-value accessor, absence impossible by construction), Derived/dynamic (computed at runtime, no static default), or Override/optional (`overrides.is_some()`, accessor returns `Option`) — never "give every key a default," which would sever an override from what it inherits. External input (`.3mf` import, hand-edited preset, foreign config, CLI flag) never panics either: the boundary reports what it could not use and resolves absence once. Ruled by Gabe, broadening a post-mortem's narrower proposal triggered by a VIOLATED ledger on #584/#585. | `CLAUDE.md` § An accessor that can panic on absence is broken by design |
| 2026-08-27 | An empty-collection default (`default = ""` on a `Points`/`PointsGroups` key) is not an in-band sentinel — zero elements IS the value, not a stand-in for a different concept. The discriminator: absence meaning "inherit ANOTHER key's value" is an override key and declares NO default (measured 16/16 across every `overrides = "..."` registry key); absence meaning "zero elements of THIS key's own collection" is a Free list key and declares the empty value AS the default (measured 2/7 `Points`-typed keys, matching Orca's own `ConfigOptionPoints{}`/`ConfigOptionPointsGroups{}`). Withholding the latter panics the registry build via `validate_on_load` — measured live, GIT_568 (`095dae2b`), 243 cascading `fs-hub` test failures pre-fix. | `CLAUDE.md` § No in-band sentinels |

Enforcement: `docs/INVARIANTS.md` §7.7.

## 🟢 fs-config — registry codegen source

**The wobble:** which artifact is the registry's source of truth — the codegen script or the committed generated file. In June the registry had to stay generated from the upstream source — hand-maintained entries forbidden, missing keys taught to codegen instead. After the vocabulary migration, running scripts/fs_config_codegen.py became forbidden because it was believed to re-derive from a CrealityPrint checkout and would revert the hand-maintained migrations — edits were to go directly into the committed generated file. BOTH halves of that 2026-07-22 rule have since been measured false (2026-08-26): the script's default `--src` is OrcaSlicer, not CrealityPrint, and the file it named, `crates/fs-config/generated/config_defs.rs`, no longer exists — `d62b8bda` deleted it when `build.rs` took over generating the registry. The general rule that derived artifacts are rebuilt, never hand-edited (2026-08-10) still stands; the registry is its named exception because its generator's source was migrated away.

**Where it ended:** settled by the landed change `d62b8bda` — `crates/fs-config/registry/defs.toml` is THE SOURCE OF TRUTH, authored by hand, and `build.rs` generates the registry table and typed key handles from it. The extractor that seeded it is a one-shot, not a pipeline to re-run. The retired advice to hand-edit `generated/config_defs.rs` is void: that file is gone, and hand-editing generated output is exactly what the 2026-08-10 rule forbids — the registry is no longer an exception to it, because its source of truth is now a hand-authored INPUT rather than a generated output. Everywhere else, generated still means never hand-edited.

Enforcement: `docs/INVARIANTS.md` §7.7.

| Date | Rule | Source |
|---|---|---|
| 2026-06-27 | The config registry stays generated from the upstream source; hand-maintained entries for keys upstream already defines are forbidden, and ownership/scalarization policy lives in code keyed off the layout, never a hand-list of keys. | `docs/superpowers/plans/2026-06-27-inc3-config-parity.md:16` |
| 2026-06-27 | The config registry must stay generated from the upstream source via codegen; missing keys are never hand-maintained as registry entries — codegen is taught to emit them instead. | `docs/superpowers/specs/2026-06-27-inc3-config-parity-design.md:22` |
| 2026-06-28 | A feature must never fabricate a registry config key that has no corresponding Orca source key; mesh decimation is exposed only as a library API, not a preset key, because no such Orca key exists. | `docs/superpowers/specs/2026-06-28-mesh-robustness-design.md:52` |
| 2026-06-28 | A new config key with no corresponding Orca registry entry must be added as a manual/local addition to the codegen script's hardcoded list and regenerated, never hand-edited into the generated config file. | `docs/superpowers/specs/2026-06-28-mm-ooze-purge-flushing-design.md:172` |
| 2026-07-02 | Config schema stays compiled: a new config key requires a config_defs.rs codegen change, which is off-limits — codegen is never hand-edited to add a gate key. | `docs/superpowers/specs/2026-07-02-L259-influence-router-BLOCKED.md:39` |
| 2026-07-22 | Never run scripts/fs_config_codegen.py for this registry; it re-derives from an external CrealityPrint checkout and would revert hand-maintained migrations, so edit crates/fs-config/generated/config_defs.rs directly instead. | `docs/superpowers/plans/2026-07-22-registry-orca-vocabulary.md:13` |
| 2026-07-22 | A codegen script that derives values from a since-migrated-away source must not be re-run, since doing so would regress the migration; renames are applied to the committed generated output instead. | `docs/superpowers/specs/2026-07-22-registry-orca-vocabulary-design.md:48` |
| 2026-08-10 | Derived/generated artifacts must be rebuilt, never hand-edited, so nothing can drift from the source that generates them. | `docs/superpowers/specs/2026-08-10-invariant-map.md:69` |
| 2026-08-26 | `registry/defs.toml` is the registry's source of truth and is hand-authored; `build.rs` generates the table and typed key handles from it, and the extractor that seeded it is a one-shot, never re-run. Supersedes the 2026-07-22 rule above, whose stated reason (a CrealityPrint checkout) and whose remedy (edit `generated/config_defs.rs`) were both measured false on 2026-08-26. | `crates/fs-config/registry/defs.toml:3` |

## 🟢 fs-config — what is (and is not) a config key

Agreeing scope rules: the schema is compiled into the binary and never runtime-loadable, an externally supplied preset may carry only values (never key definitions), and transient job parameters (calibration sweeps) are call-time objects, never registry keys.

The compiled-in schema is also a security boundary.

| Date | Rule | Source |
|---|---|---|
| 2026-06-27 | The config schema stays compiled into the binary via build-time code generation; it must never become an externally loadable runtime schema. | `docs/superpowers/plans/2026-06-27-config-gui-usability-fixes.md:14` |
| 2026-06-28 | Transient runtime test/job parameters are represented as plain objects passed at call time, never persisted as config registry keys. | `docs/superpowers/plans/2026-06-28-calibration-generators.md:7` |
| 2026-06-28 | Calibration test parameters (sweep ranges, block heights, etc.) must be modeled as transient objects (CLI flags / GUI dialog inputs), never as registry preset keys. | `docs/superpowers/specs/2026-06-28-calibration-generators-design.md:40` |
| 2026-07-21 | The config schema is compiled into the binary at build time and must stay that way (never runtime-loadable), so any externally supplied preset may carry only values, never schema or key definitions. | `docs/SLICER_FEATURE_TODO.md:2014` |

## 🟢 Config — objects, not index tables; plurals stay plural

One modeling law restated across many features: per-instance domain data is named objects with direct references, never parallel arrays or positional indexes; related scalars fold into one object; an index survives only inside the import-adapter boundary; and an Orca vector type is never scalarised, with accessors keeping the key's own name.

Every restatement widened the blast radius of the same rule.

| Date | Rule | Source |
|---|---|---|
| 2026-06-23 | Domain objects must be addressed by name reference, not by positional index; internal storage may be an indexed vector, but the public API is always by-name. | `docs/superpowers/plans/2026-06-23-extruder-filament-object-model.md:14` |
| 2026-06-23 | Per-extruder domain concepts (Extruder, Filament, Machine) must be modeled as objects with direct references, never as parallel arrays keyed by a loose integer index, though this rule applies at domain-concept granularity and not to bulk geometry. | `docs/superpowers/specs/2026-06-23-extruder-filament-object-model-design.md:16` |
| 2026-06-27 | Positional/index numbers must never appear in the native persisted config; per-instance values live in named sections, and an index may exist only inside the one import adapter boundary before being discarded. | `docs/superpowers/plans/2026-06-27-per-extruder-data-model.md:13` |
| 2026-06-27 | A per-extruder or per-material config key must be a scalar owned by a named object, represented the same way at every layer (registry, serialization, routing, GUI), never split across layers as a vector plus a scalar bridge. | `docs/superpowers/specs/2026-06-27-model-representation-consistency-design.md:12` |
| 2026-06-28 | Represent related state as objects (e.g. SupportPaint, SupportModifierVolume, SupportOverrideLayer), never as parallel arrays. | `docs/superpowers/plans/2026-06-28-support-enforcers-blockers.md:23` |
| 2026-06-28 | Related values should be modeled as a single object resolved together, not as loose parallel-array fields. | `docs/superpowers/specs/2026-06-28-support-xy-gap-interface-design.md:275` |
| 2026-06-28 | New per-feature data should be modeled as objects with named fields, not as bare flags. | `docs/superpowers/specs/2026-06-28-tree-support-refinements-design.md:70` |
| 2026-06-28 | Related scalar fields must be folded into a single object rather than kept as separate loose fields, per the objects-not-index-tables rule. | `docs/superpowers/specs/2026-06-28-zhop-coasting-retract-design.md:195` |
| 2026-07-27 | When inspecting fields from other vendors, a plural field from a vendor must stay plural in our schema, but field-name grammar stays singular even when the value is a plural/list. | `docs/superpowers/specs/2026-07-26-config-ssot-design.md:197` |
| 2026-08-02 | Never scalarise an Orca vector-typed config value just because it "obviously" holds one value; the accessor must return the vector type and keep the key's original name. | `CLAUDE.md` § Follow Orca for plurals |
| 2026-08-22 | The plurality call is made against the DATA MODEL in front of the reader, not the upstream type name: where the registry has already scalarised a key by ownership (`PerExtruder`/`PerMaterial`) and the hub routes it to its owning target, the plurality lives in the ROUTING and the plural-correct read is the scalar one -- a vector reader would return `None` on every load and let the fallback win, the same wrong-type-becomes-wrong-value failure in mirror image. An accessor that depends on such a scalarisation pins the registry type it assumes in a test. | `crates/fs-hub/src/config.rs:1454` |

## 🟢 Config — preset mutation and override resolution

Agreeing rules about who may write where: system presets are read-only copy-on-write, library presets are never mutated (edits live in the extruder's overlay), override stores hold only explicitly-set keys, resolution order is fixed (volume beats object beats base), and overrides that would desync the shared layer grid are rejected before they reach resolved config.

| Date | Rule | Source |
|---|---|---|
| 2026-06-20 | System presets are read-only compile-time embeds, so Save and Save As must be copy-on-write into the user preset directory rather than overwriting the system preset. | `docs/superpowers/specs/2026-06-20-profile-editor-redesign-design.md:154` |
| 2026-06-23 | Editing a loaded filament must write only to the active extruder's overlay and must never mutate the shared preset library entry. | `docs/superpowers/specs/2026-06-23-extruder-filament-object-model-design.md:87` |
| 2026-06-28 | Config overrides resolve in a fixed priority order: a volume-level override wins over an object-level override, which wins over the base config. | `docs/superpowers/plans/2026-06-28-modifier-meshes-per-object.md:15` |
| 2026-06-28 | A per-object or per-volume config override store must hold only the keys the user explicitly set; nothing may be defaulted into it, and the base configuration remains the complete source of truth. | `docs/superpowers/specs/2026-06-28-modifier-meshes-per-object-design.md:248` |
| 2026-06-28 | A per-object override of a key that would desync the shared layer grid (such as layer height) must be filtered out and rejected before it reaches the resolved config, never silently applied. | `docs/superpowers/specs/2026-06-28-modifier-meshes-per-object-design.md:384` |

## 🟢 Config — per-instance membership as data

Three agreeing rules: per-extruder array lengths track num_extruders, per-instance membership derives from the UI layout data (never a hand list), and ownership metadata is captured before any representation transform so routing is value-neutral by construction.

| Date | Rule | Source |
|---|---|---|
| 2026-06-20 | Per-extruder config arrays must always be kept at length equal to num_extruders; changing num_extruders must grow or shrink them with defaults. | `docs/superpowers/specs/2026-06-20-profile-editor-redesign-design.md:159` |
| 2026-06-27 | Ownership or classification metadata must be captured before a representation-changing transform runs, so the resulting routing is value-neutral by construction. | `docs/superpowers/plans/2026-06-27-model-representation-consistency.md:14` |
| 2026-06-27 | Ownership of a per-instance (per-extruder or per-material) config key must be declared as explicit metadata, never inferred from the key's registry type. | `docs/superpowers/specs/2026-06-27-model-representation-consistency-design.md:11` |

## 🟢 Config — wiring honesty

Every UI-exposed key must reach the engine or declare why not, as data the key carries: engine-read sets are traced from real reads (never hand-maintained), features are never half-wired, a key that cannot be read correctly yet is a recorded gap (never a plausible-looking reader), unwired keys stay editable with an advisory, and out-of-scope parameters (SLA) are explicitly left unwired.

The display-only list shrinks only by tracing, never by hand.

| Date | Rule | Source |
|---|---|---|
| 2026-06-21 | A display-only (no-slicing-effect) predicate must be derived from the single published engine-read-keys list, never maintained as a second, separate list. | `docs/superpowers/plans/2026-06-21-provenance-phase1-editor-honesty.md:13` |
| 2026-06-21 | Every registry/editor config key must be either claimed by a registered consumer or explicitly tagged display-only; a key that is neither must be a structural (compile/test) failure. | `docs/superpowers/specs/2026-06-21-config-hub-architecture-design.md:49` |
| 2026-06-21 | Every leaf must declare either an explicit engine binding or DisplayOnly, so a one-line coverage test can assert total coverage and a silently-inert (unbound) config key becomes structurally impossible to create. | `docs/superpowers/specs/2026-06-21-provenancable-field-model-design.md:102` |
| 2026-06-22 | Never half-wire a feature, such as geometry without its matching flow; if the engine lacks an algorithm a feature needs, that is a feature to design, not something to fake by partial wiring. | `docs/superpowers/plans/2026-06-22-config-hub-remaining-work.md:48` |
| 2026-06-22 | The set of config keys the engine actually reads must be derived automatically by tracing real reads, never hand-maintained; when a key becomes engine-effective it must be removed from the display-only list. | `docs/superpowers/plans/2026-06-22-config-hub-remaining-work.md:56` |
| 2026-06-27 | A field's editability must be determined by whether the schema declares it, not by whether the engine consumes it yet; an unwired key must render as its normal editable widget with a non-blocking advisory and must never be disabled just because the engine doesn't read it. | `docs/superpowers/specs/2026-06-27-config-gui-usability-fixes-design.md:30` |
| 2026-06-29 | SLA/resin-only support parameters that exist in the shared config schema must not be wired by the FDM engine and are left unimplemented. | `docs/SLICER_FEATURE_TODO.md:385` |
| 2026-07-26 | Every removed config key needs a keep-or-drop decision recorded, and every added key is schema-only until it is wired to the engine. | `docs/config-ssot-blessed-set-delta.md:18` |
| 2026-07-29 | Every UI-exposed registry key must either reach the engine or declare why it does not, enforced as data the key definition carries rather than left implicit. | `docs/config-wiring-audit.md:87` |
| 2026-08-22 | A key counts as wired only when its value reaches a DECISION: an accessor being called, or the value being copied into an engine-config field, is not evidence, and only a behavioural test that moves the key and watches the geometry can tell the two apart. | `docs/INVARIANTS.md:146` |
| 2026-08-22 | An accessor with no call site must be DELETED rather than left standing: while it exists the key counts as wired, stays off the debt list, and the setting does nothing in silence — a false claim, not a gap. A debt row is never added beside a live accessor. | `docs/INVARIANTS.md` (class 2c, GIT_295) |
| 2026-07-30 | A config key that cannot yet be read correctly must be left as a recorded gap; it must never get a reader that merely looks correct. | `docs/refactors/gap-fill-overlap.md:97` |
| 2026-08-26 | Implementing a config field means the full manifestation of storage, defaults, and wiring into the hub; engine implementation is NOT required for the field to count as implemented. Retroactive: reversed `5243380b` (104 newly UI-exposed Orca keys filed as `NotYetWired` debt); `71cb2d95` wired 103 accessors into the hub instead (GIT_566). Answers a different question than the 2026-08-22 "wired" row above (a key reaching a decision in the engine) — that is about engine consumption; this is about field completeness at the hub, and the two are tracked separately. | `CLAUDE.md` § Config fields stop at the hub |

## 🟢 Config — relation graph

One design, six facets: derived values live in a declared DAG of relations; cycles and over-determination are rejected as unrepresentable; derivations are never hidden formulas in binding code; derived keys refuse direct writes until their direction is freed; and no generic field-linker exists beyond the curated patterns.

Supersedes: the derived-value framing of `docs/superpowers/specs/2026-06-21-config-hub-architecture-design.md` (in part, via the config-honesty redesign).

| Date | Rule | Source |
|---|---|---|
| 2026-06-21 | Model only the handful of config settings that genuinely have invertible relationships (not a general solver), and add no plugin framework beyond the concrete multi-extruder/engine/editor consumers. | `docs/superpowers/specs/2026-06-21-config-hub-architecture-design.md:114` |
| 2026-06-21 | Config relation directions form a directed acyclic graph; a direction change that would create a cycle or over-determine a node must be rejected as unrepresentable, never silently computed into a wrong value. | `docs/superpowers/specs/2026-06-21-config-hub-architecture-design.md` § 4. Reconfigurable dependency directions — the innovation |
| 2026-06-22 | Every relation registered into the config compute graph must succeed; a cycle or over-determined error is a bug in the relation set to be fixed, never something to unwrap-and-ignore. | `docs/superpowers/plans/2026-06-22-config-honesty-mechanism.md:17` |
| 2026-06-22 | A derivation must always be a declared function in the config hub's relation graph, never a hidden formula baked into the binding code or a magic value. | `docs/superpowers/specs/2026-06-22-config-honesty-redesign-design.md:100` |
| 2026-06-22 | Setting a calculated/derived config key directly must be refused; editing it requires first flipping its solve-direction to free. | `docs/superpowers/specs/2026-06-22-config-honesty-redesign-design.md:250` |
| 2026-06-22 | There must be no generic source/destination field-picker for linking config fields; only a curated set of named pattern buttons is allowed (YAGNI). | `docs/superpowers/specs/2026-06-22-config-honesty-redesign-design.md:296` |

## 🟢 Engine — reslice cache membership

Two complementary halves of one contract: every engine-affecting field joins the geometry-comparison struct (invalidation is automatic), and ordering/emission-only fields stay out of it (toggling them never forces a reslice).

| Date | Rule | Source |
|---|---|---|
| 2026-06-28 | Config accessors read the live hub directly rather than a snapshot, and every new engine-affecting field must be added to the engine's geometry-comparison struct so cache invalidation happens automatically. | `docs/superpowers/plans/2026-06-28-adaptive-ironing-adhesion.md:7` |
| 2026-06-28 | Config fields that affect print ordering or output emission, rather than per-layer geometry, must not be added to the engine's per-layer geometry-comparison/cache-invalidation struct. | `docs/superpowers/plans/2026-06-28-sequential-printing-m486.md:18` |

## 🟢 Cross-cutting — single authority, never re-derive

One fact, one producer: flow pricing, bead width, preview speed/flow, thin-section classification, overlays, and config rendering each have a single authority every consumer reads. The invariant-map rule supplies the audit method — name the quantity and catch two producers disagreeing; the disagreement proves both the duplication and the bug.

This is the campaign-tested backbone rule.

**Scope clarified 2026-08-17 (Gabe):** the rule governs the PRODUCTION path and inverts on the right-hand side of an assertion. A test's expected value must come from something the engine never produced — the config, the fixture's stated dimensions, the mesh cross-section, or arithmetic — because an expectation read back from the engine can only detect change, never wrongness. Measurement still reads the authority; expectation must not. The wobble that forced the clarification: GIT_345's contract suite read the rule as "don't recompute, read what the engine says", then compared what it read against numbers recorded from earlier runs of the same engine. Measured 2026-08-17: 12 of its 30 checks were regression pins labelled as correctness contracts, and their literals had silently locked seven entries to a single axis.

| Date | Rule | Source |
|---|---|---|
| 2026-06-24 | The preview must share and call the G-code writer's exact speed/flow functions rather than re-deriving them, so it never shows a speed or flow value the G-code will not actually emit. | `docs/superpowers/specs/2026-06-24-sp4-live-preview-design.md:32` |
| 2026-06-28 | Per the never-re-derive/correctness rule, a preview that shares engine-output state must reflect it from the shared object rather than recomputing it independently. | `docs/superpowers/specs/2026-06-28-zhop-coasting-retract-design.md:281` |
| 2026-07-02 | Per the model-representation-consistency rule, a value must have a single representation in the plan — dual carriers for the same data are removed in favor of one. | `docs/superpowers/specs/2026-07-02-independent-support-layer-height-design.md:97` |
| 2026-07-05 | Bead/line width must be computed once and read from that single source for both G-code emission and preview rendering, never derived separately in each. | `docs/SLICER_FEATURE_TODO.md:132` |
| 2026-07-10 | There must be exactly one flow-pricing authority function; every consumer (writer and estimate) calls the same function rather than deriving its own value. | `docs/superpowers/specs/2026-07-10-one-flow-source-of-truth.md:23` |
| 2026-07-23 | A GPU/UI overlay must remain a pure derivation of its source-of-truth store, never an incrementally-patched second copy of the truth. | `docs/superpowers/plans/2026-07-23-brush-perf-design.md:81` |
| 2026-08-01 | Comparing configs means parsing both sides through the registry and rendering both through the one canonical renderer, never comparing raw ini text to typed values. | `docs/LEARNINGS.md:240` |
| 2026-08-10 | Do not search for duplicate code by syntax; name the quantity a value represents and catch two producers of that same named quantity disagreeing — the disagreement is proof of both the duplication and the bug at once. | `docs/superpowers/specs/2026-08-10-invariant-map.md:30` |
| 2026-08-12 | A fact must be computed once at its authority and every downstream consumer (pipeline stage, emitter, parser, probe) must read that value rather than recomputing its own opinion of it. | `CLAUDE.md` § Never re-derive |
| 2026-08-12 | Thin-section classification happens at generation time and is authoritative; consumers never re-derive it. | `docs/STATE.md:129` |
| 2026-08-17 | Read the engine for a test's MEASUREMENT, never for its EXPECTATION: the expected value derives from config, fixture dimensions, the mesh, or arithmetic. A number pasted from a prior run is a regression pin — legitimate, labelled as such, never counted as correctness coverage. | `CLAUDE.md` § Never re-derive |
| 2026-08-21 | What feedrate a travel takes is one fact with one authority (`travel_f()`), and the writer has ONE travel spelling that reads it — the feedrate is not a parameter of it, so a second opinion cannot be passed in. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md:3202` |
| 2026-08-21 | An emitter's current position is a fact it LEARNS by emitting motion, never one it assumes: a per-layer writer starts at the bed origin by arithmetic while the nozzle is elsewhere, so a move may be dropped as zero-length only against a position that was established. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md:3225` |
| 2026-08-23 | A ring's signed area is ONE fact with one authority (`fs_geometry::ring_area::signed_area2`), and the primitive is DOUBLED and SIGNED and EXACT (`i128`): `\|2A\|`, the halved `f64`, and the orientation verdict are thin readers of that integer, so they agree by construction rather than by coincidence. Seven implementations in two arithmetics existed before GIT_484 — an f64 shoelace depends on summation order and operand magnitude, an exact one does not, so wherever an area meets a floor *which implementation ran* was part of the answer. Where a bypass cannot be a compile error (`*` and `+=` are language primitives), the currency is a sealed newtype AND a red gate greps the workspace for a second accumulator, with a positive control and a recorded red-check. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.1.9a9 (GIT_484); `crates/fs-geometry/src/ring_area.rs` |
| 2026-08-22 | WHICH pricing lane an extrusion takes is a function of its ROLE, decided once and carried on the path - table roles at their role's value scaled by their own geometry, wall roles from their own cross-section through the flow authority. A call site that states a bead's flow as a literal is a second opinion of the fact, and `flow_scale: 1.0` on every fitted thin bead is how one nominal came to be fed for every width the beading strategy chose. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md:3569` |
| 2026-08-24 | A legend label's PRECISION is a property of the value it states, never of the scale it sits on. `LegendScale::format` derived its decimals from `max(|min|, |max|)` and applied them to every value, so a scale topping out at 179 mm/s chose zero decimals and rendered its measured `0.095 mm/s` bottom as `0` — the same rule producing a correct top and an annihilated bottom from one call (GIT_526). Three significant figures per value, trailing zeros trimmed; distinctness between NEIGHBOURING labels is a property of the label SET and lives with the set, because one value cannot know what sits next to it. | `crates/fs-ui-app/src/lib.rs` `value_decimals` `labels` (GIT_526); `docs/INVARIANTS.md` §7.8 |
| 2026-08-24 | WHICH speeds the Speed / Actual speed legend describes is one fact with one authority (`fs_ui_app::SpeedPopulation`): the POSITIVE speeds of depositing segments. The writer's `0.0 == unset` fallback sentinel is refused as a non-member and counted, never folded in as a `0 mm/s` bottom end and never clamped away; junction velocities (`0` at every full stop, and true) are not members because `plan_speeds` reports per-move achieved PEAKS, which is what the colours normalize against. The pre-pass fold reads the same arc alignment the colouring draws, so the legend's ends cannot be a value no segment carries. | `crates/fs-ui-app/src/lib.rs` `SpeedPopulation` (GIT_526); `docs/INVARIANTS.md` §7.8 |
| 2026-08-23 | Where a quad side is TWO edges, the same bead has been placed on both — the CONTINUATION edge owns every index it carries, because that is the copy the next quad reads. A side that keeps its own near-edge copy makes one shared node into two points 115 µm apart, and the wall breaks there with a travel and a Z-hop either side. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md:3431` |

## 🟢 Fill — claimed ground and containment

Agreeing rules about geometry ownership: a cutter's exercised claim permanently excises ground from the layer, negative volumes carve before any downstream derivation, region partitions use true 2D booleans (never bounding boxes), gap-fill and thin-wall regions stay disjoint, superseded algorithms are deleted rather than left coexisting, and containment clips once at the single final sink.

The audit question is always "which two steps both received this ground?"

Enforcement: `docs/INVARIANTS.md` §7.1, §7.4.

| Date | Rule | Source |
|---|---|---|
| 2026-06-28 | Gap-fill regions and Arachne thin-wall regions must remain disjoint so the two features never deposit a double bead over the same sliver. | `docs/superpowers/specs/2026-06-28-gap-fill-medial-axis-design.md:148` |
| 2026-06-28 | Once the medial-axis gap-fill path lands, the old bounding-box centerline algorithm must be deleted rather than kept alongside it, to avoid two competing gap-fill algorithms coexisting. | `docs/superpowers/specs/2026-06-28-gap-fill-medial-axis-design.md:83` |
| 2026-06-28 | A per-region geometric partition must use a true 2D boolean operation (intersection/difference) on the actual slice geometry, never a bounding-box approximation. | `docs/superpowers/specs/2026-06-28-modifier-meshes-per-object-design.md:151` |
| 2026-06-28 | A negative/subtractive volume's slice must be excised from the part's slice before any downstream region or ground is derived, so every later pass sees only the already-carved cross-section. | `docs/superpowers/specs/2026-06-28-modifier-meshes-per-object-design.md:279` |
| 2026-06-28 | Overlapping modifier regions must resolve by a deterministic registration order (later wins), with each zone subtracted from the running remainder before the next, so no zone is ever filled twice. | `docs/superpowers/specs/2026-06-28-modifier-meshes-per-object-design.md:286` |
| 2026-08-03 | Containment must be the last geometric transform in the fill pipeline, applied at a single sink, so no later step can push geometry back outside the part. | `docs/SLICER_ARCHITECTURE.md:101` |
| 2026-08-12 | Each pipeline step that cookie-cutters geometry permanently excises that geometry from the layer; once a cutter claims ground, no later step may receive it, and a decline must retract the ground to its single original owner rather than let it be re-claimed by two recipients. | `CLAUDE.md` § Claimed ground is excised ground |
| 2026-08-23 | A family may only EXCISE ground it can DEPOSIT on. A top/bottom skin claim narrower than one of its own beads is retracted to the interior solid rather than taking the half-bead cross-family retreat band it can never cover; the band itself grows only around the part of a claim a full bead can ride; and a surface returned as `narrow` (too thin to inset) is still clipped to its own family's clearance, so a retracted claim cannot carry another family's permission to overlap the wall. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.3.5 F2a (GIT_502) |
| 2026-08-12 | A bridge takes over the ENTIRE region where it overlaps the fill: a solid piece whose MAJORITY is covered by the grown spans (span + anchor margin) joins the reservation whole, so the caps at a span's ends are bridge surface the strands anchor into. The majority bound scopes the claim to the PIECE, never the layer — a floor crossed by one small span keeps its ground. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.1.9g (GIT_269) |

## 🟡 Deposition — same-layer overlap scope

**The wobble:** what unit the no-overlap invariant binds — walls, entities, or physical footprints. First stated for full-island wall generation; then narrowed so lattice point-crossings are exempt and only collinear duplicate deposits count; then bead-forcing was bounded (dropping is always safe, adding needs on-layer room); finally the scoping unit itself was corrected — the rule holds over any two footprints sharing a point in a bounded neighbourhood, never over "different entities", because connectivity is not a physical property of plastic.

**Where it ended (inferred):** footprint-pair scoping within a bounded neighbourhood; intrinsic pattern crossings exempt; neighbour layers may break ties but never authorize a bead the current layer has no room for.

Enforcement: `docs/INVARIANTS.md` §7.2.

| Date | Rule | Source |
|---|---|---|
| 2026-07-08 | Hard rule: no same-layer extrusion overlap by design under planar conditions; full-island wall generation must never double-cover thickness. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:26` |
| 2026-07-08 | Hard rule: no same-layer overlap — force-dropping a bead is always safe, but force-keeping or force-adding a bead must be gated by an on-layer support test; neighboring layers may break ties or drive hysteresis but must never authorize a bead with no room on the current layer. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:445` |
| 2026-07-09 | The no-same-layer-overlap hard rule forbids collinear duplicate deposits along a boundary, not the point-crossings intrinsic to lattice infill patterns. | `docs/superpowers/specs/2026-07-09-support-pattern-completion.md:152` |
| 2026-08-07 | The no-same-layer-overlap rule must be stated over any two footprints sharing a point within a bounded neighbourhood, never scoped to "different entities", because connectivity is not a physical property of deposited plastic. | `docs/LEARNINGS.md:311` |
| 2026-08-20 | Overlap inside a medial-graph junction disc is a WELD (beads meeting where the graph says they meet — bonding, by design, the tee ruling) and is reported on its own line; only overlap outside every junction disc is a two-owner COLLISION and a defect. The classification reads the generator's node discs, never proximity to paths. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.1.9d (GIT_405) |

## 🟢 Engine — overhang and bridge classification

Agreeing refinements of one decision system: overhang is decided by what lies below (never a same-layer neighbour), paint is an annotation rather than an ExtrusionRole, the paint boundary is strictly greater than nozzle_diameter/2, paint and graded degree are measured independently, honest measures consume actual per-path widths, external beats internal where bridges overlap, only external bridges force the bridge fan, and no classification threshold may sit inside measurement noise.

Classification happens once, at generation, and consumers read it.

Enforcement: `docs/INVARIANTS.md` §7.2.

| Date | Rule | Source |
|---|---|---|
| 2026-06-28 | Internal-only bridge layers must not force the 100% bridge fan; only external bridges trigger that cooling behavior. | `docs/superpowers/specs/2026-06-28-bridge-internal-external-design.md:161` |
| 2026-06-28 | When external and internal bridge regions overlap, the external (over-air) classification wins. | `docs/superpowers/specs/2026-06-28-bridge-internal-external-design.md:99` |
| 2026-08-01 | Any honest overhang measure must consume actual per-path extrusion widths rather than a single nominal width. | `docs/LEARNINGS.md:126` |
| 2026-08-01 | Stabilizing outputs is useless while the classification boundary itself rides measurement noise at its operating point; hysteresis or a smooth gate input must cover the noise band or the class will flicker. | `docs/LEARNINGS.md:176` |
| 2026-08-01 | A user-visible classification decision must never be placed on a threshold that sits inside the measurement/approximation noise floor. | `docs/refactors/overhang-truth.md:173` |
| 2026-08-07 | Do not tune a threshold on an operand that has not been verified against the reference implementation; when a fix needs a threshold, first find what made the quantity noisy. | `docs/LEARNINGS.md:348` |
| 2026-08-07 | Do not reach for a hysteresis knob to close a classification gap without a differential proving the discrepancy is not real geometry. | `docs/LEARNINGS.md:400` |
| 2026-08-08 | Never re-derive overhang paint from the graded degree value; paint and degree must be measured independently. | `docs/OVERHANG-PAINT-HANDOFF.md:131` |
| 2026-08-08 | The overhang paint boundary is strictly greater than nozzle_diameter/2 past the previous layer's outline; exactly at that distance must not paint. | `docs/OVERHANG-PAINT-HANDOFF.md:16` |
| 2026-08-08 | Overhang paint is an annotation, never an ExtrusionRole variant; do not add an overhang role. | `docs/OVERHANG-PAINT-HANDOFF.md:22` |
| 2026-08-12 | Exposed-to-air is overhang, decided by what lies below a surface, never by a same-layer neighbour. | `docs/STATE.md:127` |

## 🟢 User-facing — warn loudly

Silence must never read as success: unsupported formats fail loudly rather than substitute, mutually-exclusive features refuse rather than combine (at the CONFIG boundary, by a named diagnostic — never by a panic inland), imported values are mapped or reported with no third outcome, warnings are inseparable from return values (never droppable out-parameters), violations are classified and surfaced (never panics, never silent drops), and a duplicate machine preset is a loud error.

The bar is the user's expectation, not our contract.

| Date | Rule | Source |
|---|---|---|
| 2026-06-28 | An unsupported output format must fail loudly with an error, never silently substitute a different, supported format. | `docs/superpowers/plans/2026-06-28-binary-gcode-and-output.md:10` |
| 2026-06-28 | Out-of-build-volume detection must never panic and must never silently drop data — violations are always classified and surfaced in a structured report. | `docs/superpowers/specs/2026-06-28-bed-shape-build-volume-design.md:224` |
| 2026-07-03 | Features that each rewrite the same underlying basis (e.g. slicing basis) must be asserted mutually exclusive and refuse loudly rather than silently combining. | `docs/superpowers/specs/2026-07-03-belt-printer-support-design.md:128` |
| 2026-07-22 | An imported/foreign input value must be mapped or reported — there is no third, silent outcome. | `docs/superpowers/specs/2026-07-22-3mf-printer-import-design.md:214` |
| 2026-07-31 | A computed result's warnings must be an inseparable part of its return value, never an optional out-parameter, since an out-parameter lets a caller silently pass a throwaway and drop the warning. | `docs/refactors/cavity-scan-duplication.md:58` |
| 2026-08-01 | When multiple configuration files of the same kind (e.g. two machine presets) are supplied together, the second must be rejected with a loud error, never silently replace the first. | `docs/refactors/width-ssot.md:51` |
| 2026-08-02 | Anything dropped, ignored, skipped, clamped, substituted, or not imported from user input must be warned about where the user will see it; silence must never read as success. | `CLAUDE.md` § Warn loudly |
| 2026-08-09 | Per the project's standing warn-loudly rule, anything the engine drops, skips, or degrades must be said where the user will see it. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` § 2.9 Windows, both sides — the table as it now stands |
| 2026-08-20 | A diagnostic's level is decided once, per code, in `SliceWarningCode::level()` — emission sites never pass a level (GIT_407; Gabe: "why are these warnings then and not info level?"). | `crates/fs-hub/src/diagnostics.rs` |
| 2026-08-22 | A diagnostic code is declared ONCE, in one list that carries its documentation, its wire name and its level together — the enumeration, the wire format and the level table are generated from that one entry, never hand-maintained beside it. `SliceWarningCode::ALL` was a hand-written array while `as_str`/`level` were compiler-exhaustive, and `ALL` is the denominator of the wire-format test: a STALE entry failed to compile, but a MISSING entry compiled and silently narrowed the only guard between `derive(Debug)` and the `; DIAG` file format to 23 of 24 codes (GIT_421). The wire string stays a written literal, not `stringify!`, so a renamed variant is caught instead of silently rewriting every printed header. | `crates/fs-hub/src/diagnostics.rs` (`define_slice_warning_codes!`); `docs/INVARIANTS.md`; `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.1.9 (GIT_421) |
| 2026-08-22 | A test capture of the log must reproduce the line an OPERATOR sees, byte for byte — a capture that renders a field its own way is not evidence about the log, it is evidence about itself. `fs_log::Captured` kept level/target/message and five bespoke `format!` calls beside `tracing_subscriber`'s fmt layer; the `&str` one disagreed (unquoted where the fmt layer quotes), so `code=WallBeadOverlap` printing as `code="WallBeadOverlap"` was invisible to every test and had to be caught by eyeballing a castle run (GIT_407 M5's own first attempt, `0303f2d9`; fixed `ef57080a`). `Captured` now carries `fields`, `message` is COMPOSED from them, and the visitor has ONE renderer reached the same three ways `DefaultVisitor` is — pinned by running the fmt layer and the capture in the same subscriber and diffing the lines (GIT_415). | `crates/fs-log/src/capture.rs`; `docs/INVARIANTS.md`; `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.1.9 (GIT_415) |
| 2026-08-21 | A file that bakes in its own print config must be sliced under that config on EVERY surface, and any displacement of it — an explicit flag, an unreadable payload, a second configured file on the plate, a project part we do not import — is reported. The CLI silently ignoring a Ferrislicer `.3mf`'s baked config was this rule's own canonical example reproduced for our own format (GIT_313). | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §1.3 |
| 2026-08-22 | A mutually-exclusive CONFIG combination is refused at the config authority — resolved by a stated precedence and reported by a named diagnostic before any geometry runs — never by a panic inside the engine; the engine's assert survives only as the last-resort guard for a hand-built `EngineConfig`, unreachable from anything a user can express. `mold_enabled` + `spiral_mode` panicked from inside `slice_object` with nothing warned beforehand, which every embedder (CLI, GUI, Android) could render only as a crash (GIT_371). | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §1.3 (GIT_371); `crates/fs-hub/src/diagnostics.rs` |

| 2026-08-24 | A legend that could not measure its range SAYS SO where the number would be, and draws no scale — a fabricated bottom end is silence wearing a measurement's face, and the reader has no way to tell it from a real one. The Speed / Actual speed / Acceleration / Layer-time ramps resolved an unmeasured range to `(0.0, max role speed)`, so `0 mm/s` on the bar meant either "the slice contains a stopped move" or "no pre-pass ran" and nothing distinguished them (GIT_526). The toolpaths say the same thing the same way: with no measured range they wear their role colour rather than normalising against an invented one. | `crates/fs-ui-app/src/lib.rs` `Legend` (GIT_526); `docs/INVARIANTS.md` §7.8 |
| 2026-08-22 | Ground that enters a pipeline stage leaves it DEPOSITED, FORWARDED to the one successor the design names, or DECLARED out loud — a stage that produces nothing and says nothing is the warn-loudly rule's worst case, because the drop is exactly as invisible as a clean slice. Enforced at the wall pass by a census at its sole door (`fs_walls::generate_walls`), reachable only through a private-payload `RawPerimeterResult`, so a generator cannot be silent and a caller cannot skip the census. A 0.3 mm ribbon sliced to nothing on all 25 layers and reported zero warnings (GIT_355). The decline gets its OWN code when the standing sentence would misdescribe it: `SubBeadFillDeclined` promises "the neighbouring walls carry those spots", and a void has no neighbour — it is the island. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.1.9a3 (GIT_355); `docs/INVARIANTS.md` §7.2; `crates/fs-walls/src/strategy.rs` |
| 2026-08-22 | The deposit-or-declare rule is stated over GROUND, not over the stage's output as a whole: a stage that deposits on part of what it received and loses the rest is exactly as silent about the rest as a stage that produced nothing. A taper whose section falls below one external bead ends its wall inside the model; #353's wedge printed a ring to x = 17.92 and dropped the 1.9 mm past it on every layer, while the slice's only warning described fill dabs at the opposite end of the part (GIT_353). The stage that PLACED the material is the one that states what it could not reach — read, never re-derived by a consumer — and the statement gets its own code when a standing sentence would misdescribe it: `SubBeadFillDeclined` promises the neighbouring walls carry the spot, and there is no wall beside ground that lies past the wall's end. Where the forward successor is knowingly gated off, the chain terminates in a declared, warned scrap — the ending the claimed-ground rule permits — never in silence. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.1.9a5 (GIT_353); `docs/INVARIANTS.md` §7.2; `crates/fs-walls/src/perimeters.rs` |
## 🟢 G-code — custom G-code and templates

One coherent contract with a deliberate asymmetry: unknown variable tokens pass through verbatim and are reported (a typo stays visible), while a condition error makes its whole section print nothing (printing a wrongly-chosen branch is dangerous; an empty section is safe). Around that: user G-code is never rewritten, the template schema stays compiled-in with no expression language, completion and resolution share one source of truth, conditions have no truthiness, per-tool indexes naming a missing tool are loud, and retired spellings get a loud diagnostic rather than a silent meaning change.

Pass-through for values, suppression for control flow, both loud.

Enforcement: `docs/INVARIANTS.md` §7.6.

| Date | Rule | Source |
|---|---|---|
| 2026-06-28 | The G-code placeholder template renderer must pass unknown tokens through verbatim rather than failing, so firmware-specific braces survive and a typo stays visible instead of being silently dropped. | `docs/superpowers/specs/2026-06-28-custom-gcode-and-e-mode-design.md:124` |
| 2026-06-28 | Custom G-code text a user injects into a template is the user's responsibility and must never be rewritten by the relative/absolute-E conversion logic; only the slicer's own generated moves are guaranteed to match the active E mode. | `docs/superpowers/specs/2026-06-28-custom-gcode-and-e-mode-design.md:188` |
| 2026-06-28 | A scheduled FilamentChange item and an MMU tool change landing on the same layer boundary must not both emit a tool-change command; the scheduled item takes precedence. | `docs/superpowers/specs/2026-06-28-custom-gcode-and-e-mode-design.md:195` |
| 2026-07-03 | Existing placeholder.rs output formats (plain ints, %.3f for z, rounded-int temperatures) are byte-locked by existing tests and must be preserved exactly. | `docs/superpowers/plans/2026-07-03-gcode-template-language-and-editor.md:24` |
| 2026-07-03 | A completion/lookup table must never advertise a name that the resolution engine cannot resolve — the two are unit-tested to be the same source of truth. | `docs/superpowers/specs/2026-07-03-gcode-template-language-and-editor-design.md:293` |
| 2026-07-09 | PlaceholderContext must stay Copy: only numeric derived scalars may be added to it; the object graph and active-tool name must live in the borrowed TemplateScope/resolver instead. | `docs/superpowers/plans/2026-07-09-gcode-template-editor.md:17` |
| 2026-07-09 | The G-code template schema must stay compiled-in for security (no runtime-loaded schema), with no expression language and no hub mutation from templates. | `docs/superpowers/plans/2026-07-09-gcode-template-editor.md:18` |
| 2026-07-23 | Foreign G-code templates must never silently apply as if valid; they cross the typing boundary as strings and are surfaced under a review-before-printing caveat. | `docs/superpowers/specs/2026-07-23-import-gcode-config-design.md:108` |
| 2026-08-02 | Per the no-in-band-sentinels rule applied to control flow, there is no truthiness of a string — a condition must compare explicitly, and an undefined variable in a condition is a loud load-time error, never a guessed branch. | `docs/superpowers/specs/2026-08-02-gcode-template-grammar.md:124` |
| 2026-08-02 | A retired spelling must not silently change meaning: one spelling per meaning, and a template using the old spelling gets a loud load-time diagnostic naming the replacement. | `docs/superpowers/specs/2026-08-02-gcode-template-grammar.md:50` |
| 2026-08-03 | A per-tool index referring to a tool that does not exist must be loud (passed through verbatim and flagged, or an error in a condition); the engine must never substitute a different tool's value than the one named. | `docs/manual/custom-gcode.md:117` |
| 2026-08-03 | Custom-G-code conditional statements must be whole lines, may nest freely, and support no loops; only the selected branch's lines are ever printed. | `docs/manual/custom-gcode.md:220` |
| 2026-08-03 | A custom-G-code condition error must make its whole section print nothing rather than guess, because printing a wrongly-chosen branch is dangerous while an empty section is safe. | `docs/manual/custom-gcode.md:251` |
| 2026-08-03 | Custom G-code supplied by the user is carried into the output verbatim; the slicer must never reformat, reorder, or "fix" it. | `docs/manual/custom-gcode.md:30` |
| 2026-08-22 | Passing an unresolved `{token}` through to the printer is the BEHAVIOUR; saying nothing about it is the defect. Every template finding — unknown token, refused section, compatibility notice — carries a declared `SliceWarningCode` at its own level and reaches the finished file's own `; DIAG` header, so a printed or shared G-code file is self-describing without the run's stderr. (Orca instead throws `"Variable does not exist"` and refuses to export; the divergence in RESPONSE is deliberate, the alignment on the FACT is not optional.) | GIT_367; `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` §4.7.2a |

## 🟢 Reference sources — porting policy

**The wobble:** how close the code stays to the C++ reference — mandatory citations per module versus none at all. The 2026-06-18 README required every module to cite the C++ source it ports; by 2026-08-12 the standing rule is the opposite — C++ file:line citations never belong in Ferrislicer code. Around that flip the family agrees: reference source is read for semantics and contracts only, OrcaSlicer is the sole parity reference (stated then as “never CrealityPrint” — reversed 2026-08-26, see below), no single slicer is the correctness oracle (the paper is), disagreements between references are classified before choosing, and persistence formats are Ferrislicer's own.

**Where it ended:** no verbatim porting, own design and naming, Orca as evidence not oracle, citations live in specs and research docs — never in code. Adjudicated again 2026-08-26 (Gabe): the 2026-07-09 absolute “never CrealityPrint” does NOT stand. All four trees under `G:\CLionProjects\` are legitimate reference sources and a citation names the tree the fact actually came from — OrcaSlicer FIRST PASS (parity reference, dialect base), CrealityPrint a COMPATIBILITY TARGET that is cited for CP-only fields and never erased from lineage lines, SanityPrint (Gabe’s fork) cited directly where it is the source. The no-verbatim-porting half is untouched.

| Date | Rule | Source |
|---|---|---|
| 2026-06-18 | Parity with libslic3r is the project's correctness target, and every module must cite the C++ source it ports. | `README.md:115` |
| 2026-07-03 | Reference source code (e.g. another slicer) may only be read to extract semantics, never transliterated; cite file:line in your own words. | `docs/superpowers/plans/2026-07-03-belt-printer-support.md:21` |
| 2026-07-07 | Treat the original paper/libArachne as the algorithm source of truth, and treat PrusaSlicer/OrcaSlicer/Bambu Studio/Cura only as behavior references, not as the oracle. | `docs/superpowers/plans/2026-07-07-arachne-reference-matrix-harness.md:16` |
| 2026-07-07 | When reference implementations disagree, classify the disagreement (algorithm principle, production consensus, implementation-specific behavior, known bug pattern, or profile-tuned behavior) before deciding which behavior to follow. | `docs/superpowers/specs/2026-07-07-arachne-reference-evaluation.md:49` |
| 2026-07-08 | Paint 3MF persistence must use Ferrislicer's own attributes only; no Orca mmu_segmentation format or other cross-slicer interop. | `docs/superpowers/plans/2026-07-08-paint-on-feature.md:9` |
| 2026-07-09 | Any parity question must be checked against OrcaSlicer source only, never CrealityPrint, and no verbatim porting is allowed — the design must be owned. | `docs/superpowers/specs/2026-07-09-arachne-flow-single-source.md:65` |
| 2026-08-12 | No verbatim porting: reference-slicer source is a behavioral contract only, novel implementation and performance are preferred, and C++ file/line citations never belong in Ferrislicer code. | `docs/STATE.md:133` |
| 2026-08-26 | All four reference trees are legitimate sources and a citation names the one the fact actually came from: OrcaSlicer is FIRST PASS (parity reference and dialect base); CrealityPrint is a COMPATIBILITY TARGET, cited for CP-only fields and never erased from lineage lines; SanityPrint (Gabe’s fork) is cited directly where it is the source and diverges from CP. Supersedes the 2026-07-09 “never CrealityPrint” clause; no verbatim porting still holds. | `CLAUDE.md` § Reference sources |

## 🟢 Verification — testing discipline

The TDD tax, restated in nearly every plan because it binds all of them: failing test first, then a unit test, fixture generator, and integration coverage for every new function; tests move with relocated code; suites run with --no-fail-fast and untruncated output; regression tests assert on the default rung; and a suite that cannot express a failure mode is not coverage for it. One scoping exception was stated once and never contradicted: the egui view layer is never unit-tested — a test must never open a window.

The restatements are enforcement pressure, not drift.

Since 2026-08-25 the discipline also runs AHEAD of the code: a change compiles its assumptions and its expected blast radius — what should change and what should NOT — before implementation, and confirms every one of them afterwards. See § Verification — what "correct output" means for WHICH bar a change is claiming; this rule requires the change to declare that claim in advance, so a behaviour change cannot pass as a refactor.

| Date | Rule | Source |
|---|---|---|
| 2026-06-20 | The egui view layer is never unit-tested (a test must never open a window); pure logic is unit-tested, and view-layer changes are instead verified by build, lint, and a manual smoke run. | `docs/superpowers/plans/2026-06-20-profile-editors-phase1a-dock-shell.md:16` |
| 2026-06-22 | The whole workspace test suite must pass at the end of every committable step. | `docs/superpowers/plans/2026-06-22-config-honesty-mechanism.md:14` |
| 2026-06-22 | The slice path (engine binding and slice_object) is load-bearing, so changes to it are gated on the full test suite plus smoke testing. | `docs/superpowers/plans/2026-06-22-config-hub-remaining-work.md:51` |
| 2026-06-27 | Every behavioral change must ship with a unit test plus a fixture and an integration-test touchpoint. | `docs/superpowers/plans/2026-06-27-config-gui-usability-fixes.md:16` |
| 2026-06-28 | Every new function or feature must follow TDD: a failing test written first, verified red, then the minimal implementation to go green. | `docs/superpowers/plans/2026-06-28-solid-infill-shells.md:26` |
| 2026-06-28 | Testing follows the TDD hard rule: write a failing test first, then minimal code, and every new function gets a unit test, a fixture generator, and a case in the related integration test. | `docs/superpowers/specs/2026-06-28-support-enforcers-blockers-design.md:228` |
| 2026-06-28 | Testing follows the TDD hard rule: every new function gets a unit test, a fixture generator, and an integration test line, with a failing test written before the implementation. | `docs/superpowers/specs/2026-06-28-support-sdf-influence-area-design.md:330` |
| 2026-06-28 | Testing follows the TDD/CLAUDE.md hard rule of a failing test first, then minimal code, with a unit test, fixture generator, and integration case for every new function. | `docs/superpowers/specs/2026-06-28-support-xy-gap-interface-design.md:395` |
| 2026-06-28 | Testing follows the TDD hard rule: every new function or method gets a unit test, a fixture generator, and a line in every related integration test, with a failing test written before minimal implementation. | `docs/superpowers/specs/2026-06-28-surface-mold-spiral-design.md:258` |
| 2026-06-28 | Testing follows the TDD hard rule: write a failing test first, then the minimal code. | `docs/superpowers/specs/2026-06-28-tree-support-refinements-design.md:192` |
| 2026-06-28 | Testing follows the CLAUDE.md TDD rule: each unit/function/method gets a unit test, a fixture generator, and an addition to every related integration test, with a failing test before minimal code. | `docs/superpowers/specs/2026-06-28-zhop-coasting-retract-design.md:322` |
| 2026-07-10 | Per CLAUDE.md, tests move with the code they cover when that code is relocated to a new crate. | `docs/superpowers/specs/2026-06-29-platform-crate-split-nav-fileaccess-design.md:111` |
| 2026-07-22 | Run tests with --no-fail-fast, and never head-truncate test output. | `docs/superpowers/plans/2026-07-22-registry-orca-vocabulary.md:17` |
| 2026-07-29 | A regression test covering a multi-rung/multi-value setting must assert on the default rung, not only on a non-default one, or it cannot fail the way real users fail. | `docs/perf/orca-output-differences.md:124` |
| 2026-07-31 | A test suite that cannot express a given failure mode does not count as coverage for it, even while every test in the suite passes. | `docs/refactors/fill-ground-inset.md:336` |
| 2026-08-22 | An ABSENCE asserted against a log capture is only coverage if the capture is guaranteed to have been able to see the event. `tracing` caches callsite interest globally on first touch, so a thread with no subscriber can blank a capture for the rest of the process — measured: two fs-app tests captured nothing 6 runs out of 6 when filtered together, and passed serially and in the full run. Absence assertions state what would have proved the capture alive. | `docs/INVARIANTS.md` §7.9 (`fs-log/capture.rs` `capture_scope`), GIT_419 |
| 2026-08-25 | Every change compiles its ASSUMPTIONS (the beliefs making the choice and design legitimate) and its EXPECTED BLAST RADIUS naming what should AND should not change, written BEFORE implementation; after coding, every assumption and every expected truth is confirmed individually as HELD or NOT HELD, never as a blanket "tests pass". An unconfirmed expectation means the change is unfinished; a violated one is a reportable finding. | `CLAUDE.md` § Every change states its assumptions and its blast radius |
| 2026-08-25 | A ledger mismatch between BEFORE and AFTER — any assumption that did not hold or any "should not change" that changed — mechanically launches a SONNET post-mortem agent to determine why the mismatch happened and what standing rule would have caught it, output in rule-shaped form. Dispatched serially; its candidate rules go through /rule-intake as proposals and are never self-filed. | `CLAUDE.md` § A ledger mismatch launches a post-mortem agent |

## 🟢 Design — invariants by construction

The cant-break-by-design toolbox: bad states made structurally impossible via sole constructors with private fields, parse-don't-validate, sealed pipelines whose sinks accept only the pipeline's output type, capability tokens, typestate, exhaustive matches landing with their variants, newtypes per unit, generators over hand-synchronized artifacts, borrowed shared geometry, and enforcement that is the type rather than a review rule.

This family is the project's master design rule; every later hard rule is an instance of it.

| Date | Rule | Source |
|---|---|---|
| 2026-06-21 | Config-hub design principle: bad states must be made structurally impossible, not merely prevented by a rule embedded in the logic. | `docs/superpowers/specs/2026-06-21-config-hub-architecture-design.md:7` |
| 2026-07-09 | Every new enum variant must land together with its match arm in the same change, so the match stays exhaustive and every intermediate state compiles. | `docs/superpowers/plans/2026-07-09-support-pattern-completion.md:39` |
| 2026-07-09 | Existing bank/map objects must be consumed read-only rather than building new index tables, per the objects-not-index-tables rule. | `docs/superpowers/specs/2026-07-09-gcode-template-editor-design.md:197` |
| 2026-07-23 | A composite object with multiple derived substructures (mesh, adjacency, spatial grid, scratch state) must have a single sole constructor that builds them all together in one pass, so they can never be born desynchronized. | `docs/superpowers/plans/2026-07-23-brush-perf-design.md:55` |
| 2026-07-23 | A flat-to-kind config partition must exist in exactly one place as a sole-constructor type with an exhaustive key-routing match (no default arm); never add a second classification loop. | `docs/superpowers/plans/2026-07-23-import-gcode-config.md:16` |
| 2026-07-23 | Untrusted external text must become typed config through exactly one boundary (parse, don't validate) — no second parser/typer is written. | `docs/superpowers/specs/2026-07-23-import-gcode-config-design.md:107` |
| 2026-07-26 | Never pass raw numbers across a boundary where the unit or frame matters; use distinct types per unit/domain so mixing them is a type error. | `docs/design/ILLUSTRATION.md:100` |
| 2026-08-18 | The process environment is a fact, so it is read ONCE per crate at a `traps` authority and every consumer reads a field — a `FS_*` name anywhere else in that crate is a bug, checked mechanically by the authority's own `traps_are_the_only_env_reader` test rather than promised in a comment. Where a switch gates a per-element decision the branch must not exist in the loop either: choose the path once and monomorphise, since a cached read still costs a branch per element. Call frequency is not the criterion — scattered authorities are the defect (Gabe, GIT_385). | `CLAUDE.md` § The environment is read once |
| 2026-08-22 | Per-crate is where an `FS_*` switch STARTS, not a licence to claim a name another crate already claims: a switch two crates honour is resolved in the crate that owns the FACT it arms — for `FS_DUMP_REGIONS` the crate whose writer every dump goes through — and the others READ the resolved value as data. Reading is not re-deriving; parsing the same name a second time is. Each crate's own `traps_are_the_only_env_reader` cannot see this, because each crate really does read the environment in one place of its own, so the name itself is gated workspace-wide: it is spelled ONCE, as a `const` the hint tables read, and a test walks every crate's `src/` and fails on a second spelling (GIT_431). | `crates/fs-geometry/src/traps.rs` (module doc); `docs/dev/traps.md` § Where a switch is READ (GIT_385) |
| 2026-08-22 | A table that MIRRORS where something is emitted is checked mechanically or it is not a table, it is a claim: the GIT_407 directive hints repeat each trap's `RUST_LOG` target by hand, so a hint that goes stale tells an operator to set a directive that never fires — the exact silence the hint exists to prevent. One shared gate (`fs_log::guard::assert_hinted_targets_are_emitted`) checks each crate's hints against the targets that crate emits on, AND a workspace sweep checks every hint in `crates/` against its own crate's emits and against `docs/dev/traps.md`, so a crate that grows a table and never opts in is still checked. A grep gate always ships its positive control: one that stops matching reads exactly like a conforming crate (GIT_417). | `crates/fs-log/src/guard.rs` (`assert_hinted_targets_are_emitted`); `docs/dev/traps.md` § Output |
| 2026-07-26 | A value must be stored once and everything else computed from it at use time or via a build step, rather than duplicated (derive, don't duplicate — one source of truth). | `docs/design/ILLUSTRATION.md:107` |
| 2026-07-26 | Domain sums must have no default match arms, so adding a variant is a compile error at every site; prefer total functions over partial ones guarded by callers (totality and exhaustiveness). | `docs/design/ILLUSTRATION.md:115` |
| 2026-07-26 | Tie resource lifetime to value lifetime via RAII/ownership/linearity so leaks, double-frees, and use-after-close are unrepresentable or compile errors. | `docs/design/ILLUSTRATION.md:122` |
| 2026-07-26 | Shared-mutable state is the state to make unrepresentable, not the default to discipline; prefer immutability by default and make mutation a marked, scoped exception. | `docs/design/ILLUSTRATION.md:129` |
| 2026-07-26 | Make concurrency hazards unrepresentable by construction: data races via ownership transfer/actors/immutability, orphaned tasks via structured concurrency, deadlocks via lock ordering encoded as types. | `docs/design/ILLUSTRATION.md:135` |
| 2026-07-26 | When retries, reorderings, or merges are possible, design operations so applying them twice, out of order, or concurrently is defined and identical, so the conflict cannot occur (idempotence, commutativity, monotonicity). | `docs/design/ILLUSTRATION.md:142` |
| 2026-07-26 | N artifacts that must agree (schema, parser, docs, UI, migrations) must be one artifact plus a generator, never hand-synchronized; compile in runtime-loadable definitions rather than leaving them loadable. | `docs/design/ILLUSTRATION.md:148` |
| 2026-07-26 | The trusted core (parser, unsafe block, FFI edge) must be shrunk to be small, sealed, and the only place an invariant is even expressible. | `docs/design/ILLUSTRATION.md:154` |
| 2026-07-26 | Model data so invalid combinations have no encoding: replace flag clusters with enums/unions, empty-able lists with NonEmpty types, and parallel arrays with objects holding direct references. | `docs/design/ILLUSTRATION.md:58` |
| 2026-07-26 | Validation must return a new type that carries the proof (parse, don't validate); the check happens once at the boundary and the unchecked value must not exist downstream. | `docs/design/ILLUSTRATION.md:66` |
| 2026-07-26 | The only way to obtain a value of a type must be the sole constructor that establishes its invariant, with private fields and a private constructor (smart constructors / sealed types). | `docs/design/ILLUSTRATION.md:73` |
| 2026-07-26 | When an invariant requires every value to pass through a fixed sequence of steps, the sink must accept only the pipeline's output type so the sink's parameter type is the enforcement (sealed pipelines and sinks). | `docs/design/ILLUSTRATION.md:80` |
| 2026-07-26 | An operation that requires authority must take a token type as a parameter that only the authority grants, so the permission check cannot be forgotten (capability / permission objects). | `docs/design/ILLUSTRATION.md:87` |
| 2026-07-26 | Encode a state machine in the type system (typestate) so that misuse such as send-before-open or double-close is a compile error. | `docs/design/ILLUSTRATION.md:94` |
| 2026-07-31 | A geometry-mutating pattern/dispatch function must take only the newtype whose sole constructor performs the required transform, never the raw underlying type, so skipping the transform becomes a compile error. | `docs/refactors/fill-ground-inset.md:145` |
| 2026-08-24 | A newtype that distinguishes two same-unit quantities is only as strong as the place it is MINTED: if the value is wrapped by hand at a call site, transposing two adjacent wraps compiles and the newtype catches nothing. The mint belongs at the authority that reads the source of truth — the config accessor that names the key — so the key, the direction and the return type are declared together and every consumer downstream receives a value it cannot mis-route. When the minter and the consumer are crates that do not depend on each other, the type lives in the zero-dependency vocabulary crate; promoting the consumer's crate into the minter's dependency list would pay for the invariant with whatever property that crate was built for (`fs-hub` links without the slicing engine). Tuple fields go private in the same change, with `compile_fail` doctests for the field read, the struct literal and the cross-assignment (GIT_518, `GapAbove`/`GapBelow`; GIT_283 claimed the type rung and reached rung 1). | `crates/fs-print-enums/src/lib.rs` (`GapAbove` doc); `docs/INVARIANTS.md` §7.5 |
| 2026-08-03 | Cant-break-by-design (invariants unrepresentable by construction) must be enforced for every design decision. | `CLAUDE.md` § Design (### Code) |
| 2026-08-09 | Enforcement of a construction invariant must be the type, not a review rule: the type is constructed only by its owning crate and consumers must name the grade/variant they are entitled to as a parameter, so a violation is a compile error rather than a defect. | `docs/superpowers/specs/2026-08-09-fill-territory-single-authority-design.md:114` |
| 2026-08-09 | Shared per-layer geometry should be borrowed, not cloned; a sole-constructor type with private fields and slice-returning accessors makes the ownership design and the safety invariant the same design. | `docs/superpowers/specs/2026-08-09-fill-territory-single-authority-design.md:187` |

## 🟢 Design — enforcement ladder

How strongly an invariant is held: name it in one sentence before writing the code path, pick the highest rung the language allows (7-8 target, 5-6 interim only with a ledger entry), judge the rung by the actual mechanism (never by confident prose), apply the stranger test, enumerate invariants in both directions (an unnamed invariant ships at rung 0), and prefer consuming handoffs that make staleness fail to compile over accessors that merely detect it.

| Date | Rule | Source |
|---|---|---|
| 2026-07-22 | Per the by-construction rule, every invariant a feature touches or introduces must be named, and each must be enforced as high on the enforcement ladder as the language allows. | `docs/superpowers/specs/2026-07-22-3mf-printer-import-design.md:208` |
| 2026-07-26 | Every invariant must use the strongest enforcement form its implementation language affords, and where the language is weak the invariant must move into a stronger layer (types, then codegen, then build-time checks, then a sealed module). | `docs/design/ILLUSTRATION.md:164` |
| 2026-07-26 | Name the invariant in one sentence before writing the code path; if you cannot state it, the design is not ready. | `docs/design/ILLUSTRATION.md:186` |
| 2026-07-26 | Pick the highest enforcement rung the language allows; a shared closure/helper is the weakest acceptable form and carries a promotion debt. | `docs/design/ILLUSTRATION.md:188` |
| 2026-07-26 | The tripwire: duplicating a processing step at a second call site means the design is already wrong — stop and build the choke-point instead of pasting. | `docs/design/ILLUSTRATION.md:191` |
| 2026-07-26 | Apply the stranger test: would a new call site added by someone who read no documentation still be correct? If not, keep climbing the enforcement ladder. | `docs/design/ILLUSTRATION.md:193` |
| 2026-07-26 | When the language cannot enforce an invariant structurally, shrink the trusted surface to one sealed module backed by lints and generate the rest — the requirement never changes, only the technique. | `docs/design/ILLUSTRATION.md:201` |
| 2026-07-26 | A new feature must enumerate invariants in both directions: existing invariants it touches and new invariants its own output introduces; an unnamed invariant ships at rung 0. | `docs/design/ILLUSTRATION.md:204` |
| 2026-07-26 | Every invariant must sit as high on the enforcement ladder as the implementation language allows, and touching code near a low-rung invariant means promoting it (rungs 7-8 are the target, 5-6 the weakest acceptable interim only with a ledger entry naming the promotion). | `docs/design/ILLUSTRATION.md:21` |
| 2026-07-26 | Assign an invariant's enforcement rung from the mechanism that actually enforces it, never from how confident the prose sounds; a claim naming no mechanism is rung 0. | `docs/design/ILLUSTRATION.md:216` |
| 2026-08-07 | An invariant's enforcement rung measures only bypass-resistance; whether the stated claim is the correct claim must be checked separately from how strongly it is enforced. | `docs/LEARNINGS.md:319` |
| 2026-08-09 | A consuming handoff that makes stale data fail to compile is stronger enforcement than an accessor that merely re-checks and detects staleness — unrepresentable outranks detected on the enforcement ladder. | `docs/superpowers/specs/2026-08-09-pipeline-signature-sweep.md:130` |

## 🟢 Design — invariant anti-patterns

The catalog of claims whose stated strength exceeds their mechanism: pub fields under sole-constructor claims, debug_assert as enforcement, prose preconditions, caller-is-responsible modules, twice-stated bounds, hand-maintained mirrors, duplicated clamps, "by construction, pinned by a test", inert catch_unwind, dead guards, unused superseded functions, silent bounded degrades, run-scoped globals, and "cannot fail" expects. Each rule names one way an invariant lies about itself.

Note that the run-scoped-global anti-pattern sits in tension with the coordinate scale factor's atomic global — see the process-globals group.

| Date | Rule | Source |
|---|---|---|
| 2026-07-26 | A stated invariant's enforcement strength must match its actual mechanism; cataloged anti-patterns (pub fields under a sole-constructor claim, debug_assert treated as prevention, prose-only preconditions, run-scoped mutable globals, tests standing in for construction, hand-maintained mirrors, co-location as mechanism, enum/role fields used as an information-transport channel) must always be flagged. | `.claude/agents/invariant-auditor.md:76` |
| 2026-07-26 | Every profile-dependent guard (e.g. debug_assert) must declare the release-build behaviour it degrades to. | `docs/design/ILLUSTRATION.md:223` |
| 2026-07-26 | A sole-constructor claim requires private fields; if the docs say "construct via X," the fields must become private in the same commit or the claim must not be written. | `docs/design/ILLUSTRATION.md:266` |
| 2026-08-24 | Private fields are a MODULE wall, not a type wall: a sole-constructor claim on a type declared at the crate root of a large file is rung 6, because every line of that file — `mod tests` included — can still write the struct literal. The type's own empty `const` or `Default` is usually the standing proof that the literal is writable. The claim is made true by moving the type into its own module and pulling every raw-field reader onto it, and it is KEPT true by a source-scanning guard, because moving the declaration back out compiles perfectly and so the compiler cannot report it (GIT_518, `SupportEmit`; the shape `mod finished_gcode` already used for `GcodeBody`). | `crates/fs-app/src/lib.rs` (`mod support_emit` doc); `docs/INVARIANTS.md` §7.5 |
| 2026-08-24 | A `derive` is a public constructor, and it is the quieter door: a sole-constructor claim is falsified by `#[derive(Default)]` (mints the empty value inland) and by `#[derive(Deserialize)]` (sets every private field from untrusted text) just as surely as by a `pub` field, but nothing in the struct BODY looks wrong, so a reader auditing field visibility passes it. The fix is a private zero-sized witness field whose type implements neither trait, which turns reinstating either derive into a compile error; the empty value becomes a private `const` reachable only from the real constructor, and the "did not run" state it used to impersonate becomes `Option::None` at the consumer. A source-scanning guard is still required, because deleting the one-line witness re-opens both doors in a diff that compiles (GIT_510, `CavityScanCost`/`ScanMeterWitness`). | `crates/fs-support/src/cavity.rs` (`CavityScanCost` doc); `docs/INVARIANTS.md` §1.1 |
| 2026-07-26 | A type name or doc-comment warning is not prevention; if two meanings of a value are both legitimate, they must be two types (or two differently-typed return values), never one name with a caveat. | `docs/design/ILLUSTRATION.md:274` |
| 2026-07-26 | Co-location of two pieces of data in the same file is not a mechanism; either one derives from the other or they must be a single value. | `docs/design/ILLUSTRATION.md:281` |
| 2026-08-24 | "These two cannot disagree, because one is built from the other" is a claim about the PRODUCER, and it says nothing about the value once it exists: a struct that stores the composition beside its own inputs holds two representations of one fact, and any writer of either can part them. A stored re-derivation is still a re-derivation — store each fact once and compose on demand, which reaches rung 8 and needs no guard for the composition itself (GIT_518, `fs_log::Captured`; GIT_415 widened the hole by adding the second representation to a `pub` struct with `pub` fields). | `crates/fs-log/src/capture.rs` (`Captured` doc); `docs/INVARIANTS.md` §7.9 |
| 2026-07-26 | "Should" in a doc comment is not a rule; make the guarded thing the only reachable currency, or explicitly accept rung 1 and file a ledger row for it. | `docs/design/ILLUSTRATION.md:286` |
| 2026-07-26 | A caller precondition must be encoded as a type, not stated as a sentence; if a type is genuinely not worth minting, the prose must say "precondition, unchecked" so it can be tracked. | `docs/design/ILLUSTRATION.md:294` |
| 2026-07-26 | A module that states "enforcement is the caller's job" has no invariant of its own; either accept a type buildable only from conforming input, or record the invariant against the caller, never the module. | `docs/design/ILLUSTRATION.md:301` |
| 2026-07-26 | A bound (e.g. a numeric limit) may exist in exactly one place; stating it twice will let the two copies disagree, so one must derive from the other or both must import a shared constant. | `docs/design/ILLUSTRATION.md:310` |
| 2026-07-26 | A hand-maintained mirror of another module's data needs a generator, not a drift test; generate the list, invert the dependency, or move the consumer. | `docs/design/ILLUSTRATION.md:317` |
| 2026-07-26 | Duplicating the same clamp/bound check in every setter is the tripwire; use a single constructor or a range newtype instead. | `docs/design/ILLUSTRATION.md:324` |
| 2026-07-26 | A hand-maintained exception/allowlist is debt and must be filed as debt with a ledger row naming the eventual promotion; it is not optional. | `docs/design/ILLUSTRATION.md:331` |
| 2026-07-26 | "By construction, pinned by a test" is only rung 3, and the prose must say "enforced by test" rather than "by construction," which is reserved for mechanisms that make the violation unwritable. | `docs/design/ILLUSTRATION.md:337` |
| 2026-07-26 | `debug_assert` is not enforcement — it is a rung-2 guard in the debug profile and nothing in release — so it must be promoted or declared in the build-profile register with its release behaviour spelled out. | `docs/design/ILLUSTRATION.md:346` |
| 2026-07-26 | A fault-isolation boundary (e.g. `catch_unwind`) must state which build profile it actually protects and name whatever defends the other profile, since `panic = "abort"` makes it inert. | `docs/design/ILLUSTRATION.md:353` |
| 2026-07-26 | Prefer identical debug and release behaviour over a debug-only guard, since a bug reproducible in only one profile has to be debugged twice — the second time in the field. | `docs/design/ILLUSTRATION.md:361` |
| 2026-07-26 | "Cannot fail in practice" plus `.expect` is a panic; either prove the impossibility from the types or make the function return `Result`. | `docs/design/ILLUSTRATION.md:369` |
| 2026-07-26 | A silent bounded degrade (e.g. a search cap) must publish its measured divergence point — the actual input size where the cap starts changing the result — not just the bound itself. | `docs/design/ILLUSTRATION.md:376` |
| 2026-07-26 | An invariant attached to code that cannot actually run must say so explicitly; an unlabelled dead guard reads as live protection and will be trusted by the next person who touches it. | `docs/design/ILLUSTRATION.md:385` |
| 2026-07-26 | When one implementation supersedes another, delete the superseded alternative rather than leaving it unused; an unused function is an invitation for the next caller to pick it. | `docs/design/ILLUSTRATION.md:392` |
| 2026-07-26 | A run-scoped global is only rung-2 enforcement whenever tests can share a process; thread the value explicitly or hand out a handle that states it, and treat an unavoidable global as debt on arrival. | `docs/design/ILLUSTRATION.md:399` |
| 2026-07-26 | Certain phrases in a doc comment ("by convention," "callers must," "should," "in practice," "not yet," "deferred," "hand-maintained," "pinned by a test," etc.) mark a claim weaker than it sounds and oblige either a promotion or a ledger row in the same commit. | `docs/design/ILLUSTRATION.md:411` |

## 🟢 Design — invariant ledger

Ledger process: an invariant and its ledger row land in the same commit, every new code path gets an invariant test plus a red-check proving the test can fail, deferrals and allowlists are filed debt (silent debt is forbidden), and the ledger reviewer is consent-gated, diff-scoped, read-only over source, reports mechanisms rather than bare rung numbers, and escalates rung-dropping changes immediately. A row's anchor is a SYMBOL, never a line number — the 2026-07-26 "reviewer flags stale `file:line` citations" rule is superseded by a mechanism: the form is refused outright, so there is nothing left to flag.

Enforcement: docs/INVARIANTS.md §7.9 — `crates/fs-integration/tests/ledger_anchor_resolution.rs`.

| Date | Rule | Source |
|---|---|---|
| 2026-07-26 | Every new code path must get an invariant test (A/B) proving the invariant holds through it, plus a red-check proving the test can fail; the type enforces, the test only pins. | `docs/design/ILLUSTRATION.md:195` |
| 2026-07-26 | Grandfathering: touching code near a rung-5-or-lower invariant obligates either promoting it or adding a ledger entry describing the deferral; debt is allowed but silent debt is not. | `docs/design/ILLUSTRATION.md:198` |
| 2026-07-26 | State an invariant and file its ledger row in the same commit; an invariant that exists only in a doc comment is not enumerable. | `docs/design/ILLUSTRATION.md:220` |
| 2026-07-26 | Offer continuous invariant-ledger review rather than assuming it; ask whether a background agent should keep the ledger current, and accept "no" as an answer. | `docs/design/ILLUSTRATION.md:225` |
| 2026-07-26 | An invariant ledger goes stale on the next commit that adds a debug_assert, mirrors a list, or writes "callers must," so keeping it current is mechanical work that must not run without consent since it costs real tokens. | `docs/design/ILLUSTRATION.md:422` |
| 2026-07-26 | Offer a background agent to keep the invariant ledger current rather than defaulting to it, and accept "no" as a valid answer. | `docs/design/ILLUSTRATION.md:428` |
| 2026-07-26 | A continuous invariant-ledger reviewer's scope must be limited to recently changed code (the diff since the last ledger update) — this is a fixed rule, not a tunable default. | `docs/design/ILLUSTRATION.md:434` |
| 2026-07-26 | A continuous invariant-ledger reviewer must trigger on demand or after a merge (never every commit), also flag stale file:line citations, output only proposed rows/downgrades/fixes (never an unattended source edit), write only to the ledger on a clean run, and escalate any rung-dropping change immediately rather than batching it. | `docs/design/ILLUSTRATION.md:442` |
| 2026-07-26 | An invariant-ledger review agent must be read-only over source: it proposes changes, it never promotes or "fixes" an invariant itself. | `docs/design/ILLUSTRATION.md:453` |
| 2026-07-26 | A ledger reviewer must report the mechanism behind a rung assignment, not just the rung number, since the rung is a judgement call that must be reviewable. | `docs/design/ILLUSTRATION.md:456` |
| 2026-07-26 | A diff that deletes prose an invariant ledger cites is itself a finding that must get a row (either a promotion or an abandonment), never silence. | `docs/design/ILLUSTRATION.md:459` |
| 2026-08-24 | A ledger row anchors on a SYMBOL, never on `file.rs:NNNN`: a moved line fails silently, a renamed symbol fails loudly. Where a claim has no symbol of its own, name the enclosing symbol or quote the line's text verbatim. Refused mechanically by `no_ledger_anchor_names_a_line_number`, resolved by `every_ledger_anchor_resolves` — the "reviewer flags stale citations" rule above is superseded by the form being unwritable. Measured on the migration: 18 of 18 `fs-engine/lib.rs` rows in §7.2 had rotted, plus a row naming a crate that no longer exists. | `docs/INVARIANTS.md` §8 "Anchor on symbols, not line numbers" (GIT_520) |

## 🟢 Process — worktrees, commits, staging

Repository mechanics as one agreeing family: multi-commit campaigns get their own worktree (branch name verbatim), isolation worktrees are reset onto local main before work, staging is named-files-only with protected tracking files never staged, commits use explicit pathspecs and carry the co-author trailer, merge requires all three verification legs green, teardown happens in the same session as the merge, research branches never auto-merge, and above-repo-root paths are off limits.

Most rules exist because the shared index and stale worktrees each caused real damage.

This group owns worktree LIFECYCLE (create, reset, stage, commit, merge, tear down).
Rules for a worktree with more than one occupant moved out 2026-08-26 to
Process — shared-worktree coordination.

| Date | Rule | Source |
|---|---|---|
| 2026-06-26 | The build must be warning-free: an unused private or crate-internal function must be deleted or explicitly test-gated, never left to generate a silent unused-code warning. | `docs/superpowers/plans/2026-06-26-m2-delete-sliceparams-engineconfig.md:15` |
| 2026-06-27 | Stage only the specific named files a change touches; never stage everything indiscriminately, since that risks re-tracking gitignored scratch content. | `docs/superpowers/plans/2026-06-27-config-gui-usability-fixes.md:17` |
| 2026-06-27 | Every commit message must end with the standard AI co-author attribution trailer. | `docs/superpowers/plans/2026-06-27-config-gui-usability-fixes.md:18` |
| 2026-06-28 | Git staging must add only explicitly named files, never `git add -A`. | `docs/superpowers/plans/2026-06-28-solid-infill-shells.md:32` |
| 2026-06-29 | The mandatory first step in every worktree is to hard-reset onto the actual target branch, since an isolated worktree lands on the default branch which lacks the target work. | `docs/superpowers/plans/2026-06-29-deferred-areas-reconciliation.md:16` |
| 2026-07-10 | Never stage protected tracking files (e.g. USER_AUDIT.md, SLICER_FEATURE_TODO.md, AGENTS.md, .superpowers/); stage named files only, never a blanket add. | `docs/superpowers/specs/2026-07-10-one-flow-source-of-truth.md` § Staging hygiene |
| 2026-07-23 | Commit with explicit pathspecs (git commit -- <paths>), never a bare git commit, since untracked root files must never be swept into a commit. | `docs/superpowers/plans/2026-07-23-import-gcode-config.md:17` |
| 2026-07-23 | Per CLAUDE.md, a multi-commit campaign gets a dedicated worktree. | `docs/superpowers/specs/2026-07-23-import-gcode-config-design.md:175` |
| 2026-07-26 | Credit the user by name, in both the commit message and the code comment, for any idea, diagnosis, algorithm, or fix that originated with them. | `.claude/skills/campaign/SKILL.md:54` |
| 2026-07-26 | A campaign must not start merging to main until all three verification legs (workspace tests, goldens, oracle parity) are green; green on only one leg is not green. | `.claude/skills/campaign/SKILL.md:59` |
| 2026-07-26 | The research branches (performance_research, total_research) must never be auto-merged. | `.claude/skills/campaign/SKILL.md:78` |
| 2026-07-26 | Immediately after a campaign branch is merged, in the same session, its worktree and branch must be removed; the merge is not the end of the campaign, the teardown is. | `.claude/skills/campaign/SKILL.md:80` |
| 2026-08-02 | Inside a worktree, anything above the repo root is off limits unless asked for. | `CLAUDE.md` § Worktrees |
| 2026-08-12 | A worktree's branch name must be the worktree name verbatim, with no worktree-/claude- prefix. | `CLAUDE.md` § Worktrees |

## 🟢 Process — shared-worktree coordination

Four agreeing rules for the case where a worktree, a cache, or a measurement slot has
MORE THAN ONE OCCUPANT. The binding idea is that shared repo state carries work whose
owner you cannot see, so the destructive reflex is always wrong: a stray worktree is
reported rather than removed, one with uncommitted changes is never removed without
asking, a perf slot is released through the tool that holds its lock rather than a raw
`git worktree remove`, and temporary instrumentation is ANNOUNCED before it is written
so a reader can tell a live probe from drift. The shared Cargo cache is the same shape
seen from the other side: cross-worktree interference producing an error that contradicts
the source, where the reflex to trust the error is what costs the time.

Promoted into its own group 2026-08-26 (Gabe's ruling) from Process — worktrees, commits,
staging, which owns worktree LIFECYCLE; this group owns CONCURRENT OCCUPANCY. The
distinction earns its keep because the lifecycle rules are about a worktree you own and
these are about one you may not.

| Date | Rule | Source |
|---|---|---|
| 2026-07-26 | A stray worktree found during cleanup that isn't an active campaign must be reported, not silently removed, and any worktree with uncommitted changes must never be removed without asking first. | `.claude/skills/campaign/SKILL.md:101` |
| 2026-07-26 | Perf-measurement worktree slots under .perf-worktrees/ must be removed only via scripts/perf.sh worktree-rm, never with a raw git worktree remove while a measurement holds the lock. | `.claude/skills/campaign/SKILL.md:92` |
| 2026-08-02 | When a build error contradicts the source (a pub symbol "not found", a mismatched signature), the shared worktree's Cargo incremental cache is likely poisoned; run cargo clean and rebuild before treating the error as real. | `CLAUDE.md` § Build cache |
| 2026-08-26 | A shared worktree is shared state: a session writing TEMPORARY instrumentation into one announces the file and a unique marker string BEFORE writing and removes both when the measurement ends, because an unannounced live probe is indistinguishable from unexplained drift in `git status` and the honest response to unexplained drift is to revert it, destroying the measurement mid-run. | `CLAUDE.md` § Worktrees |

## 🟢 Process — formatting scope

Three agreeing refinements of one rule: format only the files a change touches, with stable rustfmt, invoked per file — never workspace-wide, never `cargo fmt -p` (a crate root reformats siblings), and never on fs-engine or fs-hub at all, to preserve their pre-existing drift.

| Date | Rule | Source |
|---|---|---|
| 2026-06-21 | Format only the Rust files you edit with stable rustfmt, per file, rather than reformatting the whole crate. | `docs/superpowers/plans/2026-06-21-provenancable-field-model-foundation.md:17` |
| 2026-07-03 | Do not run cargo fmt on fs-engine or fs-hub, to preserve their existing formatting drift; new crate files may be formatted individually. | `docs/superpowers/plans/2026-07-03-belt-printer-support.md:17` |
| 2026-07-29 | rustfmt is invoked per changed file, never as `cargo fmt -p`, because handing it a crate root reformats sibling files it shouldn't touch. | `docs/ci.md` § Why formatting is changed-files-only |

## 🟢 Process — agent orchestration

How subagents are RUN, as distinct from what they may touch (see § Process — review and audit agents for that): the main loop STARTS effort in a subagent rather than doing it inline, on the cheapest model capable of the task, dispatching, verifying the result, and only then dispatching the next — and, when the work is many independent units, grouped into batches rather than dispatched one unit at a time. Concurrency is scoped by task CLASS (effort, review, rule-intake, ...): exactly one agent per class runs at a time; classes may run concurrently with each other.

**The wobble:** the 2026-08-24 rule read as an unqualified absolute — "Exactly ONE subagent runs at a time... Never fan out" — with no notion of task class.

**Where it ended (Gabe, 2026-08-27):** serial WITHIN a class, parallel ACROSS classes. A Workflow, or any parallelism beyond that cross-class allowance, still runs only on the user's explicit ask, never on the agent's own initiative.

These rules put the quality burden on gates and on the dispatcher rather than on the agents themselves — cheap models are made safe by spot-checks and red-checks. Note that the batching rule governs GRANULARITY (how many units share one dispatch, within a class) and the serial rule governs CONCURRENCY (how many dispatches run at once, within a class); they compose, and batching never licenses fan-out.

| Date | Rule | Source |
|---|---|---|
| 2026-08-15 | Cheapest capable model per subagent task; quality held by verification gates (spot-checks, coverage counts, red-checks), never by model tier; failed spot-check reruns one tier up, recorded. | `CLAUDE.md` § Agent cost economy |
| 2026-08-24 | Serial agents only: exactly ONE subagent runs at a time and the main loop never fans out — it dispatches, waits, verifies the RESULT, then dispatches the next. Every dispatch prompt forbids the agent from spawning its own subagents; `ListAgents` (not TaskList) is what shows which agents are live; a Workflow fans out by construction and is never started without asking Gabe first. | `CLAUDE.md` § Serial agents only |
| 2026-08-25 | Batch the units: a long task made of many independently-runnable units is dispatched in BATCHES, never one agent per unit and never all units in one agent, with the batch size balancing token cost against dispatch overhead. Independence ("can run on their own") is the test for what may share a batch; the batch count and coverage are reported so a partial failure names the units that did not run. Governs granularity only — the batches still dispatch one at a time under § Serial agents only. | `CLAUDE.md` § Batch the units (HARD RULE) |
| 2026-08-27 | Work starts in an agent: efforts are STARTED in a subagent to conserve main-loop CONTEXT (not model spend) — the main loop's own work is design, adjudication, verdicts, and verifying a returned result, everything else is dispatched. No size threshold gates this (a proposed "~10 repeats" threshold was raised and rejected the same session). Closes a gap in § Agent cost economy, which picked a model tier once work was dispatched but never required dispatch to happen at all. | `CLAUDE.md` § Work starts in an agent |
| 2026-08-27 | Serial agents only, narrowed to PER TASK CLASS: agents divide into classes (effort, review, rule-intake, and others as named); exactly one agent per class runs at a time, but classes may run concurrently with each other without asking. Folds in the same-day "effort agents run serial, no workflows or parallelism unless requested" dictation — effort is one class among several, not a separate stricter rule. | `CLAUDE.md` § Serial agents only |

## 🟢 Process — review and audit agents

Constraints on automated reviewers, all pointing one direction: agents that judge must not touch. Reviewers are read-only by construction (no branch moves, no source edits to make checks pass), porting agents own exactly one crate, generation models never commit to protected branches, and scanner output is a suspicion requiring a human file:line confirmation before action.

| Date | Rule | Source |
|---|---|---|
| 2026-06-17 | Each parallel porting agent owns exactly one crate and writes only files under that crate's directory, never editing outside it. | `docs/adr/0003-parallel-porting-and-gui-vision.md:25` |
| 2026-06-26 | An automated chapter-generation model must never commit directly to a protected branch; an adversarial review pass and a human reviewer both stand between it and main. | `docs/learning/tools/README.md:49` |
| 2026-07-09 | A reviewer works read-only: never create/move/delete branches, merge, force-reset shared refs, or push, and never stage protected files such as USER_AUDIT.md, SLICER_FEATURE_TODO.md, AGENTS.md, or .superpowers/. | `docs/superpowers/specs/2026-07-09-arachne-flow-single-source.md:76` |
| 2026-07-26 | The invariant-auditor agent is read-only by design (no Bash/Edit/Write) so it cannot check out, reset, stage, or move a git branch. | `.claude/agents/invariant-auditor.md:19` |
| 2026-07-26 | The parity-verifier agent may run only read-only/build commands (cargo build/test, python scripts, read-only git); it must never run a command that moves a ref or mutates the working tree. | `.claude/agents/parity-verifier.md:90` |
| 2026-07-26 | Audit output is a suspicion, never a fact: a scanner-flagged candidate may only be acted on after a human reads the code and records a file:line confirmation, never because "the tool said so." | `docs/config-ssot-suspicions.md:5` |

## 🟢 Performance — measurement method

How performance is measured honestly: interleaved A/B runs of pre-built binaries on a quiet machine, always from a separate checkout, timers wrapping only the work (never the deciding branch — stated twice, independently), instrumentation and fix in the same build, configuration always recorded, variables isolated one at a time, doomed-fraction measured before reapplying a technique, correctness questions never riding in perf commits, and measure-first before reasoning about where a defect ought to be.

| Date | Rule | Source |
|---|---|---|
| 2026-07-25 | Each per-stage timer must wrap only the actual work, never the branch that decides whether to run it, so a zero reading means "did not run" rather than "too fast to measure". | `docs/SLICER_PERFORMANCE_TODO.md:200` |
| 2026-07-25 | Never compare two performance builds run sequentially; build both binaries first, then interleave the runs (A, B, A, B) and report every round, because sequential runs measure machine drift as much as the change. | `docs/perf/investigation-2026-07-25.md:282` |
| 2026-07-25 | Performance measurement always runs from your own checkout against a worktree; there is no option and no default for measuring the tree you are actively editing. | `docs/perf/measuring.md:370` |
| 2026-07-25 | When instrumenting a pipeline stage's timing, wrap only the work itself, never the `if` that decides whether the work runs, so an absent stage is never misreported as a stage that ran in zero time. | `docs/perf/measuring.md:511` |
| 2026-07-29 | A correctness question must never ride along inside a performance/profiling commit; it needs its own commit, its own fixture, and its own golden/oracle verification. | `docs/perf/arachne-parked-ideas.md:108` |
| 2026-07-29 | Always record and state which configuration a slicing performance measurement was taken under, since the dominant cost and the resulting conclusions change with the configuration. | `docs/perf/campaign-2026-07-29-slice-time.md:295` |
| 2026-07-29 | Measure performance on a quiet machine; background load (such as a concurrent build) produces confidently wrong conclusions. | `docs/perf/campaign-2026-07-29-slice-time.md:299` |
| 2026-07-29 | Instrument a performance fix in the same build as the measurement that tests it, so one run shows both whether it worked and why. | `docs/perf/campaign-2026-07-29-slice-time.md:303` |
| 2026-07-30 | Before reapplying a performance technique at a new call site, first measure the fraction of inputs that are "doomed" (skippable) at that site; that fraction, not the shape of the code, decides whether the technique helps there. | `docs/refactors/bridge-cost.md:131` |
| 2026-07-30 | Enabling a previously-dead feature path must not silently multiply the cost of the pipeline's most expensive predicate; duplicated derivation has to be collapsed to one before the feature goes live. | `docs/refactors/internal-bridge-semantics.md:120` |
| 2026-07-30 | Measuring one variable while another dominates the outcome measures nothing; isolate variables one at a time before trusting a measured effect. | `docs/refactors/same-layer-overlap.md:62` |
| 2026-08-01 | Instruments such as census, capture, and overlays must live in the same build as the changes they verify. | `docs/LEARNINGS.md:233` |
| 2026-08-10 | Measure first: instrument and observe rather than reasoning about where a boundary or defect ought to be. | `docs/superpowers/specs/2026-08-10-fill-allocation-handoff.md:264` |

## 🟢 Geometry kernel — coordinates and numeric exactness

Agreeing rules: fixed-point i64 coordinates, i128 widening for products, epsilon comparison for floats, exact summation with one late rounding, `as f64` casts (never f64::from), and hardcoded tolerances only as deliberate decisions.

Enforcement: `docs/INVARIANTS.md` §7.1.

| Date | Rule | Source |
|---|---|---|
| 2026-06-17 | Coordinates use a fixed-point i64 (coord_t) matching the active libslic3r type, not i32. | `docs/adr/0001-coordinate-system.md` § Decision |
| 2026-06-17 | Coordinate products (cross, dot, squared_length) must widen to i128 to stay exact and avoid overflow. | `docs/adr/0001-coordinate-system.md:69` |
| 2026-06-26 | Float equality is never tested with `==`; two floats are considered equal only when their difference is below a stated epsilon tolerance. | `docs/learning/AUTHORING.md:24` |
| 2026-06-26 | Scaled integer coordinates must be summed and differenced exactly and rounded only once, late, at the boundary back to millimetres. | `docs/learning/AUTHORING.md:27` |
| 2026-06-28 | Scaled coordinates are represented as i64 and converted to floating point with an explicit "as f64" cast, never with the From-based float conversion. | `docs/superpowers/plans/2026-06-28-arachne-medial-axis.md:19` |
| 2026-06-28 | XY coordinates are scaled i64 integers; convert with scale/unscale and cast with `as f64`, never `f64::from`. | `docs/superpowers/plans/2026-06-28-solid-infill-shells.md:35` |
| 2026-06-28 | All combing geometry must use integer scaled coordinates, converting lengths to f64 only after unscaling, and must never use f64::from on scaled coordinates. | `docs/superpowers/specs/2026-06-28-combing-travel-avoidance-design.md:396` |
| 2026-08-21 | A geometry-kernel entry point declines an input below the coordinate grid's own resolution instead of passing it on: "positive" is not the same test as "representable", and the float residue of a subtraction that meant to reach zero is not a bead. The floors are `MIN_RING_AREA_MM2` (area, at the boolean boundary) and `MIN_FOOTPRINT_WIDTH_MM` (width, at the sole stroke route); both bound the kernel's work by construction, so no config and no geometry can hand it an input that blows it up. GIT_433: a 0.076 nm blocked band aborted `fs-app` on a 288 GiB allocation. | `crates/fs-clipper/src/lib.rs:73`, `docs/INVARIANTS.md` §7.1 |
| 2026-08-22 | An exactness test over quantised coordinates is stated against the QUANTUM wherever the vertex's PROVENANCE says a sub-quantum deviation cannot be shape; elsewhere it stays identically-zero. "Is this point on that line" is a question an integer grid cannot answer exactly: a point on the line in exact arithmetic lands up to half a unit off it after the single round, so an identically-zero cross product tests the ROUNDING, not the shape. GIT_378: a mesh slice's chained loop has known provenance (a vertical quad's triangulation diagonal is on the chord by construction and SLIDES with Z), so it merges at the quantum (`merge_redundant_on_grid`) and the outline becomes a function of the solid; a boolean or offset output ring does not (an arc point a unit off the chord may be the last trace of curvature), so it keeps the value-neutral rule (`merge_collinear`) and the region comes back unmoved. Removal at the quantum is not value-neutral and the bound is stated where it is taken. | `crates/fs-geometry/src/polygon.rs:280` (`Redundancy`), `docs/INVARIANTS.md` §7.1, contract map §4.9.3 |
| 2026-08-24 | A geometry kernel never PRODUCES a ring that encloses exactly zero area, and the boundary that guarantees it is the producer's, not each consumer's. Geometry representing nothing cannot hold material and cannot be subtracted from, so its only remaining power is to be COUNTED — by any stage whose decision turns on piece count rather than on area — which means output can depend on the existence of something that is not there, and "byte-identical" stops being a reliable no-change signal for any clipper, library or operand-order swap. GIT_524: `fs_clipper`'s entry (`ex_contours`) stripped sub-resolution rings from OPERANDS while its exit stripped nothing, so whether a zero-area ring survived depended only on which operation ran next; the castle's solid ladder escaped its own fill area by 0.000000 mm² and yet by a non-empty piece set on 51 of 75 ladder layers, up to 61 pieces. The gate belongs at the SOLE EXIT (`shapes_to_expolygons`) because that is where derived geometry is made, and the producer is that exit's own snap to the integer lattice: 8,596 of the castle's 8,626 zero-area rings arrived with ≥ 3 `f64` vertices and left with < 3, and 0 arrived degenerate. The line is EXACTLY zero, not the entry-side area floor, and the difference was measured rather than argued — the zero line moved 0 castle / 0 Benchy / 22 kaleidoscope / 10 city lines, the 1e-4 mm² line moved 10,089 / 148,288 and three user-visible diagnostics with them. A gate at the producer is NOT excused from accounting for what it does move: those 32 lines were isolated to one layer per model (kal 70, city 617) whose `infill_wall_overlap` weld had been skipped because `grow_fill_surface_into_wall_band`'s guard, `src_fragments * wall_fragments > 400`, counts CONTOURS with no area term — 2 contours enclosing nothing were the whole margin (9x49=441 → 7x49=343; 10x44=440 → 8x44=352). The user-configured overlap was being withheld on account of a cost that does not exist, and the whole-file filament delta is +0.00002 mm. Two boundaries may keep two numbers, provided each states its own reason: the entry floor bounds the kernel's arrangement work on an operand, the exit gate governs a result stages consume. | `crates/fs-clipper/src/lib.rs` (`shapes_to_expolygons`, `ring_floor::keep`), `docs/INVARIANTS.md` §7.1, contract map §4.9.2b, `docs/dev/traps.md` (`FS_RING_FLOOR`) |
| 2026-08-22 | A verification tolerance is DERIVED from the mechanism that produces the noise, and is stated in that mechanism's own units — never scaled off whichever quantity was to hand. Re-snapping a boundary to the coordinate grid moves an area by `sqrt(2) x quantum x BOUNDARY LENGTH` (the shoelace area is linear in every vertex); area is not that quantity, and `area x 1e-5` is the same number only for a fat region. GIT_329: the clipper direction check used the area form and reported six IMPOSSIBLE results on the kaleidoscope for micrometre-girth slivers (0.015-0.025 mm2 against 7-34 mm of boundary) whose excess was inside the grid's own bound. The corrected form also TIGHTENS the check on every fat region, which is how a corrected model is told from a widened one. How far a boundary may have moved is a property of the PRODUCER, so the call site states it (`BoundarySlack::lattice` for a boolean, `::simplified_at(res)` for an offset whose output was simplified) rather than the checker guessing. | `crates/fs-clipper/src/lib.rs:911` (`area_slack_mm2`), `docs/INVARIANTS.md` §7.1, contract map §4.9.3b |

## 🔴 Cross-cutting — process globals vs carried values

**The wobble:** may a fact live in a process-global. The 2026-06-17 coordinate ADR made the scaling factor a run-scoped atomic global confined to one seam; the 2026-07-30 promote-resolution work ruled a tolerance must be carried as a value on the call, because a global's one-run-per-process promise is broken by any test binary (and the anti-pattern catalog rates run-scoped globals rung-2 debt).

**Where it ended (inferred):** thread values through calls; a run-scoped global is debt on arrival. The scale-factor atomic survives as the documented legacy exception behind its pure scale_with/unscale_with seam.

| Date | Rule | Source |
|---|---|---|
| 2026-06-17 | The scaling factor is a runtime atomic value (not a const), set once at startup, with pure scale_with/unscale_with primitives confining the global to a single seam. | `docs/adr/0001-coordinate-system.md:62` |
| 2026-07-30 | An offset must round to the same resolution as the slices beneath it, and that tolerance must be carried as a value on the call rather than delivered through a process-global, since a global's one-run-per-process promise is broken by a test binary. | `docs/refactors/promote-resolution.md:3` |
| 2026-08-24 | A MEASUREMENT of one run is a value that run produces, never an accumulator that outlives it — and the numerators and the denominator they are read against travel in the SAME value, so a second run in the same process cannot report the first run's work over its own count. `bridge_regions_per` kept six never-reset `static AtomicU64` under a "denominators stated" claim; the GUI re-slices in a long-lived process, so the second slice's ratios were the sum of both runs over one run's layers. Threading a `BridgeGateCost` through the rayon `fold`/`reduce` makes the shared total unrepresentable rather than merely reset-on-remembering, and the only constructor that opens a census is the one that counts the layer. The corollary the same change had to learn: a CLOCK is not part of an output's identity, so the nanosecond split stays off `PrintPlan` (whose `PartialEq` several tests read as "same output") and holds no denominator of its own. GIT_516. | `crates/fs-engine/src/lib.rs` (`BridgeGateCost`), `docs/INVARIANTS.md` §7.2, contract map §2.13a |

## 🟢 Diagnostics — probes and traps

Trap discipline as one agreeing family: a probe is chosen by what it can actually see, states its denominator in its output, prints explicit zeros (nothing-produced and never-ran are different facts), matches its shape to the question, carries a positive control, and declares its measurement floor. A missing measurement is never reported as clean, at-source capture beats post-hoc reconstruction, peak metrics are replaced by counts and extents, and a detector returning zero findings is broken until proven otherwise.

| Date | Rule | Source |
|---|---|---|
| 2026-08-01 | Verify the mesh at the flagged coordinates before assuming the slicing pipeline invented a geometric feature. | `docs/LEARNINGS.md:134` |
| 2026-08-01 | At-source captured data overrides post-hoc probe reconstruction wherever the two conflict. | `docs/LEARNINGS.md:195` |
| 2026-08-01 | Same-layer tiling comparisons must use flow-spacing footprints while cross-layer physical-support comparisons must use bead-width footprints; one sweep convention cannot serve both. | `docs/LEARNINGS.md:51` |
| 2026-08-01 | When geometry is only accurate to its simplification tolerance, declare the measurement floor with a morphological opening at that tolerance rather than chasing sub-tolerance slivers. | `docs/LEARNINGS.md:65` |
| 2026-08-01 | Before judging a UAT build, verify the binary's last-write time; a rebuild that silently failed to replace a running executable can produce a false verdict. | `docs/refactors/overhang-truth.md:121` |
| 2026-08-07 | A maximum/peak metric cannot see a new defect shallower than the prior worst or a wider one once saturated; count occurrences and measure extents instead of tracking only the peak. | `docs/LEARNINGS.md:428` |
| 2026-08-11 | Pick a diagnostic probe by what it can actually see, not by its name; if a probe returns nothing, first ask whether it could have detected something before trusting the silence. | `docs/dev/traps.md:21` |
| 2026-08-11 | A missing measurement must never be reported as though it were a clean/passing one. | `docs/dev/traps.md:85` |
| 2026-08-11 | Every diagnostic trap must state its denominator in its output, not only in a comment. | `docs/dev/traps.md` § Adding a trap |
| 2026-08-11 | Every diagnostic trap must print explicit zeros, since "this stage produced nothing here" and "this stage never ran" are different facts and only one is evidence. | `docs/dev/traps.md:90` |
| 2026-08-11 | A diagnostic trap's probe shape must match the question being asked, since long thin pieces need a bbox or scanline probe and a disc probe will misreport them. | `docs/dev/traps.md:92` |
| 2026-08-11 | Every diagnostic trap needs a positive control, since a gate that has only ever read zero is indistinguishable from a broken one. | `docs/dev/traps.md:94` |
| 2026-08-12 | `;TYPE` G-code block counts are chaining artefacts, never a defect measure; use the same-layer census instead. | `docs/STATE.md:132` |
| 2026-08-14 | A detector that returns zero findings must be treated as broken until proven otherwise, not accepted as a clean result. | `docs/audits/2026-08-14-cbbd.md:39` |
| 2026-08-22 | A crate that declares `hotpath` must instrument something, or appear on a declared gap list that can only shrink; the instrumentation rule is unenforceable where the tool is absent, and absence looks exactly like compliance. | `docs/dev/traps.md` § The instrumentation tool must be PRESENT to be skipped |
| 2026-08-22 | A default-inert profiler can never supply a figure the program prints; a user-facing cost keeps its own wall-clock, measured once at the site that states it, and never a second clock inside the measured span. | `docs/dev/traps.md` § The instrumentation tool must be PRESENT to be skipped |

## 🟢 fs-meshbool / mesh repair — kernel robustness

Agreeing rules for the mesh kernel: exact predicates only (no epsilon branch decisions), Result instead of panic on any input, watertightness asserted by index-keyed edge multiplicity and Euler characteristic (coordinate-keyed checks can lie), one repaired mesh instance feeding both slicing and the Z list, the 3D boolean path fenced off from the slicing path entirely, and never trusting file-stored normals.

| Date | Rule | Source |
|---|---|---|
| 2026-06-28 | 3D mesh boolean operations must return a Result and never panic in the slicing path, since booleans can legitimately fail on pathological input. | `docs/superpowers/specs/2026-06-28-booleans-cut-negative-design.md:126` |
| 2026-06-28 | Mesh-level cut/boolean tools mutate the model while per-layer 2D subtraction happens at slice time from typed volumes; the two paths must never both run on the same volume. | `docs/superpowers/specs/2026-06-28-booleans-cut-negative-design.md:164` |
| 2026-06-28 | When a plane-cut classifies a triangle that lies exactly on the cut plane, it must be assigned to the positive half exactly once, never to both halves, to avoid a doubled cap face. | `docs/superpowers/specs/2026-06-28-booleans-cut-negative-design.md:172` |
| 2026-06-28 | If cap-contour chaining cannot close a cross-section, plane_cut must leave genuinely open spans uncapped rather than fabricating geometry, and surface a CutWarning instead of panicking. | `docs/superpowers/specs/2026-06-28-booleans-cut-negative-design.md:173` |
| 2026-06-28 | The slicing path must never call the 3D mesh_boolean function (it uses 2D subtraction instead), so a boolean-kernel failure can never corrupt a slice. | `docs/superpowers/specs/2026-06-28-booleans-cut-negative-design.md:178` |
| 2026-06-28 | The repaired mesh must be the single mesh instance used for both slicing and Z-list generation (repaired once at load time), or per-layer geometry desyncs from the Z list. | `docs/superpowers/specs/2026-06-28-mesh-robustness-design.md:132` |
| 2026-07-03 | Boolean-mesh branch/classification decisions must use exact predicates (robust::orient3d/orient2d) only; no f64 epsilon inside/outside tests are allowed. | `docs/superpowers/plans/2026-07-03-fs-meshbool-kernel.md:15` |
| 2026-07-03 | Watertightness test helpers must check index-keyed edge multiplicity and Euler characteristic, not just coordinate-based Connectivity::open_edges(), because coordinate-keyed checks can pass even when vertex welding silently failed. | `docs/superpowers/plans/2026-07-03-fs-meshbool-kernel.md:186` |
| 2026-07-03 | Every mesh-boolean result test must assert watertightness and correct orientation: zero open edges, every undirected edge with multiplicity 2, correct Euler characteristic, and positive volume. | `docs/superpowers/plans/2026-07-03-fs-meshbool-kernel.md:20` |
| 2026-08-01 | File-stored mesh normals are never trusted; recompute them from winding. | `docs/LEARNINGS.md:159` |

## 🟢 Platforms — per-platform crate split

One architecture rule and its enforcement: platform-specific code lives in its own crate behind a trait in the shared crate — never restored into shared files behind #[cfg]; both feature-flag builds must compile with the integration point itself gated; a shared file that conflicts twice during a chase is a bucketing defect to split; and the unsafe policy is split rather than relaxed (shared crate stays forbid(unsafe_code), the one audited allow lives in the Android-only crate).

| Date | Rule | Source |
|---|---|---|
| 2026-06-24 | When a feature lives behind a Cargo feature flag, both the feature-enabled and feature-disabled builds must compile, with the integration point itself cfg-gated rather than only the dependency. | `docs/superpowers/plans/2026-06-24-spacemouse-support.md:14` |
| 2026-06-24 | All SpaceMouse integration code must be fully cfg-gated behind the spacemouse feature so a build without the feature contains zero SpaceMouse code and pulls no hidapi dependency. | `docs/superpowers/specs/2026-06-24-spacemouse-support-design.md:48` |
| 2026-07-10 | Platform-specific code must live in its own platform-specific crate with a trait in the shared crate, never restored into a shared crate behind a #[cfg] gate. | `.claude/skills/refresh-diverged-branch/SKILL.md:94` |
| 2026-07-10 | The unsafe-code policy is split, not conditionally relaxed: the shared fs-ui-app crate stays unconditionally #![forbid(unsafe_code)], and the single audited #[allow(unsafe_code)] lives only in the Android-only fs-ui-app-android crate. | `docs/ANDROID-HANDOFF.md:23` |
| 2026-07-10 | A shared file that conflicts more than once during a chase is a defect in the platform-code bucketing and must be separated into a cfg-gated or platform-only file so it stops conflicting. | `docs/ANDROID-MAIN-SYNC.md:95` |
| 2026-07-10 | The Android port isolates the platform boundary behind traits and per-target cfg gates, leaving the shared engine and egui view code untouched. | `docs/adr/0007-android-tablet-port.md:23` |
| 2026-07-10 | fs-spacemouse is restricted to Windows-only dependencies so it never compiles on other targets. | `docs/adr/0007-android-tablet-port.md:42` |
| 2026-07-10 | Per CLAUDE.md, each platform-specific arm of shared code must live in its own per-platform crate behind a shared trait, rather than inline cfg splits in shared files. | `docs/superpowers/specs/2026-06-29-platform-crate-split-nav-fileaccess-design.md:8` |

## 🟢 Platforms — Android line sync

Three agreeing rules for chasing main: maindroid receives only production-worthy code via promoted feature branches (main never merges straight in), maindroid never merges back until the port is ready to upstream, and chasing is always merge (never rebase) so rerere keeps the conflict resolutions.

| Date | Rule | Source |
|---|---|---|
| 2026-07-10 | The Android maindroid branch only ever receives production-worthy code; main is never merged straight into it, only into an active feature/worktree branch that is later promoted. | `docs/ANDROID-MAIN-SYNC.md:20` |
| 2026-07-10 | Never merge maindroid back into main until the Android port is ready to upstream. | `docs/ANDROID-MAIN-SYNC.md:35` |
| 2026-07-10 | Always merge, never rebase, when chasing main into the Android line, so conflict resolutions are preserved and fed back into git rerere. | `docs/ANDROID-MAIN-SYNC.md:59` |

## 🟡 fs-arachne-voronoi / walls — bead generation

Wall-generation law: width moves placement and flow together (a flow-only approximation is rejected), per-junction widths are the single flow truth once Arachne toolpaths exist, boostvoronoi failures degrade to classic walls for that region, degenerate inputs skip rather than panic in release, and the engine's width==spacing convention is a documented deliberate deviation from Orca's spacing-vs-width model.

The width==spacing deviation is the one place the project consciously overrode matching Orca with its own documented model.

The wobble — is external-perimeter width fixed? Where it ended: NO, repealed 2026-08-18 by Gabe, who had ruled the opposite on 2026-08-15. The 2026-08-15 rule said external width is preserved for surface quality and never redistributed by beading, framed as a deliberate override of Orca intent. Gabe's ruling: *"let's repeal my rule about external perimeters being fixed width so we can match orca exactly. it looks like what a true arachne impl looks like is that the perimeters are traced with width information informed by the centreline"*. The centreline section is the width authority for every bead, the external one included; `outer_wall_line_width` is a target, not a ceiling. The code never held the repealed rule anyway — `Redistribute` clamps the face to `min(thickness/2, outer)` above two beads and splits evenly at one or two — so the 2026-08-15 row overstated both Orca and Ferrislicer.

Supersedes: the external-perimeter-width claim of `docs/superpowers/specs/2026-08-15-scenario-fixture-catalog-design.md` (in part — that spec's catalog design otherwise stands and is being executed).

Enforcement: `docs/INVARIANTS.md` §7.2, §7.3. The fixture-catalog entry that enforced the repealed external-width rule was removed with it — see the note under the table.

| Date | Rule | Source |
|---|---|---|
| 2026-06-23 | Wall width must affect both toolpath placement and extrusion flow together; a flow-only approximation that leaves placement at the wrong width (and under-extrudes) is rejected as correctness-over-approximation requires. | `docs/superpowers/specs/2026-06-23-per-role-widths-design.md:11` |
| 2026-07-08 | Once Arachne toolpaths exist, per-junction/per-path widths are the single source of truth for G-code flow and preview, overriding print-settings widths; there is no role-based width lookup for Arachne wall paths. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:24` |
| 2026-07-08 | Fault isolation must be preserved: boostvoronoi failures or panics must degrade to an empty result, with the caller falling back to classic wall generation for that region. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:28` |
| 2026-07-08 | Ferrislicer's engine treats configured line width as bead spacing everywhere (a documented deviation from Orca's spacing-vs-width model); this width==spacing convention must be documented at generate_wall_toolpaths. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:30` |
| 2026-08-15 | ~~External-perimeter width is preserved for surface quality - never redistributed by beading - a deliberate Ferrislicer override of Orca intent.~~ **REPEALED 2026-08-18 by Gabe** - see the group summary. | `docs/superpowers/specs/2026-08-15-scenario-fixture-catalog-design.md:26` |
| 2026-07-08 | Degrade, don't crash: on degenerate geometric inputs, recover gracefully via debug_assert plus skip/fallback; never panic in release builds. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:34` |
| 2026-08-18 | External-perimeter width is NOT fixed: the local centreline section is the width authority for every bead, the outermost included, so Arachne matches Orca. `outer_wall_line_width` is a target - a thin section legitimately yields a narrower outer bead (face clamped to `min(thickness/2, outer)`), a closing section a wider one (even split, bounded by `(1 + split_threshold) x outer`). Neither is a defect and neither warrants a warning. | `crates/fs-arachne-voronoi/src/beading.rs:48` |

Enforcement removed with the rule: Gabe's disposition on 2026-08-18 was REMOVE, so the fixture-catalog entry `w1-external-width-preserved` (`Check::ExternalWallMatchesAxis { tol_mm: 0.001 }` across N04/N06/N05_GABE) is deleted, with a removal note left at the site (`crates/fs-fixtures/src/lib.rs:195`). Nothing replaced it. External wall width is therefore UNCOVERED by the catalog as of that date, and deliberately so — a replacement contract has to derive its expectation from the fixture's own cross section, and until one is written that way the honest state is uncovered rather than covered by a stale assertion.

The two entries built as consequences of the override (wave-1 inventory rows 2 and 32) were REFRAMED on 2026-08-18 rather than removed, because what each measures survives the repeal - only what each CLAIMED did not. `w1-small-island-external-width` no longer says the override keeps external width fixed; it says a 1.5 mm ribbon's section is thick enough to earn the nominal outer width, which is the centreline-authority rule's own prediction rather than an exception to it, and it drops its `deviates` claim. `w1-wall-widths-never-redistribute` is renamed `w1-classic-wall-widths-are-nominal`: exact widths are a property of the CLASSIC generator - its sole axis N04 is `wall_generator=classic` - never a law of the engine, and under Arachne the same ladder should show section-dependent widths and this contract would rightly fail. It also drops its `deviates` claim, since classic offset loops behave the same way in Orca.

Coverage this leaves genuinely uncovered, stated rather than papered over: no entry exercises external width on a section too thin to earn the nominal width, at any Arachne axis. That is the case the repealed rule was hiding, and the case a section-derived contract must be written for.

## 🟢 Safety — forbid unsafe

Two agreeing statements: use #![forbid(unsafe_code)] (never the allow-overridable deny) so future unsafe is a hard compile error, and the Arachne crate keeps it explicitly.

The only sanctioned unsafe lives in the Android-only crate (see the crate-split group).

| Date | Rule | Source |
|---|---|---|
| 2026-06-25 | Use `#![forbid(unsafe_code)]`, never `#[allow]`-overridable `#[deny(unsafe_code)]`, so any future unsafe code anywhere in the tree is a hard compile error. | `docs/dev/unsafe-audit.md:41` |
| 2026-07-08 | The fs-arachne-voronoi crate must keep #![forbid(unsafe_code)]. | `docs/superpowers/plans/2026-07-08-arachne-full-island-rewrite.md:29` |

## 🟢 Infill — connected pattern behavior

Four agreeing rules from one design: unimplemented pattern keywords are blocked loudly (never aliased to Grid), connector gates keep turn-arounds from chording across voids, the monotonic sweep sense never reverses, and a missing object anchor degrades to region-anchored rectilinear output.

| Date | Rule | Source |
|---|---|---|
| 2026-06-28 | An infill pattern keyword that is not yet implemented must never be silently mapped to a different pattern (e.g. aliased to Grid); it must be blocked loudly instead. | `docs/superpowers/specs/2026-06-28-infill-monotonic-family-design.md:17` |
| 2026-06-28 | Connected monotonic and zigzag fill functions must keep the connector_inside gate so a turn-around segment never chords across a void in a concave region. | `docs/superpowers/specs/2026-06-28-infill-monotonic-family-design.md:252` |
| 2026-06-28 | The connected monotonic fill must never reverse its sweep sense; each subsequent span is entered at whichever end is nearer the current head, but the traversal direction stays constant. | `docs/superpowers/specs/2026-06-28-infill-monotonic-family-design.md:255` |
| 2026-06-28 | When no consistent (object-wide) anchor is supplied, zigzag_fill must produce output identical to the region-anchored rectilinear_fill, so a missing object bounding box degrades gracefully. | `docs/superpowers/specs/2026-06-28-infill-monotonic-family-design.md:258` |

## 🟢 Engine — speed clamp ordering

Two agreeing halves of one contract: the volumetric-speed clamp uses the geometric cross-section and applies first; the cooling/min-layer-time factor may only slow further, never speed past the ceiling.

| Date | Rule | Source |
|---|---|---|
| 2026-06-28 | The volumetric-speed clamp must be applied first (lowering the nominal speed), and the subsequent cooling/min-layer-time factor may only slow it further, never speed it back up past the ceiling. | `docs/superpowers/specs/2026-06-28-max-volumetric-flow-design.md:198` |
| 2026-06-28 | The max-volumetric-speed clamp must use the geometric extrusion cross-section (not the flow-ratio-scaled E amount), and must be applied before the min-layer-time slowdown factor so layer time reflects the clamped speeds. | `docs/superpowers/specs/2026-06-28-max-volumetric-flow-design.md:55` |

## 🟢 docs/learning — course authoring

Agreeing authoring law: derive before use, exactly eight macro-built sections per chapter, globally unique labels, prerequisites cite only earlier chapters, no inline styling, and generated chapters pass hard machine checks before acceptance.

| Date | Rule | Source |
|---|---|---|
| 2026-06-26 | Cross-reference labels are globally unique across the whole course; the same label must never be reused in two chapters. | `docs/learning/AUTHORING.md:101` |
| 2026-06-26 | A chapter's prerequisites clause may cite only earlier chapters; a forward reference belongs in prose or in what the chapter establishes, never in its prerequisites. | `docs/learning/AUTHORING.md:102` |
| 2026-06-26 | Chapter text must never set fonts, colours, or sizes inline; the shared preamble alone owns all styling. | `docs/learning/AUTHORING.md:110` |
| 2026-06-26 | An automatically generated chapter must satisfy hard, machine-checked requirements (structure, labels, balanced braces, resolvable references, an accurate walk of the cited source) before the verifier accepts it. | `docs/learning/AUTHORING.md:127` |
| 2026-06-26 | Derive before use: never invoke a mathematical or geometric result in the course text before it has been built from already-established atoms. | `docs/learning/AUTHORING.md:16` |
| 2026-06-26 | Every course chapter must contain exactly the eight standard sections, each written via its dedicated macro and never as a raw `\section`. | `docs/learning/AUTHORING.md:65` |

## 🟢 docs — mapping passes

Agreeing method rules for the pipeline contract map: the map updates in the same change as every fix (stale map = failing test), passes are uniformly shallow and finish in one sitting, every row carries its source, no defect organizes a reading pass, unverified facts stay absent, and forward and backward directions advance together. The design-decision register itself joined this family on 2026-08-15: same-commit updates, durable home first, RULE:-prefixed dictation captured mechanically. Contrast § Governance — decision records, below: that group's ADRs are the deliberate opposite of a living document — frozen once Accepted rather than kept current.

| Date | Rule | Source |
|---|---|---|
| 2026-08-09 | Each mapping pass must be shallow enough to finish in one sitting; ragged (one part written deep beside many left blank) is worse than uniformly shallow. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md` § Rules that keep it finishable |
| 2026-08-09 | Every row of a mapping/analysis document must carry its source location, so continuation costs nothing and a claim can be rechecked when either side moves. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md:180` |
| 2026-08-09 | No defect may be used as an organizing principle for a reference-reading pass; steps are covered in the pipeline's own order, not in the order a bug makes them look relevant. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md:182` |
| 2026-08-09 | A pass must declare a depth limit up front and record only what that pass verified; an unverified fact is left absent, never guessed, in both prose and models. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md:186` |
| 2026-08-09 | Forward and backward analysis directions must advance together as one artefact at one depth; a pass is not complete if only one direction has progressed. | `docs/superpowers/specs/2026-08-09-orca-pipeline-contract-map.md:192` |
| 2026-08-12 | Every bug fix and implementation must update the pipeline contract map (and, when config keys or feature gaps moved, the alignment data and pipeline page) in the same change; a merged change that contradicts the map is treated like a failing test. | `CLAUDE.md` § The map is living documentation (HARD RULE) |
| 2026-08-15 | The register updates in the same commit as any rule change (durable home first; the register cites, never originates); dictated rules use the RULE: prompt prefix and block commits until filed or dismissed. | `CLAUDE.md` § The map is living documentation (HARD RULE) |

## 🟢 Process — issue tracking

Two agreeing rules: every piece of work gets an engineer-stranger GitHub issue with exactly one Context sub-issue for AI pickup; findings become new ticket pairs added-linked to the campaign (never sub-issues), and every commit carries its GIT_<n> marker.

| Date | Rule | Source |
|---|---|---|
| 2026-08-03 | Every new piece of work gets an engineer-stranger-compatible GitHub issue, and every campaign keeps a ledger of what changed and whether it worked; learnings ship versioned alongside the commit/worktree that produced them. | `CLAUDE.md` § Tracking work |
| 2026-08-03 | Every ticket has exactly one "Context:" sub-issue reserved for AI pickup context; new findings, epic chapters, and follow-ups are always their own new ticket pair, never a sub-issue of the campaign, and every commit message carries a GIT_<number> marker for its issue. | `CLAUDE.md` § Tracking work |

## 🟢 Process — user-audit handling

Two agreeing rules about the user's bug list: audit items are never marked fixed until the user confirms the behavior visually, and their descriptions are never rewritten.

| Date | Rule | Source |
|---|---|---|
| 2026-07-07 | Do not mark a user-audit item fixed until the user confirms the behavior visually. | `docs/superpowers/plans/2026-07-07-arachne-reference-matrix-harness.md:13` |
| 2026-07-07 | Do not rewrite USER_AUDIT.md bug descriptions. | `docs/superpowers/plans/2026-07-07-arachne-reference-matrix-harness.md:14` |

## 🟢 Verification — a measurement's scope is part of its claim

The general form of a shape that had been recorded only as instances. A measurement
whose SCOPE differs from the claim it is used to support is not weak evidence, it is
evidence for a DIFFERENT QUESTION — and it is indistinguishable, at a glance, from
evidence for yours. Four cases landed in one day (2026-08-26), across a gate, a checker,
a red-check and a grep, every one green and plausible. The discriminating question is
WHY the result looks like that, never WHETHER it does.

Sibling groups hold the domain-specific instances and keep their rows: Diagnostics —
probes and traps (probe shape, denominator, explicit zeros) and CI — gate integrity
(measured passing on the commit that adds it, baselines deliberately updated). This
group states what they have in common, for the cases neither covers — a grep, a diff,
a subagent's enumeration.

| Date | Rule | Source |
|---|---|---|
| 2026-08-26 | A measurement states what it COULD see in the same breath as the claim it supports; scope that differs from the claim is evidence for a different question. | `CLAUDE.md` § A measurement's scope is part of its claim |
| 2026-08-26 | `git diff` / `git show` without `-w` is not a diff of the CODE: a line rewritten with different whitespace appears on both sides, so a grep over added lines counts an unchanged line as new. `-w --stat` is the discriminator — deletions collapsing to zero is the tell. | `CLAUDE.md` § A measurement's scope is part of its claim |
| 2026-08-26 | A subagent's stated confidence is not coverage: an enumeration returned 21 rows at CERTAIN where the file held 22. Verify the COUNT independently, because a complete-looking table is not evidence of completeness. | `CLAUDE.md` § A measurement's scope is part of its claim |
| 2026-08-28 | A gate that computes a working subset of the tree must print its own denominator on every run, and a merge gate must never trust merge-parent order alone (diff against both parents, or resolve the pre-merge tip directly) — a fifth instance of this section's shape, specialized to gates. | `CLAUDE.md` § A measurement's scope is part of its claim |
| 2026-08-29 | A clean check does not shorten the list: what a change requires is enumerated BEFORE the first check runs, and a pass on one check never cancels another — a positive result is the most dangerous place to stop, because stopping feels earned. Names what three of this group's four 2026-08-26 instances actually share (a clean PASS stopping the inquiry), distinct from `git diff -w`'s genuinely-wrong-instrument case, which stays the odd one out. Gabe's framing (proposed as "never short circuit full due diligence"), narrowed to a checkable form. | `CLAUDE.md` § A measurement's scope is part of its claim |

## 🟢 CI — gate integrity

Agreeing rules that keep gates honest: every gate is measured passing on the commit that adds it (a not-yet-passable check is recorded debt), flakes are fixed at root cause (never retried around), the toolchain is pinned explicitly, feature gates limit shipping but not verification builds, a red gate everyone ignores protects nothing (assert against a deliberately-updated baseline), regression censuses record magnitude not just presence, a gate script must let its sub-checks' own evidence reach its stdout rather than swallowing it in a per-gate log, a long-running tool proves it is still alive on a standard, filter-surviving heartbeat rather than going silent until it finishes, and a docs-shaped commit staging a newly-tracked non-doc file draws an advisory naming the suspected wildcard-add sweep.

| Date | Rule | Source |
|---|---|---|
| 2026-07-29 | The Rust toolchain version is pinned explicitly in the CI workflow (not `stable`, not via rust-toolchain.toml), and bumping it is a deliberate, visible one-line commit. | `docs/ci.md:128` |
| 2026-07-29 | Every CI gate must be measured passing on the commit that added it; a check that cannot pass yet is recorded as debt rather than turned on to fail. | `docs/ci.md` § The governing rule |
| 2026-07-29 | A known test flake must be fixed at its root cause; do not paper over it with a retry, a rerun-failed action, #[ignore], or --test-threads=1. | `docs/ci.md` § The governing rule |
| 2026-07-29 | A feature gate that limits what ships must not also limit what gets compiled during verification; keep the gate for dependency weight but build all features when verifying. | `docs/config-wiring-audit.md:131` |
| 2026-07-30 | A regression gate that is red and that everyone learns to ignore protects nothing; a gate must assert against a known, deliberately-updated baseline instead. | `docs/refactors/same-layer-overlap.md:84` |
| 2026-07-30 | A regression census must record magnitude, not just presence or count, or a defect can double in place while the gate stays green. | `docs/refactors/same-layer-overlap.md:90` |
| 2026-08-28 | A merge/CI gate script that redirects a sub-check's output to a log file must at minimum echo that sub-check's own denominator line to its own stdout, not only pass/FAIL. | `CLAUDE.md` § A gate script echoes its sub-check's denominator |
| 2026-08-28 | A long-running tool emits a standard, uniform heartbeat line at a bounded interval while still running, upstream of any per-gate log redirect and surviving the quiet output filter, so the main agent can treat silence as dead/hung rather than "probably still working." | `CLAUDE.md` § A long-running tool emits a heartbeat the main agent knows to look for |
| 2026-08-30 | An otherwise docs-shaped staged set that includes a newly-tracked file outside CLAUDE.md/docs/ draws a pre-commit ADVISORY naming the file with its denominators (never blocking), because that shape is the wildcard-add sweep signature and the commit-time pathspec guard is skipped precisely on repetitive docs commits. | `CLAUDE.md` § Worktrees |

## 🟢 Governance — decision records

This group is § docs — mapping passes' opposite pole, not a member of it: the map and the register are LIVING documents kept current with the code; an ADR is a dated ruling that is supposed to go stale. Filed under #630.

| Date | Rule | Source |
|---|---|---|
| 2026-08-28 | An ADR is a dated ruling, not a policy manual: once Accepted its body is frozen (only a status transition or a trivial, decision-preserving correction may edit it); a decision change lands as a new, superseding ADR that also flips the old ADR's status line, never as an in-place edit. | `docs/adr/README.md:3` |

# Solo rules, by area

Rules with no sibling bearing on the same decision - no common thread beyond
their area. Standing as written. Sorted by blame date within each area.

## Solo — Engine and slicing

| Date | Rule | Source |
|---|---|---|
| 2026-06-18 | The engine programs against Fill and PerimeterGenerator strategy traits, not concrete types, so new strategies register without changing engine code. | `docs/adr/0004-extension-points-strategy-traits.md:18` |
| 2026-06-18 | Extension points use compile-time trait objects and a thin registry, never a dynamic-library plugin system, to preserve determinism. | `docs/adr/0004-extension-points-strategy-traits.md:89` |
| 2026-06-28 | A pressure-advance calibration band's K value must be clamped to a minimum of zero so the band never silently disables PA emission via the negative-K empty-string code path. | `docs/superpowers/specs/2026-06-28-calibration-generators-design.md:99` |
| 2026-06-28 | The spatial index (grid) that combing's crossing test relies on is part of the feature itself, not an optional later optimization. | `docs/superpowers/specs/2026-06-28-combing-travel-avoidance-design.md:195` |
| 2026-06-28 | A quality-improving geometric transform that cannot maintain its safety or quality invariant (e.g. a warp that would collide or would not improve fidelity) must fall back to the unmodified baseline rather than emit an unsafe or worse result. | `docs/superpowers/specs/2026-06-28-non-planar-slicing-design.md:172` |
| 2026-08-03 | Each of the engine's three passes (slice, walls, fill) must complete for every layer before the next pass starts, because most slicing decisions depend on layers other than the current one. | `docs/SLICER_ARCHITECTURE.md:45` |

## Solo — GUI

| Date | Rule | Source |
|---|---|---|
| 2026-06-17 | The GUI is modeled as higher-level visual/semantic components reproducing the original's visual design, never a 1:1 widget-by-widget translation. | `docs/adr/0003-parallel-porting-and-gui-vision.md:45` |
| 2026-06-24 | Adding support for new input hardware must be strictly additive; existing input bindings must remain untouched. | `docs/superpowers/plans/2026-06-24-spacemouse-support.md:16` |
| 2026-06-24 | The per-segment kinematic lookahead annotation must be cached and must not be recomputed every frame. | `docs/superpowers/specs/2026-06-24-sp4-live-preview-design.md:86` |
| 2026-06-24 | SpaceMouse support must be strictly additive: existing mouse bindings stay untouched and the app must run identically when no SpaceMouse device is present. | `docs/superpowers/specs/2026-06-24-spacemouse-support-design.md:4` |
| 2026-06-26 | A calculated/derived config value must render with a distinct read-only indicator and must not be directly editable, since it has no settable key of its own. | `docs/superpowers/plans/2026-06-26-m3-gui-holds-hub.md:9` |
| 2026-06-27 | The UI must be schema-driven, not hand-coded: generated from the schema/layout, never patched with hand-coded special cases. | `docs/superpowers/specs/2026-06-27-inc3-config-parity-design.md:33` |
| 2026-07-08 | The navigation binding left=manipulate, right=orbit must be respected and not changed. | `docs/superpowers/plans/2026-07-08-paint-on-feature.md:19` |
| 2026-07-09 | The settings-search/restructure work must be pure UI: no engine or G-code changes, and existing slicing goldens must be unaffected. | `docs/superpowers/plans/2026-07-09-settings-search-and-restructure.md:13` |
| 2026-07-09 | Print Settings, Printer, and Filament must remain three independently-dockable panes; do not consolidate them. | `docs/superpowers/plans/2026-07-09-settings-search-and-restructure.md:14` |
| 2026-07-09 | Settings search results must reuse the existing config_field renderer and page/metadata sources rather than forking a parallel rendering path. | `docs/superpowers/plans/2026-07-09-settings-search-and-restructure.md:17` |
| 2026-07-09 | A settings section card's hover/active lift must be shadow-only; its background, border, and accent color must never change. | `docs/superpowers/plans/2026-07-09-settings-search-and-restructure.md:18` |
| 2026-07-09 | Settings section cards use greedy/sticky selection: clicking anywhere in a card makes it the single active card until an outside click, with at most one active card per pane, independent of keyboard focus. | `docs/superpowers/plans/2026-07-09-settings-search-and-restructure.md:19` |
| 2026-07-09 | Settings search must be tiered: name matches (label/full_label/key) rank above description (tooltip-only) matches, and each key appears once in its highest-ranking tier. | `docs/superpowers/plans/2026-07-09-settings-search-and-restructure.md:20` |
| 2026-07-09 | Reading-accessibility cues must use color and border together, never color alone. | `docs/superpowers/specs/2026-07-09-settings-search-and-restructure-design.md:27` |
| 2026-08-03 | GUI layout must be validated against the actual rendered result, not assumed from markup, with every interactive element fully visible at all supported viewport sizes; controls must be positioned adjacent to and move with the element they act on. | `CLAUDE.md` § Design (### GUI) |
| 2026-08-03 | A GUI viewport size verdict is only meaningful when stated in points, never in raw pixels, because the OS DPI scale factor makes the two disagree. | `docs/gui-audit/README.md:33` |

## Solo — Config

| Date | Rule | Source |
|---|---|---|
| 2026-06-21 | Every cutover step of the config-hub migration must be gated by an equivalence test proving the new path produces byte-identical EngineConfig/SliceParams to the old hand-mapped path before that old path is deleted. | `docs/superpowers/specs/2026-06-21-config-hub-architecture-design.md:124` |
| 2026-06-27 | Codegen must always write LF line endings, never CRLF, and every codegen regeneration diff must be additive and value-neutral, verified by the oracle gate. | `docs/superpowers/specs/2026-06-27-config-gui-usability-fixes-design.md:98` |
| 2026-06-27 | A per-extruder key found outside its named extruder section (e.g. in the preamble) is a hard load error, and a machine-global key found inside a named extruder section is likewise a hard load error. | `docs/superpowers/specs/2026-06-27-per-extruder-data-model-design.md:104` |

## Solo — Geometry and numerics

| Date | Rule | Source |
|---|---|---|
| 2026-07-30 | A hardcoded exact/no-rounding tolerance in production code must represent a deliberate decision, never merely fill a required argument. | `docs/refactors/promote-resolution.md:104` |

## Solo — Platforms and builds

| Date | Rule | Source |
|---|---|---|
| 2026-07-10 | The Android .so must be cross-compiled with cargo-ndk before running any ./gradlew assemble* task, since Gradle only stages the prebuilt library. | `android/README.md:12` |
| 2026-07-10 | The Android cdylib lib name, the manifest's android.app.lib_name, and the .so filename must all stay in sync, and the net.nydick.ferrislicer package id must never be changed independently. | `android/README.md:27` |
| 2026-07-10 | The standalone wgpu dependency version must match the wgpu major version that egui-wgpu re-exports; bump the wgpu pin in lockstep whenever egui/eframe is bumped. | `docs/ANDROID-HANDOFF.md:104` |
| 2026-07-10 | Android build artifacts (jniLibs/**, app/build/**) are gitignored and must never be committed. | `docs/ANDROID-HANDOFF.md:117` |
| 2026-07-10 | The Android port must keep egui as the GUI toolkit; no Kotlin/Compose UI. | `docs/ANDROID-HANDOFF.md:21` |
| 2026-07-10 | mimalloc is gated off on Android (`cfg(not(target_os = "android"))`); Android uses the default libc allocator. | `docs/adr/0007-android-tablet-port.md:41` |
| 2026-07-18 | The desktop GUI must keep its console window (stderr diagnostics are wanted); never set windows_subsystem = "windows". | `docs/BUILDING.md:22` |
| 2026-07-22 | When a platform-specific capability (such as running post-processing scripts) cannot be supported everywhere, the gap must be decided and surfaced explicitly, never papered over by wiring the desktop-only mechanism in unconditionally. | `docs/platform-divergence-audit.md:28` |
| 2026-07-22 | The platform config-base directory must be resolved once from the injected file-access seam and handed to every consumer, so no new consumer can introduce its own environment-variable-only path. | `docs/platform-divergence-audit.md:80` |
| 2026-08-25 | WSL is not used in this project until otherwise stated: the POSIX shell is Git Bash and nothing invokes `wsl.exe` or runs under a WSL distro. Bare `bash` resolved by PATH is not Git Bash — Windows' WSL launcher stub at `System32\bash.exe` answers first for `subprocess`/`Command::new` callers and exits 1, which made a clean file report as a syntax error (measured 2026-08-25). Tools resolve a real bash explicitly, rejecting `System32`/`SysWOW64`/`WindowsApps` candidates, and FAIL LOUDLY naming what they looked for rather than skipping — a skipped check reads as a pass (Gabe). | `CLAUDE.md` § No WSL |

## Solo — Access control

| Date | Rule | Source |
|---|---|---|
| 2026-07-21 | Every access-control decision must be enforced server-side; a client-side check is UX only, never enforcement. | `docs/SLICER_FEATURE_TODO.md:1960` |

## Solo — Process and method

| Date | Rule | Source |
|---|---|---|
| 2026-06-18 | Before any hardware/print test, treat every first run as untrusted and keep a hand on the printer's power switch, since a slicer bug can crash the nozzle into the bed or over-extrude. | `docs/superpowers/specs/hardware-test-plan.md:7` |
| 2026-06-20 | New crates depend only on the stable foundation crates, never on sibling in-progress crates, so a batch has no inter-agent dependencies. | `docs/adr/0003-parallel-porting-and-gui-vision.md:30` |
| 2026-07-02 | Structural changes to a shared core type like PrintPlan require cross-lane sign-off via the shared-seam register before landing. | `docs/superpowers/specs/2026-07-02-internal-cavity-support-warn-design.md:41` |
| 2026-07-03 | Each refactor task must first move existing code into its new module with no behavior change (tests still green), and only then generalize the behavior. | `docs/superpowers/plans/2026-07-03-fs-meshbool-kernel.md:44` |
| 2026-07-03 | New gated features follow a standing convention: the new crate owns the math, seams elsewhere are minimal and gated, accessors are tolerant and default off, and new self-goldens are gated rather than added to the protected set. | `docs/superpowers/specs/2026-07-03-belt-printer-support-design.md:90` |
| 2026-07-03 | Adding any new external crate dependency requires stopping and getting explicit user authorization first. | `docs/superpowers/specs/2026-07-03-fs-meshbool-kernel-design.md:20` |
| 2026-07-09 | Commodity plumbing must reuse an existing generator's public entry point rather than forking or reimplementing it. | `docs/superpowers/specs/2026-07-09-support-pattern-completion.md:138` |
| 2026-08-10 | A verification gate is mandatory: a proposal that does not survive automated checks (build, tests, the relevant metrics, parity) is discarded without being read. | `docs/superpowers/specs/2026-08-10-invariant-map.md` § 2. The map — one file per function, generated by a local model |
| 2026-08-22 | A test that guards an algorithm's complexity asserts the algorithm's own work census (operations performed against the entitlement the input census buys), never a wall-clock ceiling — on a shared runner a stopwatch measures the runner, and it cannot distinguish a loaded machine from a quadratic loop. A generous wall clock may remain as a hang backstop, never as the verdict; the census is asserted with a positive control, because a measured thing that never ran satisfies any upper bound for free. | `docs/dev/traps.md` § A convergence gate asserts WORK, not seconds (GIT_343) |
| 2026-08-06 | Two-strike rule: when one agent's approach on a problem fails more than once, the collaborating agent's suggestion takes the next attempt - counted honestly and symmetrically (Gabe's rule, Codex collaboration). | `docs/dev/codex-collab-digest-2026-08-06.md:191` |
| 2026-08-07 | Campaigns start only on the human's explicit go given directly to the agent that will run them; a relayed authorization never counts. | `docs/dev/codex-collab-digest-2026-08-06.md:238` |
| 2026-08-14 | Every claim must carry its verification status (measured with evidence, or explicitly labeled a belief); "I don't know" must be said the instant it's true; deviations from an agreed plan must be announced before they happen; failures and regressions must be reported immediately at full strength; and attribution of "X caused Y" requires the bisect/toggle that isolated X. | `CLAUDE.md` § Be straightforward (HARD RULE) |
| 2026-08-26 | Communication is maximally concise without losing meaning; reach for a plain analogy instead of technical/computational-geometry vocabulary in user-facing text — precision vocabulary stays in commits, issues, and code comments. | `CLAUDE.md` § Be concise, and explain with analogies |
