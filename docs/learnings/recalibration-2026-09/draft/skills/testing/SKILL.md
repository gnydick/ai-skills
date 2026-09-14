---
name: testing
description: Load before writing or changing any code or test, before a refactor, and when a test or build fails or a bug is being diagnosed. Holds the TDD cycle, what the git hooks run, how to write a test, and how to handle a failure.
---
# Testing

## TDD cycle (you run this while working)
1. TDD red: write one new test for the next behaviour, or one that reproduces the bug. Run only that test (`cargo test -p <crate> <name>`, `node --test --test-name-pattern <name>`). It must fail because the behaviour is missing. No product code before this run.
2. TDD green: write the smallest code that makes it pass. Run that same test. It must pass.
3. TDD refactor: change structure only; run the same tests, they stay green. The commit message says "no behaviour change".
- The cycle never runs broader tests.
- Never implement first and then break the code to watch a test fail, and never disturb and restore a real file to prove a check.
- A site you believe is affected that neither the build nor a test named: write down the path from the change to that site, then TDD red there before touching it.
- A refactor that also changes behaviour is two commits: the TDD refactor commit (tests green), then TDD red and green for the new behaviour.
- When code moves, its tests move with it in the same commit.

## Git hooks (automatic; do not run their checks yourself, read their output)
The project's tiers are recorded in `.claude/machinery/config.json` key `tiers` (/machinery:setup tiers). The hooks run the recorded commands.
- `git commit`: build/format checks and `tiers.fast` for the components the commit touches.
- `git push` to main: `tiers.merge` on the pushed commit, in place; needs a clean working tree whose HEAD is the pushed commit.
- `tiers.heavy`: only on request or in hosted CI.

## Writing a test
- Declare the test's tier the way `tiers.declaration` says. If `tiers` is not recorded, run /machinery:setup tiers first.
- Take the expectation from something the code under test never produced: the stated setting, the fixture's dimensions, the input's shape, or arithmetic.
- A number copied out of a run is labelled in the test as a regression pin. Where no independent expectation exists yet, say so at the assertion and leave the work open.
- A regression test uses the default setting, not only an unusual one.
- A test that captures output drives the real renderer by the same path the user's output takes.
- A test of how an algorithm scales asserts the work done against what the input allows, never elapsed time; a generous timeout may stay only to catch a hang.
- A fixture that spawns a real subprocess removes every inherited environment variable that could redirect it outside the fixture directory before the first call.
- A change that creates or modifies a safeguard (a type that rejects bad values, a source-scanning check, a debug switch, a hook) writes that safeguard's tests, TDD red first, including a case proving a search-based check still matches. A change that only uses a safeguard tests only its own new behaviour. Tell which from your own diff.
- Where no automated test can reach (a real window, rendered layout, real hardware), say which layer is untested and verify by build, lint and a hands-on run of the rendered result at every supported window size.
- Dispatch `machinery:comparison-agent` as `comparisonAgent` in `.claude/machinery/config.json` says: `push-to-main` — before every push to main; `output-paths` — before a push to main whose changes touch a path in `comparisonPaths`; `on-request` — only when the user asks; any other recorded text — as that text says. Not recorded: run /machinery:setup comparison-agent first.

## When something fails
- Change only the site the change is about, then build. The errors and failures that come back are the list of affected sites. Never edit a site to find out whether it needed editing, or to make a failure elsewhere go away.
- If you edited a site and reverted it, show it is byte-identical (`git diff --exit-code -- <file>`) and say so in the report.
- A diagnosis is confirmed only when the path is traced step by step from the real observed input to the blamed line.
- When the task exists because an earlier belief was wrong, check whether the replacement assumes the same thing about its inputs one layer down.
- If you call a defect a class or pattern, search the area you changed for every instance and fix each by name.
- When a check is red, a result looks odd, or a baseline moves: find out why first. Never change code only to turn a check green, regenerate a baseline, or change a tolerance to get a result. A person reviews every regenerated baseline line by line.
