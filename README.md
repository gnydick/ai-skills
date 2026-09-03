# ai-skills

Agent skills in two compatibility classes: `pure-prose` skills — no tool
names, no bundled scripts, no harness assumptions — that run on any agent
able to read text, and `claude-code` skills that bundle scripts and lean on
Claude Code's memory layout.

## Install (Claude Code)

```
/plugin marketplace add https://github.com/gnydick/ai-skills
/plugin install unbreakable@ai-skills
/plugin install dreamy@ai-skills
```

The full URL matters: given the short `gnydick/ai-skills` form, Claude Code
prefers an SSH clone whenever the machine has SSH keys, which fails on any
machine whose key isn't registered with GitHub. The explicit HTTPS URL is
cloned exactly as written.

Skills then load under the plugin's prefix:

```
unbreakable:cant-break-by-design
dreamy:session-analysis
```

Manage or remove them later through the interactive `/plugin` menu.

## Use anywhere else

Nothing in `pure-prose/` depends on Claude Code. Copy a skill's `SKILL.md`
into ChatGPT, Gemini, Cursor, Codex, or whatever your agent reads for
instructions and it works unchanged — only *automatic* triggering from the
`description` field is harness-specific. The `claude-code/` skills need
Claude Code: they read its transcripts and memory directories and bundle
Node scripts to do it.

## Skills

### `unbreakable` — pure prose

| Skill | For |
|---|---|
| [`be-reasonable`](pure-prose/unbreakable/be-reasonable/SKILL.md) | Every design choice that *isn't* an invariant — precision, defaults, timeouts, naming, config, logging, test level, deploy shape, and who runs the tooling under a context budget. Four moves: derive the choice from the situation, lean toward the mistake that's cheaper to undo, split any decision serving two masters, and ask the developer when two answers are genuinely defensible. Plus a domain appendix showing the method already applied. |
| [`cant-break-by-design`](pure-prose/unbreakable/cant-break-by-design/SKILL.md) | Making invariants unrepresentable rather than merely checked. An 8-rung enforcement ladder, 15 language-independent techniques, the strongest tool available per language, and the tripwire: duplicating a processing step at a second call site means the design is already wrong. |
| [`developer-friendliness`](pure-prose/unbreakable/developer-friendliness/SKILL.md) | Everything an assistant produces that outlives the conversation — what gets filed, written down, reported, and left behind at a session boundary. A three-question filter, an 8-rung durability ladder whose top rung is deleting the note by making the situation impossible, and a budget that makes a tracker nobody triages as much of a failure as writing nothing at all. |

### `dreamy` — Claude Code only

A maintenance loop for Claude Code's long-term memory, meant to run
unattended (`/loop 4h /dreamy:dream`, a scheduled routine, or a habit at
the end of the day) and hand the human a file of checkboxes rather than a
conversation. `dream` is the one command that runs the loop: it applies
what the human ticked last time, then analyzes, then improves, then reports. `send-results` is how those runs,
or any other automation, report back: one email under one Gmail label, with
links that open the produced file in the IDE. It needs the Gmail connector
attached to the claude.ai account Claude Code is signed into;
`/send-results setup` walks through it once.

| Skill | For |
|---|---|
| [`dream`](claude-code/dreamy/dream/SKILL.md) | The loop as one command: checks whether the last Memory Improvement Overview was reviewed (ticked or edited) and applies the approved items first, then runs `session-analysis dream`, then `improve-memory`, then `send-results`. Keeps a run log (`~/.claude/dream/run-log.json`) of which overview was last written and which items are already applied, so a scheduled pass never re-proposes or double-applies. `--mode apply-fixes` only applies what was ticked. |
| [`session-analysis`](claude-code/dreamy/session-analysis/SKILL.md) | Distils the JSONL session transcripts under `~/.claude/projects` (a bundled Node script strips them to prompts, replies, compaction summaries, interrupts, tool tallies) and runs a subcommand over the digest. `dream` is the consolidation pass: which corrections, preferences, project facts and references from the sessions since the last run deserve promotion into long-term memory, written as a ranked, confidence-tagged overview file that the next skill consumes. Never asks a question; never writes memory itself. |
| [`improve-memory`](claude-code/dreamy/improve-memory/SKILL.md) | Consumes the dream overview. Edits the memory bank directly where the evidence is in the user's own words — merges duplicates, rewrites reversed rules in place with a dated superseded paragraph, promotes high-confidence findings, repairs the `MEMORY.md` indexes — and never edits instruction files in place: `CLAUDE.md` upgrades arrive as a full proposal in the crib-sheet-plus-subfiles shape (path-scoped `.claude/rules/*.md` for anything that applies to one part of a repo) with a fidelity ledger. Everything lands in a "Memory Improvement Overview" of applied changes and `- [ ]` items; `apply` executes the ticked ones. |
| [`send-results`](claude-code/dreamy/send-results/SKILL.md) | Hand it a file and a short summary from any skill, loop, or scheduled routine. It emails the summary with links that open the file straight in the IDE (JetBrains deep link, the IDE's local server, and `file://`), files the message under one fixed Gmail label, and keeps the shape identical across callers because a bundled script builds the message rather than the model. `references/calling.md` holds the paragraph a skill author pastes to make their own skill report through it. |

### `machinery` — Claude Code only

Keeps a set of universal process rules always-on across every project,
captures new rules as they're dictated mid-session, files them through a
mechanical intake pipeline, and installs a per-project commit gate. See
`plugins/machinery/README.md` for the plugin's own account of its hooks and
rule-filing sequence.

| Skill | For |
|---|---|
| [`install`](claude-code/machinery/install/SKILL.md) | Once per machine, makes the universal rules always-on; once per project, installs the commit gate, inbox and index. Idempotent; re-run after a plugin update to refresh the gate. |
| [`reload`](claude-code/machinery/reload/SKILL.md) | Puts the current rule files into this session's context without restarting, after a universal rule is filed or a rule file changes outside intake. |
| [`reindex`](claude-code/machinery/reindex/SKILL.md) | Regenerates the generated rule index after a hand-edit leaves it stale; the index itself is never hand-edited. |
| [`rule-intake`](claude-code/machinery/rule-intake/SKILL.md) | Files a captured `PRULE:`/`URULE:` prompt into its home, regenerates the index, dispositions the inbox entry, and commits — never self-filing a rule nobody dictated. |
| [`effort-lifecycle`](claude-code/machinery/effort-lifecycle/SKILL.md) | The sequence for any effort: create its own isolated working copy at the start, reset it onto the branch the work targets, commit from it, then merge, push and tear the copy down at the end — no size exception. |
| [`refresh-diverged-branch`](claude-code/machinery/refresh-diverged-branch/SKILL.md) | Rebuilds a long-lived parallel edition branch on a fresh copy of the primary line and re-applies only its genuine delta, turning a wall-of-conflicts merge into a few small reviewable grafts. |
| [`invariant-audit`](claude-code/machinery/invariant-audit/SKILL.md) | Exports the current branch's diff against its base and dispatches the read-only `invariant-auditor` agent on it, so an audit before merging is one command instead of a diff assembled by hand. |

## Layout

```
pure-prose/<plugin>/<skill>/SKILL.md    source of truth, any harness
claude-code/<plugin>/<skill>/SKILL.md   source of truth, Claude Code only (may bundle scripts)
plugins/unbreakable/                    published plugins (staged, do not edit)
plugins/dreamy/
plugins/machinery/
scripts/build-skills.mjs                build | check | install | hooks | deny
skills.manifest.json                    which buckets fan out to which targets,
                                        and which plugin each skill is routed to
```

Top-level directories are **compatibility classes, not namespaces**. `pure-prose`
means "runs on any harness"; `claude-code` means "needs Claude Code's tools,
transcripts and memory layout". The bucket name never appears in an installed
skill's path. `build-skills.mjs` is the only thing that flattens buckets into
distribution targets, so there is no second place a skill can be copied from.

The `<plugin>` level inside a bucket is the plugin the skill ships in, so
membership is visible in the tree instead of only in the manifest. It is not
where routing is decided: `skills.manifest.json` still *declares* which plugin
claims each skill, and `check` binds the two — a subfolder that disagrees with
the route claiming the skill fails the build, naming both.

## Development

```sh
node scripts/build-skills.mjs build     # stage buckets into the plugin
node scripts/build-skills.mjs check     # verify every guard; used by CI and the hook
node scripts/build-skills.mjs install   # link ~/.claude/skills/<name> to the source
node scripts/build-skills.mjs hooks     # enable .githooks (once per clone)
node scripts/build-skills.mjs deny …    # add an identifier that must never ship
```

Run `hooks` after cloning — git never installs hooks automatically.

`check` enforces sixteen relationships that would otherwise rely on someone
remembering them:

- every top-level bucket is declared in `skills.manifest.json`
- a skill sits in the subfolder named for the plugin route that claims it, so
  the tree and the manifest cannot drift apart
- a bucket's subfolders are named for claude-plugin routes and nothing else
- no skill directory sits directly under a bucket, which is the pre-subfolder
  layout and would publish one fewer skill without saying so
- a skill's frontmatter `name` matches its directory name
- skill names are unique across all buckets (they share one flat namespace)
- staged bytes match the bucket source exactly
- every routed plugin directory has a manifest to publish under
- the marketplace entry name matches the plugin name, so the name you install
  is the prefix you type
- each route key matches that plugin's declared name, since the key is the
  trigger prefix
- every skill targeting a plugin is claimed by exactly one route
- no route names a skill that exists in no bucket
- every routed plugin is listed in the marketplace, so nothing is published
  with no way to install it
- every tracked file under `.githooks/` is mode `100755`, because git silently
  skips hooks that are not executable
- no tracked file is stored with CRLF, because a one-line change to one of them
  arrives as a whole-file diff that is correct and unreviewable
- no denied identifier appears anywhere in the repo

## License

GPL-3.0

