// The one place the suite's git environment is scrubbed. Imported first by
// BOTH spawn paths — repo.mjs (which runs git directly) and run.mjs (which
// spawns a script that runs git for itself) — so no test file has to remember.
//
// A test process must never inherit the caller's git environment. Git runs a
// pre-commit hook with GIT_DIR and GIT_INDEX_FILE exported, and from a LINKED
// WORKTREE both are absolute (from the main checkout they are empty and
// `.git/index`, which resolve harmlessly against whatever cwd a child uses).
// Inherited, those absolute values make every `git` the suite runs operate on
// the outer repository instead of the fixture: the suite's own commits then
// re-enter the outer pre-commit hook — which fails with "Cannot find module
// <fixture>/scripts/build-skills.mjs" — and `git add` writes fixture content
// into the outer index. Measured 2026-09-02: committing from a worktree left
// `# fixture` staged over this repo's README.md, re-initialised the outer
// repository as bare, wrote a fixture identity into its config and created a
// `dup` branch. Scrubbed once at import, because execFileSync/spawnSync
// inherit process.env by default. env-scrub.test.mjs proves both that the
// scrub fires and that every spawning test file reaches it.
for (const k of Object.keys(process.env)) if (k.startsWith('GIT_')) delete process.env[k];
