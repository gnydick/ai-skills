# machinery

A Claude Code plugin that loads a short always-on core into every session and
every subagent, ships the rest of the process as skills by kind, captures rules
and specifications as they are dictated mid-session, and installs per-project git
hooks whose checks are negotiated with the developer. It also quiets noisy
build/test output in the transcript and creates git worktrees with an unprefixed
branch name.

## Install

Per project — machinery is enabled where it is installed, and the core arrives
with it:

```
claude plugin install machinery@ai-skills --scope project   # or --scope local
/machinery:install
/machinery:setup
```

`/machinery:install` (`scripts/install.mjs`) copies the commit gate and the tier
runner into `.githooks/machinery/`, writes the `pre-commit` and `pre-push` hooks,
creates the project's inboxes, `tool-catalog.json` (tracked) and
`observations.json` (gitignored, per-machine), and sets `core.hooksPath`. It is
idempotent; re-run it after a plugin update. `/machinery:setup` records the
project's answers in `.claude/machinery/config.json` — worktree policy,
components, build check, test tiers, comparison agent, review before main,
transcript retention, issue tracking — one item at a time or all of them;
`/machinery:setup <item>` re-negotiates one. `/machinery:install --hosted-ci`
turns the recorded hook commands into a GitHub Actions workflow.

## Markers

A prompt starting with `PRULE:` captures a project rule; `URULE:` captures a
universal rule; `SPEC:` captures a specification; a bare `RULE:` captures nothing
and asks which. The tokens are defined once, in `markers.json`.

## Hooks

Claude Code hooks (`hooks/hooks.json`):

- **SessionStart** — prints a banner of facts measured this session (core present,
  the user's `universal.md` present or absent, `core.hooksPath`, gate version,
  hosted check, pending counts, whether the worktree hook has ever fired, the
  issue-tracking command, the markers), then injects `core.md` as context.
- **SubagentStart** — injects the same `core.md` into every subagent, built-in
  agents included.
- **UserPromptSubmit** — captures a marked prompt to the right inbox, word for
  word, before the assistant replies, and says to run `/machinery:rule-process`
  when anything is pending.
- **PreToolUse** (Bash, PowerShell) — rewrites a noisy or infra-signal command to
  run through `quiet-run`, so its transcript stays short; a command carrying
  `--no-verify` stops at a permission prompt.
- **WorktreeCreate** — creates the worktree with the branch name unprefixed (a
  leading `worktree-` is stripped) and records that the event fired, for the
  banner.

Installed git hooks (per project, by `/machinery:install`). Re-run it after
every plugin update: the session banner says when the installed gate is older
than the plugin, and the install migrates the project's layout — a file an
older plugin wrote and this one does not (the generated indexes, for one)
leaves disk and the git index, each step named in the summary; a second run
has nothing to migrate. The list of such files is `scripts/lib/migrations.mjs`,
the one place a future removal adds its entry.

- **pre-commit** — the gate: pending inbox entries (the project's inbox and the
  user's `~/.claude/machinery/inbox.md`, so an unfiled `URULE:` blocks a commit
  in any project) and undispositioned spec entries refuse the commit, a filed
  spec outside `docs/dictated-specs/` refuses it, the slip box check refuses an
  edited note, an edited ADR beyond its status line, a changed approved design
  or finished plan, a new superpowers file without front matter, a slip box file
  whose front matter cannot be read, a dictation note that no longer quotes its
  inbox entry, a structure note that embeds a superseded note or misses an
  in-force one, a broken link, a stale generated page, and a note with two
  successors, and the sweep guard warns
  (never blocks) when a documentation-shaped commit adds a brand-new
  non-documentation file; then the recorded `checks.commit`, then `tiers.fast`
  for the recorded components the staged paths touch.
- **pre-push** — `tiers.merge`, in place on a clean tree whose HEAD is the pushed
  commit, only for a push to `main`.

Every refusal names its cause and the command that fixes it.

## Skills

One skill per kind of work, at `claude-code/machinery/<kind>/SKILL.md` (staged
into `skills/` by `scripts/build-skills.mjs`): `agents`, `install`,
`instrumentation`, `postmortem`, `refresh-diverged-branch`, `reload`,
`rule-process`, `setup`, `testing`, `tickets`, `tooling`, `train-tool`,
`worktree`. Each description says when to load it. `agents/comparison-agent.md`
is the one agent definition.

## Where the rules live

- `core.md` — the always-on core, a few lines. It and the skills change only by
  editing this repo.
- `claude-code/machinery/<kind>/SKILL.md` — the process of that kind.
- `~/.claude/rules/universal.md` — the user's universal rules, where a `URULE:`
  files. `/machinery:install` seeds it with its heading and never overwrites
  it. Claude Code loads `~/.claude/rules/*.md` into every session itself, so
  they reach subagents and survive uninstalling the plugin.
- `.claude/rules/` — a project's own rules, one file each.
- Inboxes: `~/.claude/machinery/inbox.md` for the user's universal captures;
  `.claude/machinery/inbox.md` and `.claude/machinery/spec-inbox.md` for a
  project's rule and specification captures.
  Every inbox is append-only. An entry is never removed, reworded or rewrapped;
  only its disposition line changes, and a duplicate is dismissed rather than
  deleted. `spec-inbox.md` keeps every `FILED` entry for the life of the
  project: the gate's verbatim leg reads each dictation note back against its
  `FILED` entry there, so an entry dropped from that file refuses every commit
  with "restore it from the inbox" and nothing left to restore it from.
- `docs/dictated-specs/` — the slip box: `notes/` (one file per dictation, and
  version notes), `decisions/` (ADRs), `structure/` (one current-state page per
  subsystem) and a generated `INDEX.md`. `docs/spec-current/` holds the
  generated flat pages. Superpowers specs and plans stay in `docs/superpowers/`
  with front matter. `docs/` is outside `.claude/`, so nothing loads these into
  a session; read the flat page.

`/machinery:rule-process` files a captured entry into its home and dispositions
the entry — a `URULE:` as one dated bullet in `~/.claude/rules/universal.md`
(nothing to bump, build or commit: the home is not a repository); a `PRULE:`
into `.claude/rules/`, each landed in one commit; a `SPEC:` becomes one note
filed by `intake.mjs spec`, which also commits.
`/machinery:reload` puts the current `universal.md` into the running session.

## Teaching it a tool

The universal tool catalog (`data/tool-catalog.json`) names each off-the-shelf tool, the
line that is its answer, and its documented quiet flags; a project adds its own entries to
`.claude/machinery/tool-catalog.json`. When a project entry turns out to be true everywhere,
promote it with `node "${CLAUDE_PLUGIN_ROOT}/scripts/promote-tool.mjs" --id <id> --root <project root>`
— it refuses unless the project's fixture proves the outcome line survives filtering, then
moves the entry into the universal catalog and bumps the plugin version.

A tool the catalog does not know starts on the generic contract — the last line, error blocks,
proof lines and whatever the summary heuristics catch — and earns its own answer line through the
training loop. A noisy run ends with a `[quiet:train]` line naming the run's log; the session reads
the log and says which line is the answer (`/machinery:train-tool`); the matcher is the longest
common prefix of the lines identified across runs, a prefix by construction and never a regex; and
after two consecutive identifications on which that prefix picks exactly the line the session picked
— consecutive identifications, not consecutive runs: identifying in batch over stored logs skips
runs freely — it graduates into a learned entry in `.claude/machinery/tool-catalog.json` (tracked, a
team artifact like the rest of the project catalog) with a frozen fixture in
`.claude/machinery/fixtures/<id>.json` as its regression test. A learned matcher can only add a line
to the kept set, never remove one. Above that floor sits the display cap, which is not the matcher's:
once more than `MAX_SHOWN` (200) lines are kept, the render shows the first 120 and the last 80 with
an `... [n kept lines elided between head and tail] ...` line between them, whether a matcher was
involved or not — so promoting a line into a keep set already at exactly 200 moves one line into that
elision, which names itself in the output. It goes back into training on its own when it matches
nothing in a run, when a run fails with no error block, or when the output's shape moves; the state
of that training lives in `observations.json` and is per-machine like the rest of it.

## More

- The 2026-09 recalibration that produced this shape: `docs/learnings/recalibration-2026-09/STATUS.md`.
- How the hook payload fixtures under `test/fixtures/payloads/` were produced, and how to re-record them from a real session: `test/fixtures/payloads/README.md`.
