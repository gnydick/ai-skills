---
name: send-results
description: Report an automation's result to the one place the user always looks — emails a short summary plus links that open a local file straight in the IDE for editing, under a fixed Gmail label, in a format every automation shares. Use this whenever a skill, loop, scheduled routine, subagent, or long-running task finishes and produced a file worth looking at; whenever the user says "send me the results", "email me that", "let me know when it's done", "report this", "notify me", or "same place as usual"; and whenever another skill's instructions say to call send-results. Also owns `setup` (connect Gmail, pick the address, create the label) and `test`. Do not improvise a one-off email when this skill exists — the point is that every report looks the same and lands in the same label.
---

# Send results

Every automation reports to one inbox label, in one shape: a summary the user
can read on a phone, and links that open the file in the IDE on the machine
where it lives. The shape is produced by a script, not written fresh each time,
so the reports stay uniform as more automations are added.

```
/send-results <file> [--from <name>] [--title <text>] -- <summary>
/send-results <file> [--from <name>] [--title <text>] --summary "<text>"
/send-results <file> [--from <name>] [--title <text>] --summary-file <path>
/send-results setup
/send-results test
```

- `<file>` — the file to link to. Relative paths resolve against the current directory.
- `--from` — the automation reporting. This goes in the subject, so the user can
  scan a label full of reports and know which one is which. Pass the calling
  skill's name; without it the subject says `automation`.
- `--title` — replaces the file's basename in the subject.
- the summary — everything after `--`, or `--summary`, or a file via `--summary-file`
  when it is long or multi-line.

## Sending

1. Run the composer from this skill's `scripts/` directory, passing the
   arguments through unchanged (the script parses the same grammar):

   ```
   node <skill-dir>/scripts/results.mjs compose <file> --from <name> -- <summary>
   ```

   It prints JSON with a `send` object, a `labelIds` list, and the resolved
   `file` and `links`. If it exits non-zero, nothing has been sent: report its
   message to the user verbatim and stop. A missing file or empty summary is a
   caller bug, not something to paper over with a guessed path.

2. Call the Gmail `send_message` tool with the `send` object exactly as
   printed — `to`, `subject`, `body`, `htmlBody`. Do not add, trim, or reword
   any of it. The plain `body` carries the raw URLs so they can be copied if a
   mail client refuses to render a custom scheme; the `htmlBody` carries the
   clickable version.

3. Take the returned message `id` and call `label_message` with it and the
   `labelIds` from step 1. This is what makes "one place to look" true: the
   user filters on that label, not on a subject prefix.

4. Tell the user in one line: what was sent, to where, and the message id.
   Include the file path once. No restating the summary.

If `send_message` is not among the available tools, the Gmail connector is not
attached to this session. Say so and point at `/send-results setup`; do not
fall back to another channel, because a report that lands somewhere else is
one the user will not find.

If `label_message` fails because the label no longer exists, recreate it with
`create_label`, store the new id with `results.mjs init --label-id <id>`, and
label the message again. The email already went out; only the filing failed.

## Setup

`/send-results setup` walks the user through the connection once. Follow
`references/setup.md`. In short: confirm the Gmail connector is attached,
confirm the address to send to, create the label, write the configuration with
`results.mjs init`, then send a test message so the user can check which links
their mail client renders.

`/send-results test` sends this skill's own `SKILL.md` with a fixed summary,
`--from send-results`, so a setup can be verified without inventing a file.

## Calling this from another skill

Read `references/calling.md`. It holds the paragraph a skill author pastes
into their own SKILL.md and explains the contract: what to pass, what comes
back, and what to do when it fails. Automations should call this skill rather
than the Gmail tool directly, so a change to the report format is made in one
place.
