# Testing obligations: TYPE x STAGE matrix, v2

202 rows from `ai-skills` at 9587907. Batch A: 178 rows from 938 items (M1–M141 machinery rules, U1–U28 unbreakable, D1–D9 developer-friendliness). Batch B: MB40–MB63, copied from v1. v2 ids restart, so v1 ids appear only in `prev_id`.

## 1. Verdict

- **Five rules give four different times for proving a test can fail.** Red before code: M91 VE.6.1, M130 WT.6.4, U2 CB.6.5. Break and restore after code: M133 WT.7.3. No stage: U21 BR.17.6. Positive control shipped with the code: M38, M44, M105.
- **Two rules contradict each other on mirrored tables.** A5.8 (U12) says use a generator, not a drift test. DI.7.7 (M36, M37) and MB59 require a drift check.
- **Two rules disagree on what runs before a commit.** VE.6.5 (M97) requires the full suite at every commit. WT.6.4 (M131) requires only the task's own component tests.
- **The ledger review has three stages and two scopes, across two plugins.** Stages: after merge (M26), before merge (MB53), or only if the developer agrees (U11). Scopes: unbounded (M28) or the diff only (U15).
- **There are only 3 COMPILE-FAIL rows (M21–M23), all at IMPL.** They conflict with test-first (M91). They count once per invariant, while U1/U2 count once per new path.
- **An ordinary feature owes 29 always/per-feature obligations,** 15 of them from verification-and-evidence. "Say what was not verified" appears in 3 files across 2 plugins.

## 2. Matrix

Each cell shows the count, then per plugin (M/U/D). ⚠ = a row that conflicts with a same-TYPE row at another stage. TEST-PLAN is an added type.

| TYPE \ STAGE | DESIGN | PLAN | PRE-CODE | IMPL | REFACTOR | POST-IMPL | COMMIT | REVIEW | MERGE | POST-MERGE | DEBUG | CLAIM | ANY | total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| UNIT | 1 U1 | · | 2 M2 | 5 M4/U1 | 1 M1 | · | · | · | · | · | · | · | · | 9 |
| INTEGRATION | · | · | · | 2 M2 | · | · | · | · | · | · | · | · | · | 2 |
| E2E | · | · | · | · | · | 4 M4 | · | · | 1 M1 | · | · | · | · | 5 |
| REGRESSION | · | · | 1 M1 | 3 M2/U1 | 1 M1 | · | · | · | · | · | · | · | · | 5 |
| COMPILE-FAIL | · | · | · | 3 M3 | · | · | · | · | · | · | · | · | · | 3 |
| SOURCE-SCAN | 1 U1 ⚠ | · | · | 6 M6 ⚠ | · | 1 M1 | 1 M1 | 3 M3 | 1 M1 ⚠ | 8 M3/U5 ⚠ | · | · | 2 M2 ⚠ | 23 |
| META | · | · | 1 U1 ⚠ | 7 M7 | · | 1 M1 ⚠ | · | 2 M2 | · | · | · | · | 2 M1/U1 ⚠ | 13 |
| BASELINE | · | · | · | 1 U1 | · | 5 M2/U3 | 2 M2 | 1 M1 | 5 M5 | 2 D2 | 1 M1 | · | 1 M1 | 18 |
| PERF | 1 M1 | · | · | 4 M4 | · | 7 M7 | · | · | · | · | 2 M1/U1 | · | · | 14 |
| DATA-GEN | · | · | · | 1 M1 | · | · | · | · | · | · | · | · | · | 1 |
| DIAGNOSTIC | · | · | · | 4 M4 | · | 1 M1 | · | · | · | · | · | · | 1 M1 | 6 |
| GATE | · | · | · | 1 M1 | · | 2 M2 ⚠ | 9 M9 | 1 M1 | 4 M4 | · | · | 1 M1 | 6 M5/U1 ⚠ | 24 |
| BUILD-LINT | · | · | · | 3 M2/U1 | · | 3 M3 | 1 U1 | · | · | · | 1 M1 | · | · | 8 |
| MANUAL | 2 U2 | · | 1 M1 | 2 U2 | · | 2 M2 | · | 13 M13 | 2 M2 | 2 M1/U1 | 6 M5/U1 | · | 1 U1 | 31 |
| CLAIM-CHECK | · | 3 M3 | 1 M1 | · | · | 3 M3 | · | 3 M2/U1 | 1 M1 | · | 1 M1 | 22 M14/U1/D7 | 3 M3 | 37 |
| TEST-PLAN | · | 3 M3 | · | · | · | · | · | · | · | · | · | · | · | 3 |
| **total** | 5 | 6 | 6 | 42 | 2 | 29 | 13 | 23 | 14 | 12 | 11 | 23 | 16 | 202 |

## 3. Discrepancies

### 3.1 Same TYPE at conflicting stages

- **Proof of failure.** U2 (META, PRE-CODE) conflicts with M133 (META, POST-IMPL, "disturb the real file… restore it exactly"). Both conflict with U21 (META, ANY). M91 conflicts with M133. CB.6.5 does not say whether its "red-check" is a red step or a break-and-restore.
- **Ledger review.** M26 (POST-MERGE, runs automatically) vs MB53 (MERGE, "consider dispatching") vs U11 ("take no as an answer"). U12 (no drift test) vs M36 (IMPL) and M37 (ANY).
- **Suite output.** M96 (whole suite, never truncated) vs U24 (return only a verdict or count). M96 also conflicts with U25 (the developer runs large-output tools).
- **Compile-fail.** M21–M23 must land "in the same change". M91 requires a failing test first. The conflict is recorded on M21 only.
- **"Did it work?"** M70 checks at POST-IMPL. D4/D5 check "when the result is measurable, not when the change lands". M129: only the owner closes.
- **Performance.** M117 requires a separate working copy. M135 has you announce measuring code in a copy others can see.

### 3.2 Same obligation in several plugins or files

| Obligation | Rows |
|---|---|
| Prove a test can fail | M91, M130, U2, U21, M133 |
| State what was not verified | M59, M75, M70, D1, D2, D9 |
| Name what was skipped or did not run | M110, MB45, D8, M5, M14 |
| A check that cannot run fails loudly | M65, M50 |
| Measure first | M114, U23 |
| Expectation source and test level | M30, M31, U20 |
| Ledger review | M26–M28, U15–U19, MB46–MB48 |
| Read the authority fresh | M16, M126, M90 |
| Checker positive control | M38, M44, M66, M105 |
| Test through a new path | U1 (stated twice in CB), M92 |
| Tripwire and stranger test | U7, U3 (each also DUPLICATE-OF items in CB), MB46 |
| Rule text restating a gate | RG.7.1→MB58, RG.7.2→MB63, WT.9.2→MB60, WT.9.3→MB61, WD.4.5→MB62 |

### 3.3 Per-feature counts that belong to a new invariant or checker

- **U1/U2:** an A/B test and a red-check for every new path. DI counts its proofs once per invariant (M21–M23).
- **U21:** "prove it can fail" for every test, which repeats M91.
- **M44:** a positive control for every decision site. It belongs to each new switch type.
- **M93/M94:** a data generator and a broader-test case for every fix. These belong to each unit or fixture shape.

### 3.4 ANY-stage rows that fire during implementation

M4, M16, M89, U21, M65/M50, M111, M112, M64/U24/U25, M29, M24. M37 and M58 give no stage, and M58 has had no gate since 2026-09-05.

### 3.5 Shape rows that conflict

- **U12 vs M36/M37/MB59:** generator vs drift test.
- **U5 (CB.3.12: tests are "never the enforcement") vs M34 (DI.7.2):** DI.7.2 makes a scanning test the mechanism. M19/M20 also rest on a source check.
- **U24 vs M64 and M96:** verdict-only output vs keeping the proof lines.
- **M101 (VE.7.2) vs M31 (DI.6.2):** M101 pins the capture against the real renderer, so the expectation comes from the system under test.
- **WT.6.4 vs CB.6.10, CB.8.1 and RG.3.4:** WT.6.4 postpones the ledger and register rows to one documentation commit, but those items require the rows in the same commit. They are NOT-TESTING items with no rows, but this changes what each task commit contains.

## 4. Per-feature load: 29 rows

| Stage | Rows |
|---|---|
| DESIGN | U3, U9 |
| PLAN | M67, M68, M73, M78 |
| PRE-CODE | M91, M130, M126, U2 |
| IMPL | M92, M93, M94, M43, M44, U1, U7 |
| POST-IMPL | M81, M96, M70 |
| REVIEW | M3, M77 |
| CLAIM | M59, M71, M75, D1 |
| ANY | M4, M16, U21 |

On top of these: 14 per-commit rows and 29 per-merge rows.

## 5. Counts

- **Per plugin:** machinery 165 (141 A + 24 B) · unbreakable 28 · developer-friendliness 9.
- **Per file:** verification-and-evidence 60 · design-invariants 32 · cant-break-by-design 19 · agent-topology 17 · be-reasonable 9 · developer-friendliness 9 · rule-governance 8 (+1 B) · work-tracking 8 · worktree-discipline 7 · tool-output 5 · straight-talk 3 · environment-and-platform 1 · reference-sources 0. Batch B: agents 11 · skills 7 · gate scripts 5.
- **Per TYPE:** CLAIM-CHECK 37 · MANUAL 31 · GATE 24 · SOURCE-SCAN 23 · BASELINE 18 · PERF 14 · META 13 · UNIT 9 · BUILD-LINT 8 · DIAGNOSTIC 6 · E2E 5 · REGRESSION 5 · COMPILE-FAIL 3 · TEST-PLAN 3 · INTEGRATION 2 · DATA-GEN 1.
- **Per STAGE:** IMPL 42 · POST-IMPL 29 · REVIEW 23 · CLAIM 23 · ANY 16 · MERGE 14 · COMMIT 13 · POST-MERGE 12 · DEBUG 11 · PLAN 6 · PRE-CODE 6 · DESIGN 5 · REFACTOR 2.
- **Per mode:** conditional 92 · always 57 · shape 53.
- **Per multiplicity:** per-feature 108 · per-new-invariant-or-checker 30 · per-merge 29 · per-effort 17 · per-commit 14 · once 4.
- **Conflict pairs:** 20.

**Additions and changes to v1.**
- New values: TYPE `TEST-PLAN`, and `who: owner` (M129).
- v1 M4 (now M78) moved to TEST-PLAN.
- v1's conflict between M63 and M30 is retracted: they are different checks.
- Batch B rows keep their type, stage and mode. They gain `multiplicity` and recomputed overlaps and conflicts. The v1 values are kept in `v1_overlaps` and `v1_conflicts`.
