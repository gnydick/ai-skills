# Calling send-results from another skill

Any skill that ends by producing a file can hand it off with one line. The
contract is small on purpose: a file and a summary in, a labeled email out.

## Paste this into the caller's SKILL.md

> When the run has finished and the output file is written, report it by
> invoking the `send-results` skill (via the Skill tool, `skill: "send-results"`)
> with `<output file> --from <this skill's name> -- <one to three sentences
> saying what was produced and what, if anything, needs the user's attention>`.
> Do not email the user directly; send-results owns the format and the label so
> every automation's report lands in the same place. If send-results reports
> that Gmail is not connected, say so in your final message and leave the file
> path there instead.

Replace `<this skill's name>` with the literal name. It goes in the subject
line, which is what the user scans.

## The argument grammar

```
<file> [--from <name>] [--title <text>] -- <summary>
<file> [--from <name>] [--title <text>] --summary "<text>"
<file> [--from <name>] [--title <text>] --summary-file <path>
```

`--summary-file` is for long or multi-line summaries; write them to a file
next to the output first. Keep the summary short regardless: the user reads it
on a phone to decide whether to open the file now or later. The file itself is
where the detail belongs.

## What the caller gets back

send-results finishes with one line: what was sent, to where, and the message
id. The caller should mention the send in its own final message so the user
knows to expect the email, and should not repeat the summary.

## Failure modes, and whose they are

| Symptom | Whose problem | What happens |
|---|---|---|
| file does not exist | caller's | nothing is sent; send-results reports the resolved path it looked for |
| empty summary | caller's | nothing is sent |
| Gmail tools absent | environment | nothing is sent; user is pointed at `/send-results setup` |
| no configuration | environment | nothing is sent; user is pointed at `/send-results setup` |
| label vanished | environment | email is sent, label is recreated and applied |

Callers never need to handle these beyond passing the message through. A
report that could not be sent is still a report: leave the file path in the
final message.

## Name under the plugin

Installed personally (`~/.claude/skills/send-results`) the skill is
`send-results`. Installed from the `dreamy` plugin it is
`dreamy:send-results`. The Skill tool accepts either form, whichever is
present; write the bare name unless the caller is itself shipped in the
`dreamy` plugin, where the prefixed form is guaranteed to exist.
