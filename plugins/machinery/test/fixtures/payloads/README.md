# Hook payload fixtures

Provenance: DOCUMENTATION-DERIVED (2026-09-02), not recorded. Field names follow
https://code.claude.com/docs/en/hooks; values are scrubbed placeholders (`<HOME>`,
`<TRANSCRIPT>`). Least certain: PostToolUse's result field name (`tool_result` per
the docs summary consulted) and WorktreeCreate's exact fields.

To replace them with real payloads from this machine: set `MACHINERY_RECORD` to this
directory's absolute path, run any session with
`claude --plugin-dir <repo>/plugins/machinery`, send one prompt, run one Bash and one
PowerShell command, edit one file, create a worktree, exit. Then scrub home paths to
`<HOME>` and transcript paths to `<TRANSCRIPT>` (the fixture test refuses a file that
contains your username). The recorder is `scripts/record-payload.mjs`, wired in
`hooks/hooks.json`.
