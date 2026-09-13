# Issue Tracking Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the developer's one answer about where issue tracking lives a durable home — two files, three states, one function that decides whether to ask, and two commands that record the answer — so the question is asked once per project and remembered there afterward.

**Architecture:** `lib/layout.mjs` spells the two file names and the two state words once, and `lib/config.mjs` builds both paths from them. `install.mjs` seeds both files and never overwrites one. `lib/issue-tracking.mjs` is the precedence table as a pure function; `scripts/issue-tracking.mjs` is the command-line entry the assistant runs, with three subcommands — `decide`, `record-global`, `record-project` — and the session banner names that entry by absolute path. `intake.mjs` gains one piece of routing knowledge. The setup conversation is copy in the `developer-friendliness` skill, guarded by a copy check.

**Tech Stack:** Node (ESM `.mjs`), `node:test` + `node:assert/strict`, git. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md` (at `main` 09d40ff). Read it in full before starting any task. It carries the owner's Rulings A–H verbatim; this plan does not restate them and does not soften them.

**How this plan is executed (the owner's choice):** one agent per task, one at a time, and each task's result is checked before the next task is dispatched. The tasks depend on each other, so they all run on **one effort branch in one working copy** — `issue-tracking-config` — sequentially. Never two agents in that copy at once. No executing agent spawns agents of its own.

## Global Constraints

Every task's requirements implicitly include this section.

**From the spec, verbatim:**

- **Route, never a credential.** *"**Records:** the route. Which tracker, which project or repository within it, which tool reaches it, and how to check the route works."* *"**Never records:** a credential. Not a token, not a password, not an API key — **and not the name of the place a token is stored.**"*
- **The prompt copy carries no marker instruction, neither `URULE:` nor `PRULE:`.** *"**No mark is offered, for either scope.** Neither `URULE:` nor `PRULE:` appears anywhere in the conversation (Rulings C and F). The developer answers in plain words."*
- **Only an answer recorded for this project stops the asking.** *"**In this project, only an answer recorded for this project stops the asking.** The conversation must not state or imply that answering for every project on this machine ends the asking here — not in the scope question, not in the labels on its two answers, and not in whatever the assistant says after writing the global file. Copy that reads as "tell me once and I stop asking everywhere" is wrong copy."*
- **Names and state words spelled once, in `layout.mjs`.** *"**Both state words are declared in `layout.mjs`, alongside the two file names, and are never spelled at a call site.**"* And: *"**The names are the owner's, verbatim, underscores included.** They do not match the kebab-case of the other rule files in `rules/` and are not to be "corrected" to match."*
- **Illustrations use visible placeholders.** *"Any illustration of a detected or recorded value uses placeholders that cannot be mistaken for real values — `<tracker>`, `<project>`, `<tool>` and the like — never a plausible sample."* This plan's test fixtures follow the same rule.
- **Three states, never merged.** *"**`unanswered` and `none` are distinct states and neither may be merged into the other, nor into absence of the file.**"* And: *"An empty file and an absent file are therefore different, and must stay different: absent defers to the global file, empty does not."*
- **Seeding never overwrites.** *"**an existing file is never overwritten, whatever it says** — an empty file included."*
- **The global write touches the global file alone.** *"Recording a global answer never touches `<project>/.claude/rules/project_issue_tracking.md`, whatever that file says."* Having the global write also seed the project file was offered to the owner and refused (Ruling D); it is not available to this plan.
- **No global route through intake.** *"**No global route is added.** Under Ruling A the global answer never reaches intake, and in particular `--kind universal` gains nothing for issue tracking."*
- **The reachability read is read-only.** *"**Never:** creating, editing, commenting on, labelling, assigning, closing or reopening anything on the tracker — **not even a test issue to prove write access**; changing the tool's authentication or configuration on the developer's behalf (the developer runs any login themselves); or recording anything the read returned."* **What the implementer must never make it do:** no command in this plan performs the reachability read, probes write access, or records a read's result; no test stands a stub tracker in for it (the spec: *"a stub-tracker test would exercise only the stub"*); and no copy may permit a write. It remains an act the assistant performs under instructions, enforced by nothing but those instructions, as the spec's *Open questions* 2 records.

**From this repository, measured on this branch at 09d40ff:**

- **Every commit that changes a plugin directory bumps that plugin's patch version in the same commit.** `node scripts/build-skills.mjs check` (`validateVersions()`) diffs each plugin tree against the commit where its current version string was set, and `.githooks/pre-commit` runs it first. Current versions: `plugins/machinery` **0.1.112**, `plugins/developer-friendliness` **0.1.2**. Each task names the bump it owns.
- **A skill is edited at its bucket source, never at the staged copy.** `claude-code/<plugin>/<skill>/SKILL.md` is the source; `node scripts/build-skills.mjs build` regenerates `plugins/<plugin>/skills/<skill>/SKILL.md`, and `check` fails on drift. (Verified: the two copies of `developer-friendliness` and of `rule-intake` are byte-identical today; the spec names the staged copy, which is the wrong place to edit.)
- **The machinery suite has a 20-second budget.** `.githooks/pre-commit` fails when `node --test 'plugins/machinery/test/*.test.mjs'` takes more than 20 s. Baseline measured on this branch: **649 tests, 648 pass, 1 skipped, `duration_ms` 13108**. Measured per case: install tests 0.25–0.77 s, intake tests 0.75–1.49 s. If a task's run goes over 20 s, **stop and report the measured seconds**. Never trim or merge assertions to fit, and never move a suite behind a flag on your own authority — that remedy is the owner's decision.
- **Every suite file under `plugins/machinery/test/` contains the literal `RED CHECK`.** `meta.test.mjs` fails the whole suite otherwise.
- **`JSON.stringify(` may not appear under `plugins/machinery/scripts/`** outside the named exemptions (`gate-purity.test.mjs`). The new command prints plain lines.
- **A subprocess test must blank `CLAUDE_CODE_SESSION_ID` when it asserts that variable's absence.** Tests run from a Claude Code session inherit it (measured present in this session's tool environment).
- **Commits name exact paths**, message and flags before the `--` separator, never `git add -A` or `git commit -a`, the ticket marker `(#99)` in the subject, and the attribution trailer your own session's instructions specify.
- **Do not pass `--quiet`-style flags** to any tool whose output a step asks you to read.

---

## Decisions made after the spec — PENDING THE OWNER'S CONFIRMATION

These three are **not rulings**. The spec left each question open. The main conversation decided them and put them to the owner; **he has not yet confirmed them.** They are carried here so the plan can be written; Task 9 amends the spec to match them, and Task 9 does not run until he has confirmed them.

### Decision 1 — both answers are recorded through commands, never typed freehand

**Grounds, measured by the spec's own author:** `plugins/machinery/scripts/lib/inbox.mjs` **silently skips** an entry whose heading it does not recognise — the answer is lost with no warning and no blocked commit — and **throws** on a recognised heading with no disposition line, breaking every tool that reads the inbox. Nothing today helps write a correctly shaped entry. (Re-verified in `parseInbox()`: `HEAD.exec` failing means `continue`; a recognised heading reaching the next heading or end of file with no `disposition:` line throws `malformed inbox`.)

- **Project route:** `issue-tracking.mjs record-project` appends the inbox entry in the exact shape `lib/inbox.mjs` reads, carrying the note `rules/rule-governance.md` § Dictating a rule requires (that automatic capture did not fire, and why). It **reads the entry back through the parser after writing** and fails loudly unless the parser finds exactly that entry. Intake then files it into `project_issue_tracking.md`. This is still Ruling F — the assistant writes the inbox entry; the command only guarantees the shape.
- **Global route:** `issue-tracking.mjs record-global` writes `~/.claude/rules/global_issue_tracking.md` and **nothing else** — no inbox entry, no intake, no write under `rulesSource()`, no commit, never the project file. This is still Ruling A — written directly, outside the pipeline; the command only makes that testable.
- **Consequence:** the spec's three assertions that had no product code now have some. **7(a3)** is carried by Task 6 (`record-project` writes exactly one entry, with the note, read back through the parser). **7(b)** is carried by Task 5 (`record-global`'s negative assertions, plus a refusal when the global file would land under `rulesSource()`) and Task 7 (intake refuses `--issue-tracking` on `--kind universal`). **The first half of 12** is carried by Task 5 (`record-global` leaves a seeded project file byte-identical).
- **Spec sections it overrides or extends:** extends *How the answer is recorded: two routes, deliberately different*; overrides the *The honest limits* bullet "The project entry is written by hand, and loses capture's guarantees" in its sentences "Nothing checks that exactly one entry was written…" and "No command exists for writing such an entry; the assistant edits the file."; changes the notes attached to tests 7(a3), 7(b) and 12; closes *Open questions*, observations 2 and 3.

### Decision 2 — the function runs the first time a session needs a tracker for this project

Not at session start. **Carried forward by the main conversation, not a fresh ruling:** it is the owner's own answer earlier in this design conversation, on when setup should happen — *"Lazily, first time the tracker is needed."* — which the later redesign never replaced.

- **Spec section it settles:** *Open questions*, observation 1 ("When the function is run is not specified"). Extends *Precedence* ("The instruction in `developer-friendliness` § 3.2 and § 8 is to run it").
- **Carried by:** Task 8's copy ("The first time this session needs a tracker for this project, run…"). Nothing mechanical enforces the moment; it is prose, as the spec already says the call itself is.

### Decision 3 — no machinery installed: one plain notice, then nothing

If the function cannot be found, the assistant says once, plainly, that project issue-tracking setup needs machinery installed, and does not prompt or write anything. **Grounds:** `plugins/machinery/rules/design-invariants.md` § Telling the user what you dropped — a silent skip reads as success.

- **Spec section it settles:** the first half of *Open questions*, 1 ("what the skill does there"). It leaves no project route to design for a project without machinery: nothing is prompted and nothing is written.
- **Carried by:** Task 4 (the banner names the command, or says `MISSING`) and Task 8 (the copy carries the notice, and the copy check requires it).

---

## Choices this plan makes (implementation latitude, not decisions)

The spec leaves these to the implementation (*"Its name, its command-line entry's name and its output shape are the implementation's to choose"*; tests 9, 11 and 13 each say *"the implementation has to settle"*). They are this plan's, labelled as such, and a reviewer may reject any of them without touching a ruling or a decision.

1. **How the skill finds the command: a session-banner line.** `developer-friendliness` is installed into `~/.claude/rules` and has no `${CLAUDE_PLUGIN_ROOT}` of its own, and machinery's cache path is versioned. Machinery's SessionStart banner already runs with `${CLAUDE_PLUGIN_ROOT}` and prints measured facts, so it gains one line, `issue tracking command: node "<absolute path>"`, or `MISSING — expected at <path>` when the script is absent. A session with no such line is a session without machinery (Decision 3). The banner **prints a path; it does not run the function**, so Decision 2 holds. **This interface is not settled by the spec or by the three decisions, and is the first thing to put to the main conversation.**
2. **Whitespace-only reads as `unanswered`** (the spec's observation 6). Both state comparisons are made after `trim()`; install seeds the word followed by one newline.
3. **A global `none` is a pre-fill.** The precedence row reads *"the global answer, if any, is the pre-fill"*, and the state table says `none` carries an answer, so a project asking on a machine answered `none` is offered `none`. Recorded under *Open questions*.
4. **`decide` and `record-project` address the project root that owns the common git directory.** From inside a worktree that is the main checkout — the same root the capture hook writes to and intake files from. Recorded under *Open questions* because Claude Code loads the worktree's own `.claude/rules`.
5. **Intake's routing is a flag, `--issue-tracking`, with a derived home and no `§ Section`.** Intake cannot use `place.mjs`, which appends a bullet under a heading and would leave the seeded word above the answer (re-verified in `place.mjs`). The disposition is `filed → .claude/rules/project_issue_tracking.md`; `filedPath()` already tolerates no `§`, and no gate check reads a project disposition's section (re-verified: only `spec-check.mjs` calls `filedPath()`).
6. **One answer validator, shared** by `record-global`, `record-project` and intake: an empty answer and the seeded word are refused (each would record "unanswered"), and so is an answer the rules-index parser would throw on.
7. **`record-project` refuses a second pending issue-tracking entry**, so "one answer, one entry" has a mechanism beyond copy.
8. **The session id comes from `--session` or `$CLAUDE_CODE_SESSION_ID`**, read in one function; with neither, the command cannot run and says which two it looked at.

---

## Predictions, written before any work

Each is confirmed one by one in Task 9, with the command and its output.

1. After every task, the sole-spelling scan over `plugins/machinery/scripts/` finds exactly `lib/layout.mjs`.
2. At the end, these are byte-identical to 09d40ff: `plugins/machinery/scripts/capture.mjs`, `plugins/machinery/scripts/place.mjs`, `plugins/machinery/scripts/gate/`, `plugins/machinery/markers.json`, `plugins/machinery/rules/`, `plugins/machinery/register/`. Check: `git diff --stat 09d40ff -- <those paths>` prints nothing.
3. The installed gate's file list does not change: `install.test.mjs`'s existing "every relative import reachable…" case stays green with no edit.
4. `build-skills.mjs check` demands bumps on `machinery` and `developer-friendliness` only. Check: `git diff --stat 09d40ff -- plugins/unbreakable plugins/dreamy` prints nothing.
5. Every pre-existing machinery test still passes (`fail 0`), and the suite stays under 20 s.
6. `purity.test.mjs` stays green with no edit. It does not see `record-global`'s write, because its reach is a write call whose own line names `rules`; that is a limit of the scan, stated in Task 9's ledger, not an exemption this plan claims.
7. The `inbox.mjs` extraction in Task 6 changes no byte `appendEntry` writes: the pin written before it passes after it.
8. A freshly installed project's `RULES_INDEX.md` carries `| rules/project_issue_tracking.md | 🟢 | 0 |  |`, and the gate passes on the install's own staging.
9. No existing test file is modified except `install.test.mjs`, `banner.test.mjs`, `lib-inbox.test.mjs`, `capture.test.mjs`, `intake.test.mjs` and `lib-config.test.mjs`. Check: `git diff --name-only 09d40ff -- plugins/machinery/test scripts/test`.
10. `skills.test.mjs`'s CLI-flag scan passes over the edited `rule-intake` skill with no edit to that test.
11. The copy check over the real skill reports `4 of 4 copy rule(s) satisfied across 2 region(s)`.

**Beliefs this design rests on:** Claude Code exports `CLAUDE_CODE_SESSION_ID` to tool subprocesses (measured 2026-09-12 in this session's Bash environment; not measured in other Claude Code builds). A SessionStart hook's additional context stays readable later in the session (the existing banner relies on it). Claude Code loads `~/.claude/rules/` and `<project>/.claude/rules/` into every session (the spec's statement; not re-measured here).

---

## File Structure

| Path | Task | Responsibility |
|---|---|---|
| `plugins/machinery/scripts/lib/layout.mjs` | 1 | Declares `GLOBAL_ISSUE_TRACKING`, `PROJECT_ISSUE_TRACKING`, `UNANSWERED`, `NONE` — the sole spelling of each. |
| `plugins/machinery/scripts/lib/config.mjs` | 1 | `globalIssueTracking()` and `projectIssueTracking(root)`: the one place each path is built. |
| `plugins/machinery/test/issue-tracking-names.test.mjs` | 1 (new) | Test 9: the sole-spelling scan, what it must see, what it must not flag, what it cannot see. |
| `plugins/machinery/test/lib-config.test.mjs` | 1 | The two path builders. |
| `plugins/machinery/scripts/install.mjs` | 2 | Seeds both files, create-only. |
| `plugins/machinery/test/install.test.mjs` | 2 | Tests 1, 2, 10; the index row; the gate. |
| `plugins/machinery/scripts/lib/issue-tracking.mjs` | 3 (new), 5, 6 | Precedence (`fileState`, `decide`, `readIfPresent`); answer validation (`normalizeAnswer`); the project entry's shape (`entryText`, `findRecorded`, …). No path building, no CLI. |
| `plugins/machinery/test/issue-tracking.test.mjs` | 3 (new), 5, 6 | Tests 3, 4, 5, 6, 8, 14; validator and entry-shape units. |
| `plugins/machinery/scripts/issue-tracking.mjs` | 4 (new), 5, 6 | The command-line entry: `decide`, `record-global`, `record-project`. |
| `plugins/machinery/scripts/banner.mjs` | 4 | The `issue tracking command:` line. |
| `plugins/machinery/test/issue-tracking-cli.test.mjs` | 4 (new), 5, 6 | The command, end to end: tests 7(a3), 7(b), 12. |
| `plugins/machinery/test/banner.test.mjs` | 4 | The banner line, present and `MISSING`. |
| `plugins/machinery/scripts/lib/inbox.mjs` | 6 | `newStamp()` and `formatEntry()` extracted; `appendEntry` accepts a stamp. |
| `plugins/machinery/test/lib-inbox.test.mjs` | 6 | The byte pin; the stamp parameter. |
| `plugins/machinery/test/capture.test.mjs` | 6 | Test 7(a1). |
| `plugins/machinery/scripts/intake.mjs` | 7 | `--issue-tracking`: the one routing rule. |
| `claude-code/machinery/rule-intake/SKILL.md` (+ staged copy via `build`) | 7 | Step 2 names the route. |
| `plugins/machinery/test/intake.test.mjs` | 7 | Test 7(a2); the refusals. |
| `claude-code/developer-friendliness/developer-friendliness/SKILL.md` (+ staged copy via `build`) | 8 | § 3.2 and § 8: the conversation and the recording instructions. |
| `scripts/issue-tracking-copy.mjs` | 8 (new) | Tests 11 and 13 and the Decision 3 notice, over the real copy. |
| `scripts/test/issue-tracking-copy.test.mjs` | 8 (new) | The check's fixtures and its run over the real skill. |
| `docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md` | 9 | Amended for Decisions 1–3. |
| `docs/learnings/issue-tracking-config.md` | 9 (new) | The effort ledger: each prediction confirmed. |
| `plugins/machinery/README.md` | 9 | The banner bullet and the issue-tracking command. |

---

## Task 1: `layout.mjs` declares the names and the state words; `config.mjs` builds the two paths

**Files:**
- Modify: `plugins/machinery/scripts/lib/layout.mjs` (after `export const SPEC_INBOX = 'spec-inbox.md';`, line 21)
- Modify: `plugins/machinery/scripts/lib/config.mjs:5` (the layout import) and after line 22 (`projectRules`)
- Create: `plugins/machinery/test/issue-tracking-names.test.mjs`
- Modify: `plugins/machinery/test/lib-config.test.mjs` (import line 7; append one test)
- Modify: `plugins/machinery/.claude-plugin/plugin.json` (`0.1.112` → `0.1.113`)

**Interfaces:**
- Consumes: nothing new. `layout.mjs` imports only `node:path` and stays that way.
- Produces (every later task uses these exact names):
  - `layout.mjs`: `export const GLOBAL_ISSUE_TRACKING = 'global_issue_tracking.md'`, `export const PROJECT_ISSUE_TRACKING = 'project_issue_tracking.md'`, `export const UNANSWERED = 'unanswered'`, `export const NONE = 'none'`.
  - `config.mjs`: `export const globalIssueTracking = () => string` — `<MACHINERY_HOME or homedir>/.claude/rules/global_issue_tracking.md`, resolved at call time; `export const projectIssueTracking = (root: string) => string` — `<root>/.claude/rules/project_issue_tracking.md`.
- Ordering: Tasks 2–8 all depend on this task.

**Scope of the test-9 scan.** The spec: *"`none` is an ordinary word that appears as a string literal for unrelated reasons, so the check needs a scope narrow enough not to fire on those and wide enough to catch a second spelling of the state word."* Measured on this branch: the pattern below matches **0 files under `plugins/machinery/scripts/`**; it matches `plugins/machinery/test/lib-emit.test.mjs:20` (`probe('none', '')`, an unrelated argument) and `scripts/build-skills.mjs` (prose and a join fallback). So the scope is `plugins/machinery/scripts/`, recursively, `.mjs` only, and what it cannot see is named in the test title and pinned.

**Consequence for every later task:** no file under `plugins/machinery/scripts/` other than `layout.mjs` may contain either file name anywhere — **comments included** — nor either state word as a whole quoted literal, **backtick-quoted words in comments included**. Refer to them by constant name.

- [ ] **Step 1: Write the failing tests**

Create `plugins/machinery/test/issue-tracking-names.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { GLOBAL_ISSUE_TRACKING, PROJECT_ISSUE_TRACKING, UNANSWERED, NONE } from '../scripts/lib/layout.mjs';

// Issue tracking configuration, test 9 (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md).
// Two spellings of a file name is how the installer seeds one path and the function reads another;
// two spellings of a state word is the same failure, silent instead of loud — a machine where the
// prompt quietly stopped firing looks exactly like one where everything was answered.
// rules/design-invariants.md § One authority per switch: "a shared name is spelled once as one
// shared definition", and "A check built on searching always ships a case proving it still matches."

test('the names and the state words are the owner\'s, verbatim, and the two states are different words', () => {
  assert.equal(GLOBAL_ISSUE_TRACKING, 'global_issue_tracking.md');
  assert.equal(PROJECT_ISSUE_TRACKING, 'project_issue_tracking.md');
  assert.equal(UNANSWERED, 'unanswered');
  assert.equal(NONE, 'none');
  assert.notEqual(UNANSWERED, NONE);
});

const SPELLING = /(['"`])(?:unanswered|none)(?:\\[nrt])*\1|global_issue_tracking|project_issue_tracking/;

const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const spellers = (dir) => walk(dir)
  .filter((f) => f.endsWith('.mjs') && SPELLING.test(fs.readFileSync(f, 'utf8')))
  .map((f) => path.relative(dir, f).split(path.sep).join('/'))
  .sort();

test('only lib/layout.mjs under scripts/ spells a state word or an issue-tracking file name — this scan cannot see a state word inside a longer string, a word or name assembled by concatenation, or anything outside scripts/', () => {
  assert.deepEqual(spellers(path.join(PLUGIN, 'scripts')), ['lib/layout.mjs']);
});

const SEEN = [
  ["fs.writeFileSync(f, 'unanswered\\n');", 'the seed written at a call site'],
  ['if (text === "unanswered") {}', 'a double-quoted comparison'],
  ['if (text === `none`) {}', 'a template literal'],
  ["const DECLINED_WORD = 'none';", 'the answered-negative word stored under another name'],
  ['// the file then says `unanswered`', 'a backtick-quoted word in a comment'],
  ["path.join(home, '.claude', 'rules', 'global_issue_tracking.md')", 'the global file name at a call site'],
  ['// seeds project_issue_tracking.md', 'the project file name in a comment'],
];

test('RED CHECK: the sole-spelling scan sees every way a second spelling has plausibly been written', () => {
  for (const [src, how] of SEEN) assert.match(src, SPELLING, how);
});

test('the scan does not flag the unrelated uses measured in this repository, or the constants themselves', () => {
  for (const clean of [
    "say('hosted check: none (the local merge gate is the sole blocking backstop)');",
    'export function none() { return null; }',
    'const label = `${UNANSWERED}`;',
    'if (text === NONE) return DECLINED;',
  ]) assert.doesNotMatch(clean, SPELLING, `false positive: ${clean}`);
});

// The title above names what the scan cannot see. Each is pinned unseen here, so a widening that
// starts catching one fails, and the title is corrected in the same change.
test('each blind spot named in the scan title is measured unseen', () => {
  for (const [src, how] of [
    ["if (text.includes('the file says unanswered')) {}", 'a state word inside a longer string'],
    ["const w = 'unans' + 'wered';", 'a word assembled by concatenation'],
    ["const f = 'project_' + 'issue_tracking.md';", 'a name assembled by concatenation'],
  ]) assert.doesNotMatch(src, SPELLING, `${how} is now SEEN — correct the scan title`);
});
```

In `plugins/machinery/test/lib-config.test.mjs`, change line 7 to:

```js
import { rulesSource, universalInbox, universalIndex, projectInbox, projectIndex, legacyProjectIndex, markers, pluginRoot, globalIssueTracking, projectIssueTracking } from '../scripts/lib/config.mjs';
```

and append:

```js
test('the two issue-tracking paths: the global file under the home\'s .claude/rules, the project file under the project\'s', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  process.env.MACHINERY_HOME = home;
  assert.equal(globalIssueTracking(), path.join(home, '.claude', 'rules', 'global_issue_tracking.md'));
  assert.equal(projectIssueTracking('R'), path.join('R', '.claude', 'rules', 'project_issue_tracking.md'));
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test plugins/machinery/test/issue-tracking-names.test.mjs plugins/machinery/test/lib-config.test.mjs`

Expected: both files FAIL at import — `SyntaxError: The requested module '../scripts/lib/layout.mjs' does not provide an export named 'GLOBAL_ISSUE_TRACKING'`, and `… '../scripts/lib/config.mjs' does not provide an export named 'globalIssueTracking'`.

- [ ] **Step 3: Write the declarations**

In `plugins/machinery/scripts/lib/layout.mjs`, immediately after `export const SPEC_INBOX = 'spec-inbox.md';`:

```js
// Issue tracking configuration (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md).
// Two files hold the developer's one answer about where issue tracking lives. Three units name them
// and none can import another — install.mjs seeds them, lib/issue-tracking.mjs reads them through
// config.mjs, intake.mjs routes to one — which is the condition this file exists for.
//
// The NAMES are the owner's, verbatim, underscores included; renaming them to kebab-case is a change
// to what the owner dictated, not a tidy-up.
//
// The STATE WORDS: UNANSWERED means install seeded the file and nobody has been asked (an empty file
// reads the same); NONE means asked and answered, no issue tracking here. They are distinct states,
// neither merged into the other nor into absence of the file. Install writes the word and the
// precedence function compares against it, so a mismatch between the two would fail SILENTLY.
export const GLOBAL_ISSUE_TRACKING = 'global_issue_tracking.md';
export const PROJECT_ISSUE_TRACKING = 'project_issue_tracking.md';
export const UNANSWERED = 'unanswered';
export const NONE = 'none';
```

In `plugins/machinery/scripts/lib/config.mjs`, change line 5 to:

```js
import { RULES_INDEX, LEGACY_RULES_INDEX, SPEC_INDEX, INBOX, SPEC_INBOX, RULES_DIR, DOCS_DIR, SPECS_DIR, MACHINERY_DIR, REGISTER_DIR, GLOBAL_ISSUE_TRACKING, PROJECT_ISSUE_TRACKING } from './layout.mjs';
```

and immediately after `export const projectRules = (root) => path.join(root, '.claude', RULES_DIR);`:

```js
// The two issue-tracking files (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md).
// Built here and nowhere else, so the installer that seeds them, the command that reads and records
// them, and intake that files one all address the same bytes.
export const globalIssueTracking = () => path.join(home(), '.claude', RULES_DIR, GLOBAL_ISSUE_TRACKING);
export const projectIssueTracking = (root) => path.join(projectRules(root), PROJECT_ISSUE_TRACKING);
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test plugins/machinery/test/issue-tracking-names.test.mjs plugins/machinery/test/lib-config.test.mjs`

Expected: PASS — 5 tests in the names suite, and the config suite green including the new case.

- [ ] **Step 5: Bump and run the full hook**

In `plugins/machinery/.claude-plugin/plugin.json` change `"version": "0.1.112"` to `"version": "0.1.113"`.

Run: `sh .githooks/pre-commit`

Expected: exit 0. `build-skills.mjs check` prints `✓ machinery 0.1.113 is a new version`; the machinery suite reports `fail 0`; the gate prints its `register_check` count line.

- [ ] **Step 6: Commit**

```bash
git add -- plugins/machinery/test/issue-tracking-names.test.mjs
git commit -m "layout: the issue-tracking file names and state words, spelled once (#99)" -- plugins/machinery/scripts/lib/layout.mjs plugins/machinery/scripts/lib/config.mjs plugins/machinery/test/issue-tracking-names.test.mjs plugins/machinery/test/lib-config.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

A brand-new file has to be added before `git commit -- <paths>` can name it; every later task that creates a file does the same.

---

## Task 2: Install seeds both files, create-only

**Files:**
- Modify: `plugins/machinery/scripts/install.mjs:10-11` (imports), `:37-46` (`installMachine()`), after `:73` (`installProject()`, the `mkdirSync` of `.claude/rules`, before the index is regenerated at `:102`)
- Modify: `plugins/machinery/test/install.test.mjs` (append)
- Modify: `plugins/machinery/.claude-plugin/plugin.json` (`0.1.113` → `0.1.114`)

**Interfaces:**
- Consumes (Task 1): `UNANSWERED` from `./lib/layout.mjs`; `globalIssueTracking`, `projectIssueTracking` from `./lib/config.mjs`.
- Produces: a module-private `seed(file) → boolean` in `install.mjs` (true when it created the file). The seeded bytes are exactly `` `${UNANSWERED}\n` ``, decided in that one function. Console lines `<path>: created` or `<path>: present, left as it is`.
- Ordering: the project seed is written **before** `generateIndex(rules)`, so the index install stages already carries its row; the staging list already includes `.claude/rules`.

**Why `flag: 'wx'`.** "Never overwritten, whatever it says" is enforced by the open itself: `wx` fails with `EEXIST` on any existing file, so there is no window between checking and writing.

- [ ] **Step 1: Write the failing tests**

Append to `plugins/machinery/test/install.test.mjs`:

```js
// Issue tracking configuration (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md,
// "Install seeds them", tests 1, 2 and 10). Fixture answers use visible placeholders (Ruling H).
const TRACKING_ANSWER = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.\nCheck: `<status command>` and `<one-item read command>`.\n';

test('project install seeds the project issue-tracking file once, indexes and stages it, and the gate passes (test 1)', () => {
  const r = makeRepo();
  try {
    const res = install(r.root);
    assert.equal(res.code, 0, res.stderr);
    const f = path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md');
    assert.equal(fs.readFileSync(f, 'utf8'), 'unanswered\n');
    assert.match(res.stdout, /\.claude[\\/]rules[\\/]project_issue_tracking\.md: created/);
    const idx = fs.readFileSync(path.join(r.root, '.claude', 'machinery', 'RULES_INDEX.md'), 'utf8');
    assert.match(idx, /^\| rules\/project_issue_tracking\.md \| 🟢 \| 0 \|  \|$/m, idx);
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: r.root, encoding: 'utf8' });
    assert.match(staged, /^\.claude\/rules\/project_issue_tracking\.md$/m, staged);
    const gate = runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(gate.code, 0, gate.stdout + gate.stderr);
    const before = fs.readFileSync(f);
    const again = install(r.root);
    assert.equal(again.code, 0, again.stderr);
    assert.deepEqual(fs.readFileSync(f), before, 'the second run changed the seeded file');
    assert.match(again.stdout, /\.claude[\\/]rules[\\/]project_issue_tracking\.md: present, left as it is/);
  } finally { r.cleanup(); }
});

// Asserted apart from test 1: "does not create twice" and "does not reset an answer" are different
// failures, and one assertion passes on either.
test('RED CHECK: an answered, a declined and an empty project file each survive a re-run of install byte-identical (test 2)', () => {
  const r = makeRepo();
  try {
    install(r.root);
    const f = path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md');
    for (const contents of [TRACKING_ANSWER, 'none\n', '']) {
      fs.writeFileSync(f, contents);
      const res = install(r.root);
      assert.equal(res.code, 0, res.stderr);
      assert.equal(fs.readFileSync(f, 'utf8'), contents, `install walked back over ${JSON.stringify(contents)}`);
    }
  } finally { r.cleanup(); }
});

// Test 10: the whole seed is the single state word, so a later change that seeds a detected remote, a
// token path or an account name fails rather than ships. The fixture HAS a remote, so there is
// something for such a change to leak.
test('the seed is the single state word and nothing detected about the repository (test 10)', () => {
  const r = makeRepo({ withOrigin: true });
  try {
    install(r.root);
    const contents = fs.readFileSync(path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md'), 'utf8');
    assert.equal(contents, 'unanswered\n');
    assert.equal(contents.trim().split(/\s+/).length, 1);
    assert.ok(!contents.includes(path.basename(r.origin)), 'the fixture remote reached the seed');
  } finally { r.cleanup(); }
});

test('--machine seeds the global issue-tracking file once and never overwrites an answer, a declined or an empty file (tests 1, 2)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const tempRules = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
  try {
    fs.writeFileSync(path.join(tempRules, 't.md'), '# T\n\n## One\n\n- rule 1\n');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: tempRules }));
    const machine = () => runScript('scripts/install.mjs', { args: ['--machine'], env: { MACHINERY_HOME: home } });
    const first = machine();
    assert.equal(first.code, 0, first.stderr);
    const f = path.join(home, '.claude', 'rules', 'global_issue_tracking.md');
    assert.equal(fs.readFileSync(f, 'utf8'), 'unanswered\n');
    assert.match(first.stdout, /global_issue_tracking\.md: created/);
    const second = machine();
    assert.equal(fs.readFileSync(f, 'utf8'), 'unanswered\n');
    assert.match(second.stdout, /global_issue_tracking\.md: present, left as it is/);
    for (const contents of [TRACKING_ANSWER, 'none\n', '']) {
      fs.writeFileSync(f, contents);
      assert.equal(machine().code, 0);
      assert.equal(fs.readFileSync(f, 'utf8'), contents, `--machine walked back over ${JSON.stringify(contents)}`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(tempRules, { recursive: true, force: true, maxRetries: 5 });
  }
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test plugins/machinery/test/install.test.mjs`

Expected: 4 new failures, the first `ENOENT: no such file or directory, open '…/.claude/rules/project_issue_tracking.md'`. Every pre-existing case in the file still passes.

- [ ] **Step 3: Write the seeding**

In `plugins/machinery/scripts/install.mjs`, change lines 10–11 to:

```js
import { pluginRoot, rulesSource, globalIssueTracking, projectIssueTracking } from './lib/config.mjs';
import { RULES_INDEX, LEGACY_RULES_INDEX, SPEC_INDEX, SPEC_INBOX, DOCS_DIR, SPECS_DIR, UNANSWERED } from './lib/layout.mjs';
```

Immediately above `function installMachine() {` add:

```js
// Issue tracking (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md, "Install seeds
// them"): the only thing install ever does to either file is create it when there is none. The `wx`
// flag makes "never overwritten, whatever it says — an empty file included" a property of the open
// itself rather than of a check made a moment earlier. Returns true when it created the file.
function seed(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, `${UNANSWERED}\n`, { flag: 'wx' }); return true; }
  catch (e) { if (e.code === 'EEXIST') return false; throw e; }
}
const seedLine = (shown, created) => `${shown}: ${created ? 'created' : 'present, left as it is'}`;
```

In `installMachine()`, between `say(\`~/.claude/rules/machinery -> ${src}: ${result}\`);` and `return 0;`:

```js
  const globalFile = globalIssueTracking();
  say(seedLine(globalFile, seed(globalFile)));
```

In `installProject()`, immediately after the line `fs.mkdirSync(rules, { recursive: true }); fs.mkdirSync(mach, { recursive: true }); fs.mkdirSync(specs, { recursive: true });`:

```js
  // Seeded before the index is regenerated below, so the index this run stages already has its row.
  const trackingFile = projectIssueTracking(root);
  say(seedLine(path.relative(root, trackingFile), seed(trackingFile)));
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test plugins/machinery/test/install.test.mjs plugins/machinery/test/issue-tracking-names.test.mjs`

Expected: PASS, all cases; the names scan still reports only `lib/layout.mjs`.

- [ ] **Step 5: Bump, run the hook, measure**

`plugins/machinery/.claude-plugin/plugin.json`: `"0.1.113"` → `"0.1.114"`.

Run: `sh .githooks/pre-commit` — expected exit 0, no over-budget line.
Run: `node --test 'plugins/machinery/test/*.test.mjs' 2>&1 | tail -9` — record `tests`, `fail` and `duration_ms` in your report. Over 20 s: stop and report.

- [ ] **Step 6: Commit**

```bash
git commit -m "install: seed both issue-tracking files, create-only (#99)" -- plugins/machinery/scripts/install.mjs plugins/machinery/test/install.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

## Task 3: The precedence function

**Files:**
- Create: `plugins/machinery/scripts/lib/issue-tracking.mjs`
- Create: `plugins/machinery/test/issue-tracking.test.mjs`
- Modify: `plugins/machinery/.claude-plugin/plugin.json` (`0.1.114` → `0.1.115`)

**Interfaces:**
- Consumes (Task 1): `UNANSWERED`, `NONE` from `./layout.mjs`.
- Produces:
  - `export const ABSENT = 'absent'`, `NO_ANSWER = 'no-answer'`, `DECLINED = 'declined'`, `ANSWERED = 'answered'`.
  - `export function fileState(contents: string | null): ABSENT | NO_ANSWER | DECLINED | ANSWERED` — `null` means the file does not exist. Compared after `trim()`: empty or `UNANSWERED` → `NO_ANSWER`; `NONE` → `DECLINED`; anything else → `ANSWERED`.
  - `export function decide({ project: string | null, global: string | null }): { ask: boolean, prefill: string | null }` — the spec's precedence table; `prefill` is the global file's trimmed text where the table says there is one.
  - `export function readIfPresent(file: string): string | null` — `null` on `ENOENT`, rethrows anything else.
- Ordering: Tasks 4, 5, 6 and 7 import from this module; Tasks 5 and 6 extend it.

- [ ] **Step 1: Write the failing test**

Create `plugins/machinery/test/issue-tracking.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ABSENT, NO_ANSWER, DECLINED, ANSWERED, fileState, decide, readIfPresent } from '../scripts/lib/issue-tracking.mjs';

// The precedence table of docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md (Ruling G).
// THE PROJECT FILE DECIDES WHENEVER IT EXISTS (Ruling B); the global file governs one row — no project
// file at all — and otherwise only pre-fills. Expectations come from the spec's table, spelled here as
// literals, never from the module under test.
const ANSWER = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.\nCheck: `<status command>` and `<one-item read command>`.\n';
const OTHER = 'Issue tracking: <other tracker> on `<other project>`, reached with `<other tool>`.\n';

test('fileState: three contents, and absence kept apart from all of them', () => {
  assert.equal(fileState(null), ABSENT);
  assert.equal(fileState('unanswered\n'), NO_ANSWER);
  assert.equal(fileState(''), NO_ANSWER, 'Ruling H: an empty file is read as unanswered');
  assert.equal(fileState('  \r\n'), NO_ANSWER, 'this plan: whitespace-only reads as empty (spec observation 6)');
  assert.equal(fileState('  unanswered \r\n'), NO_ANSWER);
  assert.equal(fileState('none\n'), DECLINED);
  assert.equal(fileState(ANSWER), ANSWERED);
  assert.equal(new Set([ABSENT, NO_ANSWER, DECLINED, ANSWERED]).size, 4);
});

// TEST 3 — three global cases (and absent), because the global-answer case is the one Ruling B decided
// and the one a later "simplification" breaks first.
test('RED CHECK: a project unanswered asks, whatever the global file says (test 3)', () => {
  for (const g of ['unanswered\n', 'none\n', ANSWER, null]) {
    assert.equal(decide({ project: 'unanswered\n', global: g }).ask, true, `global ${JSON.stringify(g)} suppressed the ask`);
  }
});

// TEST 4 — each asserted with the global unanswered AND with a different tracker line, so a function
// that consults the global file for the decision at all is caught.
test('a project none and a project answer do not ask (test 4)', () => {
  for (const g of ['unanswered\n', OTHER]) {
    assert.deepEqual(decide({ project: 'none\n', global: g }), { ask: false, prefill: null });
    assert.deepEqual(decide({ project: ANSWER, global: g }), { ask: false, prefill: null });
  }
});

// TEST 5 — the only row where the global file decides anything.
test('with no project file, the global file governs (test 5)', () => {
  assert.deepEqual(decide({ project: null, global: ANSWER }), { ask: false, prefill: null });
  assert.deepEqual(decide({ project: null, global: 'none\n' }), { ask: false, prefill: null });
  for (const g of ['unanswered\n', '', null]) {
    assert.deepEqual(decide({ project: null, global: g }), { ask: true, prefill: null }, `global ${JSON.stringify(g)}`);
  }
});

// TEST 6 — pre-fill is one of the global file's only two jobs; a change making it inert passes all else.
test('the global answer is the pre-fill (test 6)', () => {
  assert.deepEqual(decide({ project: 'unanswered\n', global: ANSWER }), { ask: true, prefill: ANSWER.trim() });
  assert.deepEqual(decide({ project: 'unanswered\n', global: 'unanswered\n' }), { ask: true, prefill: null });
  assert.deepEqual(decide({ project: 'unanswered\n', global: null }), { ask: true, prefill: null });
  // This plan's reading of "the global answer, if any, is the pre-fill": none carries an answer.
  assert.deepEqual(decide({ project: 'unanswered\n', global: 'none\n' }), { ask: true, prefill: 'none' });
});

// TEST 8 — positive control, both directions: a function that never asks and one that always asks each
// fail here, so tests 4 and 5 cannot pass for free.
test('positive control: the function asks on a project unanswered, and is not stuck asking (test 8)', () => {
  assert.strictEqual(decide({ project: 'unanswered\n', global: null }).ask, true, 'the decision is dead');
  assert.strictEqual(decide({ project: ANSWER, global: null }).ask, false, 'the decision is stuck on');
});

// TEST 14 — Ruling H.
test('an empty file is read as unanswered, and an empty project file is not an absent one (test 14)', () => {
  assert.deepEqual(decide({ project: '', global: 'unanswered\n' }), { ask: true, prefill: null });
  assert.deepEqual(decide({ project: '', global: ANSWER }), { ask: true, prefill: ANSWER.trim() }, 'the empty project file handed the decision to the global file');
  assert.deepEqual(decide({ project: null, global: '' }), { ask: true, prefill: null });
  assert.notDeepEqual(decide({ project: '', global: ANSWER }), decide({ project: null, global: ANSWER }));
  assert.equal(decide({ project: null, global: ANSWER }).ask, false);
});

test('readIfPresent: null for a missing file, the text for a present one, and a loud error for anything else', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'it-'));
  try {
    assert.equal(readIfPresent(path.join(d, 'missing', 'x.md')), null);
    fs.writeFileSync(path.join(d, 'x.md'), 'none\n');
    assert.equal(readIfPresent(path.join(d, 'x.md')), 'none\n');
    assert.throws(() => readIfPresent(d), /EISDIR|illegal operation on a directory/);
  } finally { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 }); }
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test plugins/machinery/test/issue-tracking.test.mjs`

Expected: FAIL — `Cannot find module '…/plugins/machinery/scripts/lib/issue-tracking.mjs'`.

- [ ] **Step 3: Write the function**

Create `plugins/machinery/scripts/lib/issue-tracking.mjs`:

```js
// Story: docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md § Precedence (Ruling G).
// The precedence table as a function the assistant runs, through scripts/issue-tracking.mjs, to decide
// whether to begin the setup conversation. It reads nothing but the text it is handed, writes nothing,
// detects nothing and asks nothing. Paths are built in lib/config.mjs; the state words come from
// lib/layout.mjs and are never spelled here.
import fs from 'node:fs';
import { UNANSWERED, NONE } from './layout.mjs';

// What one file holds, as the table reads it. ABSENT is the file system's condition, kept apart from
// the three contents because "absent defers to the global file, empty does not".
export const ABSENT = 'absent';
export const NO_ANSWER = 'no-answer';
export const DECLINED = 'declined';
export const ANSWERED = 'answered';

// Compared after trim(): an empty file is read as unanswered (Ruling H), and whitespace-only counts as
// empty (this plan, settling the spec's observation 6 — the seed itself ends with a newline).
export function fileState(contents) {
  if (contents === null) return ABSENT;
  const text = contents.trim();
  if (text === '' || text === UNANSWERED) return NO_ANSWER;
  if (text === NONE) return DECLINED;
  return ANSWERED;
}

const carriesAnswer = (state) => state === DECLINED || state === ANSWERED;

// The project file decides whenever it exists (Ruling B). A global answer never silences a project
// whose own file carries no answer (Rulings B and D); it is that project's pre-fill instead.
export function decide({ project, global: globalContents }) {
  const projectState = fileState(project);
  const globalState = fileState(globalContents);
  if (projectState === ABSENT) return { ask: !carriesAnswer(globalState), prefill: null };
  if (carriesAnswer(projectState)) return { ask: false, prefill: null };
  return { ask: true, prefill: carriesAnswer(globalState) ? globalContents.trim() : null };
}

// A missing file is data (the absent rows of the table); anything else that stops the read is not,
// and is thrown so the caller reports it rather than deciding on a file it never saw.
export function readIfPresent(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test plugins/machinery/test/issue-tracking.test.mjs plugins/machinery/test/issue-tracking-names.test.mjs`

Expected: PASS — 8 cases in the new suite; the names scan still reports only `lib/layout.mjs`.

- [ ] **Step 5: Bump and run the hook**

`plugins/machinery/.claude-plugin/plugin.json`: `"0.1.114"` → `"0.1.115"`. Run `sh .githooks/pre-commit`; expected exit 0.

- [ ] **Step 6: Commit**

```bash
git add -- plugins/machinery/scripts/lib/issue-tracking.mjs plugins/machinery/test/issue-tracking.test.mjs
git commit -m "issue tracking: the precedence table as a function (#99)" -- plugins/machinery/scripts/lib/issue-tracking.mjs plugins/machinery/test/issue-tracking.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

## Task 4: The `decide` command, and the banner line that names it

**Files:**
- Create: `plugins/machinery/scripts/issue-tracking.mjs`
- Modify: `plugins/machinery/scripts/banner.mjs` (after line 57, the `cant-break-by-design` line)
- Create: `plugins/machinery/test/issue-tracking-cli.test.mjs`
- Modify: `plugins/machinery/test/banner.test.mjs` (append)
- Modify: `plugins/machinery/.claude-plugin/plugin.json` (`0.1.115` → `0.1.116`)

**Interfaces:**
- Consumes: `decide`, `readIfPresent` (Task 3); `globalIssueTracking`, `projectIssueTracking` (Task 1); `UNANSWERED`, `NONE` (Task 1); `projectRoot` (`lib/root.mjs`, existing).
- Produces:
  - Command: `node scripts/issue-tracking.mjs decide [--root <dir>]`. Exit 0 when it ran; exit 2 when it cannot run (message on stderr beginning `issue_tracking: CANNOT RUN:`, no verdict printed).
  - First stdout line: `issue_tracking: ask (read 2 of 2 file locations)` or `issue_tracking: do not ask (read 2 of 2 file locations)`; then `issue_tracking: project file <abs>: <description>`, `issue_tracking: global file <abs>: <description>`, and either `issue_tracking: pre-fill: nothing to offer` or `issue_tracking: pre-fill (<n> line(s)):` followed by each line prefixed `| `.
  - Module constants `VERDICT_ASK = 'issue_tracking: ask'`, `VERDICT_DO_NOT_ASK = 'issue_tracking: do not ask'`; a `COMMANDS` object whose keys are quoted strings (`'decide'` here; Tasks 5 and 6 add `'record-global'`, `'record-project'`); classes `Refused` (exit 1) and `CannotRun` (exit 2); helpers `opt(flag)` and `resolveRoot()`. Task 8's copy check reads the quoted literals from this source.
  - Banner line: `  issue tracking command: node "<absolute path to scripts/issue-tracking.mjs>"`, or `  issue tracking command: MISSING — expected at <path>`.
- Ordering: Tasks 5 and 6 extend this file and this test file; Task 8's copy names the banner label and the verdict line.

- [ ] **Step 1: Write the failing tests**

Create `plugins/machinery/test/issue-tracking-cli.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo, addWorktree } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';

// scripts/issue-tracking.mjs end to end (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md,
// Ruling G; this plan's Decisions 1 and 3). Answers are visible placeholders (Ruling H).
const ANSWER = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.\nCheck: `<status command>` and `<one-item read command>`.\n';
const tempHome = () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(h, '.claude', 'rules'), { recursive: true });
  return h;
};
const cli = (args, { cwd, home, env = {} }) => runScript('scripts/issue-tracking.mjs', { args, cwd, env: { MACHINERY_HOME: home, ...env } });
const projectFile = (root) => path.join(root, '.claude', 'rules', 'project_issue_tracking.md');
const globalFile = (home) => path.join(home, '.claude', 'rules', 'global_issue_tracking.md');
const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

test('decide prints the verdict first, both files, and the global answer as the pre-fill', () => {
  const r = makeRepo(); const h = tempHome();
  try {
    put(projectFile(r.root), 'unanswered\n');
    put(globalFile(h), ANSWER);
    const res = cli(['decide', '--root', r.root], { cwd: r.root, home: h });
    assert.equal(res.code, 0, res.stderr);
    const lines = res.stdout.split(/\r?\n/);
    assert.equal(lines[0], 'issue_tracking: ask (read 2 of 2 file locations)');
    assert.match(res.stdout, /^issue_tracking: project file .*project_issue_tracking\.md: unanswered$/m);
    assert.match(res.stdout, /^issue_tracking: global file .*global_issue_tracking\.md: carries an answer$/m);
    assert.match(res.stdout, /^issue_tracking: pre-fill \(2 line\(s\)\):$/m);
    assert.match(res.stdout, /^\| Issue tracking: <tracker> on `<project>`, reached with `<tool>`\.$/m);
  } finally { r.cleanup(); }
});

// This plan's choice 4: from inside a worktree, decide reads the root checkout's project file — the
// same root the capture hook writes to and intake files from.
test('decide from inside a worktree reads the root checkout\'s project file', () => {
  const r = makeRepo(); const h = tempHome();
  try {
    const wt = addWorktree(r.root, 'feat');
    put(projectFile(r.root), 'none\n');
    assert.ok(!fs.existsSync(projectFile(wt)), 'the fixture must not give the worktree a file of its own');
    const res = cli(['decide'], { cwd: wt, home: h });
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /^issue_tracking: do not ask \(read 2 of 2 file locations\)$/m);
    assert.match(res.stdout, /^issue_tracking: project file .*: none$/m);
    assert.match(res.stdout, /^issue_tracking: global file .*: absent$/m);
    assert.match(res.stdout, /^issue_tracking: pre-fill: nothing to offer$/m);
  } finally { r.cleanup(); }
});

test('RED CHECK: outside a git repository decide cannot run — exit 2, the directory named, no verdict', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  const res = cli(['decide', '--root', d], { cwd: d, home: tempHome() });
  assert.equal(res.code, 2);
  assert.match(res.stderr, /^issue_tracking: CANNOT RUN: cannot resolve the project root from /m);
  assert.doesNotMatch(res.stdout, /issue_tracking: (ask|do not ask)/);
});

test('an unknown subcommand prints the usage and exits 2', () => {
  const res = cli(['decidee'], { cwd: os.tmpdir(), home: tempHome() });
  assert.equal(res.code, 2);
  assert.match(res.stderr, /usage: issue-tracking\.mjs decide/);
});
```

Append to `plugins/machinery/test/banner.test.mjs`:

```js
// Issue tracking, this plan's choice 1 and Decision 3: the developer-friendliness skill finds the decide
// command by this line, and a session without the line is one without machinery.
test('names the issue-tracking command by an absolute path that exists', () => {
  const r = makeRepo();
  try {
    const m = /issue tracking command: node "([^"]+)"/.exec(text(run(r.root)));
    assert.ok(m, 'the banner does not name the issue-tracking command');
    assert.ok(path.isAbsolute(m[1]), m[1]);
    assert.equal(fs.realpathSync.native(m[1]), fs.realpathSync.native(path.join(PLUGIN, 'scripts', 'issue-tracking.mjs')));
  } finally { r.cleanup(); }
});

test('RED CHECK: a plugin root without the command is reported MISSING, never offered as runnable', () => {
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'plug-'));
  const r = makeRepo();
  try {
    fs.mkdirSync(path.join(fake, '.claude-plugin'));
    fs.copyFileSync(path.join(PLUGIN, '.claude-plugin', 'plugin.json'), path.join(fake, '.claude-plugin', 'plugin.json'));
    fs.copyFileSync(path.join(PLUGIN, 'markers.json'), path.join(fake, 'markers.json'));
    const t = text(run(r.root, { CLAUDE_PLUGIN_ROOT: fake }));
    assert.match(t, /issue tracking command: MISSING — expected at .*issue-tracking\.mjs/);
    assert.doesNotMatch(t, /issue tracking command: node /);
  } finally { r.cleanup(); fs.rmSync(fake, { recursive: true, force: true, maxRetries: 5 }); }
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test plugins/machinery/test/issue-tracking-cli.test.mjs plugins/machinery/test/banner.test.mjs`

Expected: the four CLI cases FAIL (the script does not exist: exit code 1 from node with `Cannot find module`, so `res.code` is 1, not 0 or 2); the two new banner cases FAIL (`the banner does not name the issue-tracking command`; the `MISSING` pattern does not match). Pre-existing banner cases pass.

- [ ] **Step 3: Write the command**

Create `plugins/machinery/scripts/issue-tracking.mjs`:

```js
#!/usr/bin/env node
// Story: docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md § Precedence (Ruling G) — the
// command-line entry the developer-friendliness skill runs, found through the session banner's
// "issue tracking command:" line. Subcommands are keys of COMMANDS, quoted, because the repository's
// copy check (scripts/issue-tracking-copy.mjs) reads them from this source.
//
// Exit codes: 0 done; 1 refused (nothing written); 2 cannot run (nothing written, no verdict printed —
// a check that could not run never reads as one that ran).
import path from 'node:path';
import { projectRoot } from './lib/root.mjs';
import { globalIssueTracking, projectIssueTracking } from './lib/config.mjs';
import { UNANSWERED, NONE } from './lib/layout.mjs';
import { decide, readIfPresent } from './lib/issue-tracking.mjs';

const VERDICT_ASK = 'issue_tracking: ask';
const VERDICT_DO_NOT_ASK = 'issue_tracking: do not ask';

class Refused extends Error {}
class CannotRun extends Error {}

const argv = process.argv.slice(2);
const opt = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? (argv[i + 1] ?? '') : null; };

function resolveRoot() {
  const from = opt('--root') ?? process.cwd();
  try { return projectRoot(path.resolve(from)); }
  catch (e) { throw new CannotRun(`cannot resolve the project root from ${from}: ${e.message}`); }
}

// Describes a file's contents for the report. The decision itself is decide()'s alone.
function describe(contents) {
  if (contents === null) return 'absent';
  const text = contents.trim();
  if (text === '') return `empty, read as ${UNANSWERED}`;
  if (text === UNANSWERED || text === NONE) return text;
  return 'carries an answer';
}

function runDecide() {
  const root = resolveRoot();
  const files = { project: projectIssueTracking(root), global: globalIssueTracking() };
  const contents = { project: readIfPresent(files.project), global: readIfPresent(files.global) };
  const { ask, prefill } = decide(contents);
  const out = [
    `${ask ? VERDICT_ASK : VERDICT_DO_NOT_ASK} (read 2 of 2 file locations)`,
    `issue_tracking: project file ${files.project}: ${describe(contents.project)}`,
    `issue_tracking: global file ${files.global}: ${describe(contents.global)}`,
  ];
  if (prefill === null) out.push('issue_tracking: pre-fill: nothing to offer');
  else {
    const lines = prefill.split(/\r?\n/);
    out.push(`issue_tracking: pre-fill (${lines.length} line(s)):`, ...lines.map((l) => `| ${l}`));
  }
  process.stdout.write(`${out.join('\n')}\n`);
  return 0;
}

const COMMANDS = { 'decide': runDecide };
const USAGE = ['issue-tracking.mjs decide [--root <dir>]'];

function main() {
  const run = COMMANDS[argv[0]];
  if (!run) { process.stderr.write(`usage: ${USAGE.join('\n       ')}\n`); return 2; }
  return run();
}

try { process.exitCode = main(); }
catch (e) {
  if (e instanceof Refused) { process.stderr.write(`issue_tracking: refused: ${e.message}\n`); process.exitCode = 1; }
  else { process.stderr.write(`issue_tracking: CANNOT RUN: ${e.message}\n`); process.exitCode = 2; }
}
```

`Refused` is declared now and first thrown in Task 5; leaving it unused for one task is deliberate, so the exit-code contract in the header is true from the first commit.

In `plugins/machinery/scripts/banner.mjs`, immediately after the line that pushes `cant-break-by-design skill (mandatory): …`:

```js
  // Issue tracking (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md; the plan's
  // Decision 3): the developer-friendliness skill finds the decide command by this line, and a session
  // with no such line is a session without machinery. Measured: a missing script is named MISSING and
  // never offered as runnable. Printing the path runs nothing.
  const trackingCommand = path.join(pluginRoot(), 'scripts', 'issue-tracking.mjs');
  lines.push(`  issue tracking command: ${fs.existsSync(trackingCommand) ? `node "${trackingCommand}"` : `MISSING — expected at ${trackingCommand}`}`);
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test plugins/machinery/test/issue-tracking-cli.test.mjs plugins/machinery/test/banner.test.mjs plugins/machinery/test/issue-tracking-names.test.mjs plugins/machinery/test/gate-purity.test.mjs`

Expected: PASS, all cases.

- [ ] **Step 5: Bump, run the hook, measure**

`plugins/machinery/.claude-plugin/plugin.json`: `"0.1.115"` → `"0.1.116"`. Run `sh .githooks/pre-commit` (exit 0) and `node --test 'plugins/machinery/test/*.test.mjs' 2>&1 | tail -9`; record `duration_ms`. Over 20 s: stop and report.

- [ ] **Step 6: Commit**

```bash
git add -- plugins/machinery/scripts/issue-tracking.mjs plugins/machinery/test/issue-tracking-cli.test.mjs
git commit -m "issue tracking: the decide command, named by the session banner (#99)" -- plugins/machinery/scripts/issue-tracking.mjs plugins/machinery/scripts/banner.mjs plugins/machinery/test/issue-tracking-cli.test.mjs plugins/machinery/test/banner.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

## Task 5: `record-global` — the global file, and nothing else (Decision 1)

**Files:**
- Modify: `plugins/machinery/scripts/lib/issue-tracking.mjs` (append `normalizeAnswer`)
- Modify: `plugins/machinery/scripts/issue-tracking.mjs` (add `record-global`)
- Modify: `plugins/machinery/test/issue-tracking.test.mjs` (append)
- Modify: `plugins/machinery/test/issue-tracking-cli.test.mjs` (append)
- Modify: `plugins/machinery/.claude-plugin/plugin.json` (`0.1.116` → `0.1.117`)

**Interfaces:**
- Consumes: `globalIssueTracking`, `rulesSource` (`lib/config.mjs`); `parseRuleFile` (`lib/frontmatter.mjs`, existing); `UNANSWERED` (Task 1); Task 4's `COMMANDS`, `USAGE`, `opt`, `Refused`, `CannotRun`.
- Produces:
  - `export function normalizeAnswer(raw: string | null): string` in `lib/issue-tracking.mjs` — CRLF to LF, trimmed; throws `Error` for an empty answer, for the seeded word, and for text `parseRuleFile` throws on. Tasks 6 and 7 use it.
  - Command: `node scripts/issue-tracking.mjs record-global --answer "<answer>"`. Writes `<answer>\n` to `globalIssueTracking()`; exit 0 with `issue_tracking: wrote 1 of 1 file: <abs>` and `issue_tracking: nothing else was written — no inbox entry, no intake, no commit, and no project file`. Refused (exit 1, nothing written) when `--answer` is missing or invalid, or when the global file's directory is inside `rulesSource()`. Takes no `--root`: it never resolves a project.
- Ordering: Task 6 extends the same two files.

- [ ] **Step 1: Write the failing tests**

Append to `plugins/machinery/test/issue-tracking.test.mjs` (and add `normalizeAnswer` to its import from `../scripts/lib/issue-tracking.mjs`):

```js
test('normalizeAnswer keeps an answer, normalises its line endings, and refuses what would record unanswered', () => {
  assert.equal(normalizeAnswer('  Issue tracking: <tracker>.\r\nCheck: `<read>`.  \r\n'), 'Issue tracking: <tracker>.\nCheck: `<read>`.');
  assert.equal(normalizeAnswer('none\n'), 'none', 'the opt-out is an answer');
  assert.throws(() => normalizeAnswer(''), /empty answer/);
  assert.throws(() => normalizeAnswer(null), /empty answer/);
  assert.throws(() => normalizeAnswer(' unanswered \n'), /seeded word/);
  assert.throws(() => normalizeAnswer('---\nIssue tracking: <tracker>'), /rules index/);
});
```

Append to `plugins/machinery/test/issue-tracking-cli.test.mjs` (add `import { execFileSync } from 'node:child_process';` to its imports):

```js
const head = (root) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const walkFiles = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? (e.name === '.git' ? [] : walkFiles(path.join(d, e.name))) : [path.join(d, e.name)]));
const snapshot = (dir) => Object.fromEntries(walkFiles(dir).map((f) => [path.relative(dir, f), fs.readFileSync(f, 'utf8')]));

// A plugin checkout standing in for rulesSource(): rules/, inbox.md, plugin.json, committed.
function pluginCheckout(home) {
  const r = makeRepo();
  const plug = path.join(r.root, 'plugins', 'machinery');
  put(path.join(plug, 'rules', 'straight-talk.md'), '# S\n\n## Claims\n\n- a\n');
  put(path.join(plug, '.claude-plugin', 'plugin.json'), '{"name":"machinery","version":"0.1.0"}\n');
  put(path.join(plug, 'inbox.md'), '');
  execFileSync('git', ['add', '-A'], { cwd: r.root });
  execFileSync('git', ['commit', '-q', '-m', 'plugin'], { cwd: r.root });
  put(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: path.join(plug, 'rules') }));
  return r;
}

// TEST 7(b), now against product code (Decision 1). The failure it guards — one developer's tracker
// shipping to everyone who installs machinery — is silent when it happens, so it is asserted as a
// negative over everything the write could have touched.
test('record-global writes the global file and nothing else: no inbox entry, no write under the rules source, no version bump, no commit (test 7b)', () => {
  const h = tempHome(); const plugin = pluginCheckout(h); const proj = makeRepo();
  try {
    put(path.join(proj.root, '.claude', 'machinery', 'inbox.md'), '');
    const before = { plugin: snapshot(plugin.root), project: snapshot(proj.root), pluginHead: head(plugin.root), projectHead: head(proj.root) };
    assert.ok(Object.keys(before.plugin).includes(path.join('plugins', 'machinery', 'inbox.md')), 'the observer must see the universal inbox');
    const res = cli(['record-global', '--answer', ANSWER], { cwd: proj.root, home: h });
    assert.equal(res.code, 0, res.stderr);
    assert.equal(fs.readFileSync(globalFile(h), 'utf8'), ANSWER);
    assert.match(res.stdout, /^issue_tracking: wrote 1 of 1 file: .*global_issue_tracking\.md$/m);
    assert.deepEqual(snapshot(plugin.root), before.plugin, 'something under the rules source checkout changed');
    assert.deepEqual(snapshot(proj.root), before.project, 'something in the project changed');
    assert.equal(head(plugin.root), before.pluginHead, 'a commit landed in the rules source checkout');
    assert.equal(head(proj.root), before.projectHead, 'a commit landed in the project');
    assert.deepEqual(fs.readdirSync(path.join(h, '.claude', 'rules')), ['global_issue_tracking.md']);
  } finally { plugin.cleanup(); proj.cleanup(); }
});

// TEST 12, both halves: the first against record-global (Decision 1), the second against decide.
test('RED CHECK: answering for every project leaves a seeded project file byte-identical, and that project still asks (test 12)', () => {
  const h = tempHome(); const r = makeRepo();
  try {
    put(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')) }));
    put(projectFile(r.root), 'unanswered\n');
    const before = fs.readFileSync(projectFile(r.root));
    assert.equal(cli(['record-global', '--answer', ANSWER], { cwd: r.root, home: h }).code, 0);
    assert.deepEqual(fs.readFileSync(projectFile(r.root)), before, 'the global write touched the project file — Ruling D refused exactly this');
    const d = cli(['decide'], { cwd: r.root, home: h });
    assert.match(d.stdout, /^issue_tracking: ask \(read 2 of 2 file locations\)$/m, 'the project stopped asking after a global answer');
    assert.match(d.stdout, /^\| Issue tracking: <tracker> on `<project>`, reached with `<tool>`\.$/m, 'what the global answer buys here is the pre-fill');
  } finally { r.cleanup(); }
});

test('RED CHECK: record-global refuses when the global file would land under the rules source, and writes nothing', () => {
  const h = tempHome();
  put(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: path.join(h, '.claude', 'rules') }));
  const res = cli(['record-global', '--answer', ANSWER], { cwd: h, home: h });
  assert.equal(res.code, 1);
  assert.match(res.stderr, /^issue_tracking: refused: .* is under the rules source /m);
  assert.ok(!fs.existsSync(globalFile(h)));
});

test('record-global refuses a missing, empty or seeded-word answer, and writes nothing', () => {
  const h = tempHome();
  put(path.join(h, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: fs.mkdtempSync(path.join(os.tmpdir(), 'rules-')) }));
  for (const args of [['record-global'], ['record-global', '--answer', '  '], ['record-global', '--answer', 'unanswered']]) {
    const res = cli(args, { cwd: h, home: h });
    assert.equal(res.code, 1, `${args.join(' ')}: ${res.stderr}`);
    assert.match(res.stderr, /^issue_tracking: refused: /m);
    assert.ok(!fs.existsSync(globalFile(h)), `${args.join(' ')} wrote the global file`);
  }
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test plugins/machinery/test/issue-tracking.test.mjs plugins/machinery/test/issue-tracking-cli.test.mjs`

Expected: `issue-tracking.test.mjs` fails at import (`does not provide an export named 'normalizeAnswer'`); the four new CLI cases fail with exit code 2 and `usage:` on stderr, because `record-global` is not a command yet.

- [ ] **Step 3: Write the validator and the command**

Append to `plugins/machinery/scripts/lib/issue-tracking.mjs` (and add `import { parseRuleFile } from './frontmatter.mjs';` to its imports):

```js
// The one validator for a recorded answer, shared by record-global, record-project and intake. An empty
// answer and the seeded word would each record the UNANSWERED state, and an answer the rules-index parser
// throws on would break the index that reads the project file.
export function normalizeAnswer(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (text === '') throw new Error(`an empty answer is read as ${UNANSWERED}, so recording it records nothing`);
  if (text === UNANSWERED) throw new Error(`${UNANSWERED} is the seeded word, not an answer`);
  try { parseRuleFile(text, 'answer'); }
  catch (e) { throw new Error(`this answer would break the rules index that reads the project file: ${e.message}`); }
  return text;
}
```

In `plugins/machinery/scripts/issue-tracking.mjs`: add `import fs from 'node:fs';` to the imports; change the config import to `import { globalIssueTracking, projectIssueTracking, rulesSource } from './lib/config.mjs';` and the lib import to `import { decide, readIfPresent, normalizeAnswer } from './lib/issue-tracking.mjs';`. Then, above `const COMMANDS`, add:

```js
function requireAnswer() {
  const raw = opt('--answer');
  if (raw === null) throw new Refused('--answer "<answer>" is required');
  try { return normalizeAnswer(raw); } catch (e) { throw new Refused(e.message); }
}

const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
const inside = (child, parent) => { const rel = path.relative(parent, child); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

// Ruling A, made testable (the plan's Decision 1): the answer for every project on this machine is
// written straight into the global file — no inbox entry, no intake, no commit, and never a project
// file (Ruling D; this command resolves no project at all). The one thing it checks first is that the
// file would not land under rulesSource(), which ships to everyone who installs machinery.
function runRecordGlobal() {
  const answer = requireAnswer();
  const file = globalIssueTracking();
  const source = rulesSource();
  if (inside(real(path.dirname(file)), real(source))) {
    throw new Refused(`${file} is under the rules source ${source}, which ships to everyone who installs machinery; nothing written`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${answer}\n`, 'utf8');
  process.stdout.write(`issue_tracking: wrote 1 of 1 file: ${file}\n`
    + 'issue_tracking: nothing else was written — no inbox entry, no intake, no commit, and no project file\n');
  return 0;
}
```

Change `COMMANDS` and `USAGE` to:

```js
const COMMANDS = { 'decide': runDecide, 'record-global': runRecordGlobal };
const USAGE = ['issue-tracking.mjs decide [--root <dir>]', 'issue-tracking.mjs record-global --answer "<answer>"'];
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test plugins/machinery/test/issue-tracking.test.mjs plugins/machinery/test/issue-tracking-cli.test.mjs plugins/machinery/test/issue-tracking-names.test.mjs plugins/machinery/test/purity.test.mjs`

Expected: PASS, all cases. `purity.test.mjs` passes unedited (prediction 6).

- [ ] **Step 5: Bump, run the hook, measure**

`plugins/machinery/.claude-plugin/plugin.json`: `"0.1.116"` → `"0.1.117"`. Run `sh .githooks/pre-commit` (exit 0) and record `duration_ms` from `node --test 'plugins/machinery/test/*.test.mjs' 2>&1 | tail -9`. Over 20 s: stop and report.

- [ ] **Step 6: Commit**

```bash
git commit -m "issue tracking: record-global writes the global file and nothing else (#99)" -- plugins/machinery/scripts/lib/issue-tracking.mjs plugins/machinery/scripts/issue-tracking.mjs plugins/machinery/test/issue-tracking.test.mjs plugins/machinery/test/issue-tracking-cli.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

## Task 6: `record-project` — one inbox entry, read back through the parser (Decision 1)

Two commits: the `inbox.mjs` extraction with no change in behaviour, then the command (`rules/verification-and-evidence.md` § What a test can honestly claim: *"A refactor lands in two steps, never one"*).

**Files:**
- Modify: `plugins/machinery/scripts/lib/inbox.mjs` (`appendEntry`, lines 30–36)
- Modify: `plugins/machinery/test/lib-inbox.test.mjs` (append)
- Modify: `plugins/machinery/scripts/lib/issue-tracking.mjs` (append)
- Modify: `plugins/machinery/scripts/issue-tracking.mjs` (add `record-project`)
- Modify: `plugins/machinery/test/issue-tracking.test.mjs`, `plugins/machinery/test/issue-tracking-cli.test.mjs`, `plugins/machinery/test/capture.test.mjs` (append)
- Modify: `plugins/machinery/.claude-plugin/plugin.json` (`0.1.117` → `0.1.118` in commit A, → `0.1.119` in commit B)

**Interfaces:**
- Consumes: `normalizeAnswer`, `readIfPresent` (Tasks 3, 5); `projectInbox` (`lib/config.mjs`); `parseInbox` (`lib/inbox.mjs`); Task 4's `opt`, `resolveRoot`, `Refused`, `CannotRun`, `COMMANDS`, `USAGE`.
- Produces:
  - `lib/inbox.mjs` (commit A): `export const newStamp = (date = new Date()) => string` (`YYYY-MM-DDTHH:MM:SSZ`); `export const formatEntry = ({ stamp, marker, text, session }) => string` — exactly the block `appendEntry` appends. (Commit B): `appendEntry(file, { marker, text, session, stamp = newStamp() })`.
  - `lib/issue-tracking.mjs` (commit B): `export const PROJECT_ENTRY_KIND = 'PRULE'` (the parser's kind for a project rule); `export const CAPTURE_NOTE: string`; `export const entryText = (answer: string) => string` (`<answer>\n\n<CAPTURE_NOTE>`); `export function findRecorded(inboxText: string, { stamp, session, text }) => entry[]` (pending entries of that kind matching all three; throws if the text does not parse); `export function pendingIssueTracking(inboxText: string) => entry[]` (pending entries whose text ends with `CAPTURE_NOTE`).
  - Command (commit B): `node scripts/issue-tracking.mjs record-project --answer "<answer>" [--session <id>] [--root <dir>]`. Appends to `projectInbox(projectRoot(...))` — the root checkout's inbox, from a worktree too. Exit 0 with `issue_tracking: recorded 1 of 1 entry: PENDING <stamp> PRULE <session> in <inbox>`. Refused (1): bad answer; whitespace in the session id; a pending issue-tracking entry already there; an answer that would not read back as exactly one entry. Cannot run (2): no session id from `--session` or `$CLAUDE_CODE_SESSION_ID`; the inbox does not parse; a stamp collision. Post-write readback failure: exit 1 with `issue_tracking: FAILED:` on stderr.
- Ordering: Task 7's intake test runs this command and relies on `CAPTURE_NOTE`'s wording containing "automatic capture did not fire".

### Commit A — extract `newStamp` and `formatEntry`, same bytes

- [ ] **Step A1: Write the byte pin (it passes before the change — it is a pin, not a red test)**

Append to `plugins/machinery/test/lib-inbox.test.mjs`:

```js
// Pin, held byte-identical across the formatEntry extraction (issue tracking plan, Task 6 commit A).
test('pin: appendEntry writes exactly this block', () => {
  const f = tmp();
  appendEntry(f, { marker: 'PRULE', text: '  hello\n', session: 's1' });
  assert.match(fs.readFileSync(f, 'utf8'), /^\n## PENDING \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z PRULE s1\n\nhello\n\ndisposition: PENDING\n$/);
});
```

Run: `node --test plugins/machinery/test/lib-inbox.test.mjs` — expected PASS (7 cases).

- [ ] **Step A2: Extract, changing no byte**

In `plugins/machinery/scripts/lib/inbox.mjs`, replace `appendEntry` (lines 30–36) with:

```js
// The entry shape, spelled once: appendEntry writes it, and a caller that must know before writing
// whether an entry will read back (scripts/issue-tracking.mjs record-project) formats it the same way.
export const newStamp = (date = new Date()) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');
export const formatEntry = ({ stamp, marker, text, session }) => `\n## PENDING ${stamp} ${marker} ${session}\n\n${text.trim()}\n\ndisposition: PENDING\n`;

export function appendEntry(file, { marker, text, session }) {
  const stamp = newStamp();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, formatEntry({ stamp, marker, text, session }), 'utf8');
  return { state: 'PENDING', stamp, marker, session, text: text.trim(), disposition: 'PENDING' };
}
```

- [ ] **Step A3: Run the tests that exercise it**

Run: `node --test plugins/machinery/test/lib-inbox.test.mjs plugins/machinery/test/capture.test.mjs plugins/machinery/test/intake.test.mjs plugins/machinery/test/install.test.mjs`

Expected: PASS, including the pin.

- [ ] **Step A4: Bump, hook, commit**

`plugins/machinery/.claude-plugin/plugin.json`: `"0.1.117"` → `"0.1.118"`. Run `sh .githooks/pre-commit` (exit 0).

```bash
git commit -m "inbox: extract newStamp and formatEntry, same bytes (#99)" -- plugins/machinery/scripts/lib/inbox.mjs plugins/machinery/test/lib-inbox.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

### Commit B — the command

- [ ] **Step B1: Write the failing tests**

Append to `plugins/machinery/test/lib-inbox.test.mjs` (add `formatEntry`, `newStamp` to its import):

```js
test('RED CHECK: appendEntry uses the stamp it is given, and writes exactly formatEntry\'s block', () => {
  const f = tmp();
  const e = appendEntry(f, { marker: 'PRULE', text: 'x', session: 's', stamp: '2026-01-02T03:04:05Z' });
  assert.equal(e.stamp, '2026-01-02T03:04:05Z');
  assert.equal(parseInbox(fs.readFileSync(f, 'utf8'))[0].stamp, '2026-01-02T03:04:05Z');
  assert.equal(fs.readFileSync(f, 'utf8'), formatEntry({ stamp: '2026-01-02T03:04:05Z', marker: 'PRULE', text: 'x', session: 's' }));
  assert.equal(newStamp(new Date('2026-01-02T03:04:05.678Z')), '2026-01-02T03:04:05Z');
});
```

Append to `plugins/machinery/test/issue-tracking.test.mjs` (add `CAPTURE_NOTE, entryText, findRecorded, pendingIssueTracking` to its import, and `import { formatEntry } from '../scripts/lib/inbox.mjs';`):

```js
// The note rules/rule-governance.md § Dictating a rule requires: "with a note saying why the automatic
// capture did not fire". The expectation is that rule's own words.
test('the entry text is the answer, a blank line, and the note that automatic capture did not fire', () => {
  assert.match(CAPTURE_NOTE, /automatic capture did not fire/);
  assert.equal(entryText('Issue tracking: <tracker>.'), `Issue tracking: <tracker>.\n\n${CAPTURE_NOTE}`);
});

test('RED CHECK: findRecorded finds exactly one well-formed entry, none under a heading the parser does not know, and two duplicates as two', () => {
  const want = { stamp: '2026-09-12T00:00:00Z', session: 's', text: entryText('Issue tracking: <tracker>.') };
  const block = (marker) => formatEntry({ ...want, marker });
  assert.equal(findRecorded(block('PRULE'), want).length, 1);
  assert.equal(findRecorded(block('PRULEX'), want).length, 0, 'an unrecognised heading is skipped silently — the failure Decision 1 exists for');
  assert.equal(findRecorded(block('PRULE') + block('PRULE'), want).length, 2);
  assert.throws(() => findRecorded('## PENDING 2026-09-12T00:00:00Z PRULE s\n\nno disposition\n', want), /malformed/);
});

test('pendingIssueTracking sees a pending recorded answer and not an ordinary pending rule', () => {
  const recorded = formatEntry({ stamp: '2026-09-12T00:00:00Z', marker: 'PRULE', session: 's', text: entryText('Issue tracking: <tracker>.') });
  const ordinary = formatEntry({ stamp: '2026-09-12T00:00:01Z', marker: 'PRULE', session: 's', text: 'PRULE: an ordinary rule' });
  assert.deepEqual(pendingIssueTracking(ordinary + recorded).map((e) => e.stamp), ['2026-09-12T00:00:00Z']);
});
```

Append to `plugins/machinery/test/issue-tracking-cli.test.mjs` (add `import { pending } from '../scripts/lib/inbox.mjs';`):

```js
const rootInbox = (root) => path.join(root, '.claude', 'machinery', 'inbox.md');
const SESSION = { CLAUDE_CODE_SESSION_ID: 'session-under-test' };

// TEST 7(a3), against product code (Decision 1): exactly one entry, with the note, read back through the
// parser — written from inside a worktree, where it must land in the root checkout's inbox, the one
// intake reads (the spec's observation 3).
test('record-project from a worktree writes exactly one pending entry, with the note, to the root inbox — and refuses a second (test 7a3)', () => {
  const r = makeRepo(); const h = tempHome();
  try {
    const wt = addWorktree(r.root, 'feat');
    const res = cli(['record-project', '--answer', ANSWER], { cwd: wt, home: h, env: SESSION });
    assert.equal(res.code, 0, res.stderr);
    const entries = pending(rootInbox(r.root));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].marker, 'PRULE');
    assert.equal(entries[0].session, 'session-under-test');
    assert.ok(entries[0].text.startsWith(`${ANSWER.trim()}\n\n`), entries[0].text);
    assert.match(entries[0].text, /automatic capture did not fire/);
    assert.match(res.stdout, new RegExp(`^issue_tracking: recorded 1 of 1 entry: PENDING ${entries[0].stamp} PRULE session-under-test in `, 'm'));
    assert.ok(!fs.existsSync(rootInbox(wt)), 'an inbox was written inside the worktree');
    const before = fs.readFileSync(rootInbox(r.root));
    const second = cli(['record-project', '--answer', ANSWER], { cwd: r.root, home: h, env: SESSION });
    assert.equal(second.code, 1);
    assert.match(second.stderr, /already recorded and pending/);
    assert.deepEqual(fs.readFileSync(rootInbox(r.root)), before);
  } finally { r.cleanup(); }
});

test('RED CHECK: record-project writes nothing without a session id, for an answer that would not read back, or into an inbox that does not parse', () => {
  const r = makeRepo(); const h = tempHome();
  try {
    const noSession = cli(['record-project', '--answer', ANSWER], { cwd: r.root, home: h, env: { CLAUDE_CODE_SESSION_ID: '' } });
    assert.equal(noSession.code, 2);
    assert.match(noSession.stderr, /--session and \$CLAUDE_CODE_SESSION_ID/);
    assert.ok(!fs.existsSync(rootInbox(r.root)));

    const spaced = cli(['record-project', '--answer', ANSWER, '--session', 'a b'], { cwd: r.root, home: h, env: { CLAUDE_CODE_SESSION_ID: '' } });
    assert.equal(spaced.code, 1);
    assert.ok(!fs.existsSync(rootInbox(r.root)));

    const structural = cli(['record-project', '--answer', 'Issue tracking: <tracker>\ndisposition: PENDING'], { cwd: r.root, home: h, env: SESSION });
    assert.equal(structural.code, 1);
    assert.match(structural.stderr, /would not read back from the inbox as exactly one entry/);
    assert.ok(!fs.existsSync(rootInbox(r.root)));

    put(rootInbox(r.root), '## PENDING 2026-01-01T00:00:00Z PRULE s\n\nno disposition line\n');
    const before = fs.readFileSync(rootInbox(r.root));
    const malformed = cli(['record-project', '--answer', ANSWER], { cwd: r.root, home: h, env: SESSION });
    assert.equal(malformed.code, 2);
    assert.match(malformed.stderr, /does not parse, so nothing was written/);
    assert.deepEqual(fs.readFileSync(rootInbox(r.root)), before);
  } finally { r.cleanup(); }
});
```

Append to `plugins/machinery/test/capture.test.mjs`:

```js
// Issue tracking, test 7(a1): the setup conversation asks for no mark, so a plain-words answer reaching
// the capture hook writes nothing to either inbox, and record-project's entry is never doubled by a
// captured one. The observer is proved alive at the end: the same hook and home, with the mark, write.
test('RED CHECK: a plain-words issue-tracking answer, with no mark, writes nothing to either inbox (issue tracking test 7a1)', () => {
  const r = makeRepo(); const h = home();
  try {
    const src = JSON.parse(fs.readFileSync(path.join(h, '.claude', 'machinery.json'), 'utf8')).rulesSource;
    const res = run('Use GitHub Issues to track this project, for this project only.', r.root, { MACHINERY_HOME: h });
    assert.equal(res.code, 0, res.stderr);
    assert.ok(!fs.existsSync(path.join(r.root, '.claude', 'machinery', 'inbox.md')), 'a project inbox was written');
    assert.ok(!fs.existsSync(path.join(path.dirname(src), 'inbox.md')), 'a universal inbox was written');
    run('PRULE: x', r.root, { MACHINERY_HOME: h });
    assert.equal(pending(path.join(r.root, '.claude', 'machinery', 'inbox.md')).length, 1);
  } finally { r.cleanup(); }
});
```

- [ ] **Step B2: Run the tests and watch them fail**

Run: `node --test plugins/machinery/test/lib-inbox.test.mjs plugins/machinery/test/issue-tracking.test.mjs plugins/machinery/test/issue-tracking-cli.test.mjs plugins/machinery/test/capture.test.mjs`

Expected: `lib-inbox.test.mjs` — the new case fails (`'…actual now…' !== '2026-01-02T03:04:05Z'`: the stamp argument is ignored). `issue-tracking.test.mjs` fails at import (`does not provide an export named 'CAPTURE_NOTE'`). The two new CLI cases fail (exit 2 with `usage:`). The capture case **passes** — test 7(a1) asserts behaviour `capture.mjs` already has and the spec says stays unchanged; it is a guard, recorded as passing-before in your report.

- [ ] **Step B3: Write the stamp parameter, the entry shape and the command**

In `plugins/machinery/scripts/lib/inbox.mjs`, change `appendEntry` to:

```js
export function appendEntry(file, { marker, text, session, stamp = newStamp() }) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, formatEntry({ stamp, marker, text, session }), 'utf8');
  return { state: 'PENDING', stamp, marker, session, text: text.trim(), disposition: 'PENDING' };
}
```

Append to `plugins/machinery/scripts/lib/issue-tracking.mjs` (and add `import { parseInbox } from './inbox.mjs';`):

```js
// The project answer's inbox entry (Ruling F; the plan's Decision 1). PROJECT_ENTRY_KIND is the kind
// lib/inbox.mjs's heading pattern accepts for a project rule; a mismatch is not silent here, because
// record-project reads every entry back through that parser and fails unless it finds exactly one.
export const PROJECT_ENTRY_KIND = 'PRULE';
// rules/rule-governance.md § Dictating a rule: "written into the inbox by hand, with a note saying why
// the automatic capture did not fire."
export const CAPTURE_NOTE = 'Note: automatic capture did not fire. This answer was given in plain words in the issue-tracking setup conversation, which asks for no mark, and was recorded by issue-tracking.mjs record-project.';
export const entryText = (answer) => `${answer}\n\n${CAPTURE_NOTE}`;

export function findRecorded(inboxText, { stamp, session, text }) {
  return parseInbox(inboxText).filter((e) => e.state === 'PENDING' && e.disposition === 'PENDING'
    && e.marker === PROJECT_ENTRY_KIND && e.stamp === stamp && e.session === session && e.text === text);
}

export const pendingIssueTracking = (inboxText) => parseInbox(inboxText).filter((e) => e.state === 'PENDING' && e.text.endsWith(CAPTURE_NOTE));
```

In `plugins/machinery/scripts/issue-tracking.mjs`: change the config import to `import { globalIssueTracking, projectIssueTracking, rulesSource, projectInbox } from './lib/config.mjs';`, add `import { appendEntry, formatEntry, newStamp, parseInbox } from './lib/inbox.mjs';`, and change the lib import to `import { decide, readIfPresent, normalizeAnswer, PROJECT_ENTRY_KIND, entryText, findRecorded, pendingIssueTracking } from './lib/issue-tracking.mjs';`. Above `const COMMANDS`, add:

```js
// The one read of the session id (rules/design-invariants.md § One authority per switch).
function resolveSession() {
  const value = opt('--session') || process.env.CLAUDE_CODE_SESSION_ID || '';
  if (!value) throw new CannotRun('no session id: looked at --session and $CLAUDE_CODE_SESSION_ID, and found neither');
  if (/\s/.test(value)) throw new Refused(`the session id "${value}" contains whitespace, which an inbox heading cannot carry`);
  return value;
}

// Ruling F, made testable (the plan's Decision 1): the assistant records the project answer as one inbox
// entry, which intake then files. Everything that can be checked before writing is checked before
// writing, because the inbox is append-only; the entry is then read back through the parser, because
// the parser skips an unrecognised heading without a word.
function runRecordProject() {
  const answer = requireAnswer();
  const session = resolveSession();
  const root = resolveRoot();
  const inbox = projectInbox(root);
  const before = readIfPresent(inbox) ?? '';
  let existing;
  try { existing = parseInbox(before); }
  catch (e) { throw new CannotRun(`${inbox} does not parse, so nothing was written: ${e.message}`); }
  const already = pendingIssueTracking(before);
  if (already.length) throw new Refused(`an issue-tracking answer is already recorded and pending in ${inbox} at ${already[0].stamp}; file that entry with rule intake rather than recording a second`);
  const stamp = newStamp();
  if (existing.some((e) => e.stamp === stamp)) throw new CannotRun(`an entry stamped ${stamp} is already in ${inbox}, and intake addresses entries by stamp; run the command again in a second`);
  const text = entryText(answer);
  const expected = { stamp, session, text };
  let wouldRead = 0;
  try { wouldRead = findRecorded(before + formatEntry({ stamp, marker: PROJECT_ENTRY_KIND, text, session }), expected).length; }
  catch { wouldRead = 0; }
  if (wouldRead !== 1) throw new Refused(`this answer would not read back from the inbox as exactly one entry (it would read as ${wouldRead}): a line in it looks like inbox structure, so nothing was written`);
  appendEntry(inbox, { marker: PROJECT_ENTRY_KIND, text, session, stamp });
  const found = findRecorded(fs.readFileSync(inbox, 'utf8'), expected).length;
  if (found !== 1) {
    process.stderr.write(`issue_tracking: FAILED: wrote an entry stamped ${stamp} to ${inbox}, and the inbox parser reads back ${found} matching entries, not 1. The inbox is append-only: dismiss that entry with disposition.mjs --dismissed, then record again.\n`);
    return 1;
  }
  process.stdout.write(`issue_tracking: recorded 1 of 1 entry: PENDING ${stamp} ${PROJECT_ENTRY_KIND} ${session} in ${inbox}\n`
    + `issue_tracking: next: file entry ${stamp} with rule intake, from a root session\n`);
  return 0;
}
```

Change `COMMANDS` and `USAGE` to:

```js
const COMMANDS = { 'decide': runDecide, 'record-global': runRecordGlobal, 'record-project': runRecordProject };
const USAGE = [
  'issue-tracking.mjs decide [--root <dir>]',
  'issue-tracking.mjs record-global --answer "<answer>"',
  'issue-tracking.mjs record-project --answer "<answer>" [--session <id>] [--root <dir>]',
];
```

**What the post-write branch can and cannot be shown to do.** The pre-write simulation parses exactly the bytes the append produces, so the readback can only disagree with it under a concurrent write to the inbox; no test here produces one. `findRecorded`'s unit cases prove the readback's detector distinguishes one, zero and two. Say this in your report rather than claiming the branch is exercised.

- [ ] **Step B4: Run the tests and watch them pass**

Run: `node --test plugins/machinery/test/lib-inbox.test.mjs plugins/machinery/test/issue-tracking.test.mjs plugins/machinery/test/issue-tracking-cli.test.mjs plugins/machinery/test/capture.test.mjs plugins/machinery/test/intake.test.mjs plugins/machinery/test/issue-tracking-names.test.mjs`

Expected: PASS, all cases.

- [ ] **Step B5: Bump, run the hook, measure**

`plugins/machinery/.claude-plugin/plugin.json`: `"0.1.118"` → `"0.1.119"`. Run `sh .githooks/pre-commit` (exit 0) and record `duration_ms`. Over 20 s: stop and report.

- [ ] **Step B6: Commit**

```bash
git commit -m "issue tracking: record-project writes one inbox entry and reads it back (#99)" -- plugins/machinery/scripts/lib/inbox.mjs plugins/machinery/scripts/lib/issue-tracking.mjs plugins/machinery/scripts/issue-tracking.mjs plugins/machinery/test/lib-inbox.test.mjs plugins/machinery/test/issue-tracking.test.mjs plugins/machinery/test/issue-tracking-cli.test.mjs plugins/machinery/test/capture.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

## Task 7: Intake files a project issue-tracking answer into its named home

**Files:**
- Modify: `plugins/machinery/scripts/intake.mjs:7` (config import), after `:10` (new import), `:34-36` (head of `commit()`), `:49` (project branch), before `:70` (the write)
- Modify: `claude-code/machinery/rule-intake/SKILL.md` (step 2); regenerate `plugins/machinery/skills/rule-intake/SKILL.md` with `node scripts/build-skills.mjs build` — never by hand
- Modify: `plugins/machinery/test/intake.test.mjs` (append)
- Modify: `plugins/machinery/.claude-plugin/plugin.json` (`0.1.119` → `0.1.120`)

**Interfaces:**
- Consumes: `projectIssueTracking` (Task 1); `normalizeAnswer` (Task 5); `record-project` and its `CAPTURE_NOTE` wording (Task 6), in the test.
- Produces: `node scripts/intake.mjs commit --kind project --issue-tracking --answer "<answer>" [--root <dir>] --stamp <stamp>`. Writes `<answer>\n` as the whole of `projectIssueTracking(repo)`, regenerates the index, dispositions the entry `filed → .claude/rules/project_issue_tracking.md`, commits. Refused (exit 1): `--issue-tracking` with any kind but `project`; with `--home`; without a valid `--answer`.
- Ordering: nothing later consumes this; Task 8's copy tells the assistant to run rule intake.

- [ ] **Step 1: Write the failing tests**

Append to `plugins/machinery/test/intake.test.mjs`:

```js
// Issue tracking (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md, "How the answer is
// recorded", test 7(a2)). Intake gains ONE piece of routing knowledge: a project issue-tracking answer
// has a named home. The entry is the one record-project writes (the plan's Decision 1).
const TRACKING_ANSWER = 'Issue tracking: <tracker> on `<project>`, reached with `<tool>`.\nCheck: `<status command>` and `<one-item read command>`.\n';

test('an issue-tracking entry from record-project is filed as the whole project issue-tracking file, not into a rule group chosen by subject (test 7a2)', () => {
  const h = home(); const r = makeRepo();
  try {
    runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h } });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
    const rec = runScript('scripts/issue-tracking.mjs', { args: ['record-project', '--answer', TRACKING_ANSWER, '--root', r.root], cwd: r.root, env: { MACHINERY_HOME: h, CLAUDE_CODE_SESSION_ID: 'session-under-test' } });
    assert.equal(rec.code, 0, rec.stderr);
    const entries = pending(projectInbox(r.root));
    assert.equal(entries.length, 1, 'exactly one pending entry');
    assert.match(entries[0].text, /automatic capture did not fire/);
    const res = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'project', '--issue-tracking', '--answer', TRACKING_ANSWER, '--root', r.root, '--stamp', entries[0].stamp], cwd: r.root, env: { MACHINERY_HOME: h } });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(fs.readFileSync(path.join(r.root, '.claude', 'rules', 'project_issue_tracking.md'), 'utf8'), TRACKING_ANSWER, 'the answer replaces the seeded word as the whole file');
    assert.deepEqual(fs.readdirSync(path.join(r.root, '.claude', 'rules')), ['project_issue_tracking.md'], 'a rule group was created by subject');
    const [e] = parseInbox(fs.readFileSync(projectInbox(r.root), 'utf8'));
    assert.equal(e.state, 'FILED');
    assert.equal(e.disposition, 'filed → .claude/rules/project_issue_tracking.md');
    assert.equal(g(r.root, 'status', '--porcelain'), '', 'the filing is one commit and leaves nothing behind');
    assert.match(g(r.root, 'show', '--name-only', '--format=', 'HEAD'), /^\.claude\/rules\/project_issue_tracking\.md$/m);
    assert.equal(runScript('scripts/gate/gate.mjs', { args: ['--root', r.root], cwd: r.root }).code, 0);
  } finally { r.cleanup(); }
});

test('RED CHECK: --issue-tracking is refused on the universal and spec kinds, beside --home, and without a valid answer', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  const commit = (...args) => runScript('scripts/intake.mjs', { args: ['commit', ...args], cwd: d, env: { MACHINERY_HOME: home() } });
  for (const kind of ['universal', 'spec']) {
    const res = commit('--kind', kind, '--issue-tracking', '--answer', 'x', '--stamp', 's');
    assert.equal(res.code, 1, kind);
    assert.match(res.stderr, /project route only/, kind);
  }
  const both = commit('--kind', 'project', '--issue-tracking', '--answer', 'x', '--home', '.claude/rules/a.md § S', '--stamp', 's');
  assert.equal(both.code, 1);
  assert.match(both.stderr, /derives the home/);
  for (const answer of [null, '', '   ', 'unanswered']) {
    const res = commit('--kind', 'project', '--issue-tracking', '--stamp', 's', ...(answer === null ? [] : ['--answer', answer]));
    assert.equal(res.code, 1, JSON.stringify(answer));
    assert.match(res.stderr, /--issue-tracking needs --answer/, JSON.stringify(answer));
  }
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `node --test plugins/machinery/test/intake.test.mjs`

Expected: 2 new failures. The first: `intake commit` exits 1 with `usage: intake commit --kind project|universal|spec …` because `--home` is absent. The second: stderr lacks `project route only` (the same usage line is printed). Pre-existing cases pass.

- [ ] **Step 3: Write the routing**

In `plugins/machinery/scripts/intake.mjs`, change line 7 to:

```js
import { projectInbox, projectIndex, projectRules, projectIssueTracking, projectSpecs, projectSpecInbox, projectSpecIndex, universalInbox, universalIndex, rulesSource } from './lib/config.mjs';
```

After line 10 (`import { insideSpecArea } from './lib/layout.mjs';`) add:

```js
import { normalizeAnswer } from './lib/issue-tracking.mjs';
```

Replace lines 34–36 (from `const kind = opt('--kind'), stamp = opt('--stamp'), home = opt('--home');` through `let repo, inbox, index, rules, extra = [];`) with:

```js
  const kind = opt('--kind'), stamp = opt('--stamp');
  // Issue tracking (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md § How the answer
  // is recorded): the ONE piece of routing knowledge intake gains. A project issue-tracking answer has a
  // named home, derived below so no caller types the path. The answer for every project on this machine
  // never comes here: it is written by issue-tracking.mjs record-global (Ruling A), and routing it
  // through --kind universal would file one developer's tracker into rulesSource() and ship it to
  // everyone who installs machinery.
  const issueTracking = argv.includes('--issue-tracking');
  if (issueTracking && kind !== 'project') die('--issue-tracking is the project route only: an answer for every project on this machine is written by issue-tracking.mjs record-global and never reaches intake');
  if (issueTracking && opt('--home') !== null) die('--issue-tracking derives the home from the layout; do not also pass --home');
  let answer = null;
  if (issueTracking) { try { answer = normalizeAnswer(opt('--answer')); } catch (e) { die(`--issue-tracking needs --answer "<answer>": ${e.message}`); } }
  let home = opt('--home');
  if (!['project', 'universal', 'spec'].includes(kind) || !stamp || (!issueTracking && !home)) die('usage: intake commit --kind project|universal|spec [--root <dir>] --stamp <stamp> --home "<file § Section>"  |  intake commit --kind project --issue-tracking --answer "<answer>" [--root <dir>] --stamp <stamp>');
  let repo, inbox, index, rules, extra = [];
```

In the `kind === 'project'` branch, immediately after `repo = projectRoot(cwd); inbox = projectInbox(repo); index = projectIndex(repo); rules = projectRules(repo);` add:

```js
    if (issueTracking) home = path.relative(repo, projectIssueTracking(repo)).split(path.sep).join('/');
```

Immediately before `fs.mkdirSync(path.dirname(index), { recursive: true });` add:

```js
  // The file's states are its whole contents, so the answer replaces the seeded word rather than being
  // placed as a bullet: place.mjs appends under a heading and would leave the seeded word above it.
  if (issueTracking) fs.writeFileSync(projectIssueTracking(repo), `${answer}\n`, 'utf8');
```

- [ ] **Step 4: State the route in the skill's step 2**

In `claude-code/machinery/rule-intake/SKILL.md`, step 2 ends with `…if not, it is a different rule — new section.` Append to the end of that same step-2 paragraph (same line, one space after the period):

```markdown
**Issue tracking has a named home, not a chosen one.** An entry recorded by the issue-tracking setup (its text ends with a note that automatic capture did not fire), or any project rule saying where this project's issue tracking lives, skips steps 3 and 4: its answer is the entry's text above that note, used as it stands, filed with `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind project --issue-tracking --answer "<answer>" --stamp <stamp>`, which writes the answer as that project's whole issue-tracking file and derives the path itself. An answer for every project on this machine never reaches intake.
```

Run: `node scripts/build-skills.mjs build`

Expected: `✓ staged 9 skill(s) into plugins/machinery/skills/` among its lines, and `plugins/machinery/skills/rule-intake/SKILL.md` now equals the source (`cmp` prints nothing).

- [ ] **Step 5: Run the tests and watch them pass**

Run: `node --test plugins/machinery/test/intake.test.mjs plugins/machinery/test/skills.test.mjs plugins/machinery/test/purity.test.mjs plugins/machinery/test/issue-tracking-names.test.mjs`

Expected: PASS. `skills.test.mjs`'s CLI-flag scan passes over the new line — `--kind`, `--issue-tracking`, `--answer` and `--stamp` all appear in `intake.mjs` (prediction 10).

- [ ] **Step 6: Bump, run the hook, measure**

`plugins/machinery/.claude-plugin/plugin.json`: `"0.1.119"` → `"0.1.120"`. Run `sh .githooks/pre-commit` (exit 0; `check` reports `plugins/machinery/skills/ matches source`) and record `duration_ms`. Over 20 s: stop and report.

- [ ] **Step 7: Commit**

```bash
git commit -m "intake: a project issue-tracking answer has a named home; no global route (#99)" -- plugins/machinery/scripts/intake.mjs claude-code/machinery/rule-intake/SKILL.md plugins/machinery/skills/rule-intake/SKILL.md plugins/machinery/test/intake.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

## Task 8: The setup conversation in `developer-friendliness`, and the check over its copy

**Files:**
- Modify: `claude-code/developer-friendliness/developer-friendliness/SKILL.md` — § 3.2, after the paragraph ending `new convention you invented on their behalf.`; § 8, after the bullet ending `Ask it once and apply the answer everywhere.`
- Regenerate: `plugins/developer-friendliness/skills/developer-friendliness/SKILL.md` via `node scripts/build-skills.mjs build`
- Modify: `plugins/developer-friendliness/.claude-plugin/plugin.json` (`0.1.2` → `0.1.3`)
- Create: `scripts/issue-tracking-copy.mjs`
- Create: `scripts/test/issue-tracking-copy.test.mjs`

**Interfaces:**
- Consumes, by reading source text (not by import — the check is repository tooling and the two plugins do not depend on each other for it): `plugins/machinery/scripts/issue-tracking.mjs` (the quoted subcommands, flags and verdict line from Tasks 4–6) and `plugins/machinery/scripts/banner.mjs` (the `issue tracking command:` label from Task 4).
- Produces: `export const REGION_START = '<!-- issue-tracking:start -->'`, `REGION_END = '<!-- issue-tracking:end -->'`, `REGIONS_EXPECTED = 2`, `NOTICE = 'project issue-tracking setup needs machinery installed'`, `BANNER_LABEL = 'issue tracking command:'`, `RULES` (four names), `BLIND_SPOTS`; `class CopyUnavailable`; `extractRegions(text) → string[]`; `sentences(text) → string[]`; `promises(sentence) → boolean`; `findViolations(regions, { trackingSource, bannerSource }) → { rule, message }[]`; `proofLine(violations, regionCount) → string`; `run() → { code, lines }`. Command: `node scripts/issue-tracking-copy.mjs`, exit 0 clean, 1 a rule broken, 2 cannot run.

**The copy and test 13's pattern are this plan's, written together in this task.** The spec's requirement, verbatim: *"**In this project, only an answer recorded for this project stops the asking.** The conversation must not state or imply that answering for every project on this machine ends the asking here — not in the scope question, not in the labels on its two answers, and not in whatever the assistant says after writing the global file."* And on the pattern: *"**its pattern is written against the conversation's copy at implementation time**, when there is copy to write it against — this document writes none."* If different copy is written later, the patterns move with it; the requirement does not.

**Test 11's scope wrinkle is dissolved by Decision 1.** The spec expected the same sections to instruct the assistant how to hand-write an entry whose heading names `PRULE`; with `record-project` writing the heading, the instructions never spell it. The check still scopes to explicit regions, so a mark elsewhere in the skill (none exists today) is outside it — named as a blind spot.

**Cost stated:** this skill is installed into `~/.claude/rules` and loads into every session, so every line added here is paid in every session on every machine that installs it, machinery or not.

- [ ] **Step 1: Write the failing test**

Create `scripts/test/issue-tracking-copy.test.mjs`:

```js
// Tests for scripts/issue-tracking-copy.mjs — the check over the issue-tracking copy in the
// developer-friendliness skill (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md,
// tests 11 and 13; the plan's Decision 3). Fixtures prove the check still matches; the last case runs
// it over the real skill and the real machinery sources.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGION_START, REGION_END, NOTICE, RULES, CopyUnavailable,
  extractRegions, sentences, promises, findViolations, proofLine, run,
} from '../issue-tracking-copy.mjs';

// The count line this file owes its own output (plugins/machinery/rules/tool-output.md § Proof lines
// and denominators): node --test's `# pass N` summary is not the declared proof format.
let registered = 0, passed = 0;
const check = (name, fn) => { registered++; test(name, async (t) => { await fn(t); passed++; }); };
after(() => console.log(`issue_tracking_copy_tests: ${passed} of ${registered} test(s) passed`));

const SOURCES = {
  trackingSource: "const VERDICT_ASK = 'issue_tracking: ask';\nopt('--answer'); opt('--session'); opt('--root');\nconst COMMANDS = { 'decide': a, 'record-global': b, 'record-project': c };",
  bannerSource: 'lines.push(`  issue tracking command: ${x}`);',
};
const CLEAN_A = [
  'Run the command on the `issue tracking command:` line with `decide`, and hold the conversation if it prints `issue_tracking: ask`.',
  `If no banner has that line, say once, plainly, that ${NOTICE}.`,
  'Is this for this project only, or for every project on this machine?',
  'Record with `record-project --answer "<answer>"` or `record-global --answer "<answer>"`.',
].join('\n');
const CLEAN_B = '- Where issue tracking lives is stored. § 3.2 says when to run `decide`.';
const wrap = (body) => `${REGION_START}\n${body}\n${REGION_END}`;

check('clean copy breaks no rule, and the proof line states the denominator', () => {
  const v = findViolations([CLEAN_A, CLEAN_B], SOURCES);
  assert.deepEqual(v, []);
  assert.equal(proofLine(v, 2), `issue_tracking_copy: ${RULES.length} of ${RULES.length} copy rule(s) satisfied across 2 region(s)`);
});

// TEST 11 — Rulings C and F.
check('RED CHECK: a mark offered for either scope is refused (test 11)', () => {
  for (const mark of ['Reply with PRULE: <answer> for this project.', 'Or URULE: <answer> for every project.']) {
    const v = findViolations([`${CLEAN_A}\n${mark}`, CLEAN_B], SOURCES);
    assert.ok(v.some((x) => x.rule === RULES[0]), `not caught: ${mark}`);
  }
});

// TEST 13 — Ruling D. Each is a way the machine-wide answer has plausibly been promised to end the asking.
const PROMISES = [
  'Tell me once and I stop asking everywhere.',
  'Answer for every project on this machine and I will stop asking.',
  'Either way, say so in the same breath to stop asking.',
  'Say it for this machine and that ends the asking here.',
  "Once it is recorded for every project, you won't be asked again.",
  'Answering globally stops the prompting in this project too.',
];
check('RED CHECK: every promise that a machine-wide answer ends the asking is caught (test 13)', () => {
  for (const p of PROMISES) {
    assert.equal(promises(p), true, `not caught: ${p}`);
    assert.ok(findViolations([`${CLEAN_A}\n${p}`, CLEAN_B], SOURCES).some((x) => x.rule === RULES[1]), `not reported: ${p}`);
  }
});

check('the honest sentences are not caught', () => {
  for (const s of [
    'It writes the global file and nothing else, so this project will ask again until it has an answer of its own; say so.',
    'A machine-wide answer never stops the asking here.',
    'Answering for every project on this machine does not end the asking in this project.',
    'Is this for this project only, or for every project on this machine?',
    'Only an answer recorded for this project stops the asking.',
  ]) assert.equal(promises(s), false, `false positive: ${s}`);
});

// The blind spots the check prints every run, pinned unseen: a widening that catches one fails here, and
// BLIND_SPOTS is corrected in the same change.
check('each stated blind spot is measured unseen', () => {
  const split = 'Answer for every project on this machine. After that I stop asking.';
  assert.ok(sentences(split).every((s) => !promises(s)), 'a promise split across two sentences is now SEEN');
  assert.equal(promises('Tell me for this whole computer and I will leave you alone.'), false, 'a promise in other words is now SEEN');
  assert.deepEqual(findViolations([`${CLEAN_A}\nReply with PRULE : <answer>.`, CLEAN_B], SOURCES), [], 'a spaced mark is now SEEN');
});

check('RED CHECK: copy without the Decision 3 notice is refused', () => {
  const v = findViolations([CLEAN_A.replace(NOTICE, 'setup is unavailable'), CLEAN_B], SOURCES);
  assert.ok(v.some((x) => x.rule === RULES[2]));
});

check('RED CHECK: copy naming a command, flag, verdict or banner line the machinery sources do not have is refused', () => {
  const broken = [
    [CLEAN_A.replace('`record-global --answer', '`record-everything --answer'), SOURCES],
    [CLEAN_A.replace('`record-project --answer "<answer>"`', '`record-project --force`'), SOURCES],
    [CLEAN_A.replace('`issue_tracking: ask`', '`issue_tracking: maybe`'), SOURCES],
    [CLEAN_A, { ...SOURCES, bannerSource: 'lines.push(`  tracker: ${x}`);' }],
  ];
  for (const [copy, sources] of broken) {
    assert.ok(findViolations([copy, CLEAN_B], sources).some((x) => x.rule === RULES[3]), copy.slice(0, 80));
  }
});

check('a missing, unclosed, empty, nested or miscounted region is CANNOT RUN, never a pass', () => {
  assert.throws(() => extractRegions('no regions at all'), CopyUnavailable);
  assert.throws(() => extractRegions(`${REGION_START}\nno end`), CopyUnavailable);
  assert.throws(() => extractRegions(`${wrap('   ')}\n${wrap(CLEAN_B)}`), CopyUnavailable);
  assert.throws(() => extractRegions(`${REGION_START}\n${wrap(CLEAN_A)}\n${REGION_END}`), CopyUnavailable);
  assert.throws(() => extractRegions(wrap(CLEAN_A)), CopyUnavailable);
  assert.throws(() => extractRegions(`${wrap(CLEAN_A)}\n${wrap(CLEAN_B)}\n${wrap(CLEAN_B)}`), CopyUnavailable);
  assert.deepEqual(extractRegions(`x\n${wrap(CLEAN_A)}\ny\n${wrap(CLEAN_B)}\nz`), [CLEAN_A, CLEAN_B]);
});

check('the real skill and the real machinery sources satisfy every rule', () => {
  const { code, lines } = run();
  assert.equal(lines[0], `issue_tracking_copy: ${RULES.length} of ${RULES.length} copy rule(s) satisfied across 2 region(s)`, lines.join('\n'));
  assert.equal(code, 0, lines.join('\n'));
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test scripts/test/issue-tracking-copy.test.mjs`

Expected: FAIL — `Cannot find module '…/scripts/issue-tracking-copy.mjs'`.

- [ ] **Step 3: Write the check**

Create `scripts/issue-tracking-copy.mjs`:

```js
#!/usr/bin/env node
// The check over the issue-tracking copy in the developer-friendliness skill
// (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md, tests 11 and 13; the
// implementation plan's Decision 3). Repository tooling beside pair-census.mjs: it reads the skill
// source and two machinery sources as text, and imports neither plugin.
//
// WHAT IS THE SPEC'S AND WHAT IS THIS FILE'S. The requirements are the spec's: no mark for either scope
// (Rulings C and F), and "In this project, only an answer recorded for this project stops the asking."
// The PATTERNS below are this file's, written against the copy that exists — the spec writes no copy
// and says so. Rewrite the patterns with the copy; never rewrite the requirements.
//
// Usage: node scripts/issue-tracking-copy.mjs
// Exit codes: 0 clean, 1 a copy rule is broken, 2 the check could not run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL = path.join(REPO, 'claude-code', 'developer-friendliness', 'developer-friendliness', 'SKILL.md');
export const TRACKING = path.join(REPO, 'plugins', 'machinery', 'scripts', 'issue-tracking.mjs');
export const BANNER = path.join(REPO, 'plugins', 'machinery', 'scripts', 'banner.mjs');

export const REGION_START = '<!-- issue-tracking:start -->';
export const REGION_END = '<!-- issue-tracking:end -->';
export const REGIONS_EXPECTED = 2; // § 3.2 and § 8
export const NOTICE = 'project issue-tracking setup needs machinery installed';
export const BANNER_LABEL = 'issue tracking command:';
export const RULES = Object.freeze(['no mark offered', 'no end-of-asking promise', 'carries the no-machinery notice', 'names only commands that exist']);
export const BLIND_SPOTS = Object.freeze([
  'copy outside the two marked regions',
  'a mark written with a space before its colon',
  'a promise split across two sentences',
  'a promise in words other than stop, end, done or ask again',
]);

// Every way this check can be blind raises this, so a blind run can never come out as a clean one.
export class CopyUnavailable extends Error {
  constructor(message) { super(message); this.name = 'CopyUnavailable'; }
}

export function extractRegions(text) {
  const regions = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(REGION_START, from);
    if (start === -1) break;
    const end = text.indexOf(REGION_END, start);
    if (end === -1) throw new CopyUnavailable(`${REGION_START} at offset ${start} is never closed`);
    const nested = text.indexOf(REGION_START, start + REGION_START.length);
    if (nested !== -1 && nested < end) throw new CopyUnavailable(`a second ${REGION_START} opens at offset ${nested} before the first closes`);
    const body = text.slice(start + REGION_START.length, end).trim();
    if (!body) throw new CopyUnavailable(`the region at offset ${start} is empty — missing copy, never compliant copy`);
    regions.push(body);
    from = end + REGION_END.length;
  }
  const ends = text.split(REGION_END).length - 1;
  if (ends !== regions.length) throw new CopyUnavailable(`${ends} ${REGION_END} marker(s) for ${regions.length} region(s)`);
  if (regions.length !== REGIONS_EXPECTED) throw new CopyUnavailable(`found ${regions.length} issue-tracking region(s), expected ${REGIONS_EXPECTED} (§ 3.2 and § 8)`);
  return regions;
}

const collapse = (s) => s.replace(/\s+/g, ' ').trim();
// Sentences of whitespace-collapsed copy, so a sentence hard-wrapped across lines is read whole; a
// bullet marker also starts a new sentence.
export const sentences = (text) => collapse(text).split(/(?<=[.!?])\s+|\s+(?=-\s)/).map((s) => s.trim()).filter(Boolean);

const MARK = /\b[PU]RULE:/;
const MACHINE_WIDE = /\b(?:every project|all (?:of )?(?:your |the )?projects|this machine|machine-wide|globally|everywhere|either way|both (?:routes|answers|scopes)|whichever)\b/i;
const STOP_ASKING = /\b(?:stop|stops|stopped|end|ends|ended)\b(?:\s+\w+){0,3}?\s+(?:ask|prompt)(?:s|ed|ing)?\b/gi;
const NEGATED = /(?:\b(?:never|not|no)|n't)\s+(?:\w+\s+){0,2}$/i;
const NO_MORE_ASKING = /(?:\b(?:never|not|no longer)|n't)\s+(?:\w+\s+){0,2}(?:ask|prompt)(?:s|ed|ing)?\s+(?:again|anymore|any more)\b/i;
const DONE_ASKING = /\b(?:done|finished)\s+(?:with\s+)?asking\b|\btell me once\b|\bonce and for all\b/i;

// True when one sentence ties the end of the asking to the machine-wide answer.
export function promises(sentence) {
  if (!MACHINE_WIDE.test(sentence)) return false;
  if (NO_MORE_ASKING.test(sentence) || DONE_ASKING.test(sentence)) return true;
  for (const m of sentence.matchAll(STOP_ASKING)) if (!NEGATED.test(sentence.slice(0, m.index))) return true;
  return false;
}

const USE = /`((?:decide|record-[a-z]+)(?: [^`]*)?)`/g;
const VERDICT = /`(issue_tracking: [a-z ]+)`/g;

function commandViolations(all, { trackingSource, bannerSource }) {
  const out = [];
  if (!all.includes(BANNER_LABEL)) out.push(`the copy never names the banner line "${BANNER_LABEL}", so a session cannot find the command`);
  if (!bannerSource.includes(BANNER_LABEL)) out.push(`banner.mjs does not print "${BANNER_LABEL}", so every session would read machinery as not installed`);
  const verdicts = [...all.matchAll(VERDICT)].map((m) => m[1]);
  if (verdicts.length === 0) out.push('the copy names no verdict line to act on');
  for (const v of verdicts) if (!trackingSource.includes(`'${v}'`)) out.push(`the copy acts on "${v}", which issue-tracking.mjs never prints`);
  const uses = [...all.matchAll(USE)].map((m) => m[1].split(' '));
  if (uses.length === 0) out.push('the copy names no issue-tracking.mjs subcommand');
  for (const [sub, ...rest] of uses) {
    if (!trackingSource.includes(`'${sub}'`)) out.push(`the copy runs "${sub}", which issue-tracking.mjs does not implement`);
    for (const flag of rest.filter((t) => t.startsWith('--'))) {
      if (!trackingSource.includes(`'${flag}'`)) out.push(`the copy passes ${flag} to ${sub}, which issue-tracking.mjs does not read`);
    }
  }
  return out;
}

export function findViolations(regions, sources) {
  const all = collapse(regions.join(' '));
  const v = [];
  const mark = MARK.exec(all);
  if (mark) v.push({ rule: RULES[0], message: `the copy offers ${mark[0]} — no mark is offered for either scope (Rulings C and F)` });
  for (const s of sentences(all)) {
    if (promises(s)) v.push({ rule: RULES[1], message: `"${s}" ties the end of the asking to the machine-wide answer (Ruling D)` });
  }
  if (!all.includes(NOTICE)) v.push({ rule: RULES[2], message: `the copy does not carry "${NOTICE}" (Decision 3)` });
  for (const m of commandViolations(all, sources)) v.push({ rule: RULES[3], message: m });
  return v;
}

export function proofLine(violations, regionCount) {
  const broken = new Set(violations.map((x) => x.rule)).size;
  return `issue_tracking_copy: ${RULES.length - broken} of ${RULES.length} copy rule(s) satisfied across ${regionCount} region(s)`;
}

const read = (f) => { if (!fs.existsSync(f)) throw new CopyUnavailable(`cannot read ${f}: it does not exist`); return fs.readFileSync(f, 'utf8'); };

export function run() {
  const regions = extractRegions(read(SKILL));
  const v = findViolations(regions, { trackingSource: read(TRACKING), bannerSource: read(BANNER) });
  const lines = [proofLine(v, regions.length), ...v.map((x) => `issue_tracking_copy: ${x.rule}: ${x.message}`), `issue_tracking_copy: cannot see ${BLIND_SPOTS.join('; ')}`];
  return { code: v.length ? 1 : 0, lines };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const { code, lines } = run(); process.stdout.write(`${lines.join('\n')}\n`); process.exitCode = code; }
  catch (e) { process.stderr.write(`issue_tracking_copy: CANNOT RUN: ${e.message}\n`); process.exitCode = 2; }
}
```

Run: `node --test scripts/test/issue-tracking-copy.test.mjs`

Expected: every fixture case passes; the last case FAILS with `CopyUnavailable: found 0 issue-tracking region(s), expected 2 (§ 3.2 and § 8)` — the copy is not written yet.

- [ ] **Step 4: Write the copy into the skill source**

In `claude-code/developer-friendliness/developer-friendliness/SKILL.md` § 3.2, insert after the paragraph ending `new convention you invented on their behalf.` (one blank line before and after):

````markdown
<!-- issue-tracking:start -->
**Where issue tracking lives is the one such question whose answer is stored.**
It sits in `<project>/.claude/rules/project_issue_tracking.md` for one project
and in `~/.claude/rules/global_issue_tracking.md` for every project on this
machine. Each file holds `unanswered` (nobody has been asked; an empty file
reads the same), `none` (asked: no issue tracking here), or the answer. The
project file governs wherever it exists; the global file governs only a project
with no file of its own, and otherwise offers its answer as the pre-fill.

Do not decide from the files you have loaded. The first time this session needs
a tracker for this project, run the command on the `issue tracking command:`
line of the `machinery:` session banner with `decide`, and hold the conversation
below if and only if it prints `issue_tracking: ask`. If it exits non-zero, tell
the developer what it printed and ask nothing. If no banner in this session has
that line, say once, plainly, that project issue-tracking setup needs machinery
installed, and then ask nothing and write nothing about it.

Open with this, filling a `<…>` only from what you read or were told in this
session:

```text
I don't see issue tracking for this project.

  Example: "Use GitHub Issues to track this project."

[only when decide printed a pre-fill]
  On this machine you already use: <pre-fill>. Use the same here?
```

Then ask one question at a time, and only what is still unknown: never what the
developer has said, nor what a read-only command has just established.

```text
Which tracker, and which project in it?        -> <tracker>, <project>
Is <tool> installed?                            -> if not, suggest installing it
Is <tool> signed in?                            -> if not, offer help; the developer
                                                   runs `! <tool login command>`
Checking the route works: <read-only check>     -> say whether the read worked
Is this for this project only, or for every project on this machine?
```

You may establish facts cheaply first (the git remote, whether `gh`, `jira` or
`linear` is on `PATH` and signed in, whether an issue-tracker MCP server is
connected), but a detected fact never replaces the pre-fill in what you offer,
and nothing is recorded until the developer states or confirms it.

- **The reachability read** is one read that only a working route could answer:
  for GitHub, `gh auth status` and `gh issue list -R <project> -L 1`. Never
  create, edit, comment on, label, assign, close or reopen anything on the
  tracker, not even a test issue; never change the tool's sign-in or
  configuration; never record anything the read returned. It tells the
  developer whether the route works, and that is all it produces.
- **Credentials:** help the developer sign in, and write none of it anywhere.
  No token, password or API key, and not the name of the place a token is
  stored, goes into either file, the inbox, or anything intake files.
- **Recording:** word the answer as `Issue tracking: <tracker> on <project>,
  reached with <tool>.` with `Check: <status command> and <one-item read
  command>.` on its own line; the opt-out is the answer `none`. Record it only
  with the command, never by editing either file or the inbox yourself.
  - This project only: `record-project --answer "<answer>"`, then file the
    entry it names with rule intake from a root session. If the developer's own
    message carried a project mark and capture already recorded it, record
    nothing more.
  - Every project on this machine: `record-global --answer "<answer>"`. It
    writes the global file and nothing else, so this project will ask again
    until it has an answer of its own; say so.
<!-- issue-tracking:end -->
````

In § 8, insert immediately after the bullet ending `Ask it once and apply the answer everywhere.`:

```markdown
<!-- issue-tracking:start -->
- **Where issue tracking lives is the exception: its answer is stored.** The
  project's `.claude/rules/project_issue_tracking.md` governs wherever it
  exists, and `~/.claude/rules/global_issue_tracking.md` otherwise; each holds
  `unanswered`, `none` or the answer. § 3.2 says when to run `decide`, how to
  hold the conversation, and how `record-project` and `record-global` record the
  answer.
<!-- issue-tracking:end -->
```

- [ ] **Step 5: Run the check and watch it pass**

Run: `node --test scripts/test/issue-tracking-copy.test.mjs`

Expected: PASS, 9 cases, and the line `issue_tracking_copy_tests: 9 of 9 test(s) passed`.

Run: `node scripts/issue-tracking-copy.mjs`

Expected, exit 0:
```
issue_tracking_copy: 4 of 4 copy rule(s) satisfied across 2 region(s)
issue_tracking_copy: cannot see copy outside the two marked regions; a mark written with a space before its colon; a promise split across two sentences; a promise in words other than stop, end, done or ask again
```

- [ ] **Step 6: Restage, bump, run the hook**

Run: `node scripts/build-skills.mjs build` — expected among its lines: `✓ staged 1 skill(s) into plugins/developer-friendliness/skills/`.

`plugins/developer-friendliness/.claude-plugin/plugin.json`: `"version": "0.1.2"` → `"version": "0.1.3"`.

Run: `sh .githooks/pre-commit` — expected exit 0; `check` prints `✓ developer-friendliness 0.1.3 is a new version` and `plugins/developer-friendliness/skills/ matches source`; the scripts suite prints `issue_tracking_copy_tests: 9 of 9 test(s) passed` beside its existing count lines.

- [ ] **Step 7: Commit**

```bash
git add -- scripts/issue-tracking-copy.mjs scripts/test/issue-tracking-copy.test.mjs
git commit -m "developer-friendliness: the issue-tracking setup conversation, and the check over its copy (#99)" -- claude-code/developer-friendliness/developer-friendliness/SKILL.md plugins/developer-friendliness/skills/developer-friendliness/SKILL.md plugins/developer-friendliness/.claude-plugin/plugin.json scripts/issue-tracking-copy.mjs scripts/test/issue-tracking-copy.test.mjs
```

---

## Task 9: Documentation — the spec amended, the ledger, the README (once, after the last coding task)

Per `plugins/machinery/rules/work-tracking.md` § The learnings record, the repeats each task would otherwise carry are done here once: the effort ledger, the spec amendment for the three decisions, and the README. **No register row is owed:** no file under `plugins/machinery/rules/` changes (prediction 2 confirms it).

**Files:**
- Modify: `docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md`
- Create: `docs/learnings/issue-tracking-config.md`
- Modify: `plugins/machinery/README.md` (the SessionStart bullet, line 25; a new section after "## Where the rules live")
- Modify: `plugins/machinery/.claude-plugin/plugin.json` (`0.1.120` → `0.1.121`)

**Interfaces:**
- Consumes: the landed Tasks 1–8, their measured test counts and `duration_ms` values from the task reports.
- Produces: documentation only.

- [ ] **Step 0: Confirm the three decisions are confirmed**

Decisions 1–3 were pending the owner's confirmation when this plan was written. Before editing the spec, find the owner's confirmation in the conversation that dispatched you, in his own words. **If he has not confirmed all three, stop and report that; do not amend the spec.** If he changed any of them, stop and report which; the spec is amended to what he confirmed, which may need a revised task.

- [ ] **Step 1: Amend the spec**

Make these edits to `docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md`. None of Rulings A–H is edited.

(a) After the header paragraph (it ends `Ticket #99, companion #100.`), insert a new paragraph:

```markdown
**Amended after implementation.** Three questions this document left open were decided afterwards by
the main conversation and confirmed by the owner — see *Decisions taken after the rulings*. The
implementation plan is `docs/superpowers/plans/2026-09-12-issue-tracking-config.md`.
```

(b) Immediately before `## What this is not`, insert:

```markdown
## Decisions taken after the rulings

These three are not rulings: this document left each open, the main conversation decided it, and the
owner confirmed it. Recorded here beside the rulings so a reader meets both.

**Decision 1 — both answers are recorded through commands, never typed freehand.** The inbox parser
silently skips an entry whose heading it does not recognise and throws on a recognised heading with no
disposition line, and nothing helped write a correctly shaped entry. So
`plugins/machinery/scripts/issue-tracking.mjs record-project` appends the project entry in the parser's
shape, with the note `rules/rule-governance.md` § Dictating a rule requires, and reads it back through
the parser, failing loudly unless it finds exactly that entry — still Ruling F: the assistant writes the
entry, the command guarantees its shape. And `issue-tracking.mjs record-global` writes
`~/.claude/rules/global_issue_tracking.md` and nothing else — no inbox entry, no intake, no write under
`rulesSource()` (it refuses when the file would land there), no commit, never the project file — still
Ruling A: written directly, outside the pipeline. Tests 7(a3), 7(b) and the first half of 12 now
exercise product code. Closes observations 2 and 3.

**Decision 2 — the function runs the first time a session needs a tracker for this project,** not at
session start. The owner's own earlier answer on when setup should happen — *"Lazily, first time the
tracker is needed."* — carried forward; the later redesign never replaced it. Closes observation 1.

**Decision 3 — no machinery installed: one plain notice, then nothing.** When the function cannot be
found, the assistant says once, plainly, that project issue-tracking setup needs machinery installed,
and neither prompts nor writes. Grounds: `rules/design-invariants.md` § Telling the user what you
dropped. The skill finds the function through the machinery session banner's
`issue tracking command:` line; a session without that line is a session without machinery. Settles
the first half of open question 1.
```

(c) In *The honest limits*, replace the bullet that begins `- **The project entry is written by hand, and loses capture's guarantees.**` (through `…the assistant edits the file.`) with:

```markdown
- **The project entry is written by a command the assistant runs, and still loses one of capture's
  guarantees.** The capture hook writes its entry before the assistant replies and survives a session
  that ignores its rules or dies part-way through. `record-project` (Decision 1) guarantees the entry's
  shape and that exactly one pending issue-tracking entry exists — it reads the entry back through the
  inbox parser and refuses a second — but a session that ends between the developer's answer and the
  command being run still loses the answer, and the prompt fires again next session. That the
  assistant runs the command at all is prose, exactly as running the precedence function is.
```

(d) In *Tests required*, test 7: replace the paragraph beginning `(a3) What these cannot reach, named rather than implied:` (through `See *Open questions*, observation 2.`) with:

```markdown
   (a3) `record-project` writes exactly one pending entry of the project kind, carrying the note, into
   the root checkout's inbox (from a worktree too), reads it back through the parser, and refuses a
   second while one is pending (Decision 1).
```

and replace the sentence beginning `Like (a3), the write is the assistant's act and no product code records a global answer;` (through `See *Open questions*, observation 2.`) with:

```markdown
The global write is `record-global` (Decision 1), and the negative is asserted against it; intake
additionally refuses `--issue-tracking` on `--kind universal`.
```

(e) In test 12, replace the sentence `The second half calls the function; the first half, like 7(b), has no product code performing the global write — see *Open questions*, observation 2.` with:

```markdown
The first half runs `record-global` and the second runs `decide` (Decision 1).
```

(f) In *Places in the code this touches*, replace the bullet path `**`plugins/developer-friendliness/skills/developer-friendliness/SKILL.md` § 3.2 and § 8**` with `**`claude-code/developer-friendliness/developer-friendliness/SKILL.md` § 3.2 and § 8** (the source; `node scripts/build-skills.mjs build` regenerates the staged copy under `plugins/developer-friendliness/skills/`)`, and append to that list:

```markdown
- **`plugins/machinery/scripts/issue-tracking.mjs`** — the command-line entry: `decide` (the precedence
  function), `record-global` and `record-project` (Decision 1). **`plugins/machinery/scripts/banner.mjs`**
  names it by absolute path on its `issue tracking command:` line (Decision 3).
  **`plugins/machinery/scripts/lib/inbox.mjs`** gains `newStamp()` and `formatEntry()`, so the entry shape
  is spelled once. **`plugins/machinery/scripts/lib/config.mjs`** builds both file paths.
```

(g) In *Open questions*, append to observation 1: ` **Closed by Decision 2.**`; to observation 2: ` **Closed by Decision 1.**`; to observation 3: ` **Closed by Decision 1.**`; and to open question 1: ` **Its first half — what the skill does without machinery — is settled by Decision 3.**`

Run: `node plugins/machinery/scripts/gate/gate.mjs --root plugins/machinery --universal` — expected exit 0 (the spec is quoted by no gate claim that these edits touch; confirm rather than assume).

- [ ] **Step 2: Write the effort ledger**

Create `docs/learnings/issue-tracking-config.md` with these sections, in this order, following `docs/learnings/developer-friendliness-plugin.md`'s form:

1. A heading `# Issue tracking configuration — effort ledger`, the ticket (`#99`, companion `#100`), the working copy and branch, and the base commit 09d40ff.
2. `## Predictions, confirmed one by one` — the plan's eleven predictions, each followed by the command you ran for it, its output verbatim, and `held` or `did not hold`. A prediction that did not hold is stated first in the file, at full strength, naming whether the work or the belief was wrong.
3. `## Measured` — for each task: tests added, the machinery suite's `tests`/`fail`/`duration_ms` after it, and the version it set.
4. `## What changed, what did not` — the three decisions as landed; that the purity scan (spec I34) cannot see `record-global`'s write because its reach is a write call whose own line names `rules`; that `record-project`'s post-write readback branch is proved only through `findRecorded`'s unit cases; the copy check's four blind spots.
5. `## Still open` — this plan's *Open questions*, each with its status after the work.

- [ ] **Step 3: Update the machinery README**

In `plugins/machinery/README.md`, in the SessionStart bullet (line 25), change `whether the \`unbreakable\` plugin is installed)` to `whether the \`unbreakable\` plugin is installed, and the absolute path of the issue-tracking command)`.

After the section `## Where the rules live` (before `## Filing a universal rule`), insert:

```markdown
## Issue tracking

Where a project's issue tracking lives is stored in `.claude/rules/project_issue_tracking.md`, and for
every project on the machine in `~/.claude/rules/global_issue_tracking.md`; install seeds each with
`unanswered` and never overwrites one. `scripts/issue-tracking.mjs decide` says whether to ask
(the project file governs wherever it exists), `record-project` writes the project answer's inbox entry
for intake to file, and `record-global` writes the global file and nothing else. The design and its
rulings: `docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md` in the source repository.
```

- [ ] **Step 4: Bump, run the hook**

`plugins/machinery/.claude-plugin/plugin.json`: `"0.1.120"` → `"0.1.121"`. Run `sh .githooks/pre-commit`; expected exit 0.

- [ ] **Step 5: Commit**

```bash
git add -- docs/learnings/issue-tracking-config.md
git commit -m "docs: issue tracking — spec amended for Decisions 1-3, effort ledger, README (#99)" -- docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md docs/learnings/issue-tracking-config.md plugins/machinery/README.md plugins/machinery/.claude-plugin/plugin.json
```

---

## Where each test lands

| Spec test | What it asserts | Task | File |
|---|---|---|---|
| 1 | Seeding is idempotent and never overwrites, project and machine | 2 | `install.test.mjs` |
| 2 | An answer, `none`, and an empty file survive a re-run, project and machine | 2 | `install.test.mjs` |
| 3 | A project `unanswered` asks, whatever the global file says | 3 | `issue-tracking.test.mjs` |
| 4 | A project `none` and a project answer do not ask, against two global fixtures | 3 | `issue-tracking.test.mjs` |
| 5 | No project file: the global file governs | 3 | `issue-tracking.test.mjs` |
| 6 | The global answer is the pre-fill | 3 (and 5, through `decide`) | `issue-tracking.test.mjs`, `issue-tracking-cli.test.mjs` |
| 7(a1) | A plain-words answer to the capture hook writes no inbox | 6 | `capture.test.mjs` |
| 7(a2) | A hand-recorded entry parses as one pending entry with its note; intake files it into the named home | 7 | `intake.test.mjs` |
| 7(a3) | Exactly one entry, with the note, is written — **now product code (Decision 1)** | 6 | `issue-tracking-cli.test.mjs` |
| 7(b) | The global answer: no inbox, no intake, no write under `rulesSource()`, no bump, no commit — **now product code (Decision 1)** | 5, 7 | `issue-tracking-cli.test.mjs`; `intake.test.mjs` (universal refused) |
| 8 | Positive control: the function asks, and is not stuck asking | 3 | `issue-tracking.test.mjs` |
| 9 | One spelling of each name and state word, with a case proving the check matches | 1 | `issue-tracking-names.test.mjs` |
| 10 | The seed is the single state word | 2 | `install.test.mjs` |
| 11 | The conversation offers no mark | 8 | `scripts/test/issue-tracking-copy.test.mjs` |
| 12 | A global answer leaves a seeded project file byte-identical (**first half now product code, Decision 1**), and that project still asks | 5 | `issue-tracking-cli.test.mjs` |
| 13 | The copy does not promise a machine-wide answer ends the asking — **pattern and copy are this plan's** | 8 | `scripts/test/issue-tracking-copy.test.mjs` |
| 14 | An empty file is read as `unanswered`, and is not an absent file | 3 | `issue-tracking.test.mjs` |

**Tests the three decisions add:**

| Test | Decision | Task | File |
|---|---|---|---|
| The inbox round trip: one entry, read back; a second refused; nothing written for a structural answer, a malformed inbox, or no session id | 1 | 6 | `issue-tracking-cli.test.mjs`, `issue-tracking.test.mjs` (`findRecorded`: one, zero under an unknown heading, two) |
| The entry lands in the root checkout's inbox from a worktree | 1 | 6 | `issue-tracking-cli.test.mjs` |
| The global command's negative assertions, and its refusal under `rulesSource()` | 1 | 5 | `issue-tracking-cli.test.mjs` |
| Answer validation (empty, seeded word, index-breaking) | 1 | 5, 7 | `issue-tracking.test.mjs`, `issue-tracking-cli.test.mjs`, `intake.test.mjs` |
| The no-machinery notice: the banner names the command or says `MISSING` | 3 | 4 | `banner.test.mjs` |
| The no-machinery notice: the copy carries it, and names only commands and a banner line that exist | 3 | 8 | `scripts/test/issue-tracking-copy.test.mjs` |
| When the function runs | 2 | 8 | Copy only; nothing mechanical checks the moment |

**Not added, as the spec says:** a test that reachability is checked by a real read.

---

## Open questions

None of these blocks a task. Each is for the main conversation or the owner, not the implementer.

1. **How the skill finds the command** (choice 1) is not settled by the spec or by the three decisions. The banner line keeps Decision 2 (it prints, it does not run) and gives Decision 3 a mechanism, but it adds one line to every machinery session and makes the skill's behaviour depend on the banner's label — which Task 8's check pins.
2. **A global `none` is offered as the pre-fill** (choice 3), by a literal reading of the precedence row. The conversation's pre-fill line was illustrated for a tracker, and reads oddly for `none`.
3. **From a worktree, `decide` reads the root checkout's project file** (choice 4), while Claude Code loads the worktree's own `.claude/rules` copy, which may be older. The two can disagree until the worktree picks up the filing.
4. **"Verbatim" for an assembled answer** (the spec's observation 4) stays open. `record-project` quotes the worded answer the developer stated or confirmed, and the inbox is append-only, so what it writes stays.
5. **An answer for both scopes** (the spec's observation 5) stays unruled. The copy offers the two scopes as alternatives and does not offer "both".
6. **The rest of the spec's open question 1** — that `developer-friendliness` now names machinery, and that the skill loads into every session on machines without it — is a cost stated in Task 8, not resolved.
7. **Read-only is still not enforced** (the spec's open question 2). This plan builds nothing that confines the read.
8. **The spec's recommendation that detection say once when the answer contradicts it** is not built. The spec marks it *never put to Gabe* and says a later change may drop it; this plan builds no detector.
9. **Tickets #99 and #100 are not touched** by this plan; bringing them in line and writing the learnings into #100 is a separate act.
10. **Version bumps are serialized** through nine commits (`machinery` 0.1.112 → 0.1.121, `developer-friendliness` 0.1.2 → 0.1.3). Another branch bumping `machinery` meanwhile collides at merge, and whoever merges second re-bumps.
