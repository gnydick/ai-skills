# CLAUDE.md § Serial agents only — full rule

Ruled by Gabe 2026-08-24 (RULE:-dictated): **serial agents only.** Exactly ONE
subagent runs at a time. Never fan out.

**Narrowed 2026-08-27 (RULE:-dictated, Gabe) — the serial constraint is PER
TASK CLASS, not global.** Agents divide into classes by the kind of task they
run — *effort* (implementation/research work), *review*, *rule-intake*, and
any other class as one gets named. WITHIN a class, exactly one agent runs at a
time, unchanged from 2026-08-24 above. ACROSS classes, parallel execution IS
allowed without asking: an effort agent and a review agent may run
concurrently. This folds in the same-day dictation that "effort agents should
be executed serial with no workflows or parallelism unless requested by the
user" — effort is one class among several, and the per-class rule already
says so; it was never meant as a stricter, separate constraint on effort
alone.

- The main loop dispatches one agent per class, waits for it, verifies its
  RESULT, and only then dispatches the next agent in that same class.
  "Independent tasks within a class" is not a licence to parallelise them.
- Every dispatch prompt forbids the agent from spawning its own subagents or
  using the Agent/Workflow tools. An agent that fans out is a fan-out,
  regardless of class.
- `ListAgents` — not TaskList — is what shows which agents are actually live,
  across every class. Check it before dispatching if there is any doubt.
- Workflows fan out by construction (a single `parallel()` can run ~10
  concurrently); a Workflow, and any parallelism beyond the cross-class
  allowance above, is never started without the user explicitly asking for
  it first — never on the agent's own initiative, even proposed as a
  question.

## Evidence and history

`docs/adr/0003-parallel-porting-and-gui-vision.md` (:25, :30) describes the
parallel porting arrangement — one crate per concurrent agent, batches with no
inter-agent dependencies. That ADR is HISTORICAL: it records how the porting
phase was run, and is not superseded here (Gabe, 2026-08-24). Its one-crate
ownership constraint is still good practice; its concurrency premise does not
license fan-out today.
