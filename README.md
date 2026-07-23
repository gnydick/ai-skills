# ai-skills

Agent skills written as pure prose — no tool names, no bundled scripts, no harness
assumptions — so they run on any agent that can read text.

## Install (Claude Code)

```
/plugin marketplace add gnydick/ai-skills
/plugin install unbreakable@ai-skills
```

Skills then load under the plugin's prefix:

```
unbreakable:cant-break-by-design
```

Manage or remove them later through the interactive `/plugin` menu.

## Use anywhere else

Nothing here depends on Claude Code. Copy a skill's `SKILL.md` into ChatGPT,
Gemini, Cursor, Codex, or whatever your agent reads for instructions and it
works unchanged — only *automatic* triggering from the `description` field is
harness-specific.

## Skills

| Skill | For |
|---|---|
| [`cant-break-by-design`](pure-prose/cant-break-by-design/SKILL.md) | Making invariants unrepresentable rather than merely checked. An 8-rung enforcement ladder, 15 language-independent techniques, the strongest tool available per language, and the tripwire: duplicating a processing step at a second call site means the design is already wrong. |

## Layout

```
pure-prose/<skill>/SKILL.md     source of truth
plugins/unbreakable/            the published plugin (staged, do not edit)
scripts/build-skills.mjs        build | check | install | hooks | deny
skills.manifest.json            which buckets fan out to which targets
```

Top-level directories are **compatibility classes, not namespaces**. `pure-prose`
means "runs on any harness"; the bucket name never appears in an installed
skill's path. `build-skills.mjs` is the only thing that flattens buckets into
distribution targets, so there is no second place a skill can be copied from.

## Development

```sh
node scripts/build-skills.mjs build     # stage buckets into the plugin
node scripts/build-skills.mjs check     # verify every guard; used by CI and the hook
node scripts/build-skills.mjs install   # link ~/.claude/skills/<name> to the source
node scripts/build-skills.mjs hooks     # enable .githooks (once per clone)
node scripts/build-skills.mjs deny …    # add an identifier that must never ship
```

Run `hooks` after cloning — git never installs hooks automatically.

`check` enforces eight relationships that would otherwise rely on someone
remembering them:

- every top-level bucket is declared in `skills.manifest.json`
- a skill's frontmatter `name` matches its directory name
- skill names are unique across all buckets (they share one flat namespace)
- staged bytes match the bucket source exactly
- the plugin directory has a manifest to publish under
- the marketplace entry name matches the plugin name, so the name you install
  is the prefix you type
- every tracked file under `.githooks/` is mode `100755`, because git silently
  skips hooks that are not executable
- no denied identifier appears anywhere in the repo

## License

GPL-3.0

