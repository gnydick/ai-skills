# ai-skills

Agent skills in two compatibility classes: `pure-prose` skills — no tool
names, no bundled scripts, no harness assumptions — that run on any agent
able to read text, and `claude-code` skills that bundle scripts and lean on
Claude Code's memory layout.

## Install (Claude Code)

```
/plugin marketplace add https://github.com/gnydick/ai-skills
/plugin install unbreakable@ai-skills
```

The full URL matters: given the short `gnydick/ai-skills` form, Claude Code
prefers an SSH clone whenever the machine has SSH keys, which fails on any
machine whose key isn't registered with GitHub. The explicit HTTPS URL is
cloned exactly as written.

Skills then load under the plugin's prefix:

```
unbreakable:cant-break-by-design
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

### `machinery` — Claude Code only

Loads a short always-on core (`plugins/machinery/core.md`) into every session
and every subagent through its SessionStart and SubagentStart hooks, ships the
rest of the process as the skills below, captures `PRULE:`/`URULE:`/`SPEC:`
prompts into an inbox that the commit gate holds until they are filed, and
installs per-project git hooks — pre-commit (gate, build check, fast tests for
the touched components) and pre-push to main (merge tests) — whose commands
`/machinery:setup` negotiates with the developer; `/machinery:install
--hosted-ci` turns those into a GitHub Actions workflow. Install it per project
(`claude plugin install machinery@ai-skills --scope project`, then
`/machinery:install` and `/machinery:setup`). See `plugins/machinery/README.md`
for the hooks and where the rules live.

| Skill | For |
|---|---|
| [`agents`](claude-code/machinery/agents/SKILL.md) | Load before dispatching any subagent, when a subagent's result comes back, and when creating or modifying an agent definition. |
| [`install`](claude-code/machinery/install/SKILL.md) | Load once per project, after a plugin update, when the session banner names something missing, and when the owner asks to move the git-hook checks to hosted CI. |
| [`instrumentation`](claude-code/machinery/instrumentation/SKILL.md) | Load when debugging by adding diagnostics, when measuring or comparing performance, when adding a diagnostic switch, trace, profiler span or diagnostic code, and when a program must print a cost or count. |
| [`postmortem`](claude-code/machinery/postmortem/SKILL.md) | Load only when the user runs /postmortem, at the end of a fix or debug session. |
| [`refresh-diverged-branch`](claude-code/machinery/refresh-diverged-branch/SKILL.md) | Load when merging the primary line into a long-lived edition branch throws a wall of conflicts, or when both branches have rewritten the same shared files. |
| [`reload`](claude-code/machinery/reload/SKILL.md) | Load when the user runs /machinery:reload, or after a filing changed core.md mid-session. |
| [`rule-process`](claude-code/machinery/rule-process/SKILL.md) | Load the moment a PRULE:, URULE: or SPEC: prompt is captured (the capture hook says so), when a prompt starts with "N rules pending" or "N specifications pending", when a commit is refused for a pending inbox entry, or when the owner rules something in conversation without a marker. |
| [`setup`](claude-code/machinery/setup/SKILL.md) | Load when the user runs /machinery:setup (whole setup) or /machinery:setup <item> (one item), after /machinery:install in a project whose machinery config lacks a setup item, and when a skill or hook says a setup item is not recorded. |
| [`testing`](claude-code/machinery/testing/SKILL.md) | Load before writing or changing any code or test, before a refactor, and when a test or build fails or a bug is being diagnosed. |
| [`tickets`](claude-code/machinery/tickets/SKILL.md) | Load when creating, reading, updating, blocking or closing a ticket or issue, when resuming an effort, and when filing a finding or follow-up. |
| [`tooling`](claude-code/machinery/tooling/SKILL.md) | Load when writing or modifying a script, hook, gate or long-running tool; when a tool must locate another executable; when setting up a project's toolchain, dependency configuration or background compile check; and when adding or promoting an output-filter catalog entry. |
| [`train-tool`](claude-code/machinery/train-tool/SKILL.md) | Load when a wrapped command's output ends with a `[quiet:train]` line, or when asked to teach the output filter a tool's answer line from its stored run logs. |
| [`worktree`](claude-code/machinery/worktree/SKILL.md) | Load before the first commit of any piece of work, before any git commit, merge or push, and when creating, listing or deleting a worktree. |

## Layout

```
pure-prose/<plugin>/<skill>/SKILL.md    source of truth, any harness
claude-code/<plugin>/<skill>/SKILL.md   source of truth, Claude Code only (may bundle scripts)
plugins/unbreakable/                    published plugins (staged, do not edit)
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
node scripts/build-skills.mjs hooks     # create .claude/rules and .claude/machinery, seed ~/.claude/rules/universal.md, enable .githooks (once per clone)
node scripts/build-skills.mjs deny …    # add an identifier that must never ship
```

Run `hooks` after cloning — git never installs hooks automatically. This
repo's own `.githooks/pre-commit` runs the inbox gate (this repo's project
inbox and the user's `~/.claude/machinery/inbox.md`), then the
tiers recorded in `.claude/machinery/config.json` (`checks.commit` =
`build-skills.mjs check`; the fast tier runs the suite of each component the
commit touches, `plugins/machinery/test` or `scripts/test`, through
`scripts/test-tier.mjs`); `.githooks/pre-push` runs both suites and the check
before a push to `main`.

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

