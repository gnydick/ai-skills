# Session banner

Opens every session with the governance protocol, so that a session which knows
nothing else knows how to dictate a rule and what happens if it does not file
one. The rules themselves are in `rules/rule-governance.md`; this is the
mechanism that puts them in front of the session.

**When it runs:** When a session starts, before the first prompt is composed.

**What it reads:** Nothing. It is a fixed line of text held in the session
configuration. It performs no lookup, consults no file, and asks version
control nothing — which is exactly why it can go stale silently and why it is
edited in the same change that moves what it describes.

**What it does:**

1. Emit the governance banner into the session's opening context.
2. State five things and no more: how to dictate a standing rule, where the
   capture lands, what stays blocked until it is filed, where the register
   lives, and that a universal rule goes through the universal-rules skill's
   own trigger, not this mark.
3. State the true gating condition rather than a general claim of enforcement.
   Gating happens in two places and only those two: in a clone whose hooks-path
   setting has been pointed at the tracked hooks directory, and on the hosted
   check. A clone that never ran the activation command is not gated locally at
   all.
4. Where the project has no hosted check, say so in the banner. An opt-in hook
   and a missing continuous check are both holes, and naming them is part of
   claiming the gate exists.
5. Never block. It always reports success, and a session starts whether or not
   the banner was produced.
6. When the gate's activation or its coverage changes, the banner text changes
   in that same change. A banner naming a condition that is no longer true is a
   defect on the same footing as a stale map, not a cosmetic lag.

**What the user sees:** one message at the top of every session:

```
Governance: dictate a standing rule by starting the prompt with the agreed
mark (captured verbatim to the inbox). File it with the rule-intake procedure:
the rule's own home first, then the citing register row, then the entry's
disposition. Until it is filed the register check fails — which blocks commits
in any clone whose hooks path is pointed at the tracked hooks directory, and is
caught on the hosted check for a clone that never did. Register: the rules
index. A universal rule goes through the universal-rules skill's own trigger,
not this mark.
```

Where a project has no hosted check, the second half reads instead: *…which
blocks commits in any clone whose hooks path is pointed at the tracked hooks
directory; there is no hosted backstop, so a clone that never activated the
hook is ungated.*

**Acceptance checks:**

- Given a new session, when it opens, then the banner appears before the first
  reply and names all five: the mark, where the capture lands, what stays
  blocked, where the register lives, and that a universal rule goes through the
  universal-rules skill's own trigger rather than this mark.
- Given the banner claims a gate, when a reader checks the claim against the
  machinery, then the condition the banner names is the condition that actually
  gates — a clone with the hooks path configured, or the hosted check — and not
  a broader claim.
- Given a project with no hosted check, when the banner is read, then it says
  so rather than implying continuous coverage.
- Given the banner cannot be produced for any reason, when the session starts,
  then it starts anyway: the banner never blocks.
- Given a change that moves the commit gate's activation or coverage, when that
  change lands, then the banner text moves with it in the same commit, and a
  banner still naming the old condition is treated as broken rather than as
  out of date.

<!-- rows: 2.32, 2.7 -->
