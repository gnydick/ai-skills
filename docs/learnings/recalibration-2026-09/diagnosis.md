# Diagnosis: ai-skills / ferrislicer recalibration (sessions since 2026-09-02)

## Token accounting (measured where noted, estimated words×1.35 otherwise)

**First-turn cost per session, from `message.usage` in real transcripts (MEASURED):**

| Context | cache_creation | cache_read | Notes |
|---|---|---|---|
| ai-skills main session (`52f26e44`) | 56,114 | 32,579 | fresh system prompt + rules |
| ferrislicer main session (`3d942b7a`) | 114,113 | 0 | ~2x ai-skills; larger CLAUDE.md + tool surface |
| ai-skills subagent (`agent-abacf290d`) | 44,200 | 22,962 | fresh — **not** shared with parent's cache |
| ferrislicer subagent (`agent-a19a91f6e`) | 98,706 | 0 | fresh, zero cache reuse |

**Top 5 contributors, ranked:**

1. **Per-subagent fresh reload, no cache sharing (MEASURED, dominant).** Every dispatched agent re-pays ~44K–99K tokens to re-establish system prompt + rules before doing any work, because a subagent is a new context with no `cache_read` against the parent. Session `3d942b7a` (ferrislicer) ran 20 subagents; session `9ecd1656` (ai-skills) ran 91; session `442b2e6c` ran 22. At ~50K–99K tokens each, that is 1–9 million tokens of pure re-establishment per long session, dwarfing the task content. Cause: `agent-topology.md` mandates dispatching work rather than doing it in the main conversation, with no note that each dispatch re-buys the full context.
2. **Main-session first-turn reload (MEASURED).** 56K (ai-skills) to 114K (ferrislicer) tokens, paid once per session or compaction. ferrislicer's is ~2x ai-skills', consistent with its larger `CLAUDE.md` (1,802 words) plus `docs/RULES.md` (11,886 words) plus a much larger enabled-tool surface (IDE/Rustrover MCP tools).
3. **`remember` plugin's SessionStart handoff+memory dump (MEASURED).** ~9,982 characters / ~1,236 words (~1,670 tokens) per firing, re-injecting the *same* stale handoff verbatim on every resume/compaction — observed labelled "already delivered 17 times" in one session and confirmed firing 4 times in two different large sessions. This is not a machinery-plugin cost; it is a different installed plugin duplicating content across firings with no decay.
4. **`plugins/machinery/rules/*.md` (10 files, 12,569 words ≈ 17K tokens, ESTIMATED).** Loaded fresh in every session and every subagent's system prompt (component of #1/#2 above). Largest single file: `design-invariants.md` (3,331 words).
5. **`developer-friendliness` SKILL.md (5,593 words ≈ 7.6K tokens) + `unbreakable`'s two skills (8,050 words ≈ 10.9K tokens, ESTIMATED).** Both are written to trigger on almost anything ("any design decision that is not an invariant," "any code path, in any language"), so in practice they get pulled into context on top of #4 far more often than an occasional-use skill would.

The rule prose itself (items 4+5, ~26K words / ~35K tokens estimated) does not reach 200K on its own — the "200,000 tokens for just the plugins" figure is explained by items 1–3: repeated fresh reloads across a long chain of subagents, compounded by a second plugin (`remember`) re-delivering an unbounde­d, growing memory dump on every resume.

---

## Top findings (ranked by cost)

### 1. Implement-then-break replaces write-test-first (highest cost: correctness risk + owner explicitly named this "extremely ignorant")

**What happens:** subagents write production code first, get it to compile, and only then write or extend the test — sometimes verified to already pass on the first run, meaning no red state was ever observed.

**Evidence:**
- `ferrislicer/130ad271.../subagents/agent-afef8448867d7f7e5.jsonl` L129: first file touch is `Edit` to `plate_tower.rs` (production code); the ticket's actual acceptance test (`wipe_tower_placement_858.rs`) is not `Write`-created until L277, after ~15 more production edits and compile-fix cycles.
- `agent-a8f2221d723da9758.jsonl` L160: `Edit` to `fs-multimaterial/src/lib.rs` (production) before any test exists for that function; L177's first test run already reports "20 passed; 0 failed" — the test was never seen to fail.
- Both agents were dispatched with the correct instruction ("TDD — failing test first, watch it fail, then minimal code") — the *instruction* was right; the *execution* inverted it.
- The owner caught the mechanism live: on 2026-09-11 (`3d942b7a-...jsonl` L1905) Gabe wrote *"but then it will still change code and then revert it if tests fail. but that leaves a huge door open for mistakes"* — directly in response to a machinery-rule draft that read "the compiler and the test run name the affected sites." The assistant's fix (now `verification-and-evidence.md` § **The word you just wrote makes a check due**) added: *"Change only the site the change is about. Then build and run the tests... If you did edit a site and then decided it wasn't needed... Show that the file is byte-identical to where it started."* This is scoped to auditing whether a *found* site needs an edit — but an agent immediately over-generalized it (same file, L1907): *"this project already requires that shape of proof for its own test work: change it, watch it fail, restore it byte for byte"* — restating a site-audit technique as the general shape of "test work," which normalizes edit-first-then-verify.
- On 2026-09-13 (`442b2e6c-...jsonl`, 04:35:44Z) the owner stated the verdict directly: **"this is way too much testing that is convoluted. it is not TDD."**

**Where it did NOT happen:** the ai-skills-side `combine-projects-machinery/9ecd1656.../subagents/agent-abacf290d.jsonl` L517 shows a correctly-followed order: *"Method unchanged: RED first (each measured command must fail before the fix — record the failing output)..."* — so genuine red-first TDD is present when the dispatch is explicit about the *artifact* the red state must be checked against, not just "TDD" as a word.

**Source of the confusion, traced:**
- `superpowers:test-driven-development` SKILL.md is unambiguous and strict (Iron Law, red flags including "Test after implementation," "Test passes immediately") — **not** the source.
- `design-invariants.md` § **Carrying instrumentation** ("ships a positive control") and `verification-and-evidence.md` § **What a test can honestly claim** ("positive control... backstop") legitimately ask for proof a check *can* fail — this is mutation-testing language for validating an *existing* test's discriminating power, not a substitute for red-first development. Agents conflate the two.
- `work-tracking.md` § **One editable home** ("disturb the real file, watch the check go red, restore it exactly") is about a *generator/index* self-test, not feature TDD, but its phrasing ("disturb... watch it go red... restore") is close enough to TDD vocabulary that it reads as license.
- The actual root rule, `verification-and-evidence.md` § **Tests** ("Write the failing test first and watch it fail"), is correct and present — it simply loses to the newer, more specific-sounding § **The word you just wrote makes a check due** in the moment an agent is deciding how to prove a change is right.

**Count:** of the 3 implementer subagents inspected in depth (all from the wipe-tower effort, 09-05), all 3 showed production-code-first ordering; 1 dispatch prompt elsewhere (ai-skills, 09-05/09-06) showed genuine red-first TDD explicitly cross-checked against a named failing command.

**Fix:** delete or narrow "watch it fail, restore it byte-identical" language wherever it appears outside the literal self-test-of-a-checker context (`work-tracking.md` § One editable home; the 2026-09-11 URULE in `verification-and-evidence.md`), and add one explicit line there: *this is not a substitute for writing the test before the code exists.* Reword, not mechanize (order-of-tool-calls isn't detectable by a gate without new tooling).

### 2. Over-thorough reporting → self-generated scope creep (owner's second-highest priority)

**What happens:** an agent asked one narrow question returns an exhaustively-structured report naming 5–15 "findings," then the main session dispatches a fresh agent per finding — turning a one-line ask into a long serial chain.

**Evidence:** session `442b2e6c` (ferrislicer) opened with exactly one instruction (L13, 2026-09-11T22:27:06Z): *"return to our worktree and fix the invariants that are left."* A diagnose-only, read-only agent (`agent-abf0ec7d1f424d844`, explicitly scoped "you have NO ability to edit files... your job is to diagnose and propose, never to change") returned a **4,894-word report, 18 bullets, 7 numbered items, 17 headers**, titled "GIT_1096 — the nine, diagnosed" (9 distinct findings). The main session then dispatched a chain of ~10 more agents over the next 30 hours to chase them: "Teach scanner that typed rejection is a mechanism," "Fix scanner cfg-mod and fmt::Result," "Narrow C3 self-transform rule," "Fix extruder_name prose invariant," "Fix parametric_cone invariant gaps," "Correct extruder_name doc wording," "Survey extruder-name identity sites," "Refresh branch and review its baseline delta," "Fix rustfmt and stale key map, re-land." All 22 subagents in this session ran strictly sequentially (no dispatch overlapped another's start/end), so the chain length itself — not concurrency — is the cost driver. The session ended 2026-09-13T04:35:44Z with the owner's verdict quoted above.

**By contrast**, a short report stayed short: `agent-a0b7f25ee13ae4f07.jsonl` (400 words, 7 bullets, no headers) answered a narrow "why did this clip" question and stopped.

**Rule text driving it (each individually defensible, compounding badly):**
- `design-invariants.md` § **Weak claims and the enforcement ledger**: *"Flag anything at all that can fail catastrophically on absence. The sweep is unbounded, not limited to the sites someone already suspects."* — mandates the exhaustive sweep in the first place.
- `verification-and-evidence.md` § **The word you just wrote makes a check due**: *"If you call a defect a class... you owe every instance of it."* — converts one named defect into an obligation covering every occurrence.
- `verification-and-evidence.md` § **Comparison runs and baselines**: *"A skipped case is unproven, not passed, and every one of them is named in the report."*
- `design-invariants.md` § **Telling the user what you dropped**: models a "per-source report listing what was not recognised... clamped... never interpreted" — an exhaustive-disclosure template.
- `straight-talk.md` § **Bad news first**: *"Report a failure or a regression... at full strength. Never soften it and never bury it."* — pushes toward maximal, unsoftened enumeration rather than a triaged summary.
- The rule that should have stopped the *chase* — `work-tracking.md` § **Staying inside the effort**: *"an issue discovered outside the scope of the campaign in hand is filed as a ticket pair and left there, never chased"* — was not applied, because each new finding read as inside the same "fix the invariants" campaign rather than outside it. `agent-topology.md` § **What an agent may conclude** ("An undecided question is filed as work and the agent stops") was honored by the *diagnosing* agent (it stopped, correctly) but not by the *main session*, which is the one that kept dispatching.

**Fix:** mechanize a triage gate between "diagnose" output and "dispatch a fix agent" (per `agent-topology.md` § Aiming a fan-out, which already exists and says exactly this but is not wired to invariant-scan work) — require the main session to name, for each finding, why it is in-scope of the *original* one-line ask before dispatching, not merely "in-scope of the broader campaign."

### 3. Duplicated verification across every layer (slowness)

**Measured** in the single `442b2e6c` main-session transcript alone (not counting each subagent's own runs): **118** `cargo test` invocations, **115** `invariant_scan` runs, **31** `merge-gate.sh` runs, 4 `testq.sh` runs, across ~30 hours and 22 sequentially-dispatched subagents. Each subagent independently re-ran the full test/gate suite before and after its own change, and the main session re-ran the gate again after each merge — no layer trusted another layer's result. This is consistent with the owner's "taking very long" and "convoluted" complaints and is the mechanical cost of finding #2's chain length: each additional dispatched agent adds its own full verification cycle on top of the ones before it.

---

## Testing-flow timeline (representative)

**Task A — wipe tower placement (`130ad271`, 2026-09-05):** dispatch says "TDD, failing test first" → agent edits `plate_tower.rs` (prod) → compile-fails on unrelated symbol → 4 more prod edits → first test run fails (missing fn) → prod edits continue → integration test file finally written (~15 edits in) → cargo test cycle to green → separate "fix ratchet debt" agent dispatched afterward to clean up invariant-scan side-effects of the first agent's work → local merge → gate run → push.

**Task B — invariant-scan false positives (`442b2e6c`, 2026-09-11→13):** one-line ask ("fix the invariants that are left") → read-only diagnose agent produces 9-finding, 4,894-word report → 10 sequential fix/narrow/survey/correct agents dispatched, each running its own `cargo test`+`invariant_scan`+`merge-gate.sh` cycle → owner interrupts mid-stream ("why are you questioning all of this? it's all settled and in code") → chain continues → owner ends it ("way too much testing that is convoluted, it is not TDD").

**Task C — #1040 tower warnings (`3d942b7a`, 2026-09-10→11):** single long-running agent (`agent-ab2cda56cc7f0fc9d`, 299,906 subagent-tokens, spans 24+ hours with 4 SessionStart/compaction re-injections of the full `remember` handoff) drafts a machinery rule live with the owner mid-task, holds uncommitted patch state across a multi-day pause ("nothing committed stays as it is... I'm holding everything on #1040 and #1042 until you tell me"), then closes with a self-audit naming exactly which counts "would have caught what I did on this branch."

---

## Owner corrections (verbatim, dates as given)

- 2026-09-05, `130ad271...`: *"You have to use the wipe tower's footprint in the layer as a budget. And after each tool change, use a percentage of that budget to purge into the wipe tower, not do it after the layer has been processed because that would require out of order g code emission."*
- 2026-09-06, `71c56c9a...`: *"didn't we stop heartbeat functionality?"*
- 2026-09-07, `a2af19dc...`: *"except what will make the specs get referenced to stop guessed bad designs"*
- 2026-09-11, `3d942b7a...`: *"but then it will still change code and then revert it if tests fail. but that leaves a huge door open for mistakes"*
- 2026-09-11, `3d942b7a...`: *"why are you questioning all of this? it's all settled and in code."*
- 2026-09-11, `3d942b7a...` (mid-draft of a rule bullet): *"this one \ndoesn't read correctly to me"* / *"no, i mean it feels like it doesn't really spell out how to tell if a change is needed or not. i would be more comfortable if we verbosely spelled out..."*
- 2026-09-13, `442b2e6c...`: **"this is way too much testing that is convoluted. it is not TDD"**

---

## Contradictions and overlaps

- **No confirmed one-agent-at-a-time violation.** Checked timestamp overlap for all 22 subagents in `442b2e6c` (strictly sequential) and 88 of 91 in `9ecd1656` (2 brief overlaps out of 88 — a minor, not systemic, breach of `agent-topology.md`'s "dispatch one, wait, check, then next"). The cost problem is chain *length*, not concurrency.
- **`work-tracking.md` § Staying inside the effort ("file it, never chase")** vs. actual practice of dispatching a fix-agent per diagnosed finding within what is read as one continuous "campaign" — the rule exists and is correct; it is not being invoked because campaign boundaries are drawn too broadly.
- **`verification-and-evidence.md` § Tests (red-first)** vs. § **The word you just wrote makes a check due** (revert-and-restore proof) — both correct in their own scope, but the second is newer, more specific, and gets misquoted by agents as the general shape of "test work" (see Finding 1).
- **`design-invariants.md` "unbounded sweep"** vs. `work-tracking.md` "stay inside the effort" — an unbounded sweep by construction surfaces out-of-scope material; nothing in either rule says which one wins when they collide on the same task.

---

## What I could not see

- Sampled ~25 of 744 transcript files (weighted to the largest/most substantive: 4 ai-skills main, 4 ai-skills-worktree, 11 ferrislicer main, 6 large ferrislicer subagents), plus 4 additional subagent transcripts opened for structural (tool-call-order) analysis, plus full-corpus regex sweeps (744 files) for corrective language and TDD-order phrases — not full reads.
- ferrislicer's `.claude/worktrees/*` session directories (GIT-562, fill-ground-footprint, fixture-catalog, plan-cut, logging, multi-object) all predate 2026-09-02 and were excluded per the window; `by-object-collision` had no substantive content in-window.
- Did not verify tool-call ordering structurally beyond the 4 implementer transcripts sampled for Finding 1 — the "count vs genuine TDD" figure (3 reversed / 1 correct) is a small, non-random sample, not a corpus-wide census.
- Token-accounting figures are single-sample measurements (one main session, one subagent per project) plus static word counts; not averaged across many sessions.
