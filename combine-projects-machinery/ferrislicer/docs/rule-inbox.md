# Rule inbox

Prompts beginning `RULE:` are appended here verbatim by the UserPromptSubmit
capture hook (`.claude/hooks/rule_capture.py`) — mechanically, before the model
responds, with no language matching (Gabe's ruling, 2026-08-15: the explicit
mark is the only trigger).

Entry format:

    ## <UTC timestamp> <session id>

    RULE: <the prompt, verbatim>

    Disposition: PENDING

An entry with `Disposition: PENDING` fails `register_check.py`. Where that
actually runs — stated exactly, because the strength of a gate is the
mechanism and not the sentence (`docs/INVARIANTS.md` §7.9, rung 3):

- **A clone with `core.hooksPath` set to `.githooks`:** `.githooks/pre-commit`
  runs it on every commit — this is a per-clone git setting
  (`git config core.hooksPath .githooks`, run once), not a Claude Code
  behavior, so it gates a commit the same way whether made through a Claude
  session or a bare terminal/IDE. `.claude/settings.json` wires five hooks
  (`quiet_hook` on PreToolUse, `create_worktree` on WorktreeCreate,
  `rule_capture` on UserPromptSubmit, `rule_nudge` on PostToolUse, a
  SessionStart banner) and none of them runs `register_check.py` or any other
  git hook — a Claude session gets no gating `core.hooksPath` did not already
  give it.
- **CI:** `.github/workflows/governance.yml` runs it on push.
- **A bare `git commit` with `core.hooksPath` unset is NOT gated**, in a
  Claude session or out of one. A fresh clone has no `.git/hooks/pre-commit`
  and does not set `core.hooksPath` by default; nothing installs one. Such a
  commit lands locally with a PENDING entry and is caught only when CI sees
  the push.

To disposition:

- **File it** via `/rule-intake`: write the rule into its durable home
  (CLAUDE.md / spec / INVARIANTS.md), add the register row in
  `docs/RULES-GROUPED.md`, then replace PENDING with
  `Disposition: filed — <register group> (<file:line>)`.
- **Dismiss it**: replace PENDING with `Disposition: not a rule — <reason>`.

Entries are append-only history; never delete them.

## 2026-08-16T03:10:35Z redcheck

RULE: test-marker governance red-check

Disposition: not a rule — deliberate red-check of the capture hook and drain gate while landing GIT_341; the rejection above this commit is the demonstration.

## 2026-08-16T04:38:00Z session-44f09cbf (manual capture — hook registered mid-session, active from next session)

RULE: Cost directive working policy — cheapest capable model per task, quality held by verification gates rather than model tier

Disposition: filed — Solo / Process and method (CLAUDE.md:179)

## 2026-08-25T03:23:38Z 50b804b4-c32d-46b6-9adf-5f2ee84de71e

RULE: serial agents only

Disposition: filed — Process — agent orchestration (CLAUDE.md § Serial agents only)

## 2026-08-25T18:33:25Z 3b632261-7e99-429d-8837-b1e14add7040

RULE: we don't use WSL in this project until otherwise stated

Disposition: filed — Solo / Platforms and builds (CLAUDE.md:351)

## 2026-08-25T19:00:00Z 03b18328-2d8b-484e-9468-651f0def1da8 (manual capture — hook did not fire this session)

RULE: always batch long running tasks that are composed of many units that can run on their own to strike a balance between token usage and overhead of launching every unit in 1 agent

Disposition: filed — Process — agent orchestration (CLAUDE.md:281 § Batch the units)

## 2026-08-26T02:21:11Z 03b18328-2d8b-484e-9468-651f0def1da8

RULE: every change we make needs assumptions compiled that make our choice and design legitimate, along with the expected blast_radius that should and/or shouldn't be changed,  after the coding effort is complete all of those assumptions and blast_radius expected truths need to be confirmed

Disposition: filed — Verification — testing discipline (CLAUDE.md:30 § Every change states its assumptions and its blast radius)

## 2026-08-26T02:26:28Z 03b18328-2d8b-484e-9468-651f0def1da8

RULE: when an effort's ledger mismatches between before and after, launch an agent with sonnet to figure out why the mismatched happened and what we can learn from it in a form that we can make new rules out of it

Disposition: filed — Verification — testing discipline (CLAUDE.md:67 § A ledger mismatch launches a post-mortem agent)

## 2026-08-26T14:25:00Z 03b18328-2d8b-484e-9468-651f0def1da8 (manual capture -- ruled conversationally, not RULE:-prefixed, so the hook did not fire)

RULE: "crealityprint as a compatibility target, just not first pass"
RULE: "sanityprint is a reference source too, cite it directly"

Context: raised while auditing 608 CrealityPrint citations. Reverses the absolute
"never CrealityPrint" clause filed 2026-07-09
(`docs/superpowers/specs/2026-07-09-arachne-flow-single-source.md:65`). Not stamped
SUPERSEDED at the doc level: only one line of that Arachne-flow spec is affected, and
a whole-doc stamp would falsely retire the spec. Recorded instead as an adjudicated
wobble reversal in the group's "Where it ended", per the register contract.

Disposition: filed -- Reference sources -- porting policy (CLAUDE.md, section "Reference sources")
## 2026-08-26T18:18:00Z 95dbadfa (manual capture — discovered rule, never RULE:-marked; proposed by the peer session `Rounding`, approved by Gabe in-session)

RULE: a session that instruments a SHARED worktree announces the file and a unique marker string up front, before writing, so a live probe is distinguishable from unexplained drift in git status.

Disposition: filed — Process — shared-worktree coordination (CLAUDE.md:387)

## 2026-08-26T19:00:00Z 95dbadfa (manual capture — discovered rule, never RULE:-marked; surfaced across four measurement failures in one session, approved by Gabe in-session)

RULE: a measurement's scope is part of its claim — state what the measurement could see alongside the claim it supports. Concretely: a diff read without `-w` is not a diff of the code.

Disposition: filed — Verification — a measurement's scope is part of its claim (CLAUDE.md § A measurement's scope is part of its claim)

## 2026-08-26T20:30:00Z 08ec64c3 (RULE:-marked by Gabe in-session)

RULE: communication needs to be maximally concise without losing meaning. Use analogies to keep things simple; avoid computational geometry and other esoterica.

Disposition: filed — Solo / Process and method (CLAUDE.md § Be concise, and explain with analogies) (duplicate hand-capture of the hook-captured entry below, at 2026-08-27T00:09:38Z; kept because the inbox is append-only)

## 2026-08-26T20:40:00Z 08ec64c3 (RULE:-marked by Gabe in-session)

RULE: implementing a config field means the full manifestation of storage, defaults, and wiring into the hub. Implementation in the slicing engine is NOT required for the field to count as implemented.

Disposition: filed — Config — wiring honesty (CLAUDE.md § Config fields stop at the hub) (duplicate hand-capture of the hook-captured entry below, at 2026-08-27T00:10:03Z; kept because the inbox is append-only)

## 2026-08-26T21:05:00Z 08ec64c3 (proposed by the main loop after breaking the existing rule twice in one session; NOT yet approved by Gabe)

RULE (proposed amendment to "Agent cost economy"): the existing rule assigns a model TIER per subagent task but never says when work must be dispatched at all, so the main loop can simply do the work itself and never violate it. Add a trigger: the main loop does design, adjudication, verdicts, and verification of a returned result; everything else is dispatched. Bright line, so it is not a judgement call -- the same edit shape applied more than ~10 times, or any build-and-fix loop, is dispatched. Corollary, mirroring "Deviations are announced before they happen": before starting bulk work the main loop states "this is agent work, dispatching", or states why it is not.

Evidence: in one session the main loop hand-generated 103 accessors and rewrote a 251-row table twice, in-loop, and corrupted the table twice; a dispatched agent caught the corruption on its first pass.

Disposition: not a rule — superseded before adjudication by the entry immediately below (2026-08-26T21:15:00Z 08ec64c3, "efforts should be STARTED in agents, to conserve tokens"), which itself was later filed as the hook-captured entry at 2026-08-27T00:07:56Z below (CLAUDE.md § Work starts in an agent)

## 2026-08-26T21:15:00Z 08ec64c3 (RULE:-marked by Gabe in-session)

RULE: efforts should be STARTED in agents, to conserve tokens. The default is dispatch; the main loop keeps design, adjudication, verdicts, and verification of a returned result.

Supersedes the amendment proposed immediately above, which tried to define a size threshold ("same edit shape >10 times, or any build-and-fix loop"). No threshold is needed: an effort starts in an agent. The threshold framing also missed the actual cost -- it is not model tier per task, it is main-loop CONTEXT burned on tool output that an agent would have absorbed and summarised.

Disposition: filed — Process — agent orchestration (CLAUDE.md § Work starts in an agent) (duplicate hand-capture of the hook-captured entry below, at 2026-08-27T00:07:56Z; kept because the inbox is append-only)

## 2026-08-26T21:20:00Z 08ec64c3 (RULE:-marked by Gabe in-session — update to the entry above)

RULE (update): effort agents run SERIAL. Exactly one at a time, no workflows, no parallelism, no fan-out, unless the user explicitly asks for it. The main loop dispatches one, waits, verifies its result, then dispatches the next.

Combined with the entry above, the standing shape is: efforts START in an agent (to conserve main-loop context), and those agents run ONE at a time. Extends the existing CLAUDE.md HARD RULE "Serial agents only" (Gabe, 2026-08-24) to cover effort agents explicitly, and names workflows as prohibited by default rather than only fan-out.

Disposition: filed jointly — Process — agent orchestration (CLAUDE.md § Serial agents only, "Narrowed 2026-08-27" paragraph) (duplicate hand-capture of the hook-captured entries below, at 2026-08-27T00:10:33Z and 2026-08-27T00:13:35Z, which refined "serial, no parallelism" to PER TASK CLASS before filing; kept because the inbox is append-only)

## 2026-08-27T00:07:56Z 24f8632f-e85c-4f8a-a46a-57838fe562b0

RULE: efforts should be started in agents to conserve tokens

Disposition: filed — Process — agent orchestration (CLAUDE.md § Work starts in an agent)

## 2026-08-27T00:09:38Z 24f8632f-e85c-4f8a-a46a-57838fe562b0

RULE: communication needs to be maximally concise without losing meaning. use analogies to keep things simple and avoid computational geometry or other thing that are esoteric.

Disposition: filed — Solo / Process and method (CLAUDE.md § Be concise, and explain with analogies)

## 2026-08-27T00:10:03Z 24f8632f-e85c-4f8a-a46a-57838fe562b0

RULE: implementing config fields, there needs to be the full manifestation of the storage, defaults, and wiring into the hub. implementation into the slicing engine is not needed

Disposition: filed — Config — wiring honesty (CLAUDE.md § Config fields stop at the hub)

## 2026-08-27T00:10:33Z 24f8632f-e85c-4f8a-a46a-57838fe562b0

RULE: update existing -- effort agents should be executed serial with no workflows or parallelism unless requested by the user

Disposition: filed jointly with the next entry — Process — agent orchestration (CLAUDE.md § Serial agents only, "Narrowed 2026-08-27" paragraph). The next entry refined this one before filing: "serial, no parallelism" was too broad and is now scoped to PER TASK CLASS (parallel IS allowed across classes); filing this alone would have contradicted the refinement.

## 2026-08-27T00:13:35Z 24f8632f-e85c-4f8a-a46a-57838fe562b0

RULE: there are rules about running agents for different classes of tasks. each can only run serially. parallel execution is allowed between the classes e.g. effort, review, rule-intake and any other classes of agent

Disposition: filed jointly with the previous entry — Process — agent orchestration (CLAUDE.md § Serial agents only, "Narrowed 2026-08-27" paragraph)

## 2026-08-28T18:59:40Z governance-agent-GIT_622 (manual capture — ruled conversationally by Gabe from a post-mortem's two candidate rules ("file both rules"), not RULE:-prefixed, so the hook did not fire)

RULE: a gate that computes a working subset of the tree must print its own denominator on every run, not only in the zero case, and must never let "the diff is empty" pass silently when the base is derived from merge-parent order; a merge gate diffs against both parents (or resolves the pre-merge tip directly), never trusting `HEAD^1` alone.

Context: `scripts/merge-gate.sh`'s `BASE_REF` fallback assumed a merge commit's first parent is pre-merge `main`; merge commit `3360180e` was made ON the feature branch (parent 1 = the branch's own prior tip), so the rustfmt gate diffed against the wrong base, saw zero files, and passed while 4 files were genuinely unformatted (fixed at `2b8c1bb4`).

Disposition: filed — Verification — a measurement's scope is part of its claim (CLAUDE.md § A measurement's scope is part of its claim, "fifth instance" bullet); also registered under CI — gate integrity (docs/RULES-GROUPED.md)

## 2026-08-28T18:59:40Z governance-agent-GIT_622 (manual capture — ruled conversationally by Gabe from a post-mortem's two candidate rules ("file both rules"), not RULE:-prefixed, so the hook did not fire)

RULE: a merge/CI gate script that redirects a sub-check's output to a log file must at minimum echo that sub-check's own denominator line to its own stdout, not only pass/FAIL.

Context: `gate()` in `scripts/merge-gate.sh` redirects each gate's stdout+stderr wholly to a per-gate log; only the gate NAME and pass/FAIL reach the script's own stdout, so a sub-check's own explanatory line (e.g. fmt_gate's "no Rust files changed") is invisible outside the log file. Raised while investigating whether the token-conserving output filter (`.claude/hooks/quiet_run.py`) caused the GIT_566 rustfmt-gate miss; refuted as the cause (the evidence never reached any stream, filtered or not) but the investigation surfaced this separate defect.

Disposition: filed — CI — gate integrity (CLAUDE.md § A gate script echoes its sub-check's denominator)

## 2026-08-28T23:39:02Z 77b341a1-764a-4c6c-8fd7-0b6dec0d296a

RULE: i asked that all of our tools and commands be filtered so the background agents are probably pretty quiet. we should add a standard heartbeat across all of our tools that the main agent knows to look for

Disposition: filed — CI — gate integrity (CLAUDE.md § A long-running tool emits a heartbeat the main agent knows to look for)

## 2026-08-29T00:00:00Z governance-agent-GIT_85 (manual capture — ruled conversationally by Gabe, not RULE:-prefixed, so the hook did not fire)

RULE: maybe the rule is you should never short circuit full due diligence no matter how clean or positive any one of the checks feels?

Context: raised during the GIT_85 post-mortem, where a doc comment claimed two
config-loading functions differed only in legacy-key migration on the strength
of one clean grep (checking one function for one call), never reading the
second function's body. The two actually differ in six ways, and the stated
blast radius was violated. Narrowed from unbounded "full due diligence"
(unenforceable) to a checkable form: the list of required checks is
enumerated BEFORE the first one runs, and a pass on one never cancels
another.

Disposition: filed — Verification — a measurement's scope is part of its claim (CLAUDE.md § A measurement's scope is part of its claim, "A clean check does not shorten the list" bullet)

## 2026-08-30T18:48:00Z governance-agent-GIT_700 (manual capture — ruled conversationally by Gabe ("file it and wire the advisory in"), not RULE:-prefixed, so the hook did not fire)

A docs-shaped commit that stages a newly-tracked file outside CLAUDE.md/docs/ gets a pre-commit ADVISORY naming the file with its denominators — the wildcard-add sweep signature (incident 5465f460; GIT_698 post-mortem on #698 established the standing pathspec rule was sufficient but skipped by repetition, so a mechanical backstop is warranted). Advisory only, never blocking, per the no-language-matching ruling.

Disposition: filed — CI — gate integrity (CLAUDE.md § Worktrees, pathspec bullet); implemented as scripts/sweep_guard.sh + .githooks/pre-commit call, red-check scripts/sweep_guard_test.py (5/5 at introduction), GIT_700 (#700/#701).
