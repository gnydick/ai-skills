---
name: train-tool
description: Use when a wrapped command's output ends with a `[quiet:train]` line, or to teach the output filter a bespoke tool's answer line in batch from stored run logs. Reads the run's log, names the one line that is the tool's answer, and hands it to the training loop; the matcher is derived, never typed, and graduation writes a tracked catalog entry with its frozen fixture.
---
# /machinery:train-tool

The runner ends a noisy run of an unlearned tool with one advisory line:
`[quiet:train] <key>: answer line not yet learned (…) — read the log, then: node "…/scripts/train-tool.mjs" identify --log "<log>" --line <N>`.
It never blocks and nothing is applied by it; answering it is the whole of this skill.

1. Read the log the line names, with the `Read` tool so line numbers show. Line 1 is `$ <command>`; every line after is `<seconds> <out|err>  <text>`, verbatim.
2. Choose the ONE line that is the tool's answer: the line that states what happened — the summary, the verdict, the count. Not an error line (those survive on their own), not the last line (it always survives), not a progress line.
3. Run exactly: `node "${CLAUDE_PLUGIN_ROOT}/scripts/train-tool.mjs" identify --log "<log>" --line <N>`, with `N` the log file's own line number.
4. Read what comes back. `identified:` echoes the line — if it is not the one you meant, run again with the right number. `shadow:` says whether the prefix derived from earlier picks agreed with yours. `graduated:` names the id, and two `wrote` lines name the catalog entry and its frozen fixture: commit both with the next change, they are a team artifact. `train-tool: graduation refused` lists what the fixture could not prove; keep identifying on later runs.

Do not invent the pattern. The matcher is the longest common prefix of the lines you identify across runs; if you find yourself wanting to write a regex, stop — a hand-written entry goes in `.claude/machinery/tool-catalog.json` on its own, with its own fixture, and is never trained over. If the answer line genuinely differs in shape from run to run, say so to the owner and stop identifying it: a tool like that stays on the generic contract by design.

When a learned matcher drifts the runner says `learned answer line re-opened for training (<reason>)`; the steps are the same.

Batch: `node "${CLAUDE_PLUGIN_ROOT}/scripts/train-tool.mjs" logs --key "<key>"` lists that tool's stored run logs, newest first; identify them oldest first, one call each.
