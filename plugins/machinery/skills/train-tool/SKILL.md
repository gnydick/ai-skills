---
name: train-tool
description: Load when a wrapped command's output ends with a `[quiet:train]` line, or when asked to teach the output filter a tool's answer line from its stored run logs.
---
# /machinery:train-tool

1. Read the log the line names with the Read tool. Line 1 is `$ <command>`; each later line is `<seconds> <out|err>  <text>`.
2. Choose EVERY line that states what happened: the summary, verdict or count. Not an error line, not the last line, not a progress line. A run may hold several — `cargo test` prints one `test result:` line per target, lib, integration and doctest — and all of them are answers.
3. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/train-tool.mjs" identify --log "<log>" --line <N[,N...]>`, with each N the log's own line number. At most 5; a run needing more is the owner's call.
4. `identified:` echoes each line; if one is wrong or one is missing, run again with the right numbers. `graduated:` plus two `wrote` lines: commit the catalog entry and its fixture with the next change.
5. `graduation refused` because the fixture could not prove the matcher: keep identifying on later runs. Refused for any other reason (a hand-written entry, already learned for another tool, unreadable catalog): stop and tell the owner what the refusal named.
- Never write the matcher or a regex yourself.
- If the answer line changes shape between runs, tell the owner and stop identifying that tool.
- `shadow: disagreed` after a run you identified fully: the matcher reached lines you did not name, or missed ones you did. Keep identifying every answer line on later runs; never widen anything by hand.
- Batch: `node "${CLAUDE_PLUGIN_ROOT}/scripts/train-tool.mjs" logs --key "<key>"`, then identify the logs oldest first, one call each. If the listing is empty, check that the directory it names is where the runner writes.
