---
name: agents
description: Load before dispatching any subagent, when a subagent's result comes back, and when creating or modifying an agent definition. Holds the one-agent-per-kind pool, model choice, batching, handing rulings to agents, and agent tool limits.
---
# Agents

## The pool
- Dispatch only work that would flood this session's context or is large and independent.
- Create agents on demand, one per kind of task. Standing kinds: doing the work, reviewing it, filing rules. Only the owner names a new kind.
- Reuse a kind's agent for every task of that kind, one task at a time, dependent tasks included. Different kinds may run at once.
- When an agent's context grows large, stop it and start a fresh one for that kind.
- Before dispatching, check the live-agents view. Name each agent at spawn for its kind and subject.
- Anything that fans out by construction runs only when the user explicitly asks; never suggest it.

## Each dispatch
- Say the agent may not spawn agents.
- Put a procedure's skill invocation in the instructions instead of loading the procedure in this session.
- Model: cheapest tier to enumerate or extract with citations; mid tier for synthesis and judgement; top tier (above sonnet) for design, adjudication, verdicts and coding. A plan names the model for each kind of task.
- An owner ruling goes to the agent verbatim (its words, or the document holding it), never paraphrased, never called a sketch or proposal, and never with licence to deviate — telling an agent that departures are fine converts the ruling into a proposal. State which outcomes are not available and which arguments were already rejected.
- A long job of many self-contained pieces goes in batches; pieces share a batch only with no ordering or shared state between them. Report how many batches ran and what each covered.
- Before sending agents after candidates from a scan, search or extraction, keep only candidates whose answer would change a decision (never a fixed count or fraction) and report what was dropped, by category.
- Each check runs once per stage by its one owner. Reviewers and this session read its output and never rerun it.

## When a result comes back
- Verify its counts and lists yourself. If a cheap agent's work fails that spot-check, redo the batch one tier up and say so.
- A scan hit or finding is a suspicion, never a fact: it is acted on only after a person has read the code and recorded a confirmation naming the exact place, never because the tool said so.
- An agent that reports departing from an owner ruling: take it to the owner; never accept it yourself.
- A generated proposal that fails the build, tests or checks is discarded unread.

## When creating or modifying an agent definition
- One file declares the one question it answers, its triggers, its exact tools and its model. It names out-of-scope things in one line and hands questions owned by another agent to that agent.
- An agent that only judges gets no command or write tools; its definition says the caller supplies its scope, and that without one it reports a blocked run and stops.
- An agent that must build and run gets an allowlist of build, test, harness and read-only inspection commands, and its definition forbids by name: branch create/move/delete, merge, reset, force-reset, push, checkout, rebase, commit, stash, worktree add/remove.
- A reviewing agent never stages the owner's protected records. An agent that generates content never commits to a protected branch.
