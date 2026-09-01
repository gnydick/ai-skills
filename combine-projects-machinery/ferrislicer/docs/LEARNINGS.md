# Engineering notebook — learnings and discoveries

Dated entries, appended in the same commit as the work that produced them and
managed like any source file; the git history of this file is the record of how
understanding evolved. Each entry is self-contained: what prompted it, what was
done, what was observed, what we conclude. Defect status lives in GitHub
issues; specs and plans state intent; this notebook states what reality
answered. Work is fully recorded only when both sides exist.

---

## 2026-08-01

### 1. A producer offers the ground it tiles

**Prompted by:** a deposit-based overhang test (issue #6 work) flagged walls
printed over sparse infill as unsupported — thousands of spans on setback
walls sitting ~0.9 mm inside the lower layer's outline, i.e. over lattice
interior.

**Method:** swept every extrusion's footprint and diffed each wall bead
against the union of the layer below's swept material.

**Observation:** a wall crossing a sparse lattice cell genuinely has air under
most of its bead — the exact diff reports it faithfully — yet such walls print
fine and no slicer treats them as overhangs.

**Conclusion:** support is a claim about the ground a producer TILES, not the
ground its beads literally cover. Sparse lattice anchors anything above its
whole fill region; its line pitch is that claim, so its support footprint is
its paths swept at PITCH. Dense fills and walls tile at (overlapping) bead
width, so width already states their claim. Encoding this removed the
walls-over-sparse false class entirely.

### 2. Spacing footprints and width footprints answer different questions

**Prompted by:** ~80k phantom "overhang" slivers on perfectly stacked
vertical walls, each 0.02–0.05 mm deep.

**Method:** the footprint sweep initially reused the same-layer overlap
auditor's convention: beads swept at flow SPACING (`w − h(1−π/4)`), which is
correct for asking whether two beads on ONE layer claim the same ground
(adjacent lines are laid one spacing apart precisely so their beads squash
together; spacing footprints of correct fill share a boundary, no interior).

**Observation:** spacing under-reaches the physical bead by the squash margin
(~0.03 mm/side at width 0.45, height 0.2). Diffing a width-swept bead against
spacing-swept support manufactures a sliver of exactly that margin along every
wall. Flag count dropped 80,644 → 76,736 when the support side swept at width.

**Conclusion:** same-layer tiling questions use spacing; cross-layer physical
support questions use width. One sweep convention cannot serve both.

### 3. Geometry cannot testify below its simplification tolerance

**Prompted by:** residual slivers narrower than ~0.025 mm after entry 2.

**Method:** inspected the pipeline's resolution handling: wall polylines and
boolean outputs are simplified at `slice_resolution_mm` (default 0.0125), and
consecutive layers simplify the same shape with different vertex phases.

**Observation:** exact diffs between two representations that are each only
±tolerance-accurate report phantom features up to twice the tolerance.

**Conclusion:** declare the measurement floor instead of chasing it: a
morphological opening (erode+dilate by the stated tolerance) removes what the
geometry pipeline cannot legitimately assert. Anything surviving the opening
is above the declared accuracy and therefore real.

### 4. Concentric wall rings leave real diamond voids at sharp corners

**Prompted by:** ~65k residual sliver flags clustering as ~0.15 mm blobs at
polygon corners. Rather than theorize further, one case (an octagon turret
corner) was dumped as an SVG: subject bead, lower-layer material, uncovered
remainder.

**Observation:** the uncovered piece was bounded by the lower inner ring's
corner arc (radius w/2 about its corner vertex) and the outer ring's
coverage. Two concentric rings with widths 0.40/0.45 laid at proper spacing
are exactly tangent along straight runs, but at a sharp corner their
centerline corners sit ~0.60 mm apart diagonally while the two corner arcs
reach only 0.20 + 0.225 = 0.425 mm — a diamond-shaped void (~0.01 mm²,
~0.22 mm extent) exists at EVERY sharp corner of every wall pair. It is real
printed-part geometry, not a computation error.

**Conclusion (two):** (a) corner voids between concentric perimeters are a
structural fact of constant-width beads; (b) a void a bead can span in EVERY
direction — maximum extent at most one bead width — does not unsupport the
bead crossing it: the bead re-anchors on both sides within one bead length.
Filtering uncovered pieces by that criterion (threshold = the bead's own
width, no invented constant) removed the class: 74,470 → 17,556.

### 5. The first quarter-bead over air is anchoring grace

**Prompted by:** the remaining ~17k flags were dominated by 0.0500 mm-wide
strips running whole wall lengths at repeating heights.

**Method:** cross-referenced the source model: the reference city is
generated from stacked modules, and at module seams the footprint steps by
0.05 mm — a real modeled micro-ledge (verified: horizontal facets at exactly
those Z in the STL). 0.05 mm is 12.5% of the bead. OrcaSlicer does not band
such ledges; translating its geometry: libslic3r's degree-0 boundary sits
0.25·w INSIDE the support with a 0.75·w range, which in strip terms means
classification begins at 25% of the bead over air.

**Observation:** banding from the raw strip fraction had begun classification
at 10% — more sensitive than the reference slicer — and the 12.5% ledge class
sat squarely in the difference. Adopting the 25% grace: 17,556 → 2,957, and
every audited residual traced to real model geometry (chamfers, ledges,
floating tips).

**Conclusion:** squish anchors the first quarter-bead; the empirical grace in
libslic3r's banding is a physical claim, and translating a reference
implementation's thresholds means translating the GEOMETRY they encode, not
just copying numbers.

### 6. Flow compensation moves the printed surface, not the centerline

**Insight contributed during design review (Gabe).** On undersides
approaching horizontal, slicers extrude MORE so the unsupported strip still
bonds. The added width advances the bead's OUTER edge beyond the centerline
step: `surface_step = centerline_step + Δw/2`. The printed underside
therefore tilts closer to horizontal than any centerline-derived measure
shows — and a classifier fed one nominal width cannot see this even in
principle, because the information (per-path actual width) is absent from its
input. Any honest overhang measure must consume actual per-path widths.

### 7. Take the model literally before blaming the pipeline

Generated models carry real micro-geometry that mimics slicer error: the
reference city has genuine 0.05 mm ledges at module seams and 33.4° chamfered
plinths — both verified by reading facets from the STL at the flagged
coordinates (a ~30-line probe). Hours of "phantom overhang" hunting ended at
geometry that was really there. Verify the mesh at the flagged location
before assuming the pipeline invents features.

### 8. The centerline-vs-outline overhang proxy fails in both directions

**Method:** instrumented the classifier at its own call site (entry 10),
capturing every classified-but-near-vertical span with the classifier's own
inputs, then walked checkpoints upstream: classification math → engine input
→ slice boundaries → mesh facets.

**Observation:** all four checkpoints were internally consistent — and that
was the finding. On a real 33.4° chamfer the classifier reported a 12.5°
"near-vertical" lean, because lean derives from the banded distance whose
origin sits 0.25·w inside the support, not from the surface. It fires while
the centerline is still 0.068 mm INSIDE the lower outline — where
OrcaSlicer's outside-grown-lower rule stays silent — producing ~4.8× Orca's
classified span length. Meanwhile (entry 6) it cannot see flow-compensated
steep undersides at all.

**Conclusion:** the proxy over-tags mild chamfers and under-measures steep
undersides simultaneously. The agreed replacement contract: the ANGLE is a
property of the designed surface, read from the mesh — noting facet normals
are themselves samples that BRACKET the true angle on tessellated curves, so
the source is a reconstructed smooth normal field (crease-split patches,
angle-weighted vertex normals, per-answer uncertainty from the local dihedral
spread; file-stored normals are never trusted — recompute from winding).
SUPPORTEDNESS is a property of the deposited material below, which alone sees
flow compensation, dropped walls, and support material. Implementation tiers
honestly: classical normal field first (exact on flat facets — the entire
observed defect class), jet-fitting behind the same interface only if
measurements demand it.

### 9. A classifier whose gate rides a noisy measurement will stripe

**Negative result — two rejected implementations** (post-mortem:
`docs/refactors/overhang-truth.md`). The deposit-strip classifier striped
visually because the dominant real geometry (0.132 mm chamfer strips) sits
exactly at the 25%-grace threshold (0.100 mm at w = 0.40): measurement noise
flips whole runs across the classify line per layer. Moving the BAND VALUE to
the smooth mesh angle did not cure it — WHETHER a run classifies still gated
on the noisy strip, so the stripes lived in the split structure.

**General law:** stabilizing outputs is useless while the decision boundary
itself rides noise at its operating point; hysteresis or a smooth gate input
must cover the noise band, or the geometry class at the threshold will
flicker.

### 10. Trap at generation; post-hoc probes can lie

**Method contributed by Gabe.** When a downstream artifact has a precise
signature (here: classified + near-vertical, the debug renders' red overlay),
turn the signature into a conditional capture at the site that GENERATES the
artifact, recording the generator's own inputs; then move the trap one stage
upstream at a time. Data at the trap consistent with the bad outcome means
the problem is upstream; clean at the trap but wrong downstream convicts the
stage between.

**Validated immediately:** an earlier post-hoc probe had reported flagged
points "0.67 mm inside support" — an artifact of approximating span midpoints
by endpoint chords on curved spans. The at-source capture (true per-sample
distances) showed the worst real sample at −0.095 mm. At-source data
overrides post-hoc reconstruction wherever they conflict.

### 11. A double-write census turns suspicion into a fingerprint

The per-slice "written twice" census (role-pair overlap table in every slice
report) discriminates hypotheses cheaply: identical census totals across two
engine revisions proved a suspected regression was pre-existing; a
SolidInfill×InternalInfill signature with the SAME leak shape through every
supporting solid layer but a DIFFERENT shape at the top layer implies one 2D
region stamped across the stack and transformed once at the top (issue #8).
Shape-through-layers is evidence about the STRUCTURE of the producing code.

### 12. The preview draws plans, not printer behavior

The preview renders only plan polylines; it never draws travel moves. Two
consequences, learned the same evening: (a) any suspicious line visible in
the preview IS a planned extrusion — proven quantitatively when chords at
island entries survived `infill_anchor=0` while 54 m of genuine anchor
extrusion disappeared (the chords are the chained pattern's own connectors,
issue #9); (b) the absence of travel display made that proof cost a full
G-code length-diff analysis instead of a glance (issue #15). Corollary:
chain connectors are part of a pattern's identity, not an anchor setting —
routing them along boundaries is a design change, not a knob.

### 13. Verification practices, each learned from a same-day failure

- Gate on the real user preset stack, not CLI defaults: defaults hid two
  defect families for a day (widths resolved against the wrong nozzle; the
  Arachne family invisible).
- The artifact that counts is the user's own export, not a harness
  reproduction that happens to be clean.
- Aggregate mm² totals miss structure (stacking, continuity, routing):
  render exact-width beads and look.
- Rebuild after merging before measuring; a "defaults drift" mystery was a
  stale binary.
- Verify the binary's write timestamp before judging a GUI build: Windows
  keeps a running exe loaded, the replacement fails with a swallowed
  os error 5, and one UAT verdict was delivered against a stale binary.
- Instruments (census, capture, overlays) must live in the SAME build as the
  changes they verify; splitting them across worktrees produced builds whose
  contents nobody could state (hence the one-worktree rule for interrelated
  defects, now in CLAUDE.md).

### 14. Config values are typed; comparisons and defaults must be too

- Comparing configs means parsing BOTH sides through the registry
  (`set_deserialize`) and rendering both through the one canonical renderer
  (`serialize_value`, enum keywords never ordinals). Comparing raw ini text
  to typed values manufactured "type differences" that did not exist; the
  user preset in question parses 141/141 keys clean.
- A schema default is a VALUE with provenance, not a dash: resolving
  "default" through the provenance mechanism showed the clean baseline runs
  `infill_anchor` at 400% — which cleared "large anchor" as a leak trigger
  and redirected a bisection.
- The canonical primitives exist, but loaders are plural and independently
  assembled; the library resolver cannot even load user presets (issue #14:
  one loader and one writer as the only doors).

---

## 2026-08-07

### 1. Deleting geometry on an unchecked promise (#167)

**Prompted by:** a circular nub where a hairpin belonged, at a sub-two-face
wedge tip on kaleidoscope L37, reported from UAT across three builds.

**Method:** a four-station trace of the #161 composition seam — raw Arachne
output across ALL inset vectors, after the ring-clearance clip, after the
`take(1)` face-channel selection, and the final deposited plan — reusing the
existing default-inert `split_trap` (already layer-aware and already spanning
every vector) rather than adding a second dumping mechanism.

**Observation:** `external_ring_region` DELETES ring pieces standing in
sub-two-face territory, justified by its own doc comment: *"such pieces resolve
via the count logic (their fitted face beads survive the clip because no ring
stands there)."* Measured at the site, Arachne's raw inset-0 line — before any
clip or selection — is 0.5568 mm from the tip at width 0.4778, so its footprint
stops 0.3179 mm short. The receiver never arrives. Ring deleted, nothing
replaced it, 2.1828 mm of bare silhouette 0.8716 mm deep. The prune exists only
on the Arachne path; classic never calls it.

**Conclusion:** a coverage-ownership TRANSFER asserted in prose and never
measured is the same defect as no transfer at all. The fix defers the prune
decision until Arachne's output exists (it runs on `region`, never on
`ring_region`, so nothing it computes changes) and gates removal on a pointwise
witness. Enforced at rung 7: the only shrinking operation consumes a `Transfer`
whose sole constructor is the verifier and which carries the exact geometry it
verified, so an unwitnessed prune does not compile.

Result: 2.1828 mm / 0.8716 mm → 0.8433 mm / 0.3326 mm, landing 0.0002 mm inside
the geometric floor `(w/2)/sin(θ/2) − w/2` for a 50.8° spike, and matching the
congruent twin lobe that was always fine. Model-wide uncovered
3647.5738 → 3509.3059 mm.

### 2. A hard rule stated over the wrong kind of thing

**Prompted by:** finding that the ring at that spike runs 0.6 mm out and back at
a centreline gap of 0.0000 mm — two full-width beads exactly coincident — while
`assert_no_overlap`, the clearance clamp, and the floored-clearance warning all
pass.

**Observation:** the rule is stated over ENTITY PAIRS ("no two DIFFERENT
same-layer extrusions closer than the sum of their half-widths"), and paths
sharing a vertex are unioned into one wall and never compared. Classic does the
same thing at the same site (legs within 0.0987 mm).

**Gabe's argument, which is the general form:** *"it doesn't have to be the same
wall turn around. what's the difference between the same wall turn around and
two degenerate arachne beads that eventually are single thickness ending up
butted up against each other?"* Connectivity is not a physical property of
deposited plastic. Identical geometries get opposite verdicts depending on
whether they happen to share a vertex.

**Conclusion:** not a hole in enforcement — a mis-stated invariant. The
exemption was a proxy for "junctions are legitimate", and it is a bad proxy
because junction-ness is LOCAL while component-ness is GLOBAL. Correct form:
two footprints may overlap only within a bounded neighbourhood of a point they
share, regardless of which entities produced them. That also closes a second
gap the current rule cannot see — a long overlap that merely BEGINS at a
junction, which is exactly what a hairpin is.

**And the rung ladder would not have caught it.** The same day, the #167
contract was raised to rung 7. A perfectly enforced wrong statement is still
wrong. Rung measures bypass-resistance, not whether the claim is the right
claim; check the statement separately from its enforcement.

### 3. Five thresholds downstream of one wrong operand (#177)

**Prompted by:** patchy overhang on uniformly sloped walls, and Gabe's hint that
*"if you look back at our code from a week ago, overhang looked correct on
benchy"* — then UAT confirming `2bddb520` (2026-07-30) was *"fantastic … with the
exception of the long line bleeds"*, and *"it doesn't over-categorize overhang in
the tunnels which we were accepting as a concession."*

**Observation:** `58825ea1` swapped the classification GATE from the previous
layer's slice contour to its DEPOSITED FOOTPRINTS. Deposited footprints are
intrinsically noisy — gaps between beads, seams, width variation. Four commits
followed within days, each adding a threshold to suppress that noise: a
fragment-size floor, mesh-angle severity, a noise-floor boundary move, and the
#83 quarter-bead deadband. A uniform slope sits near all of them at once, and
hard cuts on a noisy measurement produce blocky one-sided patches.

Verified against the reference: OrcaSlicer `PerimeterGenerator.cpp` clips
against `lower_slices` everywhere (`:419` ctIntersection, `:460` ctDifference,
`:912` `diff(infill_area, optimized_lower_slices)`). Deposited footprints are
never the operand. Our DISTANCE measure is faithful; only the GATE diverged.

**Conclusion:** we cited Orca's contract for scope and implemented a different
measurement, then spent five commits containing the consequences. The tunnel
over-classification we had accepted as a tradeoff was an artifact of that
divergence, not a cost of doing it right.

**The general lesson:** when a fix needs a threshold, ask what made the quantity
noisy. Each threshold here individually improved an aggregate and individually
made a marginal case worse. Do not tune a threshold on an operand you have not
verified against the reference.

**Open, and load-bearing for the repair:** the pre-swap code had long line
bleeds, which `32d20d8c` genuinely removed (city false-reds 80,644 → 2,957) — so
reverting is not the fix. Hypothesis on file: a bleed and a patch are the same
run-assembly failure at opposite signs (one sample's verdict propagating across
a run, versus a run fragmenting because neighbours disagree), the same shape as
#141's ribbon, *"one tight sample propagated across healthy ones during
run-merging."* If it holds, the smooth operand plus a corrected merge yields
neither.

#### 3a. Repair, and what the measurement said (#177, same day)

The gate went back to `lower_slices`. All four suppressors were **deleted with
the operand that needed them**, not tuned: the corner-diamond size floor, the
morphological opening, the sparse-lattice pitch sweep, and the #83 quarter-bead
deadband (both copies). The whole first phase of the pass — the deposit "offers"
sweep over every layer's perimeters, infill, thin walls, ironing, brim, skirt and
support — is gone; the classifier reads `LayerPlan::boundary`.

`degree().round()` survived, with a ledger row: it is the run-boundary
quantizer, unchanged in the splitter Gabe UAT'd as *"fantastic"* at `2bddb520`
and matching Orca's integer `overhang_degree`. Its fragmenting was the operand
under it, not the rounding.

**The merge did not need fixing.** The bleed hypothesis was not confirmed, and
did not have to be: with a smooth operand the city's classified-and-near-vertical
count (the bleed metric) went **13 → 5** without touching
`smooth_overhang_degrees`. The longest new degree-5 run on the kaleidoscope
(36.21 mm, layer 42, mesh lean 15.7°) looked like a bleed and was not: aimed at
it, `FS_OVERHANG_TRAP` reports `outline_mm=NaN` at every sample — there is no
lower slice within reach at all. It is a floating island the deposit operand had
been covering, because sparse infill lines swept at their PITCH ballooned past
the slice contour by up to half a lattice spacing. That balloon is why the
deposit gate under-classified, and it is most of the +50 % annotated length.

**Measured, three models, `df9065ef` → the fix** (`zz_overhang_run_histogram`):

| | kaleidoscope | Benchy | castle |
|---|---|---|---|
| one-layer islands (the patchwork) | 3.75 % → **1.44 %** | 19.37 % → **16.15 %** | 13.69 % → **10.38 %** |
| vertical disagreements per annotated mm | 0.95 → **0.74** | 2.15 → **1.47** | 1.41 → **1.02** |
| mean annotated run length | 3.96 → **4.50 mm** | 3.33 → **5.39 mm** | 5.17 → **8.32 mm** |
| annotated length in runs > 10 mm | 790 → **1615 mm** | 707 → **1875 mm** | 2389 → **6492 mm** |

The kaleidoscope — the model in `overhang_patchy.png` — loses 62 % of its
patchwork. A fringe survives everywhere and is inherent: the annotated/
unannotated boundary is a hard cut at `strip == 0.25·w`, so wherever a surface's
slope hovers exactly there, adjacent layers flip. Orca has the same cut. Do not
reach for a hysteresis knob to close it without a differential that shows the
fringe is not the geometry.

**One predicate mismatch noticed and left alone:** the low-pass smoother's
barrier test is `is_speed_banded()` (`degree.round() >= 1`) while the preview and
the writer annotate on `is_overhanging()` (`degree > 0`). A run at degree 0.3 is
therefore invisible to the smoother and visible to the overlay. Orca has the same
split (its speed series and its `erOverhangPerimeter` role flip at different
offsets), so it is deliberate — but it is the exact shape of the "invented
predicates" failure `Overhang` exists to prevent, and it is worth a differential
before anyone calls it correct.

### 4. Method: the differential beat reasoning, five times out of five

Five mechanisms were reasoned into and refuted by measurement in one session:
the area threshold straddling congruent lobes (both pieces measured ABOVE it),
the witness evaluating the wrong counterfactual (it evaluates the right one),
`take(1)` provenance discarding a good bead (no bead reaches the tip at any
station), the fix introducing self-overlap (it pre-existed), and "identical
before and after" (peak was saturated; the EXTENT had changed).

Every advance came from a differential, and each was proposed by the human:
congruent lobes on one layer (killed the geometry explanation), classic vs
Arachne (located the divergence), and a week-old build (located the regression
window). All three were available from the first hour.

Two specific traps worth naming:

- **A max cannot see a new hole shallower than the old worst, and cannot see a
  wider one once saturated.** Reported "no change" from identical peak overlap
  when doubled LENGTH had grown; the same error had earlier hidden a coverage
  regression behind an improving worst-margin. Count arcs, measure extents.
- **Answering a question precisely is a search strategy.** *"Are you still using
  the classic algorithm for the external perimeter?"* could not be answered from
  memory of #161, and reading the function to answer it honestly is what found
  the prune. Several hours of mechanism-first reasoning had not.

---

## 2026-08-26

### 1. A ratchet proves nothing about the defects already inside its baseline (#556)

**Prompted by:** closing the citation sweep of #556, which shipped
`scripts/citation_source_gate.py` as its enforcement and simultaneously recorded
three findings it had chosen not to fix. The question at close-out was whether
the gate made those findings safe to leave.

**Method:** ran the gate on the tree it was built to protect, and compared its
verdict against a citation the sweep had already MEASURED as wrong —
`scripts/fs_config_codegen.py:615` parses OrcaSlicer but stamps CrealityPrint.
The file it reads is `Tab.cpp` under `--src` (`TABCPP` at :426, re-derived in
`main()` at :91-92), and `--src` defaults to `ORCA_SRC` at :72 and :933.

**Observation:** the gate reports OK — 1244 files, 644022 lines, 477 CP-leading
lines across 113 files, exit 0 — with the known-bad line among the 477. It is a
ratchet: it counts CP-leading lines per file against
`scripts/citation_source_baseline.json` and fails only on a RISE. A wrong
citation present when the baseline was recorded is, by construction, invisible
to it. The positive-control self-test passes 6/6, so the gate is not broken; it
is answering a different question than the one being asked of it.

**Conclusion:** a ratchet is a claim about the DERIVATIVE, not the level — it
proves no new defect lands, and says nothing about the ones already there.
Installing one at the end of an audit does not discharge the audit's remaining
findings, and the moment it goes green it starts to READ as if it had. Every
finding a sweep declines to fix needs its own ticket before the sweep closes, or
the green gate becomes the reason nobody looks again. Filed as #562/#563 rather
than left to the gate.

Corollary, from the same site: the defect was never the wrong string. Line :615
hardcodes the source name while :426 derives the parsed path from `--src` — two
facts that must agree, stored twice. They had already drifted on the DEFAULT
invocation. The same file holds the drift-proof shape 486 lines below at :1101
(`f"...from {args.src}"`). Substituting `OrcaSlicer` for `CrealityPrint` in that
constant fixes today's reading and leaves the mechanism that produced it intact.

### 2. Cost estimates inherit assumptions; measure which resource the cost applies to

**Prompted by:** #557 carried an OWED confirmation — a full `merge-gate.sh` run
proving the failing set unmoved — deferred as "not yet run because an agent ran
`cargo clean` mid-sweep (284.8 GiB gone) and the next full build is cold (38-57
min)". That deferral stood for the life of the ticket.

**Method:** read the gate's own header before scheduling the build, then ran it.

**Observation:** `scripts/merge-gate.sh` builds into its own `target-gate/` by
design, documented in that file — concurrent builds from several worktrees into
one target dir were measured on 2026-08-24 to poison Cargo's cache and produce
errors contradicting the source. The `cargo clean` had emptied the main
`target/`. It never touched `target-gate/`, which was still warm. The full run
took roughly three minutes: 11 gates, 0 skipped, 22 failing exactly matching the
22 entries in `scripts/merge-gate-baseline.txt`, baseline file untouched.

**Conclusion:** the estimate was not wrong about cold builds; it was wrong about
WHICH build directory the gate uses, and that single unchecked assumption turned
a three-minute confirmation into a multi-day block. A cost estimate carries an
implicit claim about the resource it applies to, and that claim is the part that
goes stale. Check the target dir — `FS_GATE_TARGET`, `target-gate/` — before
deferring a gate run as too expensive to attempt.

Two smaller traps from the same campaign, both worth naming:

- **There are FOUR reference trees, not two.** The sweep's most expensive single
  error was concluding a cited value had been invented when it belonged to
  SanityPrint (Gabe's fork). Both OrcaSlicer and CrealityPrint were checked and
  neither carried it: `#2E86C1`, recorded as an ORCA colour from the latter,
  appears in zero of its files. A citation matching neither of the two obvious
  trees is probably the fork's — check before calling it fabricated.
- **`grep -rl` matches substrings.** `wall_filament` hits inside
  `outer_wall_filament_id`. Use `grep -rlE "\bKEY\b"` for config-key names, and
  say which form was used — the scope of a grep is part of what it claims.

## 2026-08-31

### 1. The checker was wrong, and it accused the worker (GIT_704)

A build agent reported four trailing-whitespace lines corrected. Verifying its
claim, the main agent ran the diff through
`grep "^[+-]" | grep -v "^[+-][+-]"`, counted two, and published "the agent's
count was wrong" — to the user, to the close-out comment on #705, and into the
commit message that landed on `main`.

The filter was the defect. Every rule line in the compared block is a markdown
bullet, so an added bullet renders in unified diff as `+- text` and a removed
one as `-- text`; both match the `^[+-][+-]` pattern written to drop the
`+++`/`---` headers. The two lines that survived were exactly the two indented
continuation lines, and the two dropped were exactly the two bullets. Four was
right all along; the blocks verify byte-identical.

What makes this worth writing down is not the regex. It is that a disagreement
between two counts was resolved by trusting the newer measurement instead of
asking why they disagreed — and the answer was published before the question was
asked. `docs/rules/measurement-scope.md` already names this exact shape as its
worked example ("a grep over added lines counts an unchanged line as new") and
prescribes the missed step: **ask WHY the result looks like that, not WHETHER it
does.** § Be straightforward's "attribution only after isolation" independently
forbids the published claim: the discrepancy could have lived in the report or
in the checker, and which one was never isolated.

No new rule came out of it — the post-mortem's verdict was execution slip, not
rule gap. Two mechanical habits follow anyway: **a filter written to drop diff
headers must be anchored to them** (`grep -v "^+++\|^---"`, or use `--numstat` /
`git diff --word-diff` and skip the hand-rolled scrape), and **when your count
disagrees with someone else's, the first suspect is your own instrument** —
verify it against a case whose answer is already known before reporting the
other party wrong.
