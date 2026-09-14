# Setting up send-results

One-time, per machine and per Google account. Do every step in order and
finish with the test send: a setup that was never exercised is not set up.

## 1. Confirm Gmail is connected

Look for `send_message` and `label_message` among the available tools (they
appear as Gmail connector tools). If they are present, Gmail is connected;
go to step 2.

If they are absent, the connector has to be attached from the claude.ai side:

1. Open https://claude.ai/settings/connectors (or Settings → Connectors).
2. Find **Gmail** and click Connect, then approve the Google consent screen
   for the same account that Claude Code is signed into.
3. Start a new Claude Code session. Connector tools are attached at session
   start, so the current session will not see the change.

Nothing is configured on the Claude Code side; the connector rides along with
the claude.ai login.

## 2. Confirm the address

Ask which address every report should go to, defaulting to the user's own.
Several addresses may be given, comma-separated. This is the only question
setup needs to ask.

## 3. Create the label

Call `list_labels` and look for a label named `Automation results` (or the
name the user prefers). If it exists, note its id. If not, `create_label`
with that display name and note the id from the response. Every report is
filed under this label, so the user has one filter to check.

## 4. Write the configuration

```
node <skill-dir>/scripts/results.mjs init --to <address> --label-name "Automation results" --label-id <id> --ide idea
```

`--ide` selects the JetBrains product used in the link labels and the deep link (`idea`,
`rustrover`, `pycharm`, `webstorm`, `goland`, `clion`, `rider`, ...). Pick the
one the user actually opens their projects in; a running IDE process is a fair
hint. `--port` overrides the IDE's built-in server port if it was changed from
63342.

This writes `~/.claude/send-results.json`. Re-running `init` merges the flags
given into the existing file, so a single field can be changed later without
repeating the rest. `results.mjs config` prints what is there.

## 5. Make the IDE accept the link

The primary link is `http://localhost:<port>/api/file/<absolute path>`, served
by the IDE's built-in web server. It is the only link a web mail client such as
Gmail keeps clickable: custom schemes like `jetbrains://` and `file://` are
shown as plain text there. The endpoint is provided by JetBrains' **IDE Remote
Control** plugin (`com.intellij.remoteControl`, Marketplace id 19991), which
is not bundled with every IDE build. Without it the server answers 404.

Check first, from a shell, with any file inside an open project:

```
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:63342/api/file/<absolute path with forward slashes>"
```

`200` means it works (the file opens in the IDE). `404` with the IDE running
means the plugin is missing: install it from Settings → Plugins → Marketplace,
search "IDE Remote Control", restart, and re-run the check. The first request
from a browser also raises a one-time confirmation inside the IDE; accept it.

Clicking the link from Gmail passes through a Google "Redirect Notice" page
because the destination is localhost; that is expected, click through once.

## 6. Send a test

Run `/send-results test`. It emails this skill's own `SKILL.md` with a fixed
summary. Ask the user to open the message and click the first link; the file
should appear in the IDE. The other two links are there for desktop mail
clients that honor custom schemes, and their raw URLs are in the plain-text
part of every message for copy and paste.

## 7. Keep it out of junk

Gmail may tag self-addressed automated mail as suspected junk (a user filter
did exactly that on the first test). If the user has such a filter, add an
exception before it: a filter on `subject:"[results]"` (or the configured
prefix) that never sends to spam and, optionally, skips the inbox. The skill
already applies the results label, so nothing else is needed to find them.

## What lives where

| Thing | Location |
|---|---|
| Recipient, label id, subject prefix, IDE, link templates | `~/.claude/send-results.json` |
| The message shape | `scripts/results.mjs` in this skill |
| The label itself | the user's Gmail account |

The configuration is deliberately outside the repository: it holds an email
address and a per-account label id, and the skill is published.
