# developer-friendliness as its own plugin — effort ledger

Ticket #94 (companion #96), item 1 only: the new plugin and its install step.
Items 2 (the skill rewording) and 3 (the machinery rule removals) are NOT in
this branch. The skill's `SKILL.md` comes across byte-identical here; that is
the first half of the two-step refactor.

Working copy: `.claude/worktrees/developer-friendliness-plugin`, branch
`developer-friendliness-plugin`, based on `main` at dd9d328.

## Predictions, written before any change

Written 2026-09-11, before the first edit. What the work will affect, and just
as explicitly what it must leave alone.

1. `git mv pure-prose/unbreakable/developer-friendliness →
   claude-code/developer-friendliness/developer-friendliness` on its own, with
   no manifest change, makes `build-skills.mjs check` fail — twice: the new
   bucket subfolder is not a `claude-plugin` route key, and the `unbreakable`
   route lists a skill that now sits in the wrong subfolder.
2. Once the route, the plugin manifest and the marketplace entry exist,
   `build` prunes `plugins/unbreakable/skills/developer-friendliness/` by
   itself: `build()` deletes and rewrites each stage directory wholesale. No
   `git rm` needed — only the deletion has to be committed.
3. `validateVersions` will then demand a version bump on `unbreakable` (its
   staged contents shrank) and on `machinery` (its `plugin.json` gains a
   dependency). It will NOT demand one on `dreamy`.
4. The machinery suite (`plugins/machinery/test/*.test.mjs`) is unaffected.
   Its two repo-wide tests (`skills.test.mjs`, `single-copy.test.mjs`) scope
   themselves to `claude-code/machinery` and `plugins/machinery/rules`
   respectively, so nothing there reads the moved path.
5. Before the `build-skills.mjs` change, all four new tests fail: no
   `~/.claude/rules` entry is ever created, and neither `claude-rules`
   validation error is raised (the target does not exist yet).
6. Exactly two files outside the manifest and the plugins reference the old
   bucket path and would be left pointing at nothing: `README.md` line 47 and
   `docs/evals/developer-friendliness/README.md` line 21. Nothing else in the
   repo spells `pure-prose/unbreakable/developer-friendliness`.
7. `install()` gaining a second root does not change what it does to
   `~/.claude/skills`: the same link, relink, dangling and plain-copy handling,
   the same `--force` refusal. The refactor that gives it two roots is a move
   with no change in behaviour.

## How each prediction came out

1. **Held.** The move alone produced exactly two errors:
   `claude-code/developer-friendliness/ is not a claude-plugin route key` and
   `route "unbreakable" lists skill "developer-friendliness", which exists in
   no bucket`.
2. **Held.** `build` deleted `plugins/unbreakable/skills/developer-friendliness/`
   by itself; only the deletion had to be staged.
3. **Held.** `check` reported `unbreakable 0.3.2 is a new version`,
   `machinery 0.1.110 is a new version` and
   `dreamy 0.2.1 matches the tree it was set on` — dreamy needed nothing.
4. **Held.** 649 machinery tests, 648 pass, 0 fail, 1 skipped. The skip is
   pre-existing and unrelated: "exit code is 1, never null, when the child is
   signal-killed", which does not run on Windows.
5. **Held, and it cost something.** All five new tests failed. The first run
   also reached the REAL `~/.claude/skills`, because the injection they depend
   on did not exist yet — see "What went wrong" below.
6. **Held.** `README.md` and `docs/evals/developer-friendliness/README.md` were
   the only two files spelling the old bucket path; both now point at the new
   one.
7. **Held with one deliberate exception.** The `~/.claude/skills` leg is the
   same code, now reached through `linkSkill()`. The one behaviour change is
   its already-installed message: `already linked` became
   `already linked at <dest>`, because with two roots the old line no longer
   says which entry it is talking about.

## What went wrong

Running the new install test before making the home root injectable pointed
three live entries in `~/.claude/skills` — `be-reasonable`,
`developer-friendliness` and `reload` — at a temp fixture that the same test run
then deleted. They were dangling for the length of one test run. All three were
put back by hand to the exact targets the untouched entries still use
(`I:\IdeaProjects\ai-skills\...`), and every link in that directory resolves
again. Nothing under `~/.claude/rules` was touched: `install()` had no rules leg
yet.

The lesson is narrow and mechanical: a test that exercises an installer must
never be run once "just to watch it fail" before the injection point exists.
Red comes second here — the seam that keeps the test off the real machine is
written first, and only then is the test allowed to run. The order that is
normally safe (test, watch it fail, implement) inverts for anything that writes
outside the working copy.

## What was done

- `git mv pure-prose/unbreakable/developer-friendliness →
  claude-code/developer-friendliness/developer-friendliness`, byte-identical
  (`git diff -M --stat`: 0 insertions, 0 deletions). The bucket changes because
  the skill now assumes the `~/.claude` layout.
- `skills.manifest.json`: a `developer-friendliness` route; the name dropped
  from the `unbreakable` route; a new `claude-rules` target with a per-skill
  list; `claude-rules` added to the `claude-code` bucket's targets.
- `scripts/build-skills.mjs`: one `HOME` authority (`AI_SKILLS_HOME ||
  os.homedir()`); `claude-rules` validated as strictly as the routes;
  `install()` split into `linkSkill()` plus two roots.
- `scripts/test/build-skills.test.mjs`: the script's first test harness, five
  cases, all against fixture repos under an injected temp home. Wired into
  `.githooks/pre-commit` as its own leg with its own count line.
- New plugin `plugins/developer-friendliness/` at 0.1.0, a marketplace entry,
  `machinery` depending on it (0.1.109 → 0.1.110), `unbreakable` 0.3.1 → 0.3.2.

## What changed, what got better, what got worse

**Better.** `scripts/build-skills.mjs` had no tests at all; it now has five and
a pre-commit leg, so the next change to it is not landed on faith. The two
things that decide whether a skill is always-on — which bucket may have a rules
entry, and which skill actually gets one — are both declared and both checked,
so neither can be inferred from a folder name. `install()` no longer reaches
`os.homedir()` from inside a loop body, which is what made it untestable.

**Worse.** The always-loaded set grows by about 7k tokens per session, in every
project. `#67`'s planned cap sums `plugins/machinery/rules/*.md` and will not
count this. Nothing in this branch tells anyone when that number moves.

**Did it achieve its point?** For item 1, yes: the skill ships as its own plugin
and `install` puts it where Claude Code loads it every session. It is not yet
proven end to end, because running a real `install` would repoint the owner's
live links at this working copy — that is deliberately left for the owner to run
from the shared checkout after the merge.

**New smells.**
- `skills.manifest.json` declares `"$schema": "./scripts/skills.manifest.schema.json"`,
  and that file does not exist. The new `claude-rules` target is therefore
  unvalidated by any schema — only by `build-skills.mjs`. Pre-existing; not
  touched here.
- `unbreakable`'s description advertised three parts, one of which left with
  this skill. Corrected in both `plugin.json` and `marketplace.json`, which is a
  change the design did not list.
- The claude-rules list and `buckets[].targets` spell the permission in two
  places by design. The build binds them, the same way it binds route keys to
  subfolders, so this is the established shape rather than a new one — but it is
  the second such pair in this manifest.
