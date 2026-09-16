---
name: tooling
description: Load when writing or modifying a script, hook, gate or long-running tool; when a tool must locate another executable; when setting up a project's toolchain, dependency configuration or background compile check; and when adding or promoting an output-filter catalog entry.
---
# Tooling

## Writing a tool, hook or gate
- Resolve every executable by explicit path and reject the known locations of same-named lookalike stubs.
- A tool or check that cannot find what it needs, or cannot run, exits non-zero naming what it looked for. It never skips silently.
- Every refusal message names the cause and the command that fixes it.
- A gate that sends sub-check output to a log still prints each sub-check's count line on its own output.
- A tool whose summary does not match the proof-line format prints one extra line in that format carrying its count, in addition to its usual report.
- A tool that can run longer than one heartbeat interval prints a heartbeat on its own output (not inside a log redirect) every interval: the project's liveness token, the tool name, elapsed time, and done/total where known. A fixture proves the heartbeat survives the output filter.

## Running tools
- Do not pass a tool its quiet flag when it runs under the output filter.
- Waiting on a job that prints heartbeats: no heartbeat for one interval means it is dead or hung, not that it is probably still working. Never sit waiting for a completion signal nobody promised you.
- Counting added lines in a diff: use `git diff -w`.

## Project toolchain
- A platform layer the owner ruled out is written as the owner's scope decision, naming the actual toolchain (the shell at its full path plus native tools); nothing in the project invokes the excluded layer.
- Prefer dependencies with few dependencies of their own.
- Dependency configuration: installs use the frozen lock file only; package lifecycle scripts are blocked except a named allowlist; a published version must reach a stated minimum age before install; the installer is pinned to a stated major version.
- Rust: run bacon's `check` job on the edited crates through a change-only filter (`grep --line-buffered`, then `uniq`) into Monitor, one line when the error count changes, in a small session or pooled agent. No continuous test watcher for Rust. A Node project may keep a continuous test watcher when its project setting says so.

## Output-filter catalog
- A tool the universal catalog lacks goes in `.claude/machinery/tool-catalog.json` with its fixture.
- A project entry that holds everywhere: `node "${CLAUDE_PLUGIN_ROOT}/scripts/promote-tool.mjs" --id <id> --root <project root>`. Each universal entry carries a `verified` note naming the tool version measured and what was observed.
