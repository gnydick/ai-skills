# All-rules extraction — coverage ledger

Source: `I:\IdeaProjects\ai-skills` at 9587907 (main). Output: `all-rules.json` (822 items). Step 1 of the owner's "follow the same rules for everything in those 3 modules" — extraction only; consolidation is a later pass.

## Verification (script output, `coverage.mjs`, re-run independently of the builder)

- Total items: **822** — machinery 518, unbreakable 201, developer-friendliness 103.
- Verbatim-match failures (item `text` not found byte-for-byte in its `file`): **0**.
- v2 rows (test-rules-v2.json, 202) with no item carrying their id in `prev_id`: **0**.
- Duplicate `text` values: **1** — M386 = M397. (M386/M397: the rule-intake and spec-intake skills each carry the identical sentence "Where this and a rule file disagree, the rule file wins." — two real occurrences in two files, kept as two items.)
- Builder self-checks: unclassified units 0; trigger > 12 words 0; produces > 10 words 0.

## Method

- **Unit.** Each in-scope markdown file was parsed into units: one bullet or numbered step (with its wrapped continuation lines), one table body row, one prose sentence, one frontmatter `description`. Structural units — headings, table header rows, code fences, HTML `<!-- rows: -->` comments, frontmatter `name:`/`tools:` lines — are counted as EXPLANATION (structural). Every non-structural unit was classified by hand as an item or as EXPLANATION (prose); the builder reports any unit left unclassified or classified twice, and this output was accepted only at zero.
- **Splits and merges.** A bullet carrying separate obligations was split at a sentence or clause boundary into several items (each item's `text` is the verbatim substring; the first keeps the list marker). Where a prescription spans adjacent sentences or a lead-in plus its list (e.g. "Then, in this order:" lists were kept per bullet, but "The shared copy is reserved for … :" plus its three bullets is one item), the item's `text` is the verbatim span from the first unit's start to the last unit's end, newlines included. Split/merge items are listed at the end.
- **`text`** is the complete source text exactly as in the file (list marker, markdown, table pipes, blockquote `>` and line breaks included), so `file.includes(text)` holds for every item — that is the verbatim check above.
- **`prev_id`** was assigned by matching each v2 quote (whitespace-collapsed, markdown `*`/`` ` ``/`_`/`>`/`|` stripped, lower-cased) inside the item text in the same source file (v2 paths under `plugins/*/skills/` mapped to their sources). Where v2 cut one sentence into several rows, the one item carries all of them comma-joined (listed below). MB59's quote is a code comment in `gate/register-check.mjs` (`the index must never disagree with the rule files being committed`), not a printed instruction; it is mapped semantically to the gate message that enforces it (M501, "index is stale … run /machinery:reindex").
- **Kinds:** no kinds were added. OTHER is used for: M25 (structural change to a shared seam); M349 (needing the audit's rules); M351 (using the refresh procedure).

## Scope decisions (read before trusting a count)

- **Generated copies ignored, confirmed identical:** `cmp` of every `plugins/machinery/skills/*/SKILL.md` against `claude-code/machinery/*/SKILL.md`, and of `plugins/unbreakable/skills/*` and `plugins/developer-friendliness/skills/*` against their sources — all 12 byte-identical.
- **Files a skill tells the agent to read:** each machinery skill directory holds only `SKILL.md`; what they point at is `rules/*.md` and `agents/*.md` (in scope) or `docs/…` (excluded by brief — e.g. the enforcement ledger in `docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md`).
- **README:** only sentences that instruct (install commands, markers, "never edited by hand", promote a tool, install `unbreakable`) are items; descriptions of what the hooks do are EXPLANATION.
- **Printed strings.** Hook scripts from `hooks.json` (banner, capture, nudge, quiet, quiet-run, worktree-create; `record-payload.mjs` prints nothing), the commit gate (`gate/gate.mjs`, `register-check`, `spec-check`, `sweep-guard`), and — beyond the listed set, named here — the scripts skills run whose output tells the agent what to do (`intake.mjs`, `install.mjs`, `train-tool.mjs`, `promote-tool.mjs`, `reindex.mjs`). A printed string is an item only if it tells the agent to do something; status/failure lines that only report are EXPLANATION (listed with line numbers below). `gate/citation-target.mjs` is excluded: unwired and not installed into projects (gate.mjs header, #29), so it prints nothing into a session. Usage lines (`usage: …`) were not counted.
- **`templates/hosted-check.yml`:** one item (the "protect the branch on this job" comment); the other comment lines are EXPLANATION.
- **Worked examples and summaries.** be-reasonable §2 and developer-friendliness §2 are illustration: EXPLANATION except, in DF §2, the six imperative sentences that state a general handling (record the diagnosis with the change; file deferred work; one entry per cause; what the entry says; untested item first in handoff and final message — v2 D2; say nothing about scaffolding). The ladder tables (cant-break §1 rungs, DF §4 rungs) and both failure-catalogue tables are EXPLANATION; the per-language tool table and all "Choice | Derived answer" domain rows are items. be-reasonable §8 and DF §10 "one-paragraph form" restate the skill and are EXPLANATION.

## Totals per file

| plugin | file | items | EXPLANATION (prose) | EXPLANATION (structural) | merged-span items (of items) |
|---|---|---|---|---|---|
| machinery | `plugins/machinery/rules/agent-topology.md` | 48 | 5 | 13 | 0 |
| machinery | `plugins/machinery/rules/design-invariants.md` | 74 | 7 | 19 | 0 |
| machinery | `plugins/machinery/rules/environment-and-platform.md` | 10 | 4 | 5 | 0 |
| machinery | `plugins/machinery/rules/reference-sources.md` | 4 | 3 | 3 | 0 |
| machinery | `plugins/machinery/rules/rule-governance.md` | 35 | 5 | 8 | 0 |
| machinery | `plugins/machinery/rules/straight-talk.md` | 11 | 2 | 6 | 0 |
| machinery | `plugins/machinery/rules/tool-output.md` | 10 | 3 | 4 | 0 |
| machinery | `plugins/machinery/rules/verification-and-evidence.md` | 58 | 2 | 11 | 0 |
| machinery | `plugins/machinery/rules/work-tracking.md` | 36 | 4 | 10 | 0 |
| machinery | `plugins/machinery/rules/worktree-discipline.md` | 29 | 2 | 7 | 0 |
| machinery | `claude-code/machinery/effort-lifecycle/SKILL.md` | 23 | 8 | 7 | 2 |
| machinery | `claude-code/machinery/install/SKILL.md` | 4 | 1 | 2 | 0 |
| machinery | `claude-code/machinery/invariant-audit/SKILL.md` | 7 | 2 | 3 | 0 |
| machinery | `claude-code/machinery/refresh-diverged-branch/SKILL.md` | 23 | 17 | 11 | 2 |
| machinery | `claude-code/machinery/reindex/SKILL.md` | 6 | 0 | 2 | 0 |
| machinery | `claude-code/machinery/reload/SKILL.md` | 6 | 4 | 2 | 0 |
| machinery | `claude-code/machinery/rule-intake/SKILL.md` | 10 | 1 | 2 | 0 |
| machinery | `claude-code/machinery/spec-intake/SKILL.md` | 10 | 1 | 2 | 0 |
| machinery | `claude-code/machinery/train-tool/SKILL.md` | 11 | 6 | 2 | 1 |
| machinery | `plugins/machinery/agents/comparison-agent.md` | 22 | 11 | 8 | 0 |
| machinery | `plugins/machinery/agents/invariant-auditor.md` | 37 | 9 | 11 | 2 |
| machinery | `plugins/machinery/README.md` | 10 | 29 | 10 | 0 |
| unbreakable | `pure-prose/unbreakable/cant-break-by-design/SKILL.md` | 80 | 30 | 12 | 2 |
| unbreakable | `pure-prose/unbreakable/be-reasonable/SKILL.md` | 121 | 125 | 33 | 9 |
| developer-friendliness | `claude-code/developer-friendliness/developer-friendliness/SKILL.md` | 103 | 122 | 35 | 1 |
| machinery | `plugins/machinery/scripts/banner.mjs` | 3 | 2 | 0 | 0 |
| machinery | `plugins/machinery/scripts/capture.mjs` | 6 | 3 | 0 | 0 |
| machinery | `plugins/machinery/scripts/nudge.mjs` | 1 | 0 | 0 | 0 |
| machinery | `plugins/machinery/scripts/quiet.mjs` | 0 | 1 | 0 | 0 |
| machinery | `plugins/machinery/scripts/quiet-run.mjs` | 2 | 5 | 0 | 0 |
| machinery | `plugins/machinery/scripts/worktree-create.mjs` | 0 | 2 | 0 | 0 |
| machinery | `plugins/machinery/scripts/gate/gate.mjs` | 1 | 1 | 0 | 0 |
| machinery | `plugins/machinery/scripts/gate/register-check.mjs` | 4 | 4 | 0 | 0 |
| machinery | `plugins/machinery/scripts/gate/spec-check.mjs` | 5 | 5 | 0 | 0 |
| machinery | `plugins/machinery/scripts/gate/sweep-guard.mjs` | 1 | 1 | 0 | 0 |
| machinery | `plugins/machinery/scripts/intake.mjs` | 2 | 0 | 0 | 0 |
| machinery | `plugins/machinery/scripts/install.mjs` | 3 | 0 | 0 | 0 |
| machinery | `plugins/machinery/scripts/train-tool.mjs` | 1 | 0 | 0 | 0 |
| machinery | `plugins/machinery/scripts/promote-tool.mjs` | 3 | 0 | 0 | 0 |
| machinery | `plugins/machinery/scripts/reindex.mjs` | 1 | 0 | 0 | 0 |
| machinery | `plugins/machinery/templates/hosted-check.yml` | 1 | 1 | 0 | 0 |

## Totals per plugin

| plugin | items | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|
| machinery | 518 | 151 | 148 |
| unbreakable | 201 | 155 | 45 |
| developer-friendliness | 103 | 122 | 35 |
| **all** | **822** | **428** | **228** |

## Count per kind

| kind | all | machinery | unbreakable | developer-friendliness |
|---|---|---|---|---|
| DESIGN | 193 | 52 | 139 | 2 |
| RECORDS | 100 | 17 | 15 | 68 |
| RULE-PROCESS | 87 | 86 | 0 | 1 |
| TESTING | 73 | 66 | 7 | 0 |
| WORKTREE | 70 | 67 | 2 | 1 |
| AGENTS | 62 | 59 | 3 | 0 |
| TOOLING | 62 | 55 | 7 | 0 |
| REPORTING | 56 | 41 | 6 | 9 |
| TICKETS | 39 | 21 | 0 | 18 |
| COMMUNICATION | 31 | 15 | 13 | 3 |
| INSTRUMENTATION | 22 | 17 | 5 | 0 |
| SKILL-TRIGGER | 14 | 11 | 2 | 1 |
| PLANNING | 10 | 8 | 2 | 0 |
| OTHER | 3 | 3 | 0 | 0 |

## Count per multiplicity

| multiplicity | all | machinery | unbreakable | developer-friendliness |
|---|---|---|---|---|
| on-occurrence | 471 | 248 | 130 | 93 |
| per-new-invariant-or-checker | 80 | 20 | 60 | 0 |
| per-dispatch | 73 | 73 | 0 | 0 |
| per-rule | 42 | 42 | 0 | 0 |
| once | 34 | 31 | 1 | 2 |
| per-commit | 31 | 30 | 0 | 1 |
| per-effort | 24 | 22 | 0 | 2 |
| per-task | 19 | 19 | 0 | 0 |
| per-site | 16 | 7 | 9 | 0 |
| per-merge | 12 | 12 | 0 | 0 |
| per-feature | 10 | 9 | 1 | 0 |
| per-session | 8 | 3 | 0 | 5 |
| per-function | 2 | 2 | 0 | 0 |

## Count per stage

| stage | all | machinery | unbreakable | developer-friendliness |
|---|---|---|---|---|
| ANY | 221 | 129 | 9 | 83 |
| DESIGN | 169 | 55 | 112 | 2 |
| IMPL | 139 | 75 | 64 | 0 |
| REVIEW | 81 | 80 | 1 | 0 |
| COMMIT | 55 | 49 | 4 | 2 |
| MERGE | 35 | 35 | 0 | 0 |
| PLAN | 27 | 27 | 0 | 0 |
| CLAIM | 27 | 18 | 4 | 5 |
| POST-IMPL | 19 | 14 | 0 | 5 |
| DEBUG | 12 | 11 | 1 | 0 |
| POST-MERGE | 11 | 6 | 5 | 0 |
| SESSION-START | 9 | 9 | 0 | 0 |
| SESSION-END | 8 | 2 | 0 | 6 |
| PRE-CODE | 6 | 6 | 0 | 0 |
| REFACTOR | 3 | 2 | 1 | 0 |

## Count per mode

| mode | all | machinery | unbreakable | developer-friendliness |
|---|---|---|---|---|
| conditional | 658 | 391 | 178 | 89 |
| always | 164 | 127 | 23 | 14 |

## Per section

Items = entries in all-rules.json for that section (ids given). EXPLANATION = prose units classified as explanation + structural units.

### `plugins/machinery/rules/agent-topology.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Agent topology | 0 | — | 2 | 1 |
| What gets dispatched | 3 | M1–M3 | 1 | 1 |
| Which model | 4 | M4–M7 | 0 | 1 |
| How many at once | 6 | M8–M13 | 0 | 1 |
| Batching | 5 | M14–M18 | 0 | 1 |
| Where an agent works | 5 | M19–M23 | 0 | 1 |
| Working with the owner | 2 | M24, M25 | 0 | 1 |
| Defining a standing agent | 3 | M26–M28 | 0 | 1 |
| Containment is structural | 8 | M29–M36 | 0 | 1 |
| Aiming a fan-out | 4 | M37–M40 | 2 | 1 |
| What an agent may conclude | 5 | M41–M45 | 0 | 2 |
| Handing a ruling to a dispatched agent | 3 | M46–M48 | 0 | 1 |

### `plugins/machinery/rules/design-invariants.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Design invariants | 0 | — | 2 | 1 |
| The mandate | 2 | M49, M50 | 1 | 1 |
| Where a distinguishing type is created | 6 | M51–M56 | 0 | 1 |
| Weak claims and the enforcement ledger | 5 | M57–M61 | 0 | 1 |
| Never re-derive a fact | 4 | M62–M65 | 0 | 1 |
| Measurement and expectation | 4 | M66–M69 | 0 | 1 |
| One authority per switch | 7 | M70–M76 | 1 | 1 |
| Absence and defaults | 7 | M77–M83 | 0 | 1 |
| The three classes of setting | 3 | M84–M86 | 1 | 1 |
| External input | 1 | M87 | 0 | 1 |
| Handing a resource on | 8 | M88–M95 | 1 | 1 |
| Telling the user what you dropped | 5 | M96–M100 | 0 | 1 |
| Wiring honesty | 2 | M101, M102 | 0 | 1 |
| Reading someone else's data model | 4 | M103–M106 | 1 | 1 |
| Spatial output | 3 | M107–M109 | 0 | 1 |
| Carrying instrumentation | 6 | M110–M115 | 0 | 1 |
| What a diagnostic and a measurement may claim | 6 | M116–M121 | 0 | 2 |
| The base language's own convention | 1 | M122 | 0 | 1 |

### `plugins/machinery/rules/environment-and-platform.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Environment and platform | 0 | — | 2 | 1 |
| Platform scope | 2 | M123, M124 | 0 | 1 |
| Resolving a tool | 2 | M125, M126 | 2 | 1 |
| Dependencies | 6 | M127–M132 | 0 | 2 |

### `plugins/machinery/rules/reference-sources.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Reference sources | 0 | — | 2 | 1 |
| Reference only | 4 | M133–M136 | 1 | 2 |

### `plugins/machinery/rules/rule-governance.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Rule governance | 0 | — | 3 | 1 |
| Dictating a rule | 7 | M137–M143 | 0 | 1 |
| Where a rule lives | 5 | M144–M148 | 0 | 1 |
| Finding the group it joins | 5 | M149–M153 | 0 | 1 |
| Filing and closing the loop | 8 | M154–M161 | 0 | 1 |
| When a belief turns out false | 3 | M162–M164 | 0 | 1 |
| Honesty about the machinery | 7 | M165–M171 | 2 | 2 |

### `plugins/machinery/rules/straight-talk.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Straight talk | 0 | — | 2 | 1 |
| Saying what you know | 3 | M172–M174 | 0 | 1 |
| Bad news first | 4 | M175–M178 | 0 | 1 |
| How much to say | 3 | M179–M181 | 0 | 2 |
| The words you use | 1 | M182 | 0 | 1 |

### `plugins/machinery/rules/tool-output.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Tool output | 0 | — | 3 | 1 |
| Proof lines and denominators | 4 | M183–M186 | 0 | 1 |
| Heartbeats | 6 | M187–M192 | 0 | 2 |

### `plugins/machinery/rules/verification-and-evidence.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Verification and evidence | 0 | — | 2 | 1 |
| Predict before you work | 6 | M193–M198 | 0 | 1 |
| Declare the standard you are claiming | 2 | M199, M200 | 0 | 1 |
| What the check could actually see | 4 | M201–M204 | 0 | 1 |
| The word you just wrote makes a check due | 12 | M205–M216 | 0 | 1 |
| Tests | 9 | M217–M225 | 0 | 1 |
| What a test can honestly claim | 5 | M226–M230 | 0 | 1 |
| Comparison runs and baselines | 7 | M231–M237 | 0 | 1 |
| Measuring performance | 12 | M238–M249 | 0 | 2 |
| Before you write code | 1 | M250 | 0 | 1 |

### `plugins/machinery/rules/work-tracking.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Work tracking | 0 | — | 2 | 1 |
| A ticket and its companion | 9 | M251–M259 | 0 | 1 |
| Creating and shaping a pair | 4 | M260–M263 | 0 | 1 |
| Reading it and keeping it current | 5 | M264–M268 | 0 | 1 |
| The owner's own list | 2 | M269, M270 | 0 | 1 |
| The learnings record | 6 | M271–M276 | 1 | 1 |
| One editable home | 3 | M277–M279 | 0 | 2 |
| Staying inside the effort | 3 | M280–M282 | 0 | 1 |
| A specification handed down | 4 | M283–M286 | 1 | 1 |

### `plugins/machinery/rules/worktree-discipline.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| Working-copy discipline | 0 | — | 2 | 1 |
| Creating one | 8 | M287–M294 | 0 | 1 |
| Working in it | 5 | M295–M299 | 0 | 1 |
| Committing from it | 7 | M300–M306 | 0 | 1 |
| Merging and tearing down | 6 | M307–M312 | 0 | 2 |
| What may be merged | 3 | M313–M315 | 0 | 1 |

### `claude-code/machinery/effort-lifecycle/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M316 | 0 | 1 |
| Effort lifecycle | 0 | — | 3 | 1 |
| Does this apply? | 5 | M317–M321 | 4 | 1 |
| Start | 4 | M322–M325 | 0 | 1 |
| During | 6 | M326–M331 | 1 | 1 |
| End | 7 | M332–M338 | 0 | 2 |

### `claude-code/machinery/install/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M339 | 0 | 1 |
| /machinery:install | 3 | M340–M342 | 1 | 1 |

### `claude-code/machinery/invariant-audit/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M343 | 0 | 1 |
| /machinery:invariant-audit | 6 | M344–M349 | 2 | 2 |

### `claude-code/machinery/refresh-diverged-branch/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M350 | 0 | 1 |
| Refresh a diverged branch | 1 | M351 | 2 | 1 |
| The premise | 2 | M352, M353 | 7 | 1 |
| The steps | 16 | M354–M369 | 8 | 6 |
| Conditions you may hit | 3 | M370–M372 | 0 | 2 |

### `claude-code/machinery/reindex/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M373 | 0 | 1 |
| /machinery:reindex | 5 | M374–M378 | 0 | 1 |

### `claude-code/machinery/reload/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M379 | 0 | 1 |
| /machinery:reload | 5 | M380–M384 | 4 | 1 |

### `claude-code/machinery/rule-intake/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M385 | 0 | 1 |
| /machinery:rule-intake | 9 | M386–M394 | 1 | 1 |

### `claude-code/machinery/spec-intake/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M395 | 0 | 1 |
| /machinery:spec-intake | 9 | M396–M404 | 1 | 1 |

### `claude-code/machinery/train-tool/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M405 | 0 | 1 |
| /machinery:train-tool | 10 | M406–M415 | 6 | 1 |

### `plugins/machinery/agents/comparison-agent.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M416 | 0 | 2 |
| Comparison agent | 0 | — | 5 | 1 |
| The one question | 2 | M417, M418 | 1 | 1 |
| What it is given, and what it is not | 5 | M419–M423 | 4 | 1 |
| Procedure | 6 | M424–M429 | 0 | 1 |
| Output | 8 | M430–M437 | 1 | 2 |

### `plugins/machinery/agents/invariant-auditor.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | M438 | 0 | 2 |
| Enforcement auditor | 0 | — | 2 | 1 |
| The one question | 2 | M439, M440 | 2 | 1 |
| What it is given, and what it is not | 5 | M441–M445 | 4 | 1 |
| Procedure | 6 | M446–M451 | 0 | 2 |
| What a finding looks like | 9 | M452–M460 | 1 | 1 |
| Auditing invariants: the denominator | 7 | M461–M467 | 0 | 1 |
| Auditing invariants: the output | 7 | M468–M474 | 0 | 2 |

### `plugins/machinery/README.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| machinery | 0 | — | 2 | 1 |
| Install | 3 | M475–M477 | 0 | 1 |
| Markers | 1 | M478 | 1 | 1 |
| The five hooks | 0 | — | 5 | 1 |
| Where the rules live | 2 | M479, M480 | 5 | 1 |
| Filing a universal rule | 0 | — | 2 | 1 |
| Filing a specification | 1 | M481 | 5 | 1 |
| Teaching it a tool | 2 | M482, M483 | 6 | 1 |
| Dependency | 1 | M484 | 1 | 1 |
| More | 0 | — | 2 | 1 |

### `pure-prose/unbreakable/cant-break-by-design/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | U1 | 0 | 1 |
| Skill: apply can't-break-by-design to everything you write | 6 | U2–U7 | 3 | 1 |
| Can't Break By Design | 1 | U8 | 2 | 1 |
| 1. The ladder | 8 | U9–U16 | 13 | 2 |
| 2. Techniques | 15 | U17–U31 | 0 | 1 |
| 3. Strongest tool per language | 12 | U32–U43 | 0 | 2 |
| 4. The process | 12 | U44–U55 | 0 | 1 |
| 5. Anti-patterns | 19 | U56–U74 | 10 | 1 |
| Red-flag phrases | 1 | U75 | 0 | 1 |
| 6. Continuous review | 5 | U76–U80 | 2 | 1 |

### `pure-prose/unbreakable/be-reasonable/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | U81 | 0 | 1 |
| Skill: derive the choice, lean toward the cheaper mistake, split two masters, ask when it's genuinely open | 6 | U82–U87 | 3 | 1 |
| Be Reasonable | 1 | U88 | 11 | 1 |
| 1.1 Derive it | 5 | U89–U93 | 5 | 1 |
| 1.2 Lean toward the cheaper mistake | 1 | U94 | 5 | 1 |
| 1.3 Split what has two masters | 1 | U95 | 6 | 1 |
| 1.4 Ask when it is genuinely open | 1 | U96 | 3 | 1 |
| 1.5 Where there is no asymmetry, do not deliberate | 2 | U97, U98 | 2 | 1 |
| 2. The worked example: storage and presentation | 10 | U99–U108 | 23 | 1 |
| 3. Reading the asymmetry | 7 | U109–U115 | 10 | 1 |
| 4. Asking: who, when, and how | 8 | U116–U123 | 2 | 1 |
| 5. The failure catalogue | 0 | — | 13 | 2 |
| 6. Domain appendix | 1 | U124 | 2 | 1 |
| 6.1 Representation | 7 | U125–U131 | 0 | 2 |
| 6.2 Behavior under stress | 7 | U132–U138 | 0 | 2 |
| 6.3 Contracts and vocabulary | 7 | U139–U145 | 0 | 2 |
| 6.4 Visibility | 8 | U146–U153 | 0 | 2 |
| 6.5 Motion | 7 | U154–U160 | 0 | 2 |
| 6.6 People | 6 | U161–U166 | 0 | 2 |
| 6.7 Working under a context budget | 19 | U167–U185 | 25 | 2 |
| 6.8 Artifacts, runs, and workspace layout | 9 | U186–U194 | 8 | 2 |
| 7. The process | 7 | U195–U201 | 0 | 1 |
| 8. The one-paragraph form | 0 | — | 7 | 1 |
| 1. The method | 0 | — | 0 | 1 |

### `claude-code/developer-friendliness/developer-friendliness/SKILL.md`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| frontmatter | 1 | D1 | 0 | 1 |
| Skill: park what will be needed again, where it will be looked for, and nothing else | 9 | D2–D10 | 11 | 1 |
| Developer Friendliness | 1 | D11 | 9 | 1 |
| 1. What falls into the gap | 4 | D12–D15 | 2 | 1 |
| 2. A session, worked | 6 | D16–D21 | 39 | 1 |
| 3.1 Will someone need this again? | 3 | D22–D24 | 2 | 1 |
| 3.2 Where will they look for it? | 3 | D25–D27 | 3 | 1 |
| 3.3 Is writing it cheaper than reconstructing it? | 0 | — | 4 | 1 |
| 4. The durability ladder | 2 | D28, D29 | 13 | 2 |
| 5. Paying for it | 0 | — | 1 | 1 |
| 5.1 Writing | 6 | D30–D35 | 0 | 1 |
| 5.2 Reading | 4 | D36–D39 | 2 | 1 |
| 6. Domains | 1 | D40 | 1 | 1 |
| 6.1 Deferred work | 10 | D41–D50 | 0 | 2 |
| 6.2 Learnings | 5 | D51–D55 | 0 | 2 |
| 6.3 Decisions | 5 | D56–D60 | 0 | 2 |
| 6.4 Outcomes | 4 | D61–D64 | 1 | 2 |
| 6.5 Session continuity | 5 | D65–D69 | 2 | 2 |
| 6.6 No surprises | 7 | D70–D76 | 2 | 2 |
| 6.7 Keeping the record true | 5 | D77–D81 | 0 | 2 |
| 7. The failure catalogue | 0 | — | 16 | 2 |
| Red-flag phrases | 8 | D82–D89 | 3 | 1 |
| 8. Arriving at a record that is already bad | 5 | D90–D94 | 2 | 1 |
| 9. The process | 9 | D95–D103 | 0 | 1 |
| 10. The one-paragraph form | 0 | — | 9 | 1 |
| 3. The filter | 0 | — | 0 | 1 |

### `plugins/machinery/scripts/banner.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| banner() | 3 | M485, M486, M487 | 2 | 0 |

### `plugins/machinery/scripts/capture.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| main() | 6 | M488, M489, M490, M491, M492, M493 | 2 | 0 |
| top-level | 0 | — | 1 | 0 |

### `plugins/machinery/scripts/nudge.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| main() | 1 | M494 | 0 | 0 |

### `plugins/machinery/scripts/quiet.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| top-level | 0 | — | 1 | 0 |

### `plugins/machinery/scripts/quiet-run.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| trainingNudge() | 1 | M495 | 0 | 0 |
| main() | 1 | M496 | 5 | 0 |

### `plugins/machinery/scripts/worktree-create.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| top-level | 0 | — | 2 | 0 |

### `plugins/machinery/scripts/gate/gate.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| top-level | 1 | M497 | 1 | 0 |

### `plugins/machinery/scripts/gate/register-check.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| registerCheck() | 4 | M498, M499, M500, M501 | 4 | 0 |

### `plugins/machinery/scripts/gate/spec-check.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| specCheck() | 5 | M502, M503, M504, M505, M506 | 5 | 0 |

### `plugins/machinery/scripts/gate/sweep-guard.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| sweepGuard() | 1 | M507 | 1 | 0 |

### `plugins/machinery/scripts/intake.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| commit() | 2 | M508, M509 | 0 | 0 |

### `plugins/machinery/scripts/install.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| installMachine | 1 | M510 | 0 | 0 |
| installProject | 2 | M511, M512 | 0 | 0 |

### `plugins/machinery/scripts/train-tool.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| identify | 1 | M513 | 0 | 0 |

### `plugins/machinery/scripts/promote-tool.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| top-level | 3 | M514, M515, M516 | 0 | 0 |

### `plugins/machinery/scripts/reindex.mjs`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| top-level | 1 | M517 | 0 | 0 |

### `plugins/machinery/templates/hosted-check.yml`

| section | items | ids | EXPLANATION (prose) | EXPLANATION (structural) |
|---|---|---|---|---|
| (comment header) | 1 | M518 | 1 | 0 |

## Split and merged items

M126 (rules/environment-and-platform.md § Resolving a tool; split piece); M171 (rules/rule-governance.md § Honesty about the machinery; split piece); M218 (rules/verification-and-evidence.md § Tests; split piece); M219 (rules/verification-and-evidence.md § Tests; split piece); M220 (rules/verification-and-evidence.md § Tests; split piece); M274 (rules/work-tracking.md § The learnings record; split piece); M275 (rules/work-tracking.md § The learnings record; split piece); M276 (rules/work-tracking.md § The learnings record; split piece); M284 (rules/work-tracking.md § A specification handed down; split piece); M285 (rules/work-tracking.md § A specification handed down; split piece); M286 (rules/work-tracking.md § A specification handed down; split piece); M318 (effort-lifecycle/SKILL.md § Does this apply?; merged span); M326 (effort-lifecycle/SKILL.md § During; split piece); M327 (effort-lifecycle/SKILL.md § During; split piece); M328 (effort-lifecycle/SKILL.md § During; split piece); M329 (effort-lifecycle/SKILL.md § During; split piece); M333 (effort-lifecycle/SKILL.md § End; merged span); M337 (effort-lifecycle/SKILL.md § End; split piece); M338 (effort-lifecycle/SKILL.md § End; split piece); M352 (refresh-diverged-branch/SKILL.md § The premise; merged span); M364 (refresh-diverged-branch/SKILL.md § The steps; merged span); M366 (refresh-diverged-branch/SKILL.md § The steps; split piece); M367 (refresh-diverged-branch/SKILL.md § The steps; split piece); M368 (refresh-diverged-branch/SKILL.md § The steps; split piece); M412 (train-tool/SKILL.md § /machinery:train-tool; merged span); M445 (agents/invariant-auditor.md § What it is given, and what it is not; merged span); M460 (agents/invariant-auditor.md § What a finding looks like; merged span); U8 (cant-break-by-design/SKILL.md § Can't Break By Design; merged span); U75 (cant-break-by-design/SKILL.md § Red-flag phrases; merged span); U86 (be-reasonable/SKILL.md § Skill: derive the choice, lean toward the cheaper mistake, split two masters, ask when it's genuinely open; merged span); U109 (be-reasonable/SKILL.md § 3. Reading the asymmetry; merged span); U110 (be-reasonable/SKILL.md § 3. Reading the asymmetry; merged span); U112 (be-reasonable/SKILL.md § 3. Reading the asymmetry; merged span); U114 (be-reasonable/SKILL.md § 3. Reading the asymmetry; merged span); U120 (be-reasonable/SKILL.md § 4. Asking: who, when, and how; merged span); U121 (be-reasonable/SKILL.md § 4. Asking: who, when, and how; merged span); U122 (be-reasonable/SKILL.md § 4. Asking: who, when, and how; merged span); U123 (be-reasonable/SKILL.md § 4. Asking: who, when, and how; merged span); D76 (developer-friendliness/SKILL.md § 6.6 No surprises; merged span).

## prev_id carrying several v2 ids

M55 ← M21,M22,M23; M75 ← M36,M37; M113 ← M43,M44; M228 ← M102,M103; M229 ← M104,M105; M275 ← M130,M131; M313 ← M139,M140; M332 ← MB51,MB52. (v2 split one source sentence or bullet into several rows; the source text is one obligation-bearing unit here, or the v2 quotes are identical.)

## EXPLANATION units (prose), by file — so any line in scope can be found

Line = source line where the unit starts; text truncated to 12 words. Items are found by exact `text` in all-rules.json.


**`plugins/machinery/rules/agent-topology.md`**

- L3 [Agent topology] What gets dispatched to a subordinate agent, how many run at once, …
- L3 [Agent topology] Loaded at session start.
- L15 [What gets dispatched] - What this conserves is the main conversation's own attention, not money. …
- L158 [Aiming a fan-out] - This is the same shape of gate as the one below, …
- L163 [Aiming a fan-out] - A different axis from how many at once and batching: those …

**`plugins/machinery/rules/design-invariants.md`**

- L3 [Design invariants] The design rules that extend the mandatory make-it-unbreakable skill.
- L3 [Design invariants] Loaded at session start.
- L14 [The mandate] - The rules below extend that skill and never substitute for it. …
- L110 [One authority per switch] - Cost is how this gets noticed, not what the rule is …
- L167 [The three classes of setting] - This sharpens the rule against invented defaults rather than replacing it: …
- L204 [Handing a resource on] - The rule is about who consumes a resource, not how many …
- L252 [Reading someone else's data model] - Swapping one single-value representation for another can be entirely right, when …

**`plugins/machinery/rules/environment-and-platform.md`**

- L3 [Environment and platform] Which platform layers a project uses, how a tool is resolved, and …
- L3 [Environment and platform] Loaded at session start.
- L17 [Resolving a tool] - A bare command name is not the tool you meant. Resolving …
- L24 [Resolving a tool] This one fires while a tool is being resolved, and what discharges …

**`plugins/machinery/rules/reference-sources.md`**

- L3 [Reference sources] What you may do with somebody else's implementation once you have read …
- L3 [Reference sources] Loaded at session start.
- L18 [Reference only] - This is a standing rule about how the work is done, …

**`plugins/machinery/rules/rule-governance.md`**

- L3 [Rule governance] How a standing rule is dictated, where it lives, and what filing …
- L3 [Rule governance] Loaded at session start.
- L3 [Rule governance] Three mechanisms are named here and specified elsewhere: the rule-capture hook, the …
- L123 [Honesty about the machinery] - The filing procedure is not what keeps rules safe. Capture and …
- L133 [Honesty about the machinery] Nothing blocks on it: the check that did was unwired on 2026-09-05 …

**`plugins/machinery/rules/straight-talk.md`**

- L3 [Straight talk] How to say what you know, what you do not, and what …
- L3 [Straight talk] Loaded at session start; it governs conversation, not the written artifacts conversation …

**`plugins/machinery/rules/tool-output.md`**

- L3 [Tool output] What a tool, gate or long-running job must print so that its …
- L3 [Tool output] Loaded at session start.
- L3 [Tool output] The filter itself, which rewrites noisy commands to run under a wrapper, …

**`plugins/machinery/rules/verification-and-evidence.md`**

- L3 [Verification and evidence] What a change must predict, what counts as evidence for a claim, …
- L3 [Verification and evidence] Loaded at session start.

**`plugins/machinery/rules/work-tracking.md`**

- L3 [Work tracking] How work is recorded: the ticket and its companion entry, the learnings …
- L3 [Work tracking] Loaded at session start.
- L84 [The learnings record] "The same change" above means the same branch, not the same commit.
- L110 [A specification handed down] Which specification file owns a given subsystem stays a judgement no mechanism …

**`plugins/machinery/rules/worktree-discipline.md`**

- L3 [Working-copy discipline] The life of an isolated working copy: naming it, basing it, working …
- L3 [Working-copy discipline] Loaded at session start.

**`claude-code/machinery/effort-lifecycle/SKILL.md`**

- L8 [Effort lifecycle] The rules live in `rules/worktree-discipline.md`, and the rules about which agent works …
- L8 [Effort lifecycle] This skill is the sequence; those files are authoritative.
- L8 [Effort lifecycle] Where a step here repeats a rule's instruction, the rule file wins …
- L16 [Does this apply?] Yes, to any effort at all.
- L16 [Does this apply?] There is no size exception and no threshold of commits below which …
- L35 [Does this apply?] That maps onto this sequence as follows.
- L41 [Does this apply?] That is a backstop, not a licence for the first commit, which …
- L68 [During] What else a commit message owes — the trailer, and crediting by …

**`claude-code/machinery/install/SKILL.md`**

- L12 [/machinery:install] This is the only way the commit gate is activated: hooks are …

**`claude-code/machinery/invariant-audit/SKILL.md`**

- L7 [/machinery:invariant-audit] The mechanical form of `effort-lifecycle/SKILL.md` step 8's "hand it the diff text …
- L17 [/machinery:invariant-audit] Line 1 of stdout is the diff file's path; every following line …

**`claude-code/machinery/refresh-diverged-branch/SKILL.md`**

- L8 [Refresh a diverged branch] This is one procedure, read or skipped as a unit.
- L8 [Refresh a diverged branch] Version control is the mechanism here rather than the platform underneath one, …
- L16 [The premise] There are two branches that are parallel editions of the same product, …
- L16 [The premise] One is the **primary line**; the other is the **edition branch**, which …
- L16 [The premise] They share a common ancestor.
- L30 [The premise] What makes the rebuild cheap is that most of those conflicts are …
- L30 [The premise] A file the primary line rewrote and the edition never meaningfully touched …
- L30 [The premise] The genuine work is the handful of files where the edition added …
- L30 [The premise] Steps 1 to 3 separate the two so that only the genuine …
- L61 [The steps] The one-sided bin needs no decision at all: the primary line never …
- L61 [The steps] They re-apply word for word in step 4.
- L61 [The steps] The both-changed bin is the only work that needs a judgement, and …
- L84 [The steps] Two kinds of file skip that judgement entirely.
- L87 [The steps] You end this step with the both-changed bin split into *keep the …
- L87 [The steps] Both parts still owe work in step 5; neither is finished here.
- L99 [The steps] Because the branch already *is* the primary line, no file in either …
- L99 [The steps] What they still owe is the grafting, and that is step 5.

**`claude-code/machinery/reload/SKILL.md`**

- L9 [/machinery:reload] The scratchpad holds that record, so it is per session by construction …
- L11 [/machinery:reload] The last line is always `machinery_reload: N files, M changed`.
- L11 [/machinery:reload] `M` at zero is an answer, not a missing one: every file …
- L11 [/machinery:reload] Other sessions pick the files up at their next start.

**`claude-code/machinery/rule-intake/SKILL.md`**

- L7 [/machinery:rule-intake] The rules live in `rules/rule-governance.md`; this is the sequence.

**`claude-code/machinery/spec-intake/SKILL.md`**

- L7 [/machinery:spec-intake] The rules live in `rules/work-tracking.md` § A specification handed down; this is …

**`claude-code/machinery/train-tool/SKILL.md`**

- L7 [/machinery:train-tool] The runner ends a noisy run of an unlearned tool with one …
- L7 [/machinery:train-tool] It never blocks and nothing is applied by it; answering it is …
- L16 [/machinery:train-tool] `train-tool: graduation refused` comes in two kinds, and the problem lines under …
- L16 [/machinery:train-tool] Your pick is recorded either way, so nothing you identified is lost.
- L23 [/machinery:train-tool] When a learned matcher drifts the runner says `learned answer line re-opened …
- L23 [/machinery:train-tool] The key the runner names is now the tool's catalog id rather …

**`plugins/machinery/agents/comparison-agent.md`**

- L9 [Comparison agent] The conventions every standing agent obeys are in `rules/agent-topology.md`.
- L9 [Comparison agent] The standing rules about baselines, never rebaking an expectation, and reading a …
- L9 [Comparison agent] This brief does not restate either; it states this agent's own question, …
- L15 [Comparison agent] *This is the generic form.
- L15 [Comparison agent] The specifics of any one project's comparison harness — which quantities it …
- L21 [The one question] > Compared with the reference implementation, did this change move the > …
- L32 [What it is given, and what it is not] **Tools:** it must build and run things, so it has that ability, …
- L32 [What it is given, and what it is not] It verifies; it does not integrate.
- L42 [What it is given, and what it is not] A rebaked expectation proves the product agrees with its own last output …
- L47 [What it is given, and what it is not] **Inputs:** the baseline the caller supplies, if any, and the harness's own …
- L86 [Output] Then, in this order:

**`plugins/machinery/agents/invariant-auditor.md`**

- L9 [Enforcement auditor] The conventions every standing agent obeys are in `rules/agent-topology.md` — what one …
- L9 [Enforcement auditor] This brief does not restate them; it states this agent's own question, …
- L16 [The one question] > Which stated invariant does this change weaken, and how strongly is …
- L19 [The one question] That is the whole of it.
- L27 [What it is given, and what it is not] **Tools:** searching and reading files.
- L27 [What it is given, and what it is not] Nothing that runs commands, edits or writes.
- L27 [What it is given, and what it is not] That containment is structural, not a promise in a prompt, and it …
- L38 [What it is given, and what it is not] **Inputs:** the diff or changed-file list from the caller, and the enforcement …
- L80 [What a finding looks like] Every finding has four parts and the same four every time:

**`plugins/machinery/README.md`**

- L3 [machinery] A Claude Code plugin that keeps a set of universal process rules …
- L3 [machinery] It also quiets noisy build/test output in the transcript and creates git …
- L19 [Markers] The three tokens are defined once, in `markers.json`.
- L25 [The five hooks] - **SessionStart** — prints a banner of facts it measured this session …
- L26 [The five hooks] - **UserPromptSubmit** — captures a `PRULE:`/`URULE:`-marked prompt to the right inbox and …
- L27 [The five hooks] - **PreToolUse** — rewrites a noisy or infra-signal Bash/PowerShell command to run …
- L28 [The five hooks] - **PostToolUse** — after an Edit/Write to a rule file, nudges if …
- L29 [The five hooks] - **WorktreeCreate** — creates the worktree with the branch name unprefixed (a …
- L33 [Where the rules live] One copy only.
- L33 [Where the rules live] Universal rules live in this plugin's `rules/`, project rules in `.claude/rules/`.
- L40 [Where the rules live] Specifications follow the same shape (#81): `docs/dictated-specs/` for the documents, `.claude/machinery/spec-inbox.md` for …
- L40 [Where the rules live] Both indexes in one place, because the rules index cannot move to …
- L40 [Where the rules live] The spec inbox sits in `.claude/machinery/` for a different reason: it holds …
- L52 [Filing a universal rule] `/machinery:rule-intake` runs the sequence: a `URULE:` prompt is **captured** to the universal …
- L52 [Filing a universal rule] A project rule (`PRULE:`) follows the same shape without the version bump, …
- L63 [Filing a specification] A `SPEC:` prompt is a specification handed down, and it moves through …
- L69 [Filing a specification] That location is fixed and known — one address every project shares, …
- L74 [Filing a specification] Two limits, stated rather than glossed.
- L74 [Filing a specification] Which specification file owns a given subsystem is a judgement no mechanism …
- L74 [Filing a specification] And `docs/` is outside `.claude/`, so nothing puts a filed specification into …
- L89 [Teaching it a tool] A tool the catalog does not know starts on the generic contract …
- L89 [Teaching it a tool] A noisy run ends with a `[quiet:train]` line naming the run's log; …
- L89 [Teaching it a tool] A learned matcher can only add a line to the kept set, …
- L89 [Teaching it a tool] Above that floor sits the display cap, which is not the matcher's: …
- L89 [Teaching it a tool] [n kept lines elided between head and tail] ...` line between them, …
- L89 [Teaching it a tool] It goes back into training on its own when it matches nothing …
- L109 [Dependency] The SessionStart banner reports whether it finds that skill installed; it never …
- L116 [More] - The two-project design this plugin unions: `combine-projects-machinery/union/`.
- L117 [More] - How the hook payload fixtures under `test/fixtures/payloads/` were produced, and how …

**`pure-prose/unbreakable/cant-break-by-design/SKILL.md`**

- L8 [Skill: apply can't-break-by-design to everything you write] You do not have the choice to design any other way.
- L17 [Skill: apply can't-break-by-design to everything you write] A sentence that sounds like an invariant usually is not one.
- L24 [Skill: apply can't-break-by-design to everything you write] The full reference follows.
- L30 [Can't Break By Design] A property is enforced **by design** when violating it is *unrepresentable* — …
- L30 [Can't Break By Design] Not caught at runtime, not covered by a test, not flagged in …
- L47 [1. The ladder] \| 0 \| Comment / documentation \| anyone doesn't read it \|
- L48 [1. The ladder] \| 1 \| Convention & review \| reviewer blinks \|
- L49 [1. The ladder] \| 2 \| Runtime assert \| only after shipping the bad path …
- L50 [1. The ladder] \| 3 \| Tests \| the new path isn't the tested path …
- L51 [1. The ladder] \| 4 \| Lint / static analysis \| rule gaps, suppressions \|
- L52 [1. The ladder] \| 5 \| Shared helper \| a call site doesn't call it …
- L53 [1. The ladder] \| 6 \| Choke-point (sole route) \| a new bypass route is …
- L54 [1. The ladder] \| 7 \| **Sole-constructor type** \| bypass = compile error \|
- L55 [1. The ladder] \| 8 \| **Illegal state unrepresentable** \| nothing left to break \|
- L60 [1. The ladder] Rung 0 is worthless *as enforcement*.
- L60 [1. The ladder] That is not a claim about its worth as memory: a comment …
- L60 [1. The ladder] It is simply not the thing standing between a caller and a …
- L65 [1. The ladder] Two things it is not.
- L164 [5. Anti-patterns] Sentences that sound like invariants and are not.
- L164 [5. Anti-patterns] `(inverts N)` names the technique that fixes it.
- L167 [5. Anti-patterns] **Claim vs mechanism**
- L180 [5. Anti-patterns] **Preconditions**
- L189 [5. Anti-patterns] **Duplication**
- L198 [5. Anti-patterns] **Tests standing in for construction**
- L205 [5. Anti-patterns] **Build-profile divergence**
- L214 [5. Anti-patterns] **Panics wearing guarantees**
- L222 [5. Anti-patterns] **Inert code**
- L229 [5. Anti-patterns] **Run-scoped state**
- L249 [6. Continuous review] A ledger goes stale on the next commit that writes "callers must".
- L249 [6. Continuous review] If a background agent maintains it:

**`pure-prose/unbreakable/be-reasonable/SKILL.md`**

- L8 [Skill: derive the choice, lean toward the cheaper mistake, split two masters, ask when it's genuinely open] Four moves, in order, on every design decision that is not an …
- L27 [Skill: derive the choice, lean toward the cheaper mistake, split two masters, ask when it's genuinely open] This governs choices.
- L31 [Skill: derive the choice, lean toward the cheaper mistake, split two masters, ask when it's genuinely open] The full reference follows.
- L35 [Be Reasonable] **The definition.**
- L35 [Be Reasonable] A choice is *reasonable* when it was **derived** rather than inherited: when …
- L35 [Be Reasonable] Reasonableness is not moderation and not a preference for less.
- L35 [Be Reasonable] Extreme precision, extreme strictness, and extreme simplicity are all reasonable when the …
- L35 [Be Reasonable] What makes a choice unreasonable is not its position on a scale …
- L43 [Be Reasonable] If the justification is that this is how it is normally done, …
- L43 [Be Reasonable] It has been inherited, and inherited decisions are correct only by coincidence.
- L49 [Be Reasonable] **Why this is a skill and not a personality.**
- L49 [Be Reasonable] Most design choices are small, frequent, and made quickly — a precision, …
- L49 [Be Reasonable] Their cost is invisible individually and enormous in aggregate, and because none …
- L49 [Be Reasonable] The four moves are cheap enough to run on a decision that …
- L62 [1.1 Derive it] The inputs to a design choice are in front of you: what …
- L62 [1.1 Derive it] A choice is derived when it is a function of those, and …
- L67 [1.1 Derive it] The failure has recognizable forms:
- L80 [1.1 Derive it] Deriving does not require research.
- L80 [1.1 Derive it] The point is not rigor, it is that an input was consulted.
- L86 [1.2 Lean toward the cheaper mistake] You will be uncertain often; the four moves do not remove uncertainty, …
- L86 [1.2 Lean toward the cheaper mistake] **This is not caution.**
- L86 [1.2 Lean toward the cheaper mistake] Sometimes the cheaper mistake is the aggressive one: keeping more than you …
- L86 [1.2 Lean toward the cheaper mistake] Cheapness is about recovery, not timidity.
- L93 [1.2 Lean toward the cheaper mistake] How to read the asymmetry — §3.
- L97 [1.3 Split what has two masters] When one decision is being pulled in two directions, the usual instinct …
- L103 [1.3 Split what has two masters] The canonical seam is **storage versus presentation** (§2), where the store answers …
- L103 [1.3 Split what has two masters] But the pattern recurs everywhere: a caller's deadline versus a server's retry …
- L103 [1.3 Split what has two masters] Each of these looks like one thing to tune and is two …
- L112 [1.3 Split what has two masters] The tell: you find yourself saying "but then it would be too …
- L112 [1.3 Split what has two masters] That sentence names the second master.
- L117 [1.4 Ask when it is genuinely open] Most choices are not open — they are derivable, and you derive …
- L117 [1.4 Ask when it is genuinely open] That combination is the trigger, and both halves matter: an invisible difference …
- L124 [1.4 Ask when it is genuinely open] Details in §4, including who to ask and how to bound the …
- L128 [1.5 Where there is no asymmetry, do not deliberate] Some choices are genuinely arbitrary: two orderings that read the same, two …
- L128 [1.5 Where there is no asymmetry, do not deliberate] Deliberating them is not thoroughness, it is a tax paid to the …
- L141 [2. The worked example: storage and presentation] One example, worked fully, because it exercises all four moves and because …
- L144 [2. The worked example: storage and presentation] **Fidelity** is the set of distinctions the source made: the resolution of …
- L144 [2. The worked example: storage and presentation] The question is what to keep and what to show.
- L149 [2. The worked example: storage and presentation] **Move 3 first: two masters.**
- L149 [2. The worked example: storage and presentation] "How precise should this be?" is not one question.
- L149 [2. The worked example: storage and presentation] Storage answers to the source; presentation answers to the reader.
- L149 [2. The worked example: storage and presentation] Blend them and you get a store shaped by a screen.
- L153 [2. The worked example: storage and presentation] **Move 2: the asymmetry.**
- L153 [2. The worked example: storage and presentation] These two errors are wildly unequal.
- L153 [2. The worked example: storage and presentation] A distinction dropped at write time is unrecoverable — no migration, no …
- L153 [2. The worked example: storage and presentation] A distinction dropped at read time is a formatting change, reversible in …
- L153 [2. The worked example: storage and presentation] When the costs of the two errors differ that much, the default …
- L159 [2. The worked example: storage and presentation] **Move 1: derive each side.**
- L172 [2. The worked example: storage and presentation] Three corollaries fall out:
- L184 [2. The worked example: storage and presentation] **Fidelity is not only digits.**
- L184 [2. The worked example: storage and presentation] Absent is not empty is not zero.
- L184 [2. The worked example: storage and presentation] An instant without its zone has lost the question "what did the …
- L193 [2. The worked example: storage and presentation] **Move 4: what remains open.**
- L193 [2. The worked example: storage and presentation] Display precision below the obvious.
- L193 [2. The worked example: storage and presentation] Seconds on a report and full fidelity on a machine interface are …
- L193 [2. The worked example: storage and presentation] Operators may need to order events inside one second, or may be …
- L193 [2. The worked example: storage and presentation] So you ask — see §4.
- L200 [2. The worked example: storage and presentation] Silent fidelity loss is the thing this whole example exists to prevent, …
- L211 [3. Reading the asymmetry] Move 2 is the one most often gotten backwards, usually because "cheaper" …
- L211 [3. Reading the asymmetry] Four questions, in priority order:
- L214 [3. Reading the asymmetry] An error that a formatter fixes is nearly free no matter how …
- L219 [3. Reading the asymmetry] A loud failure is cheap almost regardless of magnitude, because it is …
- L219 [3. Reading the asymmetry] A silent wrong answer has no such bound: it is believed, acted …
- L225 [3. Reading the asymmetry] Some mistakes are paid once.
- L225 [3. Reading the asymmetry] Others accrue with every caller, every engineer, every day: a slow build, …
- L231 [3. Reading the asymmetry] A cost you pay now is worth more than a cost you …
- L236 [3. Reading the asymmetry] When these four point the same way, the choice is made and …
- L236 [3. Reading the asymmetry] When they conflict, that is usually move 3 in disguise: something is …
- L244 [4. Asking: who, when, and how] This distinction does real work.
- L251 [4. Asking: who, when, and how] At that moment the question is concrete, cheap to answer, and cheap …
- L278 [5. The failure catalogue] Both columns are the same failure: the choice was not derived.
- L278 [5. The failure catalogue] The middle column is how it feels from inside, which is why …
- L284 [5. The failure catalogue] \| the round number, the tutorial default \| speed \| agonizing over …
- L285 [5. The failure catalogue] \| guessing a choice whose difference is visible \| decisiveness \| asking …
- L286 [5. The failure catalogue] \| "we always do it this way" \| experience \| rejecting the …
- L287 [5. The failure catalogue] \| a setting to avoid a decision \| flexibility \| a hard-coded …
- L288 [5. The failure catalogue] \| compromising between two masters \| pragmatism \| splitting a decision that …
- L289 [5. The failure catalogue] \| exporting the cost to the caller \| shipping \| absorbing a …
- L290 [5. The failure catalogue] \| reading a full dump to find one line \| thoroughness \| …
- L291 [5. The failure catalogue] \| instructions left scattered in conversation \| flow \| a document for …
- L292 [5. The failure catalogue] \| a fallback that returns a wrong answer quietly \| resilience \| …
- L293 [5. The failure catalogue] \| silent fidelity loss at the door \| simplicity \| fabricated precision …
- L295 [5. The failure catalogue] The bottom rows are the instructive pair: *both* are failures of the …
- L302 [6. Domain appendix] The method, already applied.
- L302 [6. Domain appendix] This is a map, not a rulebook — the entries are worth …
- L380 [6.7 Working under a context budget] A **context budget** is the finite working set a reader has to …
- L380 [6.7 Working under a context budget] The reader is not necessarily a machine, and the budget is not …
- L380 [6.7 Working under a context budget] All of these are context budgets:
- L384 [6.7 Working under a context budget] - an assistant's context window over a working session
- L385 [6.7 Working under a context budget] - a reviewer's attention across a single change
- L386 [6.7 Working under a context budget] - an operator's attention at the worst hour of the night
- L387 [6.7 Working under a context budget] - a newcomer's head during the weeks before they can contribute
- L388 [6.7 Working under a context budget] - whatever a person will actually read of an error message, a …
- L390 [6.7 Working under a context budget] - the alerts and dashboard panels a team can genuinely watch
- L391 [6.7 Working under a context budget] - the number of concepts a change forces someone to hold simultaneously …
- L394 [6.7 Working under a context budget] They are one domain because they share four properties, and the four …
- L397 [6.7 Working under a context budget] 1. **Finite and shared.** Spending the budget on one thing makes it …
- L399 [6.7 Working under a context budget] 2. **Spent by volume, not by value.** A thousand lines of noise …
- L401 [6.7 Working under a context budget] 3. **It fails by eviction and dilution, never by refusal.** Nothing errors …
- L404 [6.7 Working under a context budget] 4. **The cost is exported.** Whoever adds the volume is rarely the …
- L408 [6.7 Working under a context budget] An assistant's context window is the sharpest instance because it is metered, …
- L408 [6.7 Working under a context budget] The discipline is the same at every scale, and the rows below …
- L431 [6.7 Working under a context budget] **The operational-tooling handoff.**
- L431 [6.7 Working under a context budget] Both halves fall out of move 3: the tool's output has two …
- L431 [6.7 Working under a context budget] That last item is what makes the loop cheap in both directions: …
- L444 [6.7 Working under a context budget] **The counter-direction is a real failure and costs more than it looks.**
- L444 [6.7 Working under a context budget] Guessing at an interface to avoid a fifty-line read buys nothing: you …
- L444 [6.7 Working under a context budget] The same false economy has a human form: an error message too …
- L453 [6.7 Working under a context budget] The context budget is a constraint to derive from, not a virtue …
- L453 [6.7 Working under a context budget] Density is the lever, not length.
- L460 [6.8 Artifacts, runs, and workspace layout] Work that produces output for comparison — before and after, two environments, …
- L465 [6.8 Artifacts, runs, and workspace layout] The governing case is **which axis carries the discriminator**, and it is …
- L465 [6.8 Artifacts, runs, and workspace layout] A name like `report-prod` is a single string serving two masters: *what …
- L465 [6.8 Artifacts, runs, and workspace layout] Blended, it serves neither — the artifact no longer has a stable …
- L484 [6.8 Artifacts, runs, and workspace layout] The tell that the discriminator is on the wrong axis: adding a …
- L484 [6.8 Artifacts, runs, and workspace layout] That is the duplicated-step tripwire, arriving in a layout decision instead of …
- L489 [6.8 Artifacts, runs, and workspace layout] The asymmetry across the whole section is one-directional: a directory layout flattens …
- L489 [6.8 Artifacts, runs, and workspace layout] Encoded names un-flatten only by renaming every artifact and rewriting every pattern …
- L521 [8. The one-paragraph form] > Be reasonable means derive the choice, not inherit it.
- L521 [8. The one-paragraph form] Ask what in this > situation produces the answer — the source, …
- L521 [8. The one-paragraph form] Where one decision is pulled two ways, it is > two decisions: …
- L521 [8. The one-paragraph form] Where uncertainty remains, lean toward the > mistake that is cheaper to …
- L521 [8. The one-paragraph form] Where nothing is asymmetric, pick, match > what is adjacent, and move …
- L521 [8. The one-paragraph form] Extreme rigor is reasonable when the situation > produces it; the only …
- L521 [8. The one-paragraph form] It never lowers the enforcement of an > invariant.**

**`claude-code/developer-friendliness/developer-friendliness/SKILL.md`**

- L8 [Skill: park what will be needed again, where it will be looked for, and nothing else] You move faster than the developer can track.
- L8 [Skill: park what will be needed again, where it will be looked for, and nothing else] Everything you learn, decide, defer, or break lives first in a conversation …
- L13 [Skill: park what will be needed again, where it will be looked for, and nothing else] Three questions, in order, on anything worth keeping:
- L28 [Skill: park what will be needed again, where it will be looked for, and nothing else] **Reading is the larger half of the budget**, because a record is …
- L33 [Skill: park what will be needed again, where it will be looked for, and nothing else] The governor, without which this becomes the thing it prevents: **the record …
- L33 [Skill: park what will be needed again, where it will be looked for, and nothing else] A tracker nobody triages and a notes file nobody opens are the …
- L33 [Skill: park what will be needed again, where it will be looked for, and nothing else] They feel more responsible, and they fail silently, because nobody announces that …
- L39 [Skill: park what will be needed again, where it will be looked for, and nothing else] Two tripwires.
- L43 [Skill: park what will be needed again, where it will be looked for, and nothing else] This governs the record, never the work.
- L43 [Skill: park what will be needed again, where it will be looked for, and nothing else] It is not a reason to go slower, and never a substitute …
- L46 [Skill: park what will be needed again, where it will be looked for, and nothing else] The full reference follows.
- L52 [Developer Friendliness] **The definition.**
- L52 [Developer Friendliness] A collaboration is *friendly* when the developer can stop paying attention to …
- L52 [Developer Friendliness] Not when you are polite, not when you narrate, not when you …
- L59 [Developer Friendliness] **Why this is a skill and not a courtesy.**
- L59 [Developer Friendliness] Every individual omission is defensible — it is in the diff, you …
- L59 [Developer Friendliness] The cost is invisible when incurred, paid by someone else later, and …
- L59 [Developer Friendliness] The gap widens with your throughput, so the discipline scales with the …
- L59 [Developer Friendliness] Speed without a record does not produce a fast project.
- L59 [Developer Friendliness] It produces a project nobody can account for, at speed.
- L77 [1. What falls into the gap] **The diff records what the code is now.**
- L77 [1. What falls into the gap] It records nothing about what it is not, what it almost was, …
- L84 [2. A session, worked] One session, worked fully, because the ratio matters more than any single …
- L87 [2. A session, worked] **What happened.**
- L87 [2. A session, worked] You were asked to fix a slow report query.
- L87 [2. A session, worked] Over ninety minutes you read the schema, added an index that did …
- L95 [2. A session, worked] Six things happened.
- L95 [2. A session, worked] Run the filter on each.
- L97 [2. A session, worked] **The index that did not help.**
- L97 [2. A session, worked] Needed again?
- L97 [2. A session, worked] Yes — the next person to look at this query will reach …
- L97 [2. A session, worked] Not visible from the artifact: the index is *gone*, so the code …
- L97 [2. A session, worked] Where?
- L97 [2. A session, worked] It is a rejected alternative, so it belongs with the decision.
- L97 [2. A session, worked] One line: *tried a covering index on these columns; no improvement, because …
- L104 [2. A session, worked] **The real cause.**
- L104 [2. A session, worked] The change itself is in the diff, but the diff shows a …
- L104 [2. A session, worked] Someone reading it later will assume the constraint was about correctness and …
- L110 [2. A session, worked] **The same gap on two other tables.**
- L116 [2. A session, worked] **The one you did not test.**
- L116 [2. A session, worked] This is the item most likely to be lost, because nothing points …
- L116 [2. A session, worked] An untested change that is reported as done is not one error; …
- L121 [2. A session, worked] **The collation difference.**
- L121 [2. A session, worked] Needed again?
- L121 [2. A session, worked] Certainly — it will break the next reproduction attempt exactly as it …
- L121 [2. A session, worked] Surprised you, cost you a failed reproduction to find, and is true …
- L121 [2. A session, worked] This one is not about the change, so it does not travel …
- L128 [2. A session, worked] **Everything else.**
- L128 [2. A session, worked] The schema you read, the file you opened and closed, the failed …
- L128 [2. A session, worked] Scaffolding.
- L128 [2. A session, worked] It is most of the session.
- L132 [2. A session, worked] **The result.**
- L132 [2. A session, worked] Ninety minutes of work produced four short records and one line in …
- L132 [2. A session, worked] That ratio is the point: the filter is not a prompt to …
- L132 [2. A session, worked] A session that produces fifteen records has not been more careful — …
- L138 [2. A session, worked] **And notice what the ladder did.**
- L138 [2. A session, worked] The rejected index and the diagnosis travelled with the change, because that …
- L138 [2. A session, worked] The deferred work went to the tracker, because whoever plans work does …
- L138 [2. A session, worked] The untested item went into both the handoff and the message, because …
- L138 [2. A session, worked] The collation quirk went to the project's setup knowledge, because it is …
- L138 [2. A session, worked] Four items, four different places, each chosen by asking who comes looking …
- L153 [3.1 Will someone need this again?] Most of a session is scaffolding.
- L153 [3.1 Will someone need this again?] Three classes almost always qualify:
- L165 [3.2 Where will they look for it?] The place is a property of the project, not a preference.
- L168 [3.2 Where will they look for it?] The record is now split; a split record cannot be trusted, because …
- L168 [3.2 Where will they look for it?] **One mediocre location beats two good ones.**
- L179 [3.3 Is writing it cheaper than reconstructing it?] It fails in both directions.
- L179 [3.3 Is writing it cheaper than reconstructing it?] Refusing a small write for something that takes an hour to rediscover …
- L179 [3.3 Is writing it cheaper than reconstructing it?] But paying a large write for the trivially reconstructible is what kills …
- L179 [3.3 Is writing it cheaper than reconstructing it?] They simply stop, and from then on everything written there is a …
- L192 [4. The durability ladder] \| 0 \| your working context \| the session ends \|
- L193 [4. The durability ladder] \| 1 \| a message the developer read \| they close the …
- L194 [4. The durability ladder] \| 2 \| a comment on a change under review \| the …
- L195 [4. The durability ladder] \| 3 \| a marker left in the code \| nobody searches; …
- L196 [4. The durability ladder] \| 4 \| the message on the change itself \| only found …
- L197 [4. The durability ladder] \| 5 \| the tracker the project already uses \| it needs …
- L198 [4. The durability ladder] \| 6 \| a document in the repository \| found by anyone …
- L199 [4. The durability ladder] \| 7 \| the conventions loaded every session \| read without anyone …
- L200 [4. The durability ladder] \| 8 \| **encoded in the code or the build** \| it …
- L202 [4. The durability ladder] **Higher is not better** — the opposite of the enforcement ladder for …
- L202 [4. The durability ladder] A footnote parked at rung 7 is a permanent tax on every …
- L207 [4. The durability ladder] **Rung 8 is the exit.**
- L207 [4. The durability ladder] A comment warning that two values must be updated together is rung …
- L217 [5. Paying for it] The governor on every other section.
- L255 [5.2 Reading] Writing is the half people notice.
- L255 [5.2 Reading] Retrieval is where the budget actually goes, because a record is written …
- L277 [6. Domains] The method already applied — a map, not a rulebook.
- L317 [6.4 Outcomes] The domain most often skipped, because by the time it applies the …
- L336 [6.5 Session continuity] The pickup context is the one thing in this skill that is …
- L336 [6.5 Session continuity] It earns the risk only because deciding what matters is a judgment …
- L361 [6.6 No surprises] Trust is what is being spent here, and it is the compounding …
- L361 [6.6 No surprises] One surprise converts every future summary into something to be checked.
- L379 [7. The failure catalogue] Both columns are the same failure: the record was not filtered.
- L379 [7. The failure catalogue] The middle is how it feels from inside, which is why intending …
- L384 [7. The failure catalogue] \| "I'll mention it at the end" \| focus \| a status …
- L385 [7. The failure catalogue] \| a marker in the code with no owner \| tidiness \| …
- L386 [7. The failure catalogue] \| a decision made in conversation and lost \| momentum \| a …
- L387 [7. The failure catalogue] \| re-deriving the same quirk every session \| self-reliance \| a notes …
- L388 [7. The failure catalogue] \| docs describing the previous design \| shipping \| docs rewritten on …
- L389 [7. The failure catalogue] \| quietly narrowing the scope \| judgment \| asking permission at every …
- L390 [7. The failure catalogue] \| "it's in the diff" \| precision \| an entry that restates …
- L391 [7. The failure catalogue] \| leaving something broken unmentioned \| speed \| escalating every warning as …
- L392 [7. The failure catalogue] \| a canonical place nobody was told about \| order \| the …
- L393 [7. The failure catalogue] \| a verdict too terse to act on \| economy \| a …
- L395 [7. The failure catalogue] The last row is worth sitting with.
- L395 [7. The failure catalogue] Both halves are defended as economy, and both are economical — for …
- L395 [7. The failure catalogue] The terse verdict saves your words and spends the reader's investigation; the …
- L395 [7. The failure catalogue] The excuse never says economy for whom, and that is the tell …
- L403 [Red-flag phrases] Sentences that mean the failure is already in progress.
- L403 [Red-flag phrases] Under-recording first:
- L414 [Red-flag phrases] And the over-recording forms, which sound more responsible and are not:
- L426 [8. Arriving at a record that is already bad] The normal case.
- L426 [8. Arriving at a record that is already bad] Most projects have a record that is stale, split across three places, …
- L480 [10. The one-paragraph form] > Developer friendliness means the developer can stop paying attention to you …
- L480 [10. The one-paragraph form] You move faster than they can track, so everything you > learn, …
- L480 [10. The one-paragraph form] On anything worth keeping, ask three questions: will > someone need this …
- L480 [10. The one-paragraph form] Put it in the place the project already uses, > because a …
- L480 [10. The one-paragraph form] Write it at the moment, in one line where one > line …
- L480 [10. The one-paragraph form] Read it back the same way you > wrote it — cheapest …
- L480 [10. The one-paragraph form] And hold > all of it to that budget: a tracker nobody …
- L480 [10. The one-paragraph form] **This governs the record, never the > work.
- L480 [10. The one-paragraph form] It is not a reason to go slower, and never a substitute …

**`plugins/machinery/scripts/banner.mjs`**

- L50 [banner()] lines.push(` hosted check: ${fs.existsSync(path.join(root, '.github', 'workflows', 'machinery.yml')) ? 'present' : 'none — …
- L55 [banner()] lines.push(` pending: project ${proj}, universal ${univ}${proj + univ ? ' — intake …

**`plugins/machinery/scripts/capture.mjs`**

- L37 [main()] : `PRULE captured verbatim to the project root's inbox ${inbox} (PENDING). This …
- L44 [main()] : `SPEC captured verbatim to the project root's spec inbox ${inbox} (PENDING). …
- L64 [top-level] catch (e) { process.stderr.write(`rule capture failed (inbox not written): ${e.message}\n`); process.exitCode = …

**`plugins/machinery/scripts/quiet.mjs`**

- L147 [top-level] try { main(); } catch (e) { process.stderr.write(`quiet: hook failed (${e?.message ?? …

**`plugins/machinery/scripts/quiet-run.mjs`**

- L128 [main()] process.stderr.write(`quiet-run: unusable tool catalog (${e.message}); falling back to the generic filter\n`);
- L161 [main()] process.stderr.write(`quiet-run: unusable observation record (${e.message}); no candidate can be suggested\n`);
- L166 [main()] : `[quiet:suggest] ${key} is noisy here, and no untried quiet flag is …
- L208 [main()] : `[quiet:train] ${key}: nothing to identify this run — the log could …
- L214 [main()] if (ignored) process.stderr.write('quiet-run: created .claude/machinery/observations.json and added it to .gitignore (per-machine measurement, …

**`plugins/machinery/scripts/worktree-create.mjs`**

- L32 [top-level] if (!branch) fail(`empty worktree name; payload had name=${name === '' ? '""' …
- L38 [top-level] if (rc !== 0) fail(`git worktree add failed (exit ${rc})`);

**`plugins/machinery/scripts/gate/gate.mjs`**

- L61 [top-level] process.stdout.write(`gate: ${c.id} could not run — ${e.message}${c.blocking ? '' : ' (advisory; …

**`plugins/machinery/scripts/gate/register-check.mjs`**

- L67 [registerCheck()] try { pend = pending(inbox); } catch (e) { report('register_check', 1, 1, …
- L72 [registerCheck()] catch (e) { report('register_check', 1, 1, `rule files: ${e.message}`); return false; }
- L92 [registerCheck()] report('register_check', 0, 0, 'index rows (nothing staged under rules or the index)');
- L108 [registerCheck()] report('register_check', 0, 1, 'index comparison(s) failed');

**`plugins/machinery/scripts/gate/spec-check.mjs`**

- L85 [specCheck()] catch (e) { report('spec_check', 1, 1, `spec inbox malformed — ${e.message}`); return …
- L98 [specCheck()] report('spec_check', outside.length, filed.length, `filed spec path(s) outside ${toPosix(path.relative(root, specsDir))}/`);
- L104 [specCheck()] catch (e) { report('spec_check', 1, 1, `spec files: ${e.message}`); return false; }
- L119 [specCheck()] report('spec_check', 0, 0, 'spec index rows (nothing staged under specs or the …
- L131 [specCheck()] report('spec_check', 0, 1, 'spec index comparison(s) failed');

**`plugins/machinery/scripts/gate/sweep-guard.mjs`**

- L31 [sweepGuard()] process.stdout.write(`ADVISORY: sweep-guard denominator: ${staged.length} staged, ${added.length} newly-tracked, ${suspects.length} non-doc suspect(s).\n`);

**`plugins/machinery/templates/hosted-check.yml`**

- L1 [(comment header)] # Installed by /machinery:install --hosted. Runs the same document checks the

