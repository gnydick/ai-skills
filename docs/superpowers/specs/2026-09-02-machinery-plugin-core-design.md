# Machinery Plugin — Core — Design

2026-09-02. Approved in session by Gabe. Spec 1 of 2 (spec 2: merge gate and
ratchets, depends on this one).

## Goal

Turn the prose union at `combine-projects-machinery/union/` into the most
functional, most automatic form it can take on Claude Code: an installable
plugin `machinery` whose universal rules are always on for every session on
the machine, whose Claude-side hooks and per-project commit gate actually run,
and whose rule-dictation loop closes without anyone remembering a step.

Built can't-break-by-design: every invariant below names the mechanism that
holds it and the enforcement rung that mechanism earns. Rung numbers are the
skill's ladder (0 comment … 8 unrepresentable).

## Decisions taken at brainstorming (binding)

- **Language: Node**, zero dependencies, ESM, `node:test`. Claude Code requires
  Node, so every machine that can run the plugin has it.
- **Per-project layer installed by one command** (`/machinery:install`), never
  by hand and never self-installing.
- **Universal rules read from a configurable source directory**, default the
  plugin's own `rules/`, overridable to a checkout; made always-on by a
  junction under `~/.claude/rules/` (native loading), not by context injection.
- **Two markers, split at capture:** `PRULE:` = project rule, `URULE:` =
  universal rule. Bare `RULE:` captures nothing and asks which.
- **Capture triggers intake automatically** in the same turn where filing is
  permitted.
- **Scope split:** this spec = plugin core (Claude-side hooks, rules,
  install, commit gate, intake, skills, agents). Spec 2 = merge gate and
  ratchets.
- **Rulings carried from the union** (RECONCILIATION.md): project rules
  captured and filed in the project root; universal rules live in this plugin,
  never in a project inbox/index/gate; merge locally → gate the result → publish
  when green; hosted check blocks, local merge gate is the sole backstop
  without hosted CI; the commit gate runs on every commit and stays cheap;
  hooks activated per clone, never self-installing.

## Platform facts this design rests on

| Fact | Status |
|---|---|
| `~/.claude/rules/*.md` loads for every project on the machine, recursively, and is re-read after `/compact`. | Documented (memory.md). |
| Plugins carry `skills/`, `agents/`, `hooks/hooks.json`, `commands/` (legacy), `bin/`, `settings.json`; hook commands see `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PROJECT_DIR}`. | Documented (plugins.md, hooks.md). |
| `SessionStart` / `UserPromptSubmit` hook `additionalContext` reaches the model. | Observed (this session's own hook output); not in the docs read. |
| `PreToolUse` hook can rewrite a tool's input via `hookSpecificOutput.updatedInput`. | Observed (ferrislicer `quiet_hook.py:154-157`, 26 passing tests); not in the docs read. |
| `WorktreeCreate` is a hook event. | Observed (ferrislicer `settings.json`, the worktree tool's own description); docs list only seven events. |
| A worktree-isolated session cannot run git against the shared checkout (`-C` refused). | Observed today. |

Observed facts are verified by hand in the plan's final task and dated here
when confirmed. Nothing depends on `WorktreeCreate` (I22).

## Shape

```
plugins/machinery/
  .claude-plugin/plugin.json      name "machinery", semver version
  hooks/hooks.json                five events → scripts/
  scripts/                        banner, capture, nudge, quiet, quiet-run, worktree-create,
                                  install, reload, reindex, intake, place, bump, disposition
    lib/                          root (git common dir), config, parsers (inbox, frontmatter),
                                  index generator, emit (hook JSON), git runner, report
    gate/                         gate.mjs + the read-side lib subset copied into projects
  agents/                         invariant-auditor.md (with the audit method), comparison-agent.md
  skills/                         staged by the build from bucket claude-code/
  rules/                          ten universal rule files — the single copy
  register/INDEX.md               generated
  inbox.md                        universal inbox (URULE captures)
  templates/hosted-check.yml      installed only with --hosted
  test/                           node:test; fixtures/payloads/ (recorded hook inputs)
```

Repo integration: a new bucket `claude-code/` in `skills.manifest.json`
(target `claude-plugin` only) routed to `machinery`, holding `rule-intake`,
`effort-lifecycle`, `refresh-diverged-branch`, `install`, `reload`,
`reindex`. `combine-projects-machinery/` stays exempt from the bucket check.
The union directory keeps the stories (`hooks/*.md`, `gates/*.md`,
`WIRING.md`), the records, and a README pointing at the plugin; its `rules/`,
`register/`, and `agents/` are **moved** into the plugin (deleted from the
union, not left as twins). The version-bump check covers the whole plugin
path and stays: intake performs the bump itself.

## Rules

- **Universal:** `plugins/machinery/rules/*.md`. `/machinery:install
  --machine` (once per machine) creates the junction
  `~/.claude/rules/machinery` → rules source (`~/.claude/machinery.json`
  `{"rulesSource": …}`, default the plugin's `rules/`).
- **Project:** the project's `.claude/rules/*.md`, native loading, written to
  only by intake. Group file names default to the universal ones.
- **Never under a rules directory:** the inbox and the index. Project:
  `.claude/machinery/{inbox.md, INDEX.md}`. Plugin: `inbox.md`,
  `register/INDEX.md`.
- **Rule identity = file § section.** Per-file frontmatter carries the human
  decisions only: `status: 🟢|🟡|🔴` (the union's meanings) and `supersedes:`
  entries (`section`, `by: file § section`, `date`). The index is generated:
  file list, per-file counts, sections, and the reverse supersession links.
- **Inbox entry:** `## PENDING <ISO timestamp> <PRULE|URULE>` + verbatim text
  + a `disposition:` line written by intake (`filed → file § section` |
  `dismissed: <reason>`). Any PENDING block blocks commits.
- **Reload:** `/machinery:reload` prints the universal rule files (and with
  `--project` the project's) into context; intake runs it after a universal
  filing. Other sessions pick a rule up at their next start (platform ceiling,
  stated by the banner).

## Claude-side mechanisms (`hooks/hooks.json`)

| Event | Script | Behavior | Timeout | Failure posture |
|---|---|---|---|---|
| SessionStart | banner | Prints measured facts: rules source and whether the junction resolves; `core.hooksPath` set?; installed gate stamp vs plugin version; pending entries per inbox; whether `WorktreeCreate` has been observed; whether `cant-break-by-design` is installed; the two markers. | 10 s | loud, non-blocking |
| UserPromptSubmit | capture | `PRULE:` → PENDING block appended to the project root's inbox (root = git common dir, never cwd); `URULE:` → the universal inbox beside the rules source; bare `RULE:` → nothing written, context "PRULE or URULE?". Append-only, no dedup. Returns context "captured to ‹inbox› — run intake now" (root session) or "captured to the root; filed from a root session" (worktree session). Also: if pending entries exist and this session may file them, prepends "N rules pending — running intake". | 30 s | loud (non-zero on write failure) |
| PostToolUse Edit\|Write | nudge | Edited path is a rule file or inbox → regenerate index in memory, compare; stale → one-line nudge. Query failure → silence. | 30 s | silent |
| PreToolUse Bash\|PowerShell | quiet | `classify(command)` → read / piped / redirected / infra / noisy / plain; only infra and noisy are rewritten (`updatedInput`) to `quiet-run --shell ‹bash\|powershell› -- ‹command›`. quiet-run: same shell the tool would use; both streams as one; line endings and control frames normalized; infra → proof-of-success lines only; noisy → keep-set (heartbeat lines always survive); 200-line ceiling, 3/5 head + 2/5 tail, both elision markers; exit status preserved; `--quiet` never added; opt-out env var; 40-line pass-through for short output. | 15 s | **open** (hook error → command runs unfiltered) |
| WorktreeCreate | worktree-create | Branch = copy name verbatim; base per `worktree.baseRef` (`head` → local HEAD, `fresh` → origin default, fallback local HEAD); attach if branch exists; stdout = path only; chatter → stderr; non-zero aborts. | 300 s | closed |

Stories are the specs: each script's header cites its union story; each test
file is that story's acceptance checks.

## Git-side: `/machinery:install` and the commit gate

`/machinery:install` in a project (idempotent): refuse outside a repo; create
`.claude/rules/` if absent and `.claude/machinery/{inbox.md, INDEX.md}`
(generated); copy `gate.mjs` + read-side lib into `.githooks/machinery/`
stamped with the plugin version; write `.githooks/pre-commit` (`node
.githooks/machinery/gate.mjs`); `git config core.hooksPath .githooks` — the
only code path that does so; `--hosted` writes `templates/hosted-check.yml`
into the project (off by default; the banner reports "no hosted check" rather
than pretend). Print what it did and measured.

The gate, every commit, check-only, cheap — a closed list:
1. **Register check (fast):** PENDING block → fail; staged index ≠ fresh
   regeneration → fail ("the index is generated — run intake/reindex");
   unparseable frontmatter → fail; supersession stamp naming a missing
   section → fail.
2. **Citation-target check:** every *new* citation in the staged hunks —
   `path:line` → file exists, line non-blank; `file § Section` → file and
   heading exist — read from the index (merge tip in merge mode); self-excludes
   the checker and fixtures; never re-audits old citations.
3. **Sweep guard (advisory, exit 0):** docs-shaped commit that also adds a
   brand-new non-docs file → warn with the file and denominators; silent when
   the commit also modifies an existing non-docs file.
Header-stated: bypass twice → fix the checker; activated per clone by
`/install`, never self-installing. Every executed check prints its count line,
zero included. The gate never runs tests, builds, formatters, or the full
scan — spec 2's merge gate does.

Universal side: this repo's `.githooks/pre-commit` runs `gate.mjs --universal`
over `plugins/machinery/`.

## Intake

Two pipelines, each one commit in one repository:

- `PRULE` → project inbox → `.claude/rules/<group>.md` (section chosen or
  created) → `reindex` → disposition → commit, in the project root.
- `URULE` → universal inbox → `plugins/machinery/rules/<group>.md` → `reindex`
  → `bump` (patch) → disposition → commit, in the rules-source checkout →
  `reload`.

Scripts do the mechanical parts (`intake` lists pending; `place` inserts a
bullet under a heading; `reindex`; `bump`; `disposition`; the commit). The
model supplies only: final wording from the verbatim capture, the file and
section, and whether it supersedes an existing section (test: would that
group's own remedy have produced this fix?). Post-mortem candidate rules stay
proposals the owner dictates; agents never file.

Where it runs: a `PRULE` is filed only from a root session (git dir = common
dir); a worktree session captures to the root and is told so; every eligible
session's next prompt runs intake for what is pending. `URULE` filing needs a
non-isolated session (any project). The gate keeps root commits blocked until
filing happens.

## Agents, skills, split

- `agents/invariant-auditor.md`: the union brief plus, as its procedure
  section, the two audit-apparatus sections removed from
  `rules/design-invariants.md` (denominator; output). `agents/comparison-agent.md`
  as in the union.
- Skills (bucket `claude-code/`): `rule-intake` (markers, scripts, root rule),
  `effort-lifecycle` (merge step generic until spec 2's `/machinery:merge-gate`
  exists), `refresh-diverged-branch` (unchanged), `install`, `reload`,
  `reindex` (thin wrappers).
- `cant-break-by-design` remains the `unbreakable` plugin's skill; declared a
  dependency; the banner reports whether it is installed.

## Testing and verification

- Unit (`node:test`, fast): `classify()` table with ferrislicer's 26 cases
  mapped to the story's acceptance checks; parsers on well-formed / malformed /
  empty; `emit()` shapes; index generator on a fixture tree; `place`.
- Integration (temp repos from one fixture factory under `os.tmpdir()`):
  capture from inside a worktree writes the root inbox; gate outcomes for
  pending / stale index / blank-line citation / missing section / sweep cases /
  clean; `install` idempotent and refreshing; intake refuses `PRULE` from a
  worktree, files from root, bumps on the universal path.
- Every suite has a mutation fixture proving red; a meta-test counts them.
- Hook payloads are recorded once from this machine into
  `test/fixtures/payloads/` and replayed; a missing fixture fails the suite.
- Platform facts verified by hand with the plugin installed via `--plugin-dir`
  (plan's last task), then dated in the table above.
- This repo's pre-commit gains `node --test plugins/machinery/test` (budget
  15 s, asserted; 10 s until the owner raised it on 2026-09-05 when the
  tool-assimilation suite measured 10.4–10.6 s) and `gate.mjs --universal`.

## Failure handling

Per-script posture as in the mechanisms table. Missing config → documented
defaults. Rules source that does not resolve → loud banner, nothing else
changes. `git`/`node` not found → abort naming what was looked for. A script
exits non-zero only where its story says it blocks.

## Invariant ledger

| # | Invariant | Mechanism | Rung | Promotion / debt |
|---|---|---|---|---|
| I1 | A universal rule's text exists in exactly one place. | Plugin `rules/` only; union copy deleted; `~/.claude/rules/machinery` is a junction. | 8 / 4 | Build check: no other `rules/` tree shares a heading with the plugin's. |
| I2 | The index never disagrees with the rule files. | Index is generated; gate regenerates and fails on difference. | 6 | 8 = no file; kept as file because the platform loads files. |
| I3 | A captured rule lands only in the inbox its marker names. | One hook is the sole inbox writer; destination from marker; bare `RULE:` writes nothing; `markers.json` read by hook, banner, gate. | 6 | Prose restates markers (0); drift test on banner text. |
| I4 | A rule change is a plugin change others receive. | Intake bumps in the same commit; version check is the backstop. | 6 + 4 | — |
| I5 | Nothing commits with a pending entry or a broken citation. | Commit gate, every commit. | 4 | — |
| I6 | Installed git hooks survive plugin updates. | Gate copied into the project, version-stamped; refresh = `/install`. | 8 / 2 | — |
| I7 | Hooks are activated per clone, never self-installing. | `/install` is the only `core.hooksPath` writer; banner measures and prints the truth. | 6 / 2 | Deliberate ceiling (owner rule). |
| I8 | Inbox and index are consumed only as parsed records. | One parser per format; malformed = gate failure. | 6 | 7 with TypeScript brands; filed. |
| I9 | Every acceptance check is a test that can fail. | node:test per script + mutation fixture. | 3 | Support structure. |
| I10 | Command-classification precedence has one definition. | Single `classify()`; private pattern tables; no second call site. | 6 | — |
| I11 | Universal rules are present in every session on the machine. | Junction + native loading. | 8 | Banner measures the junction (2). |
| I12 | Index and inbox are never loaded as rules. | Fixed paths outside any rules directory. | 8 | — |
| I13 | Supersession is bidirectional. | The generator validates the declaring file's own superseded-section name exists, and renders both directions from that. Duplicate stamps across files and the `by:`-target section's own existence are NOT checked. | 4 | Debt: duplicate-stamp and by:-target validation, filed (amended 2026-09-02, final review H1). |
| I14 | A universal filing takes effect in the filing session. | The `rule-intake` skill's last step instructs the agent to run `/machinery:reload`; `intake.mjs` itself does not invoke it. | 2 | Ceiling: depends on the agent following the skill's last step (amended 2026-09-02, final review H1). |
| I15 | One definition of the rules source. | Single config module. | 6 | — |
| I16 | Status marks are exactly the union's three. | Parser accepts only those; generator refuses others. | 6 | — |
| I17 | The filter never blocks or loses a command. | One wrapper; fail-open; exit status preserved; tested with a broken hook. | 6 | — |
| I18 | User pipes/redirects are never overridden. | `classify` returns piped/redirected before any rewrite branch. | 6 | — |
| I19 | Hook JSON has one shape per kind. | Single `emit()`; lint forbids `JSON.stringify` elsewhere in scripts. | 6 + 4 | — |
| I20 | "Project root" is computed one way. | `lib/root.mjs`; fixture suite runs each script from a worktree. | 6 | — |
| I21 | The destined shell runs the command. | `tool_name` selects the shell; unknown shell refused (closed set). | 7 | — |
| I22 | Nothing depends on an undocumented event. | Skills hold without `WorktreeCreate`; banner measures whether it fires. | 2 | Promote when documented. |
| I23 | The gate never mutates the tree. | Read-side imports only; lint forbids `fs.write*` under `gate/`. | 4 | — |
| I24 | The gate stays cheap. | Closed check array; no config extension point. | 7 | — |
| I25 | Every executed check reports a denominator. | `register_check` and `citation_target` always report N of M through a single `report()` (asserted by the clean-commit test). The advisory sweep guard is outside this claim: it is silent when it has nothing to flag — no denominator line. | 6 | Amended 2026-09-02, final review H1: dropped the claimed self-test that would fail a check omitting `report()` — none exists; coverage is the two calls above, not a generic guard. |
| I26 | Citations are validated once, at authoring. | Only staged-diff citations are examined. | 6 | `--full` (a full-tree sweep) is spec-2 surface, not implemented here; dropped from the mechanism text (amended 2026-09-02, final review H1). |
| I27 | What runs in the project is what the plugin shipped. | Version stamp; banner compares. | 2 | Ceiling by I6. |
| I28 | The index cannot be hand-edited into acceptance. | Gate compares staged index to regeneration. | 6 | — |
| I29 | A project rule's filing commit lands in the project root. | Intake refuses `PRULE` filing unless git dir = common dir. | 6 | — |
| I30 | Each pipeline is one commit in one repo. | No cross-repo step exists. | 7 | — |
| I31 | Universal rule change and bump are one change. | Intake bumps in the same commit. | 6 + 4 | — |
| I32 | A pending entry cannot be forgotten. | Prompt-time nudge in eligible sessions + gate. | 4 / 2 | Ceiling: never self-filing. |
| I33 | A rule's placement is real. | `place` writes only under a heading; index proves; gate compares. | 6 | — |
| I34 | Rules are written only through one inserter. | `place.mjs` sole writer in scripts. | 6 | Hand edits caught by I28, not prevented; filed. |
| I35 | Audit procedure loads only when auditing. | Lives only in the agent file. | 8 | — |
| I36 | Every command a skill names exists. | Test over the source bucket subfolder's tokens vs routed skills. | 4 | — |
| I37 | Skills don't restate rules. | Test: no rule's first sentence verbatim in a skill. | 4 | Generator = 8; filed. |
| I38 | The mandatory skill's absence is visible. | Banner reports presence. | 2 | Ceiling: skills can't be forced. |
| I39 | Every suite can go red. | Mutation fixture per suite; meta-test counts. | 3 + 4 | — |
| I40 | Hook tests use real payload shapes. | Recorded fixtures; missing fixture fails. | 3 | Re-record on platform change. |
| I41 | Tests never touch a real repository. | One fixture factory under tmpdir with the root passed as a parameter, plus GIT_* scrubbed at helper import (`test/helpers/env.mjs`) and a scan (`env-scrub.test.mjs`) that every test file spawning git imports a scrubbing helper. A positive control and its inverse prove the scrub fires. | 5 + 4 | Falsified 2026-09-02: a hook-invoked run from a linked worktree inherited `GIT_DIR` and wrote into the outer repository; amended. |
| I42 | This repo's commit gate stays cheap. | Test budget (15 s) asserted in pre-commit. | 4 | Raised 10 s → 15 s, owner 2026-09-05 ("i'm ok with the increase in budget"): the branch measured 10.4–10.6 s and `date +%s` resolution made the gate fail by phase. |

## Out of scope (spec 2)

Merge-gate runner (project-declared legs, baseline-diff judging, newly-green
reporting, isolated build dir, quick mode), ratchets, `/machinery:merge-gate`,
and any mechanism for the reference-sources "never copy" rule.
