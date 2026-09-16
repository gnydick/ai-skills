---
name: setup
description: Load when the user runs /machinery:setup (whole setup) or /machinery:setup <item> (one item), after /machinery:install in a project whose machinery config lacks a setup item, and when a skill or hook says a setup item is not recorded. Items - worktree, tiers, comparison-agent, review, retention, issue-tracking. Negotiates each item with the developer and records the answer.
---
# /machinery:setup

Settings live in `.claude/machinery/config.json`. Show them: `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" show` (each key, its recorded value or "not recorded", and the default where one exists). Record one: `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" set <key> <value>`; it refuses a value the key does not accept and names the accepted values. Both refuse first when `.claude/rules/` is absent: run /machinery:install (in the machinery plugin's own repo, `node scripts/build-skills.mjs hooks`), then come back.

## Every item
1. Open with a labelled example of the kind of answer wanted (`Example: "<the answer in the developer's words>"`), then the recorded value or the default.
2. Ask only what is not yet known, one question at a time. Write any illustrated value as a `<placeholder>`, never a plausible sample.
3. Checks you run (reading files, running the project's own tools) inform the question; they never write the answer.
4. Record only what the developer stated or confirmed, then commit: `git commit -m "machinery setup: <item>" -- .claude/machinery/config.json`.
5. `/machinery:setup`: run every item in the order below; for a recorded item, show the value and ask whether to keep it. `/machinery:setup <item>`: run only that item, even if it is recorded.

## worktree (key `worktree`, default `always`)
Example: "Give every piece of work its own worktree." Values: `always` (every piece of work gets its own worktree); `multi-commit` (only work expected to take more than one commit; before a second commit in the checkout, stop and move the work into a worktree); `never`.

## tiers (key `tiers`)
1. Lead with questions, each with your recommendation first: who sets up this project's tests (the developer, Claude, or both); whether to decide the tiers together (steps 2–3) or have Claude measure the suite and propose them (step 4); and how a new test gets its tier from now on — Claude asks per test, Claude proposes the tiers for a commit's new tests in one question, or Claude decides and says so in the report. Record the last answer as `tiers.assignment`.
2. Ask the longest wait the developer accepts for tests at each commit, and at each push to main.
3. Together: the developer names which tests belong to fast (each commit, touched components), merge (each push to main) and heavy (on request or hosted CI), and how a test declares its tier (for example a directory, name pattern or attribute).
4. Measure: run the full suite with per-test timings, save the output to a file, and list tests by duration. Propose fast = tests that finish within the commit wait for one component; merge = the whole-workspace run within the push wait; heavy = the rest. Show the measured numbers, the command and the machine configuration they came from.
5. Propose the components from the workspace layout (the packages, crates or modules the build already knows), one `name=path-prefix` each, and ask the developer to confirm or correct them; ask whether a build or format check should run at every commit before the fast tier.
6. Record `components` (`setup.mjs set components name=prefix …`), `checks.commit` (that check's command, if any), `tiers.declaration` (how a test declares its tier) and `tiers.fast`, `tiers.merge`, `tiers.heavy` (the command that runs exactly that tier; fast takes `<components>`, filled with the recorded components a staged path touches).

## comparison-agent (key `comparisonAgent`)
Example: "Compare output before every push to main." Values: `push-to-main`; `on-request`; `output-paths` (also record `comparisonPaths`, the paths whose changes can move output); or the developer's own description, word for word. Tell the developer before they choose: a git hook cannot launch an agent, so `push-to-main` and `output-paths` are carried out by Claude as a step before pushing, not enforced by the pre-push hook.

## review (key `reviewBeforeMain`)
Example: "I review everything before it reaches main." Values: `no-review`; `person` (the owner approves the change before the merge to main); `agent` (an adversarial review agent reviews the change before the merge); `person-and-agent`.

## retention (Claude Code's `cleanupPeriodDays`)
1. Read `cleanupPeriodDays` from `~/.claude/settings.json`; absent means 30 days.
2. Tell the developer: transcripts older than that are deleted after a session starts, so `/postmortem` has no evidence for work older than the period; and the setting is machine-wide, covering every project on this computer, not just this one.
3. Ask what period they want. Change the key only to their answer; if they keep it, write nothing.

## issue-tracking (#99)
Helps the developer set up their environment to interact with the tracking system (tool installed, signed in, route reachable, scope), then records which tracker this project uses as a project rule (`.claude/rules/project_issue_tracking.md`) through #99's commands and rule intake — never in `config.json`. The command's path is on the session banner's `issue tracking command:` line.
1. Run `<command> decide`. Asked for this item by name, negotiate it whatever `decide` prints; unprompted, hold the conversation only if it prints `issue_tracking: ask`. Offer its pre-fill first, labelled as what this machine already uses.
2. Example: "Use GitHub Issues to track this project." Ask only what is unknown: which tracker and project; is `<tool>` installed (suggest installing it); is `<tool>` signed in (the developer runs the login as `! <tool login command>`); is this for this project only or every project on this machine.
3. Check the route with one read (`<tool status command>`, then one read of one issue). Never create, edit, comment on, label or close anything — not even a test issue to prove write access — and never record what the read returned, any credential, or the name of the place a token is stored.
4. This project: `<command> record-project --answer "<answer>"`, then file it with /machinery:rule-process. Every project: `<command> record-global --answer "<answer>"`; it writes the global file only, so say that this project will ask again until it has its own answer.
- Re-running this item when the project already has an answer replaces it: record the new answer as a replacement inbox entry, and intake overwrites `.claude/rules/project_issue_tracking.md` with it; the commit message names the old and the new answer. (Mechanism: `record-project` accepts a replacement instead of refusing.)
