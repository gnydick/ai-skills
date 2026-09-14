---
name: postmortem
description: Load only when the user runs /postmortem, at the end of a fix or debug session. Dispatches one agent that reads the session transcripts and git history and names the guardrail that would have caught the wrong belief.
---
# /postmortem

1. Dispatch one post-mortem agent on a mid-tier model (skill `agents`) with: the transcript files `~/.claude/projects/<project>/*.jsonl` for the sessions in question (agent transcripts included), the commit range of the fix, and the ticket.
2. The agent answers, citing transcript lines or commits: what was believed; what was true; where the wrong belief entered; which guardrail (a test, a type, a hook, a check) would have caught it.
3. Report its answer in a few lines.
4. File each named guardrail as an issue with the campaign label and the follow-up label.
- If the work is older than `cleanupPeriodDays`, its transcripts are deleted: say so and stop.
