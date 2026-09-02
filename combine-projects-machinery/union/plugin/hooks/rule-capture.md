# Rule capture

Captures a dictated standing rule the moment it is dictated, mechanically, so
that no rule depends on the session remembering it. The rules it serves are in
`rules/rule-governance.md`; this is the mechanism.

**When it runs:** On the assistant's prompt-submit event — after the person
sends a prompt and before the assistant composes any part of its reply. This
hook captures PROJECT rules; a universal rule is captured through the shared
universal-rules skill's own trigger and never lands in this inbox.

**What it reads:**

- The event payload: the prompt text as typed, and the identifier of the
  session it was typed in.
- The project root that owns this session's working copy — resolved to the
  top of the repository, never to the working copy itself, using the
  harness's project-root variable when it is set and the resolved repository
  root otherwise.
- Nothing else. It does not read the register, the rule files, the inbox's
  existing contents, or the change under way.

**What it does:**

1. Parse the event payload. If it cannot be parsed at all, do nothing, print
   nothing, and report success: the prompt goes through exactly as typed.
2. Take the prompt text, treating a missing one as empty.
3. Strip leading whitespace and test whether what remains begins with the
   agreed mark, compared without regard to case. The mark is an exact protocol
   prefix and it is the sole trigger. Nothing matches on the wording, nothing
   guesses at a phrase, and no model classifies the intent — a prompt that
   plainly dictates a rule but carries no mark is not captured.
4. If the mark is absent, do nothing and report success. An unmarked prompt is
   never stored anywhere.
5. If the mark is present, resolve the inbox file under the project root read
   above. The hook writes to the project root's inbox regardless of which
   checkout the session is running in: a session working inside an isolated
   working copy resolves the same project root as one working in the shared
   checkout, and the entry is appended there, never into the working copy's
   own inbox.
6. Append exactly one entry to that file: a blank separator line, a heading
   carrying the capture time in coordinated universal time and the session
   identifier (a fixed placeholder when the payload carries none), the prompt
   verbatim with only its surrounding whitespace trimmed, and a disposition
   line reading pending.
7. Append only. No existing entry is read, rewritten, reordered or removed, and
   a second capture of identical text becomes a second entry rather than being
   recognised as a duplicate.
8. Print the filing instruction below on the hook's own output, which the
   harness folds into the turn's context, so the session that dictated the rule
   is told about the entry it just created and what will fail until it is
   filed.
9. Report success. Capture never blocks the turn, never delays it, and never
   rewrites the prompt.
10. Capture only. The hook does not decide whether the prompt really states a
    rule, where it belongs, or what it supersedes. Every entry is a proposal
    for the owner to dispose of.
11. A failure to write the entry is not swallowed. The hook fails and the
    harness reports it, because a capture that silently did not happen is the
    one outcome this mechanism exists to make impossible.

**What the user sees:** on a marked prompt, one message in the turn's context,
before the reply:

```
RULE captured verbatim to the inbox (Disposition: PENDING). File it now with
the rule-intake procedure: write the rule into its own durable home first,
then add the citing register row, then set this entry's disposition. Until
that is done the register check fails, and commits are blocked wherever the
commit gate is active.
```

On an unmarked prompt, on an unreadable payload, and on a prompt that carries
no text at all: nothing. Silence is the normal case.

**Acceptance checks:**

- Given a prompt whose first non-whitespace characters are the mark in any
  mixture of upper and lower case, when it is submitted, then exactly one entry
  is appended to the inbox before the assistant replies, its heading carries a
  coordinated-universal-time stamp and the session identifier, its body is the
  prompt word for word, and its disposition reads pending.
- Given a prompt that describes a standing rule in ordinary words with no mark,
  when it is submitted, then the inbox is byte-identical to what it was and
  nothing is printed.
- Given a payload the hook cannot parse, or one carrying no prompt, when the
  event fires, then the hook reports success, prints nothing, and the prompt
  runs unaltered.
- Given a marked prompt, when the session ignores the printed instruction and
  the turn then dies part-way through, then the entry is still in the inbox
  with its pending disposition.
- Given a session running inside an isolated working copy, when a marked
  prompt is submitted, then the entry appears in the project root's inbox and
  nowhere in the copy.
- Given two marked prompts carrying identical text, when both are submitted,
  then the inbox holds two entries: the hook never deduplicates and never
  edits.
- Given a universal rule, when it is dictated, then it is filed through the
  shared universal-rules skill's own trigger and no inbox entry is created
  here.

<!-- rows: 2.1, 2.2, 2.3, 2.4, 2.25, 2.27; filing location per the 4.20 ruling -->
